/* ============================================================
   TCSC — Twin City to Sin City Cards — store server

   Serves the static site and provides the store API:
     POST /api/checkout          → create order + Stripe Checkout session
     POST /api/checkout/confirm  → verify payment, send email + SMS
     POST /api/stripe/webhook    → Stripe webhook (checkout.session.completed)
     POST /api/contact           → contact form → email to the shop
     GET  /api/admin/orders      → order list (Bearer ADMIN_TOKEN)

   Card handling: customers enter card details on Stripe's hosted
   Checkout page. This server never receives, sees, or stores card
   numbers — only Stripe's payment confirmation. Do not change this
   to collect raw card data; that requires PCI-DSS compliance.

   Without STRIPE_SECRET_KEY the server runs in test mode: orders
   are recorded and notifications fire, but no card is charged.
   ============================================================ */
'use strict';

require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const notify = require('./notify');

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(__dirname, 'data');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || '';
const stripe = STRIPE_KEY ? require('stripe')(STRIPE_KEY) : null;

/* ---------------- catalog (single source of truth for prices) ---------------- */
function loadCatalog() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'products.json'), 'utf8'));
}

/* ---------------- order persistence ---------------- */
function loadOrders() {
  try { return JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8')); } catch (e) { return {}; }
}
function saveOrders(orders) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
}
function newOrderId() {
  return 'TCSC-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomBytes(2).toString('hex').toUpperCase();
}
function publicOrder(o) {
  return {
    id: o.id, demo: !!o.demo, status: o.status, created: o.created,
    items: o.items, subtotal: o.subtotal, shipping: o.shipping, total: o.total,
    customer: { name: o.customer.name, email: o.customer.email, phone: o.customer.phone }
  };
}

/* ---------------- payment confirmed → notify once ---------------- */
async function markPaidAndNotify(orderId) {
  const orders = loadOrders();
  const order = orders[orderId];
  if (!order) return null;
  if (order.status !== 'paid') {
    order.status = 'paid';
    order.paidAt = new Date().toISOString();
  }
  let notified = false;
  if (!order.notifiedAt) {
    order.notifiedAt = new Date().toISOString(); // set first so retries can't double-send
    saveOrders(orders);
    const results = await notify.notifyOrder(order);
    order.notifyResults = {
      email: results.email && results.email.sent,
      sms: results.sms && results.sms.sent
    };
    notified = true;
  }
  saveOrders(orders);
  return { order, notified };
}

/* ---------------- middleware ---------------- */
// Stripe webhook needs the raw body for signature verification — mount before json parser
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe) return res.status(400).json({ error: 'Stripe not configured' });
  let event;
  try {
    const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
    event = whSecret
      ? stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], whSecret)
      : JSON.parse(req.body.toString());
  } catch (e) {
    console.error('[webhook] signature verification failed:', e.message);
    return res.status(400).json({ error: 'Bad signature' });
  }
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const orderId = session.metadata && session.metadata.order_id;
    if (orderId && session.payment_status === 'paid') {
      try { await markPaidAndNotify(orderId); } catch (e) { console.error('[webhook] notify failed:', e.message); }
    }
  }
  res.json({ received: true });
});

app.use(express.json({ limit: '100kb' }));

/* ---------------- checkout ---------------- */
app.post('/api/checkout', async (req, res) => {
  try {
    const body = req.body || {};
    const rawItems = Array.isArray(body.items) ? body.items : [];
    const c = body.customer || {};

    const name = String(c.name || '').trim().slice(0, 120);
    const email = String(c.email || '').trim().slice(0, 200);
    const phone = String(c.phone || '').trim().slice(0, 30);
    const address = String(c.address || '').trim().slice(0, 200);
    const city = String(c.city || '').trim().slice(0, 100);
    const state = String(c.state || '').trim().slice(0, 50);
    const zip = String(c.zip || '').trim().slice(0, 20);
    const notes = String(c.notes || '').trim().slice(0, 500);

    if (!name || !email || !address || !city || !state || !zip) {
      return res.status(400).json({ error: 'Missing name, email, or shipping address.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email address.' });
    }
    if (!rawItems.length) return res.status(400).json({ error: 'Cart is empty.' });

    // price everything server-side from the catalog — client prices are never trusted
    const catalog = loadCatalog();
    const items = [];
    let subtotal = 0;
    for (const it of rawItems) {
      const p = catalog.products.find((x) => x.id === it.id);
      if (!p) return res.status(400).json({ error: 'Unknown product: ' + it.id });
      const qty = Math.max(1, Math.min(99, parseInt(it.qty, 10) || 1));
      const line = Math.round(p.price * qty * 100) / 100;
      items.push({ id: p.id, name: p.name, qty, price: p.price, line });
      subtotal += line;
    }
    subtotal = Math.round(subtotal * 100) / 100;
    const shipping = subtotal >= 100 ? 0 : 4.99;
    const total = Math.round((subtotal + shipping) * 100) / 100;

    const order = {
      id: newOrderId(),
      created: new Date().toISOString(),
      status: 'pending',
      demo: !stripe,
      items, subtotal, shipping, total,
      customer: { name, email, phone, address, city, state, zip, notes }
    };

    const orders = loadOrders();
    orders[order.id] = order;
    saveOrders(orders);

    const baseUrl = process.env.BASE_URL || (req.protocol + '://' + req.get('host'));

    if (!stripe) {
      // Test mode — no Stripe key yet. Record the order, skip charging.
      console.log('[checkout] TEST MODE order ' + order.id + ' — ' + total.toFixed(2) + ' (no card charged)');
      return res.json({ url: baseUrl + '/success.html?order=' + order.id });
    }

    const line_items = items.map((it) => ({
      quantity: it.qty,
      price_data: {
        currency: 'usd',
        unit_amount: Math.round(it.price * 100),
        product_data: { name: it.name }
      }
    }));
    if (shipping > 0) {
      line_items.push({
        quantity: 1,
        price_data: { currency: 'usd', unit_amount: Math.round(shipping * 100), product_data: { name: 'Shipping' } }
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      customer_email: email,
      metadata: { order_id: order.id },
      success_url: baseUrl + '/success.html?order=' + order.id + '&session_id={CHECKOUT_SESSION_ID}',
      cancel_url: baseUrl + '/cart.html'
    });

    order.stripeSessionId = session.id;
    orders[order.id] = order;
    saveOrders(orders);

    res.json({ url: session.url });
  } catch (e) {
    console.error('[checkout] error:', e.message);
    res.status(500).json({ error: 'Checkout failed — please try again.' });
  }
});

/* ---------------- confirm (success page) ---------------- */
app.post('/api/checkout/confirm', async (req, res) => {
  try {
    const orderId = String((req.body || {}).order || '');
    const sessionId = String((req.body || {}).session_id || '');
    const orders = loadOrders();
    const order = orders[orderId];
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    if (stripe && !order.demo) {
      if (!sessionId || sessionId !== order.stripeSessionId) {
        return res.status(400).json({ error: 'Payment session mismatch.' });
      }
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.payment_status !== 'paid') {
        return res.status(402).json({ error: 'Payment not completed.' });
      }
    }

    const result = await markPaidAndNotify(orderId);
    res.json({ order: publicOrder(result.order), notified: result.notified });
  } catch (e) {
    console.error('[confirm] error:', e.message);
    res.status(500).json({ error: 'Could not verify the order.' });
  }
});

/* ---------------- contact form ---------------- */
app.post('/api/contact', async (req, res) => {
  try {
    const b = req.body || {};
    const msg = {
      name: String(b.name || '').trim().slice(0, 120),
      email: String(b.email || '').trim().slice(0, 200),
      subject: String(b.subject || 'General').trim().slice(0, 120),
      message: String(b.message || '').trim().slice(0, 4000)
    };
    if (!msg.name || !msg.email || !msg.message) {
      return res.status(400).json({ error: 'Name, email, and message are required.' });
    }
    await notify.notifyContact(msg);
    res.json({ ok: true });
  } catch (e) {
    console.error('[contact] error:', e.message);
    res.status(500).json({ error: 'Could not send your message — try again.' });
  }
});

/* ---------------- admin: order list ---------------- */
app.get('/api/admin/orders', (req, res) => {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return res.status(403).json({ error: 'Set ADMIN_TOKEN to enable this endpoint.' });
  const auth = req.headers.authorization || '';
  if (auth !== 'Bearer ' + token) return res.status(401).json({ error: 'Unauthorized' });
  const orders = loadOrders();
  const list = Object.values(orders).sort((a, b) => (a.created < b.created ? 1 : -1));
  res.json({ count: list.length, orders: list });
});

/* ---------------- static site ---------------- */
app.use(express.static(ROOT, { extensions: ['html'] }));

app.listen(PORT, () => {
  console.log('');
  console.log('  ◆ TCSC — TWIN CITY TO SIN CITY CARDS — store server ◆');
  console.log('  → http://localhost:' + PORT);
  console.log('  Payments: ' + (stripe ? 'STRIPE (' + (STRIPE_KEY.startsWith('sk_live') ? 'LIVE' : 'test key') + ')' : 'TEST MODE — set STRIPE_SECRET_KEY to charge real cards'));
  console.log('  Email:    ' + (process.env.SMTP_HOST ? 'SMTP configured' : 'not configured — logged to console'));
  console.log('  SMS:      ' + (process.env.TWILIO_ACCOUNT_SID ? 'Twilio configured' : 'not configured — logged to console'));
  console.log('');
});
