/* Faux Supabase (auth + PostgREST + storage) pour les tests de bout en bout, via page.route */
'use strict';
const URL_BASE = 'https://zfqzvwpjxmrlctxsmxch.supabase.co';
const TABLES = ['fs_classes', 'fs_sequences', 'fs_seances', 'fs_ref_perso', 'fs_ressources', 'fs_attachments', 'fs_calendrier', 'fs_progress_override', 'fs_modeles', 'fs_items'];
function makeState() {
  const st = { rows: {}, settings: null, files: {}, log: [], failNext: null, missingTables: false, users: { 'prof@test.fr': { id: '11111111-1111-4111-8111-111111111111', pw: 'secret12' } } };
  TABLES.forEach((t) => { st.rows[t] = []; });
  return st;
}
const json = (status, body, extra) => ({ status, contentType: 'application/json', headers: Object.assign({ 'access-control-allow-origin': '*' }, extra || {}), body: JSON.stringify(body) });
async function install(context, st) {
  await context.route(URL_BASE + '/**', async (route) => {
    const req = route.request(), u = new URL(req.url()), p = u.pathname, m = req.method();
    if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    st.log.push(m + ' ' + p + u.search.slice(0, 60));
    if (st.failNext) { const f = st.failNext; st.failNext = null; return route.fulfill(json(f.status || 500, { message: f.message || 'boom' })); }
    if (p === '/auth/v1/token') {
      const b = JSON.parse(req.postData() || '{}');
      if (u.searchParams.get('grant_type') === 'password') {
        const us = st.users[b.email];
        if (!us || us.pw !== b.password) return route.fulfill(json(400, { error_description: 'Invalid login credentials' }));
        return route.fulfill(json(200, { access_token: 'tok', refresh_token: 'ref', expires_in: 3600, user: { id: us.id, email: b.email } }));
      }
      return route.fulfill(json(200, { access_token: 'tok2', refresh_token: 'ref2', expires_in: 3600, user: { id: st.users['prof@test.fr'].id, email: 'prof@test.fr' } }));
    }
    if (p === '/auth/v1/logout') return route.fulfill({ status: 204, body: '' });
    if (p.startsWith('/rest/v1/rpc/')) {
      const name = p.split('/').pop(), b = JSON.parse(req.postData() || '{}');
      if (name === 'fs_set_items') { st.rows.fs_items = st.rows.fs_items.filter((r) => r.parent_id !== b.p_parent_id); (b.p_items || []).forEach((it) => st.rows.fs_items.push(Object.assign({ parent_id: b.p_parent_id, class_id: b.p_class_id }, it))); return route.fulfill(json(200, (b.p_items || []).length)); }
      if (name === 'fs_effacer_mes_donnees') { const paths = st.rows.fs_ressources.filter((r) => r.storage_path).map((r) => r.storage_path); TABLES.forEach((t) => { st.rows[t] = []; }); st.settings = null; return route.fulfill(json(200, paths)); }
      return route.fulfill(json(404, { message: 'no rpc' }));
    }
    if (p.startsWith('/rest/v1/')) {
      const t = p.split('/')[3];
      if (st.missingTables) return route.fulfill(json(404, { code: 'PGRST205', message: "Could not find the table 'public." + t + "' in the schema cache" }));
      if (t === 'fs_settings') {
        if (m === 'GET') return route.fulfill(json(200, st.settings ? [st.settings] : []));
        if (m === 'POST') { const rows = JSON.parse(req.postData()); st.settings = Object.assign({}, st.settings, rows[0]); return route.fulfill({ status: 201, headers: { 'access-control-allow-origin': '*' }, body: '' }); }
      }
      if (!st.rows[t]) return route.fulfill(json(404, { message: 'unknown table ' + t }));
      if (m === 'GET') return route.fulfill(json(200, st.rows[t].slice()));
      if (m === 'POST') {
        const rows = JSON.parse(req.postData());
        for (const r of rows) {
          if (!r.id) return route.fulfill(json(400, { message: 'id manquant' }));
          const i = st.rows[t].findIndex((x) => x.id === r.id);
          if (i >= 0) st.rows[t][i] = Object.assign({}, st.rows[t][i], r); else st.rows[t].push(Object.assign({}, r));
        }
        return route.fulfill({ status: 201, headers: { 'access-control-allow-origin': '*' }, body: '' });
      }
      if (m === 'DELETE') {
        const id = (u.searchParams.get('id') || '').replace('eq.', '');
        st.rows[t] = st.rows[t].filter((x) => x.id !== id);
        if (t === 'fs_classes') ['fs_sequences', 'fs_seances', 'fs_calendrier', 'fs_progress_override'].forEach((c) => { st.rows[c] = st.rows[c].filter((x) => x.class_id !== id); });
        return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' }, body: '' });
      }
    }
    if (p.startsWith('/storage/v1/object/sign/')) return route.fulfill(json(200, { signedURL: '/object/sign/x?token=abc' }));
    if (p.startsWith('/storage/v1/object/fiches-ressources/') && m === 'POST') { st.files[decodeURIComponent(p)] = req.postDataBuffer() ? req.postDataBuffer().length : 0; return route.fulfill(json(200, { Key: 'ok' })); }
    if (p.startsWith('/storage/v1/object/fiches-ressources') && m === 'DELETE') return route.fulfill(json(200, []));
    return route.fulfill(json(404, { message: 'mock: route inconnue ' + m + ' ' + p }));
  });
}
module.exports = { install, makeState, URL_BASE };
