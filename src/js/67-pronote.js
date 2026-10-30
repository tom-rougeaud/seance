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
  function court(t, n) { t = fin(String(t || '').split(' — ')[0]).replace(/\s:\s/g, ' — '); return t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : t; }
  function minus(t) { return t ? t.charAt(0).toLowerCase() + t.slice(1) : t; }
  function liste(a) { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' et ' + a[a.length - 1]; }
  function unique(a) { return a.filter(function (x, i) { return x && a.indexOf(x) === i; }); }

  var ENTETE = { evaluation: 'Évaluation', revision: 'Révision', dm: 'Devoir maison' };
  /* « À la fin de la séance, l’élève sait : calculer… » → « calculer… » */
  function objectifCourt(t) { t = fin(t).replace(/^à la fin de (la|cette) séance,?\s*(l[’']élève|les élèves|l[’']apprenant)\s*(sait|savent|est capable de|sont capables de)\s*:?\s*/i, '').replace(/^(l[’']élève|les élèves)\s+(sait|savent)\s*:?\s*/i, ''); return court(t, 110); }
  /* texte officiel du BO → forme brève : « Calculer la moyenne d’une série statistique, mentalement dans… » → « Calculer la moyenne d’une série statistique » */
  function bref(t) { t = fin(t); var m = t.split(/,\s|;\s|\s:\s|\s\(|\s(?=mentalement|à l[’']aide|avec une|sur papier|dans quelques)/)[0]; return court(m.length >= 22 ? m : t, 100); }
  function sansDoublon(a, ref) { var r = Manuels.norm(ref); return a.filter(function (x) { return Manuels.norm(x) !== r; }); }

  /* retourne { contenu, travail, manuel } ; temps : 'passe' | 'futur' ; version : 1 (BO) | 2 (mémo perso, avec mes manuels) | 3 (Ma séance)
     Le texte est une liste de lignes courtes et sans répétition (Objectif · Notion abordée · Exercice traité…) :
     il dit CE QUI A ÉTÉ TRAITÉ (savoir-faire, notions), jamais le déroulé de la séance. */
  function draft(s, cl, temps, version) {
    var d = s.data, past = temps !== 'futur', L = [];
    var md = (version === 3 && typeof Man !== 'undefined') ? Man.describe(s, cl) : null; if (md && !md.notions.length && !md.exos.length) md = null;
    var titre = fin(s.titre);
    var man = version === 2 ? Manuels.get(cl && cl.niveau_id) : null, mt = man ? Manuels.match(cl.niveau_id, d, s.titre) : null, manuel = !!(mt && mt.length);
    var its = unique((d.items || []).filter(function (i) { return i.k !== 'a'; }));
    var chaps = unique((d.chapitres || []).map(function (id) { var l = Ref.lookup(id); return l && fin(l.txt); })).slice(0, 2);
    var en = ENTETE[s.type];
    if (s.modalite === 'demi_groupe') L.push('Demi-groupe' + (s.groupe ? ' : groupe ' + s.groupe.slice(1) : ''));

    /* 1. Objectif */
    var obj = fin(d.objectif) ? objectifCourt(d.objectif) : '';
    if (!obj) { var o1 = its.filter(function (i) { return i.k === 'o'; })[0]; if (o1) obj = bref(o1.txt); }
    if (!obj && titre) obj = titre;
    if (en) L.push(en + (titre && Manuels.norm(titre) !== Manuels.norm(obj) ? ' : ' + titre : ''));
    if (obj) L.push('Objectif : ' + (obj === titre ? obj : minus(obj)));

    /* 2. Notion(s) abordée(s) et 3. exercice(s) traité(s) */
    var notions = [], exos = [], suite = [];
    if (md) {
      notions = md.notions.map(function (n) { return n.titre + ' (' + Man.pg(n.pages[0]) + ')'; });
      if (!notions.length) notions = ['chapitre ' + md.ch.n + ' « ' + md.ch.titre + ' »'];
      exos = md.exos.map(function (x) { return 'n° ' + x.n + ' (' + Man.pg(x.page) + ')'; });
      suite.push((md.man.court || 'Manuel') + ' : chapitre ' + md.ch.n + ' « ' + md.ch.titre + ' »');
    } else if (manuel) {
      mt.forEach(function (x) { if (x.notions.length) x.notions.forEach(function (t) { notions.push(t); }); else notions.push('chapitre ' + x.chap.n + ' « ' + x.chap.t + ' »'); });
      suite.push('Manuel : ' + man.nom + ', chapitre ' + mt.map(function (x) { return x.chap.n + ' « ' + x.chap.t + ' »'; }).join(' ; '));
    } else {
      notions = unique(its.filter(function (i) { return i.k === 'k'; }).map(function (i) { return bref(i.txt); }));
      if (!notions.length) notions = unique(its.filter(function (i) { return i.k === 'o'; }).map(function (i) { return bref(i.txt); }));
      if (!notions.length) notions = chaps;
      var ph = (d.phases || []).filter(function (x) { return x.phase === 'exercices' && fin(x.contenu); })[0];
      if (ph) exos = [court(ph.contenu, 120)];
    }
    notions = sansDoublon(notions, obj).slice(0, 4);
    if (notions.length) L.push((notions.length > 1 ? (past ? 'Notions abordées' : 'Notions à aborder') : (past ? 'Notion abordée' : 'Notion à aborder')) + ' : ' + notions.join(' ; '));
    if (exos.length) L.push((exos.length > 1 || /,| et /.test(exos[0]) ? (past ? 'Exercices traités' : 'Exercices à traiter') : (past ? 'Exercice traité' : 'Exercice à traiter')) + ' : ' + exos.join(', '));
    suite.forEach(function (x) { L.push(x); });

    var au = unique((d.items || []).filter(function (i) { return i.k === 'a'; }).map(function (i) { return court(i.txt, 70); }));
    if (au.length) L.push('Automatismes : ' + minus(au.slice(0, 2).join(' ; ')));
    var b = d.bilan || {};
    if (past && fin(b.realise)) L.push('Bilan : ' + minus(fin(b.realise)));
    if (past && fin(b.a_reprendre)) L.push('À reprendre : ' + minus(fin(b.a_reprendre)));
    if (!L.length) L.push((OUV[s.type] || OUV.autre)[0]);

    /* travail à faire */
    var T = [];
    if (d.dm && d.dm.actif) {
      var tr = fin(d.dm.titre) || 'Devoir maison';
      if (d.dm.pour && d.dm.pour !== 'classe') tr += ' (' + lbl(K.DM_POUR, d.dm.pour).toLowerCase() + ')';
      if (fin(d.dm.consigne)) tr += ' : ' + fin(d.dm.consigne).replace(/\s*\n+\s*/g, ' ; ').slice(0, 400);
      if (d.dm.rendu) tr += ' — à rendre pour le ' + fmtD(d.dm.rendu);
      T.push(tr);
    }
    if (md) {
      L.push('Appli : ' + Man.appAt(md.man, md.ch, md.notions.length ? 'lecon' : ''));
      T.push((past ? 'Revoir : ' : 'Lire : ') + (md.notions.length ? md.notions.map(function (n) { return n.titre + ' (' + Man.pg(n.pages[0]) + ')'; }).join(' ; ') : 'chapitre ' + md.ch.n));
    } else if (manuel) {
      L.push('Appli : ' + man.url);
      T.push((past ? 'Revoir : ' : 'Lire : ') + (mt[0].notions.length ? mt[0].notions.join(' ; ') : 'chapitre ' + mt[0].chap.n) + ' (manuel, chapitre ' + mt[0].chap.n + ')');
    }
    return { contenu: L.join('\n'), travail: T.join('\n'), manuel: manuel };
  }

  function section(s, cl, d, save) {
    if (!d.pronote || typeof d.pronote !== 'object') d.pronote = { contenu: '', travail: '', temps: '' };
    var p = d.pronote;
    function tps() { return p.temps || (s.statut === 'faite' ? 'passe' : 'futur'); }

    var ta1, ta2, cnt = h('span', { class: 'muted small' });
    function upd() { cnt.textContent = (p.contenu || '').length + ' caractères'; }
    ta1 = UI.textarea(function () { return p.contenu; }, function (v) { p.contenu = v; save(); upd(); }, 'Objectif : …\nNotion abordée : …\nExercice traité : …', 5);
    ta2 = UI.textarea(function () { return p.travail; }, function (v) { p.travail = v; save(); }, 'Travail à faire pour la prochaine séance (facultatif)', 2);
    function setVal(ta, v) { ta.value = v; ta.dispatchEvent(new Event('input', { bubbles: true })); }
    function gen() {
      var r = draft(s, cl, tps(), APP.manuels ? 3 : 1);
      var go = function () { setVal(ta1, r.contenu); p.contenu = r.contenu; if (r.travail || !(p.travail || '').trim() || p.travail === p.auto_travail) { setVal(ta2, r.travail); p.travail = r.travail; } p.auto_travail = r.travail; save(); UI.toast('Synthèse rédigée : relisez-la et ajustez-la.'); };
      if ((p.contenu || '').trim() && (p.contenu || '').trim() !== r.contenu) UI.ask('Remplacer le texte actuel par une nouvelle rédaction automatique ?', { ok: 'Remplacer' }).then(function (ok) { if (ok) go(); }); else go();
    }
    function cp(txt, msg) { if (!txt.trim()) { UI.toast('Rien à copier : rédigez d’abord la synthèse.', 'err'); return; } copyText(txt).then(function (ok) { UI.toast(ok ? msg : 'Copie impossible : sélectionnez le texte et copiez-le à la main.', ok ? '' : 'err'); }); }
    var box = h('div', null,
      h('p', { class: 'muted small' }, 'Quelques lignes courtes (objectif, notion, exercice), sans mise en forme ni émojis : elles se collent proprement dans le cahier de textes de Pronote. Relisez avant de coller.'),
      h('div', { class: 'row-gap' }, UI.field('Rédaction', UI.select([['passe', 'Au passé (séance faite)'], ['futur', 'Au futur (séance à venir)']], tps(), function (v) { p.temps = v; save(); }, 'sm')),
        h('button', { class: 'btn primary', type: 'button', title: 'Ce qui a été traité, d’après les éléments du programme cochés', onclick: gen }, '✨ Rédiger la synthèse')),
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

  /* mémo personnel (non destiné à Pronote) appuyé sur mes manuels : chapitre, notions, lien de l’appli, notions à revoir */
  function perso(s, cl, d, save) {
    if (!d.pronote || typeof d.pronote !== 'object') d.pronote = { contenu: '', travail: '', temps: '' };
    var p = d.pronote, hasMan = Manuels.has(cl && cl.niveau_id);
    function tps() { return p.temps || (s.statut === 'faite' ? 'passe' : 'futur'); }
    var ta = UI.textarea(function () { return p.perso || ''; }, function (v) { p.perso = v; save(); }, 'Mémo pour moi : chapitre du manuel, notions, lien de l’appli…', 5);
    function gen() {
      var r = draft(s, cl, tps(), 2);
      if (!r.manuel) { UI.toast('Aucun chapitre de tes manuels ne correspond à cette séance.', 'err'); return; }
      var txt = r.contenu + (r.travail ? '\n\nÀ revoir / à faire : ' + r.travail : '');
      var go = function () { ta.value = txt; p.perso = txt; save(); UI.toast('Mémo rédigé : relisez-le et ajustez-le.'); };
      if ((p.perso || '').trim() && (p.perso || '').trim() !== txt) UI.ask('Remplacer le mémo actuel par une nouvelle rédaction automatique ?', { ok: 'Remplacer' }).then(function (ok) { if (ok) go(); }); else go();
    }
    var box = h('div', null,
      h('p', { class: 'muted small' }, 'Réservé à votre usage : ce texte n’est pas celui du cahier de textes Pronote. Il s’appuie sur vos manuels (« Maths et MCV » 2de / 1re / Terminale, « 3ème Série Pro », « Maths · CAP ») : chapitre, notions et lien de l’appli.'),
      hasMan ? h('div', { class: 'row-gap' }, h('button', { class: 'btn primary', type: 'button', onclick: gen }, '✨ Rédiger le mémo avec mes manuels'),
        h('button', { class: 'btn', type: 'button', onclick: function () { if (!(p.perso || '').trim()) { UI.toast('Rien à copier : rédigez d’abord le mémo.', 'err'); return; } copyText(p.perso).then(function (ok) { UI.toast(ok ? 'Mémo copié.' : 'Copie impossible : sélectionnez le texte et copiez-le à la main.', ok ? '' : 'err'); }); } }, '📋 Copier le mémo'))
        : h('p', { class: 'muted small' }, 'Pas de manuel pour ce niveau : le mémo reste libre, vous pouvez le saisir à la main.'),
      ta);
    return UI.section('sea-perso', '🔒 Mémo perso (avec mes manuels)', [box], { open: !!(p.perso || '').trim() });
  }
  return { draft: draft, section: section, perso: perso };
})();
