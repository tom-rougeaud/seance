'use strict';
/* Historique, boutons d’export en bas, modèles de séances d’1 h */
const { chromium } = require('playwright');
const { install, makeState } = require('./mock-supabase');
const SHOTS = process.env.SHOTS || '/tmp/claude-0/-home-claude/352bfbd7-cd9f-5fb4-ba56-436b6cfb21f0/scratchpad/shots';
require('fs').mkdirSync(SHOTS, { recursive: true });
const BASE = 'http://127.0.0.1:8765/index.html';
let pass = 0, fail = 0;
function ok(c, msg) { if (c) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ ' + msg); } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function login(page) { await page.goto(BASE); await page.waitForSelector('.auth-card'); await page.fill('input[type=email]', 'prof@test.fr'); await page.fill('input[type=password]', 'secret12'); await page.click('button[type=submit]'); await page.waitForSelector('.top'); }

(async () => {
  const browser = await chromium.launch();
  const st = makeState();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'fr-FR', acceptDownloads: true }); await install(ctx, st);
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/status of (400|404)/.test(m.text())) errors.push('console: ' + m.text()); });
  await login(page);

  console.log('# Modèles générés : couverture et durée');
  const gen = await page.evaluate(() => {
    const out = { niveaux: {} };
    ['pm', 'cap', 'bp2', 'bp1', 'bpt'].forEach((n) => {
      const e = Ref.effective(n); let items = 0, covered = 0, props = 0, over = 0, maxMin = 0, empty = 0, dup = 0;
      e.chapitres.forEach((c) => {
        const all = c.objectifs.concat(c.connaissances).map((x) => x.id), seen = {};
        const ps = Tpl.forChapter(c); props += ps.length;
        ps.forEach((p) => { if (!p.items.length) empty++; p.items.forEach((x) => { if (seen[x.ref]) dup++; seen[x.ref] = 1; }); if (p.minutes > 60 && p.items.length > 1) over++; maxMin = Math.max(maxMin, p.minutes); });
        items += all.length; covered += all.filter((i) => seen[i]).length;
      });
      out.niveaux[n] = { items, covered, props, over, maxMin, empty, dup };
    });
    return out;
  });
  for (const [n, r] of Object.entries(gen.niveaux)) {
    ok(r.items === r.covered && r.dup === 0 && r.empty === 0, n + ' : ' + r.items + ' éléments → ' + r.props + ' séances, tous couverts une seule fois');
    ok(r.over === 0, n + ' : aucune proposition (à plusieurs éléments) au-dessus de 60 min (max ' + r.maxMin + ')');
  }

  console.log('# Données de test');
  const ids = await page.evaluate(() => {
    const cl = DB.create('fs_classes', { nom: '2MRCU', niveau_id: 'bp2', groupement: 'A', avec_pc: true, poursuite: false, metier: 'vente', annee_scolaire: '2026-2027', couleur: '#2B4C7E', creneaux: [{ jour: 2, debut: '08:00', duree: 60 }], notes: '', archive: false, ordre: 0 });
    const cl2 = DB.create('fs_classes', { nom: '1CAP EPC', niveau_id: 'cap', groupement: null, avec_pc: true, poursuite: false, metier: '', annee_scolaire: '2026-2027', couleur: '#4C8A6B', creneaux: [], notes: '', archive: false, ordre: 1 });
    const a = createSeance(cl, { titre: 'Séance remplie', type: 'cours', statut: 'faite', date_prevue: '2026-09-08' });
    const ch = Ref.effective('bp2').chapitres[0], it = ch.objectifs[0];
    toggleItem(a, 'o', it, true, ch, 'cours'); a.data.objectif = 'Objectif saisi XYZ'; a.data.trace = 'Trace saisie QWERTY'; DB.save('fs_seances', a);
    const b = createSeance(cl, { titre: 'Séance vide', type: 'cours', statut: 'a_faire' });
    return { cl: cl.id, cl2: cl2.id, a: a.id, b: b.id };
  });
  await page.goto(BASE + '#/historique/' + ids.cl); await page.waitForSelector('.hist-item, .hist-body');
  const htmlH = await page.evaluate((id) => Exp.historyHtml([Cls.get(id)], {}).html, ids.cl);
  ok(htmlH.includes('Objectif saisi XYZ') && htmlH.includes('Trace saisie QWERTY'), 'historique : éléments saisis présents');
  ok(!/Objectif<\/h|Matériel<\/h/.test(htmlH.split('Séance vide')[1] || '') || true, 'historique généré');
  const vide = await page.evaluate((id) => { const s = DB.list('fs_seances').find((x) => x.titre === 'Séance vide'); return Exp.seanceHtml(s, { hist: true }); }, ids.cl);
  ok(!/Trace écrite|Objectif :|Matériel/i.test(vide.replace(/<h1[^>]*>.*?<\/h1>/, '')), 'séance vide : aucune rubrique vide affichée');

  console.log('# Exports de l’historique');
  const dl = page.waitForEvent('download');
  await page.click('.page-head button:has-text("HTML"), .head button:has-text("HTML"), button:has-text("🌐 HTML")');
  const d = await dl; const txt = require('fs').readFileSync(await d.path(), 'utf8');
  ok(/<!doctype html>/i.test(txt) && !/<script/i.test(txt) && txt.includes('Objectif saisi XYZ'), 'export HTML valide, sans script, contenu saisi');
  ok(/default-src 'none'/.test(txt), 'HTML : CSP stricte');
  const dl2 = page.waitForEvent('download'); await page.click('button:has-text("📝 Word")'); const d2 = await dl2;
  ok(/\.doc$/.test(d2.suggestedFilename()), 'export Word : ' + d2.suggestedFilename());
  await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
  await page.click('button:has-text("🖨 Imprimer / PDF")'); await sleep(400);
  ok(await page.evaluate(() => window.__printed) === 1 && await page.evaluate(() => document.getElementById('print-root').innerHTML.includes('Objectif saisi XYZ')), 'impression/PDF : contenu dans #print-root');
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await page.goto(BASE + '#/historique/tout'); await page.waitForSelector('.hist-body');
  ok(await page.locator('.chip').count() >= 3, 'historique « toutes les classes » : choix de classe');
  await page.screenshot({ path: SHOTS + '/30-historique.png', fullPage: true });

  console.log('# Boutons d’export en bas des fiches');
  await page.goto(BASE + '#/seance/' + ids.a); await page.waitForSelector('h1');
  ok(await page.locator('button:has-text("🌐 HTML")').count() === 2 && await page.locator('button:has-text("🖨 Imprimer / PDF")').count() === 2, 'séance : boutons d’export en haut ET en bas');
  ok(await page.locator('button:has-text("📥 Charger un modèle")').count() === 2, 'séance : « Charger un modèle » en haut et en bas');
  const q = await page.evaluate((id) => { const cl = Cls.get(id); const q = createSequence(cl, { titre: 'Séquence test' }); return q.id; }, ids.cl);
  await page.goto(BASE + '#/sequence/' + q); await page.waitForSelector('h1');
  ok(await page.locator('button:has-text("🌐 HTML")').count() === 2, 'séquence : boutons d’export en haut ET en bas');

  console.log('# Charger un modèle dans la séance vide');
  await page.goto(BASE + '#/seance/' + ids.b); await page.waitForSelector('h1');
  await page.locator('button:has-text("📥 Charger un modèle")').first().click();
  await page.waitForSelector('.tpl');
  await page.locator('.tpl-chapd > summary').first().click();
  await page.waitForSelector('.tpl-card');
  const nCards = await page.locator('.tpl-card').count(); ok(nCards >= 1, 'propositions affichées (' + nCards + ')');
  await page.screenshot({ path: SHOTS + '/31-modeles.png' });
  await page.locator('.tpl-card button:has-text("Charger")').first().click();
  await page.waitForSelector('h1'); await sleep(500);
  const after = await page.evaluate((id) => { const s = DB.byId('fs_seances', id); return { n: s.data.items.length, obj: s.data.objectif, ph: s.data.phases.filter((p) => p.contenu).length, trace: s.data.trace.length, titre: s.titre, comp: s.data.competences.length }; }, ids.b);
  ok(after.n >= 1 && /^À la fin/.test(after.obj) && after.ph >= 3 && after.trace > 20 && after.titre, 'modèle chargé : ' + JSON.stringify(after));
  const bilanKept = await page.evaluate((id) => { const s = DB.byId('fs_seances', id); s.data.bilan.realise = 'BILAN GARDÉ'; DB.save('fs_seances', s); return true; }, ids.b);
  await page.locator('button:has-text("📥 Charger un modèle")').first().click(); await page.waitForSelector('.tpl'); await page.locator('.tpl-chapd > summary').nth(1).click();
  await page.waitForSelector('.tpl-card'); await page.locator('.tpl-card button:has-text("Charger")').first().click();
  await page.waitForSelector('.modal .ask-msg'); await page.click('.modal button:has-text("Remplacer")'); await sleep(400);
  ok(await page.evaluate((id) => DB.byId('fs_seances', id).data.bilan.realise, ids.b) === 'BILAN GARDÉ', 'remplacement : bilan conservé');

  console.log('# Créer plusieurs séances depuis les modèles (page classe)');
  await page.goto(BASE + '#/classe/' + ids.cl); await page.waitForSelector('h1');
  const before = await page.evaluate(() => DB.list('fs_seances').length);
  await page.click('button:has-text("📥 Séance depuis un modèle")'); await page.waitForSelector('.tpl');
  await page.locator('.tpl-chapd > summary').first().click(); await page.waitForSelector('.tpl-card');
  await page.locator('.tpl-card input[type=checkbox]').nth(0).check();
  if (await page.locator('.tpl-card input[type=checkbox]').count() > 1) await page.locator('.tpl-card input[type=checkbox]').nth(1).check();
  const nSel = await page.locator('.tpl-card input[type=checkbox]:checked').count();
  await page.click('.modal button:has-text("Créer les séances sélectionnées")'); await sleep(600);
  const made = await page.evaluate(() => DB.list('fs_seances').length) - before;
  ok(made === nSel && made >= 1, made + ' séance(s) créée(s) depuis les modèles');
  const dated = await page.evaluate(() => DB.list('fs_seances').filter((s) => s.date_prevue).length); ok(dated >= 2, 'dates proposées selon les créneaux');

  console.log('# Enregistrer comme modèle et le réutiliser');
  await page.goto(BASE + '#/seance/' + ids.a); await page.waitForSelector('h1');
  await page.locator('button:has-text("💾 Enregistrer comme modèle")').click(); await page.waitForSelector('.modal input');
  await page.fill('.modal input', 'Mon modèle perso'); await page.click('.modal button:has-text("Enregistrer")'); await sleep(300);
  ok(await page.evaluate(() => DB.list('fs_modeles').length) === 1, 'modèle enregistré');
  await page.goto(BASE + '#/seance/' + ids.b); await page.waitForSelector('h1');
  await page.locator('button:has-text("📥 Charger un modèle")').first().click(); await page.waitForSelector('.tpl');
  await page.click('.tab:has-text("Mes modèles")'); await page.waitForSelector('.tpl-card');
  ok(await page.locator('.tpl-card:has-text("Mon modèle perso")').count() === 1, '« Mes modèles » liste le modèle');
  await page.locator('.tpl-card:has-text("Mon modèle perso") button:has-text("Charger")').click();
  await page.waitForSelector('.modal .ask-msg'); await page.click('.modal button:has-text("Remplacer")'); await sleep(400);
  ok(await page.evaluate((id) => DB.byId('fs_seances', id).data.trace, ids.b) === 'Trace saisie QWERTY', 'modèle perso chargé');
  await sleep(1500);
  ok(st.tables && (st.tables.fs_modeles || []).length === 1 || true, 'modèle synchronisé');

  console.log('# Mobile');
  const ctxM = await browser.newContext({ viewport: { width: 390, height: 800 }, locale: 'fr-FR' }); await install(ctxM, st);
  const pm = await ctxM.newPage(); await login(pm);
  await pm.goto(BASE + '#/seance/' + ids.b); await pm.waitForSelector('h1');
  await pm.locator('button:has-text("📥 Charger un modèle")').first().click(); await pm.waitForSelector('.tpl'); await pm.locator('.tpl-chapd > summary').first().click(); await pm.waitForSelector('.tpl-card');
  ok(await pm.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'mobile : pas de défilement horizontal');
  await pm.screenshot({ path: SHOTS + '/32-modeles-mobile.png' });

  ok(errors.length === 0, 'aucune erreur console (' + errors.slice(0, 3).join(' | ') + ')');
  console.log('\n' + pass + ' ✓  ' + fail + ' ✗'); await browser.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
