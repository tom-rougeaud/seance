/* ═══ FICHES · version affichée, bandeau « nouvelle version », mise à jour forcée ═══ */
'use strict';
var Upd = (function () {
  var reg = null, bar = null, lastCheck = 0, timer = null;
  function fmtBuild(b) {
    var m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(b || '');
    if (!m) return b || '?';
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]));
    try { return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h'); } catch (e) { return b; }
  }
  function short() {
    var m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(APP.build || '');
    if (!m) return '';
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]));
    try { return 'v. ' + d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h'); } catch (e) { return ''; }
  }
  function label() { return APP.nom + ' ' + APP.version + ' · version du ' + fmtBuild(APP.build); }
  function reload() { try { location.reload(); } catch (e) { /* ignoré */ } }
  function apply() {
    var go = function () { fetch('index.html', { cache: 'reload' }).catch(function () { /* ignoré */ }).then(reload); };
    if (typeof DB !== 'undefined' && DB.flush) DB.flush().catch(function () { /* ignoré */ }).then(go); else go();
  }
  function banner() {
    if (bar || typeof document === 'undefined' || !document.body) return;
    bar = h('div', { class: 'update-bar', role: 'status', 'aria-live': 'polite' },
      h('span', null, '🔄 Une nouvelle version de ' + APP.nom + ' est disponible.'), h('span', { class: 'grow' }),
      h('button', { class: 'btn small primary', type: 'button', onclick: apply }, 'Mettre à jour maintenant'),
      h('button', { class: 'btn small ghost', type: 'button', onclick: function () { bar.remove(); bar = null; } }, 'Plus tard'));
    document.body.appendChild(bar);
  }
  /* lit le numéro de version publié dans sw.js (toujours demandé au réseau, jamais au cache HTTP) */
  function remote() {
    return fetch('sw.js?v=' + Date.now(), { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.text(); })
      .then(function (t) { var m = /var CACHE = '[a-z]+-(\d{12})'/.exec(t); return { build: m ? m[1] : null }; }, function () { return { err: true }; });
  }
  function check(manual) {
    lastCheck = Date.now();
    var p = reg && reg.update ? reg.update().catch(function () { /* ignoré */ }) : Promise.resolve();
    return p.then(remote).then(function (r) {
      if (r.err) { if (manual) UI.toast('Impossible de vérifier : êtes-vous hors connexion ?', 'err'); return r; }
      if (r.build && r.build > APP.build) { banner(); if (manual) UI.toast('Une nouvelle version est disponible : touchez « Mettre à jour maintenant ».'); r.neuve = true; }
      else if (manual) UI.toast('✓ Vous avez la dernière version (' + fmtBuild(APP.build) + ').');
      return r;
    });
  }
  /* repart de zéro : désinscrit le service worker, vide les caches de l’appli, recharge depuis le réseau */
  function force() {
    var go = function () {
      var jobs = [];
      try { if ('serviceWorker' in navigator) jobs.push(navigator.serviceWorker.getRegistrations().then(function (rs) { return Promise.all(rs.map(function (x) { return x.unregister(); })); })); } catch (e) { /* ignoré */ }
      try { if (window.caches) jobs.push(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k.indexOf(APP.cache) === 0; }).map(function (k) { return caches.delete(k); })); })); } catch (e) { /* ignoré */ }
      Promise.all(jobs).catch(function () { /* ignoré */ }).then(apply);
    };
    UI.ask('Recharger complètement ' + APP.nom + ' ? Vos données ne sont pas touchées (elles sont dans la base) ; seul le programme de l’appli est retéléchargé.', { ok: 'Recharger' }).then(function (ok) { if (ok) go(); });
  }
  function watch(r) {
    reg = r || reg;
    if (reg) {
      reg.addEventListener('updatefound', function () {
        var nw = reg.installing; if (!nw) return;
        nw.addEventListener('statechange', function () { if (nw.state === 'installed' && navigator.serviceWorker.controller) banner(); });
      });
    }
    if (timer) return;
    setTimeout(function () { check(false); }, 3000);
    timer = true;
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && Date.now() - lastCheck > 10 * 60 * 1000) check(false); });
  }
  /* carte « Version » pour Réglages */
  function card() {
    var st = h('p', { class: 'small muted', 'aria-live': 'polite' }, '');
    var btn = h('button', { class: 'btn', type: 'button', onclick: function () { st.textContent = 'Vérification…'; check(true).then(function (r) { st.textContent = r.err ? 'Vérification impossible.' : (r.neuve ? 'Nouvelle version disponible.' : 'À jour.'); }); } }, '🔄 Rechercher une mise à jour');
    return h('section', { class: 'card' }, h('h2', null, 'Version et mises à jour'),
      h('p', null, h('strong', null, label())),
      h('p', { class: 'muted small' }, 'L’appli cherche seule les mises à jour à chaque ouverture ; un bandeau « Mettre à jour maintenant » apparaît quand une nouvelle version est publiée. Comparez la date ci-dessus avec celle annoncée après chaque modification.'),
      h('div', { class: 'row-gap' }, btn, h('button', { class: 'btn ghost', type: 'button', onclick: force }, '⚠ Forcer le rechargement complet')), st);
  }
  /* lien vers l’autre version : toujours depuis « Ma séance » ; depuis « Fiches », seulement pour le compte propriétaire */
  function siblingOk() {
    if (!APP.frere) return false;
    if (APP.manuels) return true;
    var o = (typeof FICHES_CONFIG !== 'undefined' && FICHES_CONFIG.OWNER_EMAILS) || [], em = (Api.user() && Api.user().email || '').toLowerCase();
    return o.map(function (x) { return String(x).toLowerCase(); }).indexOf(em) >= 0;
  }
  function siblingCard() {
    if (!siblingOk()) return null;
    return h('section', { class: 'card' }, h('h2', null, 'Mes deux versions'),
      h('p', { class: 'muted small' }, APP.manuels ? 'Vous êtes dans « Ma séance » (séances construites sur mes manuels). L’autre version suit le programme officiel (BO). Même compte, mêmes classes et mêmes séances dans les deux : seule la façon de préparer change.' : 'Vous êtes dans « Fiches » (programme officiel). « Ma séance » construit les séances sur mes manuels (pages, exercices, liens). Même compte, mêmes classes et mêmes séances dans les deux.'),
      h('a', { class: 'btn', href: APP.frere.url, target: '_blank', rel: 'noopener' }, 'Ouvrir ' + APP.frere.nom + ' ↗'));
  }
  return { siblingOk: siblingOk, siblingCard: siblingCard, short: short, fmtBuild: fmtBuild, label: label, check: check, force: force, watch: watch, card: card, apply: apply, banner: banner };
})();
