/* ═══ FICHES · bibliothèque, programmes, réglages, à propos, confidentialité ═══ */
'use strict';

/* ── Bibliothèque de ressources ── */
Views.biblio = function () {
  var root = h('div', { class: 'page' });
  root.appendChild(pageHead('Bibliothèque', 'Tous vos PDF, liens et vidéos, réutilisables dans toutes les fiches.', []));
  var q = '', type = '';
  var used = Res.usedBytes();
  root.appendChild(h('div', { class: 'gauge' }, h('div', { class: 'bar' }, h('i', { style: { width: Math.min(100, used / Res.QUOTA * 100) + '%' } })), h('span', { class: 'muted small' }, fmtSize(used) + ' utilisés sur ' + fmtSize(Res.QUOTA))));
  var fileInp = h('input', { type: 'file', multiple: true, hidden: true });
  function handle(files, urls) {
    var n = 0;
    if (urls && urls.length) n += Res.addLinks(urls.join('\n')).length;
    var chain = Promise.resolve();
    (files || []).forEach(function (f) { chain = chain.then(function () { UI.toast('Envoi de ' + f.name + '…'); return Res.upload(f).then(function () { n++; }, function (e) { UI.toast(e.message, 'err'); }); }); });
    chain.then(function () { if (n) UI.toast(plural(n, 'ressource ajoutée', 'ressources ajoutées')); draw(); });
    if (!(files || []).length) draw();
  }
  fileInp.addEventListener('change', function () { handle(Array.prototype.slice.call(fileInp.files), []); fileInp.value = ''; });
  var dz = h('div', { class: 'dropzone big', tabindex: 0 }, h('div', null, h('strong', null, 'Glissez ici '), 'des PDF, images, fichiers ou liens (ou collez un lien avec Ctrl+V).'),
    h('div', { class: 'dz-btns' }, h('button', { class: 'btn small', type: 'button', onclick: function () { fileInp.click(); } }, '📎 Fichiers…'),
      h('button', { class: 'btn small', type: 'button', onclick: function () { UI.promptText('Ajouter des liens', { multiline: true, help: 'Un lien par ligne. Variante : « Titre | https://… ».', ok: 'Ajouter' }).then(function (v) { if (v) handle([], v.split(/\r?\n/)); }); } }, '🔗 Liens…')));
  UI.dropzone(dz, function (x) { handle(x.files, x.urls); });
  dz.addEventListener('paste', function (e) { var t = (e.clipboardData || window.clipboardData).getData('text'); if (/https?:\/\//.test(t)) { e.preventDefault(); handle([], t.split(/\r?\n/)); } });
  root.appendChild(dz); root.appendChild(fileInp);
  var search = h('input', { class: 'inp', type: 'search', placeholder: 'Rechercher un titre, une étiquette…' });
  search.addEventListener('input', debounce(function () { q = search.value; draw(); }, 150));
  var typeSel = UI.select([['', 'Tous les types'], ['pdf', 'PDF'], ['lien', 'Liens'], ['video', 'Vidéos'], ['image', 'Images'], ['fichier', 'Autres fichiers'], ['casier', 'Casier']], '', function (v) { type = v; draw(); }, 'sm');
  root.appendChild(h('div', { class: 'row-gap' }, search, typeSel));
  var list = h('div', { class: 'lib-list' }); root.appendChild(list);

  function draw() {
    clear(list);
    var rs = DB.list('fs_ressources').filter(function (r) { return (!type || r.type === type) && (!q || Ref.norm(r.titre + ' ' + (r.tags || []).join(' ') + ' ' + (r.url || '')).indexOf(Ref.norm(q)) >= 0); }).sort(function (a, b) { return cmpStr(a.titre, b.titre); });
    if (!rs.length) list.appendChild(h('p', { class: 'muted' }, DB.list('fs_ressources').length ? 'Aucun résultat.' : 'Votre bibliothèque est vide.'));
    rs.forEach(function (r) {
      var n = Res.usageCount(r.id);
      var tags = h('input', { class: 'inp sm', type: 'text', value: (r.tags || []).join(', '), placeholder: 'étiquettes (ex. proportionnalité, 2de)', onchange: function (e) { r.tags = e.target.value.split(',').map(function (x) { return x.trim(); }).filter(Boolean).slice(0, 12); DB.save('fs_ressources', r); } });
      list.appendChild(h('div', { class: 'card lib-row' }, h('span', { class: 'res-ic big' }, Res.icon(r.type)),
        h('div', { class: 'res-main' }, h('button', { class: 'linklike', type: 'button', onclick: function () { Res.open(r); } }, r.titre || '(sans titre)'), h('div', { class: 'muted small' }, (r.url ? hostOf(r.url) : fmtSize(r.taille)) + ' · ' + (n ? 'utilisé dans ' + plural(n, 'fiche') : 'non utilisé')), tags),
        h('div', { class: 'res-act' },
          h('button', { class: 'icon-btn sm', type: 'button', title: 'Renommer', onclick: function () { UI.promptText('Titre', { value: r.titre }).then(function (v) { if (v !== null && v.trim()) { r.titre = v.trim(); DB.save('fs_ressources', r); draw(); } }); } }, '✎'),
          h('button', { class: 'icon-btn sm', type: 'button', title: 'Supprimer', onclick: function () {
            UI.ask('Supprimer « ' + r.titre + ' » de la bibliothèque' + (r.storage_path ? ' et du stockage' : '') + ' ?' + (n ? ' Elle sera retirée des ' + plural(n, 'fiche') + ' où elle est jointe.' : ''), { ok: 'Supprimer', danger: true }).then(function (ok) { if (ok) { Res.destroy(r); draw(); } });
          } }, '🗑'))));
    });
  }
  draw(); return root;
};

/* ── Programmes (référentiels) ── */
Views.referentiel = function (niveauId) {
  var root = h('div', { class: 'page' });
  var ns = Ref.niveaux(); var nid = niveauId || Store.get('ref_niv') || ns[0].id; Store.set('ref_niv', nid);
  var n = Ref.niveau(nid), e = Ref.effective(nid);
  root.appendChild(pageHead('Programmes officiels', 'Les textes du BO, avec vos personnalisations.', []));
  root.appendChild(h('div', { class: 'chips' }, ns.map(function (x) { return h('a', { class: 'chip' + (x.id === nid ? ' on' : ''), href: '#/referentiel/' + x.id }, x.label); })));
  root.appendChild(h('div', { class: 'card' }, h('h2', null, n.label), h('p', { class: 'muted' }, n.bo), h('p', { class: 'small' }, plural(e.chapitres.length, 'chapitre') + ' · ' + plural(Ref.allItemsOf(nid).length, 'élément') + ' (objectifs, notions, automatismes).')));

  /* personnalisations */
  var perso = DB.list('fs_ref_perso').filter(function (p) { return p.niveau_id === nid; });
  var sp = h('section', { class: 'card' }, h('h2', null, 'Mes personnalisations'));
  if (!perso.length) sp.appendChild(h('p', { class: 'muted' }, 'Aucune. Dans une séance ou une séquence, le bouton « ✎ Modifier » du sélecteur permet de renommer, masquer ou ajouter des éléments.'));
  perso.forEach(function (p) {
    var l = Ref.lookup(p.ref_id), base = p.action === 'add' ? null : lookupBO(nid, p.ref_id);
    var txt = p.action === 'add' ? 'Ajouté (' + (p.kind === 'chapitre' ? 'chapitre' : p.kind === 'o' ? 'objectif' : p.kind === 'k' ? 'notion' : 'automatisme') + ') : ' + p.txt : p.action === 'rename' ? 'Renommé : « ' + (base || p.ref_id) + ' » → « ' + p.txt + ' »' : 'Masqué : ' + (base || p.ref_id);
    sp.appendChild(h('div', { class: 'row-s' }, h('span', { class: 'row-t' }, txt), h('button', { class: 'btn small', type: 'button', onclick: function () {
      var go = function () { DB.remove('fs_ref_perso', p.id); Ref.invalidate(); Views.rerender(); };
      if (p.action === 'add') UI.ask('Supprimer cet ajout du programme ? Les fiches qui l’utilisent gardent leur texte.', { ok: 'Supprimer', danger: true }).then(function (ok) { if (ok) go(); }); else go();
    } }, p.action === 'add' ? 'Supprimer' : 'Rétablir')));
  });
  root.appendChild(sp);

  /* consultation */
  var bs = h('section', { class: 'card' }, h('h2', null, 'Chapitres'));
  e.chapitres.forEach(function (c) {
    var p = c.portee || {}; var tag = p.grp ? 'Groupement ' + p.grp.join(', ') : p.cap_grp ? 'Groupement ' + p.cap_grp.join(', ') : p.sans_pc ? 'Sans physique-chimie' : p.poursuite ? 'Poursuite d’études' : '';
    var det = h('details', { class: 'pk-chap' }, h('summary', null, h('span', { class: 'pk-ct' }, c.domaine + ' › ' + c.titre), tag ? h('em', { class: 'tag' }, tag) : null, h('span', { class: 'pk-count' }, c.objectifs.length + ' obj. · ' + c.connaissances.length + ' notions')));
    var b = h('div', { class: 'pk-chap-b' });
    if (c.objectifs.length) { b.appendChild(h('div', { class: 'pk-gt' }, 'Objectifs (capacités)')); b.appendChild(h('ul', { class: 'plain' }, c.objectifs.map(function (o) { return h('li', null, o.txt); }))); }
    if (c.connaissances.length) { b.appendChild(h('div', { class: 'pk-gt' }, 'Notions et connaissances')); b.appendChild(h('ul', { class: 'plain' }, c.connaissances.map(function (o) { return h('li', null, o.txt + (o.sous && o.sous.length ? ' — ' + o.sous.join(' ; ') : '')); }))); }
    det.appendChild(b); bs.appendChild(det);
  });
  root.appendChild(bs);
  if (e.vocabulaire && e.vocabulaire.length) root.appendChild(h('section', { class: 'card' }, h('h2', null, 'Vocabulaire du programme'), h('p', { class: 'small' }, e.vocabulaire.join(' · '))));
  return root;
};
function lookupBO(nid, ref) {
  var n = Ref.niveau(nid), out = null;
  n.chapitres.forEach(function (c) { if (c.id === ref) out = c.titre; c.objectifs.concat(c.connaissances).forEach(function (x) { if (x.id === ref) out = x.txt; }); });
  n.automatismes.forEach(function (a) { if (a.id === ref) out = a.txt; });
  return out ? (out.length > 80 ? out.slice(0, 80) + '…' : out) : null;
}

/* ── Réglages ── */
Views.reglages = function () {
  var root = h('div', { class: 'page narrow' });
  root.appendChild(pageHead('Réglages', null, []));
  var s = DB.settings();
  /* matériel par défaut */
  var mat = h('div', { class: 'chips' });
  function drawMat() {
    clear(mat); var cur = (DB.settings().materiel_defaut || ['casio']);
    K.MATERIEL.forEach(function (m) { var on = cur.indexOf(m[0]) >= 0; mat.appendChild(h('button', { class: 'chip' + (on ? ' on' : ''), type: 'button', 'aria-pressed': on ? 'true' : 'false', onclick: function () { var c = (DB.settings().materiel_defaut || ['casio']).slice(), i = c.indexOf(m[0]); if (i >= 0) c.splice(i, 1); else c.push(m[0]); DB.saveSettings({ materiel_defaut: c }); drawMat(); } }, m[1])); });
  }
  drawMat();
  root.appendChild(h('section', { class: 'card' }, h('h2', null, 'Matériel par défaut'), h('p', { class: 'muted small' }, 'Pré-coché dans chaque nouvelle séance.'), mat));

  /* affichage */
  var theme = Store.get('theme') || 'auto';
  root.appendChild(h('section', { class: 'card' }, h('h2', null, 'Affichage'), UI.field('Thème', UI.select([['auto', 'Automatique (appareil)'], ['light', 'Clair'], ['dark', 'Sombre']], theme, function (v) { Store.set('theme', v); Main.applyTheme(); }))));

  /* installation */
  root.appendChild(h('section', { class: 'card' }, h('h2', null, 'Installer sur l’écran d’accueil'), h('p', { class: 'muted small' }, 'Fiches fonctionne comme une appli (plein écran, lancement rapide, lecture hors connexion de vos fiches déjà chargées).'), h('button', { class: 'btn', type: 'button', onclick: function () { Main.installHelp(); } }, '📲 Comment installer ?')));

  /* données */
  var imp = h('input', { type: 'file', accept: 'application/json,.json', hidden: true });
  imp.addEventListener('change', function () { var f = imp.files[0]; imp.value = ''; if (f) Exp.importJson(f); });
  root.appendChild(h('section', { class: 'card' }, h('h2', null, 'Mes données'),
    h('p', { class: 'muted small' }, 'Tout est enregistré dans votre base (Supabase) et gardé en cache sur cet appareil. Une sauvegarde JSON reste utile avant un gros changement.'),
    h('div', { class: 'row-gap' }, h('button', { class: 'btn', type: 'button', onclick: function () { Exp.json(); } }, '⬇ Exporter (JSON)'), h('button', { class: 'btn', type: 'button', onclick: function () { imp.click(); } }, '⬆ Importer (JSON)'), imp,
      h('button', { class: 'btn danger', type: 'button', onclick: function () { Exp.wipe(); } }, '🗑 Effacer toutes mes données')),
    h('p', { class: 'small muted' }, DB.list('fs_classes').length + ' classes · ' + DB.list('fs_sequences').length + ' séquences · ' + DB.list('fs_seances').length + ' séances · ' + DB.list('fs_ressources').length + ' ressources')));

  /* compte */
  root.appendChild(h('section', { class: 'card' }, h('h2', null, 'Compte'), h('p', null, Api.user() && Api.user().email ? Api.user().email : ''), h('button', { class: 'btn', type: 'button', onclick: function () { Main.logout(); } }, 'Se déconnecter')));
  root.appendChild(h('p', { class: 'small center' }, h('a', { href: '#/apropos' }, 'À propos'), ' · ', h('a', { href: '#/confidentialite' }, 'Confidentialité'), ' · ' + APP.nom + ' ' + APP.version + ' (' + APP.build + ')'));
  return root;
};

/* ── À propos ── */
Views.apropos = function () {
  var root = h('div', { class: 'page narrow' });
  root.appendChild(pageHead('À propos', null, [], [Api.user() ? '#/reglages' : '#/', 'Retour']));
  root.appendChild(h('section', { class: 'card prose' },
    h('h2', null, 'Fiches · séances et séquences de maths'),
    h('p', null, 'Outil de préparation pour les professeurs de mathématiques de la voie professionnelle : 3e Prépa-Métiers, CAP, Bac Pro (2de, 1re, Tle). Les objectifs, notions et automatismes des programmes officiels sont proposés en accordéons ; on coche, on complète, on rédige. Les séances « faites » alimentent automatiquement la progression.'),
    h('h3', null, 'Sources des programmes'),
    h('ul', null, Ref.niveaux().map(function (n) { return h('li', null, h('strong', null, n.label), ' — ' + n.bo); })),
    h('p', { class: 'small muted' }, 'Les formulations sont reprises des textes officiels (éduscol / Bulletin officiel) ; les identifiants de compétences et la suggestion automatique selon le verbe d’action sont des aides de l’outil, à valider par l’enseignant(e). Vérifiez toujours les textes en vigueur.'),
    h('h3', null, 'Calendrier scolaire'),
    h('p', null, 'Le calendrier zone A 2026-2027 est proposé comme point de départ (source : ', h('a', { href: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F1727', target: '_blank', rel: 'noopener noreferrer' }, 'service-public.gouv.fr'), '). Adaptez-le à votre établissement : PFMP, examens, journées banalisées.'),
    h('h3', null, 'Licence et auteur'),
    h('p', null, 'Créé par Tom Rougeaud, professeur de mathématiques-sciences. Licence ', h('a', { href: 'https://creativecommons.org/licenses/by-nc/4.0/deed.fr', target: '_blank', rel: 'noopener noreferrer' }, 'CC BY-NC 4.0'), ' : réutilisation libre avec mention de l’auteur, hors usage commercial.'),
    h('p', null, h('a', { href: 'https://tom-rougeaud.github.io/casier/', target: '_blank', rel: 'noopener noreferrer' }, 'Le casier'), ' · ', h('a', { href: 'https://www.linkedin.com/in/tomrougeaud/', target: '_blank', rel: 'noopener noreferrer' }, 'LinkedIn'), ' · ', h('a', { href: 'mailto:tom.rougeaud.education@gmail.com' }, 'Contact')),
    h('p', { class: 'small muted' }, APP.nom + ' ' + APP.version + ' · version du ' + APP.build + ' · référentiels du ' + (Ref.raw().version || ''))));
  return root;
};

/* ── Confidentialité ── */
Views.confidentialite = function () {
  var root = h('div', { class: 'page narrow' });
  root.appendChild(pageHead('Confidentialité', null, [], [Api.user() ? '#/reglages' : '#/', 'Retour']));
  root.appendChild(h('section', { class: 'card prose' },
    h('h3', null, 'Ce qui est enregistré'),
    h('p', null, 'Votre adresse e-mail (pour la connexion), vos classes (nom, niveau, créneaux), vos séquences, séances, liens et fichiers que vous ajoutez. ', h('strong', null, 'Aucune donnée d’élève'), ' (nom, note, photo) n’est demandée : n’en saisissez pas dans les champs libres.'),
    h('h3', null, 'Où'),
    h('p', null, 'Dans votre base Supabase (hébergement sécurisé, accès protégé par des règles par utilisateur : seul votre compte lit et écrit vos lignes et vos fichiers). Une copie est gardée dans le stockage local de cet appareil pour le mode hors connexion.'),
    h('h3', null, 'Ce qui n’est pas fait'),
    h('p', null, 'Pas de traceur, pas de statistiques, pas de publicité, pas de police ou script chargé depuis un service tiers. Les vidéos YouTube sont enregistrées comme liens « sans cookies » et ne sont jamais intégrées automatiquement : rien n’est chargé tant que vous n’ouvrez pas le lien.'),
    h('h3', null, 'Vos droits'),
    h('p', null, 'Export complet en JSON et effacement de toutes vos données (lignes et fichiers) depuis Réglages. Suppression du compte : sur demande par e-mail.'),
    h('p', { class: 'small muted' }, 'Contact : tom.rougeaud.education@gmail.com')));
  return root;
};
