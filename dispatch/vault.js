/* ============================================================
   DISPATCH — the card vault

   The vault (@jaymoney_cards Vault) is a Claude artifact: its cards
   live on your Claude account, which this Mac can't reach. A cloud
   Claude Code chat can, so card requests are handed to one:

     claude -p "<request>" --cloud <DISPATCH_VAULT_SESSION>

   That chat has standing instructions for logging, selling and
   editing cards. The hand-off is one way — the Mac can send it a
   message but can't get its answer back — so you see the result
   on the vault page, or by opening the vault chat in the Claude app.

   Needs, once:  Claude Code installed and signed in on this Mac
                 DISPATCH_VAULT_SESSION=session_… in .env
   ============================================================ */
'use strict';

const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SESSION = (process.env.DISPATCH_VAULT_SESSION || '').trim();

function findClaude() {
  for (const p of [
    path.join(os.homedir(), '.local', 'bin', 'claude'),
    path.join(os.homedir(), '.claude', 'local', 'claude'),
    '/opt/homebrew/bin/claude',
    '/usr/local/bin/claude'
  ]) if (fs.existsSync(p)) return p;
  return 'claude';
}

/* Dispatch's API key must not reach Claude Code: with it set, Claude Code
   uses the API key instead of your Claude login, and only the login can
   reach your cloud chats. */
function claudeEnv() {
  const env = Object.assign({}, process.env);
  delete env.ANTHROPIC_API_KEY;
  delete env.ANTHROPIC_AUTH_TOKEN;
  return env;
}

function send(message) {
  return new Promise((resolve) => {
    execFile(findClaude(), ['-p', message, '--cloud', SESSION],
      { env: claudeEnv(), timeout: 90 * 1000, cwd: os.homedir() },
      (err, stdout, stderr) => {
        const out = String(stdout || '') + String(stderr || '');
        if (!err && /sent to cloud session/i.test(out)) return resolve({ ok: true });
        if (err && err.code === 'ENOENT') return resolve({ ok: false, why: 'Claude Code is not installed on this Mac' });
        const why = (out.trim() || (err && err.message) || 'no response').replace(/\s+/g, ' ').slice(0, 300);
        resolve({ ok: false, why: /log ?in|expired|auth/i.test(why) ? 'Claude Code on the Mac is signed out (' + why + ')' : why });
      });
  });
}

async function vaultTool(input, ctx) {
  const request = String(input.request || '').trim();
  if (!request) return 'No request given.';
  if (!SESSION) return 'The card vault is not set up: DISPATCH_VAULT_SESSION is missing from .env.';

  let message = request;
  if (/\b(delete|remove|erase|clear|wipe)\b/i.test(request)) {
    const ok = await ctx.ask('Change your card vault?\n\n' + request.slice(0, 400));
    if (!ok) return 'The user said no. Nothing was sent to the vault.';
    message += '\n\n(The user confirmed this by text.)';
  }

  const r = await send(message);
  return r.ok
    ? 'Sent to the vault chat. It applies the change in a few seconds; nothing comes back here, so tell the user it was ' +
      'sent and that they can check the vault page. Do not claim it is done or describe the result.'
    : 'Could not reach the vault chat: ' + r.why + '. Nothing was changed.';
}

const VAULT_TOOL = {
  name: 'card_vault',
  description:
    'The user\'s trading card vault (@jaymoney_cards Vault, the page with photos). Use it to log a new card, mark one ' +
    'sold, edit one, or delete one. Pass one plain-words request with every detail the user gave: player, card/insert, ' +
    'year and set, grade, cert number, price paid all-in, where bought, sale price, fees, sold where. A new card needs ' +
    'the price paid; ask before sending if it is missing. This only SENDS the request: no answer comes back, so it ' +
    'cannot tell you what is in the vault. For questions about the vault\'s contents, tell the user to open the vault page.',
  input_schema: {
    type: 'object',
    properties: { request: { type: 'string', description: 'The vault change, in plain words, with all details.' } },
    required: ['request'],
    additionalProperties: false
  }
};

module.exports = { vaultTool, VAULT_TOOL, SESSION };
