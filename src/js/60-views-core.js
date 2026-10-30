/* ═══ FICHES · coque de l’appli, connexion, tableau de bord, classes ═══ */
'use strict';
var Views = {};

/* ── création d’objets ── */
function createSequence(cl, init) {
  var n = Cls.sequences(cl.id).reduce(function (m, q) { return Math.max(m, q.ordre); }, 0) + 1;
  var rec = { class_id: cl.id, ordre: n, titre: '', statut: 'brouillon', date_debut: null, date_fin: null, data: emptySequenceData(cl) };
  Object.assign(rec, init || {}); if (init && init.data) rec.data = Object.assign(emptySequenceData(cl), init.data);
  return DB.create('fs_sequences', rec);
}
function createSeance(cl, init) {
  var seq = init && init.sequence_id;
  var sibs = seq ? Cls.seancesDe(seq) : Cls.seances(cl.id).filter(function (s) { return !s.sequence_id; });
  var n = sibs.reduce(function (m, s) { return Math.max(m, s.ordre); }, 0) + 1;
  var rec = { class_id: cl.id, sequence_id: seq || null, jumelle_id: null, ordre: n, titre: '', type: 'cours', modalite: 'classe', groupe: null, duree_min: defaultDuree(cl), date_prevue: null, date_realisee: null, statut: 'a_faire', data: emptySeanceData(cl) };
  Object.assign(rec, init || {}); rec.data = Object.assign(emptySeanceData(cl), (init && init.data) || {});
  if (!(init && init.data)) rec.data.phases = defaultPhases(rec.type, rec.duree_min);
  return DB.create('fs_seances', rec);
}
function defaultDuree(cl) { var c = (cl.creneaux || [])[0]; return c && c.duree ? Math.min(c.duree, 240) : 55; }
function nextDateFor(cl, sequenceId) {
  var all = Cls.seances(cl.id).filter(function (s) { return s.statut !== 'annulee' && s.date_prevue; });
  var last = all.length ? all.map(function (s) { return s.date_prevue; }).sort().pop() : null;
  var from = last && last >= today() ? last : addDays(today(), -1);
  var avoid = all.filter(function (s) { return s.modalite === 'classe' || s.modalite === 'co_intervention'; }).map(function (s) { return s.date_prevue; });
  var slots = Plan.nextSlots(cl, from, 1, { avoid: [] });
  return slots.length ? slots[0].date : null;
}

/* ═══ Coque ═══ */
var Shell = (function () {
  var NAV = [['#/', 'Accueil', '🏠', 'Accueil'], ['#/classes', 'Classes', '👥', 'Classes'], ['#/planning', 'Planning', '🗓️', 'Planning'], ['#/progression', 'Progression', '📈', 'Suivi'], ['#/biblio', 'Bibliothèque', '📚', 'Biblio'], ['#/referentiel', 'Programmes', '📘', 'BO'], ['#/reglages', 'Réglages', '⚙️', 'Réglages']];
  var el = {}, syncBtn;

  function build() {
    var app = $('#app'); clear(app);
    syncBtn = h('button', { class: 'sync', type: 'button', onclick: syncPopover, 'aria-live': 'polite' });
    el.view = h('main', { id: 'view', tabindex: -1 });
    el.nav = h('nav', { class: 'nav', 'aria-label': 'Navigation principale' }, NAV.map(function (n) { return h('a', { href: n[0], 'data-h': n[0] }, h('span', { class: 'ic' }, n[2]), h('span', { class: 't' }, h('span', { class: 't-l' }, n[1]), h('span', { class: 't-s' }, n[3]))); }));
    el.top = h('header', { class: 'top' }, h('a', { class: 'brand', href: '#/' }, h('span', { class: 'logo' }, APP.manuels ? '📘' : '📋'), h('span', null, APP.nom)), h('a', { class: 'ver', href: '#/reglages', title: 'Version installée — touchez pour chercher une mise à jour' }, Upd.short()), h('div', { class: 'grow' }), syncBtn,
      h('button', { class: 'icon-btn', type: 'button', title: 'Se déconnecter', 'aria-label': 'Se déconnecter', onclick: function () { Main.logout(); } }, '⎋'));
    app.appendChild(el.top); app.appendChild(h('div', { class: 'body' }, el.nav, el.view));
    DB.onSync(updateSync); updateSync(DB.syncInfo());
  }
  function updateSync(i) {
    if (!syncBtn) return;
    var txt, cls;
    if (!i.online) { txt = '⚠ Hors connexion' + (i.pending ? ' · ' + i.pending + ' en attente' : ''); cls = 'warn'; }
    else if (i.failed) { txt = '⚠ ' + plural(i.failed, 'erreur') + ' d’enregistrement'; cls = 'err'; }
    else if (i.pending || i.flushing) { txt = '⏳ Enregistrement…'; cls = 'pend'; }
    else { txt = '✓ Enregistré'; cls = 'ok'; }
    syncBtn.className = 'sync ' + cls; syncBtn.textContent = txt;
  }
  function syncPopover() {
    var i = DB.syncInfo(), f = DB.failed();
    var body = h('div', null, h('p', null, i.online ? 'Connecté à la base de données.' : 'Vous êtes hors connexion : vos modifications sont gardées sur cet appareil et seront envoyées au retour du réseau.'),
      h('p', null, plural(i.pending, 'modification') + ' en attente d’envoi.'));
    if (f.length) {
      body.appendChild(h('p', { class: 'err-t' }, plural(f.length, 'modification refusée') + ' par la base :'));
      var ul = h('ul', { class: 'small' }); f.slice(-8).forEach(function (x) { ul.appendChild(h('li', null, x.op.table + ' — ' + x.msg)); }); body.appendChild(ul);
      body.appendChild(h('p', { class: 'muted small' }, 'Cause fréquente : le script SQL de la base n’a pas été exécuté ou est incomplet (voir À propos › Installation).'));
    }
    UI.modal({ title: 'Enregistrement', body: body, actions: [{ label: 'Effacer les erreurs', kind: 'ghost', onClick: function () { DB.clearFailed(); } }, { label: 'Réessayer maintenant', kind: 'primary', onClick: function () { DB.flush(); } }] });
  }
  function mark(hash) {
    $$('a', el.nav).forEach(function (a) { var k = a.getAttribute('data-h'); a.classList.toggle('on', k === '#/' ? hash === '#/' || hash === '' : hash.indexOf(k) === 0 || (k === '#/classes' && /^#\/(classe|sequence|seance)/.test(hash))); });
  }
  function show(node, hash) {
    clear(el.view); el.view.appendChild(node); mark(hash || '#/'); window.scrollTo(0, 0);
    try { el.view.focus({ preventScroll: true }); } catch (e) { /* ignoré */ }
  }
  return { build: build, show: show };
})();

function pageHead(title, sub, actions, back) {
  return h('div', { class: 'page-head' }, back ? h('a', { class: 'back', href: back[0] }, '← ' + back[1]) : null,
    h('div', { class: 'ph-row' }, h('div', null, h('h1', null, title), sub ? h('div', { class: 'muted' }, sub) : null), h('div', { class: 'ph-actions' }, actions || [])));
}

/* ═══ Connexion ═══ */
Views.auth = function () {
  var mode = 'in';
  var email = h('input', { class: 'inp', type: 'email', autocomplete: 'email', placeholder: 'prenom.nom@ac-dijon.fr', required: true });
  var pass = h('input', { class: 'inp', type: 'password', autocomplete: 'current-password', placeholder: 'Mot de passe', required: true });
  var msg = h('div', { class: 'auth-msg', role: 'alert' });
  var btn = h('button', { class: 'btn primary wide', type: 'submit' }, 'Se connecter');
  var toggle = h('button', { class: 'linklike', type: 'button' }, 'Créer un compte');
  var forgot = h('button', { class: 'linklike', type: 'button' }, 'Mot de passe oublié ?');
  function setMode(m) { mode = m; btn.textContent = m === 'in' ? 'Se connecter' : 'Créer mon compte'; toggle.textContent = m === 'in' ? 'Créer un compte' : 'J’ai déjà un compte'; pass.autocomplete = m === 'in' ? 'current-password' : 'new-password'; msg.textContent = ''; }
  toggle.onclick = function () { setMode(mode === 'in' ? 'up' : 'in'); };
  forgot.onclick = function () {
    if (!email.value.trim()) { msg.textContent = 'Saisissez d’abord votre adresse e-mail.'; return; }
    Api.auth.recover(email.value.trim()).then(function () { msg.className = 'auth-msg ok'; msg.textContent = 'Un e-mail de réinitialisation vient d’être envoyé.'; }, function (e) { msg.className = 'auth-msg'; msg.textContent = e.message; });
  };
  var form = h('form', { class: 'auth-card', onsubmit: function (e) {
    e.preventDefault(); msg.className = 'auth-msg'; msg.textContent = ''; btn.disabled = true;
    if (!Api.configured()) { msg.textContent = 'La base n’est pas configurée (config.js).'; btn.disabled = false; return; }
    var p = mode === 'in' ? Api.auth.signIn(email.value.trim(), pass.value) : Api.auth.signUp(email.value.trim(), pass.value).then(function (r) { if (!r.connected) { msg.className = 'auth-msg ok'; msg.textContent = 'Compte créé : confirmez votre adresse via l’e-mail reçu, puis connectez-vous.'; setMode('in'); throw { silent: true }; } });
    p.then(function () { Main.afterLogin(); }, function (err) { if (err && err.silent) return; msg.textContent = err.network ? 'Réseau indisponible. Réessayez.' : (/Invalid login/i.test(err.message) ? 'E-mail ou mot de passe incorrect.' : err.message); }).then(function () { btn.disabled = false; });
  } },
    h('div', { class: 'auth-logo' }, APP.manuels ? '📘' : '📋'), h('h1', null, APP.nom), h('p', { class: 'muted' }, APP.manuels ? 'Séances de maths construites sur mes manuels : chapitres, pages, exercices et liens.' : 'Séances et séquences de maths, reliées aux programmes officiels et à votre progression.'),
    UI.field('Adresse e-mail', email), UI.field('Mot de passe', pass), msg, btn,
    h('div', { class: 'auth-links' }, toggle, forgot),
    h('p', { class: 'muted small' }, 'Même compte que « Suivi Progression » si vous en avez déjà un. Aucune donnée d’élève n’est nécessaire.'),
    h('p', { class: 'small' }, h('a', { href: '#/confidentialite' }, 'Confidentialité'), ' · ', h('a', { href: '#/apropos' }, 'À propos')));
  return h('div', { class: 'auth-wrap' }, form);
};

/* ═══ Nouveau mot de passe (lien « mot de passe oublié ») ═══ */
Views.newPassword = function () {
  var p1 = h('input', { class: 'inp', type: 'password', autocomplete: 'new-password', placeholder: 'Nouveau mot de passe (8 caractères minimum)', required: true });
  var p2 = h('input', { class: 'inp', type: 'password', autocomplete: 'new-password', placeholder: 'Répétez le mot de passe', required: true });
  var msg = h('div', { class: 'auth-msg', role: 'alert' });
  var btn = h('button', { class: 'btn primary wide', type: 'submit' }, 'Enregistrer le mot de passe');
  var form = h('form', { class: 'auth-card', onsubmit: function (e) {
    e.preventDefault(); msg.textContent = '';
    if (p1.value.length < 8) { msg.textContent = 'Au moins 8 caractères.'; return; }
    if (p1.value !== p2.value) { msg.textContent = 'Les deux mots de passe sont différents.'; return; }
    btn.disabled = true;
    Api.auth.updatePassword(p1.value).then(function () { Main.afterLogin(); }, function (err) { msg.textContent = err.network ? 'Réseau indisponible. Réessayez.' : err.message; btn.disabled = false; });
  } }, h('div', { class: 'auth-logo' }, '🔑'), h('h1', null, 'Nouveau mot de passe'), h('p', { class: 'muted' }, 'Choisissez un mot de passe pour votre compte.'), UI.field('Nouveau mot de passe', p1), UI.field('Confirmation', p2), msg, btn);
  return h('div', { class: 'auth-wrap' }, form);
};

/* ═══ Tableau de bord ═══ */
Views.dashboard = function () {
  var root = h('div', { class: 'page' });
  var classes = Cls.actives();
  root.appendChild(pageHead('Bonjour 👋', new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    [h('button', { class: 'btn', type: 'button', onclick: function () { Tpl.open({ mode: 'create' }); } }, '📥 Modèle d’1 h'), h('button', { class: 'btn primary', type: 'button', onclick: function () { Wizard.seance({}); } }, '＋ Nouvelle séance')]));
  if (!classes.length) {
    root.appendChild(h('div', { class: 'card hero' }, h('h2', null, 'Commençons par créer une classe'),
      h('p', null, 'Une classe fixe le programme (3PM, CAP, 2de, 1re, Tle), le groupement et vos créneaux. Ensuite, vous cochez des objectifs dans les accordéons et la progression se remplit toute seule.'),
      h('button', { class: 'btn primary', type: 'button', onclick: function () { classModal(null); } }, '＋ Créer ma première classe')));
    return root;
  }
  var t = today(), ws = weekStart(t), we = addDays(ws, 6);
  var wt = Plan.weekType(t, anneeScolaire());
  if (wt) root.appendChild(h('p', { class: 'wk-badge' }, h('strong', null, Plan.libSemaine(wt)), ' · du ' + fmtD(ws) + ' au ' + fmtD(addDays(ws, 4)), ' ', h('a', { href: '#/planning' }, 'Voir le planning')));
  else if (classes.some(function (c) { return (c.creneaux || []).length; })) root.appendChild(h('p', { class: 'wk-badge' }, 'Semaines 1 / 2 : ', h('a', { href: '#/planning' }, 'indiquez la semaine de rentrée')));
  var tdSlots = Plan.slotsOnDate(t);
  if (tdSlots.length) {
    var tb = h('section', { class: 'card' }, h('h2', null, '🕗 Aujourd’hui'));
    tdSlots.forEach(function (x) {
      var ex = DB.list('fs_seances').filter(function (s) { return s.class_id === x.cl.id && s.date_prevue === t && s.statut !== 'annulee'; });
      var end = hhmmAdd(x.c.debut, x.c.duree);
      tb.appendChild(h('div', { class: 'row-s' }, h('span', { class: 'tt-hr' }, x.c.debut + '–' + end), Cls.chip(x.cl), matId(x.c) !== 'maths' ? h('em', { class: 'tag' }, matShort(x.c)) : null, x.c.groupe ? h('em', { class: 'tag' }, x.c.groupe) : null, x.c.salle ? h('span', { class: 'muted small' }, x.c.salle) : null,
        ex.length ? ex.map(function (s) { return h('a', { class: 'row-t', href: '#/seance/' + s.id }, s.titre || '(sans titre)'); }) : h('span', { class: 'muted small grow' }, 'Pas de séance prévue'),
        ex.length ? null : h('button', { class: 'btn small', type: 'button', onclick: function () { var s = createSeance(x.cl, Object.assign({ date_prevue: t }, slotSeanceInit(x.c))); location.hash = '#/seance/' + s.id; } }, '＋ Préparer')));
    });
    root.appendChild(tb);
  }
  var all = DB.list('fs_seances').filter(function (s) { var c = Cls.get(s.class_id); return c && !c.archive; });
  var retard = all.filter(function (s) { return s.date_prevue && s.date_prevue < t && (s.statut === 'a_faire' || s.statut === 'prete'); }).sort(Cls.cmpSeance);
  var semaine = all.filter(function (s) { var d = Plan.seanceDate(s); return d && d >= ws && d <= we && s.statut !== 'annulee'; }).sort(Cls.cmpSeance);
  var aPreparer = all.filter(function (s) { return s.date_prevue && s.date_prevue >= t && s.date_prevue <= addDays(t, 14) && s.statut === 'a_faire' && !(s.data.items || []).length; }).sort(Cls.cmpSeance);

  function row(s) {
    var c = Cls.get(s.class_id);
    var sel = UI.select(K.STATUTS_SEANCE, s.statut, function (v) { setStatut(s, v); Views.rerender(); }, 'sm');
    return h('div', { class: 'row-s' }, Cls.chip(c), h('a', { class: 'row-t', href: '#/seance/' + s.id }, s.titre || '(sans titre)'),
      h('span', { class: 'muted small' }, (Plan.seanceDate(s) ? fmtDL(Plan.seanceDate(s)) + ' · ' : '') + fmtDuree(s.duree_min) + (s.modalite !== 'classe' ? ' · ' + lbl(K.MODALITES, s.modalite) : '')), sel);
  }
  if (retard.length) {
    var b = h('section', { class: 'card warnbox' }, h('h2', null, '⏰ À rattraper'), h('p', { class: 'muted small' }, 'Séances prévues dans le passé et pas encore marquées comme faites.'));
    retard.slice(0, 8).forEach(function (s) { b.appendChild(row(s)); });
    if (retard.length > 8) b.appendChild(h('p', { class: 'muted small' }, '… et ' + (retard.length - 8) + ' autres.'));
    root.appendChild(b);
  }
  var wk = h('section', { class: 'card' }, h('h2', null, '📅 Cette semaine'));
  if (!semaine.length) wk.appendChild(h('p', { class: 'muted' }, 'Aucune séance datée cette semaine.'));
  else { var cur = ''; semaine.forEach(function (s) { var d = Plan.seanceDate(s); if (d !== cur) { cur = d; wk.appendChild(h('div', { class: 'day-h' }, fmtDL(d) + (d === t ? ' — aujourd’hui' : ''))); } wk.appendChild(row(s)); }); }
  root.appendChild(wk);
  if (aPreparer.length) {
    var pb = h('section', { class: 'card' }, h('h2', null, '✏️ À préparer (14 prochains jours)'), h('p', { class: 'muted small' }, 'Séances prévues mais sans objectif coché.'));
    aPreparer.slice(0, 8).forEach(function (s) { pb.appendChild(row(s)); }); root.appendChild(pb);
  }
  var grid = h('section', null, h('h2', { class: 'sec-h' }, 'Mes classes'));
  var gl = h('div', { class: 'cards' });
  classes.forEach(function (c) {
    var M = Plan.compute(c.id), e = Ref.effective(c.niveau_id), tot = 0, vus = 0;
    e.chapitres.forEach(function (ch) { if (!Ref.portee(ch, c).ok) return; var s = Plan.chapStats(M, ch); tot += s.total; vus += s.vus; });
    var pct = tot ? Math.round(vus / tot * 100) : 0;
    var faites = Cls.seances(c.id).filter(function (s) { return s.statut === 'faite'; }).length;
    gl.appendChild(h('a', { class: 'card cls-card', href: '#/classe/' + c.id, style: { borderTopColor: c.couleur } },
      h('div', { class: 'cls-t' }, c.nom), h('div', { class: 'muted small' }, Cls.niveauLabel(c) + (c.groupement ? ' · gr. ' + c.groupement : '')),
      h('div', { class: 'bar' }, h('i', { style: { width: pct + '%', background: c.couleur } })), h('div', { class: 'small' }, pct + ' % du programme abordé · ' + plural(faites, 'séance faite', 'séances faites'))));
  });
  grid.appendChild(gl); root.appendChild(grid);
  var used = Res.usedBytes();
  if (used > Res.QUOTA * 0.8) root.appendChild(h('div', { class: 'card warnbox' }, '💾 Stockage presque plein : ' + fmtSize(used) + ' sur 1 Go. Supprimez des fichiers inutiles dans la Bibliothèque.'));
  return root;
};

function setStatut(s, v) {
  s.statut = v;
  if (v === 'faite' && !s.date_realisee) s.date_realisee = s.date_prevue || today();
  if (v !== 'faite') s.date_realisee = v === 'a_faire' || v === 'prete' ? null : s.date_realisee;
  DB.save('fs_seances', s);
}

/* ═══ Classes ═══ */
Views.classes = function () {
  var root = h('div', { class: 'page' });
  root.appendChild(pageHead('Mes classes', null, [h('a', { class: 'btn', href: '#/historique/tout' }, '📚 Historique des fiches'), h('button', { class: 'btn primary', type: 'button', onclick: function () { classModal(null); } }, '＋ Nouvelle classe')]));
  var list = Cls.all(); var cards = h('div', { class: 'cards' });
  if (!list.length) root.appendChild(h('div', { class: 'card hero' }, h('p', null, 'Aucune classe pour le moment.')));
  list.forEach(function (c) {
    cards.appendChild(h('a', { class: 'card cls-card' + (c.archive ? ' archived' : ''), href: '#/classe/' + c.id, style: { borderTopColor: c.couleur } },
      h('div', { class: 'cls-t' }, c.nom, c.archive ? h('em', { class: 'tag' }, 'archivée') : null),
      h('div', { class: 'muted small' }, Cls.niveauLabel(c) + (c.groupement ? ' · groupement ' + c.groupement : '') + ' · ' + c.annee_scolaire),
      h('div', { class: 'small' }, plural(Cls.sequences(c.id).length, 'séquence') + ' · ' + plural(Cls.seances(c.id).length, 'séance'))));
  });
  root.appendChild(cards); return root;
};

function classModal(cl) {
  var isNew = !cl;
  var d = cl ? clone(cl) : { nom: '', niveau_id: 'bp2', groupement: null, avec_pc: true, poursuite: false, metier: '', annee_scolaire: anneeScolaire(), couleur: K.PALETTE[Cls.all().length % K.PALETTE.length], creneaux: [], notes: '', archive: false, ordre: Cls.all().length };
  var nom = h('input', { class: 'inp', type: 'text', value: d.nom, placeholder: 'Ex. 2MRCU, 1CAP EPC, 3PM…' });
  var niv = UI.select(Ref.niveaux().map(function (n) { return [n.id, n.label]; }), d.niveau_id, function (v) { d.niveau_id = v; d.groupement = null; redraw(); });
  var dyn = h('div'); var cren = h('div', { class: 'cren' }); var sum = h('p', { class: 'small hrs-sum' });
  function drawSum() { sum.textContent = d.creneaux.length ? 'Heures par semaine — ' + hrsLabel(Plan.heuresHebdo(d)) : ''; }
  function redraw() {
    clear(dyn);
    var gs = Ref.groupementsPour(d.niveau_id);
    if (gs.length) dyn.appendChild(UI.field(d.niveau_id === 'cap' ? 'Groupement de spécialités (CAP)' : 'Groupement de spécialités (Bac Pro)', UI.select(gs, d.groupement || '', function (v) { d.groupement = v || null; }), 'Détermine les chapitres du programme proposés en priorité (le reste reste accessible).'));
    if (d.niveau_id.indexOf('bp') === 0) {
      dyn.appendChild(h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: d.avec_pc, onchange: function (e) { d.avec_pc = e.target.checked; } }), ' Spécialité avec enseignement de physique-chimie', h('span', { class: 'hint' }, ' (sinon, le module « Calculs commerciaux et financiers » est proposé)')));
    }
    if (d.niveau_id === 'bpt') dyn.appendChild(h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: d.poursuite, onchange: function (e) { d.poursuite = e.target.checked; } }), ' Préparation à une poursuite d’études (programme complémentaire)'));
  }
  function drawCren() {
    clear(cren);
    d.creneaux.forEach(function (c, i) {
      cren.appendChild(h('div', { class: 'cren-row' }, UI.select([[1, 'Lundi'], [2, 'Mardi'], [3, 'Mercredi'], [4, 'Jeudi'], [5, 'Vendredi'], [6, 'Samedi']], c.jour, function (v) { c.jour = +v; }, 'sm'),
        h('input', { class: 'inp sm', type: 'time', value: c.debut, onchange: function (e) { c.debut = e.target.value; } }),
        h('input', { class: 'inp sm num', type: 'number', min: 15, max: 480, step: 5, value: c.duree, onchange: function (e) { c.duree = +e.target.value || 55; drawSum(); } }), h('span', { class: 'muted small' }, 'min'),
        UI.select([[0, 'Toutes les semaines'], [1, 'Semaine 1'], [2, 'Semaine 2']], c.semaine || 0, function (v) { if (+v) c.semaine = +v; else delete c.semaine; drawSum(); }, 'sm'),
        UI.select([['', 'Classe entière'], ['G1', 'Groupe 1'], ['G2', 'Groupe 2']], c.groupe || '', function (v) { if (v) c.groupe = v; else delete c.groupe; drawSum(); }, 'sm'),
        UI.select(K.MATIERES.map(function (m) { return [m[0], m[1]]; }), matId(c), function (v) { if (v === 'maths') delete c.matiere; else c.matiere = v; }, 'sm'),
        h('button', { class: 'icon-btn sm', type: 'button', onclick: function () { d.creneaux.splice(i, 1); drawCren(); } }, '✕')));
    });
    cren.appendChild(h('button', { class: 'btn ghost small', type: 'button', onclick: function () { d.creneaux.push({ jour: 1, debut: '08:00', duree: 110, semaine: 1 }); drawCren(); } }, '＋ Ajouter un créneau hebdomadaire'));
    cren.appendChild(sum); drawSum();
  }
  redraw(); drawCren();
  var colors = h('div', { class: 'swatches' });
  function drawColors() { clear(colors); K.PALETTE.forEach(function (c) { colors.appendChild(h('button', { class: 'sw' + (d.couleur === c ? ' on' : ''), type: 'button', style: { background: c }, 'aria-label': 'Couleur ' + c, onclick: function () { d.couleur = c; drawColors(); } })); }); }
  drawColors();
  var metier = h('input', { class: 'inp', type: 'text', value: d.metier, placeholder: 'Ex. métiers de la relation client (vente, accueil, commerce)', onchange: function (e) { d.metier = e.target.value; } });
  var annee = h('input', { class: 'inp', type: 'text', value: d.annee_scolaire, placeholder: '2026-2027', onchange: function (e) { d.annee_scolaire = e.target.value.trim(); } });
  var body = h('div', { class: 'form' }, UI.field('Nom de la classe', nom), UI.field('Niveau / diplôme', niv), dyn,
    UI.field('Ancrage métier', metier, 'Pré-rempli dans les fiches pour relier les maths au métier.'), UI.field('Année scolaire', annee),
    h('div', { class: 'field' }, h('span', { class: 'lbl' }, 'Couleur'), colors), h('div', { class: 'field' }, h('span', { class: 'lbl' }, 'Créneaux hebdomadaires'), cren, h('span', { class: 'hint' }, 'Servent à proposer les dates des séances et à calculer les heures disponibles. Plus rapide : placez-les en glissant sur le planning (menu « Planning »).')),
    cl ? h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: d.archive, onchange: function (e) { d.archive = e.target.checked; } }), ' Archiver cette classe (masquée de l’accueil)') : null);
  var actions = [{ label: 'Annuler', kind: 'ghost' }];
  if (cl) actions.unshift({ label: 'Supprimer', kind: 'danger', onClick: function (m) { UI.ask('Supprimer la classe « ' + cl.nom + ' » avec toutes ses séquences et séances ? Cette action est définitive.', { ok: 'Supprimer définitivement', danger: true }).then(function (ok) { if (ok) { DB.remove('fs_classes', cl.id); m.close(); location.hash = '#/classes'; Views.rerender(); } }); return false; } });
  actions.push({ label: isNew ? 'Créer' : 'Enregistrer', kind: 'primary', onClick: function () {
    d.nom = nom.value.trim(); if (!d.nom) { UI.toast('Donnez un nom à la classe.', 'err'); return false; }
    if (!/^\d{4}-\d{4}$/.test(d.annee_scolaire || '')) { UI.toast('Année scolaire attendue au format 2026-2027.', 'err'); return false; }
    d.creneaux = d.creneaux.filter(function (c) { return c.debut && c.duree; });
    if (isNew) { var r = DB.create('fs_classes', d); location.hash = '#/classe/' + r.id; if (!DB.list('fs_calendrier').some(function (c) { return c.annee_scolaire === d.annee_scolaire; }) && Plan.PRESETS[d.annee_scolaire]) { importPreset(d.annee_scolaire); UI.toast('Calendrier scolaire (zone A) ajouté : à vérifier dans la classe.'); } }
    else { Object.assign(cl, d); DB.save('fs_classes', cl); }
    Views.rerender();
  } });
  UI.modal({ title: isNew ? 'Nouvelle classe' : 'Modifier la classe', body: body, actions: actions });
}
function hrsLabel(h2) {
  var t = 'S1 : ' + fmtDuree(h2.s1) + ' · S2 : ' + fmtDuree(h2.s2);
  if (h2.gs1 || h2.gs2) t += ' (+ demi-groupes : S1 ' + fmtDuree(h2.gs1) + ' · S2 ' + fmtDuree(h2.gs2) + ')';
  return t;
}
function importPreset(annee) {
  (Plan.PRESETS[annee] || []).forEach(function (p) { DB.create('fs_calendrier', { annee_scolaire: annee, class_id: null, type: p.type, label: p.label, debut: p.debut, fin: p.fin }); });
}

/* ═══ Page d’une classe ═══ */
Views.classe = function (id) {
  var c = Cls.get(id); if (!c) return notFound();
  var root = h('div', { class: 'page' });
  root.appendChild(pageHead(c.nom, Cls.niveauLabel(c) + (c.groupement ? ' · groupement ' + c.groupement : '') + (c.metier ? ' · ' + c.metier : '') + ' · ' + c.annee_scolaire,
    [h('a', { class: 'btn', href: '#/progression/' + c.id }, '📈 Progression'), h('a', { class: 'btn', href: '#/historique/' + c.id }, '📚 Historique'), h('button', { class: 'btn', type: 'button', onclick: function () { classModal(c); } }, '✎ Modifier'),
    h('button', { class: 'btn', type: 'button', onclick: function () { var q = createSequence(c, { titre: 'Nouvelle séquence' }); location.hash = '#/sequence/' + q.id; } }, '＋ Séquence'),
    h('button', { class: 'btn primary', type: 'button', onclick: function () { Wizard.seance({ classId: c.id }); } }, '＋ Séance'),
    h('button', { class: 'btn', type: 'button', onclick: function () { Tpl.open({ mode: 'create', cl: c }); } }, '📥 Séance depuis un modèle')], ['#/classes', 'Classes']));

  /* séquences */
  var seqs = Cls.sequences(c.id);
  var secSeq = h('section', { class: 'card' }, h('h2', null, 'Séquences'));
  var list = h('div', { class: 'seq-list' });
  if (!seqs.length) secSeq.appendChild(h('p', { class: 'muted' }, 'Aucune séquence. Une séquence regroupe plusieurs séances autour d’un ou plusieurs chapitres.'));
  seqs.forEach(function (q) {
    var ss = Cls.seancesDe(q.id), dur = ss.reduce(function (n, s) { return n + (s.statut === 'annulee' ? 0 : s.duree_min); }, 0), faites = ss.filter(function (s) { return s.statut === 'faite'; }).length;
    var dates = ss.map(Plan.seanceDate).filter(Boolean).sort();
    list.appendChild(h('div', { class: 'seq-row sort-item', 'data-id': q.id }, h('span', { class: 'grip', title: 'Glisser pour réordonner' }, '⠿'),
      h('div', { class: 'seq-main' }, h('a', { href: '#/sequence/' + q.id, class: 'seq-t' }, q.titre || '(sans titre)'),
        h('div', { class: 'muted small' }, plural(ss.length, 'séance') + ' · ' + fmtDuree(dur) + (dates.length ? ' · ' + fmtDM(dates[0]) + ' → ' + fmtDM(dates[dates.length - 1]) : '') + ' · ' + faites + ' faite' + (faites > 1 ? 's' : ''))),
      h('span', { class: 'chip st-' + q.statut }, lbl(K.STATUTS_SEQ, q.statut))));
  });
  if (seqs.length) { secSeq.appendChild(list); UI.sortable(list, { item: '.sort-item', handle: '.grip', onSort: function (ids) { ids.forEach(function (sid, i) { var q = DB.byId('fs_sequences', sid); if (q && q.ordre !== i + 1) { q.ordre = i + 1; DB.save('fs_sequences', q); } }); } }); }
  root.appendChild(secSeq);

  /* séances hors séquence */
  var libres = Cls.seances(c.id).filter(function (s) { return !s.sequence_id; });
  if (libres.length) {
    var sl = h('section', { class: 'card' }, h('h2', null, 'Séances hors séquence'));
    libres.forEach(function (s) { sl.appendChild(h('div', { class: 'row-s' }, h('a', { class: 'row-t', href: '#/seance/' + s.id }, s.titre || '(sans titre)'), h('span', { class: 'muted small' }, (Plan.seanceDate(s) ? fmtDL(Plan.seanceDate(s)) + ' · ' : '') + fmtDuree(s.duree_min)), h('span', { class: 'chip st-' + s.statut }, lbl(K.STATUTS_SEANCE, s.statut)))); });
    root.appendChild(sl);
  }
  root.appendChild(calendarCard(c));
  return root;
};

function calendarCard(c) {
  var box = h('section', { class: 'card' }, h('h2', null, 'Calendrier de la classe'));
  var info = h('p', { class: 'muted small' }, 'Vacances, jours fériés, PFMP, examens : ces périodes sont évitées quand l’outil propose les dates des séances.');
  var list = h('div', { class: 'cal-list' });
  function draw() {
    clear(list);
    var rs = DB.list('fs_calendrier').filter(function (r) { return r.annee_scolaire === c.annee_scolaire && (!r.class_id || r.class_id === c.id); }).sort(function (a, b) { return a.debut < b.debut ? -1 : 1; });
    if (!rs.length) list.appendChild(h('p', { class: 'muted' }, 'Aucune période enregistrée.'));
    rs.forEach(function (r) {
      list.appendChild(h('div', { class: 'cal-row' }, h('span', { class: 'chip cal-' + r.type }, r.type === 'pfmp' ? 'PFMP' : lbl([['vacances', 'Vacances'], ['ferie', 'Férié'], ['examen', 'Examen'], ['sortie', 'Sortie'], ['autre', 'Autre']], r.type)),
        h('span', { class: 'cal-l' }, r.label || '—', r.class_id ? h('em', { class: 'tag' }, 'cette classe') : h('em', { class: 'tag' }, 'toutes')), h('span', { class: 'muted small' }, fmtD(r.debut) + (r.fin !== r.debut ? ' → ' + fmtD(r.fin) : '')),
        h('button', { class: 'icon-btn sm', type: 'button', onclick: function () { DB.remove('fs_calendrier', r.id); draw(); } }, '✕')));
    });
  }
  draw();
  var btns = h('div', { class: 'row-gap' }, h('button', { class: 'btn small', type: 'button', onclick: function () { calModal(c, draw); } }, '＋ Ajouter une période (PFMP, examen…)'));
  if (Plan.PRESETS[c.annee_scolaire] && !DB.list('fs_calendrier').some(function (r) { return r.annee_scolaire === c.annee_scolaire && !r.class_id; })) {
    btns.appendChild(h('button', { class: 'btn small', type: 'button', onclick: function () { importPreset(c.annee_scolaire); draw(); UI.toast('Calendrier zone A importé : vérifiez-le avec celui de votre établissement.'); } }, '📅 Importer le calendrier zone A ' + c.annee_scolaire));
  }
  var cr = (c.creneaux || []).length ? 'Créneaux : ' + c.creneaux.map(function (x) { return jourNom(x.jour) + ' ' + x.debut + ' (' + fmtDuree(x.duree) + ')' + (x.semaine ? ' S' + x.semaine : '') + (x.groupe ? ' ' + x.groupe : '') + (matId(x) !== 'maths' ? ' · ' + matLabel(x) : ''); }).join(' · ') + ' — ' + hrsLabel(Plan.heuresHebdo(c)) : 'Aucun créneau hebdomadaire : ajoutez-en dans « Modifier » pour obtenir des dates suggérées.';
  box.appendChild(info); box.appendChild(h('p', { class: 'small' }, cr)); box.appendChild(list); box.appendChild(btns);
  return box;
}
function calModal(c, done) {
  var d = { type: 'pfmp', label: '', debut: today(), fin: today(), global: false };
  var lab = h('input', { class: 'inp', type: 'text', placeholder: 'Ex. PFMP 1, épreuve ponctuelle, sortie…', oninput: function (e) { d.label = e.target.value; } });
  var body = h('div', { class: 'form' }, UI.field('Type', UI.select([['pfmp', 'PFMP (stage)'], ['examen', 'Examen / épreuve'], ['sortie', 'Sortie / voyage'], ['vacances', 'Vacances'], ['ferie', 'Jour férié'], ['autre', 'Autre']], d.type, function (v) { d.type = v; })), UI.field('Intitulé', lab),
    h('div', { class: 'two' }, UI.field('Du', h('input', { class: 'inp', type: 'date', value: d.debut, onchange: function (e) { d.debut = e.target.value; if (d.fin < d.debut) d.fin = d.debut; } })), UI.field('Au (inclus)', h('input', { class: 'inp', type: 'date', value: d.fin, onchange: function (e) { d.fin = e.target.value; } }))),
    h('label', { class: 'check' }, h('input', { type: 'checkbox', onchange: function (e) { d.global = e.target.checked; } }), ' Concerne toutes mes classes'));
  UI.modal({ title: 'Ajouter une période', body: body, actions: [{ label: 'Annuler', kind: 'ghost' }, { label: 'Ajouter', kind: 'primary', onClick: function () {
    if (!d.debut || !d.fin || d.fin < d.debut) { UI.toast('Dates invalides.', 'err'); return false; }
    DB.create('fs_calendrier', { annee_scolaire: c.annee_scolaire, class_id: d.global ? null : c.id, type: d.type, label: d.label.trim(), debut: d.debut, fin: d.fin }); done();
  } }] });
}

function notFound() { return h('div', { class: 'page' }, h('div', { class: 'card hero' }, h('h2', null, 'Introuvable'), h('p', null, 'Cet élément n’existe plus ou n’a pas encore été chargé.'), h('a', { class: 'btn primary', href: '#/' }, 'Retour à l’accueil'))); }
