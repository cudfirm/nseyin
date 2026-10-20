/* NSEYIN staff admin. All access control is enforced by Supabase Auth + Row Level Security (see
   supabase/migrations). This file only presents data; hiding a button is never the security. */
(function () {
  'use strict';
  var cfg = window.NSEYIN_CONFIG || {};
  var $ = function (id) { return document.getElementById(id); };
  var STATUSES = ['new', 'contacted', 'confirmed', 'completed', 'cancelled', 'declined', 'no_show'];
  var STATUS_LABEL = { new: 'New', contacted: 'Contacted', confirmed: 'Confirmed', completed: 'Completed', cancelled: 'Cancelled', declined: 'Declined', no_show: 'No-show' };
  var SERVICE = { 'deep-tissue': 'Deep Tissue', swedish: 'Swedish', sports: 'Sports', shiatsu: 'Shiatsu', unsure: 'Not sure' };
  var LEN = { '30': '30 min', '60': '1 hour', custom: 'Custom length' };
  var WHERE = { workspace: 'Workspace', home: 'Home service', suite: 'Private suite' };
  function sess(b) { return SERVICE[b.service] + (b.duration ? ' · ' + LEN[b.duration] : '') + (b.session_location ? ' · ' + WHERE[b.session_location] : ''); }
  var TIME = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening', flexible: 'Flexible' };
  var METHOD = { email: 'Email', phone: 'Phone call', whatsapp: 'WhatsApp' };

  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey || !window.supabase) { $('config-warn').hidden = false; return; }
  var sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true } });

  var state = { tab: 'requests', role: null, bookings: [], customers: [], messages: [], user: null };

  // ---------- helpers (every dynamic value goes through textContent) ----------
  function h(tag, attrs) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'class') el.className = attrs[k]; else if (k === 'text') el.textContent = attrs[k];
      else if (k.indexOf('on') === 0) el.addEventListener(k.slice(2), attrs[k]); else if (attrs[k] !== false && attrs[k] != null) el.setAttribute(k, attrs[k]);
    });
    (function add(list) {
      list.forEach(function (c) {
        if (c == null || c === false) return;
        if (Array.isArray(c)) return add(c);
        el.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
      });
    })(Array.prototype.slice.call(arguments, 2));
    return el;
  }
  // Click-to-chat link for staff. Built from digits only; nothing is sent automatically.
  function waUrl(phone, name, ref) {
    var d = String(phone || '').replace(/\D/g, '');
    if (d.charAt(0) === '0' && d.length === 11) d = '234' + d.slice(1);
    if (d.length < 8) return null;
    var first = String(name || '').split(' ')[0] || 'there';
    return 'https://wa.me/' + d + '?text=' + encodeURIComponent('Hello ' + first + ', this is NSEYIN about your booking request ' + ref + '.');
  }
  function fmt(d) { return d ? new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—'; }
  function fmtDate(d) { return d ? new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '—'; }
  function badge(status) { return h('span', { class: 'st st-' + status, text: STATUS_LABEL[status] || status }); }
  function msg(box, kind, text) { box.className = 'alert alert--' + kind; box.textContent = text; box.hidden = false; }
  function clearMsg(box) { box.hidden = true; box.textContent = ''; }
  function errText(e) { return (e && e.message) ? e.message : 'Something went wrong.'; }
  function toLocalInput(iso) { if (!iso) return ''; var d = new Date(iso); var p = function (n) { return (n < 10 ? '0' : '') + n; }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes()); }
  function field(label, input, id) { return h('div', { class: 'field' }, h('label', { for: id, text: label }), input); }

  // ---------- auth ----------
  function showLogin(text) { $('app').hidden = true; $('who').hidden = true; $('login').hidden = false; if (text) msg($('login-msg'), 'error', text); else clearMsg($('login-msg')); }
  async function enter(session) {
    state.user = session.user;
    var r = await sb.rpc('my_role');
    if (r.error || !r.data) { await sb.auth.signOut(); showLogin('This account does not have staff access.'); return; }
    state.role = r.data;
    $('who-text').textContent = session.user.email + ' (' + state.role + ')';
    $('who').hidden = false; $('login').hidden = true; $('app').hidden = false;
    $('export').hidden = state.role !== 'owner';
    await loadAll(); armIdle();
  }
  $('login-form').addEventListener('submit', async function (e) {
    e.preventDefault(); var f = e.target, btn = f.querySelector('button'); clearMsg($('login-msg'));
    if (!$('l-email').value.trim() || !$('l-pass').value) { msg($('login-msg'), 'error', 'Enter your email and password.'); return; }
    f.classList.add('is-loading'); btn.disabled = true;
    var r = await sb.auth.signInWithPassword({ email: $('l-email').value.trim(), password: $('l-pass').value });
    f.classList.remove('is-loading'); btn.disabled = false; $('l-pass').value = '';
    if (r.error) { msg($('login-msg'), 'error', 'Sign-in failed. Check your details and try again.'); return; }
    enter(r.data.session);
  });
  $('signout').addEventListener('click', async function () { await sb.auth.signOut(); state.bookings = state.customers = state.messages = []; showLogin(); });
  var idleTimer; function armIdle() {
    var reset = function () { clearTimeout(idleTimer); idleTimer = setTimeout(async function () { await sb.auth.signOut(); showLogin('You were signed out after 30 minutes of inactivity.'); }, 30 * 60 * 1000); };
    ['click', 'keydown', 'pointerdown'].forEach(function (ev) { document.addEventListener(ev, reset, { passive: true }); }); reset();
  }

  // ---------- data ----------
  async function loadAll() {
    $('list-status').textContent = 'Loading…';
    var b = await sb.from('bookings').select('*, customers(*)').order('created_at', { ascending: false }).limit(1000);
    var c = await sb.from('customers').select('*, bookings(id, status, created_at)').order('created_at', { ascending: false }).limit(1000);
    var m = await sb.from('contact_messages').select('*').order('created_at', { ascending: false }).limit(300);
    if (b.error || c.error || m.error) { $('list-status').textContent = 'Could not load data: ' + errText(b.error || c.error || m.error); return; }
    state.bookings = b.data; state.customers = c.data; state.messages = m.data;
    $('count-new').textContent = state.bookings.filter(function (x) { return x.status === 'new'; }).length;
    $('count-msg').textContent = state.messages.filter(function (x) { return !x.handled; }).length;
    render();
  }

  // ---------- list rendering ----------
  function matches(q, parts) { if (!q) return true; q = q.toLowerCase(); return parts.some(function (p) { return (p || '').toLowerCase().indexOf(q) !== -1; }); }
  function render() {
    ['requests', 'bookings', 'customers', 'messages'].forEach(function (t) { $('tab-' + t).setAttribute('aria-selected', String(t === state.tab)); });
    var q = $('q').value.trim(), sf = $('status-filter').value, list = $('list'); list.textContent = '';
    $('status-filter').disabled = state.tab === 'customers' || state.tab === 'messages' || state.tab === 'requests';
    if (state.tab === 'requests' || state.tab === 'bookings') {
      var rows = state.bookings.filter(function (b) {
        if (state.tab === 'requests' && b.status !== 'new') return false;
        if (state.tab === 'bookings' && sf && b.status !== sf) return false;
        var c = b.customers || {}; return matches(q, [b.reference, c.full_name, c.email, c.phone]);
      });
      $('list-status').textContent = rows.length + ' shown';
      list.appendChild(table(['Reference', 'Received', 'Customer', 'Service', 'Preferred', 'Status', 'Scheduled'], rows.map(function (b) {
        var c = b.customers || {};
        return { open: function () { openBooking(b.id); }, label: 'Open booking ' + b.reference, cells: [b.reference, fmt(b.created_at), c.full_name || '—', sess(b), fmtDate(b.preferred_date) + ', ' + TIME[b.preferred_time], badge(b.status), fmt(b.scheduled_at)] };
      }), 'No bookings match.'));
    } else if (state.tab === 'customers') {
      var cs = state.customers.filter(function (c) { return matches(q, [c.full_name, c.email, c.phone]); });
      $('list-status').textContent = cs.length + ' shown';
      list.appendChild(table(['Name', 'Email', 'Phone', 'Bookings', 'Since'], cs.map(function (c) {
        var n = (c.bookings || []).length;
        return { open: function () { openCustomer(c.id); }, label: 'Open customer ' + c.full_name, cells: [c.full_name + (n > 1 ? '  ·  repeat' : ''), c.email || '—', c.phone || '—', String(n), fmt(c.created_at)] };
      }), 'No customers match.'));
    } else {
      var ms = state.messages.filter(function (m) { return matches(q, [m.name, m.email, m.message]); });
      $('list-status').textContent = ms.length + ' shown';
      list.appendChild(table(['Received', 'Name', 'Email', 'Message', 'Handled'], ms.map(function (m) {
        return { open: function () { openMessage(m.id); }, label: 'Open message from ' + m.name, cells: [fmt(m.created_at), m.name, m.email, m.message.length > 80 ? m.message.slice(0, 80) + '…' : m.message, m.handled ? 'Yes' : 'No'] };
      }), 'No messages.'));
    }
  }
  function table(heads, rows, empty) {
    if (!rows.length) return h('p', { style: 'padding:1.2rem', text: empty });
    var tb = h('tbody');
    rows.forEach(function (r) {
      var tr = h('tr', { tabindex: '0', role: 'button', 'aria-label': r.label, onclick: r.open, onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); r.open(); } } });
      r.cells.forEach(function (c) { tr.appendChild(h('td', {}, c)); }); tb.appendChild(tr);
    });
    return h('table', { class: 'adm-table' }, h('thead', {}, h('tr', {}, heads.map(function (x) { return h('th', { scope: 'col', text: x }); }))), tb);
  }
  document.querySelectorAll('[data-tab]').forEach(function (b) { b.addEventListener('click', function () { state.tab = b.dataset.tab; render(); }); });
  $('q').addEventListener('input', render); $('status-filter').addEventListener('change', render); $('refresh').addEventListener('click', loadAll);

  // ---------- detail dialog ----------
  var dlg = $('detail');
  function openDialog(title) { $('detail-title').textContent = title; clearMsg($('detail-msg')); $('detail-body').textContent = ''; if (!dlg.open) dlg.showModal(); }
  $('close-detail').addEventListener('click', function () { dlg.close(); });

  async function openBooking(id) {
    var b = state.bookings.find(function (x) { return x.id === id; }); if (!b) return;
    openDialog('Booking ' + b.reference);
    var ev = await sb.from('booking_events').select('*').eq('booking_id', id).order('created_at', { ascending: true });
    var nl = await sb.from('notification_log').select('*').eq('booking_id', id).order('created_at', { ascending: true });
    var prior = state.bookings.filter(function (x) { return x.customer_id === b.customer_id && x.id !== id; });
    var body = $('detail-body');
    var grid = h('div', { class: 'dgrid' });
    // Booking box
    var st = h('select', { id: 'b-status' }); STATUSES.forEach(function (s) { var o = h('option', { value: s, text: STATUS_LABEL[s] }); if (s === b.status) o.selected = true; st.appendChild(o); });
    var sched = h('input', { id: 'b-sched', type: 'datetime-local', value: toLocalInput(b.scheduled_at) });
    var save = h('button', { class: 'btn btn-primary btn-sm', type: 'button', text: 'Save booking', onclick: async function () {
      var s = st.value, when = sched.value ? new Date(sched.value).toISOString() : null;
      if (s === 'confirmed' && !when) { msg($('detail-msg'), 'error', 'Set the agreed date and time before marking a booking as confirmed.'); return; }
      save.disabled = true; var r = await sb.from('bookings').update({ status: s, scheduled_at: when }).eq('id', id); save.disabled = false;
      if (r.error) { msg($('detail-msg'), 'error', 'Could not save: ' + errText(r.error)); return; }
      msg($('detail-msg'), 'ok', 'Booking saved.'); await loadAll(); openBooking(id);
    } });
    grid.appendChild(h('div', { class: 'dbox' }, h('h3', { text: 'Booking' }),
      h('p', {}, badge(b.status), ' ', h('span', { class: 'hint', text: 'Received ' + fmt(b.created_at) })),
      h('p', { text: sess(b) + ' · prefers ' + fmtDate(b.preferred_date) + ', ' + TIME[b.preferred_time] }),
      h('p', { text: 'Note from customer: ' + (b.message || '—') }),
      (b.customers && waUrl(b.customers.phone, b.customers.full_name, b.reference)) ? h('p', {}, h('a', { class: 'btn btn-outline btn-sm', id: 'wa-link', href: waUrl(b.customers.phone, b.customers.full_name, b.reference), target: '_blank', rel: 'noopener noreferrer', text: 'Message on WhatsApp' })) : null,
      h('p', { class: 'hint', text: 'Terms accepted ' + fmt(b.terms_accepted_at) + ' · boundaries acknowledged ' + fmt(b.boundaries_acknowledged_at) + ' (' + b.terms_version + ')' }),
      field('Status', st, 'b-status'), field('Agreed date & time (your local time)', sched, 'b-sched'), save));
    // Customer box
    grid.appendChild(customerBox(b.customers, function () { return openBooking(id); }));
    body.appendChild(grid);
    // History
    var tl = h('ul', { class: 'timeline' });
    (ev.data || []).forEach(function (e) {
      var text = e.kind === 'status_change' ? 'Status: ' + STATUS_LABEL[e.from_status] + ' → ' + STATUS_LABEL[e.to_status] : e.kind === 'created' ? 'Request received' : (e.kind === 'contact_attempt' ? 'Contact attempt: ' : 'Note: ') + (e.body || '');
      tl.appendChild(h('li', {}, h('time', { text: fmt(e.created_at) }), text));
    });
    if (!tl.children.length) tl.appendChild(h('li', { text: 'No history yet.' }));
    var kind = h('select', { id: 'ev-kind' }, h('option', { value: 'contact_attempt', text: 'Contact attempt' }), h('option', { value: 'note', text: 'Note' }));
    var txt = h('textarea', { id: 'ev-text', maxlength: '2000', rows: '3' });
    var add = h('button', { class: 'btn btn-outline btn-sm', type: 'button', text: 'Add to history', onclick: async function () {
      if (!txt.value.trim()) { msg($('detail-msg'), 'error', 'Write something first.'); return; }
      add.disabled = true; var r = await sb.from('booking_events').insert({ booking_id: id, customer_id: b.customer_id, kind: kind.value, body: txt.value.trim(), created_by: state.user.id }); add.disabled = false;
      if (r.error) { msg($('detail-msg'), 'error', 'Could not add: ' + errText(r.error)); return; }
      openBooking(id);
    } });
    var g2 = h('div', { class: 'dgrid', style: 'margin-top:1.2rem' });
    g2.appendChild(h('div', { class: 'dbox' }, h('h3', { text: 'History' }), tl, field('Log a contact attempt or note', h('div', {}, kind, txt), 'ev-text'), add));
    var nbox = h('div', { class: 'dbox' }, h('h3', { text: 'Emails' }));
    if ((nl.data || []).length) { var nt = h('table', { class: 'mini' }); nl.data.forEach(function (n) { nt.appendChild(h('tr', {}, h('td', { text: n.kind.replace(/_/g, ' ') }), h('td', { text: n.status }), h('td', { text: n.error || '' }))); }); nbox.appendChild(nt); nbox.appendChild(h('p', { class: 'hint', text: '“sent” means the email provider accepted it. It does not guarantee delivery.' })); }
    else nbox.appendChild(h('p', { text: 'No email records.' }));
    nbox.appendChild(h('h3', { text: 'Customer’s other bookings', style: 'margin-top:1rem' }));
    if (prior.length) { var pt = h('table', { class: 'mini' }); prior.forEach(function (p) { pt.appendChild(h('tr', { tabindex: '0', onclick: function () { openBooking(p.id); }, onkeydown: function (e) { if (e.key === 'Enter') openBooking(p.id); }, style: 'cursor:pointer' }, h('td', { text: p.reference }), h('td', { text: SERVICE[p.service] }), h('td', {}, badge(p.status)), h('td', { text: fmtDate(p.preferred_date) }))); }); nbox.appendChild(pt); }
    else nbox.appendChild(h('p', { text: 'First booking from this customer.' }));
    g2.appendChild(nbox); body.appendChild(g2);
  }

  function customerBox(c, reopen) {
    var name = h('input', { id: 'c-name', type: 'text', maxlength: '100', value: c.full_name || '' });
    var email = h('input', { id: 'c-email', type: 'email', maxlength: '160', value: c.email || '' });
    var phone = h('input', { id: 'c-phone', type: 'tel', maxlength: '30', value: c.phone || '' });
    var pref = h('select', { id: 'c-pref' }, h('option', { value: '', text: '—' })); Object.keys(METHOD).forEach(function (k) { var o = h('option', { value: k, text: METHOD[k] }); if (k === c.preferred_contact) o.selected = true; pref.appendChild(o); });
    var notes = h('textarea', { id: 'c-notes', maxlength: '4000', rows: '3' }); notes.value = c.admin_notes || '';
    var save = h('button', { class: 'btn btn-primary btn-sm', type: 'button', text: 'Save customer', onclick: async function () {
      if (name.value.trim().length < 1) { msg($('detail-msg'), 'error', 'Name is required.'); return; }
      save.disabled = true;
      var r = await sb.from('customers').update({ full_name: name.value.trim(), email: email.value.trim() || null, phone: phone.value.trim() || null, preferred_contact: pref.value || null, admin_notes: notes.value.trim() || null }).eq('id', c.id);
      save.disabled = false; if (r.error) { msg($('detail-msg'), 'error', 'Could not save: ' + errText(r.error)); return; }
      msg($('detail-msg'), 'ok', 'Customer saved.'); await loadAll(); reopen();
    } });
    var box = h('div', { class: 'dbox' }, h('h3', { text: 'Customer' }),
      c.anonymised_at ? h('p', { class: 'alert alert--warn', text: 'This customer was anonymised on ' + fmt(c.anonymised_at) + '.' }) : null,
      field('Name', name, 'c-name'), field('Email', email, 'c-email'), field('Phone', phone, 'c-phone'), field('Preferred contact', pref, 'c-pref'), field('Private admin notes (never shown to the customer)', notes, 'c-notes'), save);
    if (state.role === 'owner' && !c.anonymised_at) {
      box.appendChild(h('button', { class: 'btn btn-outline btn-sm danger', type: 'button', style: 'margin-left:.6rem', text: 'Anonymise (owner)', onclick: async function () {
        if (!confirm('Anonymise this customer? Their name, email, phone, notes and message text will be permanently removed. Booking dates and statuses are kept. This cannot be undone.')) return;
        var r = await sb.rpc('anonymise_customer', { p_customer: c.id });
        if (r.error) { msg($('detail-msg'), 'error', 'Could not anonymise: ' + errText(r.error)); return; }
        dlg.close(); loadAll();
      } }));
    }
    return box;
  }

  async function openCustomer(id) {
    var c = state.customers.find(function (x) { return x.id === id; }); if (!c) return;
    openDialog(c.full_name);
    var mine = state.bookings.filter(function (b) { return b.customer_id === id; });
    var body = $('detail-body'), grid = h('div', { class: 'dgrid' });
    grid.appendChild(customerBox(c, function () { return openCustomer(id); }));
    var box = h('div', { class: 'dbox' }, h('h3', { text: 'Booking history (' + mine.length + ')' }));
    if (mine.length) { var t = h('table', { class: 'mini' }); mine.forEach(function (b) { t.appendChild(h('tr', { tabindex: '0', style: 'cursor:pointer', onclick: function () { openBooking(b.id); }, onkeydown: function (e) { if (e.key === 'Enter') openBooking(b.id); } }, h('td', { text: b.reference }), h('td', { text: SERVICE[b.service] }), h('td', {}, badge(b.status)), h('td', { text: fmtDate(b.preferred_date) }))); }); box.appendChild(t); }
    else box.appendChild(h('p', { text: 'No bookings.' }));
    grid.appendChild(box); body.appendChild(grid);
  }

  function openMessage(id) {
    var m = state.messages.find(function (x) { return x.id === id; }); if (!m) return;
    openDialog('Message from ' + m.name);
    var done = h('button', { class: 'btn btn-primary btn-sm', type: 'button', text: m.handled ? 'Mark as not handled' : 'Mark as handled', onclick: async function () {
      var r = await sb.from('contact_messages').update({ handled: !m.handled }).eq('id', id);
      if (r.error) { msg($('detail-msg'), 'error', 'Could not update: ' + errText(r.error)); return; } dlg.close(); loadAll();
    } });
    $('detail-body').appendChild(h('div', { class: 'dbox' }, h('p', { class: 'hint', text: fmt(m.created_at) }), h('p', {}, h('strong', { text: m.name }), ' · ', h('a', { href: 'mailto:' + m.email, text: m.email })), h('p', { style: 'white-space:pre-wrap', text: m.message }), done));
  }

  // ---------- owner export ----------
  function csvCell(v) {
    var s = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // neutralise spreadsheet formula injection
    return '"' + s.replace(/"/g, '""') + '"';
  }
  $('export').addEventListener('click', async function () {
    if (!confirm('Export all booking and customer records to a CSV file? It contains personal data; store it securely and delete it when no longer needed.')) return;
    var r = await sb.rpc('export_bookings');
    if (r.error) { $('list-status').textContent = 'Export refused: ' + errText(r.error); return; }
    var cols = ['reference', 'status', 'service', 'duration', 'session_location', 'preferred_date', 'preferred_time', 'scheduled_at', 'created_at', 'full_name', 'email', 'phone'];
    var csv = [cols.join(',')].concat(r.data.map(function (row) { return cols.map(function (c) { return csvCell(row[c]); }).join(','); })).join('\r\n');
    var a = h('a', { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: 'nseyin-bookings-' + new Date().toISOString().slice(0, 10) + '.csv' });
    document.body.appendChild(a); a.click(); a.remove();
  });

  // ---------- start ----------
  sb.auth.getSession().then(function (r) { if (r.data.session) enter(r.data.session); else showLogin(); });
})();
