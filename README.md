# Rips Society — Official Website

Single-page website for **Rips Society**, a Las Vegas based sports card breaking company.

## What's on the site

- **Hero** with the Rips Society wordmark (recreated as an inline SVG to match the logo — white distressed type, red rips, cracked black background)
- **Where To Watch** — a stacked-card deck linking every live channel:
  - [Whatnot — @ripssociety](https://www.whatnot.com/user/ripssociety) — main channel, $1 baseball breaks
  - [Whatnot — @ripssocietylive](https://www.whatnot.com/user/ripssocietylive) — Pokémon, baseball, basketball singles + occasional soccer breaks
  - [Fanatics Live](https://www.fanatics.live/shows/4794c551-7fbc-4ebb-a386-7c6cc098f395) — PYT (Pick Your Team) breaks
  - TikTok — Pokémon breaks (character breaks, Rip Till You Hit, energy breaks)
- **Sports Breaks** — PYT, Random Team Spin, $1 Singles, plus baseball / basketball / football / soccer
- **Pokémon Breaks** — Character Breaks, Rip Till You Hit, Energy Breaks
- **Follow** panel with [Instagram — @ripssociety](https://www.instagram.com/ripssociety/) and every channel link
- Scroll effects throughout: scroll-progress bar, word-by-word manifesto reveal, sticky stacking channel cards, parallax crack texture, marquees, count-up stats, staggered section reveals

## Running it

It's a single static file — no build step. Open `index.html` in a browser, or serve it:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Publishing with GitHub Pages

1. Repo **Settings → Pages**
2. Source: **Deploy from a branch**, pick the branch and `/ (root)` folder
3. Save — the site goes live at `https://<user>.github.io/<repo>/`

## Swapping in the real logo

The logo is currently an SVG recreation. To use the actual logo file:

1. Add your logo image to the repo, e.g. `assets/logo.png`
2. In `index.html`, replace the `<svg class="hero-logo">…</svg>` block (and the two smaller `<svg class="mark">…</svg>` blocks in the nav and footer) with:
   ```html
   <img class="hero-logo" src="assets/logo.png" alt="Rips Society">
   ```

## Updating the TikTok link

The TikTok links point to `https://www.tiktok.com/@ripssociety`. If the handle is different, search-and-replace that URL in `index.html`.
