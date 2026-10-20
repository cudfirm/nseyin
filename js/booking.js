/* NSEYIN — guest booking request form (3 steps). Sends to a server-side function; stores nothing in the browser. */
(function () {
  var form = document.getElementById('booking-form');
  if (!form) return;
  var cfg = window.NSEYIN_CONFIG || {};
  var steps = Array.prototype.slice.call(form.querySelectorAll('.step'));
  var crumbs = Array.prototype.slice.call(document.querySelectorAll('#progress li'));
  var statusBox = document.getElementById('form-status');
  var current = 0, loadedAt = Date.now();
  var idemKey = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
  var SERVICES = {
    'deep-tissue': 'Deep Tissue Massage', 'swedish': 'Swedish Massage',
    'sports': 'Sports Massage', 'shiatsu': 'Shiatsu Massage', 'unsure': 'Not sure yet — advise me'
  };
  var DURATIONS = { '30': '30 minutes', '60': '1 hour', custom: 'Custom length, 15 minutes or more (price agreed with you)' };
  var LOCATIONS = { workspace: 'At the workspace (Boundary, Ajegunle, Lagos)', home: 'Home service (you cover transportation)', suite: 'Private suite (you cover transportation)' };
  var data = { prices: {}, slots: {} };
  try { data = JSON.parse(document.getElementById('site-data').textContent); } catch (e) {}
  var naira = function (n) { return '₦' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
  var TIMES = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening', flexible: 'Flexible' };
  var CONTACT = { email: 'Email', phone: 'Phone call', whatsapp: 'WhatsApp' };

  // Preselect service from ?service=
  var qs = new URLSearchParams(location.search).get('service');
  if (qs && SERVICES[qs]) { var r = form.querySelector('input[name="service"][value="' + qs + '"]'); if (r) r.checked = true; }

  // Date limits (local date, not UTC)
  var dateEl = form.elements.date;
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var fmt = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  var t = new Date(); t.setDate(t.getDate() + 1); dateEl.min = fmt(t);
  var m = new Date(); m.setDate(m.getDate() + 120); dateEl.max = fmt(m);

  function field(name) { var el = form.elements[name]; var n = el && el.length && !el.tagName ? el[0] : el; return n.closest('.field'); }
  function setError(name, msg) {
    var f = field(name), e = f.querySelector('.error-msg');
    f.classList.add('invalid'); e.textContent = msg;
    var inputs = form.querySelectorAll('[name="' + name + '"]');
    inputs.forEach(function (i) { i.setAttribute('aria-invalid', 'true'); i.setAttribute('aria-describedby', e.id); });
    return inputs[0];
  }
  function clearError(name) {
    var f = field(name); if (!f) return;
    f.classList.remove('invalid');
    form.querySelectorAll('[name="' + name + '"]').forEach(function (i) { i.removeAttribute('aria-invalid'); });
  }
  var validators = {
    service: function () { return form.querySelector('input[name="service"]:checked') ? '' : 'Please choose a service, or "Not sure yet".'; },
    name: function (v) { return v.trim().length >= 2 ? '' : 'Please enter your full name.'; },
    email: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? '' : 'Please enter a valid email address, e.g. name@example.com.'; },
    phone: function (v) { var d = v.replace(/[^\d]/g, ''); return (d.length >= 7 && d.length <= 15 && /^[+\d][\d\s\-()]*$/.test(v.trim())) ? '' : 'Please enter a phone number with 7–15 digits.'; },
    contactMethod: function () { return form.querySelector('input[name="contactMethod"]:checked') ? '' : 'Please choose how we should reach you.'; },
    date: function (v) { if (!v) return 'Please choose a preferred date.'; if (v < dateEl.min) return 'Please choose a date from tomorrow onward.'; if (v > dateEl.max) return 'Please choose a date within the next 4 months.'; return ''; },
    duration: function () { return form.querySelector('input[name="duration"]:checked') ? '' : 'Please choose how long you would like.'; },
    location: function () { return form.querySelector('input[name="location"]:checked') ? '' : 'Please choose where you would like the session.'; },
    time: function (v) { return v ? '' : 'Please choose a preferred time of day.'; },
    message: function (v) { return v.length <= 600 ? '' : 'Please keep your note under 600 characters.'; },
    terms: function () { return form.elements.terms.checked ? '' : 'Please accept the booking terms to continue.'; },
    boundaries: function () { return form.elements.boundaries.checked ? '' : 'Please confirm you have read the boundaries and consent policy.'; }
  };
  var stepFields = [['service', 'duration', 'location'], ['name', 'email', 'phone', 'contactMethod', 'date', 'time', 'message'], ['terms', 'boundaries']];

  function value(name) {
    var el = form.elements[name];
    if (el instanceof RadioNodeList) return el.value;
    return el.value;
  }
  function validateStep(i) {
    var first = null;
    stepFields[i].forEach(function (n) {
      clearError(n);
      var msg = validators[n](value(n) || '');
      if (msg) { var el = setError(n, msg); if (!first) first = el; }
    });
    if (first) { first.focus(); return false; }
    return true;
  }
  function show(i, user) {
    current = i;
    steps.forEach(function (s, k) { s.classList.toggle('active', k === i); });
    crumbs.forEach(function (c, k) {
      c.classList.toggle('current', k === i); c.classList.toggle('done', k < i);
      if (k === i) c.setAttribute('aria-current', 'step'); else c.removeAttribute('aria-current');
    });
    if (i === 2) renderReview();
    if (!user) return; // no focus/scroll on initial load
    var h = steps[i].querySelector('[data-step-title]'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    var top = document.getElementById('progress') || steps[i];
    top.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }
  // Used by service cards: preselect a service and show step 1 (so length and place can be chosen)
  window.NSEYIN_BOOKING = { select: function (slug) {
    var r = form.querySelector('input[name="service"][value="' + slug + '"]');
    if (r) { r.checked = true; clearError('service'); show(0, true); }
    else { var b = document.getElementById('book'); if (b) b.scrollIntoView(); }
  } };
  function priceText() {
    var d = value('duration'), sv = value('service'), loc = value('location');
    var needsDeposit = d === 'custom' || loc === 'home' || loc === 'suite';
    if (d === 'custom') return 'Agreed with you. A 30% deposit holds your time.';
    if (sv === 'unsure') return 'Depends on the service (' + naira(5000) + ' to ' + naira(14000) + '). We will confirm.' + (needsDeposit ? ' A 30% deposit holds your time.' : '');
    var p = data.prices[sv]; if (!(p && p[d])) return '—';
    return needsDeposit ? naira(p[d]) + ', with a 30% deposit (' + naira(Math.round(p[d] * 0.3)) + ') to hold your time' : naira(p[d]) + ' (paid after your appointment is confirmed)';
  }
  // Time-of-day choices follow the opening hours for the chosen date
  var timeEl = form.elements.time;
  function refreshTimes() {
    var keep = timeEl.value, d = dateEl.value.split('-'), opts = [['', 'Choose…']];
    if (d.length === 3) {
      var wd = String(new Date(+d[0], +d[1] - 1, +d[2]).getDay());
      opts = opts.concat(data.slots[wd] || []);
    } else { opts = opts.concat([['morning', 'Morning'], ['afternoon', 'Afternoon'], ['evening', 'Evening']]); }
    opts.push(['flexible', 'Flexible (any time we are open)']);
    timeEl.textContent = '';
    opts.forEach(function (o) { var op = document.createElement('option'); op.value = o[0]; op.textContent = o[1]; if (o[0] === keep) op.selected = true; timeEl.appendChild(op); });
  }
  dateEl.addEventListener('change', refreshTimes); refreshTimes();
  function renderReview() {
    var d = form.elements.date.value.split('-');
    var nice = d.length === 3 ? new Date(+d[0], +d[1] - 1, +d[2]).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '';
    var rows = [
      ['Service', SERVICES[value('service')]], ['Length', DURATIONS[value('duration')]], ['Where', LOCATIONS[value('location')]], ['Price', priceText()], ['Name', value('name').trim()], ['Email', value('email').trim()],
      ['Phone', value('phone').trim()], ['Contact by', CONTACT[value('contactMethod')]],
      ['Preferred date', nice], ['Preferred time', TIMES[value('time')]], ['Note', value('message').trim() || '—']
    ];
    var dl = document.getElementById('review'); dl.textContent = '';
    rows.forEach(function (r) {
      var div = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd');
      dt.textContent = r[0]; dd.textContent = r[1]; div.appendChild(dt); div.appendChild(dd); dl.appendChild(div);
    });
  }
  function status(kind, html) {
    statusBox.className = 'alert alert--' + kind; statusBox.hidden = false; statusBox.textContent = '';
    statusBox.appendChild(html); statusBox.focus();
  }
  function text(s) { var p = document.createElement('p'); p.style.margin = 0; p.textContent = s; return p; }

  form.addEventListener('click', function (e) {
    var b = e.target.closest('[data-next],[data-prev]'); if (!b) return;
    if (b.hasAttribute('data-next')) { if (validateStep(current)) show(current + 1, true); }
    else show(current - 1, true);
  });
  form.addEventListener('input', function (e) { if (e.target.name && field(e.target.name)) clearError(e.target.name); });
  form.addEventListener('change', function (e) { if (e.target.name && field(e.target.name)) clearError(e.target.name); });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (form.classList.contains('is-loading')) return; // block double-submit
    for (var i = 0; i < steps.length; i++) { if (!validateStep(i)) { show(i, true); return; } }
    if (!cfg.bookingEndpoint) {
      var w = document.createElement('div');
      w.appendChild(text('Online booking is not switched on yet, so nothing was sent. Please contact us directly using the details in the Contact section. (Site owner: set bookingEndpoint in js/config.js — see docs/SETUP.md.)'));
      status('warn', w); return;
    }
    var btn = form.querySelector('[type="submit"]'); form.classList.add('is-loading'); btn.disabled = true;
    var payload = {
      idempotencyKey: idemKey, service: value('service'), duration: value('duration'), location: value('location'), name: value('name').trim(), email: value('email').trim(),
      phone: value('phone').trim(), contactMethod: value('contactMethod'), date: value('date'), time: value('time'),
      message: value('message').trim(), acceptedTerms: true, acknowledgedBoundaries: true,
      website: form.elements.website.value, elapsedMs: Date.now() - loadedAt
    };
    var headers = { 'Content-Type': 'application/json' };
    if (cfg.supabaseAnonKey) { headers.apikey = cfg.supabaseAnonKey; headers.Authorization = 'Bearer ' + cfg.supabaseAnonKey; }
    var ctrl = new AbortController(), to = setTimeout(function () { ctrl.abort(); }, 20000);
    fetch(cfg.bookingEndpoint, { method: 'POST', headers: headers, body: JSON.stringify(payload), signal: ctrl.signal })
      .then(function (res) { return res.json().catch(function () { return {}; }).then(function (j) { return { ok: res.ok, status: res.status, body: j }; }); })
      .then(function (r) {
        if (r.ok && r.body && r.body.ok) {
          var c = document.createElement('div');
          c.appendChild(text('Thank you — your request has been received.'));
          c.appendChild(text('Reference: ' + (r.body.reference || '—') + '. This is a request, not a confirmed appointment. We will contact you by your chosen method to confirm or suggest another time.'));
          form.hidden = true; document.getElementById('progress').hidden = true; status('ok', c);
        } else if (r.status === 429) {
          status('error', text('Too many requests from this connection. Please wait a few minutes and try again, or contact us directly.'));
        } else if (r.status === 400 && r.body && r.body.errors) {
          var firstEl = null;
          Object.keys(r.body.errors).forEach(function (k) { if (form.elements[k]) { var el = setError(k, r.body.errors[k]); if (!firstEl) firstEl = el; } });
          status('error', text('Some details need fixing. Please check the highlighted fields.'));
          for (var s = 0; s < stepFields.length; s++) { if (stepFields[s].some(function (k) { return r.body.errors[k]; })) { show(s, true); break; } }
        } else {
          status('error', text('Sorry, we could not send your request. Nothing was saved. Please try again, or contact us directly.'));
        }
      })
      .catch(function () { status('error', text('Network problem — your request was not sent. Please check your connection and try again.')); })
      .finally(function () { clearTimeout(to); form.classList.remove('is-loading'); btn.disabled = false; });
  });

  document.documentElement.classList.add('js');
  show(0);
})();
