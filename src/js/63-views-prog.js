/* ═══ FICHES · progression automatique ═══ */
'use strict';

Views.progression = function (classId) {
  var classes = Cls.actives();
  var root = h('div', { class: 'page' });
  if (!classes.length) { root.appendChild(pageHead('Progression', null, [])); root.appendChild(h('div', { class: 'card hero' }, h('p', null, 'Créez une classe pour suivre sa progression.'), h('a', { class: 'btn primary', href: '#/classes' }, 'Mes classes'))); return root; }
  var cl = (classId && Cls.get(classId)) || Cls.get(Store.get('prog_class')) || classes[0];
  if (cl.archive && !classId) cl = classes[0];
  Store.set('prog_class', cl.id);
  var tab = Store.get('prog_tab') || 'chap';
  var showAll = false;

  root.appendChild(pageHead('Progression', 'Remplie automatiquement par les séances marquées « faites ».', [h('button', { class: 'btn', type: 'button', onclick: function () { Exp.progression(cl, Plan.compute(cl.id)); } }, '⬇ Exporter (CSV)'), h('button', { class: 'btn', type: 'button', onclick: function () { Exp.print('progression', cl); } }, '🖨 Imprimer')]));
  var pick = h('div', { class: 'chips' }, Cls.all().filter(function (c) { return !c.archive || c.id === cl.id; }).map(function (c) {
    return h('a', { class: 'chip' + (c.id === cl.id ? ' on' : ''), href: '#/progression/' + c.id, style: c.id === cl.id ? { background: c.couleur, color: textOn(c.couleur), borderColor: c.couleur } : { borderColor: c.couleur } }, c.nom);
  }));
  root.appendChild(pick);

  var M = Plan.compute(cl.id), e = Ref.effective(cl.niveau_id);
  var body = h('div');

  /* bandeau de synthèse */
  var tot = 0, vus = 0, maitr = 0, plan = 0, mins = 0;
  e.chapitres.forEach(function (ch) { if (!Ref.portee(ch, cl).ok) return; var s = Plan.chapStats(M, ch); tot += s.total; vus += s.vus; maitr += s.maitrises; plan += s.planifies; mins += s.minutes; });
  var faites = Cls.seances(cl.id).filter(function (s) { return s.statut === 'faite'; });
  var minFaites = faites.reduce(function (n, s) { return n + s.duree_min; }, 0);
  var bornes = Plan.bornes(cl.annee_scolaire), from = today() > bornes.debut ? today() : bornes.debut;
  var hd = Plan.heuresDispo(cl, from, bornes.fin);
  function stat(label, val, sub) { return h('div', { class: 'stat' }, h('div', { class: 'stat-v' }, val), h('div', { class: 'stat-l' }, label), sub ? h('div', { class: 'muted small' }, sub) : null); }
  root.appendChild(h('div', { class: 'stats' },
    stat('Éléments abordés', vus + ' / ' + tot, tot ? Math.round(vus / tot * 100) + ' %' : ''), stat('Maîtrisés', String(maitr), tot ? Math.round(maitr / tot * 100) + ' %' : ''),
    stat('Planifiés (à venir)', String(plan)), stat('Heures faites', fmtDuree(minFaites), plural(faites.length, 'séance')),
    stat('Créneaux restants', fmtDuree(hd.minutes), (cl.creneaux || []).length ? 'jusqu’au ' + fmtD(bornes.fin) : 'ajoutez des créneaux')));

  var tabs = h('div', { class: 'tabs', role: 'tablist' }, [['chap', 'Par chapitre'], ['cal', 'Calendrier annuel'], ['reste', 'Reste à faire']].map(function (t) {
    return h('button', { class: 'tab' + (tab === t[0] ? ' on' : ''), type: 'button', role: 'tab', 'aria-selected': tab === t[0] ? 'true' : 'false', onclick: function () { tab = t[0]; Store.set('prog_tab', tab); Views.rerender(); } }, t[1]);
  }));
  root.appendChild(tabs); root.appendChild(body);

  function itemRow(it, kind) {
    var m = Plan.get(M, it.id), st = Plan.STATUTS[m.statut], pl = Plan.planifie(m);
    var btn = h('button', { class: 'st-btn s' + m.statut + (pl ? ' plan' : ''), type: 'button', title: st.nom + (m.override ? ' (modifié à la main)' : ' (automatique)') + ' — cliquer pour changer', 'aria-label': st.nom,
      onclick: function () { cycle(it.id, m); } }, '');
    var sub = [];
    if (m.nbFaites) sub.push(plural(m.nbFaites, 'séance faite', 'séances faites') + (m.first ? ' · ' + fmtDM(m.first) + (m.last && m.last !== m.first ? ' → ' + fmtDM(m.last) : '') : ''));
    if (m.nbPrevues) sub.push(m.nbPrevues + ' prévue' + (m.nbPrevues > 1 ? 's' : '') + (m.next ? ' dès le ' + fmtDM(m.next) : ''));
    else if (m.seqPrevue && !m.nbFaites) sub.push('prévu dans une séquence');
    if (m.minutes) sub.push(fmtDuree(m.minutes));
    var links = m.parents.filter(function (p) { return p.t === 'seance'; }).slice(0, 4);
    return h('div', { class: 'pg-row' }, btn, h('div', { class: 'pg-main' }, h('div', { class: 'pg-txt' }, it.txt + (it.sous && it.sous.length ? ' — ' + it.sous.join(' ; ') : ''), m.override ? h('em', { class: 'tag' }, 'manuel') : null),
      sub.length || links.length ? h('div', { class: 'muted small' }, sub.join(' · '), links.length ? ' · ' : '', links.map(function (p, i) { return h('a', { href: '#/seance/' + p.id, title: p.titre }, (i ? ', ' : '') + (p.date ? fmtDM(p.date) : 'séance')); })) : null));
  }
  function cycle(ref, m) {
    var ov = DB.list('fs_progress_override').filter(function (o) { return o.class_id === cl.id && o.ref_id === ref; })[0];
    var cur = m.statut;
    if (!ov) { ov = { id: uid(), class_id: cl.id, ref_id: ref, statut: (cur + 1) % 4, date_realisation: today(), note: '' }; DB.save('fs_progress_override', ov); }
    else if (ov.statut >= 3) { DB.remove('fs_progress_override', ov.id); }
    else { ov.statut = ov.statut + 1; ov.date_realisation = ov.date_realisation || today(); DB.save('fs_progress_override', ov); }
    Views.rerender();
  }

  function tabChap() {
    var bar = h('div', { class: 'row-gap' }, h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: showAll, onchange: function (ev) { showAll = ev.target.checked; draw(); } }), ' Afficher aussi les chapitres hors groupement'),
      h('span', { class: 'legend' }, Plan.STATUTS.map(function (s) { return h('span', { class: 'lg' }, h('i', { class: 's' + s.v }), ' ' + s.nom); }), h('span', { class: 'lg' }, h('i', { class: 's0 plan' }), ' Planifié')));
    var out = h('div');
    function draw() {
      clear(out);
      var doms = [], seen = {};
      e.chapitres.forEach(function (ch) { if (!showAll && !Ref.portee(ch, cl).ok) return; if (!seen[ch.domaine]) { seen[ch.domaine] = []; doms.push(ch.domaine); } seen[ch.domaine].push(ch); });
      doms.forEach(function (dn) {
        var sec = h('section', { class: 'card pg-dom' }, h('h2', null, dn));
        seen[dn].forEach(function (ch) {
          var s = Plan.chapStats(M, ch), pctV = s.total ? s.vus / s.total * 100 : 0, pctP = s.total ? s.planifies / s.total * 100 : 0;
          var det = h('details', { class: 'pg-chap', open: (s.vus > 0 && s.vus < s.total) || s.planifies > 0 ? true : null });
          det.appendChild(h('summary', null, h('span', { class: 'pk-ct' }, ch.titre), h('span', { class: 'bar sm' }, h('i', { class: 'v', style: { width: pctV + '%' } }), h('i', { class: 'p', style: { width: pctP + '%' } })), h('span', { class: 'pk-count' + (s.vus ? ' on' : '') }, s.vus + '/' + s.total)));
          var bd = h('div', { class: 'pg-body' });
          if (ch.objectifs.length) { bd.appendChild(h('div', { class: 'pk-gt' }, 'Objectifs')); ch.objectifs.forEach(function (it) { bd.appendChild(itemRow(it, 'o')); }); }
          if (ch.connaissances.length) { bd.appendChild(h('div', { class: 'pk-gt' }, 'Notions')); ch.connaissances.forEach(function (it) { bd.appendChild(itemRow(it, 'k')); }); }
          bd.appendChild(h('div', { class: 'row-gap' }, h('button', { class: 'btn small', type: 'button', onclick: function () { Wizard.seance({ classId: cl.id }); } }, '＋ Séance sur ce chapitre'), h('button', { class: 'btn small', type: 'button', onclick: function () { Tpl.open({ mode: 'create', cl: cl, chapIds: [ch.id] }); } }, '📥 Modèles d’1 h')));
          det.appendChild(bd); sec.appendChild(det);
        });
        out.appendChild(sec);
      });
      /* automatismes */
      var autos = e.automatismes.filter(function (a) { var m = Plan.get(M, a.id); return m.nbFaites || m.nbPrevues || m.override; });
      if (autos.length) { var sa = h('section', { class: 'card pg-dom' }, h('h2', null, 'Automatismes travaillés')); autos.forEach(function (a) { sa.appendChild(itemRow(a, 'a')); }); out.appendChild(sa); }
      /* éléments de séances qui ne figurent plus dans le référentiel */
      var known = {}; e.chapitres.forEach(function (c) { c.objectifs.concat(c.connaissances).forEach(function (x) { known[x.id] = 1; }); }); e.automatismes.forEach(function (a) { known[a.id] = 1; });
      var orph = Object.keys(M).filter(function (k) { return !known[k] && (M[k].nbFaites || M[k].nbPrevues); });
      if (orph.length) {
        var so = h('section', { class: 'card pg-dom' }, h('h2', null, 'Éléments masqués ou hors programme'), h('p', { class: 'muted small' }, 'Présents dans vos fiches mais plus dans le programme affiché (masqués, ou d’un autre niveau).'));
        orph.forEach(function (k) { var l = Ref.lookup(k); var txt = l ? l.txt : k; so.appendChild(itemRow({ id: k, txt: txt }, 'o')); }); out.appendChild(so);
      }
    }
    draw(); body.appendChild(bar); body.appendChild(out);
  }

  function tabCal() {
    var sea = Cls.seances(cl.id), rs = Plan.ranges(cl.id, cl.annee_scolaire), wk = weekStart(bornes.debut), g = 0;
    var tbl = h('div', { class: 'cal-grid' });
    if (!(cl.creneaux || []).length) tbl.appendChild(h('p', { class: 'muted' }, 'Astuce : ajoutez les créneaux hebdomadaires de la classe pour voir les heures disponibles par semaine.'));
    while (wk <= bornes.fin && g++ < 60) {
      var end = addDays(wk, 6), days = []; for (var i = 0; i < 5; i++) days.push(addDays(wk, i));
      var blocked = days.filter(function (x) { return Plan.blockedReason(x, rs); });
      var allB = blocked.length === 5, lab = blocked.length ? Plan.blockedReason(blocked[0], rs) : null;
      var items = sea.filter(function (s) { var dd = Plan.seanceDate(s); return dd && dd >= wk && dd <= end && s.statut !== 'annulee'; });
      var mins = items.reduce(function (n, s) { return n + s.duree_min; }, 0), av = Plan.heuresDispo(cl, wk, end).minutes;
      var row = h('div', { class: 'cal-wk' + (allB ? ' off' : '') + (today() >= wk && today() <= end ? ' now' : '') },
        h('div', { class: 'cal-d' }, fmtDM(wk) + ' – ' + fmtDM(end)), h('div', { class: 'cal-c' }, allB ? h('span', { class: 'muted small' }, (lab && lab.label) || 'Fermé') : items.length ? items.map(function (s) { return h('a', { class: 'cal-ev st-' + s.statut, href: '#/seance/' + s.id, title: lbl(K.TYPES, s.type) + ' · ' + fmtDuree(s.duree_min) }, s.titre || '(sans titre)'); }) : h('span', { class: 'muted small' }, '—')),
        h('div', { class: 'cal-m muted small' }, av ? fmtDuree(mins) + ' / ' + fmtDuree(av) : (mins ? fmtDuree(mins) : '')));
      tbl.appendChild(row); wk = addDays(wk, 7);
    }
    var undated = sea.filter(function (s) { return !Plan.seanceDate(s) && s.statut !== 'annulee'; });
    body.appendChild(tbl);
    if (undated.length) body.appendChild(h('section', { class: 'card' }, h('h2', null, plural(undated.length, 'séance sans date')), undated.map(function (s) { return h('div', { class: 'row-s' }, h('a', { class: 'row-t', href: '#/seance/' + s.id }, s.titre || '(sans titre)'), h('span', { class: 'muted small' }, fmtDuree(s.duree_min))); })));
  }

  function tabReste() {
    var restants = [], nonPlan = 0;
    e.chapitres.forEach(function (ch) {
      if (!Ref.portee(ch, cl).ok) return;
      var its = ch.objectifs.concat(ch.connaissances).filter(function (x) { return Plan.get(M, x.id).statut === 0; });
      if (its.length) { var np = its.filter(function (x) { return !Plan.planifie(Plan.get(M, x.id)); }); nonPlan += np.length; restants.push({ ch: ch, its: its, np: np }); }
    });
    var n = restants.reduce(function (a, r) { return a + r.its.length; }, 0);
    body.appendChild(h('section', { class: 'card' }, h('h2', null, 'Où en est-on ?'),
      h('p', null, h('strong', null, plural(n, 'élément restant', 'éléments restants')), ' à aborder dans le programme de la classe, dont ', h('strong', null, String(nonPlan)), ' pas encore planifiés dans une séquence ou une séance.'),
      h('p', null, 'Temps de cours restant jusqu’au ' + fmtD(bornes.fin) + ' : ', h('strong', null, fmtDuree(hd.minutes)), ' (' + plural(hd.creneaux, 'créneau', 'créneaux') + ', ' + plural(Plan.semainesTravaillees(cl, from, bornes.fin), 'semaine travaillée', 'semaines travaillées') + ').'),
      n && hd.minutes ? h('p', { class: 'muted' }, 'Soit environ ' + Math.round(hd.minutes / n) + ' min par élément restant : à ajuster, tous ne demandent pas le même temps.') : null));
    restants.forEach(function (r) {
      var sec = h('details', { class: 'card pg-chap' }, h('summary', null, h('span', { class: 'pk-ct' }, r.ch.titre), h('span', { class: 'pk-count' }, r.its.length + ' restant' + (r.its.length > 1 ? 's' : '') + (r.np.length ? ' · ' + r.np.length + ' non planifié' + (r.np.length > 1 ? 's' : '') : ''))));
      r.its.forEach(function (it) { sec.appendChild(itemRow(it, 'o')); }); body.appendChild(sec);
    });
    if (!restants.length) body.appendChild(h('p', { class: 'muted' }, 'Tout le programme de la classe a été abordé. 🎉'));
  }

  if (tab === 'cal') tabCal(); else if (tab === 'reste') tabReste(); else tabChap();
  return root;
};
