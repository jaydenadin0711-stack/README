/* ============================================================
   DISPATCH — the card vault

   The vault is a Claude artifact: its cards live on your Claude
   account, not on this Mac, so an API key can't reach them. This
   hands the request to Claude Code on this Mac (signed in to the
   same Claude account), which can read and write the vault, and
   returns what it says.

   Needs, once:  Claude Code installed and logged in  (`claude`)
                 DISPATCH_VAULT_URL=<the vault's claude.ai link> in .env
   ============================================================ */
'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const VAULT_URL = (process.env.DISPATCH_VAULT_URL || '').trim();
const TIMEOUT_MS = 5 * 60 * 1000;

// The vault page reads these fields; anything else it ignores.
const SCHEMA = [
  'Each card is one document in the "cards" collection; its doc_id equals its "id" field.',
  'Fields: id (string), name ("Player — card/insert"), setYear ("2025 Panini Prizm #278"),',
  'grade (one of: Raw, Raw (cased), PSA 10 Gem Mint, PSA 9 Mint, PSA 8, BGS 9.5, BGS 9, SGC 10, SGC 9.5, CGC 10, Pending grade),',
  'cost (number, all-in paid), cert (string), acquired ("YYYY-MM-DD"), source (where bought), notes,',
  'status ("held" or "sold"), salePrice (number), fees (number), soldDate ("YYYY-MM-DD"), soldWhere,',
  'createdAt (milliseconds since 1970), photoId (leave null for new cards).'
].join('\n');

function findClaude() {
  const candidates = [
    path.join(os.homedir(), '.local', 'bin', 'claude'),
    path.join(os.homedir(), '.claude', 'local', 'claude'),
    '/opt/homebrew/bin/claude',
    '/usr/local/bin/claude'
  ];
  for (const p of candidates) if (fs.existsSync(p)) return p;
  return 'claude';   // fall back to PATH
}

/* Dispatch's own API key must not reach Claude Code: with it set, Claude Code
   bills the API instead of using your Claude login, and the login is what
   can open the vault. */
function claudeEnv() {
  const env = Object.assign({}, process.env);
  delete env.ANTHROPIC_API_KEY;
  delete env.ANTHROPIC_AUTH_TOKEN;
  return env;
}

function prompt(request) {
  const today = new Date();
  const ymd = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
  return [
    'You manage the user\'s trading card vault, a Claude artifact at ' + VAULT_URL + '.',
    'Use the ArtifactData tool on that url (load it with ToolSearch first if it is deferred). Do not republish or change the page itself.',
    '',
    SCHEMA,
    '',
    'Rules:',
    '- New card: "set" a new document with a fresh random id (12 lowercase letters/digits), status "held",',
    '  salePrice 0, fees 0, soldDate "", soldWhere "", photoId null, createdAt ' + Date.now() + ', acquired "' + ymd + '" unless given.',
    '- Changing a card (sold, edit, delete): find it first (list/query), then write with if_version from what you read.',
    '  Selling: status "sold", salePrice, fees (0 unless given; "eBay fees" means 13% of the price), soldDate today unless given.',
    '- If the request matches more than one card, or is missing the price paid for a new card, change nothing and ask.',
    '- Today is ' + ymd + '.',
    '',
    'Your reply is texted to the user: one or two short plain-text lines, no markdown. Say exactly what changed, e.g.',
    '"Logged: Cam Ward Rookie Dynamics PSA 9, paid $65." For questions about the vault, answer with the numbers.',
    '',
    'The request:',
    request
  ].join('\n');
}

function runVault(request, signal) {
  if (!VAULT_URL) {
    return Promise.resolve('The card vault is not set up: DISPATCH_VAULT_URL is missing from .env. Tell the user to re-run the Mac setup command.');
  }
  return new Promise((resolve) => {
    // A neutral working folder, so no project's CLAUDE.md steers it.
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'dispatch-vault-'));
    const child = spawn(findClaude(), [
      '-p', prompt(request),
      '--output-format', 'text',
      '--allowedTools', 'ArtifactData', 'Artifact', 'ToolSearch'
    ], { cwd, env: claudeEnv() });

    let out = '';
    let err = '';
    let killedFor = null;
    child.stdout.on('data', d => { out += d; });
    child.stderr.on('data', d => { err += d; });
    const kill = (why) => { killedFor = why; child.kill('SIGKILL'); };
    const timer = setTimeout(() => kill('took over 5 minutes'), TIMEOUT_MS);
    const onAbort = () => kill('cancelled');
    if (signal) signal.addEventListener('abort', onAbort, { once: true });

    const done = (text) => {
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', onAbort);
      fs.rm(cwd, { recursive: true, force: true }, () => {});
      resolve(text);
    };

    child.on('error', (e) => done(e.code === 'ENOENT'
      ? 'Claude Code is not installed on this Mac, so the vault cannot be reached. Tell the user to re-run the Mac setup command.'
      : 'Could not start Claude Code: ' + e.message));
    child.on('close', (code) => {
      if (killedFor) return done('The vault request ' + killedFor + '.');
      const text = out.trim();
      if (code !== 0 || !text) {
        const why = (err.trim() || text || 'no output').slice(-600);
        const hint = /log ?in|auth|credential|401/i.test(why) ? ' (Claude Code is not logged in — run `claude` on the Mac and sign in.)' : '';
        return done('The vault request failed' + hint + ': ' + why);
      }
      done(text.slice(-2000));
    });
  });
}

const VAULT_TOOL = {
  name: 'card_vault',
  description:
    'The user\'s trading card vault (@jaymoney_cards Vault): log a new card, mark one sold, edit or delete one, or ' +
    'answer questions about it (what is in it, money in, profit). Pass the request in plain words with every detail ' +
    'the user gave (player, card/insert, year and set, grade, cert number, price paid, where bought, sale price, fees). ' +
    'Returns what was done. This is the only way to reach the vault — it is not a file on this Mac.',
  input_schema: {
    type: 'object',
    properties: { request: { type: 'string', description: 'The vault request, with all details.' } },
    required: ['request'],
    additionalProperties: false
  }
};

module.exports = { runVault, VAULT_TOOL, VAULT_URL };
