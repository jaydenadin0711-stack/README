# Rips Society — Store & Website

Multi-page e-commerce website for **Rips Society**, a Las Vegas based sports card breaking company. Home, Catalog, Live Breaks, Contact, Cart — plus a real checkout that takes card payments through Stripe and sends order confirmations by **email and text message**.

## The pages

| Page | What it does |
|---|---|
| `index.html` | Home — hero, featured products, shop-by-category, how it works, live channel links |
| `catalog.html` | Full catalog with category filters, search, sorting, and pagination |
| `product.html?id=…` | Product detail page with quantity picker and related products |
| `cart.html` | Cart + checkout form (name, email, phone, shipping address) |
| `success.html` | Order confirmation / receipt page |
| `contact.html` | Contact page with a working message form |
| `breaks.html` | The original one-page live-breaks site, kept as the "Live Breaks" page |

Products live in **`data/products.json`** — edit that one file to add/remove products, change prices, or mark items as `"featured": true` for the home page. No code changes needed.

## How payments work (important)

The site **never collects or stores card numbers itself** — doing that without PCI-DSS certification is illegal and would get the store shut down by any payment processor. Instead:

1. Customer fills in name / email / phone / address on `cart.html`
2. The server prices the cart from `data/products.json` (client prices are never trusted) and creates a **Stripe Checkout** session
3. Customer enters their card on **Stripe's secure hosted page** (same system Shopify stores use)
4. Stripe confirms payment → the server marks the order paid and sends:
   - 📧 a styled **confirmation email** to the customer
   - 📱 a **text message** via Twilio (if they gave a phone number)
   - 💰 a "new order" email to you (`SHOP_NOTIFY_EMAIL`)

Orders are saved in `server/data/orders.json` (git-ignored).

## Running the store

```bash
npm install
cp .env.example .env    # then fill in your keys (see below)
npm start
# → http://localhost:3000
```

With a **blank `.env`** the store runs in test mode: full flow works, orders are recorded, notifications print to the console, no card is charged. Great for trying it out.

### 1. Stripe (card payments)

1. Create a free account at [stripe.com](https://stripe.com)
2. Copy your **secret key** from [dashboard.stripe.com/apikeys](https://dashboard.stripe.com/apikeys) into `STRIPE_SECRET_KEY`
   - `sk_test_…` = test mode — use card number `4242 4242 4242 4242`, any future date, any CVC
   - `sk_live_…` = real money
3. (Recommended for production) Add a webhook at [dashboard.stripe.com/webhooks](https://dashboard.stripe.com/webhooks) pointing to `https://your-site.com/api/stripe/webhook` for the `checkout.session.completed` event, and put the signing secret in `STRIPE_WEBHOOK_SECRET`

### 2. Email confirmations

Any SMTP provider works. Easiest with Gmail:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=youraddress@gmail.com
SMTP_PASS=<app password>       # create at myaccount.google.com/apppasswords
SHOP_NOTIFY_EMAIL=youraddress@gmail.com
```

### 3. Text message confirmations

1. Sign up at [twilio.com](https://www.twilio.com) (trial includes a free phone number)
2. Fill in `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_FROM` (your Twilio number, e.g. `+17025550123`)

SMS is optional — leave blank and email still sends.

### 4. Viewing orders

Set `ADMIN_TOKEN` to any long random string, then:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" https://your-site.com/api/admin/orders
```

## Hosting

The **backend** (payments + notifications) needs a Node host — [Render](https://render.com), [Railway](https://railway.app), and [Fly.io](https://fly.io) all have free/cheap tiers. Point them at this repo, set the env vars from `.env.example`, done. Set `BASE_URL` to your public URL.

**GitHub Pages** (already set up via the workflow in `.github/workflows/`) serves the static site only — everything browses fine there, but with no backend the checkout falls back to a clearly-labeled demo mode and the contact form falls back to the visitor's own mail app. Use it as a preview; put the Node server behind your real domain to sell.

## Swapping in the real logo

The logo is an SVG recreation. To use the actual logo file, add it to the repo (e.g. `assets/logo.png`) and replace the `<svg class="mark">…</svg>` blocks in the nav/footer of each page with:

```html
<img class="mark" src="assets/logo.png" alt="Rips Society">
```
