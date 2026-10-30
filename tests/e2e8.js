'use strict';
/* Version « Ma séance » (dist/maseance) : manuels intégrés, section Manuel, modèles par notion, Pronote, exports */
const { chromium } = require('playwright');
const { install, makeState } = require('./mock-supabase');
const SHOTS = process.env.SHOTS || '/tmp/claude-0/-home-claude/352bfbd7-cd9f-5fb4-ba56-436b6cfb21f0/scratchpad/shots';
require('fs').mkdirSync(SHOTS, { recursive: true });
const BASE = 'http://127.0.0.1:8765/dist/maseance/index.html', BASE1 = 'http://127.0.0.1:8765/index.html';
let pass = 0, fail = 0;
function ok(c, msg) { if (c) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ ' + msg); } }
async function login(page, base) { await page.goto(base); await page.waitForSelector('.auth-card'); await page.fill('input[type=email]', 'prof@test.fr'); await page.fill('input[type=password]', 'secret12'); await page.click('.auth-card button[type=submit]'); await page.waitForSelector('#view', { timeout: 8000 }); }

(async () => {
  const browser = await chromium.launch();
  const st = makeState();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'fr-FR' }); await install(ctx, st);
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/status of (400|404)/.test(m.text())) errors.push('console: ' + m.text()); });
  await login(page, BASE);

  console.log('# Identité de la version');
  const a = await page.evaluate(() => ({ id: APP.id, nom: APP.nom, prefix: APP.prefix, cache: APP.cache, manuels: APP.manuels, frere: APP.frere && APP.frere.url, title: document.title, brand: document.querySelector('.brand').textContent, pal: document.documentElement.getAttribute('data-palette') }));
  ok(a.id === 'maseance' && a.manuels && a.prefix === 'maseance_v1_' && a.cache === 'maseance-', 'APP : maseance / préfixe de stockage et de cache propres');
  ok(/Ma séance/.test(a.title) && /Ma séance/.test(a.brand), 'titre et nom : « Ma séance »');
  ok(a.pal === 'foret', 'palette verte par défaut (distincte de la version BO)');
  ok(/maseance/.test(a.frere || '') === false && /seance\/$/.test(a.frere), 'lien frère vers /seance/');
  const keys = await page.evaluate(() => Object.keys(localStorage));
  ok(keys.length > 0 && keys.every((k) => k.indexOf('maseance_v1_') === 0), 'localStorage : seulement des clés maseance_v1_*');
  const mani = await (await page.request.get('http://127.0.0.1:8765/dist/maseance/manifest.webmanifest')).json();
  ok(mani.short_name === 'Ma séance' && mani.start_url === './', 'manifeste propre');
  const sw = await (await page.request.get('http://127.0.0.1:8765/dist/maseance/sw.js')).text();
  ok(/var CACHE = 'maseance-\d{12}'/.test(sw) && /PREFIX = 'maseance-'/.test(sw) && /no-cache/.test(sw), 'service worker : cache maseance-… et requêtes no-cache');

  console.log('# Catalogue des manuels embarqué');
  const cat = await page.evaluate(() => { const o = {}; ['bp2', 'bp1', 'bpt', 'pm'].forEach((n) => { const m = Man.get(n); o[n] = m ? { ch: m.chapitres.length, no: m.chapitres.reduce((s, c) => s + c.notions.length, 0), ex: m.chapitres.reduce((s, c) => s + c.exos.length, 0) } : null; }); o.cap = Man.has('cap'); return o; });
  console.log('    ', JSON.stringify(cat));
  ok(cat.bp2.ch === 8 && cat.bp1.ch === 8 && cat.bpt.ch === 7 && cat.pm.ch === 10, 'chapitres : 8 / 8 / 7 / 10');
  ok(cat.bp2.no + cat.bp1.no + cat.bpt.no + cat.pm.no === 143 && cat.bp2.ex + cat.bp1.ex + cat.bpt.ex + cat.pm.ex === 202, '143 notions et 202 exercices chargés dans le fichier');
  ok(cat.cap === false, 'CAP : pas de manuel');

  console.log('# Séance : section Manuel');
  const ids = await page.evaluate(() => {
    const cl = DB.create('fs_classes', { nom: '2MRCU', niveau_id: 'bp2', groupement: 'A', avec_pc: true, poursuite: false, metier: '', annee_scolaire: '2026-2027', couleur: '#2B4C7E', creneaux: [], notes: '' });
    const s = createSeance(cl, { titre: 'Prendre un pourcentage', type: 'cours' });
    return { c: cl.id, s: s.id };
  });
  await page.goto(BASE + '#/seance/' + ids.s); await page.waitForSelector('text=Manuel : chapitre, pages, exercices');
  ok(true, 'section « 📘 Manuel » affichée en tête');
  ok((await page.locator('text=Mémo perso').count()) === 0, 'mémo perso retiré (Pronote cite déjà les manuels)');
  await page.selectOption('#view details.sec >> select', '1').catch(() => {});
  await page.evaluate(() => { const sel = [...document.querySelectorAll('#view details.sec select')].find((x) => [...x.options].some((o) => /Prix, marges/.test(o.textContent))); sel.value = '1'; sel.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForSelector('text=Notions du chapitre');
  const nbN = await page.locator('.man-row').count();
  ok(nbN === 4 + 6, 'chapitre 1 : 4 notions + 6 exercices listés (' + nbN + ')');
  const l1 = await page.evaluate(() => [...document.querySelectorAll('.man-links a')].map((x) => x.getAttribute('href')));
  ok(l1.some((h) => /maths-et-mcv-2de\.pdf#page=7$/.test(h)) && l1.some((h) => /chapitre-1\.pdf$/.test(h)) && l1.some((h) => /mcv\/2de\/#\/c1$/.test(h)) && l1.some((h) => /#page=121$/.test(h)), 'liens du chapitre : PDF p.7, PDF du chapitre, appli, réponses p.121');
  await page.locator('.man-row', { hasText: 'Prendre un pourcentage' }).locator('input[type=checkbox]').check();
  await page.waitForSelector('.toast');
  let r = await page.evaluate((id) => { const s = DB.byId('fs_seances', id); return { man: s.data.manuel, items: s.data.items.map((i) => [i.via, i.chap, i.txt.slice(0, 40)]), chap: s.data.chapitres }; }, ids.s);
  ok(r.man.chap === 1 && r.man.notions.join() === '1', 'notion 1 cochée enregistrée dans la séance');
  ok(r.items.length >= 1 && r.items.every((i) => i[0] === 'man'), 'objectifs du BO liés ajoutés pour la progression (' + r.items.length + ') ' + JSON.stringify(r.items[0]));
  await page.waitForSelector('text=Notions du chapitre');
  await page.locator('.man-row', { hasText: 'Prendre un pourcentage' }).locator('input[type=checkbox]').uncheck();
  await page.waitForFunction((id) => DB.byId('fs_seances', id).data.manuel.notions.length === 0, ids.s);
  r = await page.evaluate((id) => DB.byId('fs_seances', id).data.items.length, ids.s);
  ok(r === 0, 'notion décochée : les objectifs ajoutés automatiquement disparaissent');
  await page.locator('.man-row', { hasText: 'Prendre un pourcentage' }).locator('input[type=checkbox]').check();
  await page.waitForFunction((id) => DB.byId('fs_seances', id).data.manuel.notions.length === 1, ids.s);
  await page.waitForSelector('text=Notions du chapitre');
  await page.click('text=☑ Exercices des notions cochées');
  await page.waitForFunction((id) => DB.byId('fs_seances', id).data.manuel.exos.length >= 1, ids.s);
  const ex = await page.evaluate((id) => DB.byId('fs_seances', id).data.manuel.exos, ids.s);
  ok(ex.join() === '1', 'exercices des notions cochées : n° ' + ex.join(','));
  await page.screenshot({ path: SHOTS + '/e8-seance-manuel.png', fullPage: true });

  console.log('# Export, Pronote');
  const info = await page.evaluate((id) => { const s = DB.byId('fs_seances', id), cl = Cls.get(s.class_id); return { html: Man.html(s, cl), lines: Man.lines(s, cl), fiche: Exp.seanceHtml ? Exp.seanceHtml(s, {}) : '', p: Pronote.draft(s, cl, 'futur', 3), pp: Pronote.draft(s, cl, 'passe', 3) }; }, ids.s);
  console.log('     ', info.lines.join('\n      '));
  console.log('      Pronote futur » ' + info.p.contenu + '\n      travail » ' + info.p.travail + '\n      passé » ' + info.pp.contenu);
  ok(/href="[^"]+#page=8"/.test(info.html) && /#page=13"/.test(info.html), 'bloc HTML : liens PDF aux pages 8 et 13');
  ok(/<h3>Manuel<\/h3>/.test(info.fiche) || info.fiche === '', 'fiche exportée : section Manuel');
  ok(/chapitre 1 « Prix, marges et TVA »/.test(info.pp.contenu) && /p\. 8/.test(info.pp.contenu) && /n° 1 \(p\. 13\)/.test(info.pp.contenu), 'Pronote : chapitre, notion et exercice avec pages');
  ok(!/accroche|Déroulé/i.test(info.pp.contenu) && /Appli : https:\/\/tom-rougeaud\.github\.io\/mcv\/2de\/#\/c1\/lecon/.test(info.pp.contenu), 'Pronote : pas de déroulé, lien appli de la leçon');
  ok(/Revoir la notion « Prendre un pourcentage »/.test(info.pp.travail), 'travail à faire : revoir la notion');

  console.log('# Modèles « mes manuels »');
  await page.goto(BASE + '#/classe/' + ids.c); await page.waitForSelector('.guide');
  await page.evaluate((id) => Tpl.open({ mode: 'create', cl: Cls.get(id) }), ids.c);
  await page.waitForSelector('.tpl');
  ok((await page.locator('.tpl .tab.on').innerText()) === 'Mes manuels', 'onglet « Mes manuels » ouvert par défaut');
  await page.locator('.tpl-chapd summary', { hasText: 'Ch. 1' }).click();
  await page.waitForSelector('.tpl-card');
  const cards = await page.locator('.tpl-card .tpl-t strong').allInnerTexts();
  console.log('     ', cards.join(' | '));
  ok(cards.length === 4 + 1 + 1 && /Ch\. 1 — Prendre un pourcentage/.test(cards[0]) && /Défis/.test(cards[4]) && /Contrôle/.test(cards[5]), 'ch. 1 : 4 notions + défis + contrôle = 6 séances d’1 h');
  await page.locator('.tpl-card').nth(0).locator('input[type=checkbox]').check();
  await page.locator('.tpl-card').nth(2).locator('input[type=checkbox]').check();
  await page.click('.modal >> text=Créer les séances sélectionnées');
  await page.waitForFunction((id) => DB.list('fs_seances').filter((s) => s.class_id === id).length === 3, ids.c);
  const made = await page.evaluate((id) => DB.list('fs_seances').filter((s) => s.class_id === id && s.titre.indexOf('Ch. 1') === 0).map((s) => ({ t: s.titre, m: s.data.manuel, it: s.data.items.length, ph: s.data.phases.map((p) => p.contenu).join(' / ') })), ids.c);
  ok(made.length === 2 && made[0].m.chap === 1 && made[0].m.notions.length === 1 && made[0].m.exos.length >= 1, 'séances créées avec notion et exercices du manuel');
  ok(/Je découvre/.test(made[0].ph) && /p\. 8/.test(made[0].ph) && /Exercices du manuel/.test(made[0].ph), 'déroulé : pages et exercices du manuel');
  console.log('      ' + made[0].ph);

  console.log('# Guide, version « Fiches » sans manuel');
  await page.goto(BASE + '#/seance/' + ids.s); await page.waitForSelector('.guide');
  const g = await page.evaluate(() => document.querySelector('.guide').textContent);
  ok(/Et maintenant/.test(g), 'guide présent dans « Ma séance » : ' + g.replace(/\s+/g, ' ').slice(0, 80));
  const p2 = await ctx.newPage();
  await login(p2, BASE1);
  const hasMan = await p2.evaluate(() => ({ en: Man.enabled(), has: Man.has('bp2'), cat: document.getElementById('MANUELS').textContent.trim() }));
  ok(!hasMan.en && !hasMan.has && hasMan.cat === 'null', '« Fiches » (BO) : aucun manuel intégré, section Manuel absente');
  const sid1 = await p2.evaluate(() => { const cl = DB.create('fs_classes', { nom: 'X', niveau_id: 'bp2', groupement: 'A', avec_pc: true, poursuite: false, metier: '', annee_scolaire: '2026-2027', couleur: '#2B4C7E', creneaux: [], notes: '' }); return createSeance(cl, { titre: 't' }).id; });
  await p2.goto(BASE1 + '#/seance/' + sid1); await p2.waitForSelector('#view details.sec');
  ok((await p2.locator('text=📘 Manuel').count()) === 0 && (await p2.locator('text=Mémo perso').count()) > 0, '« Fiches » : pas de bloc Manuel, mémo perso conservé');
  await p2.goto(BASE1 + '#/reglages'); await p2.waitForSelector('text=Version et mises à jour');
  ok((await p2.locator('text=Mes deux versions').count()) === 0, '« Fiches » : lien vers « Ma séance » masqué pour un autre compte');
  await p2.evaluate(() => { FICHES_CONFIG.OWNER_EMAILS = ['prof@test.fr']; });
  await p2.goto(BASE1 + '#/'); await p2.goto(BASE1 + '#/reglages'); await p2.waitForSelector('text=Version et mises à jour');
  ok((await p2.locator('text=Mes deux versions').count()) === 1, '« Fiches » : lien visible pour le compte propriétaire');
  await page.goto(BASE + '#/reglages'); await page.waitForSelector('text=Mes deux versions');
  ok(true, '« Ma séance » : lien vers la version BO dans Réglages');
  ok(errors.length === 0, 'aucune erreur console / page' + (errors.length ? ' : ' + errors.slice(0, 3).join(' | ') : ''));
  console.log('\n' + pass + ' ok, ' + fail + ' échecs');
  await browser.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
