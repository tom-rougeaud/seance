/* ═══ FICHES · parcours guidé : « Et maintenant ? » en bas de chaque page ═══ */
'use strict';
var Guide = (function () {
  function goSection(start) {
    var t = $$('#view details.sec').filter(function (x) { var e = $('.sec-t', x); return e && e.textContent.indexOf(start) >= 0; })[0];
    if (!t) { UI.toast('Cette partie n’est pas affichée pour ce type de séance.'); return; }
    for (var a = t; a && a !== document.body; a = a.parentElement) if (a.tagName === 'DETAILS') a.open = true;
    try { t.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { t.scrollIntoView(); }
    var f = $('textarea, input.inp', t); if (f) setTimeout(function () { try { f.focus({ preventScroll: true }); } catch (e) { /* ignoré */ } }, 350);
  }
  function A(t, why, go, primary) { return { t: t, why: why || '', go: go, primary: !!primary }; }
  function lienOuFn(go) { return typeof go === 'string' ? { href: go } : { onclick: go }; }

  function stepper(steps) {
    return h('ol', { class: 'guide-steps', 'aria-label': 'Étapes' }, steps.map(function (st) {
      return h('li', { class: st.done ? 'done' : (st.now ? 'now' : ''), 'aria-current': st.now ? 'step' : null }, h('span', { class: 'n' }, st.done ? '✓' : String(st.n)), h('span', null, st.t));
    }));
  }
  function box(intro, steps, actions) {
    var prim = actions.filter(function (a) { return a.primary; })[0];
    var rest = actions.filter(function (a) { return !a.primary; });
    var node = h('section', { class: 'card guide', 'aria-label': 'Étape suivante' }, h('h2', null, '👉 Et maintenant ?'));
    if (intro) node.appendChild(h('p', { class: 'muted' }, intro));
    if (steps) node.appendChild(stepper(steps));
    if (prim) {
      var b = typeof prim.go === 'string' ? h('a', { class: 'btn primary big', href: prim.go }, prim.t) : h('button', { class: 'btn primary big', type: 'button', onclick: prim.go }, prim.t);
      node.appendChild(h('div', { class: 'guide-main' }, b, prim.why ? h('span', { class: 'small muted' }, prim.why) : null));
    }
    if (rest.length) node.appendChild(h('div', { class: 'guide-more' }, h('span', { class: 'small muted' }, 'Ou bien :'), rest.map(function (a) {
      return typeof a.go === 'string' ? h('a', { class: 'btn', href: a.go, title: a.why || null }, a.t) : h('button', { class: 'btn', type: 'button', title: a.why || null, onclick: a.go }, a.t);
    })));
    return node;
  }

  function suivante(s, cl) {
    var sibs = s.sequence_id ? Cls.seancesDe(s.sequence_id) : Cls.seances(cl.id).filter(function (x) { return !x.sequence_id; });
    var i = -1; sibs.forEach(function (x, k) { if (x.id === s.id) i = k; });
    var rest = sibs.slice(i + 1).filter(function (x) { return x.statut !== 'annulee' && x.statut !== 'faite'; });
    return rest[0] || null;
  }
  function goSuivante(s, cl) {
    var n = suivante(s, cl);
    if (!n) { n = createSeance(cl, { sequence_id: s.sequence_id || null, date_prevue: nextDateFor(cl, s.sequence_id) || null, type: s.type === 'evaluation' ? 'cours' : s.type }); UI.toast('Nouvelle séance créée à la suite.'); }
    location.hash = '#/seance/' + n.id;
  }
  function etat(s, cl) {
    var d = s.data || {}, p = d.pronote || {};
    var prep = !!(s.titre && ((d.items || []).length || (d.manuel && (d.manuel.notions || []).length)) && (d.phases || []).length);
    return { prep: prep, titre: !!s.titre, items: (d.items || []).length > 0 || !!(d.manuel && (d.manuel.notions || []).length), phases: (d.phases || []).length > 0, prete: s.statut === 'prete' || s.statut === 'faite', faite: s.statut === 'faite', pronote: !!(p.contenu && p.contenu.trim()), bilan: !!(d.bilan && (d.bilan.realise || d.bilan.notes)) };
  }

  function seance(id) {
    var s = DB.byId('fs_seances', id), cl = s && Cls.get(s.class_id); if (!s || !cl) return null;
    var e = etat(s, cl), seq = s.sequence_id ? DB.byId('fs_sequences', s.sequence_id) : null;
    var steps = [{ n: 1, t: 'Préparer', done: e.prep }, { n: 2, t: 'Prête', done: e.prete }, { n: 3, t: 'Faite', done: e.faite }, { n: 4, t: 'Pronote et bilan', done: e.faite && e.pronote }];
    var cur = steps.filter(function (x) { return !x.done; })[0]; if (cur) cur.now = true;
    var prog = APP.manuels ? 'Manuel' : 'Programme', intro, prim;
    function marquer(v) { return function () { setStatut(s, v); Views.rerender(); UI.toast(v === 'prete' ? 'Séance marquée comme prête.' : 'Séance marquée comme faite.'); }; }
    if (s.statut === 'annulee' || s.statut === 'reportee') { intro = 'Cette séance est ' + (s.statut === 'annulee' ? 'annulée' : 'reportée') + '.'; prim = A('← Retour à la classe', '', '#/classe/' + cl.id, true); }
    else if (!e.titre) { intro = 'Étape 1 — donnez un titre à la séance, en haut de la page.'; prim = A('① Saisir le titre', 'Ex. « Calculer une proportion ».', function () { var i = $('#view input.inp'); if (i) { window.scrollTo({ top: 0, behavior: 'smooth' }); i.focus(); } }, true); }
    else if (!e.items) { intro = 'Étape 1 — choisissez ce que la séance travaille.'; prim = A(APP.manuels ? '① Choisir les notions du manuel' : '① Cocher les objectifs du programme', 'Ou chargez une proposition d’1 h prête à l’emploi avec « Charger un modèle ».', function () { goSection(APP.manuels ? 'Manuel' : 'Programme'); }, true); }
    else if (!e.phases) { intro = 'Étape 1 — il reste à écrire le déroulé.'; prim = A('① Construire le déroulé', 'Un modèle de déroulé existe pour chaque type de séance.', function () { goSection('Déroulé'); }, true); }
    else if (s.statut === 'a_faire') { intro = 'La préparation est complète.'; prim = A('② Marquer la séance comme prête', 'Elle apparaîtra comme prête dans le tableau de bord.', marquer('prete'), true); }
    else if (s.statut === 'prete') { intro = 'Après le cours :'; prim = A('③ Marquer la séance comme faite', 'La progression de la classe se met à jour toute seule.', marquer('faite'), true); }
    else if (!e.pronote) { intro = 'La séance est faite.'; prim = A('④ Rédiger la synthèse pour Pronote', 'Texte prêt à copier dans le cahier de textes.', function () { goSection('Synthèse pour Pronote'); }, true); }
    else if (!e.bilan) { intro = 'Dernière étape :'; prim = A('④ Noter le bilan de la séance', 'Réussites, difficultés, à reprendre.', function () { goSection('Bilan'); }, true); }
    else { intro = 'Tout est fait pour cette séance. 🎉'; prim = A('▶ Passer à la séance suivante', suivante(s, cl) ? 'Ouvre « ' + (suivante(s, cl).titre || 'séance suivante') + ' ».' : 'Crée la séance suivante à la prochaine date de cours.', function () { goSuivante(s, cl); }, true); }
    var more = [];
    if (prim && prim.t.indexOf('suivante') < 0 && s.statut !== 'annulee' && s.statut !== 'reportee') more.push(A('▶ Séance suivante', '', function () { goSuivante(s, cl); }));
    more.push(A(seq ? '← La séquence' : '← La classe', '', seq ? '#/sequence/' + seq.id : '#/classe/' + cl.id));
    more.push(A('📈 Progression', '', '#/progression/' + cl.id));
    more.push(A('📆 Mon année', '', '#/annee/' + cl.id));
    if (Annee.from && Annee.from.sid === s.id) {   /* ouverte depuis « Mon année » : on y revient pour choisir le cours suivant */
      var wk = Annee.from.week, back = A('✓ Valider et revenir à mon emploi du temps', 'Semaine du ' + fmtDM(wk) + ' : vous choisissez ensuite un autre cours.', function () {
        if (s.statut === 'a_faire' && s.titre) { setStatut(s, 'prete'); UI.toast('Séance validée (prête).'); }
        Store.set('annee_week', wk); Annee.from = null; location.hash = '#/annee';
      }, true);
      if (prim) { prim.primary = false; more.unshift(prim); }
      return box(intro, steps, [back].concat(more));
    }
    return box(intro, steps, [prim].concat(more));
  }

  function sequence(id) {
    var q = DB.byId('fs_sequences', id), cl = q && Cls.get(q.class_id); if (!q || !cl) return null;
    var ss = Cls.seancesDe(q.id).filter(function (x) { return x.statut !== 'annulee'; });
    var faites = ss.filter(function (x) { return x.statut === 'faite'; }).length;
    var next = ss.filter(function (x) { return x.statut !== 'faite'; })[0];
    var steps = [{ n: 1, t: 'Titre et programme', done: !!(q.titre && q.titre !== 'Nouvelle séquence') }, { n: 2, t: 'Séances', done: ss.length > 0 }, { n: 3, t: 'Réalisation', done: ss.length > 0 && faites === ss.length }];
    var cur = steps.filter(function (x) { return !x.done; })[0]; if (cur) cur.now = true;
    var prim, intro;
    function ajout() { var n = createSeance(cl, { sequence_id: q.id, date_prevue: nextDateFor(cl, q.id) || null }); location.hash = '#/seance/' + n.id; }
    if (!steps[0].done) { intro = 'Étape 1 — nommez la séquence et cochez le programme en haut de la page.'; prim = A('① Renseigner le titre', '', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); var i = $('#view input.inp'); if (i) i.focus(); }, true); }
    else if (!ss.length) { intro = 'Étape 2 — découpez la séquence en séances.'; prim = A('② Ajouter une première séance', 'Vous pourrez ensuite charger un modèle d’1 h.', ajout, true); }
    else if (next) { intro = faites + ' séance' + (faites > 1 ? 's' : '') + ' faite' + (faites > 1 ? 's' : '') + ' sur ' + ss.length + '.'; prim = A('▶ Ouvrir « ' + (next.titre || 'la prochaine séance') + ' »', 'Première séance pas encore faite.', '#/seance/' + next.id, true); }
    else { intro = 'Toutes les séances sont faites. 🎉'; prim = A('📈 Voir la progression de la classe', '', '#/progression/' + cl.id, true); }
    var more = [];
    if (ss.length) more.push(A('＋ Ajouter une séance', '', ajout));
    more.push(A('← La classe', '', '#/classe/' + cl.id)); more.push(A('📆 Mon année', '', '#/annee/' + cl.id));
    return box(intro, steps, [prim].concat(more));
  }

  function classe(id) {
    var c = Cls.get(id); if (!c) return null;
    var seqs = Cls.sequences(c.id), ss = Cls.seances(c.id).filter(function (x) { return x.statut !== 'annulee'; });
    var steps = [{ n: 1, t: 'Créneaux', done: (c.creneaux || []).length > 0 }, { n: 2, t: 'Séquence', done: seqs.length > 0 }, { n: 3, t: 'Séances', done: ss.length > 0 }, { n: 4, t: 'Suivi', done: ss.some(function (x) { return x.statut === 'faite'; }) }];
    var cur = steps.filter(function (x) { return !x.done; })[0]; if (cur) cur.now = true;
    var prim, intro, next = ss.filter(function (x) { return x.statut !== 'faite'; })[0];
    function nvSeq() { var q = createSequence(c, { titre: 'Nouvelle séquence' }); location.hash = '#/sequence/' + q.id; }
    if (!steps[0].done) { intro = 'Étape 1 — indiquez les jours et heures de cours : les dates des séances en découleront.'; prim = A('① Ajouter mes créneaux', 'Dans la fenêtre « Modifier la classe ».', function () { classModal(c); }, true); }
    else if (!seqs.length && !ss.length) { intro = 'Étape 2 — regroupez vos séances en séquences (ou créez une séance seule).'; prim = A('② Créer ma première séquence', 'Une séquence regroupe plusieurs séances autour d’un chapitre.', nvSeq, true); }
    else if (!ss.length) { intro = 'Étape 3 — ajoutez des séances dans la séquence.'; prim = A('③ Ouvrir la séquence « ' + (seqs[0].titre || 'sans titre') + ' »', '', '#/sequence/' + seqs[0].id, true); }
    else if (next) { intro = 'Prochaine séance à préparer ou à faire :'; prim = A('▶ Ouvrir « ' + (next.titre || 'sans titre') + ' »', '', '#/seance/' + next.id, true); }
    else { intro = 'Toutes les séances prévues sont faites. 🎉'; prim = A('＋ Créer la séance suivante', '', function () { Wizard.seance({ classId: c.id }); }, true); }
    var more = [A('📆 Mon année', 'Prévoir les semaines', '#/annee/' + c.id), A('📈 Progression', '', '#/progression/' + c.id), A('📚 Historique', '', '#/historique/' + c.id), A('🕒 Emploi du temps', '', '#/planning')];
    if (seqs.length) more.unshift(A('＋ Séquence', '', nvSeq));
    return box(intro, steps, [prim].concat(more));
  }

  function dashboard() {
    var classes = Cls.actives(); if (!classes.length) return null;
    var t = today();
    var all = DB.list('fs_seances').filter(function (s) { var c = Cls.get(s.class_id); return c && !c.archive && s.statut !== 'annulee'; }).sort(Cls.cmpSeance);
    var prep = all.filter(function (s) { return (s.statut === 'a_faire') && (!s.date_prevue || s.date_prevue >= t); })[0];
    var retard = all.filter(function (s) { return s.date_prevue && s.date_prevue < t && (s.statut === 'a_faire' || s.statut === 'prete'); })[0];
    var prim, intro;
    if (retard) { intro = 'Une séance prévue dans le passé n’est pas marquée comme faite.'; prim = A('⏰ Régulariser « ' + (retard.titre || 'séance') + ' »', 'La marquer comme faite met la progression à jour.', '#/seance/' + retard.id, true); }
    else if (prep) { intro = 'Prochaine séance à préparer :'; prim = A('✏️ Préparer « ' + (prep.titre || 'sans titre') + ' »', '', '#/seance/' + prep.id, true); }
    else { intro = 'Rien en attente. Préparez la suite :'; prim = A('📆 Préparer dans « Mon année »', 'Touchez une semaine, puis l’heure du cours.', '#/annee', true); }
    var more = [A('＋ Séance libre', 'En 3 questions : classe, séquence, type.', function () { Wizard.seance({}); }), A('📥 Modèle d’1 h', 'Séance prête à l’emploi', function () { Tpl.open({ mode: 'create' }); }), A('🕒 Emploi du temps', '', '#/planning'), A('📈 Progression', '', '#/progression'), A('⚙️ Réglages', 'Version, apparence, sauvegarde', '#/reglages')];
    if (Upd.siblingOk()) more.push(A(APP.manuels ? '📋 Version programme officiel ↗' : '📘 Ma séance (mes manuels) ↗', 'S’ouvre dans un nouvel onglet', function () { window.open(APP.frere.url, '_blank', 'noopener'); }));
    return box(intro, null, [prim].concat(more));
  }

  function simple(intro, prim, more) { return box(intro, null, [prim].concat(more || [])); }

  function make(r) {
    try {
      switch (r.name) {
        case '': return dashboard();
        case 'classes': return Cls.actives().length ? simple('Ouvrez une classe pour y préparer des séquences et des séances.', A('🕒 Définir mes créneaux dans l’emploi du temps', 'Pour que les dates des séances se calculent seules.', '#/planning', true), [A('📈 Progression', '', '#/progression'), A('🏠 Accueil', '', '#/')]) : null;
        case 'classe': return classe(r.arg);
        case 'sequence': return sequence(r.arg);
        case 'seance': return seance(r.arg);
        case 'annee': return simple('Touchez une semaine, puis l’heure du cours : la séance est créée à la bonne date.', A('📈 Voir la progression', 'Ce que vous avez déjà vu avec chaque classe.', '#/progression', true), [A('🕒 Emploi du temps', 'Modifier mes créneaux', '#/planning'), A('👥 Mes classes', '', '#/classes'), A('🏠 Accueil', '', '#/')]);
        case 'planning': return simple('L’emploi du temps se remplit en glissant sur la grille. Étape suivante : préparer les séances semaine par semaine.', A('📆 Ouvrir « Mon année »', 'Une pastille par semaine, entre les vacances.', '#/annee', true), [A('＋ Séance libre', '', function () { Wizard.seance({}); }), A('👥 Mes classes', '', '#/classes'), A('📈 Progression', '', '#/progression'), A('🏠 Accueil', '', '#/')]);
        case 'progression': return simple('La progression se remplit quand vous cochez des objectifs dans les séances.', A('＋ Créer une séance', 'Choisissez la classe puis le chapitre.', function () { Wizard.seance({}); }, true), [A('📚 Historique', '', '#/historique'), A('🏠 Accueil', '', '#/')]);
        case 'historique': return simple('Exportez l’historique avec les boutons en haut ou en bas de page, ou poursuivez le travail.', A('🏠 Retour à l’accueil', '', '#/', true), [A('👥 Mes classes', '', '#/classes'), A('📈 Progression', '', '#/progression')]);
        case 'biblio': return simple('Vos ressources se rattachent aux séances et aux séquences.', A('🏠 Retour à l’accueil', '', '#/', true), [A('👥 Mes classes', '', '#/classes')]);
        case 'referentiel': return simple('Pour utiliser ce programme, créez une séance à partir d’une classe.', A('＋ Créer une séance', '', function () { Wizard.seance({}); }, true), [A('🏠 Accueil', '', '#/')]);
        case 'reglages': return simple('', A('🏠 Retour à l’accueil', '', '#/', true), [A('👥 Mes classes', '', '#/classes')]);
        default: return null;
      }
    } catch (e) { if (window.console) console.error(e); return null; }
  }
  /* le bloc se remet à jour chaque fois qu’il revient à l’écran (l’état de la séance a pu changer pendant la saisie) */
  function footer(r) {
    var wrap = h('div', { class: 'guide-wrap' });
    function draw() { clear(wrap); var n = make(r); if (n) wrap.appendChild(n); }
    draw(); if (!wrap.firstChild) return null;
    if (window.IntersectionObserver && (r.name === 'seance' || r.name === 'classe' || r.name === 'sequence')) {
      var last = Date.now();
      new IntersectionObserver(function (en) { if (en[0] && en[0].isIntersecting && Date.now() - last > 1500) { last = Date.now(); draw(); } }, { threshold: 0.2 }).observe(wrap);
    }
    return wrap;
  }
  return { footer: footer, goSection: goSection };
})();
