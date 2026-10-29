/* ═══ FICHES · utilitaires ═══ */
'use strict';
var APP = { nom: 'Fiches', version: 'v1', build: '2026-10-29', prefix: 'fiches_v1_' };

/* ── stockage local sécurisé (try/catch + repli en mémoire) ── */
var Mem = {};
var Store = {
  get: function (k) { try { var v = localStorage.getItem(APP.prefix + k); return v === null ? (Mem[k] === undefined ? null : Mem[k]) : v; } catch (e) { return Mem[k] === undefined ? null : Mem[k]; } },
  set: function (k, v) { Mem[k] = v; try { localStorage.setItem(APP.prefix + k, v); return true; } catch (e) { return false; } },
  del: function (k) { delete Mem[k]; try { localStorage.removeItem(APP.prefix + k); } catch (e) { /* ignoré */ } },
  getJSON: function (k, d) { try { var s = Store.get(k); return s ? JSON.parse(s) : d; } catch (e) { return d; } },
  setJSON: function (k, v) { return Store.set(k, JSON.stringify(v)); }
};

/* ── DOM ── */
function h(tag, attrs) {
  var el = document.createElement(tag);
  if (attrs) for (var k in attrs) {
    var v = attrs[k];
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = !!v;
    else if (k === 'disabled') el.disabled = !!v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  addKids(el, Array.prototype.slice.call(arguments, 2));
  return el;
}
function addKids(el, kids) {
  kids.forEach(function (k) {
    if (Array.isArray(k)) return addKids(el, k);
    if (k === null || k === undefined || k === false) return;
    el.appendChild(k.nodeType ? k : document.createTextNode(String(k)));
  });
  return el;
}
function $(sel, root) { return (root || document).querySelector(sel); }
function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }
function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function nl2br(s) { return esc(s).replace(/\n/g, '<br>'); }

/* ── identifiants, temps, dates ── */
function uid() {
  try { if (crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (e) { /* repli */ }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
}
var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function debounce(fn, ms) { var t; var f = function () { var a = arguments, c = this; clearTimeout(t); t = setTimeout(function () { fn.apply(c, a); }, ms); }; f.flush = function () { clearTimeout(t); }; return f; }
function pad2(n) { return (n < 10 ? '0' : '') + n; }
function isoDate(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
function today() { return isoDate(new Date()); }
function parseISO(s) { if (!s) return null; var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
function addDays(iso, n) { var d = parseISO(iso); d.setDate(d.getDate() + n); return isoDate(d); }
function fmtD(iso) { var d = parseISO(iso); return d ? pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + d.getFullYear() : ''; }
function fmtDL(iso) { var d = parseISO(iso); return d ? d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) : ''; }
function fmtDM(iso) { var d = parseISO(iso); return d ? d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : ''; }
function weekStart(iso) { var d = parseISO(iso); var w = (d.getDay() + 6) % 7; d.setDate(d.getDate() - w); return isoDate(d); }
function anneeScolaire(d) { d = d || new Date(); var y = d.getFullYear(); return d.getMonth() >= 6 ? y + '-' + (y + 1) : (y - 1) + '-' + y; }
function fmtDuree(min) { min = +min || 0; var hh = Math.floor(min / 60), mm = min % 60; return hh ? hh + ' h' + (mm ? ' ' + pad2(mm) : '') : mm + ' min'; }
function jourNom(n) { return ['', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'][n] || ''; }
function plural(n, a, b) { return n + ' ' + (n > 1 ? (b || a + 's') : a); }

/* ── divers ── */
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function safeUrl(u) { try { var x = new URL(String(u).trim()); return (x.protocol === 'http:' || x.protocol === 'https:') ? x.href : null; } catch (e) { return null; } }
function hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } }
function fmtSize(b) { b = +b || 0; if (b < 1024) return b + ' o'; if (b < 1048576) return Math.round(b / 1024) + ' Ko'; return (b / 1048576).toFixed(b < 10485760 ? 1 : 0) + ' Mo'; }
function safeName(n) { return String(n).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '_').slice(-80) || 'fichier'; }
function hexLum(hx) { hx = (hx || '#2B4C7E').replace('#', ''); if (hx.length === 3) hx = hx[0] + hx[0] + hx[1] + hx[1] + hx[2] + hx[2]; var r = parseInt(hx.slice(0, 2), 16) / 255, g = parseInt(hx.slice(2, 4), 16) / 255, b = parseInt(hx.slice(4, 6), 16) / 255; return 0.299 * r + 0.587 * g + 0.114 * b; }
function textOn(hx) { return hexLum(hx) > 0.6 ? '#1B2438' : '#FFFFFF'; }
function copyText(t) {
  return new Promise(function (ok) {
    try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(t).then(function () { ok(true); }, function () { ok(fallbackCopy(t)); }); return; } } catch (e) { /* repli */ }
    ok(fallbackCopy(t));
  });
}
function fallbackCopy(t) { try { var ta = h('textarea', { style: { position: 'fixed', opacity: 0 } }); ta.value = t; document.body.appendChild(ta); ta.select(); var r = document.execCommand('copy'); ta.remove(); return r; } catch (e) { return false; } }
function downloadBlob(blob, name) { var a = h('a', { href: URL.createObjectURL(blob), download: name }); document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
function cmpStr(a, b) { return String(a || '').localeCompare(String(b || ''), 'fr', { numeric: true, sensitivity: 'base' }); }

/* ── heures « HH:MM » ── */
function toMin(s) { var m = /^(\d{1,2}):(\d{2})$/.exec(String(s || '')); return m ? +m[1] * 60 + +m[2] : 0; }
function fromMin(n) { n = Math.max(0, Math.min(1439, Math.round(n))); return pad2(Math.floor(n / 60)) + ':' + pad2(n % 60); }
function hhmmAdd(s, dur) { return fromMin(toMin(s) + (+dur || 0)); }
