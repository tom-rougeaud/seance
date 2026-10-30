/* ═══ FICHES · constantes et fonctions communes aux écrans ═══ */
'use strict';
var K = {
  TYPES: [['cours', 'Cours'], ['activite', 'Activité / TP'], ['exercices', 'Exercices'], ['automatismes', 'Automatismes'], ['evaluation', 'Évaluation'], ['revision', 'Révision'], ['ap', 'AP / remédiation'], ['projet', 'Projet'], ['dm', 'DM'], ['autre', 'Autre']],
  MATIERES: [['maths', 'Maths', 'Maths'], ['co_inter', 'Co-intervention', 'Co-inter'], ['consolidation', 'Consolidation', 'Consol.'], ['soutien', 'Soutien au parcours', 'Soutien'], ['techno', 'Techno', 'Techno'], ['sciences', 'Sciences', 'Sciences'], ['aide_devoirs', 'Aide aux devoirs', 'Aide dev.'], ['rcd', 'RCD', 'RCD']],
  MODALITES: [['classe', 'Classe entière'], ['demi_groupe', 'Demi-groupe'], ['demi_groupes_paralleles', 'Deux demi-groupes en parallèle'], ['co_intervention', 'Co-intervention'], ['salle_info', 'Salle informatique'], ['autre', 'Autre']],
  STATUTS_SEANCE: [['a_faire', 'À faire'], ['prete', 'Prête'], ['faite', 'Faite'], ['reportee', 'Reportée'], ['annulee', 'Annulée']],
  STATUTS_SEQ: [['brouillon', 'Brouillon'], ['prete', 'Prête'], ['en_cours', 'En cours'], ['faite', 'Faite']],
  NIVEAUX_VISES: [['decouverte', 'Découverte'], ['entrainement', 'Entraînement'], ['maitrise', 'Maîtrise'], ['evaluation', 'Évaluation']],
  MATERIEL: [['casio', 'Calculatrice Casio collège'], ['geogebra', 'GeoGebra'], ['tableur', 'Excel / tableur'], ['ordi', 'Ordinateurs / tablettes'], ['video', 'Vidéoprojecteur'], ['manuel', 'Manuel / polycopié'], ['instruments', 'Instruments de géométrie'], ['fiche', 'Fiche élève'], ['cahier', 'Cahier / classeur'], ['prog', 'Scratch / Python']],
  PHASES: [['accroche', 'Accroche'], ['recherche', 'Recherche / activité'], ['cours', 'Cours / institutionnalisation'], ['exercices', 'Exercices'], ['automatismes', 'Automatismes / flash'], ['bilan', 'Bilan'], ['evaluation', 'Évaluation'], ['autre', 'Autre']],
  ORGA: [['collectif', 'Collectif'], ['individuel', 'Individuel'], ['binomes', 'Binômes'], ['groupes', 'Groupes']],
  USAGES: [['prof', 'Pour le professeur'], ['eleve', 'Pour les élèves'], ['projete', 'À projeter'], ['dm', 'Pour le DM'], ['evaluation', 'Évaluation']],
  PALETTE: ['#2B4C7E', '#3B7C8F', '#4C8A6B', '#8A7A3A', '#B0703A', '#A5525C', '#7C6BB0', '#5B6F8F', '#6B7F55', '#8F5B7A'],
  DM_POUR: [['classe', 'Toute la classe'], ['G1', 'Groupe 1'], ['G2', 'Groupe 2']],
  PALETTES: [['marine', 'Marine', ['#F3F5F9', '#2B4C7E', '#3B7C8F']], ['ardoise', 'Ardoise', ['#F2F3F5', '#46566E', '#6B7C93']], ['foret', 'Forêt', ['#F2F6F3', '#3C6B52', '#5E8A6E']], ['ocean', 'Lagon', ['#F1F6F7', '#2F6F7E', '#4F8A9A']],
    ['prune', 'Prune', ['#F6F3F8', '#6A4C7C', '#8A6A9C']], ['terre', 'Terre cuite', ['#F8F4F0', '#9A5A3C', '#B07A50']], ['bordeaux', 'Bordeaux', ['#F8F3F4', '#8A3A48', '#A5525C']], ['contraste', 'Contraste élevé', ['#FFFFFF', '#0B2A66', '#000000']]],
  POLICES: [['systeme', 'Système', 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif'], ['humaniste', 'Humaniste', '"Source Sans 3",system-ui,sans-serif'], ['classique', 'Classique (serif)', 'Lora,Georgia,serif'],
    ['arrondi', 'Arrondie', 'Nunito,system-ui,sans-serif'], ['lisible', 'Très lisible', '"Atkinson Hyperlegible",Verdana,sans-serif'], ['manuscrit', 'Manuscrite', '"Patrick Hand","Segoe Print",cursive']],
  TAILLES: [['1', 'Normal'], ['1.12', 'Grand'], ['1.25', 'Très grand']]
};
/* matière d’un créneau du planning (absente = maths) */
function matId(c) { var m = c && c.matiere; return K.MATIERES.some(function (x) { return x[0] === m; }) ? m : 'maths'; }
function matLabel(c) { var id = matId(c); return K.MATIERES.filter(function (x) { return x[0] === id; })[0][1]; }
function matShort(c) { var id = matId(c); return K.MATIERES.filter(function (x) { return x[0] === id; })[0][2]; }
/* propositions pour une séance créée depuis un créneau : type et modalité selon la matière */
function slotSeanceInit(c) {
  var m = matId(c), o = { duree_min: Math.min(+c.duree || 55, 240), modalite: c.groupe ? 'demi_groupe' : 'classe', groupe: c.groupe || null };
  if (m === 'co_inter' && !c.groupe) o.modalite = 'co_intervention';
  if (m === 'consolidation' || m === 'soutien' || m === 'aide_devoirs') o.type = 'ap';
  return o;
}
function lbl(list, v) { var r = list.filter(function (x) { return x[0] === v; })[0]; return r ? r[1] : v; }
function defaultNiv(type) { return { cours: 'decouverte', activite: 'decouverte', exercices: 'entrainement', automatismes: 'entrainement', evaluation: 'evaluation', revision: 'maitrise', ap: 'entrainement' }[type] || 'entrainement'; }

function emptySeanceData(cl) {
  var s = DB.settings();
  return { objectif: '', items: [], chapitres: [], manuel: { chap: null, notions: [], exos: [] }, competences: [], comp_caps: [], comp_manual: false, prerequis: '', ancrage: (cl && cl.metier) || '',
    materiel: (s.materiel_defaut || ['casio']).slice(), materiel_libre: '', phases: [],
    groupes: [{ nom: 'Groupe 1', contenu: '' }, { nom: 'Groupe 2', contenu: '' }],
    diff: { upe2a: '', difficulte: '', rapides: '', amenagements: '' }, trace: '',
    dm: { actif: false, titre: '', consigne: '', pour: 'classe', rendu: '', duree_min: 30 }, eval: { criteres: '', bareme: '' },
    bilan: { realise: '', notes: '', a_reprendre: '' }, pronote: { contenu: '', travail: '', temps: '', perso: '' }, notes: '' };
}
function emptySequenceData(cl) {
  return { items: [], chapitres: [], competences: [], comp_caps: [], comp_manual: false, probleme: '', ancrage: (cl && cl.metier) || '', prerequis: '',
    evaluations: [], diff: { upe2a: '', difficulte: '', rapides: '' }, bilan: '', notes: '' };
}
/* complète un enregistrement chargé avec les valeurs par défaut (anciennes données, import) */
function normData(rec, kind, cl) {
  var base = kind === 'seance' ? emptySeanceData(cl) : emptySequenceData(cl);
  var d = rec.data && typeof rec.data === 'object' ? rec.data : {};
  Object.keys(base).forEach(function (k) {
    if (d[k] === undefined) d[k] = base[k];
    else if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k]) && typeof d[k] === 'object') { Object.keys(base[k]).forEach(function (kk) { if (d[k][kk] === undefined) d[k][kk] = base[k][kk]; }); }
  });
  rec.data = d; return d;
}

var Cls = {
  all: function () { return DB.list('fs_classes').slice().sort(function (a, b) { return (a.ordre - b.ordre) || cmpStr(a.nom, b.nom); }); },
  actives: function () { return Cls.all().filter(function (c) { return !c.archive; }); },
  get: function (id) { return DB.byId('fs_classes', id); },
  niveauLabel: function (c) { var n = Ref.niveau(c.niveau_id); return n ? n.label : c.niveau_id; },
  seances: function (classId) { return DB.list('fs_seances').filter(function (s) { return s.class_id === classId; }).sort(Cls.cmpSeance); },
  cmpSeance: function (a, b) { var da = Plan.seanceDate(a) || '9999', db = Plan.seanceDate(b) || '9999'; return da < db ? -1 : da > db ? 1 : (a.ordre - b.ordre); },
  sequences: function (classId) { return DB.list('fs_sequences').filter(function (q) { return q.class_id === classId; }).sort(function (a, b) { return a.ordre - b.ordre; }); },
  seancesDe: function (seqId) { return DB.list('fs_seances').filter(function (s) { return s.sequence_id === seqId; }).sort(function (a, b) { return (a.ordre - b.ordre) || Cls.cmpSeance(a, b); }); },
  chip: function (c) { return h('span', { class: 'cls-chip', style: { background: c.couleur, color: textOn(c.couleur) } }, c.nom); }
};

/* ajout / retrait d’un élément du référentiel dans une séance ou une séquence */
function toggleItem(rec, kind, item, on, chap, typeForNiv) {
  var d = rec.data; var i = d.items.findIndex(function (x) { return x.ref === item.id; });
  if (on && i < 0) {
    var txt = item.txt + (item.sous && item.sous.length ? ' — ' + item.sous.join(' ; ') : '');
    d.items.push({ k: kind, ref: item.id, txt: txt, niv: defaultNiv(typeForNiv), chap: chap && chap.id || null });
    if (chap && chap.id && d.chapitres.indexOf(chap.id) < 0) d.chapitres.push(chap.id);
    if (!d.comp_manual && item.comp) item.comp.forEach(function (c) { if (d.competences.indexOf(c) < 0) d.competences.push(c); });
  } else if (!on && i >= 0) {
    d.items.splice(i, 1);
    if (chap && chap.id && !d.items.some(function (x) { return x.chap === chap.id; })) d.chapitres = d.chapitres.filter(function (c) { return c !== chap.id; });
  }
}
function suggestComps(rec) {
  var out = [];
  rec.data.items.forEach(function (it) { var l = Ref.lookup(it.ref); var c = l && l.item && l.item.comp; if (c) c.forEach(function (x) { if (out.indexOf(x) < 0) out.push(x); }); else if (it.k === 'p' || it.k === 'o') { Ref.guessComp(it.txt).forEach(function (x) { if (out.indexOf(x) < 0) out.push(x); }); } });
  return out;
}

/* ═══ Ressources : liens, fichiers, bibliothèque ═══ */
var Res = (function () {
  var OK_EXT = /\.(pdf|png|jpe?g|gif|webp|docx?|xlsx?|pptx?|odt|ods|odp|txt|csv|ggb|zip|mp3|mp4|md)$/i;
  var QUOTA = 1073741824;
  function detectType(url) {
    var u = (url || '').toLowerCase(), host = hostOf(url);
    if (/\.pdf($|\?|#)/.test(u)) return 'pdf';
    if (/\.(png|jpe?g|gif|webp)($|\?|#)/.test(u)) return 'image';
    if (/(youtube\.com|youtu\.be|youtube-nocookie\.com|vimeo\.com|dailymotion\.com|canal-u\.tv|peertube|lumni\.fr|tube\.|\.mp4($|\?))/.test(host + u)) return 'video';
    if (/tom-rougeaud\.github\.io/.test(host + u)) return 'casier';
    return 'lien';
  }
  function titleFromUrl(url) { try { var x = new URL(url); var last = decodeURIComponent(x.pathname.split('/').filter(Boolean).pop() || ''); return (last ? last.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ') + ' — ' : '') + x.hostname.replace(/^www\./, ''); } catch (e) { return url; } }
  function icon(type) { return { pdf: '📄', lien: '🔗', video: '🎬', image: '🖼️', casier: '🗂️', fichier: '📎' }[type] || '📎'; }
  function usedBytes() { return DB.list('fs_ressources').reduce(function (n, r) { return n + (+r.taille || 0); }, 0); }
  function addLinks(text) {
    var made = [];
    String(text || '').split(/\r?\n/).forEach(function (line) {
      line = line.trim(); if (!line) return;
      var m = /^(.*?)\s*[|\t]\s*(https?:\/\/\S+)$/.exec(line) || /^(https?:\/\/\S+)\s+(.+)$/.exec(line);
      var url, title = '';
      if (m) { if (/^https?:/i.test(m[1])) { url = m[1]; title = m[2]; } else { title = m[1]; url = m[2]; } } else url = line;
      url = safeUrl(url); if (!url) return;
      /* vidéos YouTube : lien « sans cookies » */
      url = url.replace(/^https:\/\/(www\.)?youtube\.com\/watch\?v=([\w-]{6,})(.*)$/i, function (all, w, id, rest) { var t = /[?&]t=(\d+)/.exec(rest); return 'https://www.youtube-nocookie.com/embed/' + id + (t ? '?start=' + t[1] : ''); });
      var r = DB.create('fs_ressources', { type: detectType(url), titre: title || titleFromUrl(url), url: url, storage_path: null, mime: null, taille: 0, tags: [], note: '' });
      made.push(r);
    });
    return made;
  }
  function upload(file) {
    return new Promise(function (ok, ko) {
      if (!OK_EXT.test(file.name)) return ko(new Error('Type de fichier non accepté : ' + file.name));
      if (file.size > 50 * 1048576) return ko(new Error(file.name + ' dépasse 50 Mo'));
      if (usedBytes() + file.size > QUOTA) return ko(new Error('Espace de stockage plein (1 Go)'));
      var path = Api.uid() + '/' + uid().slice(0, 8) + '-' + safeName(file.name);
      Api.storage.upload(path, file).then(function () {
        var type = /\.pdf$/i.test(file.name) ? 'pdf' : /\.(png|jpe?g|gif|webp)$/i.test(file.name) ? 'image' : 'fichier';
        ok(DB.create('fs_ressources', { type: type, titre: file.name.replace(/\.[a-z0-9]+$/i, ''), url: null, storage_path: path, mime: file.type || null, taille: file.size, tags: [], note: '' }));
      }, function (e) { ko(e.network ? new Error('Envoi impossible hors connexion : ' + file.name) : e); });
    });
  }
  function open(r) {
    if (r.url) { var u = safeUrl(r.url); if (u) window.open(u, '_blank', 'noopener,noreferrer'); return; }
    if (!r.storage_path) return;
    var w = window.open('', '_blank');
    Api.storage.signedUrl(r.storage_path, 3600).then(function (u) { if (w) { w.opener = null; w.location = u; } else window.location = u; }, function (e) { if (w) w.close(); UI.toast('Fichier indisponible : ' + e.message, 'err'); });
  }
  function attach(parentType, parentId, ressourceId, usage) {
    var ex = DB.list('fs_attachments').filter(function (a) { return a.parent_id === parentId && a.ressource_id === ressourceId; })[0];
    if (ex) return ex;
    var n = DB.list('fs_attachments').filter(function (a) { return a.parent_id === parentId; }).length;
    return DB.create('fs_attachments', { parent_type: parentType, parent_id: parentId, ressource_id: ressourceId, usage: usage || 'prof', ordre: n, note: '' });
  }
  function of(parentId) {
    return DB.list('fs_attachments').filter(function (a) { return a.parent_id === parentId; }).sort(function (a, b) { return a.ordre - b.ordre; })
      .map(function (a) { return { att: a, res: DB.byId('fs_ressources', a.ressource_id) }; }).filter(function (x) { return x.res; });
  }
  function usageCount(ressourceId) { return DB.list('fs_attachments').filter(function (a) { return a.ressource_id === ressourceId; }).length; }
  function destroy(r) {
    var p = r.storage_path ? Api.storage.remove([r.storage_path]).catch(function () { /* fichier déjà supprimé */ }) : Promise.resolve();
    DB.remove('fs_ressources', r.id); return p;
  }

  /* bloc « Ressources » réutilisable dans les fiches */
  function block(parentType, rec, onChange) {
    var wrap = h('div', { class: 'res-block' });
    var listEl = h('div', { class: 'res-list' });
    var fileInp = h('input', { type: 'file', multiple: true, hidden: true, accept: '.pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp,.txt,.csv,.ggb,.zip,.mp3,.mp4,.md' });
    function handle(files, urls) {
      var added = 0;
      if (urls && urls.length) addLinks(urls.join('\n')).forEach(function (r) { attach(parentType, rec.id, r.id, 'eleve'); added++; });
      var chain = Promise.resolve();
      (files || []).forEach(function (f) {
        chain = chain.then(function () { UI.toast('Envoi de ' + f.name + '…'); return Res.upload(f).then(function (r) { attach(parentType, rec.id, r.id, 'eleve'); added++; }, function (e) { UI.toast(e.message, 'err'); }); });
      });
      chain.then(function () { if (added) UI.toast(plural(added, 'ressource ajoutée', 'ressources ajoutées')); render(); if (onChange) onChange(); });
      if (!(files || []).length) { render(); if (onChange) onChange(); }
    }
    var dz = h('div', { class: 'dropzone', tabindex: 0 },
      h('div', null, h('strong', null, 'Glissez ici '), 'des PDF, images, fichiers ou des liens (ou collez-les avec Ctrl+V).'),
      h('div', { class: 'dz-btns' },
        h('button', { class: 'btn small', type: 'button', onclick: function () { fileInp.click(); } }, '📎 Fichiers…'),
        h('button', { class: 'btn small', type: 'button', onclick: function () {
          UI.promptText('Ajouter des liens', { multiline: true, help: 'Un lien par ligne. Variante : « Titre | https://… ». Les vidéos YouTube sont converties en lien sans cookies.', ok: 'Ajouter' }).then(function (v) { if (v) handle([], v.split(/\r?\n/).map(function (l) { return l; })); });
        } }, '🔗 Liens…'),
        h('button', { class: 'btn small', type: 'button', onclick: function () { pickFromLibrary(parentType, rec, function () { render(); if (onChange) onChange(); }); } }, '📚 Ma bibliothèque')));
    fileInp.addEventListener('change', function () { handle(Array.prototype.slice.call(fileInp.files), []); fileInp.value = ''; });
    UI.dropzone(dz, function (d) { handle(d.files, d.urls); });
    dz.addEventListener('paste', function (e) { var t = (e.clipboardData || window.clipboardData).getData('text'); if (/https?:\/\//.test(t)) { e.preventDefault(); handle([], t.split(/\r?\n/)); } });
    function render() {
      clear(listEl);
      var items = of(rec.id);
      if (!items.length) listEl.appendChild(h('p', { class: 'muted small' }, 'Aucune ressource jointe.'));
      items.forEach(function (x, i) {
        var r = x.res, a = x.att;
        listEl.appendChild(h('div', { class: 'res-row' },
          h('span', { class: 'res-ic' }, icon(r.type)),
          h('div', { class: 'res-main' }, h('button', { class: 'linklike', type: 'button', onclick: function () { open(r); } }, r.titre || '(sans titre)'), h('div', { class: 'muted small' }, r.url ? hostOf(r.url) : fmtSize(r.taille) + ' · fichier')),
          UI.select(K.USAGES, a.usage, function (v) { a.usage = v; DB.save('fs_attachments', a); if (onChange) onChange(); }, 'sm'),
          h('button', { class: 'icon-btn sm', type: 'button', title: 'Renommer', onclick: function () { UI.promptText('Titre de la ressource', { value: r.titre }).then(function (v) { if (v !== null) { r.titre = v.trim() || r.titre; DB.save('fs_ressources', r); render(); if (onChange) onChange(); } }); } }, '✎'),
          h('button', { class: 'icon-btn sm', type: 'button', title: 'Retirer de cette fiche (reste dans la bibliothèque)', onclick: function () { DB.remove('fs_attachments', a.id); render(); if (onChange) onChange(); } }, '✕')));
      });
    }
    render();
    wrap.appendChild(dz); wrap.appendChild(fileInp); wrap.appendChild(listEl);
    return wrap;
  }

  function pickFromLibrary(parentType, rec, done) {
    var sel = {}; var q = '';
    var list = h('div', { class: 'lib-pick' });
    var search = h('input', { class: 'inp', type: 'search', placeholder: 'Rechercher…' });
    function draw() {
      clear(list);
      var rs = DB.list('fs_ressources').filter(function (r) { return !q || Ref.norm(r.titre + ' ' + (r.tags || []).join(' ')).indexOf(Ref.norm(q)) >= 0; }).sort(function (a, b) { return cmpStr(a.titre, b.titre); });
      if (!rs.length) list.appendChild(h('p', { class: 'muted' }, 'Bibliothèque vide : ajoutez d’abord des ressources.'));
      rs.forEach(function (r) {
        var cb = h('input', { type: 'checkbox', checked: !!sel[r.id] }); cb.addEventListener('change', function () { sel[r.id] = cb.checked; });
        list.appendChild(h('label', { class: 'res-row' }, cb, h('span', { class: 'res-ic' }, icon(r.type)), h('div', { class: 'res-main' }, r.titre, h('div', { class: 'muted small' }, r.url ? hostOf(r.url) : fmtSize(r.taille)))));
      });
    }
    search.addEventListener('input', debounce(function () { q = search.value; draw(); }, 150));
    draw();
    UI.modal({ title: 'Ajouter depuis ma bibliothèque', body: h('div', null, search, list), actions: [{ label: 'Annuler', kind: 'ghost' }, { label: 'Ajouter', kind: 'primary', onClick: function () { Object.keys(sel).forEach(function (id) { if (sel[id]) attach(parentType, rec.id, id, 'eleve'); }); done(); } }] });
  }
  return { detectType: detectType, icon: icon, usedBytes: usedBytes, QUOTA: QUOTA, addLinks: addLinks, upload: upload, open: open, attach: attach, of: of, usageCount: usageCount, destroy: destroy, block: block, pickFromLibrary: pickFromLibrary };
})();
