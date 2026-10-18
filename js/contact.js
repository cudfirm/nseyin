/* NSEYIN — contact form. Same principles as booking.js: validate, send to server function, no browser storage. */
(function () {
  var form = document.getElementById('contact-form');
  if (!form) return;
  var cfg = window.NSEYIN_CONFIG || {};
  var box = document.getElementById('contact-status');
  var loadedAt = Date.now();
  var key = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
  function err(name, msg) { var f = form.elements[name].closest('.field'); f.classList.add('invalid'); f.querySelector('.error-msg').textContent = msg; form.elements[name].setAttribute('aria-invalid', 'true'); return form.elements[name]; }
  function keep(a, b) { return a || b; }
  function clr(name) { var el = form.elements[name]; el.closest('.field').classList.remove('invalid'); el.removeAttribute('aria-invalid'); }
  function say(kind, msg) { box.className = 'alert alert--' + kind; box.hidden = false; box.textContent = msg; box.focus(); }
  form.addEventListener('input', function (e) { if (e.target.name && form.elements[e.target.name] && e.target.closest('.field')) clr(e.target.name); });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (form.classList.contains('is-loading')) return;
    ['name', 'email', 'message'].forEach(clr);
    var first = null, v = function (n) { return form.elements[n].value.trim(); };
    if (v('name').length < 2) first = keep(first, err('name', 'Please enter your name.'));
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v('email'))) first = keep(first, err('email', 'Please enter a valid email address.'));
    if (v('message').length < 10) first = keep(first, err('message', 'Please write a short message (at least 10 characters).'));
    if (v('message').length > 1500) first = keep(first, err('message', 'Please keep your message under 1500 characters.'));
    if (first) { first.focus(); return; }
    if (!cfg.contactEndpoint) { say('warn', 'The contact form is not switched on yet, so nothing was sent. Please use the contact details on this page. (Site owner: set contactEndpoint in js/config.js.)'); return; }
    var btn = form.querySelector('[type="submit"]'); form.classList.add('is-loading'); btn.disabled = true;
    var headers = { 'Content-Type': 'application/json' };
    if (cfg.supabaseAnonKey) { headers.apikey = cfg.supabaseAnonKey; headers.Authorization = 'Bearer ' + cfg.supabaseAnonKey; }
    var ctrl = new AbortController(), to = setTimeout(function () { ctrl.abort(); }, 20000);
    fetch(cfg.contactEndpoint, { method: 'POST', headers: headers, signal: ctrl.signal,
      body: JSON.stringify({ idempotencyKey: key, name: v('name'), email: v('email'), message: v('message'), website: form.elements.website.value, elapsedMs: Date.now() - loadedAt }) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, status: r.status, body: j }; }); })
      .then(function (r) {
        if (r.ok && r.body && r.body.ok) { form.reset(); say('ok', 'Thank you — your message has been received. We will reply by email.'); }
        else if (r.status === 429) say('error', 'Too many requests. Please wait a few minutes and try again.');
        else say('error', 'Sorry, we could not send your message. Nothing was saved. Please try again or use the contact details on this page.');
      })
      .catch(function () { say('error', 'Network problem — your message was not sent. Please try again.'); })
      .finally(function () { clearTimeout(to); form.classList.remove('is-loading'); btn.disabled = false; });
  });
})();
