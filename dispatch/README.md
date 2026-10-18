# Dispatch

Text your laptop from your phone and it does the work: runs commands, edits files,
opens things, searches the web, then texts you back. While a job runs it can text
you progress updates, and it **asks before doing anything destructive**.

```
You (phone):   pull the latest on my README repo and run the tests
Dispatch:      Run this on your laptop?  git pull … Reply Y to allow
You:           y
Dispatch:      Done. Pulled 4 commits; all 23 tests pass.
```

It runs **on your laptop** (Windows, macOS or Linux). The laptop has to be on, awake
and running `npm run dispatch` for it to answer.

---

## Fastest: Mac + iPhone, one command

On the Mac, open **Terminal** and paste:

```bash
curl -fsSL https://raw.githubusercontent.com/jaydenadin0711-stack/README/claude/peaceful-knuth-ihlw4k/dispatch/setup-mac.sh | bash
```

It installs everything into `~/Dispatch`, asks for your API key and iPhone number, walks
you through the one permission it needs, and starts. Run it again later to update.
The rest of this page is the manual version.

## 1. Basics (5 minutes)

```bash
npm install
cp .env.example .env        # skip if you already have a .env
```

In `.env` set:

```
ANTHROPIC_API_KEY=sk-ant-...        # https://console.anthropic.com/settings/keys
DISPATCH_WORKDIR=~/projects         # where it starts out; it can still go elsewhere
```

Then pick how your phone talks to it:

- **iMessage**: free. Needs a Mac laptop and an iPhone.
- **Telegram**: free, and works on any laptop.
- **Real SMS (Twilio)**: costs a little per text.

You can set up more than one.

## 2a. iMessage (Mac + iPhone): free

Dispatch sends texts through the Messages app on your Mac and reads your replies
from it. No Twilio, no fees. Its messages start with 🤖 so you can tell them apart.

**Pick whose Apple ID the bot uses:**

- **Its own (recommended).** Make a free new Apple ID at appleid.apple.com (an email
  address is enough). On the Mac, open Messages → Settings → iMessage, sign out of
  yours and sign in with the new one. The bot is then its own contact in your iPhone.
  (Your own texts stop showing on the Mac, but your iPhone is unaffected.)
- **Yours.** Leave Messages signed in as you, and the bot talks in your "note to self"
  chat (text your own number). Nothing to sign up for, but you're texting yourself.

**Then:**

1. In `.env`, put the number or Apple ID email you'll text it **from** (your iPhone):
   ```
   DISPATCH_IMESSAGE_TO=+15551234567
   ```
2. Give your terminal permission to read Messages: **System Settings → Privacy & Security →
   Full Disk Access →** turn on **Terminal** (or iTerm / VS Code, whichever you run it
   from). Quit and reopen that app.
3. `npm run dispatch`. The first time, macOS asks whether Terminal may control
   **Messages**. Click **OK**.
4. You get "🤖 Dispatch is online" on your iPhone. Text it a job.
   - Using the bot's own Apple ID: text that Apple ID's email from your iPhone.
   - Using your own: text your own number.

It only acts on texts from `DISPATCH_IMESSAGE_TO`; everything else is ignored.

## 2b. Telegram — easiest, free, no tunnel

1. In Telegram, message **@BotFather** → `/newbot` → pick a name. It gives you a token.
2. Put it in `.env`: `DISPATCH_TELEGRAM_TOKEN=123456:ABC...`
3. `npm run dispatch`, then message your new bot anything.
4. It replies with your chat id. Put `DISPATCH_TELEGRAM_CHAT_ID=<that number>` in `.env` and restart.

Until step 4 the bot does nothing for anyone; after it, it only listens to you.

## 2c. Real text messages — Twilio

1. Sign up at twilio.com and buy a number (about $1–2 a month plus about a cent per text).
   > **US numbers:** carriers block texts from unregistered numbers. In the Twilio console
   > do the **A2P 10DLC** registration (sole-proprietor is fine) or verify a **toll-free number**.
   > It takes a few days. A Twilio *trial* can only text numbers you've verified, which is fine
   > here since you only text yourself.
2. In `.env`:
   ```
   TWILIO_ACCOUNT_SID=AC...
   TWILIO_AUTH_TOKEN=...
   TWILIO_FROM=+15551234567         # your Twilio number
   DISPATCH_OWNER_PHONE=+15559876543 # YOUR cell. It only obeys this number.
   ```
3. Give Twilio a way to reach your laptop. Run a tunnel in a second terminal:
   ```bash
   cloudflared tunnel --url http://localhost:3100     # free, no account
   # or:  ngrok http 3100
   ```
   It prints a URL like `https://something.trycloudflare.com`. Put it in `.env`:
   ```
   DISPATCH_PUBLIC_URL=https://something.trycloudflare.com
   ```
4. Twilio console → Phone Numbers → your number → **Messaging → "A message comes in"** →
   Webhook, `https://something.trycloudflare.com/sms`, HTTP POST. Save.
5. `npm run dispatch`. You'll get a "Dispatch is online" text.

The free trycloudflare URL changes on every restart, so repeat steps 3–4 each time. A named
Cloudflare tunnel or a paid ngrok domain stays fixed.

## 3. Using it

Text it like you'd text a person: "what's eating my disk space", "make a folder called
invoices-2026 on my desktop and move the PDFs from Downloads into it", "open youtube",
"check if my site's server is still running".

| Text | Does |
|---|---|
| `stop` | cancels the current job |
| `new` | forgets the conversation and starts fresh (also happens after 3 h idle) |
| `status` | idle, or what it's working on |
| `help` | the list |
| `y` / `n` | answers an approval question |

**Card vault.** Text things like "log Wemby Prizm Silver 2023 Prizm #136, PSA 10, paid $140
from eBay" or "sold the Cam Ward for $90 on eBay with eBay fees". Dispatch hands it to a
Claude Code chat in the cloud that can reach your @jaymoney_cards Vault page, and texts you
"sent". The change shows up on the vault page a few seconds later. Nothing comes back to
Dispatch, so it can't tell you what's in the vault: look at the page for that. Deleting a
card asks you first. Needs Claude Code signed in on the Mac and `DISPATCH_VAULT_SESSION`
in `.env` (the setup asks for it).

Text yourself from any script or long job:

```bash
npm run text-me -- "render finished"
```

## Safety: read this

This lets a text message run commands on your computer. It's guarded by:

- **Only you.** Texts from any other number or Telegram chat are dropped. Twilio requests
  are checked by signature, so knowing the URL isn't enough to fake one.
- **Approvals.** `DISPATCH_CONFIRM=risky` (the default) texts you first for anything that
  deletes, moves, overwrites, kills, uses sudo, pushes git, or changes scheduled tasks.
  `all` asks before every command. `off` never asks; don't use it.
- **Untrusted content.** It's told to treat web pages and files as data, not orders.
  Still, approve with care if you asked it to read something from the internet.
- **Your phone is the key.** Anyone holding your unlocked phone can use it. Keep it locked.

It runs as your user account, so it can do what you can do. Don't run it as admin/root.

## Settings

| Variable | Default | |
|---|---|---|
| `DISPATCH_MODEL` | `claude-sonnet-5-5` | which Claude model does the work (`claude-opus-5-5` is stronger, about 2x the price) |
| `DISPATCH_WORKDIR` | your home folder | where commands start |
| `DISPATCH_CONFIRM` | `risky` | `risky`, `all` or `off` |
| `DISPATCH_PORT` | `3100` | port for the SMS webhook |
| `DISPATCH_TWILIO_FROM` | `TWILIO_FROM` | use a different Twilio number than the store's |
| `DISPATCH_ANNOUNCE` | `true` | text you when it starts |

## Keeping it running

- **Stop the laptop sleeping** while you're away: Windows → Power settings → Sleep: Never
  (plugged in). Mac → start it with `caffeinate -is npm run dispatch` and leave the lid
  open, or it sleeps anyway.
- **Start it at login:** `npm i -g pm2 && pm2 start dispatch/index.js --name dispatch && pm2 save`.
  Then follow what `pm2 startup` prints (on Windows use `pm2-installer`).

Every request uses your Anthropic API credit. A typical small job costs a few cents; a long
one with lots of steps can cost more. Set a monthly spend limit in the Anthropic console so it can never surprise you.
