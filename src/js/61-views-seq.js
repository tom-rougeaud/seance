/* ═══ FICHES · éditeur de séquence ═══ */
'use strict';

/* copie d’une séquence (et de ses séances) vers une classe, sans dates ni statuts */
function duplicateSequence(q, targetClassId, opt) {
  opt = opt || {};
  var cl = Cls.get(targetClassId), same = cl.niveau_id === Cls.get(q.class_id).niveau_id;
  var nq = createSequence(cl, { titre: (opt.titre || q.titre) + (opt.titre ? '' : (targetClassId === q.class_id ? ' (copie)' : '')), data: clone(q.data) });
  if (!same) { nq.data.items = []; nq.data.chapitres = []; nq.data.competences = []; nq.data.comp_caps = []; }
  DB.save('fs_sequences', nq);
  Res.of(q.id).forEach(function (x) { Res.attach('sequence', nq.id, x.res.id, x.att.usage); });
  var map = {};
  Cls.seancesDe(q.id).forEach(function (s) {
    var ns = createSeance(cl, { sequence_id: nq.id, ordre: s.ordre, titre: s.titre, type: s.type, modalite: s.modalite, groupe: s.groupe, duree_min: s.duree_min, data: clone(s.data) });
    if (!same) { ns.data.items = []; ns.data.chapitres = []; ns.data.competences = []; ns.data.comp_caps = []; }
    ns.data.bilan = { realise: '', notes: '', a_reprendre: '' };
    DB.save('fs_seances', ns); map[s.id] = ns;
    Res.of(s.id).forEach(function (x) { Res.attach('seance', ns.id, x.res.id, x.att.usage); });
  });
  Cls.seancesDe(q.id).forEach(function (s) { if (s.jumelle_id && map[s.id] && map[s.jumelle_id]) { map[s.id].jumelle_id = map[s.jumelle_id].id; DB.save('fs_seances', map[s.id]); } });
  return nq;
}
function duplicateSeance(s, opt) {
  opt = opt || {};
  var cl = Cls.get(s.class_id);
  var ns = createSeance(cl, { sequence_id: s.sequence_id, titre: s.titre + ' (copie)', type: s.type, modalite: s.modalite, groupe: s.groupe, duree_min: s.duree_min, data: clone(s.data) });
  ns.data.bilan = { realise: '', notes: '', a_reprendre: '' }; ns.data.pronote = { contenu: '', travail: '', temps: '' }; DB.save('fs_seances', ns);
  Res.of(s.id).forEach(function (x) { Res.attach('seance', ns.id, x.res.id, x.att.usage); });
  return ns;
}

Views.sequence = function (id) {
  var q = DB.byId('fs_sequences', id); if (!q) return notFound();
  var cl = Cls.get(q.class_id); if (!cl) return notFound();
  normData(q, 'sequence', cl);
  var d = q.data, save = Ed.saver('fs_sequences', q);
  var root = h('div', { class: 'page' });
  var seancesBox = h('div'); var totalsEl = h('div', { class: 'totals' });

  root.appendChild(pageHead(q.titre || 'Nouvelle séquence', cl.nom + ' · ' + Cls.niveauLabel(cl),
    [h('button', { class: 'btn', type: 'button', onclick: function () { save.now(); Exp.print('sequence', q); } }, '🖨 Imprimer'),
    h('button', { class: 'btn', type: 'button', onclick: function () { save.now(); Exp.word('sequence', q); } }, '📝 Word'),
    h('button', { class: 'btn', type: 'button', onclick: function () { duplicateModal(); } }, '⧉ Copier vers…')], ['#/classe/' + cl.id, cl.nom]));

  /* identité */
  var titre = UI.textinput(function () { return q.titre; }, function (v) { q.titre = v; save(); $('h1', root).textContent = v || 'Nouvelle séquence'; }, 'Ex. Proportionnalité et pourcentages');
  root.appendChild(h('section', { class: 'card' }, h('div', { class: 'grid2' }, UI.field('Titre de la séquence', titre),
    UI.field('Statut', UI.select(K.STATUTS_SEQ, q.statut, function (v) { q.statut = v; save(); }))),
    Ed.area('Situation d’accroche / problématique', d, 'probleme', save, 'Question de départ, situation professionnelle qui donne du sens à la séquence…', 3),
    h('div', { class: 'grid2' }, Ed.area('Ancrage métier / vie quotidienne', d, 'ancrage', save, 'Ex. calculer une remise en caisse, convertir une recette…', 2), Ed.area('Prérequis', d, 'prerequis', save, 'Ce que les élèves doivent déjà savoir faire', 2))));

  /* programme */
  var countEl = h('span', { class: 'badge' }, String(d.items.length));
  var panel = Ed.itemsPanel({ rec: q, cl: cl, changed: save, withNiv: false, kinds: ['o', 'k', 'a'], onCount: function (n) { countEl.textContent = String(n); } });
  var sec = UI.section('seq-prog', 'Objectifs, notions et compétences', [panel], { open: true });
  $('summary', sec).appendChild(countEl);
  root.appendChild(sec);

  /* séances */
  function drawSeances() {
    clear(seancesBox);
    var ss = Cls.seancesDe(q.id), tot = 0;
    var list = h('div', { class: 'seq-list' });
    ss.forEach(function (s) {
      if (s.statut !== 'annulee') tot += s.duree_min;
      var dt = Plan.seanceDate(s);
      list.appendChild(h('div', { class: 'seq-row sort-item', 'data-id': s.id }, h('span', { class: 'grip', title: 'Glisser pour réordonner' }, '⠿'),
        h('div', { class: 'seq-main' }, h('a', { class: 'seq-t', href: '#/seance/' + s.id }, s.titre || '(sans titre)'),
          h('div', { class: 'muted small' }, lbl(K.TYPES, s.type) + ' · ' + fmtDuree(s.duree_min) + (s.modalite !== 'classe' ? ' · ' + lbl(K.MODALITES, s.modalite) + (s.groupe ? ' ' + s.groupe : '') : '') + (dt ? ' · ' + fmtDL(dt) : '') + ' · ' + plural((s.data.items || []).length, 'élément'))),
        UI.select(K.STATUTS_SEANCE, s.statut, function (v) { setStatut(s, v); drawSeances(); }, 'sm')));
    });
    if (!ss.length) seancesBox.appendChild(h('p', { class: 'muted' }, 'Aucune séance pour l’instant. Créez-les une à une ou générez un plan type.'));
    else { seancesBox.appendChild(list); UI.sortable(list, { item: '.sort-item', handle: '.grip', onSort: function (ids) { ids.forEach(function (sid, i) { var s = DB.byId('fs_seances', sid); if (s && s.ordre !== i + 1) { s.ordre = i + 1; DB.save('fs_seances', s); } }); } }); }
    var dates = ss.map(Plan.seanceDate).filter(Boolean).sort();
    var txt = 'Total prévu : ' + fmtDuree(tot) + ' (' + plural(ss.filter(function (s) { return s.statut !== 'annulee'; }).length, 'séance') + ')';
    if (dates.length) {
      var hd = Plan.heuresDispo(cl, dates[0], dates[dates.length - 1]);
      txt += ' · du ' + fmtDM(dates[0]) + ' au ' + fmtDM(dates[dates.length - 1]) + ' : ' + fmtDuree(hd.minutes) + ' de créneaux disponibles';
      if (hd.minutes && tot > hd.minutes) txt += ' ⚠ plus que le temps disponible';
    }
    totalsEl.textContent = txt; seancesBox.appendChild(totalsEl);
    if (dates.length && (q.date_debut !== dates[0] || q.date_fin !== dates[dates.length - 1])) { q.date_debut = dates[0]; q.date_fin = dates[dates.length - 1]; save(); }
  }
  drawSeances();
  var secS = UI.section('seq-seances', 'Séances de la séquence', [seancesBox,
    h('div', { class: 'row-gap' },
      h('button', { class: 'btn primary small', type: 'button', onclick: function () { var s = createSeance(cl, { sequence_id: q.id, titre: '', date_prevue: nextDateFor(cl, q.id) }); location.hash = '#/seance/' + s.id; } }, '＋ Séance'),
      h('button', { class: 'btn small', type: 'button', onclick: function () { planType(); } }, '⚡ Générer un plan type…'))], { open: true });
  root.appendChild(secS);

  function planType() {
    var opts = [['activite', 'Activité de découverte', true], ['cours', 'Cours / institutionnalisation', true], ['exercices', 'Exercices d’entraînement', true], ['revision', 'Révision', false], ['evaluation', 'Évaluation', true]];
    var on = {}; opts.forEach(function (o) { on[o[0]] = o[2]; });
    var copy = d.items.length > 0, dated = (cl.creneaux || []).length > 0;
    var body = h('div', { class: 'form' }, h('p', { class: 'muted' }, 'Crée des séances vides (durée = votre créneau) que vous complétez ensuite.'),
      opts.map(function (o) { return h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: o[2], onchange: function (e) { on[o[0]] = e.target.checked; } }), ' ' + o[1]); }),
      d.items.length ? h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: copy, onchange: function (e) { copy = e.target.checked; } }), ' Copier les objectifs de la séquence dans chaque séance') : null,
      dated ? h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: dated, onchange: function (e) { dated = e.target.checked; } }), ' Proposer des dates d’après les créneaux et le calendrier') : null);
    UI.modal({ title: 'Plan type de la séquence', body: body, actions: [{ label: 'Annuler', kind: 'ghost' }, { label: 'Créer les séances', kind: 'primary', onClick: function () {
      var cur = null; var all = Cls.seances(cl.id).filter(function (s) { return s.date_prevue; }).map(function (s) { return s.date_prevue; }).sort(); cur = all.length && all[all.length - 1] >= today() ? all[all.length - 1] : addDays(today(), -1);
      var n = 0;
      opts.forEach(function (o) {
        if (!on[o[0]]) return;
        var nm = o[0] === 'activite' ? 'Activité' : o[0] === 'cours' ? 'Cours' : o[0] === 'exercices' ? 'Exercices' : o[0] === 'revision' ? 'Révision' : 'Évaluation';
        var init = { sequence_id: q.id, type: o[0], titre: nm + ' — ' + (q.titre || 'séquence') };
        if (dated) { var sl = Plan.nextSlots(cl, cur, 1, {}); if (sl.length) { init.date_prevue = sl[0].date; cur = sl[0].date; } }
        var s = createSeance(cl, init);
        if (copy) { s.data.items = d.items.map(function (it) { var c = clone(it); c.niv = defaultNiv(o[0]); return c; }); s.data.chapitres = d.chapitres.slice(); s.data.competences = d.competences.slice(); s.data.comp_caps = (d.comp_caps || []).slice(); s.data.comp_manual = d.comp_manual; if (d.ancrage) s.data.ancrage = d.ancrage; }
        if (o[0] === 'evaluation' && copy) s.data.items.forEach(function (it) { if (it.k !== 'a') it.niv = 'evaluation'; });
        DB.save('fs_seances', s); n++;
      });
      UI.toast(plural(n, 'séance créée')); drawSeances();
    } }] });
  }

  /* évaluations */
  var evBox = h('div');
  function drawEv() {
    clear(evBox);
    d.evaluations.forEach(function (e, i) {
      evBox.appendChild(h('div', { class: 'ev-row' }, UI.textinput(function () { return e.titre; }, function (v) { e.titre = v; save(); }, 'Ex. Évaluation formative n°1'),
        h('input', { class: 'inp sm', type: 'date', value: e.date || '', onchange: function (ev) { e.date = ev.target.value || null; save(); } }),
        UI.select([['formative', 'Formative'], ['sommative', 'Sommative'], ['ccf', 'CCF / certificative']], e.type || 'formative', function (v) { e.type = v; save(); }, 'sm'),
        h('button', { class: 'icon-btn sm', type: 'button', onclick: function () { d.evaluations.splice(i, 1); save(); drawEv(); } }, '✕')));
    });
    evBox.appendChild(h('button', { class: 'btn small ghost', type: 'button', onclick: function () { d.evaluations.push({ titre: '', date: null, type: 'formative' }); save(); drawEv(); } }, '＋ Évaluation prévue'));
  }
  drawEv();
  root.appendChild(UI.section('seq-eval', 'Évaluations prévues', [evBox], { open: d.evaluations.length > 0 }));
  root.appendChild(UI.section('seq-diff', 'Différenciation', [Ed.diffBlock(d, save, false)], { open: false }));
  root.appendChild(UI.section('seq-res', 'Ressources (PDF, liens, vidéos)', [Res.block('sequence', q, function () { /* rien à enregistrer : les liens sont dans fs_attachments */ })], { open: true }));
  root.appendChild(UI.section('seq-bilan', 'Bilan et notes', [Ed.area('Bilan de la séquence', d, 'bilan', save, 'Ce qui a fonctionné, ce qu’il faut modifier l’an prochain…', 3), Ed.area('Notes personnelles', d, 'notes', save, '', 2)], { open: false }));
  root.appendChild(Ed.actionBar([h('button', { class: 'btn danger', type: 'button', onclick: function () {
    var n = Cls.seancesDe(q.id).length;
    UI.ask('Supprimer la séquence « ' + (q.titre || 'sans titre') + ' » ?' + (n ? ' Ses ' + plural(n, 'séance') + ' seront conservées en dehors de toute séquence.' : ''), { ok: 'Supprimer', danger: true }).then(function (ok) { if (ok) { DB.remove('fs_sequences', q.id); location.hash = '#/classe/' + cl.id; } });
  } }, 'Supprimer la séquence')]));

  function duplicateModal() {
    save.now();
    var cls = Cls.all(); var sel = cl.id, keepTitle = '';
    var body = h('div', { class: 'form' }, h('p', { class: 'muted' }, 'La copie reprend les séances, les objectifs et les ressources, sans dates ni bilans. Idéal pour une autre classe du même niveau.'),
      UI.field('Classe de destination', UI.select(cls.map(function (c) { return [c.id, c.nom + ' — ' + Cls.niveauLabel(c)]; }), sel, function (v) { sel = v; })),
      h('p', { class: 'muted small' }, 'Si le niveau diffère, les objectifs du programme ne sont pas copiés (les textes libres le sont).'));
    UI.modal({ title: 'Copier la séquence', body: body, actions: [{ label: 'Annuler', kind: 'ghost' }, { label: 'Copier', kind: 'primary', onClick: function () { var nq = duplicateSequence(q, sel); UI.toast('Séquence copiée.'); location.hash = '#/sequence/' + nq.id; } }] });
  }
  return root;
};
