/* NSEYIN — optional Google Analytics (GA4), only after the visitor says yes.
   It does nothing unless js/config.js has a gaMeasurementId like "G-ABC123XYZ". */
(function () {
  var cfg = window.NSEYIN_CONFIG || {}, id = cfg.gaMeasurementId;
  if (!id || !/^G-[A-Z0-9]{4,}$/.test(id)) return;
  var KEY = 'nseyin-analytics';
  var get = function () { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
  var set = function (v) { try { localStorage.setItem(KEY, v); } catch (e) {} };
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
  var loaded = false;
  function load() {
    if (loaded) return; loaded = true;
    gtag('consent', 'update', { analytics_storage: 'granted' });
    gtag('js', new Date());
    gtag('config', id, { allow_google_signals: false, allow_ad_personalization_signals: false });
    var s = document.createElement('script'); s.async = true; s.id = 'ga-script';
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id); document.head.appendChild(s);
  }
  function track(name, params) { if (loaded) gtag('event', name, params || {}); }
  document.addEventListener('nseyin:booking-sent', function (e) { track('booking_request_sent', { service: e.detail && e.detail.service }); });
  document.addEventListener('nseyin:contact-sent', function () { track('contact_message_sent'); });

  var bar = null;
  function closeBar() { if (bar) { bar.remove(); bar = null; } }
  function choose(v) { set(v); closeBar(); if (v === 'granted') load(); }
  function openBar() {
    if (bar) return;
    bar = document.createElement('div'); bar.className = 'consent'; bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'Analytics choice');
    var p = document.createElement('p');
    p.textContent = 'May we count visits with Google Analytics? It uses cookies and sends anonymous usage data to Google. It never sees your booking details. You can change your mind at any time.';
    var row = document.createElement('div'); row.className = 'btn-row';
    var yes = document.createElement('button'); yes.type = 'button'; yes.className = 'btn btn-ink btn-sm'; yes.textContent = 'Accept';
    var no = document.createElement('button'); no.type = 'button'; no.className = 'btn btn-outline btn-sm'; no.textContent = 'Decline';
    yes.addEventListener('click', function () { choose('granted'); }); no.addEventListener('click', function () { choose('denied'); });
    row.appendChild(yes); row.appendChild(no); bar.appendChild(p); bar.appendChild(row); document.body.appendChild(bar); yes.focus({ preventScroll: true });
  }
  var link = document.getElementById('cookie-choices');
  if (link) { link.hidden = false; link.addEventListener('click', openBar); }
  var saved = get();
  if (saved === 'granted') load(); else if (saved !== 'denied') openBar();
})();
