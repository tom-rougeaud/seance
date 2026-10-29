/* ═══ FICHES · planning hebdomadaire : semaine 1 / semaine 2, créneaux par glisser-déposer ═══ */
'use strict';
var TT = { DEB: 8 * 60, FIN: 18 * 60, SNAP: 30, H: 26 };   /* H = hauteur en px d’une demi-heure */
var TT_JOURS = ['', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

Views.planning = function () {
  var annees = []; Cls.actives().forEach(function (c) { if (annees.indexOf(c.annee_scolaire) < 0) annees.push(c.annee_scolaire); });
  var an0 = anneeScolaire(); if (annees.indexOf(an0) < 0) annees.push(an0); annees.sort();
  var st = { annee: Store.get('plan_annee') && annees.indexOf(Store.get('plan_annee')) >= 0 ? Store.get('plan_annee') : (annees.indexOf(an0) >= 0 ? an0 : annees[annees.length - 1]), tab: 0 };
  var root = h('div', { class: 'page' });
  var body = h('div');

  function classesOf() { return Cls.actives().filter(function (c) { return c.annee_scolaire === st.annee; }); }
  function curType() { return Plan.weekType(today(), st.annee); }
  st.tab = curType() || 1;

  /* ── semaine de rentrée / alternance ── */
  function altCard() {
    var cfg = Plan.altConfig(st.annee), t = today();
    var def = cfg || { lundi: weekStart(st.annee.slice(0, 4) + '-09-01'), type: 1, sauter_vacances: true };
    var dateInp = h('input', { class: 'inp', type: 'date', value: def.lundi });
    var typeSel = UI.select([[1, 'Semaine 1'], [2, 'Semaine 2']], def.type, function () { save(); });
    var skip = h('input', { type: 'checkbox', checked: def.sauter_vacances !== false, onchange: function () { save(); } });
    function save() {
      var v = dateInp.value; if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) { UI.toast('Choisissez une date.', 'err'); return; }
      Plan.setAltConfig(st.annee, { lundi: weekStart(v), type: +typeSel.value, sauter_vacances: skip.checked });
      st.tab = Plan.weekType(today(), st.annee) || st.tab; draw();
    }
    dateInp.addEventListener('change', save);
    var cur = cfg ? Plan.weekType(t, st.annee) : null;
    var line = cfg ? h('p', { class: 'small' }, 'Cette semaine (du ' + fmtD(weekStart(t)) + ' au ' + fmtD(addDays(weekStart(t), 4)) + ') : ', h('strong', null, cur ? Plan.libSemaine(cur) : '—'), '.')
      : h('p', { class: 'small warnt' }, 'Pas encore réglé : tant que la semaine de rentrée n’est pas indiquée, les créneaux « semaine 1 / semaine 2 » sont considérés comme valables toutes les semaines.');
    var box = h('details', { class: 'card alt-card', open: !cfg }, h('summary', null, h('strong', null, '🔁 Semaines 1 / 2'), cfg ? ' — ' + (cur ? Plan.libSemaine(cur) + ' cette semaine' : 'réglée') : ' — à régler'),
      h('div', { class: 'form' }, h('div', { class: 'grid3' },
        UI.field('Semaine de référence (en général la rentrée)', dateInp, 'N’importe quel jour de cette semaine convient.'),
        UI.field('Cette semaine-là est une…', typeSel),
        h('div', { class: 'field' }, h('span', { class: 'lbl' }, 'Vacances'), h('label', { class: 'check' }, skip, ' Ne pas compter les semaines de vacances entières', h('span', { class: 'hint' }, ' (l’alternance reprend là où elle s’était arrêtée)')))),
        line));
    return box;
  }

  /* ── grille ── */
  function visibleSlots() {
    var out = [];
    classesOf().forEach(function (cl) { (cl.creneaux || []).forEach(function (c, i) { if (c.jour >= 1 && c.jour <= 6 && (!c.semaine || c.semaine === st.tab)) out.push({ cl: cl, i: i, c: c, a: toMin(c.debut), b: toMin(c.debut) + (+c.duree || 0) }); }); });
    return out;
  }
  function lanes(items) {
    items.sort(function (x, y) { return x.a - y.a || y.b - x.b; });
    var cluster = [], end = -1;
    function flush() { var n = cluster.reduce(function (m, x) { return Math.max(m, x.lane + 1); }, 1); cluster.forEach(function (x) { x.n = n; }); cluster = []; }
    items.forEach(function (it) {
      if (it.a >= end && cluster.length) { flush(); end = -1; }
      var used = {}; cluster.forEach(function (x) { if (x.b > it.a) used[x.lane] = true; });
      var l = 0; while (used[l]) l++; it.lane = l; cluster.push(it); end = Math.max(end, it.b);
    });
    if (cluster.length) flush();
  }
  function grid() {
    var slots = visibleSlots();
    var allSlots = []; classesOf().forEach(function (cl) { (cl.creneaux || []).forEach(function (c) { allSlots.push(c); }); });
    var days = [1, 2, 3, 4, 5]; if (allSlots.some(function (c) { return c.jour === 6; })) days.push(6);
    var deb = TT.DEB, fin = TT.FIN;
    slots.forEach(function (x) { deb = Math.min(deb, Math.floor(x.a / 60) * 60); fin = Math.max(fin, Math.ceil(x.b / 60) * 60); });
    deb = Math.max(0, deb); fin = Math.min(24 * 60, fin);
    var total = (fin - deb) / TT.SNAP * TT.H;
    var wrap = h('div', { class: 'tt-scroll' });
    var g = h('div', { class: 'tt' }); g.style.setProperty('--n', String(days.length));
    g.appendChild(h('div', { class: 'tt-corner' }));
    days.forEach(function (j) { g.appendChild(h('div', { class: 'tt-dh' }, TT_JOURS[j])); });
    var tc = h('div', { class: 'tt-times', style: { height: total + 'px' } });
    for (var m = deb; m < fin; m += 60) tc.appendChild(h('span', { style: { top: (m - deb) / TT.SNAP * TT.H + 'px' } }, fromMin(m)));
    g.appendChild(tc);
    var cols = {};
    days.forEach(function (j) {
      var col = h('div', { class: 'tt-col', 'data-j': String(j), style: { height: total + 'px' }, role: 'group', 'aria-label': TT_JOURS[j] });
      cols[j] = col; g.appendChild(col);
      var its = slots.filter(function (x) { return x.c.jour === j; }); lanes(its);
      its.forEach(function (x) { col.appendChild(block(x, deb)); });
      attachCreate(col, j, deb, fin);
    });
    function colAt(clientX) {
      var best = null, dist = 1e9;
      days.forEach(function (j) { var r = cols[j].getBoundingClientRect(); var d = clientX < r.left ? r.left - clientX : clientX > r.right ? clientX - r.right : 0; if (d < dist) { dist = d; best = j; } });
      return best;
    }
    g._colAt = colAt; wrap._g = g;
    wrap.appendChild(g); wrap._deb = deb; wrap._fin = fin; return wrap;
  }
  function snap(min) { return Math.round(min / TT.SNAP) * TT.SNAP; }

  function block(x, deb) {
    var cl = x.cl, c = x.c, top = (x.a - deb) / TT.SNAP * TT.H, hgt = Math.max(TT.H * 0.8, (x.b - x.a) / TT.SNAP * TT.H);
    var el = h('div', { class: 'tt-b' + (c.groupe ? ' grp' : ''), tabindex: 0, role: 'button', 'aria-label': cl.nom + ', ' + TT_JOURS[c.jour] + ' ' + c.debut + ' à ' + fromMin(x.b),
      style: { top: top + 'px', height: hgt - 1 + 'px', left: (x.lane / x.n * 100) + '%', width: (100 / x.n) + '%', background: cl.couleur, color: textOn(cl.couleur) } },
      h('b', null, cl.nom), h('span', { class: 'tt-t' }, c.debut + '–' + fromMin(x.b)), (c.groupe || c.salle || c.semaine) ? h('span', { class: 'tt-m' }, [c.groupe, c.salle, c.semaine ? 'S' + c.semaine : ''].filter(Boolean).join(' · ')) : null,
      h('i', { class: 'tt-rs', 'aria-hidden': 'true' }));
    el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); slotModal({ cl: cl, i: x.i }); } });
    var drag = null;
    el.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return; e.stopPropagation();
      drag = { x0: e.clientX, y0: e.clientY, moved: false, resize: e.target.classList.contains('tt-rs'), type: e.pointerType };
      try { el.setPointerCapture(e.pointerId); } catch (er) { /* ignoré */ }
    });
    el.addEventListener('pointermove', function (e) {
      if (!drag || drag.type === 'touch') return;
      var dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
      if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 5) return;
      drag.moved = true; el.classList.add('drag');
      if (drag.resize) el.style.height = Math.max(TT.H * 0.8, hgt - 1 + dy) + 'px';
      else el.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    });
    el.addEventListener('pointerup', function (e) {
      if (!drag) return; var dr = drag; drag = null; el.classList.remove('drag');
      try { el.releasePointerCapture(e.pointerId); } catch (er) { /* ignoré */ }
      if (!dr.moved) { slotModal({ cl: cl, i: x.i }); return; }
      var dy = e.clientY - dr.y0;
      if (dr.resize) {
        var nd = Math.max(TT.SNAP, snap((+c.duree || 0) + dy / TT.H * TT.SNAP)); c.duree = nd;
      } else {
        var ns = snap(x.a + dy / TT.H * TT.SNAP); ns = Math.max(0, Math.min(24 * 60 - TT.SNAP, ns));
        var j = holder.g._colAt(e.clientX); if (j) c.jour = j; c.debut = fromMin(ns);
      }
      DB.save('fs_classes', cl); draw();
    });
    el.addEventListener('pointercancel', function () { drag = null; el.classList.remove('drag'); el.style.transform = ''; });
    return el;
  }

  function attachCreate(col, j, deb, fin) {
    var ghost = null, g0 = null;
    function minAt(e) { var r = col.getBoundingClientRect(); return deb + (e.clientY - r.top) / TT.H * TT.SNAP; }
    col.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 || e.target !== col) return;
      var a = Math.floor(minAt(e) / TT.SNAP) * TT.SNAP;
      g0 = { a: a, y: e.clientY, x: e.clientX, b: a + TT.SNAP, moved: false, type: e.pointerType };
      try { col.setPointerCapture(e.pointerId); } catch (er) { /* ignoré */ }
    });
    col.addEventListener('pointermove', function (e) {
      if (!g0) return;
      if (!g0.moved && Math.abs(e.clientY - g0.y) < 6) return;
      g0.moved = true;
      var m = minAt(e), a = Math.min(g0.a, Math.floor(m / TT.SNAP) * TT.SNAP), b = Math.max(g0.a + TT.SNAP, Math.ceil(m / TT.SNAP) * TT.SNAP);
      if (m < g0.a) b = g0.a + TT.SNAP;
      g0.lo = Math.max(deb, a); g0.hi = Math.min(fin, b);
      if (!ghost) { ghost = h('div', { class: 'tt-ghost' }); col.appendChild(ghost); }
      ghost.style.top = (g0.lo - deb) / TT.SNAP * TT.H + 'px'; ghost.style.height = (g0.hi - g0.lo) / TT.SNAP * TT.H + 'px'; ghost.textContent = fromMin(g0.lo) + '–' + fromMin(g0.hi);
    });
    function end(e, cancel) {
      if (!g0) return; var d = g0; g0 = null; if (ghost) { ghost.remove(); ghost = null; }
      try { col.releasePointerCapture(e.pointerId); } catch (er) { /* ignoré */ }
      if (cancel) return;
      var lo, dur;
      if (d.moved && d.hi > d.lo) { lo = d.lo; dur = d.hi - d.lo; } else { lo = Math.max(deb, d.a); dur = 60; }
      slotModal({ jour: j, debut: fromMin(lo), duree: dur });
    }
    col.addEventListener('pointerup', function (e) { end(e, false); });
    col.addEventListener('pointercancel', function (e) { end(e, true); });
  }

  /* ── fenêtre de création / modification ── */
  function slotModal(o) {
    var cls = classesOf();
    if (!cls.length) { UI.toast('Créez d’abord une classe pour l’année ' + st.annee + '.'); return; }
    var edit = o.cl && o.i !== undefined, cur = edit ? o.cl.creneaux[o.i] : null;
    var d = edit ? { cl: o.cl, jour: cur.jour, debut: cur.debut, duree: +cur.duree, semaine: cur.semaine || 0, groupe: cur.groupe || '', salle: cur.salle || '' }
      : { cl: Cls.get(Store.get('last_class')) && classesOf().indexOf(Cls.get(Store.get('last_class'))) >= 0 ? Cls.get(Store.get('last_class')) : cls[0], jour: o.jour || 1, debut: o.debut || '08:00', duree: o.duree || 60, semaine: +(Store.get('last_sem') || 0), groupe: '', salle: '' };
    var warn = h('p', { class: 'small warnt', role: 'status' }), fin = h('span', { class: 'muted small' });
    var clsSel = UI.select(cls.map(function (c) { return [c.id, c.nom]; }), d.cl.id, function (v) { d.cl = Cls.get(v); upd(); });
    var jourSel = UI.select([1, 2, 3, 4, 5, 6].map(function (j) { return [j, TT_JOURS[j]]; }), d.jour, function (v) { d.jour = +v; upd(); });
    var debInp = h('input', { class: 'inp', type: 'time', step: 300, value: d.debut, onchange: function (e) { d.debut = e.target.value || d.debut; upd(); } });
    var durInp = h('input', { class: 'inp num', type: 'number', min: 5, max: 480, step: 5, value: d.duree, oninput: function (e) { d.duree = Math.max(5, Math.min(480, +e.target.value || 0)); upd(); } });
    var quick = h('div', { class: 'chips' }, [30, 55, 60, 110, 120].map(function (m) { return h('button', { class: 'chip', type: 'button', onclick: function () { d.duree = m; durInp.value = m; upd(); } }, fmtDuree(m)); }));
    var semSel = UI.select([[0, 'Les deux semaines'], [1, 'Semaine 1 uniquement'], [2, 'Semaine 2 uniquement']], d.semaine, function (v) { d.semaine = +v; upd(); });
    var grpSel = UI.select([['', 'Classe entière'], ['G1', 'Groupe 1'], ['G2', 'Groupe 2']], d.groupe, function (v) { d.groupe = v; upd(); });
    var salInp = h('input', { class: 'inp', type: 'text', maxlength: 30, value: d.salle, placeholder: 'Ex. B204 (facultatif)', oninput: function (e) { d.salle = e.target.value; } });
    function upd() {
      fin.textContent = 'Fin : ' + hhmmAdd(d.debut, d.duree) + ' (' + fmtDuree(d.duree) + ')';
      var a = toMin(d.debut), b = a + d.duree, lst = [];
      DB.list('fs_classes').forEach(function (cl) {
        if (cl.archive || cl.annee_scolaire !== d.cl.annee_scolaire) return;
        (cl.creneaux || []).forEach(function (c, i) {
          if (edit && cl.id === o.cl.id && i === o.i) return;
          if (c.jour !== d.jour) return;
          if (d.semaine && c.semaine && c.semaine !== d.semaine) return;
          var ca = toMin(c.debut), cb = ca + (+c.duree || 0);
          if (ca < b && cb > a) lst.push(cl.nom + ' ' + c.debut + '–' + hhmmAdd(c.debut, c.duree));
        });
      });
      warn.textContent = lst.length ? '⚠ Chevauche : ' + lst.join(' ; ') + ' (normal en demi-groupes ou co-intervention).' : '';
      if (edit && !d.semaine) warn.textContent += (warn.textContent ? ' ' : '') + 'Ce créneau a lieu les deux semaines : la modification s’applique aux deux.';
    }
    upd();
    var form = h('div', { class: 'form' }, UI.field('Classe', clsSel), h('div', { class: 'grid2' }, UI.field('Jour', jourSel), UI.field('Début', debInp)),
      UI.field('Durée (minutes)', h('div', null, durInp, ' ', fin), 'Glissez sur la grille pour des multiples de 30 min, ou saisissez ici une durée exacte.'), quick,
      h('div', { class: 'grid2' }, UI.field('Semaine', semSel), UI.field('Groupe', grpSel)), UI.field('Salle', salInp), warn);
    var actions = [{ label: 'Annuler', kind: 'ghost' }];
    if (edit) actions.unshift({ label: 'Supprimer', kind: 'danger', onClick: function () { o.cl.creneaux.splice(o.i, 1); DB.save('fs_classes', o.cl); draw(); } });
    actions.push({ label: edit ? 'Enregistrer' : 'Ajouter', kind: 'primary', onClick: function () {
      if (!/^\d{2}:\d{2}$/.test(d.debut) || d.duree < 5) { UI.toast('Heure ou durée invalide.', 'err'); return false; }
      var slot = { jour: d.jour, debut: d.debut, duree: d.duree }; if (d.semaine) slot.semaine = d.semaine; if (d.groupe) slot.groupe = d.groupe; if (d.salle.trim()) slot.salle = d.salle.trim().slice(0, 30);
      if (edit) {
        if (d.cl.id === o.cl.id) { d.cl.creneaux[o.i] = slot; DB.save('fs_classes', d.cl); }
        else { o.cl.creneaux.splice(o.i, 1); DB.save('fs_classes', o.cl); d.cl.creneaux = (d.cl.creneaux || []).concat([slot]); DB.save('fs_classes', d.cl); }
      } else { d.cl.creneaux = (d.cl.creneaux || []).concat([slot]); DB.save('fs_classes', d.cl); Store.set('last_class', d.cl.id); }
      Store.set('last_sem', String(d.semaine)); draw();
    } });
    UI.modal({ title: edit ? 'Modifier le créneau' : 'Nouveau créneau', body: form, actions: actions });
  }

  /* ── totaux ── */
  function totals() {
    var box = h('section', { class: 'card' }, h('h2', null, 'Heures par semaine'));
    var cls = classesOf(), T = { s1: 0, s2: 0 };
    if (!cls.length) { box.appendChild(h('p', { class: 'muted' }, 'Aucune classe pour ' + st.annee + '.')); return box; }
    var tbl = h('table', { class: 'tbl tt-sum' }, h('thead', null, h('tr', null, h('th', null, 'Classe'), h('th', null, 'Semaine 1'), h('th', null, 'Semaine 2'))));
    var tb = h('tbody');
    cls.forEach(function (cl) {
      var x = Plan.heuresHebdo(cl); T.s1 += x.s1 + x.gs1; T.s2 += x.s2 + x.gs2;
      function cell(p, g) { return p || g ? fmtDuree(p) + (g ? ' + ' + fmtDuree(g) + ' en demi-groupes' : '') : '—'; }
      tb.appendChild(h('tr', null, h('td', null, h('a', { href: '#/classe/' + cl.id }, Cls.chip(cl))), h('td', null, cell(x.s1, x.gs1)), h('td', null, cell(x.s2, x.gs2))));
    });
    tb.appendChild(h('tr', { class: 'tot' }, h('td', null, 'Total enseigné'), h('td', null, fmtDuree(T.s1)), h('td', null, fmtDuree(T.s2))));
    tbl.appendChild(tb); box.appendChild(h('div', { class: 'tbl-wrap' }, tbl));
    box.appendChild(h('p', { class: 'muted small' }, 'Les créneaux « les deux semaines » comptent dans chaque colonne. Les demi-groupes sont comptés à part pour chaque classe, et dans le total enseigné.'));
    return box;
  }

  var holder = {};
  function draw() {
    clear(body);
    var cfg = Plan.altConfig(st.annee);
    body.appendChild(altCard());
    var tabs = h('div', { class: 'tabs', role: 'tablist' }, [1, 2].map(function (n) {
      var cur = cfg && curType() === n;
      return h('button', { class: 'tab' + (st.tab === n ? ' on' : ''), type: 'button', role: 'tab', 'aria-selected': st.tab === n ? 'true' : 'false', onclick: function () { st.tab = n; draw(); } }, Plan.libSemaine(n) + (cur ? ' (en cours)' : ''));
    }));
    body.appendChild(tabs);
    body.appendChild(h('p', { class: 'muted small' }, 'Astuce : sur ordinateur, faites glisser sur la grille pour créer un créneau (par pas de 30 min), déplacez un créneau en le tirant, étirez-le par le bas. Sur téléphone, touchez la grille ou un créneau.'));
    var g = grid(); holder.g = g._g || g.firstChild; body.appendChild(g);
    var hs = h('div', { class: 'row-gap' }, h('button', { class: 'btn', type: 'button', onclick: function () { slotModal({ jour: 1, debut: '08:00', duree: 60 }); } }, '＋ Ajouter un créneau'));
    body.appendChild(hs);
    body.appendChild(totals());
  }

  var annSel = annees.length > 1 ? UI.select(annees.map(function (a) { return [a, a]; }), st.annee, function (v) { st.annee = v; Store.set('plan_annee', v); st.tab = curType() || 1; draw(); }, 'sm') : null;
  root.appendChild(pageHead('Emploi du temps', 'Mes créneaux de cours, semaine 1 et semaine 2', annSel ? [annSel] : []));
  root.appendChild(body); draw();
  return root;
};
