/* ============================================================
   Rips Society — shared store logic
   Cart is stored in localStorage. Products load from
   data/products.json (served statically or by the Node server).
   ============================================================ */
(function (global) {
  'use strict';

  var CART_KEY = 'rips_cart_v1';
  var API_BASE = ''; // same origin — the Node server mounts /api here

  /* ---------------- products ---------------- */
  var _catalog = null;
  function loadCatalog() {
    if (_catalog) return Promise.resolve(_catalog);
    return fetch('data/products.json')
      .then(function (r) { if (!r.ok) throw new Error('catalog ' + r.status); return r.json(); })
      .then(function (data) { _catalog = data; return data; });
  }
  function findProduct(catalog, id) {
    for (var i = 0; i < catalog.products.length; i++) {
      if (catalog.products[i].id === id) return catalog.products[i];
    }
    return null;
  }
  function categoryLabel(catalog, catId) {
    for (var i = 0; i < catalog.categories.length; i++) {
      if (catalog.categories[i].id === catId) return catalog.categories[i].label;
    }
    return catId;
  }

  /* ---------------- money ---------------- */
  function money(n) {
    return '$' + Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  /* ---------------- product art (generated SVG) ---------------- */
  function artFor(p, big) {
    var hue = typeof p.hue === 'number' ? p.hue : 200;
    var c1 = 'hsl(' + hue + ',62%,16%)';
    var c2 = 'hsl(' + ((hue + 40) % 360) + ',70%,9%)';
    var glow = 'hsl(' + hue + ',85%,55%)';
    var em = p.emoji || '🃏';
    var gid = 'g' + p.id.replace(/[^a-z0-9]/gi, '') + (big ? 'b' : '');
    return '' +
      '<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' + p.name.replace(/"/g, '&quot;') + '">' +
        '<defs>' +
          '<linearGradient id="' + gid + '" x1="0" y1="0" x2="1" y2="1">' +
            '<stop offset="0" stop-color="' + c1 + '"/>' +
            '<stop offset="1" stop-color="' + c2 + '"/>' +
          '</linearGradient>' +
        '</defs>' +
        '<rect width="400" height="300" fill="url(#' + gid + ')"/>' +
        '<g opacity="0.16" fill="none" stroke="' + glow + '" stroke-width="1.4">' +
          '<path d="M-20 70 L120 130 L180 110 L240 190 L220 260"/>' +
          '<path d="M420 40 L330 120 L360 200 L280 250"/>' +
        '</g>' +
        '<g opacity="0.14" font-size="26" fill="#f4f1ec">' +
          '<text x="26" y="270">♠</text><text x="352" y="46">♦</text>' +
        '</g>' +
        '<rect x="130" y="52" width="140" height="196" rx="10" fill="#0b0b0d" stroke="' + glow + '" stroke-opacity="0.75" stroke-width="2"/>' +
        '<rect x="141" y="63" width="118" height="174" rx="6" fill="none" stroke="#f4f1ec" stroke-opacity="0.22" stroke-width="1"/>' +
        '<text x="200" y="168" text-anchor="middle" font-size="64">' + em + '</text>' +
        '<text x="200" y="222" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="13" letter-spacing="3" fill="#f4f1ec" opacity="0.85">RIPS</text>' +
        '<circle cx="200" cy="90" r="4" fill="' + glow + '"/>' +
      '</svg>';
  }

  /* ---------------- cart ---------------- */
  function getCart() {
    try {
      var raw = localStorage.getItem(CART_KEY);
      var cart = raw ? JSON.parse(raw) : {};
      return (cart && typeof cart === 'object') ? cart : {};
    } catch (e) { return {}; }
  }
  function saveCart(cart) {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch (e) {}
    updateCartBadge();
  }
  function addToCart(id, qty) {
    var cart = getCart();
    cart[id] = Math.min(99, (cart[id] || 0) + (qty || 1));
    saveCart(cart);
  }
  function setQty(id, qty) {
    var cart = getCart();
    qty = Math.max(0, Math.min(99, qty | 0));
    if (qty === 0) delete cart[id]; else cart[id] = qty;
    saveCart(cart);
  }
  function clearCart() { saveCart({}); }
  function cartCount() {
    var cart = getCart(), n = 0;
    for (var k in cart) n += cart[k];
    return n;
  }
  function cartTotals(catalog) {
    var cart = getCart();
    var items = [], subtotal = 0;
    for (var id in cart) {
      var p = findProduct(catalog, id);
      if (!p) continue;
      var qty = cart[id];
      items.push({ product: p, qty: qty, line: p.price * qty });
      subtotal += p.price * qty;
    }
    var freeShipAt = 100;
    var shipping = items.length === 0 ? 0 : (subtotal >= freeShipAt ? 0 : 4.99);
    return { items: items, subtotal: subtotal, shipping: shipping, total: subtotal + shipping, freeShipAt: freeShipAt };
  }
  function updateCartBadge() {
    var els = document.querySelectorAll('.cart-count');
    var n = cartCount();
    for (var i = 0; i < els.length; i++) {
      els[i].textContent = n;
      els[i].classList.toggle('empty', n === 0);
    }
  }

  /* ---------------- toast ---------------- */
  var toastTimer = null;
  function toast(msg) {
    var el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2400);
  }

  /* ---------------- product card renderer ---------------- */
  function productCardHTML(catalog, p) {
    var priceParts = Number(p.price).toFixed(2).split('.');
    return '' +
      '<article class="p-card">' +
        (p.badge ? '<span class="p-badge' + (p.badge === 'Jackpot' || p.badge === '$1' ? ' gold' : '') + '">' + p.badge + '</span>' : '') +
        '<div class="art">' + artFor(p) + '</div>' +
        '<div class="info">' +
          '<div class="cat">' + categoryLabel(catalog, p.category) + '</div>' +
          '<h3><a href="product.html?id=' + encodeURIComponent(p.id) + '">' + p.name + '</a></h3>' +
          '<div class="row">' +
            '<div class="price">$' + priceParts[0] + '<span class="cents">.' + priceParts[1] + '</span></div>' +
            '<button class="add" data-add="' + p.id + '">+ Add</button>' +
          '</div>' +
        '</div>' +
      '</article>';
  }
  function bindAddButtons(root) {
    (root || document).querySelectorAll('[data-add]').forEach(function (btn) {
      if (btn._bound) return;
      btn._bound = true;
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        addToCart(btn.getAttribute('data-add'), 1);
        btn.classList.add('added');
        var prev = btn.textContent;
        btn.textContent = '✓ Added';
        setTimeout(function () { btn.classList.remove('added'); btn.textContent = prev; }, 1300);
        toast('Added to cart — ' + cartCount() + ' item' + (cartCount() === 1 ? '' : 's'));
      });
    });
  }

  /* ---------------- shared chrome (nav active state, menu, footer year, reveal) ---------------- */
  function initChrome() {
    var path = (location.pathname.split('/').pop() || 'index.html');
    document.querySelectorAll('.nav-links a, .mobile-menu a').forEach(function (a) {
      var href = a.getAttribute('href');
      if (href === path) a.classList.add('active');
    });

    var menuBtn = document.querySelector('.menu-btn');
    var menu = document.querySelector('.mobile-menu');
    var scrim = document.querySelector('.menu-scrim');
    function closeMenu() { if (menu) menu.classList.remove('open'); if (scrim) scrim.classList.remove('show'); }
    if (menuBtn && menu) {
      menuBtn.addEventListener('click', function () {
        menu.classList.add('open');
        if (scrim) scrim.classList.add('show');
      });
      var closeBtn = menu.querySelector('.close-menu');
      if (closeBtn) closeBtn.addEventListener('click', closeMenu);
      if (scrim) scrim.addEventListener('click', closeMenu);
      menu.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', closeMenu); });
    }

    var yr = document.getElementById('yr');
    if (yr) yr.textContent = new Date().getFullYear();

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -30px 0px' });
    document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });

    updateCartBadge();
  }

  /* ---------------- checkout API ---------------- */
  function apiCheckout(payload) {
    return fetch(API_BASE + '/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (r) {
      return r.json().catch(function () { throw new Error('Bad response from server'); }).then(function (data) {
        if (!r.ok) throw new Error(data.error || 'Checkout failed');
        return data;
      });
    });
  }

  global.Shop = {
    loadCatalog: loadCatalog,
    findProduct: findProduct,
    categoryLabel: categoryLabel,
    money: money,
    artFor: artFor,
    getCart: getCart,
    addToCart: addToCart,
    setQty: setQty,
    clearCart: clearCart,
    cartCount: cartCount,
    cartTotals: cartTotals,
    updateCartBadge: updateCartBadge,
    toast: toast,
    productCardHTML: productCardHTML,
    bindAddButtons: bindAddButtons,
    initChrome: initChrome,
    apiCheckout: apiCheckout,
    API_BASE: API_BASE
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChrome);
  } else {
    initChrome();
  }
})(window);
