/* ═══ FICHES · « Ma séance » : séances construites sur mes manuels (chapitres, notions, pages, exercices, liens) ═══ */
'use strict';
var Man = (function () {
  var DATA, TYPE = { support: 'Support', probleme: 'Problème', defi: 'Défi' };
  var APPSEC = { support: 'entrainement', probleme: 'problemes', defi: 'problemes' };
  function load() {
    if (DATA !== undefined) return DATA;
    try { var e = document.getElementById('MANUELS'); DATA = e && e.textContent.trim() ? JSON.parse(e.textContent) : null; } catch (x) { DATA = null; }
    return DATA;
  }
  function enabled() { return !!(APP.manuels && load()); }
  function get(niv) { var d = load(); return (APP.manuels && d && d[niv]) || null; }
  function has(niv) { return !!get(niv); }
  function chapter(man, n) { var r = null; (man && man.chapitres || []).forEach(function (c) { if (c.n === +n) r = c; }); return r; }

  /* liens */
  function pdfAt(man, p) { return man.pdf + '#page=' + p; }
  function chapPdf(man, ch) { return man.chap_pdf.replace('%d', ch.n); }
  function appAt(man, ch, sec) { return man.web + '#/c' + ch.n + (sec ? '/' + sec : ''); }
  function pg(a) { return !a ? '' : (Array.isArray(a) ? (a[0] === a[1] ? 'p. ' + a[0] : 'p. ' + a[0] + '–' + a[1]) : 'p. ' + a); }
  function nums(a) { a = a.slice().sort(function (x, y) { return x - y; }); return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' et ' + a[a.length - 1]; }

  /* ── correspondance avec les objectifs du programme (pour que la progression se mette à jour) ── */
  function norm(t) { return Manuels.norm(t); }
  function notionRe(level, ch, notion) {
    var m = Manuels.get(level), mc = m && m.chap.filter(function (c) { return c.n === ch.n; })[0], re = null;
    if (mc) mc.notions.forEach(function (n) { if (!re && norm(n.t) === norm(notion.titre)) re = n.re; });
    if (re) return re;
    var w = norm(notion.titre).split(/[^a-z0-9]+/).filter(function (x) { return x.length > 4; });
    return w.length ? new RegExp(w.join('|')) : null;
  }
  function boItems(level, ch, notion) {
    var m = Manuels.get(level), mc = m && m.chap.filter(function (c) { return c.n === ch.n; })[0]; if (!mc) return [];
    var re = notionRe(level, ch, notion), out = []; if (!re) return out;
    var e = Ref.effective(level);
    e.chapitres.forEach(function (bc) {
      if (mc.refs.indexOf(bc.id) < 0) return;
      bc.objectifs.map(function (x) { return { k: 'o', x: x }; }).concat(bc.connaissances.map(function (x) { return { k: 'k', x: x }; })).forEach(function (r) {
        if (re.test(norm(r.x.txt)) && out.length < 4) out.push({ k: r.k, ref: r.x.id, txt: r.x.txt, chap: bc.id });
      });
    });
    return out;
  }
  /* recalcule les éléments du programme liés aux notions cochées (ceux posés à la main ne sont jamais touchés) */
  function sync(s, cl) {
    var d = s.data, m = d.manuel, man = get(cl.niveau_id), ch = man && m && chapter(man, m.chap);
    var keep = (d.items || []).filter(function (i) { return i.via !== 'man'; }), have = {}; keep.forEach(function (i) { have[i.ref] = 1; });
    var add = [];
    if (ch) ch.notions.forEach(function (n) {
      if (m.notions.indexOf(n.n) < 0) return;
      boItems(cl.niveau_id, ch, n).forEach(function (x) { if (!have[x.ref]) { have[x.ref] = 1; add.push({ k: x.k, ref: x.ref, txt: x.txt, niv: defaultNiv(s.type), chap: x.chap, via: 'man' }); } });
    });
    d.items = keep.concat(add);
    var cs = d.chapitres || []; add.forEach(function (x) { if (cs.indexOf(x.chap) < 0) cs.push(x.chap); }); d.chapitres = cs;
    return add.length;
  }

  /* ── description d’une séance (pour exports, Pronote, mémo) ── */
  function describe(s, cl) {
    var m = s.data && s.data.manuel, man = cl && get(cl.niveau_id), ch = man && m && m.chap ? chapter(man, m.chap) : null;
    if (!ch) return null;
    return { man: man, ch: ch, notions: ch.notions.filter(function (n) { return (m.notions || []).indexOf(n.n) >= 0; }), exos: ch.exos.filter(function (e) { return (m.exos || []).indexOf(e.n) >= 0; }) };
  }
  function notionTxt(x) { return 'notion ' + x.n + ' « ' + x.titre + ' » (' + pg(x.pages) + ')'; }
  function exoTxt(x) { return 'n° ' + x.n + ' « ' + x.titre + ' » (' + pg(x.page) + ')'; }
  function lines(s, cl) {
    var D = describe(s, cl); if (!D) return [];
    var L = ['Manuel « ' + D.man.nom + ' » — chapitre ' + D.ch.n + ' « ' + D.ch.titre + ' » (' + pg([D.ch.page, D.ch.fin]) + ')'];
    if (D.notions.length) L.push('Notions : ' + D.notions.map(notionTxt).join(' ; '));
    if (D.exos.length) L.push('Exercices : ' + D.exos.map(exoTxt).join(' ; '));
    return L;
  }
  function html(s, cl) {
    var D = describe(s, cl); if (!D) return '';
    var E = esc, a = function (href, t) { return '<a href="' + E(href) + '">' + E(t) + '</a>'; };
    var out = ['<strong>' + E(D.man.nom) + '</strong> — chapitre ' + D.ch.n + ' « ' + E(D.ch.titre) + ' » (' + pg([D.ch.page, D.ch.fin]) + ') · ' + a(chapPdf(D.man, D.ch), 'PDF du chapitre') + ' · ' + a(appAt(D.man, D.ch, ''), 'appli')];
    D.notions.forEach(function (x) { out.push('Notion ' + x.n + ' : ' + E(x.titre) + ' — ' + a(pdfAt(D.man, x.pages[0]), pg(x.pages)) + ' · ' + a(appAt(D.man, D.ch, 'lecon'), 'leçon')); });
    if (D.exos.length) {
      out.push('Exercices : ' + D.exos.map(function (x) { return a(pdfAt(D.man, x.page), 'n° ' + x.n) + ' ' + E(x.titre) + ' (' + pg(x.page) + ')'; }).join(' ; '));
      out.push('Réponses : ' + a(pdfAt(D.man, D.man.reponses), pg(D.man.reponses)));
    }
    return '<ul>' + out.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>';
  }

  /* ── propositions de séances d’1 h : une séance par notion, une pour les défis, une pour le contrôle ── */
  function specs(cl, ch) {
    var man = get(cl.niveau_id); if (!man) return [];
    var out = [], tot = ch.notions.length + (ch.exos.some(function (e) { return e.type === 'defi'; }) ? 1 : 0) + (ch.evalu ? 1 : 0), rang = 0;
    function base(type, titre, head, mn) {
      rang++;
      var d = emptySeanceData(cl);
      d.manuel = { chap: ch.n, notions: mn.notions, exos: mn.exos };
      return { d: d, spec: { id: man.id + '.' + ch.n + '#' + rang, type: type, duree: 60, titre: 'Ch. ' + ch.n + ' — ' + head, rang: rang, total: tot, data: d } };
    }
    ch.notions.forEach(function (n) {
      var ex = ch.exos.filter(function (e) { return e.notion === n.n && e.type !== 'defi'; });
      var b = base('cours', n.titre, n.titre, { notions: [n.n], exos: ex.map(function (e) { return e.n; }) }), d = b.d;
      d.objectif = 'À la fin de la séance, l’élève sait : ' + n.titre.charAt(0).toLowerCase() + n.titre.slice(1) + '.';
      d.chapitres = [];
      var fake = { data: d, type: 'cours' }; sync(fake, cl); d.items = fake.data.items; d.chapitres = fake.data.chapitres;
      d.comp_manual = false;
      d.prerequis = rang > 1 ? 'Notion précédente du chapitre ' + ch.n + ' (manuel ' + pg(ch.notions[rang - 2] ? ch.notions[rang - 2].pages : null) + ').' : '';
      var ph = defaultPhases('cours', 60);
      ph.forEach(function (x) {
        if (x.phase === 'accroche' || x.phase === 'recherche') x.contenu = 'Activité « Je découvre » du manuel (' + pg(n.pages[0]) + ') : ' + n.titre + '.';
        else if (x.phase === 'cours') x.contenu = 'Institutionnalisation avec « Je retiens » (' + pg(n.pages[1]) + ') : ' + n.titre + '.';
        else if (x.phase === 'exercices') x.contenu = ex.length ? 'Exercices du manuel : ' + ex.map(exoTxt).join(' ; ') + '.' : 'Exercices d’application du chapitre ' + ch.n + ' (choisir dans « Je m’entraîne »).';
        else if (x.phase === 'automatismes') x.contenu = 'Questions flash en lien avec le chapitre ' + ch.n + '.';
        else if (x.phase === 'bilan') x.contenu = 'Bilan : ce qu’il faut retenir (' + n.titre + ').';
      });
      d.phases = ph;
      d.trace = 'Titre : ' + n.titre + '\n\nÀ retenir (manuel ' + pg(n.pages[1]) + ') : …\nExemple : …';
      b.spec.sub = pg(n.pages) + (ex.length ? ' · ' + plural(ex.length, 'exercice') : '');
      b.spec.preview = ['Notion ' + n.n + ' : ' + n.titre + ' (' + pg(n.pages) + ')'].concat(ex.map(function (e) { return 'Exercice ' + exoTxt(e) + ' — ' + (TYPE[e.type] || e.type).toLowerCase(); }));
      b.spec.head = n.titre; out.push(b.spec);
    });
    var defis = ch.exos.filter(function (e) { return e.type === 'defi'; });
    if (defis.length) {
      var b2 = base('exercices', 'Défis et problèmes', 'Défis et problèmes', { notions: [], exos: defis.map(function (e) { return e.n; }) }), d2 = b2.d;
      d2.objectif = 'Réinvestir le chapitre ' + ch.n + ' dans des situations plus ouvertes.';
      var ph2 = defaultPhases('exercices', 60);
      ph2.forEach(function (x) { if (x.phase === 'exercices') x.contenu = 'Défis du manuel : ' + defis.map(exoTxt).join(' ; ') + '.'; else if (x.phase === 'bilan') x.contenu = 'Mise en commun des démarches.'; });
      d2.phases = ph2;
      b2.spec.sub = plural(defis.length, 'défi'); b2.spec.preview = defis.map(function (e) { return 'Défi ' + exoTxt(e) + (e.etapes ? ' — ' + e.etapes + ' étapes' : ''); });
      b2.spec.head = 'Défis et problèmes'; out.push(b2.spec);
    }
    if (ch.evalu) {
      var b3 = base('evaluation', 'Je m’évalue', 'Contrôle', { notions: [], exos: [] }), d3 = b3.d;
      d3.objectif = 'Évaluer les acquis du chapitre ' + ch.n + '.';
      d3.eval = { criteres: 'Rubrique « S’évaluer » du manuel (' + pg(ch.evalu.page) + ') : ' + (ch.evalu.titre || 'contrôle blanc') + '.', bareme: '' };
      var ph3 = defaultPhases('evaluation', 60); ph3.forEach(function (x) { if (x.phase === 'evaluation') x.contenu = 'Contrôle (' + pg(ch.evalu.page) + ').'; });
      d3.phases = ph3;
      b3.spec.sub = pg(ch.evalu.page); b3.spec.preview = ['S’évaluer — ' + (ch.evalu.titre || 'contrôle') + ' (' + pg(ch.evalu.page) + ')'];
      b3.spec.head = 'Contrôle'; out.push(b3.spec);
    }
    out.forEach(function (x) { x.total = out.length; });
    return out;
  }

  /* ── section « Manuel » dans la séance ── */
  function section(s, cl, save) {
    var man = get(cl.niveau_id), d = s.data;
    if (!d.manuel || typeof d.manuel !== 'object') d.manuel = { chap: null, notions: [], exos: [] };
    var m = d.manuel; if (!Array.isArray(m.notions)) m.notions = []; if (!Array.isArray(m.exos)) m.exos = [];
    var box = h('div');
    if (!man) { box.appendChild(h('p', { class: 'muted' }, 'Pas de manuel pour ce niveau (' + Cls.niveauLabel(cl) + '). Utilisez la section « Programme ».')); return UI.section('sea-man', '📘 Manuel', [box], { open: false }); }
    if (!m.chap) { var sug = Manuels.match(cl.niveau_id, d, s.titre); if (sug && sug.length) { var c0 = chapter(man, sug[0].chap.n); if (c0) m.chap = c0.n; } }
    var badge = h('span', { class: 'badge' }, '');
    function commit() { var n = sync(s, cl); save.now(); if (n) UI.toast(plural(n, 'objectif du programme ajouté', 'objectifs du programme ajoutés') + ' pour la progression.'); Views.rerender(); }
    function lnk(href, t, title) { return h('a', { class: 'lnk', href: href, target: '_blank', rel: 'noopener noreferrer', title: title || null }, t); }
    function draw() {
      clear(box);
      var ch = chapter(man, m.chap);
      badge.textContent = ch ? m.notions.length + ' notion' + (m.notions.length > 1 ? 's' : '') + ' · ' + m.exos.length + ' ex.' : '';
      box.appendChild(h('div', { class: 'grid2' }, UI.field('Chapitre — ' + man.nom, UI.select([['', '— choisir un chapitre —']].concat(man.chapitres.map(function (c) { return [String(c.n), 'Ch. ' + c.n + ' · ' + c.titre + ' (' + pg([c.page, c.fin]) + ')']; })), m.chap ? String(m.chap) : '', function (v) { m.chap = v ? +v : null; m.notions = []; m.exos = []; sync(s, cl); save.now(); Views.rerender(); }))));
      if (!ch) { box.appendChild(h('p', { class: 'muted small' }, 'Choisissez le chapitre pour voir ses notions, ses pages et ses exercices.')); return; }
      box.appendChild(h('div', { class: 'row-gap man-links' }, lnk(pdfAt(man, ch.page), '📄 Manuel PDF ' + pg(ch.page)), lnk(chapPdf(man, ch), '📘 PDF du chapitre'), lnk(appAt(man, ch, ''), '🌐 Appli du chapitre'), lnk(pdfAt(man, man.reponses), '✅ Réponses ' + pg(man.reponses)),
        ch.atoi ? lnk(pdfAt(man, ch.atoi.page), '🧩 À toi ' + pg(ch.atoi.page), ch.atoi.titre) : null, ch.evalu ? lnk(pdfAt(man, ch.evalu.page), '📝 S’évaluer ' + pg(ch.evalu.page), ch.evalu.titre) : null));
      /* notions */
      var nl = h('div', { class: 'man-list' });
      ch.notions.forEach(function (n) {
        var on = m.notions.indexOf(n.n) >= 0;
        nl.appendChild(h('div', { class: 'man-row' + (on ? ' on' : '') }, h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: on, onchange: function (e) { if (e.target.checked) m.notions.push(n.n); else m.notions = m.notions.filter(function (x) { return x !== n.n; }); m.notions.sort(function (a, b) { return a - b; }); commit(); } }), h('span', null, h('strong', null, n.n + '. ' + n.titre), n.partie ? h('em', { class: 'tag' }, n.partie) : null)),
          h('span', { class: 'man-ref' }, lnk(pdfAt(man, n.pages[0]), '📄 ' + pg(n.pages), 'Ouvrir le manuel à cette page'), lnk(appAt(man, ch, 'lecon'), '🌐 leçon'))));
      });
      box.appendChild(h('h3', { class: 'man-h' }, 'Notions du chapitre')); box.appendChild(nl);
      /* exercices */
      var el = h('div', { class: 'man-list' });
      var chosen = m.notions;
      var exs = ch.exos.slice().sort(function (a, b) { var ra = chosen.indexOf(a.notion) >= 0 ? 0 : 1, rb = chosen.indexOf(b.notion) >= 0 ? 0 : 1; return (ra - rb) || (a.n - b.n); });
      exs.forEach(function (x) {
        var on = m.exos.indexOf(x.n) >= 0, rel = chosen.indexOf(x.notion) >= 0;
        el.appendChild(h('div', { class: 'man-row' + (on ? ' on' : '') + (rel ? ' rel' : '') }, h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: on, onchange: function (e) { if (e.target.checked) m.exos.push(x.n); else m.exos = m.exos.filter(function (y) { return y !== x.n; }); m.exos.sort(function (a, b) { return a - b; }); save.now(); draw(); } }),
          h('span', null, h('strong', null, 'Ex. ' + x.n), ' ' + x.titre, h('em', { class: 'tag t-' + x.type }, TYPE[x.type] || x.type), x.notion ? h('em', { class: 'tag' }, 'notion ' + x.notion) : null, x.etapes ? h('em', { class: 'tag' }, x.etapes + ' étapes') : null)),
          h('span', { class: 'man-ref' }, lnk(pdfAt(man, x.page), '📄 ' + pg(x.page), 'Ouvrir le manuel à cette page'), lnk(appAt(man, ch, APPSEC[x.type] || 'entrainement'), '🌐 appli'))));
      });
      box.appendChild(h('div', { class: 'man-hd' }, h('h3', { class: 'man-h' }, 'Exercices du chapitre'), h('span', { class: 'grow' }),
        h('button', { class: 'btn small', type: 'button', title: 'Coche les exercices (supports et problèmes) des notions choisies', onclick: function () { var ids = ch.exos.filter(function (e) { return chosen.indexOf(e.notion) >= 0 && e.type !== 'defi'; }).map(function (e) { return e.n; }); if (!ids.length) { UI.toast('Cochez d’abord une notion.'); return; } ids.forEach(function (i) { if (m.exos.indexOf(i) < 0) m.exos.push(i); }); m.exos.sort(function (a, b) { return a - b; }); save.now(); draw(); } }, '☑ Exercices des notions cochées'),
        m.exos.length ? h('button', { class: 'btn small ghost', type: 'button', onclick: function () { m.exos = []; save.now(); draw(); } }, 'Tout décocher') : null));
      box.appendChild(el);
      box.appendChild(h('p', { class: 'muted small' }, 'Les liens ouvrent le manuel (PDF à la bonne page) ou l’appli du manuel dans un nouvel onglet. Cocher une notion ajoute les objectifs correspondants du programme officiel : la progression de la classe se met à jour quand la séance est « faite ».'));
    }
    draw();
    var sec = UI.section('sea-man', '📘 Manuel : chapitre, pages, exercices', [box], { open: true });
    $('summary', sec).appendChild(badge);
    return sec;
  }
  return { enabled: enabled, get: get, has: has, chapter: chapter, describe: describe, lines: lines, html: html, specs: specs, section: section, sync: sync, pg: pg, nums: nums, pdfAt: pdfAt, appAt: appAt, chapPdf: chapPdf, exoTxt: exoTxt, notionTxt: notionTxt };
})();
