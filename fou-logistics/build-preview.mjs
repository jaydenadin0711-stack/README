/**
 * Builds fou-preview.html — a single self-contained file carrying all three
 * pages, for sharing a link without deploying anything.
 *
 * The multi-page site in this folder is the real deliverable; this is a
 * derived artefact. Run `node build-preview.mjs` after editing any page.
 *
 * No dependencies — node build-preview.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(here, p), 'utf8');

const css = read('assets/css/fou.css');
const js = read('assets/js/fou.js');
const logo = read('assets/img/logo.svg');

const PAGES = [
  { file: 'index.html', route: 'index' },
  { file: 'contact.html', route: 'contact' },
  { file: 'careers.html', route: 'careers' },
];

/** Pull <main>…</main> out of a page and give it a route-scoped id. */
function extractMain(html, route) {
  const open = html.indexOf('<main id="main">');
  const close = html.lastIndexOf('</main>');
  if (open === -1 || close === -1) throw new Error('no <main> in ' + route);
  const inner = html.slice(open + '<main id="main">'.length, close);
  return `<main id="main-${route}" data-route="${route}">${inner}</main>`;
}

const shell = read('index.html');
const mains = PAGES.map((p) => extractMain(read(p.file), p.route)).join('\n');

const favicon = 'data:image/svg+xml,' + encodeURIComponent(logo);

const router = `
/* Preview-only router. The deployed site is three real HTML files; this
   swaps between copies of their <main> so one file can show all of them. */
(function () {
  var mains = Array.prototype.slice.call(document.querySelectorAll('main[data-route]'));
  var routeOf = function (href) {
    var m = String(href).match(/([a-z]+)\\.html/);
    return m ? (m[1] === 'index' ? 'index' : m[1]) : null;
  };

  function show(route, hash) {
    mains.forEach(function (m) { m.hidden = m.dataset.route !== route; });

    document.querySelectorAll('.nav-links a[href]').forEach(function (a) {
      var r = routeOf(a.getAttribute('href'));
      if (a.classList.contains('btn')) return;
      if (r === route) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });

    // Reveals are one-shot IntersectionObserver callbacks that never fired
    // for a hidden page, so settle them when the page first becomes visible.
    var active = document.querySelector('main[data-route="' + route + '"]');
    if (active) active.querySelectorAll('[data-reveal]').forEach(function (el) { el.classList.add('is-in'); });

    if (hash) {
      var target = active && active.querySelector(hash);
      if (target) { target.scrollIntoView(); return; }
    }
    window.scrollTo(0, 0);
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href');
    if (!href || href.charAt(0) === '#') return;      // in-page anchor: leave it
    var route = routeOf(href);
    if (!route) return;                                // tel:, mailto:, external
    e.preventDefault();
    var hash = href.indexOf('#') > -1 ? href.slice(href.indexOf('#')) : '';
    show(route, hash);
  });

  show('index', '');
})();
`;

let out = shell;

// Inline the stylesheet.
// NOTE: every injection below uses a replacer *function*. With a string
// replacement, `$$`, `$&` and friends inside the injected file would be
// interpreted as substitution patterns — which silently rewrote `var $$`
// to `var $` and broke the bundle.
out = out.replace(
  '<link rel="stylesheet" href="assets/css/fou.css">',
  () => '<style>\n' + css + '\n</style>'
);

// Inline the favicon so the file stands alone.
out = out.replace(
  '<link rel="icon" href="assets/img/logo.svg" type="image/svg+xml">',
  () => '<link rel="icon" href="' + favicon + '" type="image/svg+xml">'
);

// Replace the shell's single <main> with all three.
const openIdx = out.indexOf('<main id="main">');
const closeIdx = out.lastIndexOf('</main>');
out = out.slice(0, openIdx) + mains + out.slice(closeIdx + '</main>'.length);

// Inline behaviour, then the router.
out = out.replace(
  '<script src="assets/js/fou.js" defer></script>',
  () => '<script>\n' + js + '\n</script>\n<script>\n' + router + '\n</script>'
);

out = out.replace(
  '<title>FOU Logistics — Freight that arrives when it said it would</title>',
  '<title>FOU Logistics — site preview</title>'
);

writeFileSync(join(here, 'fou-preview.html'), out);
console.log('fou-preview.html written —', (out.length / 1024).toFixed(0) + 'KB, 3 pages');
