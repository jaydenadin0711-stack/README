# Skimos Coffee Shop — website

Four-page static site. No build step, no framework — open `index.html` in a browser and it runs.

```
skimos-coffee/
├── index.html    Home: hero, popular drinks, both locations, sourcing/award blurb
├── menu.html     Full menu by section
├── about.html    Founder story and timeline
├── visit.html    Both locations with embedded maps, hours, phone
└── assets/
    ├── css/style.css   The whole design system
    └── js/main.js      Mobile nav toggle, footer year, live open/closed badges
```

## What's real here

This is built from public info about the actual Skimos Coffee Shop (Henderson &
Las Vegas, NV, founded by Veronica Croaker): both addresses, phone numbers,
hours, the founder story, the organic/Olympia Coffee sourcing, and the 2021
iHeartRadio "Nevada's Best Coffee Shop" award. That part shouldn't need
touching unless it's out of date.

**Menu prices are approximate.** A handful of items (the latte, mocha, Rasa
Mocha, the avocado toasts) have confirmed public prices; the rest are
reasonable placeholders in the same range to fill out a full menu page. Swap
in the real POS pricing before treating this as the live site.

## Design choices, and why

Built specifically to avoid the generic "AI-made landing page" look:

- **No stock photography.** There's no real photo library to pull from, and a
  generated photo of somebody else's storefront would just be fake. The hero
  uses a simple line-art SVG cup instead.
- **No purple gradients, no glassmorphism, no soft glow shadows.** Buttons and
  cards use a solid offset drop-shadow ("sticker" style) instead — it reads as
  designed by hand rather than templated.
- **Warm, specific palette**: cream/paper background, espresso brown, one rust
  accent color. Fraunces for headlines (a warm, slightly quirky serif — not
  the Inter/Poppins pairing every SaaS template uses), Work Sans for body.
- **Copy avoids AI-writing tells**: no em-dash-as-punctuation-tic, no rule-of-
  three padding, no "elevate your experience"-style filler, no fabricated
  customer testimonials. Specific, sourced details instead (real award, real
  roaster, real founding story) carry the credibility.

## Running it

```bash
cd skimos-coffee
python3 -m http.server 8000     # then open http://localhost:8000
```

Opening `index.html` directly from the filesystem also works.

To deploy on this repo's existing GitHub Pages workflow
(`.github/workflows/`), add this branch to the trigger list and point the
artifact `path:` at `skimos-coffee/` — it currently deploys the repo root,
which is a different, unrelated project.
