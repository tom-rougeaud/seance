/* ═══ FICHES · client Supabase minimal (REST, sans bibliothèque ni CDN) ═══ */
'use strict';
var Api = (function () {
  var CFG = (typeof FICHES_CONFIG !== 'undefined') ? FICHES_CONFIG : { SUPABASE_URL: '', SUPABASE_ANON_KEY: '' };
  var session = null, listeners = [], refreshing = null;

  function configured() { return !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && CFG.SUPABASE_URL.indexOf('http') === 0); }
  function onAuth(fn) { listeners.push(fn); }
  function emit() { listeners.forEach(function (f) { try { f(session); } catch (e) { /* ignoré */ } }); }
  function setSession(s) {
    session = s;
    if (s) Store.setJSON('session', { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at, user: s.user });
    else Store.del('session');
    emit();
  }
  function fromToken(j) {
    var exp = j.expires_at || (Math.floor(Date.now() / 1000) + (j.expires_in || 3600));
    return { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: exp, user: j.user || (session && session.user) || null };
  }
  function restore() { var s = Store.getJSON('session', null); if (s && s.access_token && s.user) { session = s; return true; } return false; }
  function user() { return session && session.user; }
  function uidNow() { return session && session.user && session.user.id; }

  function headers(extra, noAuth) {
    var h0 = { apikey: CFG.SUPABASE_ANON_KEY };
    h0.Authorization = 'Bearer ' + ((!noAuth && session) ? session.access_token : CFG.SUPABASE_ANON_KEY);
    if (extra) for (var k in extra) h0[k] = extra[k];
    return h0;
  }
  function netErr(e) { var x = new Error('Réseau indisponible'); x.network = true; x.cause = e; return x; }
  function httpErr(r, body) {
    var msg = (body && (body.message || body.msg || body.error_description || body.error || body.hint)) || ('Erreur ' + r.status);
    var x = new Error(msg); x.status = r.status; x.body = body; return x;
  }
  function readBody(r) { return r.text().then(function (t) { if (!t) return null; try { return JSON.parse(t); } catch (e) { return t; } }); }

  function ensureFresh() {
    if (!session) return Promise.resolve();
    if (session.expires_at - Math.floor(Date.now() / 1000) > 60) return Promise.resolve();
    return refresh();
  }
  function refresh() {
    if (refreshing) return refreshing;
    if (!session || !session.refresh_token) return Promise.reject(new Error('Session expirée'));
    refreshing = fetch(CFG.SUPABASE_URL + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST', headers: headers({ 'Content-Type': 'application/json' }, true), body: JSON.stringify({ refresh_token: session.refresh_token })
    }).then(function (r) { return readBody(r).then(function (b) { if (!r.ok) { if (r.status >= 400 && r.status < 500) { setSession(null); } throw httpErr(r, b); } setSession(fromToken(b)); }); },
      function (e) { throw netErr(e); })
      .then(function (v) { refreshing = null; return v; }, function (e) { refreshing = null; throw e; });
    return refreshing;
  }

  /* requête générique avec rafraîchissement automatique du jeton */
  function call(path, opt, retried) {
    opt = opt || {};
    return ensureFresh().then(function () {
      return fetch(CFG.SUPABASE_URL + path, { method: opt.method || 'GET', headers: headers(opt.headers), body: opt.body }).then(function (r) {
        return readBody(r).then(function (b) {
          if (r.status === 401 && !retried && session) return refresh().then(function () { return call(path, opt, true); });
          if (!r.ok) throw httpErr(r, b);
          return b;
        });
      }, function (e) { throw netErr(e); });
    });
  }

  function redirectQs() { try { if (/^https?:$/.test(location.protocol)) return '?redirect_to=' + encodeURIComponent(location.origin + location.pathname); } catch (e) { /* ignoré */ } return ''; }
  /* retour d’un lien reçu par e-mail (confirmation, réinitialisation) : jetons dans le fragment de l’adresse */
  function sessionFromHash(hash) {
    var p = new URLSearchParams(String(hash || '').replace(/^#\/?/, ''));
    if (p.get('error_description') || p.get('error')) return Promise.reject(new Error((p.get('error_description') || p.get('error')).replace(/\+/g, ' ')));
    var at = p.get('access_token'); if (!at) return Promise.resolve(null);
    var s = { access_token: at, refresh_token: p.get('refresh_token'), expires_at: Math.floor(Date.now() / 1000) + (+p.get('expires_in') || 3600), user: null };
    session = s;
    return call('/auth/v1/user').then(function (u) { s.user = u; setSession(s); return { type: p.get('type') || '' }; }, function (e) { session = null; throw e; });
  }
  var auth = {
    signIn: function (email, password) {
      return fetch(CFG.SUPABASE_URL + '/auth/v1/token?grant_type=password', { method: 'POST', headers: headers({ 'Content-Type': 'application/json' }, true), body: JSON.stringify({ email: email, password: password }) })
        .then(function (r) { return readBody(r).then(function (b) { if (!r.ok) throw httpErr(r, b); setSession(fromToken(b)); return session; }); }, function (e) { throw netErr(e); });
    },
    signUp: function (email, password) {
      return fetch(CFG.SUPABASE_URL + '/auth/v1/signup' + redirectQs(), { method: 'POST', headers: headers({ 'Content-Type': 'application/json' }, true), body: JSON.stringify({ email: email, password: password }) })
        .then(function (r) { return readBody(r).then(function (b) { if (!r.ok) throw httpErr(r, b); if (b && b.access_token) { setSession(fromToken(b)); return { connected: true }; } return { connected: false }; }); }, function (e) { throw netErr(e); });
    },
    recover: function (email) {
      return fetch(CFG.SUPABASE_URL + '/auth/v1/recover' + redirectQs(), { method: 'POST', headers: headers({ 'Content-Type': 'application/json' }, true), body: JSON.stringify({ email: email }) })
        .then(function (r) { return readBody(r).then(function (b) { if (!r.ok) throw httpErr(r, b); return true; }); }, function (e) { throw netErr(e); });
    },
    signOut: function () {
      var p = session ? fetch(CFG.SUPABASE_URL + '/auth/v1/logout', { method: 'POST', headers: headers() }).catch(function () { /* ignoré */ }) : Promise.resolve();
      return p.then(function () { setSession(null); });
    },
    check: function () { return call('/auth/v1/user'); },
    updatePassword: function (pw) { return call('/auth/v1/user', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) }); },
    fromHash: sessionFromHash
  };

  /* PostgREST */
  function qs(params) {
    var out = [];
    for (var k in params) { if (params[k] !== undefined && params[k] !== null) out.push(encodeURIComponent(k) + '=' + encodeURIComponent(params[k])); }
    return out.length ? '?' + out.join('&') : '';
  }
  var rest = {
    select: function (table, params) { return call('/rest/v1/' + table + qs(Object.assign({ select: '*' }, params || {})), { headers: { Accept: 'application/json' } }); },
    selectAll: function (table, params) {
      var all = [], size = 1000;
      function page(from) {
        return call('/rest/v1/' + table + qs(Object.assign({ select: '*' }, params || {})), { headers: { Accept: 'application/json', Range: from + '-' + (from + size - 1), 'Range-Unit': 'items' } })
          .then(function (rows) { rows = rows || []; all = all.concat(rows); return rows.length === size ? page(from + size) : all; });
      }
      return page(0);
    },
    upsert: function (table, rows) { return call('/rest/v1/' + table + '?on_conflict=' + (table === 'fs_settings' ? 'user_id' : 'id'), { method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows) }); },
    remove: function (table, id) { return call('/rest/v1/' + table + '?id=eq.' + encodeURIComponent(id), { method: 'DELETE', headers: { Prefer: 'return=minimal' } }); },
    rpc: function (name, args) { return call('/rest/v1/rpc/' + name, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(args || {}) }); }
  };

  /* Stockage */
  var BUCKET = 'fiches-ressources';
  var storage = {
    upload: function (path, file) {
      return call('/storage/v1/object/' + BUCKET + '/' + path.split('/').map(encodeURIComponent).join('/'), { method: 'POST', headers: { 'Content-Type': file.type || 'application/octet-stream', 'x-upsert': 'false', 'cache-control': '3600' }, body: file });
    },
    signedUrl: function (path, secs) {
      return call('/storage/v1/object/sign/' + BUCKET + '/' + path.split('/').map(encodeURIComponent).join('/'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: secs || 3600 }) })
        .then(function (b) { var u = b && (b.signedURL || b.signedUrl); if (!u) throw new Error('Lien indisponible'); return CFG.SUPABASE_URL + '/storage/v1' + (u.charAt(0) === '/' ? '' : '/') + u; });
    },
    remove: function (paths) {
      if (!paths || !paths.length) return Promise.resolve();
      return call('/storage/v1/object/' + BUCKET, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: paths }) });
    }
  };

  return { configured: configured, onAuth: onAuth, restore: restore, user: user, uid: uidNow, auth: auth, rest: rest, storage: storage, call: call, session: function () { return session; }, refresh: refresh };
})();
