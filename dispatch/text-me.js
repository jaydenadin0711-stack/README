/* ============================================================
   DISPATCH — text yourself from any script

     npm run text-me -- "The render finished"
     long-build && npm run text-me -- "build done" || npm run text-me -- "build FAILED"

   Uses the same SMS / Telegram setup as Dispatch itself.
   ============================================================ */
'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { loadTransports } = require('./transports');

const text = process.argv.slice(2).join(' ').trim();
if (!text) {
  console.error('Usage: npm run text-me -- "your message"');
  process.exit(1);
}

const transports = loadTransports(() => {});
if (!transports.length) {
  console.error('No SMS or Telegram setup found in .env — see dispatch/README.md.');
  process.exit(1);
}

Promise.all(transports.map(t => t.send(text).then(() => console.log('Sent via ' + t.name))))
  .catch((err) => { console.error('Send failed: ' + err.message); process.exit(1); });
