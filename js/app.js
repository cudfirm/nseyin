/* NSEYIN — UI behaviour: filters, service sheet, scroll-spy, floating button. No tracking, no storage. */
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var y = $('#year'); if (y) y.textContent = new Date().getFullYear();

  // Chip filters (services by goal, FAQ by topic)
  $$('[data-filter-for]').forEach(function (group) {
    var target = document.getElementById(group.getAttribute('data-filter-for'));
    if (!target) return;
    group.addEventListener('click', function (e) {
      var chip = e.target.closest('[data-filter]'); if (!chip) return;
      var f = chip.getAttribute('data-filter');
      $$('[data-filter]', group).forEach(function (c) { c.setAttribute('aria-pressed', c === chip ? 'true' : 'false'); });
      Array.prototype.forEach.call(target.children, function (item) {
        var keys = (item.getAttribute('data-tags') || item.getAttribute('data-cat') || '').split(' ');
        item.hidden = !(f === 'all' || keys.indexOf(f) > -1);
      });
    });
  });

  // Service detail sheet
  var sheet = $('#sheet');
  function openSheet(slug, opener) {
    var tpl = document.getElementById('tpl-' + slug); if (!tpl || !sheet) return;
    $('#sheet-title').textContent = tpl.getAttribute('data-title');
    var body = $('#sheet-body'); body.textContent = ''; body.appendChild(tpl.content.cloneNode(true));
    sheet._opener = opener || sheet._opener;
    if (!sheet.open) { if (sheet.showModal) sheet.showModal(); else sheet.setAttribute('open', ''); }
    body.scrollTop = 0;
    var c = $('[data-close]', sheet); if (c) c.focus();
  }
  function closeSheet() { if (sheet.open) sheet.close(); }
  if (sheet) {
    sheet.addEventListener('close', function () { var o = sheet._opener; sheet._opener = null; if (o && document.contains(o) && o.focus) o.focus(); });
    sheet.addEventListener('click', function (e) { if (e.target === sheet) closeSheet(); });
  }
  document.addEventListener('click', function (e) {
    var op = e.target.closest('[data-open]');
    if (op) { e.preventDefault(); openSheet(op.getAttribute('data-open'), sheet && sheet.open ? null : op); return; }
    if (e.target.closest('[data-close]')) { closeSheet(); return; }
    var bk = e.target.closest('[data-book]');
    if (bk && window.NSEYIN_BOOKING) {
      e.preventDefault(); closeSheet();
      window.NSEYIN_BOOKING.select(bk.getAttribute('data-book'));
      var b = document.getElementById('book'); if (b) b.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      if (history.replaceState) history.replaceState(null, '', '#book');
      return;
    }
    var oa = e.target.closest('[data-open-approach]'); if (oa) { /* normal anchor jump */ }
  });

  // Scroll-spy for the chip nav
  var links = $$('.chipnav a[href^="#"]');
  if (links.length && 'IntersectionObserver' in window) {
    var map = {}; links.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        links.forEach(function (a) { a.removeAttribute('aria-current'); });
        var a = map[en.target.id]; if (a) a.setAttribute('aria-current', 'true');
      });
    }, { rootMargin: '-35% 0px -55% 0px' });
    Object.keys(map).forEach(function (id) { var el = document.getElementById(id); if (el) io.observe(el); });
  }

  // Floating Book button: hidden while booking/contact is on screen; back-to-top after scrolling
  var fab = $('#fab'), top = $('#to-top');
  if (fab && 'IntersectionObserver' in window) {
    var hideFab = {};
    var io2 = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { hideFab[en.target.id] = en.isIntersecting; });
      fab.classList.toggle('away', Object.keys(hideFab).some(function (k) { return hideFab[k]; }));
    });
    ['book', 'top'].forEach(function (id) { var el = document.getElementById(id); if (el) io2.observe(el); });
  }
  if (top) {
    var tick = false;
    window.addEventListener('scroll', function () {
      if (tick) return; tick = true;
      requestAnimationFrame(function () { top.classList.toggle('show', window.scrollY > 900); tick = false; });
    }, { passive: true });
    top.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }); });
  }

  // Reveal on scroll
  var rv = $$('.reveal');
  if (rv.length && 'IntersectionObserver' in window && !reduce) {
    var io3 = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io3.unobserve(e.target); } }); }, { threshold: .08 });
    rv.forEach(function (el) { io3.observe(el); });
  } else rv.forEach(function (el) { el.classList.add('in'); });

  // Image fallback
  $$('img').forEach(function (im) { im.addEventListener('error', function () { im.style.visibility = 'hidden'; }, { once: true }); });
})();
