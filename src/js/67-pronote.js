/* ═══ FICHES · synthèse de séance à copier dans Pronote (cahier de textes) ═══ */
'use strict';
var Pronote = (function () {
  var OUV = {
    cours: ['Séance de cours', 'cours'], activite: ['Activité de recherche', 'activité de recherche'], exercices: ['Séance d’exercices', 'exercices'],
    automatismes: ['Séance d’automatismes', 'automatismes'], evaluation: ['Évaluation', 'évaluation'], revision: ['Séance de révision', 'révision'],
    ap: ['Accompagnement personnalisé', 'accompagnement personnalisé'], projet: ['Séance de projet', 'projet'], dm: ['Devoir maison', 'devoir maison'], autre: ['Séance', 'séance']
  };
  var PHASE = { accroche: 'une accroche', recherche: 'une phase de recherche', cours: 'la synthèse du cours', exercices: 'des exercices d’entraînement', automatismes: 'des automatismes', bilan: 'un bilan', evaluation: 'une évaluation' };
  var ORGA = { binomes: ' en binômes', groupes: ' en groupes' };

  function fin(t) { t = String(t || '').replace(/\s+/g, ' ').trim(); return t ? t.replace(/[.;:,\s]+$/, '') : ''; }
  function court(t, n) { t = fin(String(t || '').split(' — ')[0]); return t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : t; }
  function minus(t) { return t ? t.charAt(0).toLowerCase() + t.slice(1) : t; }
  function liste(a) { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' et ' + a[a.length - 1]; }
  function unique(a) { return a.filter(function (x, i) { return x && a.indexOf(x) === i; }); }

  /* retourne { contenu, travail } ; temps : 'passe' | 'futur' */
  function draft(s, cl, temps) {
    var d = s.data, past = temps !== 'futur', L = [];
    var ou = OUV[s.type] || OUV.autre;
    var chaps = unique((d.chapitres || []).map(function (id) { var l = Ref.lookup(id); return l && l.txt; })).slice(0, 2);
    var theme = chaps.length ? liste(chaps.map(function (c) { return '« ' + fin(c) + ' »'; })) : (s.titre ? '« ' + fin(s.titre) + ' »' : '');
    var mod = s.modalite === 'demi_groupe' ? ' en demi-groupe' + (s.groupe ? ' (groupe ' + s.groupe.slice(1) + ')' : '') : '';
    L.push((past ? ou[0] : 'Au programme : ' + ou[1]) + mod + (theme ? (past ? ' sur ' : ' sur ') + theme : '') + '.');
    var its = (d.items || []).filter(function (i) { return i.k !== 'a'; }).map(function (i) { return court(i.txt, 95); });
    its = unique(its);
    if (d.objectif && fin(d.objectif)) L.push((past ? 'Objectif de la séance : ' : 'Objectif : ') + minus(fin(d.objectif)) + '.');
    else if (its.length) L.push((past ? 'Les élèves ont travaillé : ' : 'Les élèves vont travailler : ') + its.slice(0, 3).map(minus).join(' ; ') + (its.length > 3 ? ' ; …' : '') + '.');
    var b = d.bilan || {};
    if (past && fin(b.realise)) L.push(fin(b.realise).replace(/^./, function (c) { return c.toUpperCase(); }) + '.');
    else {
      var ph = unique((d.phases || []).filter(function (p) { return PHASE[p.phase]; }).map(function (p) { return PHASE[p.phase] + (ORGA[p.orga] || ''); }));
      if (ph.length) L.push((past ? 'La séance a comporté ' : 'Déroulé prévu : ') + liste(ph) + '.');
    }
    var au = (d.items || []).filter(function (i) { return i.k === 'a'; }).map(function (i) { return court(i.txt, 70); });
    if (au.length) L.push('Automatismes : ' + minus(au.slice(0, 2).join(' ; ')) + '.');
    if (past && fin(b.a_reprendre)) L.push('À reprendre : ' + minus(fin(b.a_reprendre)) + '.');
    var tr = '';
    if (d.dm && d.dm.actif) {
      tr = fin(d.dm.titre) || 'Devoir maison';
      if (d.dm.pour && d.dm.pour !== 'classe') tr += ' (' + lbl(K.DM_POUR, d.dm.pour).toLowerCase() + ')';
      if (fin(d.dm.consigne)) tr += ' : ' + fin(d.dm.consigne).replace(/\s*\n+\s*/g, ' ; ').slice(0, 400);
      if (d.dm.rendu) tr += ' — à rendre pour le ' + fmtD(d.dm.rendu);
      tr += '.';
    }
    return { contenu: L.join(' '), travail: tr };
  }

  function section(s, cl, d, save) {
    if (!d.pronote || typeof d.pronote !== 'object') d.pronote = { contenu: '', travail: '', temps: '' };
    var p = d.pronote;
    function tps() { return p.temps || (s.statut === 'faite' ? 'passe' : 'futur'); }
    var ta1, ta2, cnt = h('span', { class: 'muted small' });
    function upd() { cnt.textContent = (p.contenu || '').length + ' caractères'; }
    ta1 = UI.textarea(function () { return p.contenu; }, function (v) { p.contenu = v; save(); upd(); }, 'Quelques phrases : ce qui a été fait pendant la séance…', 4);
    ta2 = UI.textarea(function () { return p.travail; }, function (v) { p.travail = v; save(); }, 'Travail à faire pour la prochaine séance (facultatif)', 2);
    function setVal(ta, v) { ta.value = v; ta.dispatchEvent(new Event('input', { bubbles: true })); }
    function gen() {
      var r = draft(s, cl, tps());
      var go = function () { setVal(ta1, r.contenu); if (r.travail || !(p.travail || '').trim()) setVal(ta2, r.travail); UI.toast('Synthèse rédigée : relisez-la et ajustez-la.'); };
      if ((p.contenu || '').trim() && (p.contenu || '').trim() !== r.contenu) UI.ask('Remplacer le texte actuel par une nouvelle rédaction automatique ?', { ok: 'Remplacer' }).then(function (ok) { if (ok) go(); }); else go();
    }
    function cp(txt, msg) { if (!txt.trim()) { UI.toast('Rien à copier : rédigez d’abord la synthèse.', 'err'); return; } copyText(txt).then(function (ok) { UI.toast(ok ? msg : 'Copie impossible : sélectionnez le texte et copiez-le à la main.', ok ? '' : 'err'); }); }
    var box = h('div', null,
      h('p', { class: 'muted small' }, 'Texte brut, sans mise en forme ni émojis : il se colle proprement dans le cahier de textes de Pronote. Relisez-le avant de le coller.'),
      h('div', { class: 'row-gap' }, UI.field('Rédaction', UI.select([['passe', 'Au passé (séance faite)'], ['futur', 'Au futur (séance à venir)']], tps(), function (v) { p.temps = v; save(); }, 'sm')),
        h('button', { class: 'btn primary', type: 'button', onclick: gen }, '✨ Rédiger la synthèse')),
      UI.field('Contenu de la séance', ta1), cnt,
      UI.field('Travail à faire', ta2, 'Pré-rempli avec le devoir maison s’il y en a un.'),
      h('div', { class: 'row-gap' },
        h('button', { class: 'btn', type: 'button', onclick: function () { cp(p.contenu || '', 'Contenu copié : collez-le dans Pronote.'); } }, '📋 Copier le contenu'),
        h('button', { class: 'btn', type: 'button', onclick: function () { cp(p.travail || '', 'Travail à faire copié.'); } }, '📋 Copier le travail à faire'),
        h('button', { class: 'btn', type: 'button', onclick: function () { cp(((p.contenu || '').trim() + ((p.travail || '').trim() ? '\n\nTravail à faire : ' + p.travail.trim() : '')), 'Tout est copié.'); } }, '📋 Tout copier'),
        h('button', { class: 'btn ghost', type: 'button', title: 'Version en liste, avec objectifs et notions', onclick: function () { Exp.cahier(s); } }, 'Version détaillée (liste)')));
    upd();
    return UI.section('sea-pronote', 'Synthèse pour Pronote', [box], { open: s.statut === 'faite' || !!(p.contenu || '').trim() });
  }
  return { draft: draft, section: section };
})();
