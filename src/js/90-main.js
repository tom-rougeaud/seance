/* ═══ FICHES · routeur, démarrage, thème, installation (PWA) ═══ */
'use strict';
var Main = (function () {
  var started = false, deferredInstall = null, last = null;

  function isStandalone() { try { return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true; } catch (e) { return false; } }
  function isIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }

  function applyTheme() {
    var t = Store.get('theme') || 'auto', r = document.documentElement;
    if (t === 'light' || t === 'dark') r.setAttribute('data-theme', t); else r.removeAttribute('data-theme');
  }

  /* ── routeur ── */
  var PUBLIC = { apropos: 1, confidentialite: 1 };
  function parse() {
    var m = (location.hash || '#/').replace(/^#\/?/, '').split('/');
    return { name: m[0] || '', arg: m[1] || '' };
  }
  function build(r) {
    switch (r.name) {
      case '': return Views.dashboard();
      case 'classes': return Views.classes();
      case 'classe': return Views.classe(r.arg);
      case 'sequence': return Views.sequence(r.arg);
      case 'seance': return Views.seance(r.arg);
      case 'progression': return Views.progression(r.arg);
      case 'biblio': return Views.biblio();
      case 'referentiel': return Views.referentiel(r.arg);
      case 'reglages': return Views.reglages();
      case 'apropos': return Views.apropos();
      case 'confidentialite': return Views.confidentialite();
      default: return notFound();
    }
  }
  function errorCard(e) {
    if (window.console) console.error(e);
    return h('div', { class: 'page' }, h('div', { class: 'card hero' }, h('h2', null, 'Un problème est survenu'), h('p', { class: 'muted' }, 'Cet écran n’a pas pu s’afficher. Vos données ne sont pas perdues.'), h('pre', { class: 'small errpre' }, String(e && e.message || e)), h('a', { class: 'btn primary', href: '#/' }, 'Retour à l’accueil')));
  }
  function route(keepScroll) {
    var r = parse(), hash = location.hash || '#/';
    if (!started) {
      if (PUBLIC[r.name]) { showPublic(build(r)); return; }
      if (!$('.auth-card') && !$('.boot')) showAuth();
      return;
    }
    var y = window.scrollY, node;
    try { node = build(r); } catch (e) { node = errorCard(e); }
    Shell.show(node, hash);
    if (keepScroll === true) window.scrollTo(0, y);
    last = hash;
  }
  Views.rerender = function () { route(true); };

  function showPublic(node) {
    var app = $('#app'); clear(app);
    app.appendChild(h('div', { class: 'public' }, node));
    window.scrollTo(0, 0);
  }

  /* ── connexion / chargement ── */
  function showAuth(msg) {
    started = false; var app = $('#app'); clear(app);
    var v = Views.auth(); app.appendChild(v);
    if (msg) { var m = $('.auth-msg', v); if (m) m.textContent = msg; }
  }
  /* retour d’un lien e-mail : confirmation de compte ou réinitialisation du mot de passe */
  function handleAuthHash() {
    loading('Vérification du lien…');
    var clean = function () { try { history.replaceState(null, '', location.pathname + location.search + '#/'); } catch (e) { location.hash = '#/'; } };
    Api.auth.fromHash(location.hash).then(function (r) {
      clean();
      if (r && r.type === 'recovery') { var app = $('#app'); clear(app); app.appendChild(Views.newPassword()); }
      else afterLogin();
    }, function (e) { clean(); showAuth(/expired|invalid|otp/i.test(e.message || '') ? 'Ce lien a expiré ou a déjà servi. Refaites la demande depuis « Mot de passe oublié ? ».' : 'Lien invalide : ' + e.message); });
  }
  function loading(txt) { var app = $('#app'); clear(app); app.appendChild(h('div', { class: 'boot' }, h('div', { class: 'spinner' }), h('p', null, txt || 'Chargement…'))); }
  function setupScreen(e) {
    var app = $('#app'); clear(app);
    app.appendChild(h('div', { class: 'auth-wrap' }, h('div', { class: 'auth-card' }, h('h1', null, 'Base à initialiser'),
      h('p', null, 'La base de données ne contient pas encore les tables de l’application (ou le script est incomplet).'),
      h('ol', { class: 'small' }, h('li', null, 'Ouvrez votre projet Supabase › SQL Editor.'), h('li', null, 'Collez le contenu du fichier sql/supabase_fiches.sql du dépôt, puis « Run ».'), h('li', null, 'Revenez ici et cliquez sur « Réessayer ».')),
      h('p', { class: 'muted small' }, 'Détail : ' + String(e && e.message || e)),
      h('button', { class: 'btn primary wide', type: 'button', onclick: function () { afterLogin(); } }, 'Réessayer'),
      h('button', { class: 'btn ghost wide', type: 'button', onclick: function () { logout(true); } }, 'Se déconnecter'))));
  }
  function afterLogin() {
    var lastUid = Store.get('last_uid');
    if (lastUid && lastUid !== Api.uid()) DB.reset();
    Store.set('last_uid', Api.uid());
    loading('Chargement de vos fiches…');
    DB.loadAll().then(function (res) {
      Ref.invalidate(); started = true; Shell.build();
      if (res === 'cache') UI.toast('Hors connexion : données de la dernière synchronisation.');
      if (!location.hash || location.hash === '#') location.hash = '#/';
      route();
      installBannerSoon();
    }, function (e) {
      if (e && (e.status === 401 || e.status === 403) && !/permission denied/i.test(e.message || '')) { Api.auth.signOut().then(function () { showAuth('Session expirée : reconnectez-vous.'); }); return; }
      if (e && e.network) { showAuth('Réseau indisponible et aucune donnée en cache. Réessayez en ligne.'); return; }
      setupScreen(e);
    });
  }
  function logout(force) {
    function go() { started = false; DB.flush().catch(function () { /* ignoré */ }).then(function () { return Api.auth.signOut(); }).then(function () { DB.reset(); Store.del('last_uid'); location.hash = '#/'; showAuth(); }); }
    if (!force && DB.pending() > 0) { UI.ask('Des modifications ne sont pas encore envoyées à la base. Se déconnecter les effacerait de cet appareil.', { ok: 'Se déconnecter quand même', danger: true }).then(function (ok) { if (ok) { started = false; Api.auth.signOut().then(function () { DB.reset(); Store.del('last_uid'); location.hash = '#/'; showAuth(); }); } }); return; }
    go();
  }

  /* ── installation sur l’écran d’accueil ── */
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferredInstall = e; });
  window.addEventListener('appinstalled', function () { deferredInstall = null; var b = $('.install-bar'); if (b) b.remove(); UI.toast('Application installée 🎉'); });
  function installHelp() {
    var body = h('div', { class: 'prose' });
    if (isStandalone()) body.appendChild(h('p', null, '✅ L’application est déjà installée sur cet appareil.'));
    if (deferredInstall) body.appendChild(h('p', null, h('button', { class: 'btn primary', type: 'button', onclick: function () { deferredInstall.prompt(); deferredInstall.userChoice.then(function () { deferredInstall = null; }); } }, '📲 Installer maintenant')));
    body.appendChild(h('h3', null, 'iPhone / iPad (Safari)'));
    body.appendChild(h('ol', null, h('li', null, 'Ouvrez le site dans Safari.'), h('li', null, 'Touchez le bouton Partager (carré avec une flèche vers le haut).'), h('li', null, 'Choisissez « Sur l’écran d’accueil », puis « Ajouter ».')));
    body.appendChild(h('h3', null, 'Android (Chrome)'));
    body.appendChild(h('ol', null, h('li', null, 'Touchez le menu ⋮ en haut à droite.'), h('li', null, 'Choisissez « Installer l’application » (ou « Ajouter à l’écran d’accueil »).')));
    body.appendChild(h('h3', null, 'Ordinateur (Chrome, Edge)'));
    body.appendChild(h('p', null, 'Cliquez sur l’icône d’installation à droite de la barre d’adresse, ou menu › « Installer Fiches ».'));
    UI.modal({ title: 'Installer Fiches', body: body, actions: [{ label: 'Fermer', kind: 'primary' }] });
  }
  function installBannerSoon() {
    if (isStandalone() || Store.get('install_dismissed') === '1' || $('.install-bar')) return;
    setTimeout(function () {
      if (!started || isStandalone() || Store.get('install_dismissed') === '1' || $('.install-bar')) return;
      var bar = h('div', { class: 'install-bar', role: 'region', 'aria-label': 'Installation' },
        h('span', null, isIOS() ? '📲 Ajoutez Fiches à l’écran d’accueil : Partager → « Sur l’écran d’accueil ».' : '📲 Installer Fiches sur cet appareil ?'),
        h('span', { class: 'grow' }),
        !isIOS() ? h('button', { class: 'btn small primary', type: 'button', onclick: function () { if (deferredInstall) { deferredInstall.prompt(); deferredInstall.userChoice.then(function () { deferredInstall = null; bar.remove(); }); } else { installHelp(); } } }, 'Installer') : h('button', { class: 'btn small primary', type: 'button', onclick: installHelp }, 'Comment ?'),
        h('button', { class: 'btn small ghost', type: 'button', onclick: function () { bar.remove(); } }, 'Plus tard'),
        h('button', { class: 'btn small ghost', type: 'button', onclick: function () { Store.set('install_dismissed', '1'); bar.remove(); } }, 'Ne plus proposer'));
      document.body.appendChild(bar);
    }, 4000);
  }

  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    if (!(location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) return;
    navigator.serviceWorker.register('sw.js').then(function (reg) {
      reg.addEventListener('updatefound', function () {
        var nw = reg.installing; if (!nw) return;
        nw.addEventListener('statechange', function () { if (nw.state === 'installed' && navigator.serviceWorker.controller) UI.toast('Une nouvelle version est disponible : rechargez la page.', '', 8000); });
      });
    }, function () { /* sans service worker : l’appli fonctionne quand même en ligne */ });
  }

  function boot() {
    applyTheme();
    try { Ref.load(); } catch (e) { $('#app').appendChild(h('div', { class: 'boot' }, h('p', null, 'Les programmes officiels n’ont pas pu être chargés : ' + e.message))); return; }
    window.addEventListener('hashchange', function () { route(); });
    window.addEventListener('error', function (ev) { if (window.console) console.error(ev.error || ev.message); });
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && started) DB.flush(); });
    Api.onAuth(function (s) { if (!s && started) { started = false; showAuth('Session expirée : reconnectez-vous.'); } });
    registerSW();
    if (Api.configured() && /[#&](access_token|error)=/.test(location.hash)) handleAuthHash();
    else if (Api.configured() && Api.restore()) afterLogin();
    else { var r = parse(); if (PUBLIC[r.name]) showPublic(build(r)); else showAuth(Api.configured() ? '' : 'La base n’est pas configurée : renseignez config.js.'); }
  }
  return { boot: boot, afterLogin: afterLogin, logout: logout, applyTheme: applyTheme, installHelp: installHelp, isStandalone: isStandalone };
})();
