// Mobile nav toggle
document.addEventListener('DOMContentLoaded', function () {
  var toggle = document.querySelector('.nav-toggle');
  var links = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', function () {
      links.classList.toggle('open');
    });
  }

  var yearEl = document.querySelector('[data-year]');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Open/closed badges, based on the visitor's own clock (not chasing Pacific time
  // across a page load just for a badge — close enough for "should I go now?").
  var hours = {
    henderson: { 0: [7, 21], 1: [6, 20], 2: [6, 20], 3: [6, 20], 4: [6, 20], 5: [6, 20], 6: [7, 21] },
    vegas:     { 0: [8, 19], 1: [7, 19], 2: [7, 19], 3: [7, 19], 4: [7, 19], 5: [7, 19], 6: [7, 19] }
  };

  document.querySelectorAll('[data-hours]').forEach(function (el) {
    var key = el.getAttribute('data-hours');
    var range = hours[key];
    if (!range) return;
    var now = new Date();
    var todayRange = range[now.getDay()];
    var openNow = now.getHours() + now.getMinutes() / 60;
    var isOpen = openNow >= todayRange[0] && openNow < todayRange[1];
    el.textContent = isOpen ? 'Open now' : 'Closed now';
    el.classList.add(isOpen ? 'tag-open' : 'tag-closed');
  });
});
