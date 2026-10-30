/* ═══ FICHES · modèles de séances d’1 h générés à partir des programmes (et « mes modèles ») ═══ */
'use strict';
var Tpl = (function () {
  var HEAVY = /simulation|programm|algorithm|tableur|logiciel|exp[ée]riment|conjectur|d[ée]monstr|mod[ée]lis|scratch|python|probl[eè]me ouvert/i;
  var ACTIVITE = /simulation|programm|algorithm|tableur|logiciel|exp[ée]riment|conjectur|scratch|python/i;
  var MATOS = [['casio', /calcul|pourcentage|racine|puissance|valeur|taux|moyenne|m[ée]diane|[ée]cart|probabilit|r[ée]soudre|[ée]quation|fr[ée]quence|proportion/i],
    ['tableur', /tableur|feuille de calcul|simulation|donn[ée]es|diagramme|histogramme|graphique|s[ée]rie|fr[ée]quence/i],
    ['geogebra', /g[ée]om[ée]tri|droite|courbe|repr[ée]sent|rep[eè]re|fonction|tracer|solide|section|transform|sym[ée]trie|translation|rotation|homoth[ée]tie|logiciel/i],
    ['prog', /algorithm|programm|scratch|python|boucle/i], ['instruments', /construire|tracer|compas|rapporteur|angle|[ée]querre|mesurer/i]];
  var BUDGET = 60;

  function clean(t) { return String(t || '').replace(/\s+/g, ' ').trim().replace(/[.;:,\s]+$/, ''); }
  function lc(t) { return t ? t.charAt(0).toLowerCase() + t.slice(1) : t; }
  function shorten(t, n) { t = clean(t); if (t.length <= n) return t; return t.slice(0, n).replace(/\s+\S*$/, '') + '…'; }
  function chapShort(c) { return clean(c.titre.replace(/\s*\([^)]*\)\s*$/, '')); }

  /* durée estimée (minutes) d’un élément dans une séance d’1 h : un objectif demande de la pratique, une notion moins */
  function weight(it, kind) {
    var w = kind === 'o' ? 28 : 12, n = (it.txt || '').length;
    if (n > 140) w += 8; if (HEAVY.test(it.txt || '')) w += 14;
    return w;
  }
  /* objectifs et notions mélangés dans l’ordre du programme (les notions réparties le long des objectifs) */
  function interleave(chap) {
    var os = chap.objectifs.map(function (x, i) { return { it: x, kind: 'o', key: (i + 0.5) / chap.objectifs.length, s: 1 }; });
    var ks = chap.connaissances.map(function (x, i) { return { it: x, kind: 'k', key: (i + 0.5) / chap.connaissances.length, s: 0 }; });
    return os.concat(ks).sort(function (a, b) { return (a.key - b.key) || (a.s - b.s); });
  }
  function pack(items) {
    var groups = [], cur = null;
    items.forEach(function (x) {
      var w = weight(x.it, x.kind);
      if (!cur || (cur.min + w > BUDGET && cur.items.length)) { cur = { items: [], min: 0 }; groups.push(cur); }
      cur.items.push(x); cur.min += w;
    });
    /* un dernier groupe très court est rattaché au précédent s’il y a la place */
    if (groups.length > 1) { var l = groups[groups.length - 1], p = groups[groups.length - 2]; if (l.min < 20 && p.min + l.min <= BUDGET) { p.items = p.items.concat(l.items); p.min += l.min; groups.pop(); } }
    return groups;
  }
  function forChapter(chap) {
    var groups = pack(interleave(chap)), n = groups.length;
    return groups.map(function (g, i) {
      var os = g.items.filter(function (x) { return x.kind === 'o'; }), focus = os.length ? os : g.items;
      var head = shorten(focus[0].it.txt, 72);
      var heavy = g.items.some(function (x) { return ACTIVITE.test(x.it.txt || ''); });
      var type = (os.length && (heavy || (n >= 2 && i === 0))) ? 'activite' : 'cours';
      return { id: chap.id + '#' + (i + 1), chapId: chap.id, chapTitre: chap.titre, domaine: chap.domaine, rang: i + 1, total: n, head: head, minutes: g.min,
        titre: chapShort(chap) + (n > 1 ? ' (' + (i + 1) + '/' + n + ')' : '') + ' — ' + head, type: type, duree: 60,
        items: g.items.map(function (x) { return { k: x.kind, ref: x.it.id, txt: x.it.txt + (x.it.sous && x.it.sous.length ? ' — ' + x.it.sous.join(' ; ') : ''), comp: x.it.comp || [] }; }) };
    });
  }

  /* contenu complet d’une séance (champs de data) pour une proposition et une classe */
  function dataFor(p, cl) {
    var d = emptySeanceData(cl), os = p.items.filter(function (x) { return x.k === 'o'; }), ks = p.items.filter(function (x) { return x.k === 'k'; }), focus = os.length ? os : p.items;
    var txts = p.items.map(function (x) { return x.txt; }).join(' ');
    d.objectif = 'À la fin de la séance, l’élève ' + (os.length ? 'sait : ' : 'connaît : ') + focus.slice(0, 3).map(function (x) { return lc(shorten(x.txt, 110)); }).join(' ; ') + (focus.length > 3 ? ' ; …' : '') + '.';
    d.items = p.items.map(function (x) { return { k: x.k, ref: x.ref, txt: x.txt, niv: defaultNiv(p.type), chap: p.chapId }; });
    d.chapitres = [p.chapId];
    p.items.forEach(function (x) { (x.comp || []).forEach(function (c) { if (d.competences.indexOf(c) < 0) d.competences.push(c); }); });
    d.comp_manual = false;
    var mat = (d.materiel || []).slice(); MATOS.forEach(function (m) { if (m[1].test(txts) && mat.indexOf(m[0]) < 0) mat.push(m[0]); });
    if (/tableur|simulation|geogebra|programm|algorithm|scratch|python|logiciel/i.test(txts) && mat.indexOf('ordi') < 0) mat.push('ordi');
    d.materiel = mat;
    d.prerequis = p.rang > 1 ? 'Séance précédente (' + (p.rang - 1) + '/' + p.total + ') du chapitre « ' + chapShort({ titre: p.chapTitre }) + ' ».' : '';
    var ctx = cl && cl.metier ? 'le métier (' + clean(cl.metier) + ')' : 'la vie courante ou le métier';
    var list = function (arr, k) { return arr.slice(0, k).map(function (x) { return lc(shorten(x.txt, 70)); }).join(' ; ') + (arr.length > k ? ' ; …' : ''); };
    var ph = defaultPhases(p.type, p.duree);
    ph.forEach(function (x) {
      if (x.phase === 'accroche') x.contenu = 'Situation d’accroche tirée de ' + ctx + ' qui amène : ' + lc(shorten(focus[0].txt, 90)) + '.';
      else if (x.phase === 'recherche') x.contenu = (p.type === 'activite' ? 'Les élèves cherchent en groupes : ' : 'Recherche en binômes à partir de la situation : ') + list(focus, 2) + ' (document de recherche à préparer).';
      else if (x.phase === 'cours') x.contenu = 'Mise en commun et institutionnalisation : ' + list(p.items, 3) + '.';
      else if (x.phase === 'exercices') x.contenu = 'Exercices d’application de difficulté croissante sur : ' + list(focus, 2) + '.';
      else if (x.phase === 'automatismes') x.contenu = 'Trois à cinq questions flash en lien avec « ' + chapShort({ titre: p.chapTitre }) + ' ».';
      else if (x.phase === 'bilan') x.contenu = 'Bilan : ce qu’il faut retenir (' + list(focus, 2) + ') et points de vigilance.';
    });
    d.phases = ph;
    var tr = ['Titre : ' + p.head];
    os.forEach(function (x) { tr.push('Méthode — ' + lc(shorten(x.txt, 100)) + ' : …\nExemple : …'); });
    ks.forEach(function (x) { tr.push('À retenir — ' + shorten(x.txt, 110) + ' : …'); });
    d.trace = tr.join('\n\n');
    d.diff = { upe2a: 'Afficher le vocabulaire clé de la séance avec un exemple ou un schéma.', difficulte: 'Étayer avec un exemple résolu ; décomposer la tâche en étapes.', rapides: 'Prolonger avec un problème plus ouvert.', amenagements: '' };
    return d;
  }

  function hasContent(s) { var d = s.data; return !!((d.items || []).length || (d.trace || '').trim() || (d.objectif || '').trim() || (d.phases || []).some(function (x) { return (x.contenu || '').trim(); })); }
  var KEEP = ['objectif', 'manuel', 'items', 'chapitres', 'competences', 'comp_caps', 'comp_manual', 'prerequis', 'ancrage', 'materiel', 'materiel_libre', 'phases', 'trace', 'diff', 'eval'];
  /* charge une proposition (ou un modèle perso) dans une séance existante : bilan, DM, ressources, notes sont conservés */
  function applyTo(s, cl, spec) {
    var d = spec.data;
    KEEP.forEach(function (k) { if (d[k] !== undefined) s.data[k] = clone(d[k]); });
    s.type = spec.type; s.duree_min = spec.duree || s.duree_min; if (!s.titre || spec.forceTitle) s.titre = spec.titre;
    DB.save('fs_seances', s);
  }
  function specOfProposal(p, cl) { return { type: p.type, duree: p.duree, titre: p.titre, data: dataFor(p, cl) }; }
  function specOfModel(m) { var dd = m.data || {}; return { type: dd.type || 'cours', duree: dd.duree_min || 60, titre: m.titre, data: dd.data || {} }; }

  function createFrom(cl, spec, seqId, withDate) {
    var init = { sequence_id: seqId || null, type: spec.type, titre: spec.titre, duree_min: spec.duree, data: clone(spec.data) };
    if (withDate && (cl.creneaux || []).length) init.date_prevue = nextDateFor(cl, seqId || null);
    return createSeance(cl, init);
  }

  /* ── sélecteur ── */
  function open(opt) {
    opt = opt || {};
    var classes = Cls.actives(); if (!classes.length) { UI.toast('Créez d’abord une classe.'); return; }
    var cl = opt.cl || Cls.get(Store.get('last_class')) || classes[0]; if (cl.archive) cl = classes[0];
    var load = opt.mode === 'load', picked = {}, tab = (Man.has(cl.niveau_id) ? 'man' : 'prog'), q = '', withDate = true;
    var wrap = h('div', { class: 'tpl' }), list = h('div', { class: 'tpl-list' }), count = h('span', { class: 'muted small' });
    var api;
    function nPicked() { return Object.keys(picked).length; }
    function updCount() { count.textContent = load ? '' : nPicked() + ' séance' + (nPicked() > 1 ? 's' : '') + ' sélectionnée' + (nPicked() > 1 ? 's' : ''); }

    function card(spec, meta) {
      var its = spec.data && spec.data.items ? spec.data.items : [];
      var c = h('div', { class: 'tpl-card' });
      var head = h('div', { class: 'tpl-h' });
      if (!load) head.appendChild(h('input', { type: 'checkbox', 'aria-label': 'Sélectionner', checked: !!picked[meta.id], onchange: function (e) { if (e.target.checked) picked[meta.id] = { spec: spec }; else delete picked[meta.id]; updCount(); } }));
      head.appendChild(h('div', { class: 'tpl-t' }, h('strong', null, spec.titre), h('div', { class: 'muted small' }, lbl(K.TYPES, spec.type) + ' · ' + fmtDuree(spec.duree) + (spec.preview ? '' : ' · ' + plural(its.length, 'élément')) + (meta.sub ? ' · ' + meta.sub : ''))));
      if (load) head.appendChild(h('button', { class: 'btn small primary', type: 'button', onclick: function () { go(spec); } }, 'Charger'));
      c.appendChild(head);
      if (spec.preview) c.appendChild(h('details', { class: 'tpl-d' }, h('summary', { class: 'small' }, 'Voir le contenu'), h('ul', { class: 'small' }, spec.preview.map(function (x) { return h('li', null, x); }))));
      else if (its.length) c.appendChild(h('details', { class: 'tpl-d' }, h('summary', { class: 'small' }, 'Voir le contenu'), h('ul', { class: 'small' }, its.map(function (x) { return h('li', null, x.txt); })),
        spec.data.objectif ? h('p', { class: 'small' }, h('strong', null, 'Objectif : '), spec.data.objectif) : null));
      return c;
    }
    function go(spec) {
      var s = opt.seance;
      var run = function () { applyTo(s, cl, spec); api.close(); UI.toast('Modèle chargé : relisez et adaptez.'); Views.rerender(); };
      if (hasContent(s)) UI.ask('Cette séance contient déjà des éléments. Remplacer objectifs, déroulé, trace écrite et matériel par ce modèle ? (Le bilan, le DM, les ressources et les notes sont conservés.)', { ok: 'Remplacer' }).then(function (ok) { if (ok) run(); }); else run();
    }

    function chapterBlock(ch, open0) {
      var props = null, box = h('div', { class: 'tpl-chap' });
      var det = h('details', { class: 'tpl-chapd', open: open0 ? true : null }, h('summary', null, h('strong', null, ch.titre), h('span', { class: 'muted small' }, '  ' + (ch.objectifs.length + ch.connaissances.length) + ' éléments')));
      function fill() {
        if (props) return; props = forChapter(ch); clear(box);
        if (!props.length) { box.appendChild(h('p', { class: 'muted small' }, 'Aucun élément dans ce chapitre.')); return; }
        props.forEach(function (p) { box.appendChild(card(specOfProposal(p, cl), { id: p.id, sub: 'séance ' + p.rang + '/' + p.total })); });
      }
      det.addEventListener('toggle', function () { if (det.open) fill(); });
      det.appendChild(box); if (open0) fill();
      return det;
    }
    function manBlock(ch, open0) {
      var box = h('div', { class: 'tpl-chap' }), filled = false, man = Man.get(cl.niveau_id);
      var det = h('details', { class: 'tpl-chapd', open: open0 ? true : null }, h('summary', null, h('strong', null, 'Ch. ' + ch.n + ' · ' + ch.titre), h('span', { class: 'muted small' }, '  ' + Man.pg([ch.page, ch.fin]) + ' · ' + plural(ch.notions.length, 'notion') + ' · ' + plural(ch.exos.length, 'exercice'))));
      function fill() { if (filled) return; filled = true; Man.specs(cl, ch).forEach(function (sp) { box.appendChild(card(sp, { id: sp.id, sub: sp.sub })); }); }
      det.addEventListener('toggle', function () { if (det.open) fill(); });
      det.appendChild(box); if (open0) fill();
      return det;
    }
    function drawMan() {
      var man = Man.get(cl.niveau_id);
      if (!man) { list.appendChild(h('p', { class: 'muted' }, 'Pas de manuel pour ce niveau (' + Cls.niveauLabel(cl) + '). Utilisez l’onglet « Programme (BO) ».')); return; }
      var ql = q.toLowerCase(), pre = {};
      (opt.chapIds || []).forEach(function (bid) { var m = Manuels.get(cl.niveau_id); if (m) m.chap.forEach(function (c) { if (c.refs.indexOf(bid) >= 0) pre[c.n] = true; }); });
      var chaps = man.chapitres.filter(function (c) { return !ql || (c.titre + ' ' + c.notions.map(function (n) { return n.titre; }).join(' ') + ' ' + c.exos.map(function (e) { return e.titre; }).join(' ')).toLowerCase().indexOf(ql) >= 0; });
      list.appendChild(h('p', { class: 'muted small' }, man.nom + ' : une séance d’1 h par notion (« Je découvre » → « Je retiens » → exercices), une séance de défis et une séance de contrôle par chapitre.'));
      chaps.forEach(function (c) { list.appendChild(manBlock(c, pre[c.n] || (!!ql && chaps.length <= 3))); });
      if (!chaps.length) list.appendChild(h('p', { class: 'muted' }, 'Aucun chapitre ne correspond.'));
    }
    function drawProg() {
      var e = Ref.effective(cl.niveau_id), ql = q.toLowerCase();
      var chaps = e.chapitres.filter(function (c) { return !ql || (c.titre + ' ' + c.domaine + ' ' + c.objectifs.concat(c.connaissances).map(function (x) { return x.txt; }).join(' ')).toLowerCase().indexOf(ql) >= 0; });
      var pre = {}; (opt.chapIds || []).forEach(function (x) { pre[x] = true; });
      var ok = chaps.filter(function (c) { return Ref.portee(c, cl).ok; }), ko = chaps.filter(function (c) { return !Ref.portee(c, cl).ok; });
      var dom = '';
      ok.forEach(function (c) { if (c.domaine !== dom) { dom = c.domaine; list.appendChild(h('h4', { class: 'tpl-dom' }, dom)); } list.appendChild(chapterBlock(c, pre[c.id] || !!ql && ok.length <= 3)); });
      if (!ok.length) list.appendChild(h('p', { class: 'muted' }, 'Aucun chapitre ne correspond.'));
      if (ko.length) { var more = h('details', { class: 'tpl-more' }, h('summary', { class: 'small' }, 'Autres chapitres (hors groupement ou option de la classe) : ' + ko.length)); ko.forEach(function (c) { more.appendChild(chapterBlock(c, false)); }); list.appendChild(more); }
    }
    function drawMine() {
      var ms = DB.list('fs_modeles').filter(function (m) { return m.kind === 'seance' && (m.niveau_id === cl.niveau_id || !m.niveau_id); }).sort(function (a, b) { return cmpStr(a.titre, b.titre); });
      if (!ms.length) { list.appendChild(h('p', { class: 'muted' }, 'Aucun modèle personnel pour ce niveau. Dans une séance, utilisez « 💾 Enregistrer comme modèle ».')); return; }
      ms.forEach(function (m) {
        var spec = specOfModel(m), c = card(spec, { id: m.id, sub: 'mon modèle' });
        $('.tpl-h', c).appendChild(h('button', { class: 'icon-btn sm', type: 'button', title: 'Supprimer ce modèle', 'aria-label': 'Supprimer ce modèle', onclick: function () { UI.ask('Supprimer le modèle « ' + m.titre + ' » ?', { ok: 'Supprimer', danger: true }).then(function (ok) { if (ok) { DB.remove('fs_modeles', m.id); draw(); } }); } }, '🗑'));
        list.appendChild(c);
      });
    }
    function draw() { clear(list); if (tab === 'man') drawMan(); else if (tab === 'prog') drawProg(); else drawMine(); }
    function top() {
      var t = h('div', { class: 'tpl-top' });
      if (!opt.cl || !load) t.appendChild(UI.field('Classe', UI.select(classes.map(function (c) { return [c.id, c.nom + ' — ' + Cls.niveauLabel(c)]; }), cl.id, function (v) { cl = Cls.get(v); picked = {}; updCount(); draw(); })));
      t.appendChild(h('div', { class: 'tabs', role: 'tablist' }, (APP.manuels ? [['man', 'Mes manuels'], ['prog', 'Programme (BO)'], ['mine', 'Mes modèles']] : [['prog', 'Modèles des programmes'], ['mine', 'Mes modèles']]).map(function (x) { return h('button', { class: 'tab' + (tab === x[0] ? ' on' : ''), type: 'button', role: 'tab', onclick: function () { tab = x[0]; clear(wrap); build(); } }, x[1]); })));
      if (tab === 'prog' || tab === 'man') t.appendChild(h('input', { class: 'inp', type: 'search', placeholder: 'Filtrer par mot (ex. pourcentage, fonction, probabilité)…', value: q, oninput: function (e) { q = e.target.value; clear(list); if (tab === 'man') drawMan(); else drawProg(); } }));
      return t;
    }
    function build() {
      wrap.appendChild(top());
      if (tab === 'prog') wrap.appendChild(h('p', { class: 'muted small' }, 'Chaque proposition regroupe les objectifs et notions du programme qui tiennent en 1 h (estimation). Elle préremplit objectif, déroulé, trace écrite, matériel et différenciation : vous adaptez ensuite.'));
      if (!load) { wrap.appendChild(h('div', { class: 'row-gap' }, count, (cl.creneaux || []).length ? h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: withDate, onchange: function (e) { withDate = e.target.checked; } }), ' Proposer des dates selon mes créneaux') : null)); }
      wrap.appendChild(list); updCount(); draw();
    }
    build();
    var actions = [{ label: load ? 'Fermer' : 'Annuler', kind: 'ghost' }];
    if (!load) actions.push({ label: 'Créer les séances sélectionnées', kind: 'primary', onClick: function () {
      var ids = Object.keys(picked); if (!ids.length) { UI.toast('Cochez au moins une proposition.', 'err'); return false; }
      var made = []; Store.set('last_class', cl.id);
      /* ordre du programme : on respecte l’ordre d’affichage (chapitre puis rang) */
      ids.sort(function (a, b) { return cmpStr(a, b); });
      ids.forEach(function (id) { made.push(createFrom(cl, picked[id].spec, opt.seqId, withDate)); });
      UI.toast(plural(made.length, 'séance créée', 'séances créées') + '.');
      if (made.length === 1) location.hash = '#/seance/' + made[0].id; else if (opt.seqId) Views.rerender(); else location.hash = '#/classe/' + cl.id;
    } });
    api = UI.modal({ title: load ? 'Charger un modèle de séance d’1 h' : 'Séances d’1 h à partir d’un modèle', body: wrap, actions: actions, wide: true, noFocus: true });
  }

  /* ── enregistrer une séance comme modèle perso ── */
  function saveAsModel(s, cl) {
    UI.promptText('Nom du modèle', { value: s.titre || '', ok: 'Enregistrer', help: 'Le modèle garde objectif, programme, déroulé, trace écrite, matériel et différenciation (pas le bilan, le DM ni les ressources).' }).then(function (name) {
      if (name === null) return; name = name.trim(); if (!name) { UI.toast('Donnez un nom au modèle.', 'err'); return; }
      var data = {}; KEEP.forEach(function (k) { if (s.data[k] !== undefined) data[k] = clone(s.data[k]); });
      DB.create('fs_modeles', { kind: 'seance', titre: name.slice(0, 120), niveau_id: cl.niveau_id, data: { type: s.type, duree_min: s.duree_min, data: data } });
      UI.toast('Modèle enregistré : retrouvez-le dans « Mes modèles ».');
    });
  }
  return { forChapter: forChapter, dataFor: dataFor, open: open, saveAsModel: saveAsModel, applyTo: applyTo, weight: weight, pack: pack, interleave: interleave };
})();
