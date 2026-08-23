/* ============================================================
   J.A.R.V.I.S. — service worker

   Keeps a copy of the page so it opens with no connection: the HUD,
   voice, earnings, goals, notes and timers all work offline. Anything
   that needs the outside world — Claude, Gmail, OpenStreetMap, fonts —
   is left entirely alone and simply fails as it would in a browser tab.

   Bump CACHE when the page changes; the old one is deleted on activate.
   ============================================================ */
'use strict';

const CACHE = 'jarvis-v2';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // One miss must not fail the whole install, so they go in one by one.
      .then(cache => Promise.all(SHELL.map(url => cache.add(url).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(names.filter(n => n !== CACHE).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Someone else's server is not ours to cache or to stand in for.
  if (url.origin !== self.location.origin) return;
  // Nor is the bridge: a cached "no Claude here" would still be served
  // after you had connected one.
  if (url.pathname.indexOf('/api/') !== -1) return;

  // Navigations: fresh copy when we can reach it, cached one when we
  // cannot — so a new version is picked up as soon as it exists.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put('./index.html', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('./index.html').then(hit => hit || caches.match('./')))
    );
    return;
  }

  // Everything else of ours: cached first for speed, refreshed behind it.
  event.respondWith(
    caches.match(req).then(hit => {
      const live = fetch(req).then(res => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => hit);
      return hit || live;
    })
  );
});
