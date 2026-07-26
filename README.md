# TCSC — Twin City to Sin City Cards — Store Website

Multi-page e-commerce website built for **Twin City to Sin City Cards (TCSC)**. Home, Catalog, Contact, Cart — plus a real checkout that takes card payments through Stripe and sends order confirmations by **email and text message**. Branding follows the TCSC logo: black background, chrome lettering, Twin City purple + Sin City red.

## The pages

| Page | What it does |
|---|---|
| `index.html` | Home — TCSC emblem hero, featured products, shop-by-category, two-cities band, how it works |
| `catalog.html` | Full catalog with category filters, search, sorting, and pagination |
| `product.html?id=…` | Product detail page with quantity picker and related products |
| `cart.html` | Cart + checkout form (name, email, phone, shipping address) |
| `success.html` | Order confirmation / receipt page |
| `contact.html` | Contact page with a working message form |

Products live in **`data/products.json`** — edit that one file to add/remove products, change prices, or mark items `"featured": true` for the home page. No code changes needed. The current inventory (slabs, wax, Pokémon, singles, mystery boxes, supplies) is realistic sample stock — **swap in TCSC's real products before launch.**

## How payments work (important)

The site **never collects or stores card numbers itself** — doing that without PCI-DSS certification is illegal and would get the store shut down by any payment processor. Instead:

1. Customer fills in name / email / phone / address on `cart.html`
2. The server prices the cart from `data/products.json` (client prices are never trusted) and creates a **Stripe Checkout** session
3. Customer enters their card on **Stripe's secure hosted page** (the same system Shopify stores use)
4. Stripe confirms payment → the server marks the order paid and sends:
   - 📧 a styled **confirmation email** to the customer
   - 📱 a **text message** via Twilio (if they gave a phone number)
   - 💰 a "new order" email to the shop (`SHOP_NOTIFY_EMAIL`)

Orders are saved in `server/data/orders.json` (git-ignored). Order numbers look like `TCSC-XXXXXX-XXXX`.

> **Going live checklist:** connect the *business's own* Stripe account (so the money goes to them), their email/Twilio credentials, and their real product list. Get their sign-off on the branding — and swap in their actual logo file (see below).

## Running the store

```bash
npm install
cp .env.example .env    # then fill in keys (see below)
npm start
# → http://localhost:3000
```

With a **blank `.env`** the store runs in test mode: the full flow works, orders are recorded, notifications print to the console, no card is charged.

### 1. Stripe (card payments)

1. Create an account at [stripe.com](https://stripe.com)
2. Copy the **secret key** from [dashboard.stripe.com/apikeys](https://dashboard.stripe.com/apikeys) into `STRIPE_SECRET_KEY`
   - `sk_test_…` = test mode — use card `4242 4242 4242 4242`, any future date, any CVC
   - `sk_live_…` = real money
3. (Recommended for production) Add a webhook at [dashboard.stripe.com/webhooks](https://dashboard.stripe.com/webhooks) → `https://your-site.com/api/stripe/webhook` for `checkout.session.completed`, and put the signing secret in `STRIPE_WEBHOOK_SECRET`

### 2. Email confirmations

Any SMTP provider. Easiest with Gmail:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=address@gmail.com
SMTP_PASS=<app password>       # create at myaccount.google.com/apppasswords
SHOP_NOTIFY_EMAIL=address@gmail.com
```

### 3. Text message confirmations

Sign up at [twilio.com](https://www.twilio.com) (trial includes a free number), then fill in `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_FROM`. SMS is optional — leave blank and email still sends.

### 4. Viewing orders

Set `ADMIN_TOKEN` to a long random string, then:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" https://your-site.com/api/admin/orders
```

## Hosting

The **backend** (payments + notifications) needs a Node host — [Render](https://render.com), [Railway](https://railway.app), or [Fly.io](https://fly.io). Point it at this repo, set the env vars from `.env.example`, and set `BASE_URL` to the public URL.

**GitHub Pages** (workflow in `.github/workflows/`) serves the static site only — everything browses fine as a preview, but with no backend the checkout falls back to a clearly-labeled demo mode and the contact form opens the visitor's own mail app. Use Pages to show the client; put the Node server behind the real domain to sell.

## Swapping in the real logo

The TCSC logo on the site is an original SVG recreation (two graded slabs + chrome wordmark). To use the actual logo file, add it to the repo (e.g. `assets/logo.png`) and replace the `<svg class="mark">…</svg>` blocks in the nav/footer of each page — and the big `<svg class="hero-logo-badge">…</svg>` on `index.html` — with:

```html
<img class="mark" src="assets/logo.png" alt="Twin City to Sin City Cards">
```
