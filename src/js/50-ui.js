/* ═══ FICHES · composants d’interface ═══ */
'use strict';
var UI = (function () {
  /* ── notifications ── */
  var toastBox = null;
  function toast(msg, kind, ms) {
    if (!toastBox) { toastBox = h('div', { class: 'toasts', 'aria-live': 'polite' }); document.body.appendChild(toastBox); }
    var t = h('div', { class: 'toast ' + (kind || '') }, msg);
    toastBox.appendChild(t);
    setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 300); }, ms || (kind === 'err' ? 6000 : 2800));
  }

  /* ── fenêtres modales ── */
  var stack = [];
  function modal(opt) {
    var body = h('div', { class: 'modal-body' }, opt.body);
    var foot = h('div', { class: 'modal-foot' });
    var box = h('div', { class: 'modal' + (opt.wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': opt.title || '' },
      h('div', { class: 'modal-head' }, h('h3', null, opt.title || ''), h('button', { class: 'icon-btn', 'aria-label': 'Fermer', onclick: function () { api.close(); } }, '✕')),
      body, foot);
    var back = h('div', { class: 'modal-back', onmousedown: function (e) { if (e.target === back && !opt.sticky) api.close(); } }, box);
    var api = { el: box, body: body, closed: false, close: function (v) { if (api.closed) return; api.closed = true; back.remove(); stack = stack.filter(function (x) { return x !== api; }); if (opt.onClose) opt.onClose(v); } };
    (opt.actions || []).forEach(function (a) {
      foot.appendChild(h('button', { class: 'btn ' + (a.kind || ''), type: 'button', onclick: function () { var r = a.onClick ? a.onClick(api) : null; if (r !== false && !a.keep) api.close(a.value); } }, a.label));
    });
    if (!(opt.actions || []).length) foot.remove();
    document.body.appendChild(back); stack.push(api);
    var first = $('input:not([type=checkbox]),textarea,select', box); if (first && !opt.noFocus) setTimeout(function () { try { first.focus(); } catch (e) { /* ignoré */ } }, 30);
    return api;
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && stack.length) { var m = stack[stack.length - 1]; m.close(); } });

  function ask(message, opt) {
    opt = opt || {};
    return new Promise(function (res) {
      var done = false;
      modal({ title: opt.title || 'Confirmation', body: h('p', { class: 'ask-msg' }, message), onClose: function () { if (!done) res(false); },
        actions: [{ label: 'Annuler', kind: 'ghost', onClick: function () { done = true; res(false); } }, { label: opt.ok || 'Confirmer', kind: opt.danger ? 'danger' : 'primary', onClick: function () { done = true; res(true); } }] });
    });
  }
  function promptText(title, opt) {
    opt = opt || {};
    return new Promise(function (res) {
      var done = false;
      var inp = opt.multiline ? h('textarea', { rows: 8, placeholder: opt.placeholder || '', class: 'inp' }) : h('input', { type: 'text', class: 'inp', placeholder: opt.placeholder || '' });
      inp.value = opt.value || '';
      var body = h('div', null, opt.help ? h('p', { class: 'muted' }, opt.help) : null, inp);
      function ok(api) { done = true; res(inp.value); api.close(); return false; }
      var m = modal({ title: title, body: body, onClose: function () { if (!done) res(null); },
        actions: [{ label: 'Annuler', kind: 'ghost', onClick: function () { done = true; res(null); } }, { label: opt.ok || 'Valider', kind: 'primary', onClick: ok }] });
      if (!opt.multiline) inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); ok(m); } });
    });
  }

  /* ── tri par glisser-déposer (souris + tactile) ── */
  function sortable(container, opt) {
    var drag = null;
    container.addEventListener('pointerdown', function (e) {
      var grip = e.target.closest(opt.handle || '.grip'); if (!grip || !container.contains(grip)) return;
      var item = grip.closest(opt.item || '.sort-item'); if (!item || item.parentNode !== container) return;
      e.preventDefault(); drag = { item: item, id: e.pointerId }; item.classList.add('dragging');
      try { grip.setPointerCapture(e.pointerId); } catch (x) { /* ignoré */ }
      var move = function (ev) {
        if (!drag) return;
        var sibs = Array.prototype.filter.call(container.children, function (c) { return c !== item && c.matches(opt.item || '.sort-item'); });
        var y = ev.clientY, placed = false;
        for (var i = 0; i < sibs.length; i++) {
          var r = sibs[i].getBoundingClientRect();
          if (y < r.top + r.height / 2) { container.insertBefore(item, sibs[i]); placed = true; break; }
        }
        if (!placed && sibs.length) { var last = sibs[sibs.length - 1]; if (last.nextSibling !== item) container.insertBefore(item, last.nextSibling); }
        /* défilement automatique près des bords */
        if (ev.clientY < 70) window.scrollBy(0, -14); else if (ev.clientY > window.innerHeight - 70) window.scrollBy(0, 14);
      };
      var up = function () {
        grip.removeEventListener('pointermove', move); grip.removeEventListener('pointerup', up); grip.removeEventListener('pointercancel', up);
        item.classList.remove('dragging'); drag = null;
        if (opt.onSort) opt.onSort(Array.prototype.filter.call(container.children, function (c) { return c.matches(opt.item || '.sort-item'); }).map(function (c) { return c.getAttribute('data-id'); }));
      };
      grip.addEventListener('pointermove', move); grip.addEventListener('pointerup', up); grip.addEventListener('pointercancel', up);
    });
  }
  function moveInArray(arr, from, to) { if (to < 0 || to >= arr.length) return arr; var x = arr.splice(from, 1)[0]; arr.splice(to, 0, x); return arr; }

  /* ── zone de dépôt : fichiers + liens (glisser-déposer ou coller) ── */
  function dropzone(el, onDrop) {
    var depth = 0;
    el.addEventListener('dragenter', function (e) { e.preventDefault(); depth++; el.classList.add('over'); });
    el.addEventListener('dragover', function (e) { e.preventDefault(); });
    el.addEventListener('dragleave', function () { depth = Math.max(0, depth - 1); if (!depth) el.classList.remove('over'); });
    el.addEventListener('drop', function (e) {
      e.preventDefault(); depth = 0; el.classList.remove('over');
      var dt = e.dataTransfer; if (!dt) return;
      var files = Array.prototype.slice.call(dt.files || []);
      var urls = [];
      var uri = dt.getData && dt.getData('text/uri-list');
      if (uri) uri.split(/\r?\n/).forEach(function (l) { if (l && l.charAt(0) !== '#') urls.push(l.trim()); });
      if (!uri && !files.length) { var tx = dt.getData && dt.getData('text/plain'); if (tx) tx.split(/\r?\n/).forEach(function (l) { if (/^https?:\/\//i.test(l.trim())) urls.push(l.trim()); }); }
      onDrop({ files: files, urls: urls });
    });
  }

  /* ── pastilles et petits éléments ── */
  function chip(txt, cls, onclick, title) { return h(onclick ? 'button' : 'span', { class: 'chip ' + (cls || ''), type: onclick ? 'button' : null, onclick: onclick, title: title }, txt); }
  function field(label, input, hint) { return h('label', { class: 'field' }, h('span', { class: 'lbl' }, label), input, hint ? h('span', { class: 'hint' }, hint) : null); }
  function section(id, title, kids, opt) {
    opt = opt || {};
    var key = 'sec_' + id, open = Store.get(key); open = open === null ? (opt.open !== false) : open === '1';
    var d = h('details', { class: 'card sec', open: open ? true : null }, h('summary', null, h('span', { class: 'sec-t' }, title), opt.badge ? h('span', { class: 'badge' }, opt.badge) : null), h('div', { class: 'sec-b' }, kids));
    d.addEventListener('toggle', function () { Store.set(key, d.open ? '1' : '0'); });
    return d;
  }
  function select(opts, value, onchange, cls) {
    var s = h('select', { class: 'inp ' + (cls || ''), onchange: function () { onchange(s.value); } });
    opts.forEach(function (o) { var v = Array.isArray(o) ? o[0] : o, l = Array.isArray(o) ? o[1] : o; s.appendChild(h('option', { value: v, selected: String(v) === String(value) ? true : null }, l)); });
    return s;
  }
  function bind(inp, get, set, delay) {
    inp.value = get() || '';
    var d = debounce(function () { set(inp.value); }, delay || 500);
    inp.addEventListener('input', d);
    inp.addEventListener('blur', function () { d.flush(); if ((get() || '') !== inp.value) set(inp.value); });
    return inp;
  }
  function autosize(ta) { var f = function () { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight + 2, 600) + 'px'; }; ta.addEventListener('input', f); setTimeout(f, 0); return ta; }
  function textarea(get, set, ph, rows) { var ta = h('textarea', { class: 'inp', rows: rows || 3, placeholder: ph || '' }); bind(ta, get, set); return autosize(ta); }
  function textinput(get, set, ph) { var i = h('input', { class: 'inp', type: 'text', placeholder: ph || '' }); return bind(i, get, set); }

  return { toast: toast, modal: modal, ask: ask, promptText: promptText, sortable: sortable, moveInArray: moveInArray, dropzone: dropzone, chip: chip, field: field, section: section, select: select, bind: bind, textarea: textarea, textinput: textinput, autosize: autosize };
})();
