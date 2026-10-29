/* ═══ FICHES · briques communes aux éditeurs de séances et de séquences ═══ */
'use strict';
var Ed = (function () {
  /* enregistrement différé d’une fiche */
  function saver(table, rec) {
    var d = debounce(function () { DB.save(table, rec); }, 450);
    var f = function () { d(); };
    f.now = function () { d.flush(); DB.save(table, rec); };
    return f;
  }

  /* panneau « programme » : accordéons + éléments choisis + compétences */
  function itemsPanel(opt) {
    var rec = opt.rec, cl = opt.cl, changed = opt.changed, withNiv = !!opt.withNiv;
    var wrap = h('div', { class: 'items-panel' });
    var chosen = h('div', { class: 'chosen' });
    var compBox = h('div', { class: 'comp-box' });
    var picker;

    function chosenDraw() {
      clear(chosen);
      var its = rec.data.items;
      if (!its.length) { chosen.appendChild(h('p', { class: 'muted small' }, 'Rien de coché pour l’instant : ouvrez un chapitre ci-dessous et cochez les objectifs visés.')); return; }
      var groups = [], idx = {};
      its.forEach(function (it, i) {
        var key = it.chap || (it.k === 'a' ? '__a' : '__p');
        if (!(key in idx)) { idx[key] = groups.length; var l = it.chap ? Ref.lookup(it.chap) : null; groups.push({ key: key, titre: l ? l.txt : (it.k === 'a' ? 'Automatismes' : 'Autres'), rows: [] }); }
        groups[idx[key]].rows.push({ it: it, i: i });
      });
      groups.forEach(function (g) {
        var box = h('div', { class: 'ch-grp' }, h('div', { class: 'ch-t' }, g.titre));
        g.rows.forEach(function (r) {
          var it = r.it;
          var tag = it.k === 'o' ? 'Objectif' : it.k === 'k' ? 'Notion' : it.k === 'a' ? 'Auto.' : 'Autre';
          box.appendChild(h('div', { class: 'ch-row' }, h('span', { class: 'kind k-' + it.k }, tag), h('span', { class: 'ch-txt' }, it.txt),
            withNiv ? UI.select(K.NIVEAUX_VISES, it.niv, function (v) { it.niv = v; changed(); }, 'sm') : null,
            h('button', { class: 'icon-btn sm', type: 'button', title: 'Retirer', onclick: function () {
              var l = Ref.lookup(it.ref); var chap = l && l.chap ? l.chap : (it.chap ? { id: it.chap } : null);
              toggleItem(rec, it.k, { id: it.ref, txt: it.txt, comp: [] }, false, chap, rec.type); changed(); refreshAll();
            } }, '✕')));
        });
        chosen.appendChild(box);
      });
    }

    function compDraw() {
      clear(compBox);
      var cs = Ref.comps(cl.niveau_id), d = rec.data;
      var head = h('div', { class: 'comp-head' }, h('strong', null, 'Compétences travaillées'),
        h('button', { class: 'chip', type: 'button', title: 'Proposer d’après les verbes des objectifs cochés', onclick: function () { d.competences = suggestComps(rec); d.comp_manual = false; changed(); compDraw(); } }, '✨ Suggérer'));
      compBox.appendChild(head);
      var row = h('div', { class: 'comps' });
      cs.forEach(function (c) {
        var on = d.competences.indexOf(c.id) >= 0;
        row.appendChild(h('button', { class: 'comp' + (on ? ' on' : ''), type: 'button', style: on ? { background: c.couleur, color: textOn(c.couleur), borderColor: c.couleur } : { borderColor: c.couleur }, title: (c.capacites || []).join('\n'), 'aria-pressed': on ? 'true' : 'false',
          onclick: function () { var i = d.competences.indexOf(c.id); if (i >= 0) d.competences.splice(i, 1); else d.competences.push(c.id); d.comp_manual = true; changed(); compDraw(); } }, c.nom));
      });
      compBox.appendChild(row);
      /* capacités détaillées des compétences retenues */
      var caps = [];
      d.competences.forEach(function (cid) { var c = Ref.compById(cl.niveau_id, cid); if (c) (c.capacites || []).forEach(function (x) { caps.push({ cid: cid, txt: x, col: c.couleur }); }); });
      if (caps.length) {
        var det = h('details', { class: 'caps' }, h('summary', null, 'Capacités visées (' + (d.comp_caps || []).length + ' cochée' + ((d.comp_caps || []).length > 1 ? 's' : '') + ')'));
        caps.forEach(function (c) {
          var on = (d.comp_caps || []).indexOf(c.txt) >= 0;
          var cb = h('input', { type: 'checkbox', checked: on });
          cb.addEventListener('change', function () { d.comp_caps = d.comp_caps || []; var i = d.comp_caps.indexOf(c.txt); if (cb.checked && i < 0) d.comp_caps.push(c.txt); if (!cb.checked && i >= 0) d.comp_caps.splice(i, 1); changed(); det.firstChild.textContent = 'Capacités visées (' + d.comp_caps.length + ' cochée' + (d.comp_caps.length > 1 ? 's' : '') + ')'; });
          det.appendChild(h('label', { class: 'cap-row' }, cb, h('span', { class: 'dot', style: { background: c.col } }), c.txt));
        });
        compBox.appendChild(det);
      }
    }

    function refreshAll() { chosenDraw(); compDraw(); if (picker) picker.refresh(); if (opt.onCount) opt.onCount(rec.data.items.length); }

    picker = Picker.create({
      niveauId: cl.niveau_id, classe: cl, kinds: opt.kinds,
      sel: function (ref) { return rec.data.items.filter(function (x) { return x.ref === ref; })[0]; },
      onToggle: function (kind, item, chap, on) { toggleItem(rec, kind, item, on, chap, rec.type); changed(); chosenDraw(); compDraw(); if (opt.onCount) opt.onCount(rec.data.items.length); },
      onRef: function () { refreshAll(); }
    });
    wrap.appendChild(h('div', { class: 'sub-h' }, 'Éléments choisis')); wrap.appendChild(chosen);
    wrap.appendChild(compBox);
    wrap.appendChild(h('div', { class: 'sub-h' }, 'Programme — ' + Cls.niveauLabel(cl))); wrap.appendChild(picker);
    chosenDraw(); compDraw();
    wrap.refresh = refreshAll; wrap.picker = picker;
    return wrap;
  }

  /* champ texte long enregistré automatiquement */
  function area(label, obj, key, changed, ph, rows, hint) {
    return UI.field(label, UI.textarea(function () { return obj[key]; }, function (v) { obj[key] = v; changed(); }, ph, rows), hint);
  }
  function line(label, obj, key, changed, ph, hint) {
    return UI.field(label, UI.textinput(function () { return obj[key]; }, function (v) { obj[key] = v; changed(); }, ph), hint);
  }

  function diffBlock(d, changed, withAm) {
    var box = h('div', { class: 'diff' });
    box.appendChild(area('Élèves à besoins éducatifs particuliers / UPE2A', d.diff, 'upe2a', changed, 'Aménagements : consignes reformulées, vocabulaire illustré, traduction des mots clés…', 2));
    box.appendChild(area('Pour les élèves en difficulté', d.diff, 'difficulte', changed, 'Étayage, coup de pouce, exercice simplifié, calculatrice…', 2));
    box.appendChild(area('Pour les élèves rapides', d.diff, 'rapides', changed, 'Défi, prolongement, problème ouvert…', 2));
    if (withAm) box.appendChild(area('Autres aménagements', d.diff, 'amenagements', changed, 'Dys, police agrandie, temps majoré…', 2));
    return box;
  }

  /* sélecteur d’un nouvel emplacement de date avec créneaux proposés */
  function dateField(cl, rec, field, changed, label, opts) {
    opts = opts || {};
    var inp = h('input', { class: 'inp', type: 'date', value: rec[field] || '' });
    var hint = h('div', { class: 'hint date-hint' });
    function warn() {
      hint.textContent = '';
      var v = inp.value; if (!v) return;
      var b = Plan.blockedReason(v, Plan.ranges(cl.id, cl.annee_scolaire));
      if (b) { hint.textContent = '⚠ ' + (b.label || b.type) + ' ce jour-là.'; hint.className = 'hint date-hint warnt'; return; }
      var dow = (parseISO(v).getDay() + 6) % 7 + 1;
      if ((cl.creneaux || []).length && !cl.creneaux.some(function (c) { return c.jour === dow && Plan.slotOn(c, v, cl.annee_scolaire); })) { hint.textContent = 'Ce jour n’est pas un de vos créneaux habituels.'; hint.className = 'hint date-hint'; }
    }
    inp.addEventListener('change', function () { rec[field] = inp.value || null; changed(); warn(); if (opts.onDate) opts.onDate(rec[field]); });
    warn();
    var wrap = h('div', { class: 'field' }, h('span', { class: 'lbl' }, label), h('div', { class: 'row-gap' }, inp,
      opts.suggest !== false ? h('button', { class: 'btn small', type: 'button', title: 'Proposer le prochain créneau libre de la classe', onclick: function () {
        var d = nextDateFor(cl, rec.sequence_id); if (!d) { UI.toast('Ajoutez des créneaux hebdomadaires à la classe pour obtenir une suggestion.'); return; }
        inp.value = d; rec[field] = d; changed(); warn(); if (opts.onDate) opts.onDate(d);
      } }, '📅 Prochain créneau') : null,
      opts.today ? h('button', { class: 'btn small', type: 'button', onclick: function () { inp.value = today(); rec[field] = today(); changed(); warn(); if (opts.onDate) opts.onDate(today()); } }, 'Aujourd’hui') : null), hint);
    return wrap;
  }

  /* barre d’actions commune */
  function actionBar(btns) { return h('div', { class: 'action-bar' }, btns); }

  return { saver: saver, itemsPanel: itemsPanel, area: area, line: line, diffBlock: diffBlock, dateField: dateField, actionBar: actionBar };
})();
