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
> *input* works everywhere. The page must be on `localhost` or `https://` for the
> microphone to be allowed at all — that's a browser rule, not this app's.

---

## Talking to it

Press **Start listening** and say **"Jarvis, …"** — the wake word keeps it from
reacting to every word in the room. Turn the wake word off in the Voice panel to
have it respond to everything it hears, or use **Hold to talk** to skip the wake
word for one sentence. There's a text box too, for when a mic isn't practical.

**Handled on-device, instantly, no network:**

| Say | What happens |
|---|---|
| "what time is it" / "what's the date" | spoken time and date |
| "status report" | full spoken diagnostic of power, uplink, hardware, frame rate |
| "what's my battery" | charge, source, and time remaining |
| "network status" | connection class, throughput, round-trip latency |
| "set a timer for five minutes" | counts down in the Timers panel, speaks when done |
| "note — order more sleeves" | saved to the Notes panel, kept on this device |
| "read my notes" / "clear my notes" | reads back or wipes them |
| "what's 18 percent of 240" | arithmetic, evaluated safely (no `eval`) |
| "when is sunset" / "what's the moon" | computed from your coordinates on-device |
| "flip a coin" / "roll a d20" | what you'd expect |
| "mute" / "stop listening" | shuts it up, keeps the display running |

**Everything else** — questions, explanations, writing, advice — goes to Claude
through the bridge. Without the bridge it says so plainly rather than pretending.

---

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
| `JARVIS_MODEL` | Which model answers. Defaults to `claude-opus-5`. |

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
