/* ============================================================
   TCSC — Twin City to Sin City Cards — order notifications (email + SMS)

   Email: any SMTP provider via nodemailer (Gmail app password,
          Resend, SendGrid, Mailgun SMTP, etc.)
   SMS:   Twilio

   Both are optional — when credentials are missing the message
   is logged to the console instead, so the store keeps working
   while you set things up.
   ============================================================ */
'use strict';

function money(n) {
  return '$' + Number(n).toFixed(2);
}

function orderLinesText(order) {
  return order.items
    .map(function (it) { return '  • ' + it.name + ' × ' + it.qty + ' — ' + money(it.line); })
    .join('\n');
}

function buildEmailHTML(order) {
  var rows = order.items.map(function (it) {
    return '<tr>' +
      '<td style="padding:10px 0;border-bottom:1px solid #26262c;color:#f4f1ec">' + it.name +
      ' <span style="color:#b9b4ab">× ' + it.qty + '</span></td>' +
      '<td style="padding:10px 0;border-bottom:1px solid #26262c;color:#f4f1ec;text-align:right">' + money(it.line) + '</td>' +
      '</tr>';
  }).join('');

  return '<!doctype html><html><body style="margin:0;background:#0b0b0d;font-family:Helvetica,Arial,sans-serif">' +
    '<div style="max-width:560px;margin:0 auto;padding:32px 20px">' +
    '<div style="text-align:center;padding-bottom:24px">' +
    '<div style="font-size:38px;font-weight:900;letter-spacing:3px;color:#eceaf1">TCSC</div>' +
    '<div style="font-size:12px;font-weight:800;letter-spacing:2px"><span style="color:#a86bff">TWIN CITY</span><span style="color:#a9a6b4"> TO </span><span style="color:#ff4a52">SIN CITY</span><span style="color:#a9a6b4"> CARDS</span></div>' +
    '</div>' +
    '<div style="background:#121216;border:1px solid #26262c;padding:28px 24px">' +
    '<div style="font-size:22px;font-weight:900;color:#f4f1ec">You’re in — order confirmed ✅</div>' +
    '<div style="margin-top:6px;color:#d9a441;font-size:13px;font-weight:700;letter-spacing:1px">ORDER ' + order.id + '</div>' +
    '<table style="width:100%;border-collapse:collapse;margin-top:20px">' + rows +
    '<tr><td style="padding:10px 0;color:#b9b4ab">Subtotal</td><td style="padding:10px 0;color:#f4f1ec;text-align:right">' + money(order.subtotal) + '</td></tr>' +
    '<tr><td style="padding:4px 0;color:#b9b4ab">Shipping</td><td style="padding:4px 0;color:#f4f1ec;text-align:right">' + (order.shipping === 0 ? 'FREE' : money(order.shipping)) + '</td></tr>' +
    '<tr><td style="padding:14px 0;color:#f4f1ec;font-weight:900;font-size:17px">Total</td><td style="padding:14px 0;color:#f4f1ec;font-weight:900;font-size:17px;text-align:right">' + money(order.total) + '</td></tr>' +
    '</table>' +
    '<div style="margin-top:18px;padding:14px;border:1px solid #26262c;color:#b9b4ab;font-size:13px;line-height:1.6">' +
    'Shipping to: <span style="color:#f4f1ec">' + order.customer.name + ', ' + order.customer.address + ', ' +
    order.customer.city + ', ' + order.customer.state + ' ' + order.customer.zip + '</span><br>' +
    'Your order ships within 2 business days — slabs verified and padded, singles sleeved and top-loaded.' +
    '</div>' +
    '</div>' +
    '<div style="text-align:center;padding-top:22px;color:#6d6a64;font-size:12px">Twin City to Sin City Cards • Twin Cities ➤ Las Vegas ♦ Ship it graded.</div>' +
    '</div></body></html>';
}

/* ---------------- email ---------------- */
async function sendEmail(opts) {
  var host = process.env.SMTP_HOST;
  var user = process.env.SMTP_USER;
  var pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.log('[notify] EMAIL (not configured — logged only) →', opts.to, '|', opts.subject);
    console.log(opts.text);
    return { sent: false, reason: 'smtp_not_configured' };
  }

  var nodemailer = require('nodemailer');
  var transporter = nodemailer.createTransport({
    host: host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT || 587) === 465,
    auth: { user: user, pass: pass }
  });

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || ('Twin City to Sin City Cards <' + user + '>'),
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html
  });
  console.log('[notify] EMAIL sent →', opts.to, '|', opts.subject);
  return { sent: true };
}

/* ---------------- sms ---------------- */
async function sendSMS(to, body) {
  var sid = process.env.TWILIO_ACCOUNT_SID;
  var token = process.env.TWILIO_AUTH_TOKEN;
  var from = process.env.TWILIO_FROM;

  if (!to) return { sent: false, reason: 'no_phone' };
  if (!sid || !token || !from) {
    console.log('[notify] SMS (not configured — logged only) →', to, '|', body);
    return { sent: false, reason: 'twilio_not_configured' };
  }

  var twilio = require('twilio')(sid, token);
  await twilio.messages.create({ from: from, to: to, body: body });
  console.log('[notify] SMS sent →', to);
  return { sent: true };
}

/* ---------------- order confirmation fan-out ---------------- */
async function notifyOrder(order) {
  var results = { email: null, sms: null, shopEmail: null };
  var summary = orderLinesText(order);

  // customer email
  try {
    results.email = await sendEmail({
      to: order.customer.email,
      subject: 'Order confirmed — ' + order.id + ' | Twin City to Sin City Cards',
      text:
        'You’re in — your Twin City to Sin City Cards order is confirmed!\n\n' +
        'Order ' + order.id + '\n\n' + summary + '\n\n' +
        'Subtotal: ' + money(order.subtotal) + '\n' +
        'Shipping: ' + (order.shipping === 0 ? 'FREE' : money(order.shipping)) + '\n' +
        'Total: ' + money(order.total) + '\n\n' +
        'Shipping to: ' + order.customer.name + ', ' + order.customer.address + ', ' +
        order.customer.city + ', ' + order.customer.state + ' ' + order.customer.zip + '\n\n' +
        'Your order ships within 2 business days — slabs verified and padded, singles sleeved and top-loaded.\n\n' +
        '— Twin City to Sin City Cards (TCSC)',
      html: buildEmailHTML(order)
    });
  } catch (e) {
    console.error('[notify] customer email failed:', e.message);
    results.email = { sent: false, reason: e.message };
  }

  // customer SMS
  try {
    results.sms = await sendSMS(
      order.customer.phone,
      'TCSC: Order ' + order.id + ' confirmed — ' + money(order.total) +
      ' (' + order.items.reduce(function (n, it) { return n + it.qty; }, 0) + ' items). ' +
      'Confirmation email sent to ' + order.customer.email + '. Thanks for shopping Twin City to Sin City Cards! ♦'
    );
  } catch (e) {
    console.error('[notify] customer SMS failed:', e.message);
    results.sms = { sent: false, reason: e.message };
  }

  // heads-up to the shop
  var shopTo = process.env.SHOP_NOTIFY_EMAIL;
  if (shopTo) {
    try {
      results.shopEmail = await sendEmail({
        to: shopTo,
        subject: '💰 New order ' + order.id + ' — ' + money(order.total),
        text:
          'New order on the store!\n\n' +
          'Order ' + order.id + ' — ' + money(order.total) + '\n\n' + summary + '\n\n' +
          'Customer: ' + order.customer.name + '\n' +
          'Email: ' + order.customer.email + '\n' +
          'Phone: ' + (order.customer.phone || '—') + '\n' +
          'Ship to: ' + order.customer.address + ', ' + order.customer.city + ', ' +
          order.customer.state + ' ' + order.customer.zip + '\n' +
          (order.customer.notes ? 'Notes: ' + order.customer.notes + '\n' : '')
      });
    } catch (e) {
      console.error('[notify] shop email failed:', e.message);
      results.shopEmail = { sent: false, reason: e.message };
    }
  }

  return results;
}

/* ---------------- contact form ---------------- */
async function notifyContact(msg) {
  var to = process.env.SHOP_NOTIFY_EMAIL || process.env.SMTP_USER;
  return sendEmail({
    to: to || 'console',
    subject: '[Site Contact] ' + msg.subject + ' — from ' + msg.name,
    text:
      'New message from the website contact form:\n\n' +
      'From: ' + msg.name + ' <' + msg.email + '>\n' +
      'Subject: ' + msg.subject + '\n\n' +
      msg.message + '\n\n' +
      '(Reply directly to ' + msg.email + ')'
  });
}

module.exports = { notifyOrder: notifyOrder, notifyContact: notifyContact };
