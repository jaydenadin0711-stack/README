/* ============================================================
   DISPATCH — iMessage (Mac only, free)

   Sends through the Messages app on this Mac and reads your
   replies from its message database. No Twilio, no fees: the
   texts go over iMessage like any other.

   Two ways to set it up (see dispatch/README.md):

   1. A second Apple ID for the bot (cleanest). Sign Messages on
      the Mac into a new free Apple ID; you text that address from
      your iPhone and it shows up as its own contact.
   2. Your own Apple ID. The bot's texts land in your "note to
      self" chat. Works, but you are texting yourself.

   Either way every message the bot sends starts with BOT_MARK,
   which is how it tells its own messages from yours.

   Needs, once, in System Settings → Privacy & Security:
     • Full Disk Access for the terminal app you run it from
       (to read ~/Library/Messages/chat.db)
     • Automation → Messages (macOS asks on the first send)
   ============================================================ */
'use strict';

const { execFile } = require('child_process');
const os = require('os');
const path = require('path');

const BOT_MARK = '🤖 ';
const POLL_MS = 2000;
const DB = path.join(os.homedir(), 'Library', 'Messages', 'chat.db');

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { maxBuffer: 20 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(new Error((stderr || err.message).trim()));
      resolve(stdout);
    });
  });
}

/* A phone number matches on its last 10 digits (so +1 / spacing don't matter);
   an email matches case-insensitively. */
function sameHandle(a, b) {
  a = String(a || '').trim().toLowerCase();
  b = String(b || '').trim().toLowerCase();
  if (!a || !b) return false;
  if (a.includes('@') || b.includes('@')) return a === b;
  const da = a.replace(/\D/g, '');
  const db = b.replace(/\D/g, '');
  return da.length >= 7 && da.slice(-10) === db.slice(-10);
}

/* Since macOS Ventura the text often lives only in attributedBody, an
   NSArchiver "typedstream". The string sits after the NSString class name:
   ... "NSString" 01 94 84 01 '+' <length> <utf-8 bytes>
   where <length> is one byte, or 0x81 + uint16 LE, or 0x82 + uint32 LE. */
function textFromAttributedBody(buf) {
  if (!buf || !buf.length) return '';
  const cls = buf.indexOf('NSString');
  if (cls < 0) return '';
  const plus = buf.indexOf(0x2b, cls + 8);
  if (plus < 0 || plus > cls + 16) return '';
  let i = plus + 1;
  let len = buf[i++];
  if (len === 0x81) { len = buf.readUInt16LE(i); i += 2; }
  else if (len === 0x82) { len = buf.readUInt32LE(i); i += 4; }
  return buf.slice(i, i + len).toString('utf8');
}

function hexToBuf(hex) {
  return hex ? Buffer.from(hex, 'hex') : null;
}

/* hex() keeps newlines and | inside messages from breaking the row format. */
function query(afterRowId) {
  const sql =
    'SELECT m.ROWID, m.is_from_me, hex(m.text), hex(m.attributedBody), ' +
    "COALESCE(h.id, ''), COALESCE(c.chat_identifier, '') " +
    'FROM message m ' +
    'LEFT JOIN handle h ON h.ROWID = m.handle_id ' +
    'LEFT JOIN chat_message_join cmj ON cmj.message_id = m.ROWID ' +
    'LEFT JOIN chat c ON c.ROWID = cmj.chat_id ' +
    'WHERE m.ROWID > ' + Number(afterRowId) + ' ORDER BY m.ROWID LIMIT 200;';
  return run('sqlite3', ['-readonly', '-separator', '|', DB, sql]).then(out =>
    out.split('\n').filter(Boolean).map(line => {
      const [rowid, fromMe, textHex, bodyHex, handle, chat] = line.split('|');
      const text = textHex
        ? Buffer.from(textHex, 'hex').toString('utf8')
        : textFromAttributedBody(hexToBuf(bodyHex));
      return { rowid: Number(rowid), fromMe: fromMe === '1', text: text.replace(/￼/g, '').trim(), handle, chat };
    })
  );
}

const SEND_SCRIPTS = [
  // macOS 11 and later
  'on run argv\n' +
  '  tell application "Messages"\n' +
  '    set svc to 1st account whose service type = iMessage\n' +
  '    send (item 2 of argv) to participant (item 1 of argv) of svc\n' +
  '  end tell\n' +
  'end run',
  // older macOS
  'on run argv\n' +
  '  tell application "Messages"\n' +
  '    set svc to 1st service whose service type = iMessage\n' +
  '    send (item 2 of argv) to buddy (item 1 of argv) of svc\n' +
  '  end tell\n' +
  'end run'
];

async function sendIMessage(to, text) {
  let lastErr;
  for (const script of SEND_SCRIPTS) {
    try { await run('osascript', ['-e', script, to, text]); return; }
    catch (err) { lastErr = err; }
  }
  throw lastErr;
}

function imessageTransport(log, splitText) {
  const owner = process.env.DISPATCH_IMESSAGE_TO;
  if (!owner) return null;
  if (process.platform !== 'darwin') {
    log('DISPATCH_IMESSAGE_TO is set, but iMessage only works on a Mac — skipping it.');
    return null;
  }

  const recentlySent = new Set();   // second guard against reading our own texts back
  const recentlySeen = [];          // a note-to-self text can arrive twice (sent + received copy)

  return {
    name: 'iMessage',
    describe: 'iMessaging ' + owner,

    async send(text) {
      for (const part of splitText(text, 3000, 4)) {
        const body = BOT_MARK + part;
        recentlySent.add(body.trim());
        setTimeout(() => recentlySent.delete(body.trim()), 10 * 60 * 1000);
        await sendIMessage(owner, body);
      }
    },

    start(onMessage) {
      let last = null;

      const tick = async () => {
        try {
          if (last === null) {
            // Start from now: old messages are history, not orders.
            const out = await run('sqlite3', ['-readonly', DB, 'SELECT COALESCE(MAX(ROWID), 0) FROM message;']);
            last = Number(out.trim()) || 0;
            log('iMessage watching for texts from ' + owner);
          } else {
            for (const m of await query(last)) {
              last = Math.max(last, m.rowid);
              if (!m.text) continue;
              if (!sameHandle(m.handle, owner) && !sameHandle(m.chat, owner)) continue;
              if (m.text.startsWith(BOT_MARK.trim()) || recentlySent.has(m.text)) continue;
              // In a separate-Apple-ID setup, is_from_me means the bot sent it.
              // In a note-to-self setup your own texts are "from me" too, so only
              // the mark above can tell them apart — and both copies must be deduped.
              const now = Date.now();
              while (recentlySeen.length && now - recentlySeen[0].at > 15000) recentlySeen.shift();
              if (recentlySeen.some(s => s.text === m.text)) continue;
              recentlySeen.push({ text: m.text, at: now });
              onMessage(m.text);
            }
          }
        } catch (err) {
          const msg = err.message || String(err);
          if (/authoriz|not permitted|unable to open/i.test(msg)) {
            log('Can\'t read Messages. Give your terminal app Full Disk Access: System Settings → Privacy & Security → Full Disk Access, then restart it.');
          } else {
            log('iMessage read failed: ' + msg);
          }
          await new Promise(r => setTimeout(r, 10000));
        }
        setTimeout(tick, POLL_MS);
      };
      tick();
    }
  };
}

module.exports = { imessageTransport, textFromAttributedBody, sameHandle, BOT_MARK };
