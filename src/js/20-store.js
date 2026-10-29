/* ═══ FICHES · données en mémoire, file d’attente d’enregistrement, hors connexion ═══ */
'use strict';
var DB = (function () {
  var TABLES = {
    fs_classes: ['id', 'user_id', 'nom', 'niveau_id', 'groupement', 'avec_pc', 'poursuite', 'metier', 'annee_scolaire', 'couleur', 'creneaux', 'notes', 'archive', 'ordre'],
    fs_sequences: ['id', 'user_id', 'class_id', 'ordre', 'titre', 'statut', 'date_debut', 'date_fin', 'data'],
    fs_seances: ['id', 'user_id', 'class_id', 'sequence_id', 'jumelle_id', 'ordre', 'titre', 'type', 'modalite', 'groupe', 'duree_min', 'date_prevue', 'date_realisee', 'statut', 'data'],
    fs_ref_perso: ['id', 'user_id', 'action', 'niveau_id', 'chapitre_id', 'kind', 'ref_id', 'domaine', 'txt', 'ordre'],
    fs_ressources: ['id', 'user_id', 'type', 'titre', 'url', 'storage_path', 'mime', 'taille', 'tags', 'note'],
    fs_attachments: ['id', 'user_id', 'parent_type', 'parent_id', 'ressource_id', 'usage', 'ordre', 'note'],
    fs_calendrier: ['id', 'user_id', 'annee_scolaire', 'class_id', 'type', 'label', 'debut', 'fin'],
    fs_progress_override: ['id', 'user_id', 'class_id', 'ref_id', 'statut', 'date_realisation', 'note'],
    fs_modeles: ['id', 'user_id', 'kind', 'titre', 'niveau_id', 'data']
  };
  /* ordre de chargement / d’import (parents avant enfants) */
  var ORDER = ['fs_classes', 'fs_sequences', 'fs_seances', 'fs_ressources', 'fs_attachments', 'fs_ref_perso', 'fs_calendrier', 'fs_progress_override', 'fs_modeles'];
  var T = {}; ORDER.forEach(function (t) { T[t] = []; });
  var settings = {};
  var queue = Store.getJSON('queue', []);
  var failed = Store.getJSON('failed', []);
  var state = { online: navigator.onLine !== false, flushing: false, listeners: [], lastOk: null };
  var timer = null;

  function onSync(fn) { state.listeners.push(fn); }
  function notify() { state.listeners.forEach(function (f) { try { f(syncInfo()); } catch (e) { /* ignoré */ } }); }
  function syncInfo() { return { pending: queue.length, failed: failed.length, online: state.online, flushing: state.flushing, lastOk: state.lastOk }; }
  function persistQueue() { Store.setJSON('queue', queue); Store.setJSON('failed', failed); }

  function pick(table, row) { var o = {}; TABLES[table].forEach(function (c) { if (row[c] !== undefined) o[c] = row[c]; }); return o; }
  function byId(table, id) { var a = T[table]; for (var i = 0; i < a.length; i++) if (a[i].id === id) return a[i]; return null; }
  function list(table) { return T[table]; }

  /* ── file d’attente : une entrée par ligne (la dernière version gagne) ── */
  function enqueue(op) {
    var key = op.t + ':' + op.table + ':' + (op.id || op.parent_id || '');
    op.key = key;
    if (op.t === 'up' || op.t === 'items') { queue = queue.filter(function (o) { return o.key !== key; }); }
    if (op.t === 'del') { queue = queue.filter(function (o) { return !(o.table === op.table && o.id === op.id && (o.t === 'up')); }); }
    queue.push(op); persistQueue(); notify(); schedule(600);
  }
  function schedule(ms) { clearTimeout(timer); timer = setTimeout(flush, ms); }

  function runOp(op) {
    if (op.t === 'up') return Api.rest.upsert(op.table, [op.row]);
    if (op.t === 'del') return Api.rest.remove(op.table, op.id);
    if (op.t === 'items') return Api.rest.rpc('fs_set_items', { p_parent_type: op.parent_type, p_parent_id: op.parent_id, p_class_id: op.class_id, p_items: op.items });
    return Promise.resolve();
  }
  function flush() {
    if (state.flushing || !queue.length || !Api.uid()) return Promise.resolve();
    if (!state.online) { notify(); return Promise.resolve(); }
    state.flushing = true; notify();
    function next() {
      if (!queue.length) { state.flushing = false; state.lastOk = Date.now(); persistQueue(); notify(); return Promise.resolve(); }
      var op = queue[0];
      return runOp(op).then(function () { queue.shift(); persistQueue(); return next(); }, function (e) {
        if (e && e.network) { state.online = false; state.flushing = false; notify(); schedule(15000); return; }
        if (e && e.status === 401) { state.flushing = false; notify(); return; }
        /* erreur définitive : on met l’opération de côté pour ne pas bloquer le reste */
        queue.shift(); failed.push({ op: op, msg: String(e && e.message || e), at: Date.now() }); if (failed.length > 30) failed.shift();
        persistQueue(); return next();
      });
    }
    return next();
  }
  window.addEventListener('online', function () { state.online = true; notify(); schedule(300); });
  window.addEventListener('offline', function () { state.online = false; notify(); });

  /* ── lecture / écriture locale ── */
  function save(table, row) {
    row.user_id = Api.uid() || row.user_id;
    var i = T[table].findIndex(function (r) { return r.id === row.id; });
    if (i < 0) T[table].push(row); else T[table][i] = row;
    cacheWrite();
    var payload = pick(table, row);
    if (table === 'fs_settings') return;
    enqueue({ t: 'up', table: table, id: row.id, row: payload });
    if ((table === 'fs_seances' || table === 'fs_sequences') && row.data) {
      enqueue({ t: 'items', table: 'fs_items', parent_type: table === 'fs_seances' ? 'seance' : 'sequence', parent_id: row.id, class_id: row.class_id, items: (row.data.items || []).map(function (it) { return { kind: it.k, ref: it.ref, txt: it.txt, niveau: it.niv || 'entrainement' }; }) });
    }
    return row;
  }
  function create(table, row) {
    row.id = row.id || uid(); row.user_id = Api.uid();
    return save(table, row);
  }
  function remove(table, id) {
    var orphan = [];
    function dropAtt(pred) { T.fs_attachments = T.fs_attachments.filter(function (a) { if (pred(a)) { orphan.push(a.id); return false; } return true; }); }
    T[table] = T[table].filter(function (r) { return r.id !== id; });
    /* suppression en cascade côté mémoire (la base le fait elle-même, sauf pour les pièces jointes) */
    if (table === 'fs_classes') {
      var seqIds = T.fs_sequences.filter(function (r) { return r.class_id === id; }).map(function (r) { return r.id; });
      var seaIds = T.fs_seances.filter(function (r) { return r.class_id === id; }).map(function (r) { return r.id; });
      ['fs_sequences', 'fs_seances', 'fs_calendrier', 'fs_progress_override'].forEach(function (t) { T[t] = T[t].filter(function (r) { return r.class_id !== id; }); });
      dropAtt(function (a) { return seqIds.indexOf(a.parent_id) >= 0 || seaIds.indexOf(a.parent_id) >= 0; });
    }
    if (table === 'fs_sequences') T.fs_seances.forEach(function (s) { if (s.sequence_id === id) s.sequence_id = null; });
    if (table === 'fs_seances' || table === 'fs_sequences') dropAtt(function (a) { return a.parent_id === id; });
    if (table === 'fs_ressources') T.fs_attachments = T.fs_attachments.filter(function (a) { return a.ressource_id !== id; });
    cacheWrite();
    enqueue({ t: 'del', table: table, id: id });
    orphan.forEach(function (aid) { enqueue({ t: 'del', table: 'fs_attachments', id: aid }); });
  }

  function saveSettings(patch) {
    settings = Object.assign({}, settings, patch);
    cacheWrite();
    queue = queue.filter(function (o) { return o.key !== 'up:fs_settings:'; });
    enqueue({ t: 'up', table: 'fs_settings', id: '', row: { user_id: Api.uid(), data: settings } });
  }

  /* ── cache local (lecture hors connexion) ── */
  function cacheWrite() { cacheSoon(); }
  var cacheSoon = debounce(function () {
    var uidv = Api.uid(); if (!uidv) return;
    Store.setJSON('cache_' + uidv, { t: T, settings: settings, at: Date.now() });
  }, 400);
  function cacheRead() {
    var c = Store.getJSON('cache_' + Api.uid(), null);
    if (!c || !c.t) return false;
    ORDER.forEach(function (t) { T[t] = c.t[t] || []; }); settings = c.settings || {}; return true;
  }

  function loadAll() {
    var uidv = Api.uid();
    return flush().then(function () {
      return Promise.all(ORDER.map(function (t) { return Api.rest.selectAll(t, { order: (t === 'fs_progress_override' ? 'updated_at' : 'created_at') + '.asc' }); }).concat([Api.rest.select('fs_settings', {})]));
    }).then(function (res) {
      ORDER.forEach(function (t, i) {
        var remote = res[i] || [];
        /* conserver les lignes locales encore en attente d’envoi */
        queue.forEach(function (o) {
          if (o.t === 'up' && o.table === t) { var k = remote.findIndex(function (r) { return r.id === o.id; }); if (k >= 0) remote[k] = o.row; else remote.push(o.row); }
          if (o.t === 'del' && o.table === t) remote = remote.filter(function (r) { return r.id !== o.id; });
        });
        T[t] = remote;
      });
      settings = (res[ORDER.length] && res[ORDER.length][0] && res[ORDER.length][0].data) || settings || {};
      cacheWrite(); state.online = true; notify(); return true;
    }).catch(function (e) {
      if (e && e.network) { state.online = false; var ok = cacheRead(); notify(); if (ok) return 'cache'; }
      throw e;
    });
  }

  function reset() { ORDER.forEach(function (t) { T[t] = []; }); settings = {}; queue = []; failed = []; persistQueue(); Store.del('cache_' + Api.uid()); }

  /* import brut (déjà validé) : remplace / ajoute puis met en file */
  function bulkPut(table, rows) { rows.forEach(function (r) { r.user_id = Api.uid(); save(table, r); }); }

  return {
    TABLES: TABLES, ORDER: ORDER, T: T, list: list, byId: byId, save: save, create: create, remove: remove, loadAll: loadAll, flush: flush,
    onSync: onSync, syncInfo: syncInfo, settings: function () { return settings; }, saveSettings: saveSettings, reset: reset, bulkPut: bulkPut,
    failed: function () { return failed; }, clearFailed: function () { failed = []; persistQueue(); notify(); }, pending: function () { return queue.length; }, pick: pick
  };
})();
