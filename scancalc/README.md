# ScanCalc — blueprint

**Try it:** open `scancalc/sim/index.html` in a browser (or `/scancalc/sim/` when the store server is running) for a 3D simulator. You can turn the calculator around, use the keys and scan a random worksheet problem.

## Context
You want a handheld device that works like a normal calculator from the front. A camera on the back lets you point it at a worksheet or handwritten problem. It reads the problem, solves it, shows the answer **and the steps**, and loads the answer into the calculator so you can keep working with it.

A physical calculator can't read handwriting or solve word problems by itself. So the plan splits the work in two:
- **Device (Raspberry Pi):** normal calculator math runs on the device and works offline. The device also takes the photo.
- **Brain (Claude vision):** the photo goes to Claude, which reads the problem and returns the answer and steps as structured data. This repo already calls Claude in `server/jarvis.js`, and the same pattern gets reused for the calculator.

Note: many schools and tests ban camera or connected calculators. Treat this as a homework and study tool, not an exam calculator.

---

## 1. Hardware blueprint

### Parts list (BOM, about $120–160)
| Part | Pick | Why | ~Cost |
|---|---|---|---|
| Computer | Raspberry Pi Zero 2 W | Small, has Wi‑Fi, runs Python and a camera | $15 |
| Camera (back) | Pi Camera Module 3 (autofocus) | Autofocus matters for close-up paper | $25 |
| Camera cable | Pi Zero 22‑pin to 15‑pin ribbon | The Zero uses the smaller connector | $3 |
| Screen (front) | 2.8"–3.5" SPI TFT, ILI9341/ST7789, 320×240 | Fits a calculator body; easy to drive | $15 |
| Keypad | 5×6 matrix of 6×6 mm tactile switches on perfboard (30 keys), or a 4×5 membrane pad plus extra buttons | A real "clicky" calculator feel | $8 |
| Scan button | One large tactile button on the side or top | A dedicated shutter | $1 |
| Power | 2000 mAh 3.7 V LiPo + PowerBoost 1000C (or similar) charger/boost | USB charging, 5 V out | $25 |
| Power switch | Slide switch | Hard on/off | $1 |
| Light | 1 white LED + resistor next to the camera | Flash for dim rooms | $1 |
| Case | 3D‑printed two‑part shell (PLA/PETG), ~170×85×22 mm | Calculator form factor | $5–20 |
| Misc | microSD 16 GB+, M2.5 standoffs, wire, headers | — | $10 |

Upgrade path: use a Pi 4 or Pi 5 if the Zero 2 W feels slow. The case gets thicker.

### Layout
```
 FRONT                         BACK
 ┌──────────────────┐          ┌──────────────────┐
 │  ┌────────────┐  │          │   ◉ camera  • LED│
 │  │  SCREEN    │  │          │                  │
 │  └────────────┘  │          │                  │
 │ [SCAN] [MODE] [⌫]│          │   battery bay    │
 │  7  8  9  ÷  (  │          │  (LiPo + charger)│
 │  4  5  6  ×  )  │          │                  │
 │  1  2  3  −  ^  │          │                  │
 │  0  .  ±  +  √  │          │   USB-C charge ▭ │
 │ AC  ←  →  =  ANS │          └──────────────────┘
 └──────────────────┘   side: power switch, shutter button
```

### Wiring (Pi Zero 2 W GPIO)
- **Display (SPI0):** MOSI GPIO10, SCLK GPIO11, CS GPIO8, DC GPIO25, RST GPIO24, backlight GPIO18 (PWM brightness).
- **Keypad matrix:** 5 rows → GPIO 5, 6, 13, 19, 26; 6 columns → GPIO 12, 16, 20, 21, 7, 23. Use internal pull‑ups and scan the rows in software.
- **Shutter button:** GPIO 17 to GND, with a pull‑up.
- **Flash LED:** GPIO 27 → 220 Ω → LED → GND.
- **Camera:** CSI ribbon.
- **Power:** LiPo → PowerBoost → Pi 5 V/GND pins. Wire the PowerBoost "LBO" (low battery) pin to GPIO 22 for a battery warning.

---

## 2. Software blueprint

### On the device (Python, Raspberry Pi OS Lite, no desktop)
```
scancalc/device/
  main.py          # app loop and screen state machine
  keypad.py        # matrix scan + debounce → key events
  display.py       # draws to the TFT (luma.lcd or Pillow → framebuffer)
  calc_engine.py   # safe expression parser/evaluator (no eval()), ANS memory
  camera.py        # picamera2: preview, autofocus, capture, crop/compress
  scan_client.py   # sends photo to the server, gets JSON back
  config.toml      # server URL, device token, Wi‑Fi notes
  scancalc.service # systemd unit so it starts at boot
```

**Screens (state machine):**
1. **CALC**: a normal calculator. Supports + − × ÷, parentheses, powers, √, %, ±, and ANS. Works fully offline.
2. **SCAN PREVIEW**: press SCAN to show the live camera view and a framing box. Press the shutter to capture.
3. **THINKING**: a spinner while the photo uploads.
4. **RESULT**: shows the problem as read ("I read: 3x + 7 = 22"), then the final answer, then the steps, scrollable with ↑/↓.
   - `=` loads the answer into the calculator as ANS.
   - `⌫` returns to the camera to retake the photo.
5. **ERROR / OFFLINE**: "No Wi‑Fi — calculator still works."

**Calculator engine:** a small tokenizer and shunting‑yard parser. Never use Python `eval`. It uses decimal math to avoid errors like 0.1 + 0.2.

**Photo handling:** capture at about 2304×1296. Crop to the framing box, convert to grayscale, and auto‑contrast. Resize so the long edge is about 1568 px and compress to JPEG (about 200–400 KB). This keeps uploads fast on Wi‑Fi.

### The brain (lives in this repo, next to JARVIS)
- **New file `server/calc.js`:** an Express router copied from the pattern in `server/jarvis.js`. It reuses the lazy Anthropic client setup, the `/health` endpoint, the allowed‑model list and the error handling.
  - `POST /api/calc/scan`: accepts `{ image: base64 JPEG, mode: "solve" }` and sends it to Claude as an image content block.
  - The system prompt says: read the math problem in the image, solve it, and return **JSON only** in the shape `{ read: "...", answer: "...", answer_numeric: number|null, steps: ["...", ...], confidence: "high|medium|low" }`. Use structured outputs so the JSON is always valid.
  - Auth: the device sends a shared `SCANCALC_TOKEN` header, so random people can't spend your API credit.
  - Limit the body size to about 2 MB for this route. `server.js` currently sets `express.json` to 100 kb.
- **`server/server.js`:** mount it with `app.use('/api/calc', require('./calc').buildRouter())`, next to the JARVIS mount at line 267.
- **`.env.example`:** add `SCANCALC_TOKEN` and an optional `SCANCALC_MODEL`.
- **Optional `scancalc/web/index.html`:** a browser test page that does the same flow with a phone camera. It lets you test the brain before the hardware arrives.

The server runs wherever the store already runs, or on a home PC. The device needs Wi‑Fi, either from home or from a phone hotspot. (Option: call the Claude API directly from the Pi with no server. That's simpler, but the API key then sits on the device.)

---

## 3. Build phases
1. **Brain first, no hardware.** Build `server/calc.js` and the test web page. Photograph real worksheets with a phone, then tune the prompt and JSON output.
2. **Pi bring‑up.** Flash the Pi OS, enable SPI and the camera, then get the screen drawing, keypad presses printing and the camera capturing. Each part gets its own small test script.
3. **Calculator mode.** Write `calc_engine.py` with unit tests, then add the keypad, display and CALC screen.
4. **Scan mode.** Wire the camera, scan client and RESULT screen to the server.
5. **Power and case.** Add the LiPo and charger, the battery warning, then design and print the shell (Fusion 360, Onshape or Tinkercad) and assemble it.
6. **Polish.** Start at boot with systemd, add a sleep timer, flash LED auto‑on in low light, and a retake button.

## 4. Planned repo changes
- `server/calc.js` (new): the scan endpoint, reusing the JARVIS router pattern.
- `server/server.js`: the mount, plus a larger JSON limit for `/api/calc`.
- `.env.example`: the new variables.
- `scancalc/device/*` (new): the Pi app as listed above, plus `scancalc/README.md` with the parts list, wiring and setup.
- `scancalc/web/index.html` (new, optional): the phone test page.
- `README.md`: a short "Also in here: ScanCalc" section like the JARVIS one.

## 5. Verification
- `python -m pytest scancalc/device/tests`: calculator engine tests covering order of operations, decimals, divide‑by‑zero and parentheses.
- `npm start`, then `curl` a sample worksheet photo to `/api/calc/scan` and check the JSON shape. Also check that a missing token gets a 401 and that there's a 503 with no API key.
- Run the device app on a laptop with a mock display and keypad (keyboard input) before putting it on the Pi.
- On the hardware: scan 10 sample problems (arithmetic, algebra, a word problem, handwriting). Check that the answer goes into ANS, that the calculator still works with Wi‑Fi off, and how long the battery lasts.
