/* ============================================================
   DISPATCH — how your phone reaches the laptop

   Three ways in. Set up any of them (see dispatch/README.md):

   iMessage      — free, Mac only. Texts go through the Messages
                   app on the laptop. See ./imessage.js.

   SMS (Twilio)  — real text messages to your phone number.
                   Needs a Twilio number and a public URL for the
                   webhook (a free Cloudflare/ngrok tunnel works).

   Telegram      — a private bot chat. Free, no tunnel, no
                   carrier registration: the laptop polls Telegram.

   Each transport gives index.js the same shape:
     start(onMessage)  — onMessage(text) for every message from YOU
     send(text)        — text you
   Messages from anyone else are dropped before they reach the agent.
   ============================================================ */
'use strict';

const express = require('express');

const SMS_PART = 1500;      // Twilio joins up to 1600 chars into one text
const SMS_MAX_PARTS = 4;

function digits(s) {
  return String(s || '').replace(/\D/g, '');
}

function splitText(text, size, maxParts) {
  text = String(text || '').trim() || '(empty)';
  const parts = [];
  while (text.length && parts.length < maxParts) {
    let cut = text.length <= size ? text.length : text.lastIndexOf('\n', size);
    if (cut < size * 0.5) cut = text.lastIndexOf(' ', size);
    if (cut < size * 0.5) cut = size;
    parts.push(text.slice(0, cut).trim());
    text = text.slice(cut).trim();
  }
  if (text.length) parts[parts.length - 1] += '\n…(cut — ask for the rest)';
  return parts;
}

/* ---------------- SMS via Twilio ---------------- */

function twilioTransport(log) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.DISPATCH_TWILIO_FROM || process.env.TWILIO_FROM;
  const owner = process.env.DISPATCH_OWNER_PHONE;
  if (!sid || !token || !from || !owner) return null;

  const twilio = require('twilio');
  const client = twilio(sid, token);
  const publicUrl = (process.env.DISPATCH_PUBLIC_URL || '').replace(/\/+$/, '');
  const port = Number(process.env.DISPATCH_PORT) || 3100;

  return {
    name: 'SMS',
    describe: 'texting ' + owner + ' from ' + from,

    async send(text) {
      for (const part of splitText(text, SMS_PART, SMS_MAX_PARTS)) {
        await client.messages.create({ from, to: owner, body: part });
      }
    },

    start(onMessage) {
      const app = express();
      app.use(express.urlencoded({ extended: false }));

      // Only Twilio can sign this request, so a stranger who finds the URL gets a 403.
      // Twilio signs the public URL it called, which is the tunnel's, not localhost.
      const verify = twilio.webhook(token, publicUrl
        ? { url: publicUrl + '/sms' }
        : { validate: false });
      if (!publicUrl) log('⚠  DISPATCH_PUBLIC_URL is not set — Twilio signatures are NOT being checked.');

      app.post('/sms', verify, (req, res) => {
        res.type('text/xml').send('<Response/>');   // reply comes later, by API, when the work is done
        const fromNum = req.body.From;
        if (digits(fromNum) !== digits(owner)) {
          log('ignored a text from ' + fromNum + ' (not the owner)');
          return;
        }
        onMessage(String(req.body.Body || ''));
      });

      app.get('/', (req, res) => res.send('Dispatch is running.'));
      app.listen(port, () => log('SMS webhook listening on http://localhost:' + port + '/sms' +
        (publicUrl ? '  (public: ' + publicUrl + '/sms)' : '')));
    }
  };
}

/* ---------------- Telegram ---------------- */

function telegramTransport(log) {
  const token = process.env.DISPATCH_TELEGRAM_TOKEN;
  const chatId = process.env.DISPATCH_TELEGRAM_CHAT_ID;
  if (!token) return null;
  const api = 'https://api.telegram.org/bot' + token + '/';

  async function call(method, body) {
    const res = await fetch(api + method, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body || {})
    });
    const json = await res.json();
    if (!json.ok) throw new Error('Telegram ' + method + ': ' + json.description);
    return json.result;
  }

  return {
    name: 'Telegram',
    describe: chatId ? 'chat ' + chatId : 'NOT LOCKED to a chat yet — message the bot to get your chat id',

    async send(text) {
      if (!chatId) return;
      for (const part of splitText(text, 4000, 4)) {
        await call('sendMessage', { chat_id: chatId, text: part });
      }
    },

    start(onMessage) {
      let offset = 0;
      const poll = async () => {
        for (;;) {
          try {
            const updates = await call('getUpdates', { offset, timeout: 50, allowed_updates: ['message'] });
            for (const u of updates) {
              offset = u.update_id + 1;
              const msg = u.message;
              if (!msg || typeof msg.text !== 'string') continue;
              const from = String(msg.chat.id);
              if (!chatId) {
                // Until you lock it to your chat, the bot acts for nobody.
                log('Telegram message from chat ' + from + '. Put DISPATCH_TELEGRAM_CHAT_ID=' + from + ' in .env and restart.');
                await call('sendMessage', { chat_id: from, text: 'Your chat id is ' + from + '. Put DISPATCH_TELEGRAM_CHAT_ID=' + from + ' in the laptop\'s .env and restart Dispatch.' });
                continue;
              }
              if (from !== String(chatId)) {
                log('ignored a Telegram message from chat ' + from + ' (not the owner)');
                continue;
              }
              onMessage(msg.text);
            }
          } catch (err) {
            log('Telegram poll failed: ' + err.message + ' — retrying in 5s');
            await new Promise(r => setTimeout(r, 5000));
          }
        }
      };
      poll();
      log('Telegram bot polling (' + this.describe + ')');
    }
  };
}

function loadTransports(log) {
  const { imessageTransport } = require('./imessage');
  return [imessageTransport(log, splitText), twilioTransport(log), telegramTransport(log)].filter(Boolean);
}

module.exports = { loadTransports, splitText };
