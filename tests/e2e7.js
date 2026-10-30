'use strict';
/* Mises à jour visibles (version, bandeau, bouton) et parcours guidé « Et maintenant ? » */
const { chromium } = require('playwright');
const { install, makeState } = require('./mock-supabase');
const SHOTS = process.env.SHOTS || '/tmp/claude-0/-home-claude/352bfbd7-cd9f-5fb4-ba56-436b6cfb21f0/scratchpad/shots';
require('fs').mkdirSync(SHOTS, { recursive: true });
const BASE = process.env.BASE || 'http://127.0.0.1:8765/index.html';
let pass = 0, fail = 0;
function ok(c, msg) { if (c) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ ' + msg); } }
async function login(page) { await page.goto(BASE); await page.waitForSelector('.auth-card'); await page.fill('input[type=email]', 'prof@test.fr'); await page.fill('input[type=password]', 'secret12'); await page.click('.auth-card button[type=submit]'); await page.waitForSelector('#view', { timeout: 8000 }); }
const txt = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.textContent : null; }, sel);

(async () => {
  const browser = await chromium.launch();
  const st = makeState();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'fr-FR' }); await install(ctx, st);
  let remoteBuild = null;
  await ctx.route('**/sw.js*', async (route) => {
    if (!remoteBuild) return route.continue();
    const res = await route.fetch(); const body = (await res.text()).replace(/var CACHE = '([a-z]+-)\d{12}'/, "var CACHE = '$1" + remoteBuild + "'");
    route.fulfill({ response: res, body });
  });
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/status of (400|404)/.test(m.text())) errors.push('console: ' + m.text()); });
  await login(page);

  console.log('# Version visible et mises à jour');
  const app = await page.evaluate(() => ({ id: APP.id, build: APP.build, nom: APP.nom }));
  ok(/^\d{12}$/.test(app.build), 'numéro de version intégré (' + app.build + ')');
  const ver = await txt(page, '.top .ver');
  ok(/v\. \d{2}\/\d{2} \d{2}h\d{2}/.test(ver || ''), 'version affichée dans l’en-tête : ' + ver);
  await page.goto(BASE + '#/reglages'); await page.waitForSelector('text=Version et mises à jour');
  ok((await page.locator('text=Rechercher une mise à jour').count()) === 1 && (await page.locator('text=Forcer le rechargement complet').count()) === 1, 'Réglages : boutons « Rechercher » et « Forcer »');
  await page.click('text=Rechercher une mise à jour'); await page.waitForSelector('.toast');
  ok(/dernière version/.test(await txt(page, '.toast')), 'à jour : message « dernière version »');
  ok((await page.locator('.update-bar').count()) === 0, 'pas de bandeau quand on est à jour');
  remoteBuild = '299912312359';
  await page.click('text=Rechercher une mise à jour');
  await page.waitForSelector('.update-bar', { timeout: 6000 });
  ok(/nouvelle version/.test(await txt(page, '.update-bar')), 'nouvelle version publiée → bandeau persistant « Mettre à jour maintenant »');
  await page.screenshot({ path: SHOTS + '/e7-update.png' });
  await page.click('.update-bar >> text=Plus tard');
  ok((await page.locator('.update-bar').count()) === 0, '« Plus tard » masque le bandeau');
  remoteBuild = null;

  console.log('# Parcours guidé');
  await page.goto(BASE + '#/'); await page.waitForSelector('.hero');
  ok((await page.locator('.guide').count()) === 0, 'accueil sans classe : le bouton unique de création suffit (pas de double guide)');
  const ids = await page.evaluate(() => {
    const cl = DB.create('fs_classes', { nom: '2MRCU', niveau_id: 'bp2', groupement: 'A', avec_pc: true, poursuite: false, metier: '', annee_scolaire: '2026-2027', couleur: '#2B4C7E', creneaux: [], notes: '' });
    return { c: cl.id };
  });
  await page.goto(BASE + '#/classe/' + ids.c); await page.waitForSelector('.guide');
  let g = await txt(page, '.guide');
  ok(/Et maintenant/.test(g) && /Ajouter mes créneaux/.test(g), 'classe sans créneau : étape ① « Ajouter mes créneaux »');
  await page.click('.guide .btn.primary'); await page.waitForSelector('.modal');
  ok(true, 'le bouton ouvre la fenêtre de la classe'); await page.keyboard.press('Escape');
  await page.evaluate((id) => { const c = Cls.get(id); c.creneaux = [{ jour: 1, debut: '08:00', duree: 110, semaine: 1 }]; DB.save('fs_classes', c); Views.rerender(); }, ids.c);
  await page.waitForSelector('.guide');
  g = await txt(page, '.guide');
  ok(/Créer ma première séquence/.test(g), 'créneaux saisis → étape ② « Créer ma première séquence »');
  await page.click('.guide .btn.primary'); await page.waitForURL(/#\/sequence\//);
  await page.waitForFunction(() => /Étape 1 — nommez/.test((document.querySelector('.guide') || {}).textContent || ''));
  g = await txt(page, '.guide');
  ok(/Renseigner le titre/.test(g), 'séquence : guide présent (' + g.replace(/\s+/g, ' ').slice(0, 90) + '…)');
  const seqId = page.url().split('/').pop();
  await page.evaluate((id) => { const q = DB.byId('fs_sequences', id); q.titre = 'Statistiques'; DB.save('fs_sequences', q); Views.rerender(); }, seqId);
  await page.waitForSelector('.guide');
  ok(/Ajouter une première séance/.test(await txt(page, '.guide')), 'séquence titrée sans séance → « Ajouter une première séance »');
  await page.click('.guide .btn.primary'); await page.waitForURL(/#\/seance\//);
  await page.waitForFunction(() => /Saisir le titre/.test((document.querySelector('.guide') || {}).textContent || ''));
  const sid = page.url().split('/').pop();
  ok(/Saisir le titre/.test(await txt(page, '.guide')), 'séance vide → ① titre');
  await page.screenshot({ path: SHOTS + '/e7-guide-seance.png', fullPage: true });
  const steps = [
    ['titre', (s) => { s.titre = 'Moyenne'; }, /Cocher les objectifs/],
    ['items', (s) => { s.data.items.push({ k: 'o', ref: 'x', txt: 'Calculer une moyenne', niv: 'decouverte', chap: 'bp2.stat1' }); s.data.chapitres = ['bp2.stat1']; s.data.phases = []; }, /Construire le déroulé/],
    ['phases', (s) => { s.data.phases = [{ phase: 'accroche', duree: 5, orga: 'collectif', contenu: 'x' }]; }, /Marquer la séance comme prête/],
    ['prete', (s) => { s.statut = 'prete'; }, /Marquer la séance comme faite/],
    ['faite', (s) => { s.statut = 'faite'; }, /Rédiger la synthèse pour Pronote/],
    ['pronote', (s) => { s.data.pronote = { contenu: 'Moyenne', travail: '', temps: '', perso: '' }; }, /Noter le bilan/],
    ['bilan', (s) => { s.data.bilan.realise = 'ok'; }, /Passer à la séance suivante/]
  ];
  for (const [nom, fn, re] of steps) {
    await page.evaluate(([id, f]) => { const s = DB.byId('fs_seances', id); (new Function('s', f))(s); DB.save('fs_seances', s); Views.rerender(); }, [sid, '(' + fn.toString() + ')(s)']);
    await page.waitForSelector('.guide');
    const gg = await txt(page, '.guide');
    ok(re.test(gg), 'séance — après « ' + nom + ' » : ' + re.source.replace(/\\/g, ''));
  }
  const nbS = await page.evaluate(() => DB.list('fs_seances').length);
  await page.click('.guide .btn.primary'); await page.waitForFunction((n) => DB.list('fs_seances').length === n + 1, nbS);
  ok(true, '« séance suivante » crée la séance à la suite et l’ouvre');
  await page.waitForSelector('.guide');
  ok(/Saisir le titre/.test(await txt(page, '.guide')), 'la nouvelle séance repart à l’étape ①');
  await page.goto(BASE + '#/planning'); await page.waitForSelector('.guide');
  ok(/Ouvrir « Mon année »/.test(await txt(page, '.guide')), 'emploi du temps : le guide renvoie vers « Mon année »');
  for (const r of ['classes', 'progression', 'historique/' + ids.c, 'biblio', 'reglages', 'classe/' + ids.c, '']) {
    await page.goto(BASE + '#/' + r); await page.waitForSelector('#view .page, #view .guide', { timeout: 5000 });
    ok((await page.locator('#view .guide').count()) === 1, 'guide en bas de #/' + r);
  }
  const bottom = await page.evaluate(() => { const g = document.querySelector('#view .guide'); return g ? g.getBoundingClientRect().height : 0; });
  ok(bottom > 60, 'le bloc guide a une hauteur visible');
  ok(errors.length === 0, 'aucune erreur console / page' + (errors.length ? ' : ' + errors.slice(0, 3).join(' | ') : ''));
  console.log('\n' + pass + ' ok, ' + fail + ' échecs');
  await browser.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
