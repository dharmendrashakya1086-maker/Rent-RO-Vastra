/* Modern feel: scroll reveals, stat count-up, denser header on scroll, pointer-tracked card glow, back-to-top.
   ponytail: no framework, no build step, one file. Delete the file (and its <script> tags) to remove the whole effect. */
(function () {
  'use strict';
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var GLOW = '.card, .cat-card, .ugc-card, .look-card';
  var REVEAL = GLOW + ', .stat, .faq-item, .step, .feature, section h2, .section-title';

  // 1. reveal only what starts below the fold (above-fold stays instant, no flash)
  if (!reduced && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });

    [].slice.call(document.querySelectorAll(REVEAL)).forEach(function (el, i) {
      if (el.getBoundingClientRect().top < innerHeight * 0.92) return;
      el.classList.add('reveal');
      el.style.transitionDelay = (i % 4) * 70 + 'ms'; // gentle stagger, capped
      io.observe(el);
    });
  }

  // 2. stats roll up when they scroll into view
  if (!reduced) {
    [].slice.call(document.querySelectorAll('.stat-num')).forEach(function (el) {
      var raw = el.textContent.trim();
      var m = raw.match(/^(\d[\d,]*)/);
      if (!m) return;
      var end = +m[1].replace(/,/g, '');
      var suffix = raw.slice(m[1].length);
      if (end < 2) return;
      var t0 = null;
      var sio = new IntersectionObserver(function (entries) {
        if (!entries[0].isIntersecting) return;
        sio.disconnect();
        var roll = function (ts) {
          if (!t0) t0 = ts;
          var p = Math.min(1, (ts - t0) / 1200);
          el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3))).toLocaleString('en-IN') + suffix;
          if (p < 1) requestAnimationFrame(roll);
        };
        requestAnimationFrame(roll);
      }, { threshold: 0.4 });
      sio.observe(el);
    });
  }

  // 3. header densifies on scroll + back-to-top button
  var header = document.querySelector('.main-header');
  var top = document.createElement('button');
  top.className = 'to-top';
  top.type = 'button';
  top.setAttribute('aria-label', 'Back to top');
  top.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 4l-8 8 1.4 1.4L11 8.8V20h2V8.8l5.6 4.6L20 12z"/></svg>';
  document.body.appendChild(top);
  top.addEventListener('click', function () {
    scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  });
  var onScroll = function () {
    var y = scrollY;
    if (header) header.classList.toggle('solid', y > 20);
    top.classList.toggle('show', y > 700);
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // 4. spotlight follows the cursor on cards
  if (!reduced && matchMedia('(hover: hover)').matches) {
    document.addEventListener('pointermove', function (e) {
      var el = e.target.closest && e.target.closest(GLOW);
      if (!el) return;
      var r = el.getBoundingClientRect();
      el.style.setProperty('--mx', e.clientX - r.left + 'px');
      el.style.setProperty('--my', e.clientY - r.top + 'px');
    }, { passive: true });
  }
})();
