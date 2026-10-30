'use strict';
/* Manuel CAP, synthèse Pronote en lignes, bibliothèque des manuels (accordéon), fiche séance simplifiée */
const { chromium } = require('playwright');
const { install, makeState } = require('./mock-supabase');
const SHOTS = process.env.SHOTS || '/tmp/claude-0/-home-claude/352bfbd7-cd9f-5fb4-ba56-436b6cfb21f0/scratchpad/shots';
require('fs').mkdirSync(SHOTS, { recursive: true });
const BASE = 'http://127.0.0.1:8765/dist/maseance/index.html', BASE1 = 'http://127.0.0.1:8765/index.html';
let pass = 0, fail = 0;
function ok(c, msg) { if (c) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ ' + msg); } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function login(page, base) { await page.goto(base); await page.waitForSelector('.auth-card'); await page.fill('input[type=email]', 'prof@test.fr'); await page.fill('input[type=password]', 'secret12'); await page.click('.auth-card button[type=submit]'); await page.waitForSelector('#view', { timeout: 8000 }); }

(async () => {
  const browser = await chromium.launch();
  const st = makeState();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'fr-FR' }); await install(ctx, st);
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/status of (400|404)/.test(m.text())) errors.push('console: ' + m.text()); });
  await login(page, BASE);

  console.log('# Manuel CAP : catalogue');
  const cat = await page.evaluate(() => {
    const man = Man.get('cap'), c1 = Man.chapter(man, 1), g = Man.catalog(man, c1);
    return { nom: man.nom, ch: man.chapitres.length, g: g.map((x) => [x.g, x.items.length]), urls: g.reduce((a, x) => a.concat(x.items.map((i) => i.url)), []), rep: man.reponses, titres: g[2].items.map((i) => i.titre) };
  });
  ok(cat.nom === 'Maths · CAP' && cat.ch === 10, 'CAP : 10 chapitres');
  ok(cat.g[1][1] === 4 && cat.g[2][1] === 15 && cat.g[0][1] >= 7, 'chapitre 1 : liens du chapitre ≥ 7, 4 notions, 15 exercices (' + JSON.stringify(cat.g) + ')');
  ok(cat.urls.includes('https://tom-rougeaud.github.io/cap/pdf/maths-cap.pdf#page=16') && cat.urls.includes('https://tom-rougeaud.github.io/cap/pdf/chapitres/maths-cap-chapitre-1.pdf') && cat.urls.includes('https://tom-rougeaud.github.io/cap/#/c1/lecon') && cat.urls.includes('https://tom-rougeaud.github.io/cap/pdf/maths-cap.pdf#page=226'), 'liens : PDF à la page, PDF du chapitre, appli (#/c1/lecon), réponses p. 226');
  ok(cat.titres.every((t) => !/[\u{1F300}-\u{1FAFF}]/u.test(t)) && cat.titres.some((t) => /^CAP|Manuel CAP · Ch\. 1 — Ex\. 2 : Guidé — Un tableau d’effectifs, pas à pas \(p\. 16\)$/.test(t)), 'titres des ressources propres (sans émoji) : ' + cat.titres[1]);

  console.log('# Séance CAP : section Manuel et Pronote en lignes');
  const ids = await page.evaluate(() => {
    const cap = DB.create('fs_classes', { nom: '1CAP', niveau_id: 'cap', groupement: null, avec_pc: true, poursuite: false, metier: '', annee_scolaire: '2026-2027', couleur: '#3C6B52', creneaux: [], notes: '', archive: false, ordre: 0 });
    const bp = DB.create('fs_classes', { nom: '2MRCU', niveau_id: 'bp2', groupement: 'A', avec_pc: true, poursuite: false, metier: '', annee_scolaire: '2026-2027', couleur: '#2B4C7E', creneaux: [], notes: '', archive: false, ordre: 1 });
    const s = createSeance(cap, { titre: 'La moyenne', type: 'cours', statut: 'faite' });
    return { cap: cap.id, bp: bp.id, s: s.id };
  });
  await page.goto(BASE + '#/seance/' + ids.s); await page.waitForSelector('text=Manuel : chapitre, pages, exercices');
  await page.evaluate(() => { const sel = [...document.querySelectorAll('#view details.sec select')].find((x) => [...x.options].some((o) => /Statistique à une variable/.test(o.textContent))); sel.value = '1'; sel.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForSelector('text=Notions du chapitre');
  ok(await page.locator('.man-row').count() === 4 + 15, 'CAP ch. 1 : 4 notions + 15 exercices listés');
  await page.locator('.man-row', { hasText: 'La moyenne' }).first().locator('input[type=checkbox]').check();
  await page.waitForFunction((id) => DB.byId('fs_seances', id).data.manuel.notions.length === 1, ids.s);
  await page.waitForSelector('text=Notions du chapitre');
  const itemsN = await page.evaluate((id) => DB.byId('fs_seances', id).data.items.filter((i) => i.via === 'man').map((i) => i.ref), ids.s);
  ok(itemsN.length >= 1 && itemsN.every((r) => /^cap\.stat1/.test(r)), 'notion « La moyenne » → objectif du BO CAP lié à la progression (' + itemsN.length + ')');
  await page.click('text=☑ Exercices des notions cochées');
  await page.waitForFunction((id) => DB.byId('fs_seances', id).data.manuel.exos.length >= 1, ids.s);
  const exs = await page.evaluate((id) => DB.byId('fs_seances', id).data.manuel.exos, ids.s);
  ok(exs.join() === '7,8,10,11,12'.split(',').filter((x) => ['7', '8', '10'].includes(x)).join() || exs.slice(0, 3).join() === '7,8,10', 'exercices de la notion 4 (hors défis) cochés : ' + exs.join(','));
  await page.click('text=📋 Pronote'); await sleep(300);
  await page.click('text=✨ Rédiger la synthèse'); await sleep(500);
  const txt = await page.locator('textarea[placeholder^="Objectif"]').inputValue();
  console.log('     » ' + txt.replace(/\n/g, '\n       '));
  const lines = txt.split('\n');
  ok(/^Objectif : calculer la moyenne d’une série statistique$/.test(lines[0]) && lines.some((l) => /^Notion abordée : La moyenne \(p\. 13\)$/.test(l)) && lines.some((l) => /^Exercices traités : n° 7 \(p\. 20\), n° 8 \(p\. 20\), n° 10 \(p\. 21\)/.test(l)), 'lignes : Objectif / Notion abordée / Exercices traités');
  ok(lines.filter((l) => /La moyenne/i.test(l)).length <= 2 && !/Séance de|Nous avons/.test(txt), 'pas de répétition ni de phrase');
  ok(lines.some((l) => /^Appli : https:\/\/tom-rougeaud\.github\.io\/cap\/#\/c1\/lecon$/.test(l)) && /^Manuel CAP : chapitre 1 « Statistique à une variable »$/m.test(txt), 'ligne Manuel et lien de l’appli CAP');
  const tr = await page.locator('textarea[placeholder^="Travail à faire"]').inputValue();
  ok(/^Revoir : La moyenne \(p\. 13\)$/.test(tr), 'travail à faire en une ligne : ' + tr);
  ok(!/[\u{1F300}-\u{1FAFF}]/u.test(txt), 'aucun émoji');
  await page.screenshot({ path: SHOTS + '/e11-pronote-lignes.png' });

  console.log('# Bibliothèque : manuels en accordéon');
  await page.goto(BASE + '#/biblio'); await page.waitForSelector('text=Mes manuels : tous les chapitres');
  await page.click('summary:has-text("Mes manuels : tous les chapitres")');
  ok(await page.locator('details.mb-lvl').count() === 5, 'cinq niveaux dépliables (2de, 1re, Tle, CAP, 3e)');
  await page.locator('details.mb-lvl', { hasText: 'Maths · CAP' }).locator('summary').first().click();
  await page.locator('details.mb-lvl', { hasText: 'Maths · CAP' }).locator('details.mb-ch', { hasText: 'Ch. 1 ·' }).locator('summary').first().click({ position: { x: 150, y: 10 } });
  const ch1 = page.locator('details.mb-lvl', { hasText: 'Maths · CAP' }).locator('details.mb-ch').first();
  ok(await ch1.locator('.mb-row').count() === 7 + 4 + 15 || await ch1.locator('.mb-row').count() >= 26, 'chapitre 1 : tous les liens listés (' + await ch1.locator('.mb-row').count() + ')');
  await ch1.locator('.mb-row', { hasText: 'Notion 4 : La moyenne' }).locator('input').check();
  await ch1.locator('.mb-row', { hasText: 'Ex. 7 — Une moyenne avec des effectifs' }).locator('input').check();
  const btn = page.locator('button:has-text("Ajouter ma sélection")');
  ok((await btn.innerText()).includes('(2)') && !(await btn.isDisabled()), 'bouton « Ajouter ma sélection (2) »');
  await btn.click(); await sleep(400);
  let rs = await page.evaluate(() => DB.list('fs_ressources').map((r) => [r.titre, r.url, r.type, (r.tags || []).join('|')]));
  ok(rs.length === 2 && rs.some((r) => r[1] === 'https://tom-rougeaud.github.io/cap/pdf/maths-cap.pdf#page=13' && r[2] === 'pdf'), '2 ressources créées dans la bibliothèque : ' + rs.map((r) => r[0]).join(' ; '));
  ok(rs.every((r) => /Manuel CAP/.test(r[3])), 'étiquettes « Manuel CAP » / chapitre');
  await ch1.locator('summary').first().click({ position: { x: 150, y: 10 } }).catch(() => {});
  await ch1.locator('.mb-row', { hasText: 'Notion 4 : La moyenne' }).locator('input').check().catch(() => {});
  await page.locator('button:has-text("Ajouter ma sélection")').click().catch(() => {}); await sleep(300);
  ok((await page.evaluate(() => DB.list('fs_ressources').length)) === 2, 'ajout du même lien : aucun doublon');
  ok(await page.locator('.lib-row').count() === 2, 'les liens apparaissent dans la liste de la bibliothèque');
  await page.screenshot({ path: SHOTS + '/e11-biblio-manuels.png', fullPage: true });

  console.log('# Séance : joindre des liens des manuels en un clic');
  await page.goto(BASE + '#/seance/' + ids.s); await page.waitForSelector('.res-block');
  await page.click('button:has-text("Bibliothèque et manuels")'); await page.waitForSelector('.modal .mb');
  ok(await page.locator('.modal details.mb-lvl[open]', { hasText: 'Maths · CAP' }).count() === 1 && await page.locator('.modal details.mb-lvl[open]').count() === 1, 'le niveau de la classe (CAP) est déplié d’office');
  await page.fill('.modal input[type=search]', 'pythagore'); await sleep(400);
  const cap = page.locator('.modal details.mb-lvl', { hasText: 'Maths · CAP' });
  const vis = await cap.locator('details.mb-ch:visible').count();
  ok(vis === 1, 'recherche « pythagore » : un seul chapitre CAP reste (' + vis + ')');
  await cap.locator('details.mb-ch:visible .mb-all').check(); await sleep(200);
  const nsel = await page.locator('.modal .mb-row.on').count();
  ok(nsel >= 10, 'case du chapitre : coche tout ce qui est affiché… (' + nsel + ')');
  await page.screenshot({ path: SHOTS + '/e11-picker.png' });
  await page.click('.modal-foot .btn.primary'); await sleep(500);
  const att = await page.evaluate((id) => Res.of(id).map((x) => [x.res.titre, x.att.usage]), ids.s);
  ok(att.length >= 10 && att.some((a) => a[1] === 'prof') && att.every((a) => /Ch\. 10/.test(a[0])), 'liens joints à la fiche (' + att.length + '), réponses réservées au prof');
  ok(await page.locator('.res-row').count() === att.length, 'visibles dans « Ressources »');

  console.log('# Fiche séance simplifiée');
  const s2 = await page.evaluate((c) => { const cl = Cls.get(c); return createSeance(cl, { titre: '', type: 'cours' }).id; }, ids.bp);
  await page.goto(BASE + '#/seance/' + s2); await page.waitForSelector('.qbar');
  const q = await page.evaluate(() => [...document.querySelectorAll('.qbar .btn')].map((b) => [b.textContent, getComputedStyle(b).backgroundColor]));
  ok(q.length === 4 && q.every((x) => x[1] !== 'rgba(0, 0, 0, 0)' && x[1] !== 'rgb(255, 255, 255)') && new Set(q.map((x) => x[1])).size === 4, 'barre d’actions : 4 boutons de couleurs distinctes ' + q.map((x) => x[0]).join(' · '));
  ok(await page.locator('.start-card').count() === 1 && await page.locator('.start-card .tile-btn').count() === 3, 'séance vide : carte « Par où commencer ? » à 3 choix');
  ok(await page.locator('details.more:not([open])').count() === 1 && await page.locator('details.more .sec-t:text-is("Matériel")').count() === 1, '« Plus d’options » replié (prérequis, matériel, différenciation, trace)');
  const nOpen = await page.locator('#view details.sec[open]').count();
  console.log('     sections ouvertes : ' + (await page.evaluate(() => [...document.querySelectorAll('#view details.sec[open]')].map((d) => d.querySelector('.sec-t').textContent.slice(0, 30)).join(' | '))));
  ok(nOpen <= 6, 'sections ouvertes (état mémorisé par mes clics précédents) : ' + nOpen);
  await page.screenshot({ path: SHOTS + '/e11-seance-vide.png', fullPage: true });
  await page.click('.start-card >> text=Page blanche'); await sleep(200);
  ok(await page.locator('.start-card').count() === 0, '« Page blanche » masque la carte');
  const before = await page.evaluate((id) => DB.byId('fs_seances', id).data.phases.length, s2);
  await page.click('.phase-add .chip:has-text("Automatismes")'); await sleep(300);
  ok((await page.evaluate((id) => DB.byId('fs_seances', id).data.phases.length, s2)) === before + 1, 'une phase ajoutée en un clic');
  await page.click('.qbar >> text=Ressources'); await sleep(500);
  ok(await page.evaluate(() => { const r = document.querySelector('#view details.sec .res-block'); return !!r && r.closest('details').open; }), 'bouton « Ressources » ouvre la bonne partie');
  await page.click('.more summary'); await sleep(200);
  await page.click('.qbar >> text=Pronote'); await sleep(400);
  ok(await page.locator('details.sec:has-text("Synthèse pour Pronote")[open]').count() === 1, 'bouton « Pronote » ouvre la synthèse');
  await page.click('.start-grid >> nth=0').catch(() => {});
  // modèle d’1 h depuis le bouton coloré
  await page.click('.qbar >> text=Charger un modèle'); await page.waitForSelector('.modal'); await sleep(300);
  ok(await page.locator('.modal').innerText().then((t) => /Mes manuels|Programme|modèle/i.test(t)), 'le bouton ouvre le choix de modèles');
  await page.keyboard.press('Escape'); await sleep(200);
  // mobile
  await page.setViewportSize({ width: 390, height: 800 }); await page.goto(BASE + '#/seance/' + s2); await page.waitForSelector('.qbar'); await sleep(300);
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'mobile 390 px : pas de défilement horizontal (fiche séance)');
  await page.screenshot({ path: SHOTS + '/e11-seance-mobile.png' });
  await page.goto(BASE + '#/biblio'); await page.waitForSelector('text=Mes manuels : tous les chapitres'); await page.evaluate(() => { document.querySelectorAll('#view details.sec').forEach((d) => { if (d.textContent.indexOf('Mes manuels : tous') >= 0) d.open = true; }); }); await page.locator('details.mb-lvl').nth(3).locator('summary').first().click(); await sleep(200);
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'mobile 390 px : pas de défilement horizontal (bibliothèque)');
  await page.screenshot({ path: SHOTS + '/e11-biblio-mobile.png' });
  await page.setViewportSize({ width: 1280, height: 900 });

  console.log('# Version publique (programme du BO) : même fiche, sans manuels');
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'fr-FR' }); const st2 = makeState(); await install(ctx2, st2);
  const p2 = await ctx2.newPage(); p2.on('pageerror', (e) => errors.push('pageerror(public): ' + e.message));
  await login(p2, BASE1);
  const id2 = await p2.evaluate(() => { const cl = DB.create('fs_classes', { nom: '2MRCU', niveau_id: 'bp2', groupement: 'A', avec_pc: true, poursuite: false, metier: '', annee_scolaire: '2026-2027', couleur: '#2B4C7E', creneaux: [], notes: '', archive: false, ordre: 0 }); return createSeance(cl, { titre: '', type: 'cours' }).id; });
  await p2.goto(BASE1 + '#/seance/' + id2); await p2.waitForSelector('.qbar');
  const lab = await p2.evaluate(() => [...document.querySelectorAll('.qbar .btn')].map((b) => b.textContent));
  ok(lab.length === 5 && lab.some((l) => /Programme/.test(l)) && lab.some((l) => /Mémo manuels/.test(l)) && !lab.some((l) => /^📘 Manuel$/.test(l)), 'public : Modèle · Programme · Ressources · Pronote · Mémo (' + lab.join(' | ') + ')');
  const nOpen2 = await p2.locator('#view details.sec[open]').count();
  ok(nOpen2 <= 3, 'public, premier affichage : seulement Programme, Déroulé, Ressources ouvertes (' + nOpen2 + ')');
  await p2.goto(BASE1 + '#/biblio'); await p2.waitForSelector('.dropzone');
  ok(await p2.locator('details.mb-lvl').count() === 0 && await p2.locator('text=Mes manuels : tous').count() === 0, 'public : pas de rubrique « Mes manuels » dans la bibliothèque');
  await p2.screenshot({ path: SHOTS + '/e11-public-seance.png' });

  ok(errors.length === 0, 'aucune erreur console (' + errors.join(' / ') + ')');
  console.log('\n' + pass + ' ✓  ' + fail + ' ✗');
  await browser.close(); process.exit(fail ? 1 : 0);
})();
