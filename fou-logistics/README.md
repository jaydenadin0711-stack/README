# FOU Logistics — website

Three-page static site. No build step, no framework, no dependencies — open
`index.html` in a browser and it runs.

```
fou-logistics/
├── index.html          Home: the scroll film + "how logistics works"
├── contact.html        Quote request form + dispatch details
├── careers.html        Open roles, hiring process, application form
├── assets/
│   ├── css/fou.css     The whole design system and every page's styles
│   ├── js/fou.js       Nav, reveals, counters, form validation, scroll fallback
│   └── img/logo.svg    PLACEHOLDER logo — swap this when the real one lands
├── build-preview.mjs   Bundles all three pages into one shareable file
└── fou-preview.html    Generated. Run `node build-preview.mjs` to refresh.
```

---

## Before this goes live

Two lists. Everything here is a placeholder chosen so the page reads
convincingly during review — none of it is real, and all of it needs replacing.

### Dropping in the logo

The placeholder mark is an "F" built from motion lines. It appears in **four**
places, all using the same 48×48 artwork:

| Where | What to do |
| --- | --- |
| `assets/img/logo.svg` | Replace the file. Keep the `viewBox="0 0 48 48"` and it drops straight in as the favicon. |
| Header of all 3 pages | Search each page for `<!-- PLACEHOLDER MARK` and swap the inline `<svg>` (it's inlined so it can pick up colour from CSS). |
| Footer of all 3 pages | Same inline `<svg>`, with gradient id `mark-b` instead of `mark-a`. |
| Truck &amp; van livery | In `index.html`, search `livery` — the orange `<rect>` + `FOU` `<text>` on the trailer, and the same pair on the van. |

If the real logo is wider than it is tall, set the header rule
`.brand svg { height: 34px; width: auto }` in `fou.css` and it will lay out
correctly without any other change.

The wordmark next to the mark is plain text (`.brand-name`), so a font change
is a one-line edit to `--sans` in `fou.css`.

### Details to replace

| File | What | Currently |
| --- | --- | --- |
| `contact.html` | Dispatch phone | `+1 (555) 010-0142` — a reserved fictional number |
| `contact.html` | Quotes / claims email | `quotes@`, `claims@foulogistics.com` |
| `contact.html` | Yard &amp; office address | `1200 Freight Way, Chicago IL` |
| `contact.html` | Office hours | Also update the open/closed logic in `fou.js` → `hours()` |
| `careers.html` | Recruiting phone | `+1 (555) 010-0143` |
| `careers.html` | Every pay range | Six roles, all invented — see the `role-pay` spans |
| `careers.html` | Role locations &amp; opening counts | All invented |
| `index.html` | The four stat tiles | 48 states / 24-7 / 98.6% OTIF / 4h dwell — see the `PLACEHOLDER FIGURES` comment |

The footer of all three pages carries the line *"Placeholder branding &amp;
figures"*. **Delete that line once the real details are in** — it is there so
nobody mistakes a review build for a finished one.

### The forms

Neither form posts anywhere, because there is no backend yet. Rather than fake
a submission, both compose a real pre-filled email and hand it to the visitor's
mail client via `mailto:`. That genuinely works today on a static host.

When you have an endpoint, `fou.js` → `forms()` is the only place to change:
the submit handler already validates everything and collects a `FormData`;
replace the `window.location.href = href` line with your `fetch(...)` POST. The
target addresses live on the `<form data-mailto="…">` attributes.

---

## How the scroll effect works

The homepage's five-act sequence — dock → warehouse → highway → cross-dock →
front door — is a **pinned, scroll-driven side-scroller**.

- `.journey-track` is a tall element (`560svh`). `.journey-stage` inside it is
  `position: sticky`, so the stage holds still while the track scrolls past.
  That's the pin.
- The track declares a `view-timeline`. Its `contain 0% → contain 100%` range is
  *exactly* the window during which the stage is pinned, so scroll progress maps
  1:1 to story progress with no magic numbers.
- Four parallax layers each travel their own full width
  (`translate3d(calc(-100% + 100vw), 0, 0)`). Depth comes from the artwork
  itself: the distant hills layer is short, so it covers less ground than the
  long foreground layer. There are no per-layer speed constants to keep in sync.
- The truck is a **separate layer held at stage centre**, so the world slides
  past it and it reads as driving rather than sliding. Its wheels are geared to
  scroll, not to a clock — stop scrolling and they stop turning.
- Captions and the act rail each own a slice of the same timeline, set per
  element as `--from` / `--to`, so one keyframe set serves all of them.

**Everything above is pure CSS.** Scroll-driven animations run off the main
thread, so the sequence stays smooth even while the browser is busy.

### If the browser doesn't support it

`fou.js` feature-detects `animation-timeline: view()`. Without it, the page gets
a `.no-sda` class and a small `requestAnimationFrame` loop writes the same
transforms directly onto the handful of animated layers. (Directly — not via a
CSS custom property on a shared parent, which would force a style recalc across
every child on every frame.)

### Reduced motion

`prefers-reduced-motion: reduce` **unpins the whole thing**: the track collapses
to its natural height and the five acts become plain stacked panels of text.
Nothing moves, nothing is lost. The site also responds to
`prefers-reduced-transparency` (solid chrome instead of blurred glass) and
`prefers-contrast: more`.

### Adding or reordering an act

1. Extend the artwork in the `.layer-world` SVG (it's one wide scene, with
   1,300 units of runway padded at each end so the first and last acts can reach
   the centre of the frame).
2. Add a `<figure class="cap" style="--from:…%; --to:…%">` and a matching
   `<li>` in `.act-rail`.
3. Bump `.journey-track { height }` by roughly `110svh` per act.
4. If the act changes where the truck should be on screen, adjust the
   `truck-in` / `van-in` keyframes in `fou.css` **and** the `rigRange` object in
   `fou.js` — those two must agree, or the fallback tells a different story.

---

## Design references

Motion and interface decisions follow two skill documents vendored at the repo
root in `.claude/skills/`:

- **`emil-design-eng`** — easing curves (no `ease-in` on UI, no `transition: all`),
  duration budgets (UI under 300ms), physicality (nothing enters from `scale(0)`,
  every pressable scales to `0.97` on `:active`), and CSS transitions over
  keyframes wherever something can be interrupted.
- **`apple-design`** — translucent chrome with content scrolling under it,
  scroll-edge fades instead of hard dividers, size-specific type tracking
  (tight on display, near zero on body), inline validation rather than
  validate-on-submit, and the three-tier accessibility response above.

## Running and deploying

Any static host. Locally:

```bash
cd fou-logistics
python3 -m http.server 8000     # then open http://localhost:8000
```

Opening `index.html` from the filesystem works too.

To deploy on this repo's GitHub Pages workflow, add this branch to
`.github/workflows/deploy-pages.yml` and set the artifact `path:` to
`fou-logistics` (it currently uploads the repo root, which is a different site).

### The preview file

`fou-preview.html` is one self-contained file with all three pages and a tiny
router — useful for sending someone a link with nothing to deploy. It is
**generated**; edit the real pages, then:

```bash
node build-preview.mjs
```
