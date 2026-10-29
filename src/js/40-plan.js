/* ═══ FICHES · planning (calendrier, créneaux) et progression automatique ═══ */
'use strict';
var Plan = (function () {
  /* Calendrier zone A (académie de Dijon) 2026-2027 — source : service-public.gouv.fr — À VÉRIFIER avec l’établissement. */
  var PRESETS = {
    '2026-2027': [
      { type: 'vacances', label: 'Vacances de la Toussaint', debut: '2026-10-17', fin: '2026-11-01' },
      { type: 'ferie', label: 'Armistice 1918', debut: '2026-11-11', fin: '2026-11-11' },
      { type: 'vacances', label: 'Vacances de Noël', debut: '2026-12-19', fin: '2027-01-03' },
      { type: 'vacances', label: 'Vacances d’hiver', debut: '2027-02-13', fin: '2027-02-28' },
      { type: 'ferie', label: 'Lundi de Pâques', debut: '2027-03-29', fin: '2027-03-29' },
      { type: 'vacances', label: 'Vacances de printemps', debut: '2027-04-10', fin: '2027-04-25' },
      { type: 'ferie', label: 'Fête du travail', debut: '2027-05-01', fin: '2027-05-01' },
      { type: 'ferie', label: 'Victoire 1945', debut: '2027-05-08', fin: '2027-05-08' },
      { type: 'ferie', label: 'Ascension et pont', debut: '2027-05-06', fin: '2027-05-07' },
      { type: 'ferie', label: 'Lundi de Pentecôte', debut: '2027-05-17', fin: '2027-05-17' },
      { type: 'vacances', label: 'Vacances d’été', debut: '2027-07-03', fin: '2027-08-31' }
    ]
  };
  function bornes(annee) { var y = +annee.slice(0, 4); return { debut: y + '-09-01', fin: (y + 1) + '-07-02' }; }

  function ranges(classId, annee) {
    return DB.list('fs_calendrier').filter(function (c) { return c.annee_scolaire === annee && (!c.class_id || c.class_id === classId); });
  }
  function blockedReason(iso, rs) {
    for (var i = 0; i < rs.length; i++) if (iso >= rs[i].debut && iso <= rs[i].fin) return rs[i];
    return null;
  }

  /* ── alternance semaine 1 / semaine 2 ── */
  function altConfig(annee) { var a = (DB.settings().alternance || {})[annee]; return a && /^\d{4}-\d{2}-\d{2}$/.test(a.lundi || '') && (a.type === 1 || a.type === 2) ? a : null; }
  function setAltConfig(annee, cfg) { var all = Object.assign({}, DB.settings().alternance || {}); all[annee] = Object.assign({}, cfg, { v: 2 }); DB.saveSettings({ alternance: all }); }
  /* une semaine est « de pause » si du lundi au vendredi tout est en vacances (période valable pour toutes les classes) */
  function semainePause(mondayISO, annee) {
    var rs = DB.list('fs_calendrier').filter(function (c) { return c.annee_scolaire === annee && !c.class_id && c.type === 'vacances'; });
    if (!rs.length) return false;
    for (var i = 0; i < 5; i++) if (!blockedReason(addDays(mondayISO, i), rs)) return false;
    return true;
  }
  /* 1 ou 2 (null si le réglage n’existe pas) */
  function weekType(iso, annee) {
    var cfg = altConfig(annee); if (!cfg) return null;
    var ref = weekStart(cfg.lundi), w = weekStart(iso), n = 0, g = 0;
    var skip = cfg.v === 2 && cfg.sauter_vacances === true; /* par défaut : on suit l’ordre du calendrier, sans sauter de semaine */
    if (w > ref) { for (var x = ref; x < w && g++ < 120; x = addDays(x, 7)) if (!(skip && semainePause(x, annee))) n++; }
    else if (w < ref) { for (var y = w; y < ref && g++ < 120; y = addDays(y, 7)) if (!(skip && semainePause(y, annee))) n++; }
    return n % 2 === 0 ? cfg.type : 3 - cfg.type;
  }
  /* le créneau a-t-il lieu ce jour-là ? (semaine : 0 = toutes) */
  function slotOn(c, iso, annee) {
    if (!c.semaine) return true;
    var t = weekType(iso, annee);
    return t === null ? true : c.semaine === t;
  }
  function slotsFor(cl, groupe) {
    var cr = (cl.creneaux || []).filter(function (c) { return c.jour >= 1 && c.jour <= 6; });
    if (groupe === undefined) { var plein = cr.filter(function (c) { return !c.groupe; }); return plein.length ? plein : cr; }
    return cr.filter(function (c) { return !c.groupe || c.groupe === groupe; });
  }
  /* minutes par semaine type : { s1, s2, g1, g2 (créneaux en demi-groupe) } */
  function heuresHebdo(cl) {
    var o = { s1: 0, s2: 0, g1: 0, g2: 0, gs1: 0, gs2: 0 };
    (cl.creneaux || []).forEach(function (c) {
      var m = +c.duree || 0, gr = !!c.groupe;
      if (!c.semaine || c.semaine === 1) { if (gr) o.gs1 += m; else o.s1 += m; }
      if (!c.semaine || c.semaine === 2) { if (gr) o.gs2 += m; else o.s2 += m; }
    });
    return o;
  }
  /* créneaux d’un jour donné pour toutes les classes actives (hors vacances / jours bloqués) */
  function slotsOnDate(iso) {
    var dow = (parseISO(iso).getDay() + 6) % 7 + 1, out = [];
    Cls.actives().forEach(function (cl) {
      var rs = ranges(cl.id, cl.annee_scolaire); if (blockedReason(iso, rs)) return;
      (cl.creneaux || []).forEach(function (c) { if (c.jour === dow && slotOn(c, iso, cl.annee_scolaire)) out.push({ cl: cl, c: c }); });
    });
    return out.sort(function (a, b) { return a.c.debut < b.c.debut ? -1 : a.c.debut > b.c.debut ? 1 : 0; });
  }
  function libSemaine(n) { return n === 1 ? 'Semaine 1' : n === 2 ? 'Semaine 2' : 'Toutes les semaines'; }

  /* prochains créneaux de cours : [{date, debut, duree}] */
  function nextSlots(cl, afterISO, n, opts) {
    opts = opts || {};
    var cr = slotsFor(cl, opts.groupe);
    if (!cr.length) return [];
    var rs = ranges(cl.id, cl.annee_scolaire), out = [], d = afterISO, guard = 0;
    var lim = bornes(cl.annee_scolaire).fin;
    var used = {};
    (opts.avoid || []).forEach(function (iso) { used[iso] = (used[iso] || 0) + 1; });
    while (out.length < n && guard++ < 500) {
      d = addDays(d, 1); if (d > lim) break;
      var dow = (parseISO(d).getDay() + 6) % 7 + 1;
      cr.slice().sort(function (a, b) { return a.debut < b.debut ? -1 : 1; }).forEach(function (c) {
        if (c.jour === dow && !blockedReason(d, rs) && out.length < n && slotOn(c, d, cl.annee_scolaire)) {
          var k = d + '|' + c.debut;
          if (used[k]) { used[k]--; return; }
          out.push({ date: d, debut: c.debut, duree: c.duree });
        }
      });
    }
    return out;
  }
  /* heures de cours disponibles entre deux dates pour une classe */
  function heuresDispo(cl, from, to, groupe) {
    var cr = slotsFor(cl, groupe), rs = ranges(cl.id, cl.annee_scolaire), tot = 0, nb = 0, d = from, g = 0;
    while (d <= to && g++ < 500) {
      var dow = (parseISO(d).getDay() + 6) % 7 + 1;
      if (!blockedReason(d, rs)) cr.forEach(function (c) { if (c.jour === dow && slotOn(c, d, cl.annee_scolaire)) { tot += (+c.duree || 0); nb++; } });
      d = addDays(d, 1);
    }
    return { minutes: tot, creneaux: nb };
  }
  function semainesTravaillees(cl, from, to) {
    var rs = ranges(cl.id, cl.annee_scolaire), w = weekStart(from), n = 0, g = 0;
    while (w <= to && g++ < 80) {
      var ouvres = 0; for (var i = 0; i < 5; i++) if (!blockedReason(addDays(w, i), rs)) ouvres++;
      if (ouvres >= 3) n++;
      w = addDays(w, 7);
    }
    return n;
  }

  /* ── progression automatique ── */
  var STATUTS = [
    { v: 0, nom: 'Non commencé', court: '○', c: 'var(--s0)' },
    { v: 1, nom: 'En cours', court: '◔', c: 'var(--s1)' },
    { v: 2, nom: 'En révision', court: '◑', c: 'var(--s2)' },
    { v: 3, nom: 'Maîtrisé', court: '●', c: 'var(--s3)' }
  ];
  function seanceDate(s) { return s.date_realisee || s.date_prevue || null; }
  function compute(classId) {
    var M = {};
    function slot(ref) { return M[ref] || (M[ref] = { ref: ref, nbFaites: 0, nbPrevues: 0, first: null, last: null, next: null, minutes: 0, parents: [], auto: 0, evalue: false, maitrise: false, seqPrevue: false }); }
    DB.list('fs_sequences').filter(function (q) { return q.class_id === classId; }).forEach(function (q) {
      ((q.data && q.data.items) || []).forEach(function (it) { var m = slot(it.ref); m.seqPrevue = true; m.parents.push({ t: 'sequence', id: q.id, titre: q.titre }); });
    });
    DB.list('fs_seances').filter(function (s) { return s.class_id === classId && s.statut !== 'annulee'; }).forEach(function (s) {
      var items = (s.data && s.data.items) || []; var n = Math.max(items.length, 1);
      items.forEach(function (it) {
        var m = slot(it.ref);
        m.parents.push({ t: 'seance', id: s.id, titre: s.titre, statut: s.statut, date: seanceDate(s) });
        if (s.statut === 'faite') {
          m.nbFaites++; m.minutes += Math.round((s.duree_min || 0) / n);
          var d = seanceDate(s);
          if (d) { if (!m.first || d < m.first) m.first = d; if (!m.last || d > m.last) m.last = d; }
          if (it.niv === 'evaluation' || s.type === 'evaluation') m.evalue = true;
          if (it.niv === 'maitrise' || s.type === 'revision' || s.type === 'automatismes') m.maitrise = true;
        } else {
          m.nbPrevues++;
          if (s.date_prevue && (!m.next || s.date_prevue < m.next)) m.next = s.date_prevue;
        }
      });
    });
    var ov = {};
    DB.list('fs_progress_override').filter(function (o) { return o.class_id === classId; }).forEach(function (o) { ov[o.ref_id] = o; });
    Object.keys(M).forEach(function (k) {
      var m = M[k], v = 0;
      if (m.evalue) v = 3; else if (m.nbFaites >= 2 || (m.nbFaites >= 1 && m.maitrise)) v = 2; else if (m.nbFaites === 1) v = 1;
      m.statutAuto = v; m.statut = v;
    });
    Object.keys(ov).forEach(function (k) {
      var m = slot(k); m.override = ov[k]; m.statut = ov[k].statut; if (ov[k].date_realisation) m.first = m.first || ov[k].date_realisation;
    });
    return M;
  }
  function get(M, ref) { return M[ref] || { ref: ref, nbFaites: 0, nbPrevues: 0, minutes: 0, parents: [], statut: 0, statutAuto: 0, seqPrevue: false }; }
  function planifie(m) { return m.statut === 0 && (m.nbPrevues > 0 || m.seqPrevue); }

  /* statistiques d’un chapitre : part d’objectifs vus (≥1) et maîtrisés (3) */
  function chapStats(M, chap) {
    var its = chap.objectifs.concat(chap.connaissances), tot = its.length, vus = 0, maitr = 0, plan = 0, min = 0;
    its.forEach(function (it) { var m = get(M, it.id); if (m.statut >= 1) vus++; if (m.statut === 3) maitr++; if (planifie(m)) plan++; min += m.minutes; });
    return { total: tot, vus: vus, maitrises: maitr, planifies: plan, minutes: min };
  }

  return { altConfig: altConfig, setAltConfig: setAltConfig, weekType: weekType, semainePause: semainePause, slotOn: slotOn, slotsFor: slotsFor, heuresHebdo: heuresHebdo, slotsOnDate: slotsOnDate, libSemaine: libSemaine, PRESETS: PRESETS, bornes: bornes, ranges: ranges, blockedReason: blockedReason, nextSlots: nextSlots, heuresDispo: heuresDispo, semainesTravaillees: semainesTravaillees, STATUTS: STATUTS, compute: compute, get: get, planifie: planifie, chapStats: chapStats, seanceDate: seanceDate };
})();
