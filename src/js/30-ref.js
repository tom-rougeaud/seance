/* ═══ FICHES · référentiels (BO) + personnalisations de l’enseignant(e) ═══ */
'use strict';
var Ref = (function () {
  var data = null, cacheEff = {}, idx = null;

  function load() {
    var el = document.getElementById('REFERENTIELS');
    data = JSON.parse(el.textContent);
    invalidate();
    return data;
  }
  function invalidate() { cacheEff = {}; idx = null; }
  function niveaux() { return data.niveaux; }
  function niveau(id) { return data.niveaux.filter(function (n) { return n.id === id; })[0] || null; }
  function comps(niveauId) { var n = niveau(niveauId); return n ? data.competences[n.competences] : []; }
  function compById(niveauId, cid) { return comps(niveauId).filter(function (c) { return c.id === cid; })[0] || null; }

  var VERBES_COMP = [
    ['sapp', /^(Rechercher|Extraire|Lire|Reconnaître|Traduire|Identifier|Repérer|Distinguer|Nommer|Citer|Associer)/],
    ['ana', /^(Choisir|Proposer|Émettre|Modéliser|Élaborer|Analyser|Décomposer|Conjecturer|Expérimenter|Évaluer|Formaliser|Étudier)/],
    ['val', /^(Interpréter|Comparer|Vérifier|Justifier|Contrôler|Critiquer|Valider|Exploiter|Argumenter|Démontrer|Prouver)/],
    ['comm', /^(Expliquer|Rendre compte|Décrire|Rédiger|Présenter|Communiquer|Commenter)/]
  ];
  function guessComp(txt) { for (var i = 0; i < VERBES_COMP.length; i++) if (VERBES_COMP[i][1].test(txt)) return [VERBES_COMP[i][0]]; return ['real']; }

  /* référentiel « effectif » = BO + ajouts − masqués, avec textes renommés */
  function effective(niveauId) {
    var persoList = DB.list('fs_ref_perso').filter(function (p) { return p.niveau_id === niveauId; });
    var key = niveauId + '#' + persoList.length + '#' + persoList.map(function (p) { return p.id + p.action + p.txt; }).join('|').length;
    if (cacheEff[niveauId] && cacheEff[niveauId].key === key) return cacheEff[niveauId].val;
    var base = niveau(niveauId); if (!base) return null;
    var hidden = {}, renamed = {};
    persoList.forEach(function (p) { if (p.action === 'hide') hidden[p.ref_id] = true; if (p.action === 'rename') renamed[p.ref_id] = p.txt; });
    function mapItem(it, kind) { var o = clone(it); o.kind = kind; if (renamed[it.id]) { o.orig = it.txt; o.txt = renamed[it.id]; o.renamed = true; } return o; }
    var chaps = base.chapitres.filter(function (c) { return !hidden[c.id]; }).map(function (c) {
      var o = { id: c.id, domaine: c.domaine, titre: renamed[c.id] || c.titre, titreBO: c.titre, portee: c.portee || {}, bo: c.bo || {}, perso: false,
        objectifs: c.objectifs.filter(function (x) { return !hidden[x.id]; }).map(function (x) { return mapItem(x, 'o'); }),
        connaissances: c.connaissances.filter(function (x) { return !hidden[x.id]; }).map(function (x) { return mapItem(x, 'k'); }) };
      return o;
    });
    var byId = {}; chaps.forEach(function (c) { byId[c.id] = c; });
    /* chapitres perso d’abord (pour y rattacher leurs items) */
    persoList.filter(function (p) { return p.action === 'add' && p.kind === 'chapitre'; }).sort(function (a, b) { return a.ordre - b.ordre; }).forEach(function (p) {
      var id = p.ref_id; if (hidden[id]) return;
      var c = { id: id, rowId: p.id, domaine: p.domaine || 'Mes chapitres', titre: renamed[id] || p.txt, titreBO: p.txt, portee: {}, bo: {}, perso: true, objectifs: [], connaissances: [] };
      chaps.push(c); byId[id] = c;
    });
    persoList.filter(function (p) { return p.action === 'add' && (p.kind === 'o' || p.kind === 'k') && p.chapitre_id; }).sort(function (a, b) { return a.ordre - b.ordre; }).forEach(function (p) {
      var c = byId[p.chapitre_id]; if (!c || hidden[p.ref_id]) return;
      var it = { id: p.ref_id, rowId: p.id, txt: renamed[p.ref_id] || p.txt, perso: true, kind: p.kind };
      if (p.kind === 'o') { it.comp = guessComp(p.txt); c.objectifs.push(it); } else { it.sous = []; c.connaissances.push(it); }
    });
    var autos = base.automatismes.filter(function (a) { return !hidden[a.id]; }).map(function (a) { var o = clone(a); o.kind = 'a'; if (renamed[a.id]) { o.orig = a.txt; o.txt = renamed[a.id]; o.renamed = true; } return o; });
    persoList.filter(function (p) { return p.action === 'add' && p.kind === 'a'; }).sort(function (a, b) { return a.ordre - b.ordre; }).forEach(function (p) {
      if (hidden[p.ref_id]) return;
      autos.push({ id: p.ref_id, rowId: p.id, txt: renamed[p.ref_id] || p.txt, groupe: p.domaine || 'Mes automatismes', perso: true, kind: 'a' });
    });
    var val = { id: base.id, label: base.label, niveau: base.niveau, bo: base.bo, voie: base.voie, competences: base.competences, chapitres: chaps, automatismes: autos, vocabulaire: base.vocabulaire || [] };
    cacheEff[niveauId] = { key: key, val: val };
    return val;
  }

  /* index de tous les éléments (BO + perso) pour retrouver un texte à partir d’un identifiant */
  function buildIndex() {
    idx = {};
    data.niveaux.forEach(function (n) {
      var e = effective(n.id);
      e.chapitres.forEach(function (c) {
        idx[c.id] = { kind: 'c', txt: c.titre, chap: c, niveauId: n.id };
        c.objectifs.forEach(function (o) { idx[o.id] = { kind: 'o', txt: o.txt, chap: c, niveauId: n.id, item: o }; });
        c.connaissances.forEach(function (o) { idx[o.id] = { kind: 'k', txt: o.txt, chap: c, niveauId: n.id, item: o }; });
      });
      e.automatismes.forEach(function (a) { idx[a.id] = { kind: 'a', txt: a.txt, chap: null, niveauId: n.id, item: a }; });
    });
  }
  function lookup(refId) { if (!idx) buildIndex(); return idx[refId] || null; }
  function refreshIndex() { cacheEff = {}; idx = null; }

  /* le chapitre concerne-t-il la classe (groupement, physique-chimie, poursuite) ? */
  function portee(chap, cl) {
    var p = chap.portee || {};
    if (!cl) return { ok: true };
    if (p.poursuite) return cl.poursuite ? { ok: true } : { ok: false, why: 'Programme complémentaire (poursuite d’études)' };
    if (p.sans_pc) return cl.avec_pc ? { ok: false, why: 'Uniquement pour les spécialités sans physique-chimie' } : { ok: true };
    if (p.grp) return (!cl.groupement || p.grp.indexOf(cl.groupement) >= 0) ? { ok: true } : { ok: false, why: 'Groupement' + (p.grp.length > 1 ? 's ' : ' ') + p.grp.join(', ') + ' uniquement' };
    if (p.cap_grp) return (!cl.groupement || p.cap_grp.indexOf(+cl.groupement) >= 0) ? { ok: true } : { ok: false, why: 'Groupement ' + p.cap_grp.join(', ') + ' uniquement' };
    return { ok: true };
  }
  function groupementsPour(niveauId) {
    if (niveauId === 'cap') return [['', 'Non précisé'], ['1', 'Groupement 1'], ['2', 'Groupement 2']];
    if (niveauId === 'pm') return [];
    return [['', 'Non précisé'], ['A', 'Groupement A'], ['B', 'Groupement B'], ['C', 'Groupement C']];
  }
  function allItemsOf(niveauId) {
    var e = effective(niveauId), out = [];
    e.chapitres.forEach(function (c) { c.objectifs.forEach(function (o) { out.push(o); }); c.connaissances.forEach(function (o) { out.push(o); }); });
    e.automatismes.forEach(function (a) { out.push(a); });
    return out;
  }
  var norm = function (s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); };

  return { load: load, invalidate: refreshIndex, niveaux: niveaux, niveau: niveau, comps: comps, compById: compById, effective: effective, lookup: lookup, portee: portee, groupementsPour: groupementsPour, guessComp: guessComp, allItemsOf: allItemsOf, norm: norm, raw: function () { return data; } };
})();
