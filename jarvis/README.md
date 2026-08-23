# J.A.R.V.I.S.

A voice assistant with a heads-up display. Talk to it, it talks back — and the
panels around the core are live readings from the machine it's running on, not
decoration.

Open `jarvis/index.html` in a browser and it works immediately. Start the server
in this repo with an Anthropic API key and it can also hold a real conversation.

---

## Running it

**Quickest — no setup**

Double-click `jarvis/index.html`, or drag it into Chrome or Edge. Voice in, voice
out, all the telemetry, all the built-in commands. No server, no key, no network.

**Published copy — voice, no install**

The repo's Pages workflow publishes the whole site, so JARVIS is live at
`https://<your-user>.github.io/README/jarvis/`. It's https and a page in its own
right, so the microphone works there. No server means no bridge — use your own
key (below) if you want Claude on the published copy.

**Full version — with Claude answering**

```bash
npm install
cp .env.example .env          # then set ANTHROPIC_API_KEY=sk-ant-...
npm start
# → http://localhost:3000/jarvis/
```

The masthead reads **BRAIN: CLAUDE** once the bridge is live. Your API key stays
on the server — the browser never sees it.

> Use **Chrome or Edge**. Speech recognition is a Chromium feature; Firefox has
> no `SpeechRecognition` at all and Safari's is patchy. Everything except voice
> *input* works everywhere.

## Getting the microphone working

Press **Start listening** and the browser asks for the mic — allow it once and
you're done. Three things can stop that prompt appearing, and JARVIS tells you
which one it is rather than just failing:

| What you see | What's wrong | Fix |
|---|---|---|
| "opened in a panel that does not pass the microphone through" | The page is inside an iframe that wasn't granted mic access. A browser rule — no page can grant it to itself. | Press **Open in its own tab** (the button appears when this happens) and allow the mic there. |
| "browsers only allow microphones on https or localhost" | You opened the file directly, so the page is on `file://`. | Run `npm start` and use `http://localhost:3000/jarvis/`. |
| "the microphone is blocked for this page" | Permission was denied earlier and the browser remembers. | Click the camera or lock icon in the address bar → Microphone → **Allow**, then press Start listening again. |

If recognition keeps dropping the moment it starts, JARVIS stops retrying and
says so — Chrome sends audio to an online speech service, so that usually means
a connection problem. The text box works regardless.

---

## Talking to it

Press **Start listening** and say **"Jarvis, …"** — the wake word keeps it from
reacting to every word in the room. Turn the wake word off in the Voice panel to
have it respond to everything it hears, or use **Hold to talk** to skip the wake
word for one sentence. There's a text box too, for when a mic isn't practical.

**Handled on-device, instantly, no network:**

| Say | What happens |
|---|---|
| "made 250 from a break" | logs it against this month, this year and all time |
| "how are we doing" | earnings and every goal's progress, spoken |
| "put 200 toward the Rolex" | adds to that goal's own fund |
| "set the Rolex target to 9000" | changes what a goal is aiming at |
| "goals" | reads each one back with how far off it is |
| "find businesses with no website" | prospect list from OpenStreetMap — free, no key |
| "find barbers with no website" | same, narrowed to one trade |
| "open instagram" / "pull up google maps" | opens the site in a new tab |
| "what time is it" / "what's the date" | spoken time and date |
| "status report" | full spoken diagnostic of power, uplink, hardware, frame rate |
| "what's my battery" | charge, source, and time remaining |
| "network status" | connection class, throughput, round-trip latency |
| "set a timer for five minutes" | counts down in the Timers panel, speaks when done |
| "note — order more sleeves" | saved to the Notes panel, kept on this device |
| "read my notes" / "clear my notes" | reads back or wipes them |
| "what's 18 percent of 240" | arithmetic, evaluated safely (no `eval`) |
| "5 miles in km" / "20 c in f" | length, mass, volume, speed and temperature conversion |
| "how long until Christmas" | days to a named or dated day |
| "when is sunset" / "what's the moon" | computed from your coordinates on-device |
| "flip a coin" / "roll a d20" | what you'd expect |
| "mute" / "stop listening" | shuts it up, keeps the display running |

**Everything else** — questions, explanations, writing, advice — goes to Claude
through the bridge.

Without a key, JARVIS explains that once and then keeps it short ("Beyond me
without Claude, I'm afraid") — the how-to-fix stays on screen in the console
panel instead of being read at you every time. He never invents an answer he
doesn't have.

### Two ways to give him Claude

|  | Where the key lives | Works on |
|---|---|---|
| **The bridge** (`ANTHROPIC_API_KEY` + `npm start`) | On your server. The browser never sees it. | `localhost:3000/jarvis/` |
| **Your own key**, pasted into the Brain panel | In that browser's local storage, on your machine | Any copy that can reach the internet — including the published Pages site |

The Brain panel appears whenever the bridge isn't running. Paste a key and JARVIS
calls Anthropic straight from the browser, using the
`anthropic-dangerous-direct-browser-access` header that exists for exactly this
bring-your-own-key case. **Forget key** removes it.

Be aware of the trade-off: a key in browser storage can be read by anything with
access to that browser profile, and by any script running on that page. Use a key
you can revoke at `console.anthropic.com`, and prefer the bridge when you can run
one. This won't work inside an embedded panel — the embedding page blocks outside
calls — which the panel says when it detects one.

## Mail

Ask **"Jarvis, any new mail?"** and he reads out who it's from and what it's
about; the Mail panel lists the unread ones and refreshes every couple of minutes.

There are two routes to the same inbox, and JARVIS picks whichever is available:

- **Claude-hosted copy** — borrows the Gmail connector already on your Claude
  account. No password, no token this page can see; the call runs with your
  credentials, held by Claude. Nothing to set up.
- **Anywhere else** (the published site, localhost) — signs in to Google directly
  with a client ID of your own. Setup below, once.

### Setting up Google sign-in (once, ~10 minutes)

You need a Google **OAuth client ID**. It isn't a secret — it identifies the app,
it doesn't grant access to anything on its own.

1. Go to **console.cloud.google.com** and create a project (any name).
2. **APIs & Services → Library**, search **Gmail API**, press **Enable**.
3. **APIs & Services → OAuth consent screen**: choose **External**, fill in the
   app name and your email. Under **Test users**, add your own Gmail address —
   without this, Google refuses the sign-in.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**,
   type **Web application**. Under **Authorised JavaScript origins** add the
   exact address you'll open JARVIS from, with no trailing slash:
   - `https://<your-user>.github.io` for the published site
   - `http://localhost:3000` if you also run it locally
5. Copy the client ID (it ends `.apps.googleusercontent.com`), paste it into the
   **Mail** panel, press **Save**, then **Connect Gmail**.

The access token Google returns lives in memory only, lasts about an hour, and is
never written to storage — only the client ID is remembered. The scope is
read-only. If sign-in fails, the panel names the likely cause: a missing test
user, a mismatched origin, or the Gmail API not switched on.

It reads unread inbox mail only (`is:unread in:inbox`) and never sends, replies,
deletes or labels anything — the page declares one read tool and nothing else.

If Gmail can't be reached, the panel says which of these it is, because each has a
different fix: the connector needs reconnecting, isn't added to your account, is
duplicated and needs choosing between, is blocked by an organisation policy, or is
simply not answering right now.

## "He isn't speaking"

Browsers keep a page silent until you interact with it, so his greeting can't play
on load. JARVIS holds the line and shows **"Click anywhere to give JARVIS his
voice"** — one click anywhere and he speaks it, and stays audible from then on.

---

## Earnings and goals

Log what you make — by voice, or in the **Earnings** panel — and JARVIS keeps the
running totals for this month, this year and all time, plus your best month so
far. **Goals** sits underneath, each with a bar showing how close you are.

Three goals are there to begin with: a first $10k month, a Rolex, and a first
$100k year. A goal counts one of three things: **this month's** earnings, **this
year's**, or **its own fund** you add to deliberately — which is how the Rolex
works, since money you earn isn't money you've set aside. The Rolex target starts
at $10,000 as a placeholder; set yours with *"set the Rolex target to 9000"*.

Add or remove goals in the panel. Everything is stored in that browser and goes
nowhere else — though when you ask JARVIS something that needs Claude, the totals
ride along in the telemetry note so he can answer sensibly about them.

## Leads

**Leads** finds businesses near you with no website recorded, for cold outreach.
It queries OpenStreetMap's public Overpass endpoint — no key, no account, no
billing, and nothing about you is sent beyond the coordinates being searched.

Pick a trade and a radius, or just say *"find barbers with no website"*. You get
name, type, phone and address where OSM has them; tick each one off as you
contact it (that survives reloads), and **Copy list** puts the lot on your
clipboard tab-separated, so it pastes straight into a spreadsheet.

**What this list actually means:** OSM has no website for that business. Not the
same as the business having none — some will have a page nobody added to the map.
Expect a decent share of genuine prospects and some already sorted. It's a list to
work through, not a verified fact.

If the search fails, the panel says which it is: the free server throttling heavy
use, a timeout from too wide a radius, or no connection.

## Opening sites

*"Open Instagram"*, *"pull up Google Maps"*, *"open dropkickcreative.com"* — the
common ones are built in, and anything that looks like a domain works too.

A web page **cannot start a desktop application** — no browser allows that — so
this opens the website, which for Facebook or Instagram amounts to the same
thing. Pop-ups opened without a click are often blocked; when that happens JARVIS
puts a link on screen instead of failing silently.

## What's actually on the display

Every number is measured, not mocked:

- **Power** — charge, mains or battery, time to full or empty (Battery Status API)
- **Uplink** — online state, connection class, downlink Mbps, round-trip latency
- **Hardware** — logical cores, memory, display and pixel ratio, GPU renderer, platform
- **Heap** — JavaScript memory in use against the browser's ceiling (Chromium only)
- **Render rate** — the reactor's real frame rate
- **Mic level** — live RMS off the microphone, which is also what makes the ring ripple
- **Solar** — sunrise, sunset, daylight length, current sun altitude and moon phase,
  computed on-device with the standard astronomical approximations. Press **Acquire
  position** once; the coordinates are stored in your browser and sent nowhere.

Panels that a browser refuses to fill say so — "not exposed", "unsupported" — rather
than showing a plausible-looking number. Firefox hides battery; only Chromium reports
heap.

The core reacts to what's happening: it ripples with your voice while listening,
flares while speaking, and turns amber with a counter-rotating ring while thinking.

---

## Files

| Path | What it is |
|---|---|
| `jarvis/index.html` | The whole client — HUD, voice, command engine. One file, no build step, no dependencies. |
| `server/jarvis.js` | The bridge: `GET /api/jarvis/health` and `POST /api/jarvis/chat`. |
| `server/server.js` | Mounts the bridge at `/api/jarvis` alongside the store API. |

## Configuration

| Variable | Effect |
|---|---|
| `ANTHROPIC_API_KEY` | Turns the Claude bridge on. Without it the HUD runs on its local command set. |
| `JARVIS_MODEL` | Which model answers by default. Defaults to `claude-opus-5`. |

### Which model, and whether he can search

The Brain panel picks the model per browser — Opus 5 (sharpest, roughly 1–2¢ a
question), Sonnet 5 (about half that), or Haiku 4.5 (about a fifth). The choice
is remembered on that device. The bridge accepts only those three from the
browser and falls back to `JARVIS_MODEL` for anything else, so a page can't bill
your key against a model you didn't choose.

**Web search** is on by default. Without it he answers from training alone, which
means anything about "right now" comes back confidently out of date. Anthropic
runs the search and returns results in the same response; a long search can pause
the turn, which both the bridge and the browser path continue automatically.
Searches add a little cost per use, so the toggle is there if you'd rather not.

The bridge sends a short telemetry snapshot (time, battery, network, hardware,
timer and note counts) with each message so answers can account for the state of
the machine. It never sends your notes' contents, your coordinates, or the page
itself.

## Changing his manner

The personality is one string — `SYSTEM` at the top of `server/jarvis.js`. It asks
for plain spoken English with no markdown, because everything it returns gets read
aloud by a speech synthesiser. Keep that constraint if you rewrite it, or he'll
start saying "asterisk asterisk" out loud.

To change the voice itself, use the picker in the Voice panel — it ranks British
English male voices first and remembers your choice. What's in the list comes from
your operating system, not from this page.
