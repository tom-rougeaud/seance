/* ═══ FICHES · impression, Word, cahier de textes, sauvegarde JSON ═══ */
'use strict';
var Exp = (function () {
  var E = esc;
  function nl(s) { return E(s).replace(/\n/g, '<br>'); }
  function block(title, html) { return html ? '<h3>' + E(title) + '</h3>' + html : ''; }
  function para(s) { return s && String(s).trim() ? '<p>' + nl(s) + '</p>' : ''; }
  function ul(arr) { return arr.length ? '<ul>' + arr.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>' : ''; }

  function itemsHtml(rec, withNiv) {
    var groups = [], idx = {};
    (rec.data.items || []).forEach(function (it) {
      var key = it.chap || (it.k === 'a' ? '__a' : '__p');
      if (!(key in idx)) { idx[key] = groups.length; var l = it.chap ? Ref.lookup(it.chap) : null; groups.push({ t: l ? l.txt : (it.k === 'a' ? 'Automatismes' : 'Autres'), rows: [] }); }
      groups[idx[key]].rows.push(it);
    });
    return groups.map(function (g) {
      return '<div class="chap"><strong>' + E(g.t) + '</strong>' + ul(g.rows.map(function (it) { return E(it.txt) + (withNiv ? ' <span class="niv">(' + E(lbl(K.NIVEAUX_VISES, it.niv)) + ')</span>' : ''); })) + '</div>';
    }).join('');
  }
  function compsHtml(rec, cl) {
    var d = rec.data;
    var names = (d.competences || []).map(function (cid) { var c = Ref.compById(cl.niveau_id, cid); return c ? E(c.nom) : ''; }).filter(Boolean);
    var caps = (d.comp_caps || []).map(E);
    return (names.length ? '<p><strong>Compétences :</strong> ' + names.join(' · ') + '</p>' : '') + (caps.length ? '<p class="small">Capacités : ' + caps.join(' ; ') + '</p>' : '');
  }
  function resHtml(rec) {
    var rs = Res.of(rec.id); if (!rs.length) return '';
    return ul(rs.map(function (x) { var r = x.res; return Res.icon(r.type) + ' ' + E(r.titre) + ' <span class="small">(' + E(lbl(K.USAGES, x.att.usage).toLowerCase()) + (r.url ? ' — ' + E(r.url) : ' — fichier') + ')</span>'; }));
  }
  function diffHtml(d) {
    var f = d.diff || {};
    var rows = [['BEP / UPE2A', f.upe2a], ['Élèves en difficulté', f.difficulte], ['Élèves rapides', f.rapides], ['Autres aménagements', f.amenagements]].filter(function (r) { return r[1] && String(r[1]).trim(); });
    return rows.length ? ul(rows.map(function (r) { return '<strong>' + E(r[0]) + ' :</strong> ' + nl(r[1]); })) : '';
  }
  function metaLine(cl, parts) { return '<p class="meta">' + parts.filter(Boolean).map(E).join(' · ') + '</p>'; }

  function seanceHtml(s) {
    var cl = Cls.get(s.class_id), d = s.data, seq = s.sequence_id ? DB.byId('fs_sequences', s.sequence_id) : null, dt = Plan.seanceDate(s);
    var h = '<h1>' + E(s.titre || 'Séance') + '</h1>';
    h += metaLine(cl, [cl.nom, Cls.niveauLabel(cl) + (cl.groupement ? ' (gr. ' + cl.groupement + ')' : ''), lbl(K.TYPES, s.type), fmtDuree(s.duree_min), dt ? fmtD(dt) : '', s.modalite !== 'classe' ? lbl(K.MODALITES, s.modalite) + (s.groupe ? ' ' + s.groupe : '') : '', seq ? 'Séquence : ' + seq.titre : '']);
    if (d.objectif) h += '<p class="obj"><strong>Objectif :</strong> ' + nl(d.objectif) + '</p>';
    h += block('Programme', itemsHtml(s, true) + compsHtml(s, cl));
    h += block('Prérequis', para(d.prerequis)); h += block('Ancrage métier', para(d.ancrage));
    var mat = (d.materiel || []).map(function (m) { return lbl(K.MATERIEL, m); }).concat(d.materiel_libre ? [d.materiel_libre] : []);
    h += block('Matériel', mat.length ? '<p>' + mat.map(E).join(', ') + '</p>' : '');
    if (s.modalite === 'demi_groupes_paralleles') h += block('Demi-groupes en parallèle', '<table><tr>' + d.groupes.map(function (g) { return '<th>' + E(g.nom) + '</th>'; }).join('') + '</tr><tr>' + d.groupes.map(function (g) { return '<td>' + nl(g.contenu) + '</td>'; }).join('') + '</tr></table>');
    if (s.modalite === 'co_intervention' && d.notes_co) h += block('Co-intervention', para(d.notes_co));
    if (d.phases && d.phases.length) {
      h += block('Déroulé', '<table><tr><th>Phase</th><th>Durée</th><th>Organisation</th><th>Contenu</th></tr>' + d.phases.map(function (p) { return '<tr><td>' + E(lbl(K.PHASES, p.phase)) + '</td><td>' + (+p.duree || 0) + ' min</td><td>' + E(lbl(K.ORGA, p.orga || 'collectif')) + '</td><td>' + nl(p.contenu) + '</td></tr>'; }).join('') + '</table>');
    }
    if (s.type === 'evaluation') h += block('Évaluation', para(d.eval.criteres) + (d.eval.bareme ? '<p><strong>Barème :</strong> ' + nl(d.eval.bareme) + '</p>' : ''));
    h += block('Trace écrite', para(d.trace));
    if (d.dm && d.dm.actif) h += block('Devoir maison', '<p><strong>' + E(d.dm.titre || 'DM') + '</strong> — pour : ' + E(lbl(K.DM_POUR, d.dm.pour)) + (d.dm.rendu ? ' — à rendre le ' + E(fmtD(d.dm.rendu)) : '') + ' — durée estimée : ' + (+d.dm.duree_min || 0) + ' min</p>' + para(d.dm.consigne));
    h += block('Différenciation', diffHtml(d)); h += block('Ressources', resHtml(s));
    var b = d.bilan || {};
    if (b.realise || b.notes || b.a_reprendre) h += block('Bilan', (b.realise ? '<p><strong>Réalisé :</strong> ' + nl(b.realise) + '</p>' : '') + (b.notes ? '<p><strong>Observations :</strong> ' + nl(b.notes) + '</p>' : '') + (b.a_reprendre ? '<p><strong>À reprendre :</strong> ' + nl(b.a_reprendre) + '</p>' : ''));
    h += block('Notes', para(d.notes));
    return h;
  }
  function sequenceHtml(q) {
    var cl = Cls.get(q.class_id), d = q.data, ss = Cls.seancesDe(q.id), tot = ss.reduce(function (n, s) { return n + (s.statut === 'annulee' ? 0 : s.duree_min); }, 0);
    var h = '<h1>' + E(q.titre || 'Séquence') + '</h1>' + metaLine(cl, [cl.nom, Cls.niveauLabel(cl) + (cl.groupement ? ' (gr. ' + cl.groupement + ')' : ''), plural(ss.length, 'séance'), fmtDuree(tot), q.date_debut ? fmtD(q.date_debut) + ' → ' + fmtD(q.date_fin) : '']);
    h += block('Situation d’accroche', para(d.probleme)); h += block('Ancrage métier', para(d.ancrage)); h += block('Prérequis', para(d.prerequis));
    h += block('Programme', itemsHtml(q, false) + compsHtml(q, cl));
    if (ss.length) h += block('Séances', '<table><tr><th>N°</th><th>Séance</th><th>Type</th><th>Durée</th><th>Date</th></tr>' + ss.map(function (s, i) { var dd = Plan.seanceDate(s); return '<tr><td>' + (i + 1) + '</td><td>' + E(s.titre || '') + '</td><td>' + E(lbl(K.TYPES, s.type)) + (s.modalite !== 'classe' ? ' · ' + E(lbl(K.MODALITES, s.modalite)) + (s.groupe ? ' ' + E(s.groupe) : '') : '') + '</td><td>' + fmtDuree(s.duree_min) + '</td><td>' + (dd ? E(fmtD(dd)) : '') + '</td></tr>'; }).join('') + '</table>');
    if (d.evaluations && d.evaluations.length) h += block('Évaluations', ul(d.evaluations.map(function (e) { return E(e.titre || 'Évaluation') + ' (' + E(e.type || 'formative') + ')' + (e.date ? ' — ' + E(fmtD(e.date)) : ''); })));
    h += block('Différenciation', diffHtml(d)); h += block('Ressources', resHtml(q)); h += block('Bilan', para(d.bilan)); h += block('Notes', para(d.notes));
    return h;
  }
  function progressionHtml(cl) {
    var M = Plan.compute(cl.id), e = Ref.effective(cl.niveau_id), h = '<h1>Progression — ' + E(cl.nom) + '</h1>' + metaLine(cl, [Cls.niveauLabel(cl), cl.annee_scolaire, 'Édité le ' + fmtD(today())]);
    
    e.chapitres.forEach(function (ch) {
      if (!Ref.portee(ch, cl).ok) return;
      var s = Plan.chapStats(M, ch); if (!s.total) return;
      h += '<h3>' + E(ch.domaine + ' › ' + ch.titre) + ' <span class="small">(' + s.vus + '/' + s.total + ')</span></h3>';
      h += '<table class="prog">' + ch.objectifs.concat(ch.connaissances).map(function (it) { var m = Plan.get(M, it.id); return '<tr><td class="st">' + (Plan.planifie(m) ? 'Planifié' : m.statut ? Plan.STATUTS[m.statut].nom : '') + '</td><td>' + E(it.txt) + '</td><td class="small">' + (m.first ? E(fmtDM(m.first)) : '') + '</td></tr>'; }).join('') + '</table>';
    });
    return h;
  }

  function htmlFor(kind, rec) { return kind === 'seance' ? seanceHtml(rec) : kind === 'sequence' ? sequenceHtml(rec) : progressionHtml(rec); }
  function fileBase(kind, rec) {
    var cl = Cls.get(rec.class_id || rec.id); var t = kind === 'progression' ? 'progression' : (rec.titre || kind);
    return safeName((cl ? cl.nom + '_' : '') + t).replace(/_+/g, '_').slice(0, 60);
  }

  function print(kind, rec) {
    var root = document.getElementById('print-root'); if (!root) return;
    root.innerHTML = '<div class="doc">' + htmlFor(kind, rec) + '</div>';
    document.body.classList.add('printing');
    var done = function () { document.body.classList.remove('printing'); root.innerHTML = ''; window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    setTimeout(function () { try { window.print(); } catch (e) { done(); } }, 60);
    setTimeout(function () { if (document.body.classList.contains('printing')) done(); }, 120000);
  }
  function word(kind, rec) {
    var css = 'body{font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#111}h1{font-size:18pt;color:#1F3A66;margin:0 0 4pt}h3{font-size:12pt;color:#1F3A66;border-bottom:1px solid #9AA8C0;margin:12pt 0 4pt}table{border-collapse:collapse;width:100%}th,td{border:1px solid #9AA8C0;padding:3pt 5pt;vertical-align:top;text-align:left}th{background:#E6EBF4}.meta,.small,.niv{color:#555}.small{font-size:9pt}';
    var html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>' + E(rec.titre || kind) + '</title><style>' + css + '</style></head><body>' + htmlFor(kind, rec) + '</body></html>';
    downloadBlob(new Blob(['﻿', html], { type: 'application/msword' }), fileBase(kind, rec) + '.doc');
    UI.toast('Fichier Word créé (s’ouvre dans Word, LibreOffice ou Google Docs).');
  }
  function cahier(s) {
    var cl = Cls.get(s.class_id), d = s.data, dt = Plan.seanceDate(s);
    var L = [(dt ? fmtD(dt) + ' — ' : '') + cl.nom + ' — ' + (s.titre || 'Séance')];
    if (d.objectif) L.push('Objectif : ' + d.objectif);
    var its = (d.items || []).filter(function (i) { return i.k !== 'a'; });
    if (its.length) { L.push('Contenu :'); its.forEach(function (i) { L.push('• ' + i.txt); }); }
    var au = (d.items || []).filter(function (i) { return i.k === 'a'; });
    if (au.length) { L.push('Automatismes :'); au.forEach(function (i) { L.push('• ' + i.txt); }); }
    if (d.dm && d.dm.actif) L.push('Travail à faire : ' + (d.dm.titre || 'DM') + (d.dm.pour !== 'classe' ? ' (' + lbl(K.DM_POUR, d.dm.pour).toLowerCase() + ')' : '') + (d.dm.rendu ? ' — pour le ' + fmtD(d.dm.rendu) : '') + (d.dm.consigne ? '\n' + d.dm.consigne : ''));
    copyText(L.join('\n')).then(function (ok) { UI.toast(ok ? 'Texte copié : collez-le dans le cahier de textes.' : 'Copie impossible : le navigateur l’a refusée.', ok ? '' : 'err'); });
  }
  function progression(cl, M) {
    var e = Ref.effective(cl.niveau_id), rows = [['Domaine', 'Chapitre', 'Type', 'Élément', 'Statut', 'Séances faites', 'Première date', 'Dernière date', 'Minutes']];
    function csv(v) { v = String(v === null || v === undefined ? '' : v); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; }
    e.chapitres.forEach(function (ch) { ch.objectifs.concat(ch.connaissances).forEach(function (it) { var m = Plan.get(M, it.id); rows.push([ch.domaine, ch.titre, it.kind === 'o' ? 'Objectif' : 'Notion', it.txt, Plan.STATUTS[m.statut].nom, m.nbFaites, m.first || '', m.last || '', m.minutes]); }); });
    downloadBlob(new Blob(['﻿' + rows.map(function (r) { return r.map(csv).join(';'); }).join('\r\n')], { type: 'text/csv;charset=utf-8' }), safeName('progression_' + cl.nom) + '.csv');
  }

  /* ── sauvegarde JSON ── */
  function json() {
    var out = { format: 'fiches-export', version: 1, app: APP.version, exporte_le: new Date().toISOString(), reglages: DB.settings(), tables: {} };
    DB.ORDER.forEach(function (t) { out.tables[t] = DB.list(t).map(function (r) { var c = clone(r); delete c.user_id; return c; }); });
    downloadBlob(new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' }), 'fiches-sauvegarde-' + today() + '.json');
    UI.toast('Sauvegarde téléchargée (les fichiers PDF eux-mêmes restent dans votre stockage).');
  }

  var ENUM = {
    niveau: ['pm', 'cap', 'bp2', 'bp1', 'bpt'], grp: [null, 'A', 'B', 'C', '1', '2'],
    seqst: K.STATUTS_SEQ.map(function (x) { return x[0]; }), seast: K.STATUTS_SEANCE.map(function (x) { return x[0]; }),
    types: K.TYPES.map(function (x) { return x[0]; }), mod: K.MODALITES.map(function (x) { return x[0]; }), usages: K.USAGES.map(function (x) { return x[0]; }),
    rtype: ['pdf', 'lien', 'video', 'image', 'casier', 'fichier'], cal: ['vacances', 'ferie', 'pfmp', 'examen', 'sortie', 'autre']
  };
  function isStr(v, max) { return typeof v === 'string' && v.length <= (max || 5000); }
  function str(v, max) { return typeof v === 'string' ? v.slice(0, max || 5000) : ''; }
  function isInt(v, a, b) { return typeof v === 'number' && isFinite(v) && Math.floor(v) === v && v >= a && v <= b; }
  function isDate(v) { return v === null || v === undefined || (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !!parseISO(v)); }
  function isId(v) { return typeof v === 'string' && UUID_RE.test(v); }
  function okData(v) { try { return v && typeof v === 'object' && !Array.isArray(v) && JSON.stringify(v).length < 400000; } catch (e) { return false; } }
  var CLEAN = {
    fs_classes: function (r) {
      if (!isStr(r.nom, 80) || !r.nom.trim() || ENUM.niveau.indexOf(r.niveau_id) < 0 || ENUM.grp.indexOf(r.groupement === undefined ? null : r.groupement) < 0 || !/^\d{4}-\d{4}$/.test(r.annee_scolaire || '')) return null;
      var cr = Array.isArray(r.creneaux) ? r.creneaux.filter(function (c) { return c && isInt(c.jour, 1, 6) && /^\d{2}:\d{2}$/.test(c.debut || '') && isInt(+c.duree, 5, 480); }).map(function (c) { var o = { jour: c.jour, debut: c.debut, duree: +c.duree }; if (c.semaine === 1 || c.semaine === 2) o.semaine = c.semaine; if (c.groupe === 'G1' || c.groupe === 'G2') o.groupe = c.groupe; if (typeof c.salle === 'string' && c.salle.trim()) o.salle = c.salle.trim().slice(0, 30); return o; }) : [];
      return { id: r.id, nom: r.nom.trim(), niveau_id: r.niveau_id, groupement: r.groupement || null, avec_pc: r.avec_pc !== false, poursuite: !!r.poursuite, metier: str(r.metier, 200), annee_scolaire: r.annee_scolaire, couleur: /^#[0-9a-f]{6}$/i.test(r.couleur || '') ? r.couleur : K.PALETTE[0], creneaux: cr, notes: str(r.notes), archive: !!r.archive, ordre: isInt(r.ordre, 0, 9999) ? r.ordre : 0 };
    },
    fs_sequences: function (r, ctx) {
      if (!ctx.cls[r.class_id] || !okData(r.data) || ENUM.seqst.indexOf(r.statut) < 0 || !isDate(r.date_debut) || !isDate(r.date_fin)) return null;
      return { id: r.id, class_id: r.class_id, ordre: isInt(r.ordre, 0, 9999) ? r.ordre : 0, titre: str(r.titre, 200), statut: r.statut, date_debut: r.date_debut || null, date_fin: r.date_fin || null, data: r.data };
    },
    fs_seances: function (r, ctx) {
      if (!ctx.cls[r.class_id] || !okData(r.data) || ENUM.types.indexOf(r.type) < 0 || ENUM.mod.indexOf(r.modalite) < 0 || ENUM.seast.indexOf(r.statut) < 0 || !isDate(r.date_prevue) || !isDate(r.date_realisee) || !isInt(r.duree_min, 0, 600)) return null;
      if (r.sequence_id && !isId(r.sequence_id)) return null; if (r.jumelle_id && !isId(r.jumelle_id)) return null; if (r.groupe && r.groupe !== 'G1' && r.groupe !== 'G2') return null;
      return { id: r.id, class_id: r.class_id, sequence_id: r.sequence_id && ctx.seq[r.sequence_id] ? r.sequence_id : (r.sequence_id && ctx.existSeq[r.sequence_id] ? r.sequence_id : null), jumelle_id: r.jumelle_id || null, ordre: isInt(r.ordre, 0, 9999) ? r.ordre : 0, titre: str(r.titre, 200), type: r.type, modalite: r.modalite, groupe: r.groupe || null, duree_min: r.duree_min, date_prevue: r.date_prevue || null, date_realisee: r.date_realisee || null, statut: r.statut, data: r.data };
    },
    fs_ref_perso: function (r) {
      if (['add', 'rename', 'hide'].indexOf(r.action) < 0 || ENUM.niveau.indexOf(r.niveau_id) < 0 || ['o', 'k', 'a', 'chapitre'].indexOf(r.kind) < 0) return null;
      return { id: r.id, action: r.action, niveau_id: r.niveau_id, chapitre_id: r.chapitre_id ? str(r.chapitre_id, 100) : null, kind: r.kind, ref_id: r.ref_id ? str(r.ref_id, 100) : null, domaine: r.domaine ? str(r.domaine, 200) : null, txt: str(r.txt, 800), ordre: isInt(r.ordre, 0, 99999) ? r.ordre : 0 };
    },
    fs_ressources: function (r, ctx) {
      if (ENUM.rtype.indexOf(r.type) < 0) return null;
      var url = r.url ? safeUrl(r.url) : null, sp = r.storage_path && String(r.storage_path).indexOf(Api.uid() + '/') === 0 ? String(r.storage_path).slice(0, 300) : null;
      if (!url && !sp) { ctx.lostFiles++; return null; }
      return { id: r.id, type: r.type, titre: str(r.titre, 300), url: url, storage_path: sp, mime: r.mime ? str(r.mime, 100) : null, taille: isInt(+r.taille, 0, 1e10) ? +r.taille : 0, tags: Array.isArray(r.tags) ? r.tags.filter(function (t) { return isStr(t, 60); }).slice(0, 12) : [], note: str(r.note, 2000) };
    },
    fs_attachments: function (r, ctx) {
      if (['seance', 'sequence'].indexOf(r.parent_type) < 0 || !isId(r.parent_id) || !ctx.res[r.ressource_id] || ENUM.usages.indexOf(r.usage) < 0) return null;
      if (!(ctx.sea[r.parent_id] || ctx.seq[r.parent_id])) return null;
      return { id: r.id, parent_type: r.parent_type, parent_id: r.parent_id, ressource_id: r.ressource_id, usage: r.usage, ordre: isInt(r.ordre, 0, 9999) ? r.ordre : 0, note: str(r.note, 2000) };
    },
    fs_calendrier: function (r, ctx) {
      if (!/^\d{4}-\d{4}$/.test(r.annee_scolaire || '') || ENUM.cal.indexOf(r.type) < 0 || !isDate(r.debut) || !isDate(r.fin) || !r.debut || !r.fin || r.fin < r.debut) return null;
      if (r.class_id && !ctx.cls[r.class_id]) return null;
      return { id: r.id, annee_scolaire: r.annee_scolaire, class_id: r.class_id || null, type: r.type, label: str(r.label, 200), debut: r.debut, fin: r.fin };
    },
    fs_progress_override: function (r, ctx) {
      if (!ctx.cls[r.class_id] || !isStr(r.ref_id, 100) || !isInt(r.statut, 0, 3) || !isDate(r.date_realisation)) return null;
      return { id: r.id, class_id: r.class_id, ref_id: r.ref_id, statut: r.statut, date_realisation: r.date_realisation || null, note: str(r.note, 2000) };
    }
  };

  function importJson(file) {
    if (file.size > 25 * 1048576) { UI.toast('Fichier trop volumineux.', 'err'); return; }
    var fr = new FileReader();
    fr.onerror = function () { UI.toast('Lecture impossible.', 'err'); };
    fr.onload = function () {
      var j; try { j = JSON.parse(fr.result); } catch (e) { UI.toast('Ce fichier n’est pas un JSON valide.', 'err'); return; }
      if (!j || j.format !== 'fiches-export' || !j.tables || typeof j.tables !== 'object') { UI.toast('Ce fichier n’est pas une sauvegarde Fiches.', 'err'); return; }
      var ctx = { cls: {}, seq: {}, sea: {}, res: {}, lostFiles: 0, existSeq: {} };
      DB.list('fs_classes').forEach(function (c) { ctx.cls[c.id] = 1; }); DB.list('fs_sequences').forEach(function (q) { ctx.existSeq[q.id] = 1; }); DB.list('fs_ressources').forEach(function (r) { ctx.res[r.id] = 1; });
      var clean = {}, counts = {}, skipped = 0;
      DB.ORDER.forEach(function (t) {
        clean[t] = []; var src = Array.isArray(j.tables[t]) ? j.tables[t] : [];
        src.forEach(function (r) {
          if (!r || typeof r !== 'object' || !isId(r.id) || !CLEAN[t]) { if (CLEAN[t]) skipped++; return; }
          var c = CLEAN[t](r, ctx); if (!c) { skipped++; return; }
          clean[t].push(c);
          if (t === 'fs_classes') ctx.cls[c.id] = 1; if (t === 'fs_sequences') ctx.seq[c.id] = 1; if (t === 'fs_seances') ctx.sea[c.id] = 1; if (t === 'fs_ressources') ctx.res[c.id] = 1;
        });
        counts[t] = clean[t].length;
      });
      /* les séances jumelles doivent exister */
      clean.fs_seances.forEach(function (s) { if (s.jumelle_id && !ctx.sea[s.jumelle_id] && !DB.byId('fs_seances', s.jumelle_id)) s.jumelle_id = null; });
      var msg = counts.fs_classes + ' classes, ' + counts.fs_sequences + ' séquences, ' + counts.fs_seances + ' séances, ' + counts.fs_ressources + ' ressources, ' + counts.fs_attachments + ' pièces jointes.' + (skipped ? ' ' + skipped + ' élément(s) invalide(s) ignoré(s).' : '') + (ctx.lostFiles ? ' ' + plural(ctx.lostFiles, 'fichier') + ' stocké(s) pour un autre compte non récupérable(s).' : '');
      UI.ask('Importer : ' + msg + ' Les éléments de même identifiant seront remplacés, les autres conservés.', { title: 'Importer une sauvegarde', ok: 'Importer' }).then(function (ok) {
        if (!ok) return;
        DB.ORDER.forEach(function (t) { if (CLEAN[t]) DB.bulkPut(t, clean[t]); });
        if (j.reglages && typeof j.reglages === 'object' && okData(j.reglages)) DB.saveSettings({ materiel_defaut: Array.isArray(j.reglages.materiel_defaut) ? j.reglages.materiel_defaut.filter(function (m) { return ENUM && K.MATERIEL.some(function (x) { return x[0] === m; }); }) : undefined });
        if (j.reglages.alternance && typeof j.reglages.alternance === 'object') Object.keys(j.reglages.alternance).forEach(function (an) { var a = j.reglages.alternance[an]; if (/^\d{4}-\d{4}$/.test(an) && a && /^\d{4}-\d{2}-\d{2}$/.test(a.lundi || '') && (a.type === 1 || a.type === 2)) Plan.setAltConfig(an, { lundi: a.lundi, type: a.type, sauter_vacances: a.sauter_vacances !== false }); });
        Ref.invalidate(); UI.toast('Sauvegarde importée.'); Views.rerender();
      });
    };
    fr.readAsText(file);
  }

  function wipe() {
    UI.promptText('Effacer toutes mes données', { help: 'Supprime définitivement toutes vos classes, fiches, ressources et fichiers (pas votre compte). Tapez EFFACER pour confirmer. Pensez à exporter une sauvegarde avant.', placeholder: 'EFFACER', ok: 'Effacer définitivement' }).then(function (v) {
      if (v === null) return;
      if (v.trim() !== 'EFFACER') { UI.toast('Confirmation incorrecte : rien n’a été supprimé.'); return; }
      DB.flush().then(function () { return Api.rest.rpc('fs_effacer_mes_donnees', {}); }).then(function (paths) {
        paths = (Array.isArray(paths) ? paths : []).filter(function (p) { return typeof p === 'string'; });
        var chunks = []; for (var i = 0; i < paths.length; i += 50) chunks.push(paths.slice(i, i + 50));
        return chunks.reduce(function (p, c) { return p.then(function () { return Api.storage.remove(c).catch(function () { /* déjà supprimé */ }); }); }, Promise.resolve());
      }).then(function () { DB.reset(); Ref.invalidate(); UI.toast('Toutes vos données ont été effacées.'); location.hash = '#/'; Views.rerender(); }, function (e) { UI.toast('Échec de l’effacement : ' + (e && e.message || e), 'err'); });
    });
  }

  return { print: print, word: word, cahier: cahier, progression: progression, json: json, importJson: importJson, wipe: wipe, html: htmlFor };
})();
