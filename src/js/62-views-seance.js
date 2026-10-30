/* ═══ FICHES · éditeur de séance + assistant de création ═══ */
'use strict';

var DEROULES = {
  cours: [['accroche', 10, 'collectif'], ['recherche', 15, 'binomes'], ['cours', 15, 'collectif'], ['exercices', 15, 'individuel']],
  activite: [['accroche', 5, 'collectif'], ['recherche', 35, 'groupes'], ['bilan', 15, 'collectif']],
  exercices: [['automatismes', 10, 'individuel'], ['exercices', 35, 'individuel'], ['bilan', 10, 'collectif']],
  automatismes: [['automatismes', 20, 'individuel'], ['bilan', 10, 'collectif']],
  evaluation: [['evaluation', 45, 'individuel'], ['bilan', 10, 'collectif']],
  revision: [['automatismes', 10, 'individuel'], ['exercices', 35, 'binomes'], ['bilan', 10, 'collectif']],
  ap: [['accroche', 5, 'collectif'], ['exercices', 40, 'individuel'], ['bilan', 10, 'collectif']]
};

function defaultPhases(type, duree) {
  var m = DEROULES[type]; if (!m) return [];
  var base = m.reduce(function (a, x) { return a + x[1]; }, 0), k = duree / base;
  return m.map(function (x) { return { phase: x[0], duree: Math.max(5, Math.round(x[1] * k / 5) * 5), orga: x[2], contenu: '' }; });
}

Views.seance = function (id) {
  var s = DB.byId('fs_seances', id); if (!s) return notFound();
  var cl = Cls.get(s.class_id); if (!cl) return notFound();
  normData(s, 'seance', cl);
  var d = s.data, save = Ed.saver('fs_seances', s);
  var root = h('div', { class: 'page' });
  var seq = s.sequence_id ? DB.byId('fs_sequences', s.sequence_id) : null;
  var dyn = h('div'); var head;

  var flush = function () { save.now(); };
  function goTo(txt) { Guide.goSection(txt); }
  function pronoteBtn(c) { return h('button', { class: 'btn ' + (c || ''), type: 'button', title: 'Rédiger et copier la synthèse pour le cahier de textes Pronote', onclick: function () { goTo('Pronote'); } }, '📋 Pronote'); }
  function tplBtn(c) { return h('button', { class: 'btn ' + (c || ''), type: 'button', title: 'Pré-remplir cette séance avec une proposition d’1 h tirée du programme, ou avec un de vos modèles', onclick: function () { save.now(); Tpl.open({ mode: 'load', seance: s, cl: cl }); } }, '📥 Charger un modèle'); }
  function modelBtn() { return h('button', { class: 'btn c5', type: 'button', title: 'Garder cette séance comme modèle réutilisable', onclick: function () { save.now(); Tpl.saveAsModel(s, cl); } }, '💾 Enregistrer comme modèle'); }
  function persoBtn(c) { return h('button', { class: 'btn ' + (c || ''), type: 'button', title: 'Mémo personnel appuyé sur mes manuels (pas pour Pronote)', onclick: function () { goTo('Mémo perso'); } }, '🔒 Mémo manuels'); }
  function manBtn(c) { return h('button', { class: 'btn ' + (c || ''), type: 'button', title: 'Aller à la section Manuel (chapitre, pages, exercices)', onclick: function () { goTo('Manuel'); } }, '📘 Manuel'); }
  function progBtn(c) { return h('button', { class: 'btn ' + (c || ''), type: 'button', title: 'Cocher les objectifs et notions du programme', onclick: function () { goTo('Programme'); } }, '☑ Programme'); }
  function resBtn(c) { return h('button', { class: 'btn ' + (c || ''), type: 'button', title: 'PDF, liens, vidéos, pages de vos manuels', onclick: function () { goTo('Ressources'); } }, '📎 Ressources'); }
  function dupBtn() { return h('button', { class: 'btn', type: 'button', onclick: function () { save.now(); var n = duplicateSeance(s); UI.toast('Séance dupliquée.'); location.hash = '#/seance/' + n.id; } }, '⧉ Dupliquer'); }
  head = pageHead(s.titre || 'Nouvelle séance', cl.nom + ' · ' + lbl(K.TYPES, s.type) + (seq ? ' · ' + seq.titre : ''),
    Exp.buttons('seance', s, flush),
    (Annee.from && Annee.from.sid === s.id) ? ['#/annee', 'Mon emploi du temps (semaine du ' + fmtDM(Annee.from.week) + ')'] : seq ? ['#/sequence/' + seq.id, seq.titre || 'Séquence'] : ['#/classe/' + cl.id, cl.nom]);
  root.appendChild(head);

  /* barre d’actions rapides, en couleurs : un toucher et on est dans la bonne partie de la fiche */
  root.appendChild(h('nav', { class: 'qbar', 'aria-label': 'Aller directement à…' }, h('span', { class: 'qbar-l' }, 'Aller à'),
    tplBtn('c1'), Man.enabled() ? manBtn('c2') : progBtn('c2'), resBtn('c3'), pronoteBtn('c4'), APP.manuels ? null : persoBtn('c5')));
  var startBox = h('div'), startHidden = false;
  function drawStart() {
    clear(startBox);
    var vide = !(d.items || []).length && !((d.manuel && d.manuel.notions) || []).length && !(d.manuel && (d.manuel.exos || []).length) && !String(d.objectif || '').trim();
    if (!vide || startHidden || s.statut === 'faite') return;
    function tile(c, t, sub, fn) { return h('button', { class: 'tile-btn ' + c, type: 'button', onclick: fn }, h('strong', null, t), h('span', null, sub)); }
    startBox.appendChild(h('section', { class: 'card start-card' }, h('h2', null, '🚀 Par où commencer ?'),
      h('p', { class: 'muted small' }, 'Choisissez un point de départ. Tout reste modifiable ensuite.'),
      h('div', { class: 'start-grid' },
        tile('c1', '📥 Partir d’un modèle d’1 h', Man.enabled() ? 'Une séance prête par notion du manuel, ou un de vos modèles' : 'Une proposition prête à l’emploi tirée du programme, ou un de vos modèles', function () { save.now(); Tpl.open({ mode: 'load', seance: s, cl: cl }); }),
        Man.enabled() ? tile('c2', '📘 Choisir dans le manuel', 'Chapitre, notions et exercices à cocher', function () { goTo('Manuel'); }) : tile('c2', '☑ Cocher dans le programme', 'Objectifs et notions du BO', function () { goTo('Programme'); }),
        tile('c4', '✏️ Page blanche', 'Je remplis moi-même', function () { startHidden = true; drawStart(); goTo('Déroulé'); }))));
  }
  drawStart(); root.appendChild(startBox);

  function refreshHead() { var t = $('h1', head); t.textContent = s.titre || 'Nouvelle séance'; }

  /* ── informations générales ── */
  var titre = UI.textinput(function () { return s.titre; }, function (v) { s.titre = v; save(); refreshHead(); }, 'Ex. Calculer une proportion');
  var durInp = h('input', { class: 'inp num', type: 'number', min: 5, max: 480, step: 5, value: s.duree_min, onchange: function (e) { s.duree_min = Math.max(5, +e.target.value || 55); save(); drawDyn(); } });
  var seqOpts = [['', '— hors séquence —']].concat(Cls.sequences(cl.id).map(function (q) { return [q.id, q.titre || '(sans titre)']; }));
  var info = h('section', { class: 'card' },
    h('div', { class: 'grid2' }, UI.field('Titre de la séance', titre),
      UI.field('Séquence', UI.select(seqOpts, s.sequence_id || '', function (v) { s.sequence_id = v || null; save.now(); Views.rerender(); }))),
    h('div', { class: 'grid4' },
      UI.field('Type', UI.select(K.TYPES, s.type, function (v) { s.type = v; save(); drawDyn(); })),
      UI.field('Modalité', UI.select(K.MODALITES, s.modalite, function (v) { s.modalite = v; if (v === 'demi_groupe' && !s.groupe) s.groupe = 'G1'; if (v !== 'demi_groupe') s.groupe = null; save(); drawModalite(); drawDyn(); })),
      UI.field('Durée (min)', durInp),
      UI.field('Statut', UI.select(K.STATUTS_SEANCE, s.statut, function (v) { setStatut(s, v); save.now(); Views.rerender(); }))),
    h('div', { class: 'grid2' },
      Ed.dateField(cl, s, 'date_prevue', save, 'Date prévue', { onDate: function () { /* rien */ } }),
      Ed.dateField(cl, s, 'date_realisee', save, 'Date réalisée', { suggest: false, today: true })));
  root.appendChild(info);

  /* ── modalité : demi-groupes, jumelle ── */
  var modBox = h('div');
  function drawModalite() {
    clear(modBox);
    if (s.modalite === 'demi_groupe') {
      var twin = s.jumelle_id ? DB.byId('fs_seances', s.jumelle_id) : null;
      var box = h('section', { class: 'card info-card' }, h('h2', null, '👥 Demi-groupe'),
        h('div', { class: 'row-gap' }, UI.field('Groupe concerné', UI.select([['G1', 'Groupe 1'], ['G2', 'Groupe 2']], s.groupe || 'G1', function (v) { s.groupe = v; save(); })),
          twin ? h('a', { class: 'btn', href: '#/seance/' + twin.id }, '→ Séance de l’autre groupe : ' + (twin.titre || '(sans titre)')) :
            h('button', { class: 'btn', type: 'button', onclick: function () {
              save.now();
              var other = (s.groupe || 'G1') === 'G1' ? 'G2' : 'G1';
              var t = createSeance(cl, { sequence_id: s.sequence_id, titre: s.titre, type: s.type, modalite: 'demi_groupe', groupe: other, jumelle_id: s.id, duree_min: s.duree_min, data: clone(s.data) });
              t.data.bilan = { realise: '', notes: '', a_reprendre: '' }; t.data.pronote = { contenu: '', travail: '', temps: '' }; DB.save('fs_seances', t);
              Res.of(s.id).forEach(function (x) { Res.attach('seance', t.id, x.res.id, x.att.usage); });
              s.jumelle_id = t.id; save.now(); UI.toast('Séance du groupe ' + other.slice(1) + ' créée (copie à adapter).'); drawModalite();
            } }, '＋ Créer la séance de l’autre demi-groupe')),
        h('p', { class: 'muted small' }, 'Chaque demi-groupe a sa propre fiche, ses dates et son bilan. Seule la séance « faite » alimente la progression : si les deux groupes font la même chose, un seul passage suffit pour la progression de la classe.'));
      modBox.appendChild(box);
    } else if (s.modalite === 'demi_groupes_paralleles') {
      modBox.appendChild(h('section', { class: 'card info-card' }, h('h2', null, '👥 Deux demi-groupes en parallèle'),
        h('p', { class: 'muted small' }, 'Même créneau : décrivez ce que fait chaque groupe (ex. salle informatique / exercices en classe), puis ils permutent.'),
        h('div', { class: 'grid2' }, d.groupes.map(function (g, i) {
          return h('div', null, UI.field('Nom du groupe', UI.textinput(function () { return g.nom; }, function (v) { g.nom = v; save(); }, 'Groupe ' + (i + 1))),
            UI.field('Activité du groupe', UI.textarea(function () { return g.contenu; }, function (v) { g.contenu = v; save(); }, i ? 'Ex. exercices sur feuille' : 'Ex. tableur en salle info', 4)));
        }))));
    } else if (s.modalite === 'co_intervention') {
      if (d.notes_co === undefined) d.notes_co = '';
      modBox.appendChild(h('section', { class: 'card info-card' }, h('h2', null, '🤝 Co-intervention'), Ed.area('Répartition des rôles', d, 'notes_co', save, 'Qui fait quoi (maths / enseignement professionnel) ?', 2)));
    }
  }
  drawModalite(); root.appendChild(modBox);

  /* ── objectif + programme ── */
  var countEl = h('span', { class: 'badge' }, String(d.items.length));
  var objField = Ed.area('Objectif de la séance (en une phrase)', d, 'objectif', save, 'À la fin de la séance, l’élève sait…', 2);
  var panel = Ed.itemsPanel({ rec: s, cl: cl, changed: save, withNiv: true, kinds: ['o', 'k', 'a'], onCount: function (n) { countEl.textContent = String(n); } });
  if (Man.enabled()) root.appendChild(Man.section(s, cl, save));
  var secP = UI.section('sea-prog', 'Programme : objectifs, notions, compétences', [objField, panel], { open: !Man.enabled() });
  $('summary', secP).appendChild(countEl); root.appendChild(secP);

  /* ── contenu dépendant du type (déroulé, matériel, évaluation, DM) ── */
  root.appendChild(dyn);
  function drawDyn() {
    clear(dyn);
    /* 1 · préparer : déroulé, évaluation, ressources, devoir maison */
    dyn.appendChild(deroule());
    if (s.type === 'evaluation') dyn.appendChild(UI.section('sea-eval', 'Évaluation : critères et barème', [Ed.area('Critères de réussite / compétences évaluées', d.eval, 'criteres', save, 'Ex. S’approprier : repère la bonne donnée (1 pt)…', 4), Ed.area('Barème', d.eval, 'bareme', save, 'Ex. Ex.1 : 4 pts ; Ex.2 : 6 pts…', 3)], { open: true }));
    dyn.appendChild(UI.section('sea-res', 'Ressources (PDF, liens, vidéos, pages de mes manuels)', [Res.block('seance', s, function () { /* rien */ })], { open: true }));
    dyn.appendChild(dmSection());
    /* 2 · le reste, replié : on l’ouvre seulement si besoin */
    var mat = h('div', { class: 'chips' });
    K.MATERIEL.forEach(function (m) {
      var on = d.materiel.indexOf(m[0]) >= 0;
      mat.appendChild(h('button', { class: 'chip' + (on ? ' on' : ''), type: 'button', 'aria-pressed': on ? 'true' : 'false', onclick: function () { var i = d.materiel.indexOf(m[0]); if (i >= 0) d.materiel.splice(i, 1); else d.materiel.push(m[0]); save(); drawDyn(); } }, m[1]));
    });
    var plus = h('details', { class: 'more' }, h('summary', null, h('strong', null, '⚙️ Plus d’options'), h('span', { class: 'muted small' }, 'prérequis, matériel, différenciation, trace écrite')),
      h('div', { class: 'more-b' },
        UI.section('sea-pre', 'Prérequis et ancrage', [h('div', { class: 'grid2' }, Ed.area('Prérequis', d, 'prerequis', save, 'Ce qui doit être acquis', 2), Ed.area('Ancrage métier / contexte', d, 'ancrage', save, 'Situation professionnelle ou de la vie courante', 2))], { open: false }),
        UI.section('sea-mat', 'Matériel', [mat, Ed.line('Autre matériel', d, 'materiel_libre', save, 'Ex. dés, ficelle, thermomètre…')], { open: false }),
        UI.section('sea-diff', 'Différenciation', [Ed.diffBlock(d, save, true)], { open: false }),
        UI.section('sea-trace', 'Trace écrite / ce que les élèves notent', [Ed.area('Trace écrite', d, 'trace', save, 'Définitions, méthode, exemple…', 5)], { open: false })));
    dyn.appendChild(plus);
    /* 3 · après la séance */
    dyn.appendChild(bilan());
    dyn.appendChild(Pronote.section(s, cl, d, save));
    if (!APP.manuels) dyn.appendChild(Pronote.perso(s, cl, d, save));
    dyn.appendChild(Ed.actionBar(Exp.buttons('seance', s, flush).concat([modelBtn(), dupBtn(), h('span', { class: 'grow' }), h('button', { class: 'btn danger', type: 'button', onclick: function () {
      UI.ask('Supprimer la séance « ' + (s.titre || 'sans titre') + ' » ?', { ok: 'Supprimer', danger: true }).then(function (ok) {
        if (ok) { var back = s.sequence_id ? '#/sequence/' + s.sequence_id : '#/classe/' + cl.id; DB.list('fs_seances').forEach(function (x) { if (x.jumelle_id === s.id) { x.jumelle_id = null; DB.save('fs_seances', x); } }); DB.remove('fs_seances', s.id); location.hash = back; }
      });
    } }, 'Supprimer la séance')])));
  }

  function deroule() {
    var box = h('div'); var tot = h('div', { class: 'totals' });
    function sum() { var n = d.phases.reduce(function (a, p) { return a + (+p.duree || 0); }, 0); tot.textContent = 'Total du déroulé : ' + n + ' min sur ' + s.duree_min + ' min' + (n > s.duree_min ? ' ⚠ dépasse la durée de la séance' : n < s.duree_min ? ' (' + (s.duree_min - n) + ' min non planifiées)' : ' ✓'); tot.className = 'totals' + (n > s.duree_min ? ' warnt' : ''); }
    function draw() {
      clear(box);
      var list = h('div', { class: 'phases' });
      d.phases.forEach(function (p, i) {
        list.appendChild(h('div', { class: 'phase sort-item', 'data-id': String(i) }, h('span', { class: 'grip', title: 'Glisser pour réordonner' }, '⠿'),
          h('div', { class: 'ph-body' },
            h('div', { class: 'ph-top' }, UI.select(K.PHASES, p.phase, function (v) { p.phase = v; save(); }, 'sm'), h('input', { class: 'inp sm num', type: 'number', min: 1, max: 240, value: p.duree, 'aria-label': 'Durée en minutes', onchange: function (e) { p.duree = +e.target.value || 0; save(); sum(); } }), h('span', { class: 'muted small' }, 'min'),
              UI.select(K.ORGA, p.orga || 'collectif', function (v) { p.orga = v; save(); }, 'sm'), h('button', { class: 'icon-btn sm', type: 'button', onclick: function () { d.phases.splice(i, 1); save(); draw(); } }, '✕')),
            UI.textarea(function () { return p.contenu; }, function (v) { p.contenu = v; save(); }, 'Ce que fait le professeur / ce que font les élèves…', 2))));
      });
      if (!d.phases.length) box.appendChild(h('p', { class: 'muted' }, 'Aucune phase. Ajoutez-en ou partez d’un modèle selon le type de séance.'));
      else { box.appendChild(list); UI.sortable(list, { item: '.sort-item', handle: '.grip', onSort: function (ids) { var old = d.phases.slice(); d.phases = ids.map(function (i) { return old[+i]; }); save(); draw(); } }); }
      var DUR = { accroche: 10, recherche: 15, cours: 15, exercices: 15, automatismes: 10, bilan: 10, evaluation: 45, autre: 10 };
      box.appendChild(h('div', { class: 'row-gap phase-add' },
        h('button', { class: 'btn small c1', type: 'button', title: 'Remplir le déroulé avec le modèle de ce type de séance', onclick: function () {
          var m = DEROULES[s.type]; if (!m) { UI.toast('Pas de modèle pour ce type.'); return; }
          var go = function () { d.phases = defaultPhases(s.type, s.duree_min); save(); draw(); };
          if (d.phases.length) UI.ask('Remplacer le déroulé actuel par le modèle « ' + lbl(K.TYPES, s.type) + ' » ?', { ok: 'Remplacer' }).then(function (ok) { if (ok) go(); }); else go();
        } }, '✨ Modèle « ' + lbl(K.TYPES, s.type) + ' »'),
        h('span', { class: 'muted small' }, 'Ajouter :'),
        K.PHASES.filter(function (x) { return x[0] !== 'autre'; }).map(function (x) {
          return h('button', { class: 'chip', type: 'button', title: 'Ajouter une phase « ' + x[1] + ' »', onclick: function () { d.phases.push({ phase: x[0], duree: DUR[x[0]] || 10, orga: x[0] === 'exercices' ? 'individuel' : x[0] === 'recherche' ? 'binomes' : 'collectif', contenu: '' }); save(); draw(); } }, '＋ ' + x[1].split(' /')[0]);
        })));
      box.appendChild(tot); sum();
    }
    draw();
    return UI.section('sea-dero', 'Déroulé', [box], { open: true });
  }

  function dmSection() {
    var dm = d.dm; var inner = h('div');
    function draw() {
      clear(inner);
      inner.appendChild(h('label', { class: 'check big' }, h('input', { type: 'checkbox', checked: dm.actif, onchange: function (e) { dm.actif = e.target.checked; save(); draw(); } }), ' Un devoir maison est donné à la suite de cette séance'));
      if (!dm.actif) return;
      inner.appendChild(h('div', { class: 'grid2' }, Ed.line('Titre du DM', dm, 'titre', save, 'Ex. DM n°2 — pourcentages'),
        UI.field('Destinataires', UI.select(K.DM_POUR, dm.pour, function (v) { dm.pour = v; save(); }), 'Ex. demi-groupe 2 uniquement, ou toute la classe.')));
      inner.appendChild(Ed.area('Consigne / énoncé', dm, 'consigne', save, 'Exercices à faire, pages du manuel, lien vers la fiche…', 3));
      inner.appendChild(h('div', { class: 'grid2' }, UI.field('À rendre pour le', h('input', { class: 'inp', type: 'date', value: dm.rendu || '', onchange: function (e) { dm.rendu = e.target.value || ''; save(); } })),
        UI.field('Durée estimée (min)', h('input', { class: 'inp num', type: 'number', min: 5, max: 240, step: 5, value: dm.duree_min, onchange: function (e) { dm.duree_min = +e.target.value || 30; save(); } }))));
    }
    draw();
    return UI.section('sea-dm', 'Devoir maison', [inner], { open: dm.actif });
  }

  function bilan() {
    var b = d.bilan;
    var reprise = h('button', { class: 'btn small', type: 'button', onclick: function () {
      save.now();
      var t = createSeance(cl, { sequence_id: s.sequence_id, titre: 'Reprise — ' + (s.titre || 'séance'), type: 'revision', duree_min: s.duree_min, data: clone(s.data) });
      t.data.items = t.data.items.map(function (it) { it.niv = 'maitrise'; return it; }); t.data.notes = b.a_reprendre || ''; t.data.bilan = { realise: '', notes: '', a_reprendre: '' }; t.data.pronote = { contenu: '', travail: '', temps: '' }; t.data.phases = []; DB.save('fs_seances', t);
      UI.toast('Séance de reprise créée.'); location.hash = '#/seance/' + t.id;
    } }, '↻ Créer une séance de reprise');
    return UI.section('sea-bilan', 'Bilan après la séance', [Ed.area('Ce qui a été réalisé', b, 'realise', save, 'Écart entre le prévu et le réalisé', 2), Ed.area('Observations (réussites, difficultés)', b, 'notes', save, '', 3), Ed.area('À reprendre', b, 'a_reprendre', save, 'Ce qu’il faudra revoir à la prochaine séance', 2), reprise, Ed.area('Notes personnelles', d, 'notes', save, '', 2)], { open: s.statut === 'faite' });
  }
  drawDyn();
  return root;
};

/* ═══ Assistant de création de séance ═══ */
var Wizard = {
  seance: function (opt) {
    opt = opt || {};
    var cls = Cls.actives(); if (!cls.length) { UI.toast('Créez d’abord une classe.'); location.hash = '#/classes'; return; }
    var lastId = Store.get('last_class');
    var cid = opt.classId || (opt.sequenceId && DB.byId('fs_sequences', opt.sequenceId) && DB.byId('fs_sequences', opt.sequenceId).class_id) || (Cls.get(lastId) && !Cls.get(lastId).archive ? lastId : cls[0].id);
    var st = { classId: cid, seqId: opt.sequenceId || '', type: 'cours', modalite: 'classe', groupe: 'G1', duree: 0, titre: '', datee: true, reprise: 'remaining' };
    st.duree = defaultDuree(Cls.get(st.classId));
    var form = h('div', { class: 'form' });
    function seqsOf(c) { return Cls.sequences(c); }
    function remaining(seq, c) {
      var done = {}; Cls.seances(c).filter(function (x) { return x.statut === 'faite'; }).forEach(function (x) { (x.data.items || []).forEach(function (it) { done[it.ref] = true; }); });
      return (seq.data.items || []).filter(function (it) { return !done[it.ref]; });
    }
    function draw() {
      clear(form); var cl = Cls.get(st.classId);
      var seqs = seqsOf(cl.id); if (st.seqId && !seqs.some(function (q) { return q.id === st.seqId; })) st.seqId = '';
      form.appendChild(h('div', { class: 'grid2' },
        UI.field('Classe', UI.select(cls.map(function (c) { return [c.id, c.nom]; }), st.classId, function (v) { st.classId = v; st.duree = defaultDuree(Cls.get(v)); draw(); })),
        UI.field('Séquence', UI.select([['', '— hors séquence —']].concat(seqs.map(function (q) { return [q.id, q.titre || '(sans titre)']; })), st.seqId, function (v) { st.seqId = v; draw(); }))));
      form.appendChild(h('div', { class: 'grid3' }, UI.field('Type', UI.select(K.TYPES, st.type, function (v) { st.type = v; })),
        UI.field('Modalité', UI.select(K.MODALITES, st.modalite, function (v) { st.modalite = v; draw(); })),
        UI.field('Durée (min)', h('input', { class: 'inp num', type: 'number', min: 5, max: 480, step: 5, value: st.duree, onchange: function (e) { st.duree = +e.target.value || 55; } }))));
      if (st.modalite === 'demi_groupe') form.appendChild(UI.field('Groupe', UI.select([['G1', 'Groupe 1'], ['G2', 'Groupe 2']], st.groupe, function (v) { st.groupe = v; })));
      form.appendChild(UI.field('Titre (facultatif)', h('input', { class: 'inp', type: 'text', value: st.titre, placeholder: 'Rempli automatiquement si vide', oninput: function (e) { st.titre = e.target.value; } })));
      if (st.seqId) {
        var seq = DB.byId('fs_sequences', st.seqId), rest = remaining(seq, cl.id);
        if ((seq.data.items || []).length) form.appendChild(UI.field('Objectifs de départ', UI.select([['none', 'Aucun (je coche moi-même)'], ['remaining', 'Ceux de la séquence pas encore traités (' + rest.length + ')'], ['all', 'Tous ceux de la séquence (' + seq.data.items.length + ')']], st.reprise, function (v) { st.reprise = v; })));
      }
      if ((cl.creneaux || []).length) form.appendChild(h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: st.datee, onchange: function (e) { st.datee = e.target.checked; } }), ' Proposer le prochain créneau libre de la classe'));
    }
    draw();
    UI.modal({ title: 'Nouvelle séance', body: form, actions: [{ label: 'Annuler', kind: 'ghost' }, { label: 'Créer et ouvrir', kind: 'primary', onClick: function () {
      var cl = Cls.get(st.classId); Store.set('last_class', cl.id);
      var init = { sequence_id: st.seqId || null, type: st.type, modalite: st.modalite, groupe: st.modalite === 'demi_groupe' ? st.groupe : null, duree_min: st.duree, titre: st.titre.trim() };
      if (st.datee && (cl.creneaux || []).length) init.date_prevue = nextDateFor(cl, st.seqId);
      var seq = st.seqId ? DB.byId('fs_sequences', st.seqId) : null;
      var s = createSeance(cl, init);
      if (seq && st.reprise !== 'none') {
        var its = st.reprise === 'all' ? (seq.data.items || []) : remaining(seq, cl.id);
        s.data.items = its.map(function (it) { var c = clone(it); c.niv = defaultNiv(st.type); return c; });
        s.data.chapitres = []; its.forEach(function (it) { if (it.chap && s.data.chapitres.indexOf(it.chap) < 0) s.data.chapitres.push(it.chap); });
        s.data.competences = seq.data.competences.slice(); s.data.comp_caps = (seq.data.comp_caps || []).slice(); s.data.comp_manual = seq.data.comp_manual; if (seq.data.ancrage) s.data.ancrage = seq.data.ancrage;
      }
      if (!s.titre) {
        var first = (s.data.items || []).filter(function (x) { return x.chap; })[0], l = first && Ref.lookup(first.chap);
        s.titre = (seq ? seq.titre : (l ? l.txt : lbl(K.TYPES, st.type))) + (seq || l ? ' — ' + lbl(K.TYPES, st.type).toLowerCase() : '');
      }
      s.data.phases = defaultPhases(s.type, s.duree_min);
      DB.save('fs_seances', s);
      location.hash = '#/seance/' + s.id;
    } }] });
  },
  /* « Mon année » : un toucher sur un créneau crée la séance (date, durée, matière du créneau) et ouvre directement son éditeur */
  fromSlot: function (sl, seqId) {
    var cl = sl.cl, seq = seqId ? DB.byId('fs_sequences', seqId) : null, init = slotSeanceInit(sl.c);
    init.type = init.type || 'cours'; init.sequence_id = seq ? seq.id : null; init.date_prevue = sl.date; init.duree_min = Math.min(sl.duree || 55, 240); init.titre = '';
    var s = seanceFromSlot(cl, sl, init);
    if (seq) {
      var done = {}; Cls.seances(cl.id).filter(function (x) { return x.statut === 'faite'; }).forEach(function (x) { (x.data.items || []).forEach(function (it) { done[it.ref] = true; }); });
      var its = (seq.data.items || []).filter(function (it) { return !done[it.ref]; });
      s.data.items = its.map(function (it) { var c = clone(it); c.niv = defaultNiv(s.type); return c; });
      s.data.chapitres = []; its.forEach(function (it) { if (it.chap && s.data.chapitres.indexOf(it.chap) < 0) s.data.chapitres.push(it.chap); });
      s.data.competences = seq.data.competences.slice(); s.data.comp_caps = (seq.data.comp_caps || []).slice(); s.data.comp_manual = seq.data.comp_manual; if (seq.data.ancrage) s.data.ancrage = seq.data.ancrage;
    }
    var first = (s.data.items || []).filter(function (x) { return x.chap; })[0], l = first && Ref.lookup(first.chap);
    s.titre = seq ? (seq.titre || 'Séquence') + ' — ' + lbl(K.TYPES, s.type).toLowerCase() : (l ? l.txt + ' — ' + lbl(K.TYPES, s.type).toLowerCase() : lbl(K.TYPES, s.type));
    s.data.phases = defaultPhases(s.type, s.duree_min);
    DB.save('fs_seances', s); return s;
  }
};
