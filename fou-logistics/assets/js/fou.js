/* ==========================================================================
   FOU LOGISTICS — behaviour
   --------------------------------------------------------------------------
   Design notes (see .claude/skills/emil-design-eng, .claude/skills/apple-design):
   • Where the browser supports scroll-driven animations, the journey runs
     entirely in CSS — off the main thread, so it stays smooth while the rest
     of the page is still doing work. JS only fills in for engines without it.
   • The fallback writes `transform` straight onto a handful of layers rather
     than updating a CSS custom property on a shared parent, which would
     force a style recalc across every child on every frame.
   • Nothing here blocks input, and every transition is interruptible.
   ========================================================================== */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)');

  var supportsScrollTimeline =
    typeof CSS !== 'undefined' &&
    CSS.supports &&
    (CSS.supports('animation-timeline: view()') ||
     CSS.supports('animation-timeline', 'view()'));

  if (!supportsScrollTimeline) root.classList.add('no-sda');

  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ------------------------------------------------------------------
     Header: translucent material engages once content scrolls under it.
     Driven by a sentinel + IntersectionObserver, not a scroll listener.
     ------------------------------------------------------------------ */
  (function header() {
    var el = $('.site-header');
    if (!el) return;

    var sentinel = document.createElement('div');
    sentinel.setAttribute('aria-hidden', 'true');
    sentinel.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:1px;pointer-events:none';
    document.body.prepend(sentinel);

    new IntersectionObserver(function (entries) {
      el.setAttribute('data-stuck', String(!entries[0].isIntersecting));
    }).observe(sentinel);
  })();

  /* ------------------------------------------------------------------
     Mobile navigation — origin-aware sheet, dismissible the ways people
     expect (Escape, outside click, choosing a link).
     ------------------------------------------------------------------ */
  (function nav() {
    var toggle = $('.nav-toggle');
    var list = $('.nav-links');
    if (!toggle || !list) return;

    var setOpen = function (open) {
      toggle.setAttribute('aria-expanded', String(open));
      list.setAttribute('data-open', String(open));
    };

    toggle.addEventListener('click', function () {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        setOpen(false);
        toggle.focus();
      }
    });

    document.addEventListener('click', function (e) {
      if (toggle.getAttribute('aria-expanded') !== 'true') return;
      if (!list.contains(e.target) && !toggle.contains(e.target)) setOpen(false);
    });

    list.addEventListener('click', function (e) {
      if (e.target.closest('a')) setOpen(false);
    });
  })();

  /* ------------------------------------------------------------------
     Scroll reveal — one-shot, and staggered 45ms within a group so a row
     of cards cascades instead of snapping in as a block.
     ------------------------------------------------------------------ */
  (function reveal() {
    var items = $$('[data-reveal]');
    if (!items.length) return;

    if (!('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });

    items.forEach(function (el) {
      var group = el.closest('[data-stagger]');
      if (group) {
        var peers = $$('[data-reveal]', group);
        var i = peers.indexOf(el);
        if (i > 0) el.style.setProperty('--reveal-delay', Math.min(i, 6) * 45 + 'ms');
      }
      io.observe(el);
    });
  })();

  /* ------------------------------------------------------------------
     The journey — fallback only.
     Progress maps to the window in which the sticky stage is pinned:
       p = -trackTop / (trackHeight - viewportHeight)
     which is exactly the CSS `contain 0% → contain 100%` range.
     ------------------------------------------------------------------ */
  (function journey() {
    var track = $('.journey-track');
    if (!track || supportsScrollTimeline || reduceMotion.matches) return;

    var stage  = $('.journey-stage', track);
    var layers = $$('.layer', track);
    var wheels = $$('.wheel', track);
    var caps   = $$('.cap', track);
    var acts   = $$('.act-rail li', track);
    var rigs   = $$('.rig', track);
    var dusk   = $('.sky-dusk', track);
    var stars  = $('.stars', track);

    var visible = false;
    var queued = false;

    // Ranges match the CSS keyframes so both paths tell the same story.
    var rigRange = { 'rig-truck': [[0.00, 0.17], [0.40, 0.80]], 'rig-van': [[0.80, 1.01]] };

    var within = function (p, ranges) {
      for (var i = 0; i < ranges.length; i++) {
        if (p >= ranges[i][0] && p <= ranges[i][1]) return true;
      }
      return false;
    };

    var draw = function () {
      queued = false;
      var rect = track.getBoundingClientRect();
      var travel = track.offsetHeight - window.innerHeight;
      var p = travel > 0 ? clamp(-rect.top / travel, 0, 1) : 0;

      layers.forEach(function (layer) {
        var span = layer.offsetWidth - stage.clientWidth;
        layer.style.transform = 'translate3d(' + (-span * p).toFixed(1) + 'px,0,0)';
      });

      var deg = (16 * 360 * p).toFixed(1);
      wheels.forEach(function (w) { w.style.transform = 'rotate(' + deg + 'deg)'; });

      if (dusk)  dusk.style.opacity  = clamp((p - 0.38) / 0.32, 0, 1).toFixed(3);
      if (stars) stars.style.opacity = (clamp((p - 0.52) / 0.30, 0, 1) * 0.75).toFixed(3);

      rigs.forEach(function (rig) {
        var key = rig.classList.contains('rig-van') ? 'rig-van' : 'rig-truck';
        rig.classList.toggle('is-on', within(p, rigRange[key]));
      });

      caps.forEach(function (cap) {
        var from = parseFloat(cap.style.getPropertyValue('--from')) / 100;
        var to   = parseFloat(cap.style.getPropertyValue('--to')) / 100;
        cap.classList.toggle('is-on', p >= from && p <= to);
      });

      acts.forEach(function (li) {
        var from = parseFloat(li.style.getPropertyValue('--from')) / 100;
        var to   = parseFloat(li.style.getPropertyValue('--to')) / 100;
        li.setAttribute('data-on', String(p >= from && p <= to));
      });
    };

    var request = function () {
      if (queued || !visible) return;
      queued = true;
      requestAnimationFrame(draw);
    };

    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible) request();
    }, { rootMargin: '120px 0px' }).observe(track);

    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', function () { visible = true; request(); }, { passive: true });
    draw();
  })();

  /* ------------------------------------------------------------------
     Act rail — fallback wiring only; the supported path is pure CSS.
     ------------------------------------------------------------------ */

  /* ------------------------------------------------------------------
     Counters. A number that lands is more legible than one that ticks
     forever: 900ms, strong ease-out, once.
     ------------------------------------------------------------------ */
  (function counters() {
    var nodes = $$('[data-count]');
    if (!nodes.length) return;

    var settle = function (el) {
      var target = parseFloat(el.getAttribute('data-count'));
      var decimals = (el.getAttribute('data-decimals') | 0);
      var prefix = el.getAttribute('data-prefix') || '';
      var suffix = el.getAttribute('data-suffix') || '';
      var render = function (v) {
        el.textContent = prefix + v.toLocaleString(undefined, {
          minimumFractionDigits: decimals, maximumFractionDigits: decimals
        }) + suffix;
      };

      if (reduceMotion.matches) { render(target); return; }

      var duration = 900;
      var start = performance.now();
      var step = function (now) {
        var t = clamp((now - start) / duration, 0, 1);
        // cubic-bezier(.23,1,.32,1) in spirit: fast out of the gate, soft landing
        var eased = 1 - Math.pow(1 - t, 3);
        render(target * eased);
        if (t < 1) requestAnimationFrame(step); else render(target);
      };
      requestAnimationFrame(step);
    };

    if (!('IntersectionObserver' in window)) { nodes.forEach(settle); return; }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        settle(entry.target);
        io.unobserve(entry.target);
      });
    }, { threshold: 0.5 });
    nodes.forEach(function (el) { io.observe(el); });
  })();

  /* ------------------------------------------------------------------
     Forms.
     There is no server behind this site yet, so rather than fake a
     submission the form composes a real, pre-filled email and hands it to
     the visitor's mail client. Swap in a POST endpoint via data-endpoint
     when a backend exists (see fou-logistics/README.md).
     ------------------------------------------------------------------ */
  (function forms() {
    var forms = $$('form[data-mailto]');
    if (!forms.length) return;

    var messageFor = function (input) {
      if (input.validity.valueMissing) return 'This one is required.';
      if (input.validity.typeMismatch) {
        return input.type === 'email' ? 'That does not look like an email address.'
                                      : 'Check the format of this field.';
      }
      if (input.validity.tooShort) return 'A little more detail, please.';
      if (input.validity.patternMismatch) return input.getAttribute('data-pattern-hint') || 'Check the format of this field.';
      return 'Please check this field.';
    };

    var validate = function (input) {
      var field = input.closest('.field');
      if (!field) return input.checkValidity();
      var ok = input.checkValidity();
      field.setAttribute('data-invalid', String(!ok));
      var slot = $('.error', field);
      if (slot) slot.textContent = ok ? '' : messageFor(input);
      return ok;
    };

    forms.forEach(function (form) {
      var controls = $$('input, select, textarea', form);

      controls.forEach(function (input) {
        // Validate as the visitor leaves a field, then keep it live once it
        // has been flagged — never surprise them only at submit time.
        input.addEventListener('blur', function () { validate(input); });
        input.addEventListener('input', function () {
          var field = input.closest('.field');
          if (field && field.getAttribute('data-invalid') === 'true') validate(input);
        });
      });

      form.addEventListener('submit', function (e) {
        e.preventDefault();

        var firstBad = null;
        controls.forEach(function (input) {
          if (!validate(input) && !firstBad) firstBad = input;
        });
        if (firstBad) {
          firstBad.focus({ preventScroll: true });
          firstBad.scrollIntoView({ block: 'center', behavior: reduceMotion.matches ? 'auto' : 'smooth' });
          return;
        }

        var data = new FormData(form);
        var lines = [];
        controls.forEach(function (input) {
          if (!input.name) return;
          var label = $('label[for="' + input.id + '"]', form);
          var name = label ? label.textContent.replace('*', '').trim() : input.name;
          lines.push(name + ': ' + (data.get(input.name) || '—'));
        });

        var subject = form.getAttribute('data-subject') || 'Website enquiry';
        var to = form.getAttribute('data-mailto');
        var href = 'mailto:' + to +
          '?subject=' + encodeURIComponent(subject) +
          '&body=' + encodeURIComponent(lines.join('\n'));

        var status = $('.form-status', form);
        if (status) {
          status.setAttribute('data-show', 'true');
          status.setAttribute('role', 'status');
        }
        window.location.href = href;
      });
    });
  })();

  /* ------------------------------------------------------------------
     Dispatch hours indicator — honest about the visitor's local clock.
     ------------------------------------------------------------------ */
  (function hours() {
    var el = $('[data-dispatch-status]');
    if (!el) return;
    var now = new Date();
    var day = now.getDay();            // 0 Sun … 6 Sat
    var hour = now.getHours() + now.getMinutes() / 60;
    var open = day >= 1 && day <= 5 ? hour >= 6 && hour < 20
             : day === 6            ? hour >= 8 && hour < 16
                                    : false;
    el.textContent = open ? 'Dispatch desk is open now' : 'Dispatch desk is closed — 24/7 line below';
    el.style.color = open ? 'var(--go)' : 'var(--dim)';
  })();

  /* ------------------------------------------------------------------
     Footer year.
     ------------------------------------------------------------------ */
  $$('[data-year]').forEach(function (el) { el.textContent = String(new Date().getFullYear()); });

  /* ------------------------------------------------------------------
     Pointer-fine only: subtle tilt on the hero badge. Decorative, so it
     is springy rather than pinned 1:1 to the cursor — and it is skipped
     entirely on touch and under reduced motion.
     ------------------------------------------------------------------ */
  (function tilt() {
    var el = $('[data-tilt]');
    if (!el || !fine.matches || reduceMotion.matches) return;

    var tx = 0, ty = 0, cx = 0, cy = 0, running = false;

    var loop = function () {
      // Critically-damped-ish approach: no overshoot, just an eased chase.
      cx += (tx - cx) * 0.12;
      cy += (ty - cy) * 0.12;
      el.style.transform = 'perspective(700px) rotateX(' + (-cy).toFixed(2) + 'deg) rotateY(' + cx.toFixed(2) + 'deg)';
      if (Math.abs(tx - cx) > 0.01 || Math.abs(ty - cy) > 0.01) {
        requestAnimationFrame(loop);
      } else {
        running = false;
      }
    };

    var kick = function () { if (!running) { running = true; requestAnimationFrame(loop); } };

    el.addEventListener('pointermove', function (e) {
      var r = el.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width - 0.5) * 10;
      ty = ((e.clientY - r.top) / r.height - 0.5) * 10;
      kick();
    });
    el.addEventListener('pointerleave', function () { tx = 0; ty = 0; kick(); });
  })();
})();
