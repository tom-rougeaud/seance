/* ═══ FICHES · « Mon année » : l’année par périodes (entre vacances), une pastille par semaine.
   On touche une semaine : l’emploi du temps de cette semaine s’affiche. On touche un cours : l’éditeur de séance s’ouvre,
   à la bonne date et avec la durée du créneau. Une fois la séance validée, on revient ici pour choisir le cours suivant.
   En glissant sur plusieurs semaines (ou via « Prévoir une séquence »), on prévoit la durée d’une séquence. ═══ */
'use strict';
var Annee = { from: null, H: 36 };   /* from : { sid, week } tant qu’on édite une séance ouverte depuis « Mon année » */

Views.annee = function (arg) {
  var classes = Cls.actives().filter(function (c) { return c.annee_scolaire === anneeScolaire(); });
  if (!classes.length) classes = Cls.actives();
  var root = h('div', { class: 'page an' });
  if (!classes.length) {
    root.appendChild(pageHead('Mon année', 'Toutes les semaines de l’année, par période'));
    root.appendChild(h('div', { class: 'card hero' }, h('h2', null, 'Commencez par créer une classe'), h('p', { class: 'muted' }, 'Ensuite, indiquez vos créneaux dans l’emploi du temps : ils apparaîtront ici, semaine par semaine.'), h('a', { class: 'btn primary', href: '#/classes' }, '👥 Mes classes')));
    return root;
  }
  var saved = arg || Store.get('annee_class');
  var st = { cid: classes.some(function (c) { return c.id === saved; }) ? saved : '', week: null, pick: null, focusSeq: null };   /* cid vide = toutes les classes */
  var head = h('div'), body = h('div');
  var drag = null, suppress = false;

  function visible() { return st.cid ? classes.filter(function (c) { return c.id === st.cid; }) : classes; }
  function weeksOf(per) { var o = []; per.forEach(function (p) { p.weeks.forEach(function (w) { o.push(w); }); }); return o; }
  function monthDay(iso) { var d = parseISO(iso); return d.getDate() + '/' + (d.getMonth() + 1); }
  function seqColor(q) { var n = Cls.sequences(q.class_id).map(function (x) { return x.id; }).indexOf(q.id); return K.PALETTE[(Math.max(n, 0) + 3) % K.PALETTE.length]; }
  /* périodes : celles de la classe choisie, sinon celles de la première classe (même calendrier pour toute l’année) */
  function periods() { return Plan.periods(visible()[0]); }
  function chooseWeek(ws) {
    var s = Store.get('annee_week'); if (s && ws.indexOf(s) >= 0) return s;
    var cur = weekStart(today()); if (ws.indexOf(cur) >= 0) return cur;
    return ws.filter(function (w) { return w >= cur; })[0] || ws[0] || cur;
  }
  /* créneaux de la semaine pour les classes affichées */
  function slotsOf(w) {
    var o = []; visible().forEach(function (c) { Plan.weekSlots(c, w).forEach(function (s) { s.cl = c; o.push(s); }); });
    return o.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : a.debut < b.debut ? -1 : a.debut > b.debut ? 1 : 0; });
  }
  function ctxFor() {
    var by = {}, plan = [], alt = false;
    visible().forEach(function (c) { by[c.id] = Plan.seancesByDate(c); Plan.planned(c).forEach(function (p) { plan.push(p); }); if (Plan.altConfig(c.annee_scolaire)) alt = true; });
    plan.sort(function (x, y) { return x.a < y.a ? -1 : x.a > y.a ? 1 : 0; });
    return { by: by, plan: plan, alt: alt };
  }
  function seanceOf(sl, ctx) { return Plan.seanceFor(sl.cl, sl, ctx.by[sl.cl.id]); }
  function planAt(date, ctx, cid) { return ctx.plan.filter(function (p) { return date >= p.a && date <= p.b && (!cid || p.q.class_id === cid); })[0]; }

  /* ── séquence prévue sur plusieurs semaines ── */
  function createSeq(c, a, b) {
    var lo = a < b ? a : b, hi = a < b ? b : a;
    var q = createSequence(c, { titre: 'Nouvelle séquence', data: { plan: { a: lo, b: addDays(hi, 4) } } });
    st.focusSeq = q.id; st.week = lo; st.pick = null; Store.set('annee_week', lo); draw();
    UI.toast('Séquence prévue sur ' + plural(weeksOf(periods()).filter(function (w) { return w >= lo && w <= hi; }).length, 'semaine') + ' : donnez-lui un nom.');
  }
  function makeSeq(a, b) {
    st.pick = null;
    if (st.cid) { createSeq(Cls.get(st.cid), a, b); return; }
    if (classes.length === 1) { createSeq(classes[0], a, b); return; }
    var sel = UI.select(classes.map(function (c) { return [c.id, c.nom]; }), Store.get('last_class') || classes[0].id, function () { /* lu à la validation */ });
    UI.modal({ title: 'Pour quelle classe ?', body: h('div', { class: 'form' }, h('p', { class: 'muted' }, 'Séquence du ' + fmtDM(a < b ? a : b) + ' au ' + fmtDM(addDays(a < b ? b : a, 4)) + '.'), UI.field('Classe', sel)),
      actions: [{ label: 'Annuler', kind: 'ghost', onClick: function () { draw(); } }, { label: 'Créer la séquence', kind: 'primary', onClick: function () { createSeq(Cls.get(sel.value), a, b); } }] });
  }
  function unplan(q) {
    var vide = !((q.data.items || []).length) && !Cls.seancesDe(q.id).length && !DB.list('fs_attachments').some(function (a) { return a.parent_id === q.id; });
    if (vide) DB.remove('fs_sequences', q.id); else { q.data.plan = null; DB.save('fs_sequences', q); }
    UI.toast(vide ? 'Séquence retirée.' : 'Retirée du calendrier (la séquence existe toujours dans la classe).'); draw();
  }

  /* ── glisser sur plusieurs semaines (souris, stylet) ── */
  function paintDrag() {
    var lo = drag && (drag.a < drag.b ? drag.a : drag.b), hi = drag && (drag.a < drag.b ? drag.b : drag.a);
    $$('.an-w', body).forEach(function (el) { var w = el.getAttribute('data-w'); el.classList.toggle('drag', !!drag && lo !== hi && w >= lo && w <= hi); });
  }
  function stopDrag() { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); window.removeEventListener('pointercancel', onCancel); }
  function onMove(e) {
    if (!drag) return;
    var el = document.elementFromPoint(e.clientX, e.clientY), wb = el && el.closest ? el.closest('.an-w') : null;
    if (wb) { var w = wb.getAttribute('data-w'); if (w !== drag.b) { drag.b = w; if (w !== drag.a) drag.moved = true; paintDrag(); } }
  }
  function onUp() { stopDrag(); var d = drag; drag = null; if (!d) return; if (d.moved && d.a !== d.b) { suppress = true; setTimeout(function () { suppress = false; }, 0); makeSeq(d.a, d.b); } else paintDrag(); }
  function onCancel() { stopDrag(); drag = null; paintDrag(); }

  /* ── une pastille = une semaine ── */
  function weekBtn(w, ctx) {
    var slots = slotsOf(w), done = slots.filter(function (s) { return seanceOf(s, ctx); }).length;
    var on = w === st.week, now = w === weekStart(today());
    var band = ctx.plan.filter(function (p) { return w >= p.a && w <= weekStart(p.b); })[0];
    var type = ctx.alt ? Plan.weekType(w, visible()[0].annee_scolaire) : null;
    var state = !slots.length ? '—' : done === slots.length ? '✓' : done + '/' + slots.length;
    var c0 = st.cid ? visible()[0] : null, col = c0 ? c0.couleur : null;
    var b = h('button', { class: 'an-w' + (on ? ' on' : '') + (now ? ' now' : '') + (slots.length && done === slots.length ? ' full' : '') + (!slots.length ? ' empty' : '') + (st.pick && st.pick.a === w ? ' picka' : ''), type: 'button', 'data-w': w, 'aria-pressed': on ? 'true' : 'false',
      'aria-label': 'Semaine du ' + fmtDM(w) + (type ? ', semaine ' + type : '') + (now ? ', semaine en cours' : '') + ', ' + (slots.length ? done + ' séance' + (done > 1 ? 's' : '') + ' préparée' + (done > 1 ? 's' : '') + ' sur ' + slots.length : 'pas de cours'),
      style: on ? { background: col || 'var(--primary)', borderColor: col || 'var(--primary)', color: col ? textOn(col) : 'var(--on-primary)' } : null },
      h('span', { class: 'an-s' }, type ? 'S' + type : ' '), h('span', { class: 'an-d' }, monthDay(w)), h('span', { class: 'an-n' }, state),
      band ? h('i', { class: 'an-bar', style: { background: seqColor(band.q) }, 'aria-hidden': 'true' }) : null);
    b.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'touch' || e.button !== 0) return;
      drag = { a: w, b: w, moved: false };
      window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp); window.addEventListener('pointercancel', onCancel);
    });
    b.addEventListener('click', function () {
      if (suppress) return;
      if (st.pick) { makeSeq(st.pick.a, w); return; }
      st.week = w; Store.set('annee_week', w); draw();
      if (window.innerWidth < 900) { var sd = $('.an-side', body); if (sd) { try { sd.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (er) { sd.scrollIntoView(); } } }
    });
    return b;
  }

  function bandLine(p, ctx, ws) {
    var q = p.q, c = Cls.get(q.class_id), n = ws.filter(function (w) { return w >= p.a && w <= weekStart(p.b); }).length, mins = Plan.heuresDispo(c, p.a, p.b).minutes, nbS = Cls.seancesDe(q.id).filter(function (s) { return s.statut !== 'annulee'; }).length;
    var name = h('input', { class: 'inp an-name', type: 'text', maxlength: 120, value: q.titre || '', placeholder: 'Nom de la séquence', 'aria-label': 'Nom de la séquence', onchange: function (e) { q.titre = e.target.value.trim(); DB.save('fs_sequences', q); } });
    if (st.focusSeq === q.id) { st.focusSeq = null; setTimeout(function () { try { name.focus(); name.select(); } catch (e) { /* ignoré */ } }, 60); }
    return h('div', { class: 'an-band' }, h('i', { class: 'an-sw', style: { background: seqColor(q) }, 'aria-hidden': 'true' }), st.cid ? null : Cls.chip(c), name,
      h('span', { class: 'muted small an-info' }, plural(n, 'semaine') + ' · prévu : ', h('strong', null, mins ? fmtDuree(mins) : '—'), nbS ? ' · ' + plural(nbS, 'séance') : ''),
      h('span', { class: 'grow' }), h('a', { class: 'btn small', href: '#/sequence/' + q.id }, 'Ouvrir'),
      h('button', { class: 'btn ghost small', type: 'button', title: 'Retirer cette séquence du calendrier', onclick: function () { unplan(q); } }, 'Retirer'));
  }
  function periodBox(per, ctx, ws) {
    var box = h('section', { class: 'card an-per' }, h('div', { class: 'an-ph' }, h('h2', null, per.title), h('span', { class: 'muted small' }, 'du ' + fmtDM(per.debut) + ' au ' + fmtDM(per.fin) + ' · ' + plural(per.weeks.length, 'semaine'))));
    var grid = h('div', { class: 'an-weeks', role: 'group', 'aria-label': per.title }); per.weeks.forEach(function (w) { grid.appendChild(weekBtn(w, ctx)); });
    box.appendChild(grid);
    ctx.plan.forEach(function (p) {
      var inP = per.weeks.filter(function (w) { return w >= p.a && w <= weekStart(p.b); }); if (!inP.length) return;
      var started = ws.filter(function (w) { return w >= p.a && w <= weekStart(p.b); })[0];
      if (started === inP[0]) box.appendChild(bandLine(p, ctx, ws));
      else box.appendChild(h('div', { class: 'an-band cont muted small' }, h('i', { class: 'an-sw', style: { background: seqColor(p.q) }, 'aria-hidden': 'true' }), 'Suite de « ' + (p.q.titre || 'séquence') + ' »'));
    });
    return box;
  }

  /* ── l’emploi du temps de la semaine choisie ── */
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
  function openSlot(sl, ctx) {
    var s = seanceOf(sl, ctx);
    Store.set('annee_week', st.week); Store.set('last_class', sl.cl.id);
    if (!s) { var band = planAt(sl.date, ctx, sl.cl.id); s = Wizard.fromSlot(sl, band ? band.q.id : null); }
    Annee.from = { sid: s.id, week: st.week };
    location.hash = '#/seance/' + s.id;
  }
  function weekGrid(w, slots, ctx) {
    var items = slots.map(function (x) { return { x: x, a: toMin(x.debut), b: toMin(x.debut) + x.duree }; });
    var days = [1, 2, 3, 4, 5]; if (slots.some(function (x) { return x.c.jour === 6; })) days.push(6);
    var deb = 8 * 60, fin = 18 * 60; items.forEach(function (it) { deb = Math.min(deb, Math.floor(it.a / 60) * 60); fin = Math.max(fin, Math.ceil(it.b / 60) * 60); });
    deb = Math.max(0, deb); fin = Math.min(24 * 60, fin);
    var H = Annee.H, total = (fin - deb) / 30 * H, rs0 = visible()[0], rs = Plan.ranges(rs0.id, rs0.annee_scolaire);
    var wrap = h('div', { class: 'tt-scroll' }), g = h('div', { class: 'tt an-tt' }); g.style.setProperty('--n', String(days.length));
    g.appendChild(h('div', { class: 'tt-corner' }));
    days.forEach(function (j) { var d = addDays(w, j - 1), why = Plan.blockedReason(d, rs); g.appendChild(h('div', { class: 'tt-dh', title: why ? why.label : null }, TT_JOURS[j] + ' ' + parseISO(d).getDate(), why ? h('small', { class: 'an-off' }, why.label) : null)); });
    var tc = h('div', { class: 'tt-times', style: { height: total + 'px' } });
    for (var m = deb; m < fin; m += 60) tc.appendChild(h('span', { style: { top: (m - deb) / 30 * H + 'px' } }, fromMin(m)));
    g.appendChild(tc);
    days.forEach(function (j) {
      var d = addDays(w, j - 1), off = !!Plan.blockedReason(d, rs);
      var col = h('div', { class: 'tt-col an-col' + (off ? ' off' : ''), style: { height: total + 'px' }, role: 'group', 'aria-label': TT_JOURS[j] });
      var its = items.filter(function (it) { return it.x.c.jour === j; }); lanes(its);
      its.forEach(function (it) { col.appendChild(slotBlock(it, deb, ctx)); });
      g.appendChild(col);
    });
    wrap.appendChild(g); return wrap;
  }
  function slotBlock(it, deb, ctx) {
    var x = it.x, c = x.c, cl = x.cl, s = seanceOf(x, ctx), H = Annee.H, mat = matId(c) !== 'maths';
    var meta = [matShort(c), c.groupe, c.salle].filter(Boolean).join(' · ');
    var titre = s ? (s.titre || '(sans titre)') + (s.statut === 'faite' ? ' ✓' : s.statut === 'prete' ? ' · prête' : '') : '＋ Préparer';
    var el = h('div', { class: 'tt-b an-tb' + (s ? ' has' : '') + (c.groupe ? ' grp' : ''), tabindex: 0, role: 'button',
      'aria-label': cl.nom + ', ' + matLabel(c) + ', ' + TT_JOURS[c.jour] + ' ' + c.debut + ' à ' + fromMin(it.b) + (s ? ', ' + (s.titre || 'séance sans titre') : ', séance à préparer'),
      style: Object.assign({ top: (it.a - deb) / 30 * H + 'px', height: Math.max(H * 0.9, (it.b - it.a) / 30 * H) - 2 + 'px', left: (it.lane / it.n * 100) + '%', width: (100 / it.n) + '%', borderColor: cl.couleur }, s ? { background: cl.couleur, color: textOn(cl.couleur) } : { color: 'var(--text)' }) },
      h('b', { style: s ? null : { color: cl.couleur } }, cl.nom), h('span', { class: 'tt-t' }, c.debut + '–' + fromMin(it.b)), mat || c.groupe || c.salle ? h('span', { class: 'tt-m' }, meta) : null,
      h('span', { class: 'an-bt' }, titre));
    el.addEventListener('click', function () { openSlot(x, ctx); });
    el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSlot(x, ctx); } });
    return el;
  }
  function sidePanel(ws, ctx) {
    var w = st.week, side = h('section', { class: 'an-side', 'aria-label': 'Emploi du temps de la semaine' });
    var i = ws.indexOf(w), prev = ws[i - 1], next = ws[i + 1], slots = slotsOf(w);
    var type = ctx.alt ? Plan.weekType(w, visible()[0].annee_scolaire) : null, done = slots.filter(function (s) { return seanceOf(s, ctx); }).length;
    function go(x) { return function () { st.week = x; Store.set('annee_week', x); draw(); }; }
    side.appendChild(h('div', { class: 'an-sh' },
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Semaine précédente', disabled: prev ? null : 'disabled', onclick: prev ? go(prev) : null }, '‹'),
      h('div', { class: 'an-st' }, h('h2', null, 'Semaine du ' + fmtDM(w) + (type ? ' · S' + type : '')), h('div', { class: 'muted small' }, (w === weekStart(today()) ? 'En cours · ' : '') + (slots.length ? plural(done, 'séance préparée') + ' sur ' + slots.length : 'pas de cours'))),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Semaine suivante', disabled: next ? null : 'disabled', onclick: next ? go(next) : null }, '›')));
    var inBand = ctx.plan.filter(function (p) { return w >= p.a && w <= weekStart(p.b); });
    if (inBand.length) side.appendChild(h('div', { class: 'an-inband' }, inBand.map(function (p) { return h('a', { class: 'an-tag', href: '#/sequence/' + p.q.id, style: { borderColor: seqColor(p.q) } }, '📚 ' + (p.q.titre || 'Séquence')); })));
    if (!visible().some(function (c) { return (c.creneaux || []).length; })) {
      side.appendChild(h('p', { class: 'warnt' }, 'Aucun créneau n’est encore saisi.'));
      side.appendChild(h('a', { class: 'btn primary', href: '#/planning' }, '🕒 Remplir l’emploi du temps'));
      return side;
    }
    if (!slots.length) side.appendChild(h('p', { class: 'muted' }, 'Aucun cours cette semaine' + (type ? ' (semaine ' + type + ')' : '') + '.'));
    else {
      side.appendChild(h('p', { class: 'small muted an-leg' }, 'Touchez un cours pour ouvrir son éditeur. ', h('span', { class: 'an-lg has' }, 'plein'), ' = préparé · ', h('span', { class: 'an-lg' }, 'pointillé'), ' = à préparer'));
      side.appendChild(weekGrid(w, slots, ctx));
    }
    var matched = {}; slots.forEach(function (sl) { var s = seanceOf(sl, ctx); if (s) matched[s.id] = true; });
    var autres = DB.list('fs_seances').filter(function (s) { var c = Cls.get(s.class_id); return c && visible().indexOf(c) >= 0 && s.statut !== 'annulee' && s.date_prevue && s.date_prevue >= w && s.date_prevue <= addDays(w, 6) && !matched[s.id]; }).sort(Cls.cmpSeance);
    if (autres.length) {
      side.appendChild(h('h3', { class: 'man-h' }, 'Autres séances de la semaine'));
      autres.forEach(function (s) { side.appendChild(h('a', { class: 'an-other', href: '#/seance/' + s.id, onclick: function () { Store.set('annee_week', w); Annee.from = { sid: s.id, week: w }; } }, h('span', { class: 'muted small' }, fmtDL(s.date_prevue) + ' · ' + Cls.get(s.class_id).nom), ' ', s.titre || '(sans titre)')); });
    }
    side.appendChild(h('div', { class: 'an-tools' },
      h('button', { class: 'btn', type: 'button', onclick: function () { st.pick = { a: w }; draw(); } }, '📚 Prévoir une séquence à partir d’ici'),
      h('button', { class: 'btn ghost small', type: 'button', onclick: function () { Wizard.seance({ classId: st.cid || undefined }); } }, '＋ Séance hors créneau')));
    return side;
  }

  function draw() {
    Store.set('annee_class', st.cid || '');
    var per = periods(), ws = weeksOf(per); if (!st.week || ws.indexOf(st.week) < 0) st.week = chooseWeek(ws);
    var ctx = ctxFor();
    clear(head); clear(body);
    head.appendChild(h('div', { class: 'chips an-cls', role: 'group', 'aria-label': 'Classe' }, [{ id: '', nom: 'Toutes', couleur: null }].concat(classes).map(function (k) {
      var on = k.id === st.cid;
      return h('button', { class: 'chip an-cl' + (on ? ' on' : ''), type: 'button', 'aria-pressed': on ? 'true' : 'false', style: k.couleur ? (on ? { background: k.couleur, borderColor: k.couleur, color: textOn(k.couleur) } : { borderColor: k.couleur }) : null, onclick: function () { st.cid = k.id; st.pick = null; st.week = null; draw(); } }, k.nom);
    })));
    if (st.pick) head.appendChild(h('div', { class: 'an-pick', role: 'status' }, h('strong', null, 'Séquence : '), 'touchez la dernière semaine (début : semaine du ' + fmtDM(st.pick.a) + '). ', h('button', { class: 'btn small', type: 'button', onclick: function () { st.pick = null; draw(); } }, 'Annuler')));
    else head.appendChild(h('p', { class: 'an-how' }, h('b', null, '1.'), ' Touchez une semaine. ', h('b', null, '2.'), ' Touchez le cours à préparer. ', h('span', { class: 'muted' }, 'Pour une séquence : glissez sur plusieurs semaines.')));
    var wrap = h('div', { class: 'an-wrap' }), left = h('div', { class: 'an-left' });
    if (!ws.length) left.appendChild(h('p', { class: 'muted' }, 'Aucune semaine à afficher.'));
    per.forEach(function (p, i) {
      left.appendChild(periodBox(p, ctx, ws));
      if (i < per.length - 1) left.appendChild(h('div', { class: 'an-vac' }, '— Vacances ' + (p.to ? '(' + p.to + ')' : '') + ' —'));
    });
    if (!Plan.ranges(visible()[0].id, visible()[0].annee_scolaire).some(function (r) { return r.type === 'vacances'; })) left.appendChild(h('p', { class: 'muted small' }, 'Aucune vacance n’est enregistrée : les semaines sont regroupées par 8. Ajoutez le calendrier scolaire dans la fiche d’une classe pour les regrouper entre les vacances.'));
    wrap.appendChild(left); wrap.appendChild(sidePanel(ws, ctx));
    body.appendChild(wrap);
  }

  root.appendChild(pageHead('Mon année', 'Toutes les semaines, par période entre les vacances', [h('a', { class: 'btn small', href: '#/planning' }, '🕒 Modifier mes créneaux')]));
  root.appendChild(head); root.appendChild(body);
  draw();
  return root;
};
