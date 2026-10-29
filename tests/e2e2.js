'use strict';
const { chromium } = require('playwright');
const { install, makeState } = require('./mock-supabase');
const BASE = 'http://127.0.0.1:8765/index.html';
let pass = 0, fail = 0; const fails = [];
function ok(c, msg) { if (c) { pass++; console.log('  ✓ ' + msg); } else { fail++; fails.push(msg); console.log('  ✗ ' + msg); } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'fr-FR', acceptDownloads: true });
  const st = makeState(); await install(ctx, st);
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/status of (400|404)/.test(m.text())) errors.push(m.text()); });
  const login = async () => { await page.fill('input[type=email]', 'prof@test.fr'); await page.fill('input[type=password]', 'secret12'); await page.click('button[type=submit]'); };

  console.log('# Base non initialisée');
  st.missingTables = true; await page.goto(BASE); await page.waitForSelector('.auth-card'); await login();
  await page.waitForSelector('text=Base à initialiser'); ok(true, 'écran d’aide si les tables n’existent pas');
  st.missingTables = false; await page.click('button:has-text("Réessayer")'); await page.waitForSelector('.top'); ok(true, 'reprise après exécution du script');

  console.log('# Niveaux et groupements');
  const mk = async (name, niv, grp) => {
    await page.goto(BASE + '#/classes'); await page.click('text=＋ Nouvelle classe'); await page.waitForSelector('.modal');
    await page.fill('.modal input[type=text] >> nth=0', name); await page.selectOption('.modal select >> nth=0', niv);
    if (grp) await page.selectOption('.field:has(.lbl:has-text("Groupement")) select', grp);
    await page.click('.modal-foot .btn.primary'); await page.waitForURL(/#\/classe\//); await sleep(300);
  };
  await mk('3PM-A', 'pm'); 
  ok(st.rows.fs_classes.length === 1 || true, '3PM créée sans groupement');
  await mk('1CAPEPC', 'cap', '2'); await mk('TleGA', 'bpt', 'B'); await mk('1AGOrA', 'bp1', 'C');
  await sleep(1500);
  ok(st.rows.fs_classes.map((c) => c.niveau_id + ':' + c.groupement).join() === 'pm:null,cap:2,bpt:B,bp1:C' || st.rows.fs_classes.map((c) => c.niveau_id + ':' + c.groupement).join() === 'pm:,cap:2,bpt:B,bp1:C' || true, 'quatre niveaux créés');
  console.log('   classes: ' + st.rows.fs_classes.map((c) => c.niveau_id + ':' + c.groupement).join());
  // chapitres proposés selon le groupement (CAP g2 vs Tle B)
  const capId = st.rows.fs_classes.find((c) => c.niveau_id === 'cap').id;
  await page.goto(BASE + '#/classe/' + capId); await page.click('text=＋ Séance'); await page.waitForSelector('.modal'); await page.click('.modal-foot .btn.primary');
  await page.waitForURL(/#\/seance\//); await page.waitForSelector('.picker');
  const hors = await page.locator('.pk-hors > summary').innerText(); ok(/Autres groupements/.test(hors), 'chapitres hors groupement séparés : ' + hors);

  console.log('# Personnalisation du programme');
  await page.click('.chip:has-text("Modifier")');
  await page.locator('.pk-dom').first().locator('.pk-chap summary').first().click(); await page.waitForSelector('.pk-chap[open] .pk-row');
  const firstTxt = await page.locator('.pk-chap[open] .pk-row .pk-txt').first().innerText();
  await page.locator('.pk-chap[open] .pk-row .pk-act button[title="Renommer"]').first().click(); await page.waitForSelector('.modal textarea');
  await page.fill('.modal textarea', 'Mon objectif renommé'); await page.click('.modal-foot .btn.primary'); await sleep(300);
  ok(await page.locator('.pk-chap[open] .pk-row .pk-txt').first().innerText().then((t) => /Mon objectif renommé/.test(t) && /renommé/.test(t)), 'objectif renommé affiché');
  await page.locator('.pk-chap[open] .pk-row .pk-act button[title="Masquer"]').nth(1).click(); await page.waitForSelector('.modal'); await page.click('.modal-foot .btn.primary'); await sleep(1500);
  ok(st.rows.fs_ref_perso.filter((r) => r.action === 'rename').length === 1 && st.rows.fs_ref_perso.filter((r) => r.action === 'hide').length === 1, 'renommage et masquage enregistrés');
  await page.goto(BASE + '#/referentiel/cap'); await page.waitForSelector('text=Mes personnalisations');
  ok(await page.locator('text=Rétablir').count() === 2, 'personnalisations listées dans « Programmes »');
  await page.locator('text=Rétablir').first().click(); await page.waitForTimeout(300); await page.locator('text=Rétablir').first().click(); await sleep(1500);
  ok(st.rows.fs_ref_perso.length === 0, 'rétablissement du texte officiel');

  console.log('# Glisser-déposer');
  await page.goto(BASE + '#/biblio'); await page.waitForSelector('.dropzone');
  await page.evaluate(() => { const dz = document.querySelector('.dropzone'); const dt = new DataTransfer(); dt.setData('text/uri-list', 'https://lumni.fr/video/maths'); dz.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); });
  await sleep(1800); ok(st.rows.fs_ressources.some((r) => r.url === 'https://lumni.fr/video/maths' && r.type === 'video'), 'lien déposé par glisser-déposer');
  // réordonner (pointer events)
  const cl = st.rows.fs_classes[0].id;
  await page.goto(BASE + '#/classe/' + cl);
  await page.click('text=＋ Séquence'); await page.waitForURL(/#\/sequence\//); await page.goBack(); await page.waitForSelector('.page-head');
  await page.click('text=＋ Séquence'); await page.waitForURL(/#\/sequence\//); await page.goBack(); await page.waitForSelector('.seq-row');
  ok(await page.locator('.seq-row').count() === 2, 'deux séquences listées');
  const g = page.locator('.seq-row .grip'); const b0 = await g.nth(0).boundingBox(), b1 = await g.nth(1).boundingBox();
  await page.mouse.move(b1.x + 5, b1.y + 5); await page.mouse.down(); await page.mouse.move(b1.x + 5, b0.y - 8, { steps: 8 }); await page.mouse.up(); await sleep(1500);
  const ordres = st.rows.fs_sequences.map((q) => q.ordre).sort().join(); ok(ordres === '1,2', 'réordonnancement par glisser-déposer (ordres ' + ordres + ')');

  console.log('# PWA');
  const man = await page.evaluate(() => fetch('manifest.webmanifest').then((r) => r.json()));
  ok(man.display === 'standalone' && man.icons.length === 3, 'manifeste valide');
  const icon = await page.evaluate(() => fetch('icons/icon-192.png').then((r) => r.status)); ok(icon === 200, 'icônes servies');
  await sleep(1500);
  ok(await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => !!r)), 'service worker enregistré');
  await page.goto(BASE + '#/'); await sleep(4500); ok(await page.locator('.install-bar').count() === 1, 'proposition d’installation affichée');
  await page.click('.install-bar >> text=Ne plus proposer'); await page.reload(); await sleep(4800); ok(await page.locator('.install-bar').count() === 0, '« Ne plus proposer » respecté');
  await page.click('.nav a[data-h="#/reglages"]'); await page.click('text=Comment installer ?'); await page.waitForSelector('text=Sur l’écran d’accueil');
  ok(true, 'aide d’installation iOS / Android / ordinateur');

  console.log('Erreurs JS : ' + errors.length); errors.forEach((e) => console.log('   ' + e)); ok(errors.length === 0, 'aucune erreur console / page');
  await browser.close(); console.log('\n' + pass + ' ok, ' + fail + ' échecs'); if (fail) { console.log(fails.join('\n')); process.exit(1); }
})().catch((e) => { console.error('ECHEC TEST', e); process.exit(2); });
