/* ============================================================
   DISPATCH — text your laptop, it does the work

   Run on the laptop:   npm run dispatch
   Then text it from your phone. Commands you can text any time:

     stop     cancel whatever it is doing
     new      forget the conversation and start fresh
     status   is it busy, and on what
     help     this list

   While it is waiting on you to approve something, reply
   y / yes / ok to allow it, anything else to refuse.
   ============================================================ */
'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { Agent, MODEL, WORKDIR, CONFIRM } = require('./agent');
const { loadTransports } = require('./transports');

const APPROVAL_TIMEOUT_MS = 30 * 60 * 1000;

function log(msg) {
  console.log('[dispatch ' + new Date().toLocaleTimeString() + '] ' + msg);
}

function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is not set. Add it to .env — get a key at https://console.anthropic.com/settings/keys');
    process.exit(1);
  }

  const transports = loadTransports(log);
  if (!transports.length) {
    console.error([
      'No way to reach your phone is configured. Set up at least one in .env:',
      '  SMS:      TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM, DISPATCH_OWNER_PHONE (+ DISPATCH_PUBLIC_URL)',
      '  Telegram: DISPATCH_TELEGRAM_TOKEN (+ DISPATCH_TELEGRAM_CHAT_ID)',
      'See dispatch/README.md.'
    ].join('\n'));
    process.exit(1);
  }

  const Anthropic = require('@anthropic-ai/sdk');
  const agent = new Agent(new Anthropic());

  let job = null;          // { text, started, controller }
  let pending = null;      // { resolve, timer } — waiting on a yes/no from you

  // Replies go back the way the message came in; texts the agent starts go to every channel.
  const sendAll = (text) => Promise.all(transports.map(t => t.send(text).catch(err => log(t.name + ' send failed: ' + err.message))));

  function ask(question, reply) {
    return new Promise((resolve) => {
      const timer = setTimeout(() => { pending = null; resolve(false); }, APPROVAL_TIMEOUT_MS);
      pending = { resolve: (v) => { clearTimeout(timer); pending = null; resolve(v); } };
      reply(question + '\n\nReply Y to allow, N to refuse.');
    });
  }

  function onMessage(transport, raw) {
    const text = raw.trim();
    const cmd = text.toLowerCase().replace(/[.!?]+$/, '');
    const reply = (t) => transport.send(t).catch(err => log(transport.name + ' send failed: ' + err.message));
    log('← ' + text.slice(0, 200));

    if (cmd === 'stop' || cmd === 'cancel') {
      if (!job) return reply('Nothing is running.');
      job.controller.abort();
      if (pending) pending.resolve(false);
      return reply('Stopping.');
    }

    if (pending && cmd !== 'status') {
      const yes = /^(y|yes|yep|yeah|ok|okay|sure|do it|go|go ahead|approve|allow)$/.test(cmd);
      log(yes ? 'approved' : 'refused');
      pending.resolve(yes);
      return;
    }
    if (cmd === 'help' || cmd === '?') {
      return reply('Text me anything to do on the laptop.\n- stop: cancel the current job\n- new: start a fresh conversation\n- status: what I\'m doing');
    }
    if (cmd === 'status') {
      if (!job) return reply('Idle. Model ' + MODEL + ', working in ' + WORKDIR + '.');
      return reply('Working for ' + Math.round((Date.now() - job.started) / 60000) + ' min on: ' + job.text.slice(0, 200));
    }
    if (cmd === 'new' || cmd === 'reset') {
      if (job) return reply('Still working — text stop first.');
      agent.reset();
      return reply('Fresh start. What do you need?');
    }
    if (job) {
      return reply('Still on the last one (' + job.text.slice(0, 80) + '). Text stop to cancel it, or wait.');
    }

    const controller = new AbortController();
    job = { text, started: Date.now(), controller };
    const ctx = {
      signal: controller.signal,
      say: reply,
      ask: (q) => ask(q, reply),
      log: (m) => log('  ↳ ' + m)
    };

    agent.handle(text, ctx)
      .then((answer) => { log('→ ' + answer.slice(0, 200)); return reply(answer); })
      .catch((err) => {
        if (controller.signal.aborted) return reply('Stopped.');
        log('error: ' + (err && err.stack || err));
        const status = err && err.status;
        if (status === 401) return reply('My Anthropic API key was rejected — check .env on the laptop.');
        if (status === 429 || status === 529) return reply('Claude is busy or rate-limited right now. Try again in a minute.');
        return reply('Something broke: ' + (err && err.message ? err.message : err));
      })
      .finally(() => { job = null; if (pending) pending.resolve(false); });
  }

  for (const t of transports) t.start((text) => onMessage(t, text));

  log('Dispatch is up — model ' + MODEL + ', work dir ' + WORKDIR + ', approvals: ' + CONFIRM);
  for (const t of transports) log('  ' + t.name + ': ' + t.describe);

  if (process.env.DISPATCH_ANNOUNCE !== 'false') {
    sendAll('Dispatch is online on ' + require('os').hostname() + '. Text me what you need.');
  }
}

if (require.main === module) main();
