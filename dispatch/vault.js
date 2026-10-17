/* ============================================================
   DISPATCH — the card vault, kept on this Mac

   A list of cards Dispatch can add to, sell from and add up when
   you text it. It lives in one folder (default ~/Documents/Card Vault):

     vault.json   the cards — Dispatch reads and writes this
     vault.csv    the same list, rewritten after every change,
                  so you can open it in Numbers or Excel

   Fields match the @jaymoney_cards Vault page's, so a list could
   be moved between the two later. This is a separate list from
   that page: changes here don't show up there, or the other way.
   ============================================================ */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const DIR = path.resolve((process.env.DISPATCH_VAULT_DIR || path.join(os.homedir(), 'Documents', 'Card Vault'))
  .replace(/^~(?=$|\/)/, os.homedir()));
const FILE = path.join(DIR, 'vault.json');
const CSV = path.join(DIR, 'vault.csv');

const GRADES = ['Raw', 'Raw (cased)', 'PSA 10 Gem Mint', 'PSA 9 Mint', 'PSA 8', 'BGS 9.5', 'BGS 9',
  'SGC 10', 'SGC 9.5', 'CGC 10', 'Pending grade'];

const money = (n) => (n < 0 ? '-' : '') + '$' + Math.abs(Number(n) || 0).toFixed(2);
const num = (v) => Math.max(0, Math.round((Number(v) || 0) * 100) / 100);
const today = () => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};
const net = (c) => num(c.salePrice) - num(c.fees);
const profit = (c) => Math.round((net(c) - num(c.cost)) * 100) / 100;

function load() {
  try {
    const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return Array.isArray(data.cards) ? data.cards : [];
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw new Error('vault.json could not be read (' + e.message + '). Fix or move it before changing the vault.');
  }
}

function csvCell(v) {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function save(cards) {
  fs.mkdirSync(DIR, { recursive: true });
  // Write to a temp file and rename, so a crash mid-write can't leave half a vault.
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify({ cards }, null, 2));
  fs.renameSync(tmp, FILE);

  const head = ['ID', 'Card', 'Year / Set', 'Grade', 'Cert #', 'Paid', 'Status', 'Sold For', 'Fees', 'Net', 'P/L',
    'Date In', 'Date Sold', 'Bought From', 'Sold On', 'Notes'];
  const rows = cards.slice().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)).map((c) => {
    const sold = c.status === 'sold';
    return [c.id, c.name, c.setYear, c.grade, c.cert, num(c.cost).toFixed(2), sold ? 'Sold' : 'In vault',
      sold ? num(c.salePrice).toFixed(2) : '', sold ? num(c.fees).toFixed(2) : '', sold ? net(c).toFixed(2) : '',
      sold ? profit(c).toFixed(2) : '', c.acquired, c.soldDate, c.source, c.soldWhere, c.notes];
  });
  fs.writeFileSync(CSV, '﻿' + [head].concat(rows).map(r => r.map(csvCell).join(',')).join('\r\n'));
}

function line(c) {
  const bits = [c.id + ': ' + c.name];
  if (c.setYear) bits.push(c.setYear);
  if (c.grade) bits.push(c.grade);
  if (c.cert) bits.push('cert ' + c.cert);
  bits.push('paid ' + money(c.cost));
  if (c.status === 'sold') bits.push('SOLD ' + money(c.salePrice) + (num(c.fees) ? ' (fees ' + money(c.fees) + ')' : '') +
    ' on ' + (c.soldDate || '?') + ', P/L ' + money(profit(c)));
  if (c.notes) bits.push('notes: ' + c.notes);
  return bits.join(' | ');
}

function totals(cards) {
  const held = cards.filter(c => c.status !== 'sold');
  const sold = cards.filter(c => c.status === 'sold');
  return 'Totals: ' + held.length + ' in vault (' + money(held.reduce((a, c) => a + num(c.cost), 0)) + ' in), ' +
    sold.length + ' sold, realized P/L ' + money(sold.reduce((a, c) => a + profit(c), 0)) + '.';
}

function pickFields(input) {
  const out = {};
  for (const k of ['name', 'setYear', 'grade', 'cert', 'acquired', 'source', 'notes', 'soldDate', 'soldWhere']) {
    if (input[k] != null) out[k] = String(input[k]).trim();
  }
  for (const k of ['cost', 'salePrice', 'fees']) if (input[k] != null) out[k] = num(input[k]);
  if (input.status === 'held' || input.status === 'sold') out.status = input.status;
  return out;
}

/* One entry point for the tool. Returns text for Claude to read. */
async function vaultTool(input, ctx) {
  const action = String(input.action || '');
  const cards = load();
  const find = (id) => cards.find(c => c.id === String(id || '').trim());

  switch (action) {
    case 'list': {
      const status = input.status || 'all';
      const q = String(input.search || '').toLowerCase().trim();
      let list = cards.filter(c => status === 'all' || (status === 'sold' ? c.status === 'sold' : c.status !== 'sold'));
      if (q) list = list.filter(c => [c.name, c.setYear, c.grade, c.cert, c.source, c.notes, c.soldWhere]
        .join(' ').toLowerCase().includes(q));
      const shown = list.slice(0, 150).map(line).join('\n');
      return (shown || 'No cards match.') + (list.length > 150 ? '\n…and ' + (list.length - 150) + ' more.' : '') +
        '\n\n' + totals(cards);
    }

    case 'add': {
      const f = pickFields(input);
      if (!f.name) return 'Not added: the card needs a name.';
      if (input.cost == null) return 'Not added: ask the user what they paid for it (all-in).';
      const card = Object.assign({
        id: crypto.randomBytes(6).toString('hex'), name: '', setYear: '', grade: 'Raw', cost: 0, cert: '',
        acquired: today(), source: '', notes: '', status: 'held', salePrice: 0, fees: 0, soldDate: '', soldWhere: '',
        photoId: null, createdAt: Date.now()
      }, f, { status: 'held' });
      cards.push(card);
      save(cards);
      return 'Added. ' + line(card) + '\n' + totals(cards);
    }

    case 'sell': {
      const c = find(input.id);
      if (!c) return 'No card with id ' + input.id + '. List the vault to find the right id.';
      if (input.salePrice == null) return 'Not sold: ask the user what it sold for.';
      Object.assign(c, {
        status: 'sold', salePrice: num(input.salePrice), fees: num(input.fees),
        soldDate: input.soldDate ? String(input.soldDate) : today(), soldWhere: String(input.soldWhere || '').trim()
      });
      save(cards);
      return 'Marked sold. ' + line(c) + '\n' + totals(cards);
    }

    case 'update': {
      const c = find(input.id);
      if (!c) return 'No card with id ' + input.id + '. List the vault to find the right id.';
      const f = pickFields(input);
      if (f.status === 'held') Object.assign(f, { salePrice: 0, fees: 0, soldDate: '', soldWhere: '' });
      Object.assign(c, f);
      save(cards);
      return 'Updated. ' + line(c);
    }

    case 'delete': {
      const c = find(input.id);
      if (!c) return 'No card with id ' + input.id + '. List the vault to find the right id.';
      const ok = await ctx.ask('Delete this card from your vault?\n\n' + c.name + (c.grade ? ', ' + c.grade : '') + ', paid ' + money(c.cost));
      if (!ok) return 'The user said no. Nothing was deleted.';
      cards.splice(cards.indexOf(c), 1);
      save(cards);
      return 'Deleted ' + c.name + '.\n' + totals(cards);
    }

    default:
      return 'Unknown vault action: ' + action;
  }
}

const VAULT_TOOL = {
  name: 'card_vault',
  description:
    'The user\'s trading card vault, kept on this Mac in ' + DIR + '. ' +
    'Use this for anything about their cards: what they have, what they paid, sales and profit. ' +
    'Actions: "list" (optional status held|sold|all and search text; also returns totals), ' +
    '"add" (a new card: name like "Player — card/insert", setYear like "2025 Panini Prizm #278", grade, cost = all-in paid, ' +
    'cert, acquired YYYY-MM-DD, source = where bought, notes), "sell" (id, salePrice, fees, soldDate, soldWhere; ' +
    '"eBay fees" means 13% of the sale price), "update" (id plus only the fields to change; status "held" un-sells it), ' +
    '"delete" (id; the user is asked to confirm). To sell, update or delete, "list" first to get the card\'s id; ' +
    'if more than one card could match, ask the user which. Grades: ' + GRADES.join(', ') + '. ' +
    'This is separate from the vault web page; changes here do not appear there.',
  input_schema: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['list', 'add', 'sell', 'update', 'delete'] },
      id: { type: 'string' },
      status: { type: 'string', enum: ['held', 'sold', 'all'] },
      search: { type: 'string' },
      name: { type: 'string' },
      setYear: { type: 'string' },
      grade: { type: 'string' },
      cost: { type: 'number' },
      cert: { type: 'string' },
      acquired: { type: 'string' },
      source: { type: 'string' },
      notes: { type: 'string' },
      salePrice: { type: 'number' },
      fees: { type: 'number' },
      soldDate: { type: 'string' },
      soldWhere: { type: 'string' }
    },
    required: ['action'],
    additionalProperties: false
  }
};

module.exports = { vaultTool, VAULT_TOOL, DIR };
