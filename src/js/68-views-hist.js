/* ═══ FICHES · historique des fiches séances (par classe, uniquement ce qui a été saisi) ═══ */
'use strict';
Views.historique = function (arg) {
  var all = Cls.actives(), root = h('div', { class: 'page' });
  var cur = arg && arg !== 'tout' ? Cls.get(arg) : null;
  if (arg && arg !== 'tout' && !cur) return notFound();
  var STATS = K.STATUTS_SEANCE.map(function (x) { return x[0]; });
  var sel = Store.getJSON('hist_statuts', STATS).filter(function (x) { return STATS.indexOf(x) >= 0; });
  var ordre = Store.get('hist_ordre') === 'seq' ? 'seq' : 'date';
  var body = h('div', { class: 'hist-body' });
  var bar = h('div', { class: 'action-bar hist-bar' });

  function classes() { return cur ? [cur] : all; }
  function opt() { return { statuts: sel, ordre: ordre }; }
  function exportButtons() {
    var go = function (how) { return function () { Exp.history(classes(), opt(), how); }; };
    return [h('button', { class: 'btn primary', type: 'button', title: 'Choisissez « Enregistrer au format PDF » dans la fenêtre d’impression', onclick: go('print') }, '🖨 Imprimer / PDF'),
      h('button', { class: 'btn', type: 'button', onclick: go('word') }, '📝 Word'), h('button', { class: 'btn', type: 'button', onclick: go('html') }, '🌐 HTML')];
  }
  root.appendChild(pageHead('Historique des fiches', cur ? cur.nom + ' · ' + cur.annee_scolaire : 'Toutes les classes', exportButtons(), cur ? ['#/classe/' + cur.id, cur.nom] : ['#/classes', 'Classes']));

  /* choix de la classe */
  var chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Classe' });
  chips.appendChild(h('a', { class: 'chip' + (!cur ? ' on' : ''), href: '#/historique/tout' }, 'Toutes les classes'));
  all.forEach(function (c) { chips.appendChild(h('a', { class: 'chip' + (cur && cur.id === c.id ? ' on' : ''), href: '#/historique/' + c.id }, c.nom)); });
  /* filtres */
  var fl = h('div', { class: 'chips', role: 'group', 'aria-label': 'Statuts à inclure' });
  function drawFilters() {
    clear(fl);
    K.STATUTS_SEANCE.forEach(function (st) {
      var on = sel.indexOf(st[0]) >= 0;
      fl.appendChild(h('button', { class: 'chip' + (on ? ' on' : ''), type: 'button', 'aria-pressed': on ? 'true' : 'false', onclick: function () { var i = sel.indexOf(st[0]); if (i >= 0) sel.splice(i, 1); else sel.push(st[0]); Store.setJSON('hist_statuts', sel); drawFilters(); draw(); } }, st[1]));
    });
  }
  drawFilters();
  var ordSel = UI.select([['date', 'Ordre chronologique'], ['seq', 'Regroupées par séquence']], ordre, function (v) { ordre = v; Store.set('hist_ordre', v); draw(); }, 'sm');
  root.appendChild(h('section', { class: 'card' }, h('div', { class: 'field' }, h('span', { class: 'lbl' }, 'Classe'), chips),
    h('div', { class: 'field' }, h('span', { class: 'lbl' }, 'Séances à inclure'), fl), h('div', { class: 'row-gap' }, ordSel),
    h('p', { class: 'muted small' }, 'Chaque fiche ne montre que ce que vous avez saisi : les rubriques vides sont omises. Pour obtenir un PDF, choisissez « Enregistrer au format PDF » dans la fenêtre d’impression.')));
  root.appendChild(body);
  root.appendChild(bar);

  function draw() {
    clear(body); clear(bar);
    var total = 0;
    classes().forEach(function (cl) {
      var list = seancesFor(cl);
      total += list.length;
      var sec = h('section', { class: 'card' }, h('h2', null, cl.nom, h('span', { class: 'muted small' }, '  ' + plural(list.length, 'fiche') + ' · ' + cl.annee_scolaire)));
      if (!list.length) sec.appendChild(h('p', { class: 'muted' }, 'Aucune séance pour cette sélection.'));
      list.forEach(function (s, i) {
        var dt = Plan.seanceDate(s);
        var det = h('details', { class: 'hist-item' }, h('summary', null, h('span', { class: 'hi-n' }, String(i + 1)), h('span', { class: 'hi-d' }, dt ? fmtD(dt) : '—'), h('span', { class: 'hi-t' }, s.titre || '(sans titre)'),
          h('span', { class: 'chip st-' + s.statut }, lbl(K.STATUTS_SEANCE, s.statut))));
        var inner = h('div', { class: 'hist-fiche-view' });
        det.addEventListener('toggle', function () { if (det.open && !inner.firstChild) { inner.innerHTML = Exp.seanceHtml(s, { hist: true }); inner.appendChild(h('p', null, h('a', { class: 'btn small', href: '#/seance/' + s.id }, 'Ouvrir la fiche pour la modifier'))); } });
        det.appendChild(inner); sec.appendChild(det);
      });
      body.appendChild(sec);
    });
    if (total) { exportButtons().forEach(function (b) { bar.appendChild(b); }); bar.appendChild(h('span', { class: 'muted small' }, plural(total, 'fiche') + ' dans l’export.')); }
  }
  function seancesFor(cl) {
    var ok = sel, list = Cls.seances(cl.id).filter(function (s) { return ok.indexOf(s.statut) >= 0; });
    if (ordre === 'seq') {
      var rank = {}; Cls.sequences(cl.id).forEach(function (q) { rank[q.id] = q.ordre; });
      list.sort(function (a, b) { var ra = a.sequence_id ? rank[a.sequence_id] || 0 : 9999, rb = b.sequence_id ? rank[b.sequence_id] || 0 : 9999; return (ra - rb) || (a.ordre - b.ordre) || Cls.cmpSeance(a, b); });
    }
    return list;
  }
  draw();
  return root;
};
