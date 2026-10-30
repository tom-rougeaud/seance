'use strict';
/* Matière de chaque créneau du planning */
const { chromium } = require('playwright');
const { install, makeState } = require('./mock-supabase');
const BASE = 'http://127.0.0.1:8765/index.html';
let pass = 0, fail = 0;
function ok(c, msg) { if (c) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ ' + msg); } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch(); const st = makeState();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'fr-FR' }); await install(ctx, st);
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/status of (400|404)/.test(m.text())) errors.push('console: ' + m.text()); });
  await page.goto(BASE); await page.waitForSelector('.auth-card'); await page.fill('input[type=email]', 'prof@test.fr'); await page.fill('input[type=password]', 'secret12'); await page.click('.auth-card button[type=submit]'); await page.waitForSelector('#view');
  const cid = await page.evaluate(() => DB.create('fs_classes', { nom: '2MRCU', niveau_id: 'bp2', groupement: 'A', avec_pc: true, poursuite: false, metier: '', annee_scolaire: '2026-2027', couleur: '#2B4C7E', creneaux: [], notes: '' }).id);
  await page.goto(BASE + '#/planning'); await page.waitForSelector('text=＋ Ajouter un créneau');

  console.log('# Saisie de la matière dans le planning');
  await page.click('text=＋ Ajouter un créneau'); await page.waitForSelector('.modal');
  const opts = await page.locator('.modal .field:has(.lbl:text-is("Matière")) option').allInnerTexts();
  ok(opts.join('|') === 'Maths|Co-intervention|Consolidation|Soutien au parcours|Techno|Sciences|Aide aux devoirs|RCD', 'les 8 matières proposées : ' + opts.join(', '));
  ok((await page.locator('.modal .field:has(.lbl:text-is("Matière")) select').inputValue()) === 'maths', 'maths par défaut');
  await page.selectOption('.modal .field:has(.lbl:text-is("Matière")) select', 'co_inter');
  await page.click('.modal-foot .btn.primary'); await sleep(900);
  let cr = await page.evaluate((id) => Cls.get(id).creneaux, cid);
  ok(cr.length === 1 && cr[0].matiere === 'co_inter', 'créneau enregistré avec matiere = co_inter');
  ok(/Co-inter/.test(await page.locator('.tt-b').first().innerText()), 'la matière apparaît sur le bloc du planning');
  await page.locator('.tt-b').first().click(); await page.waitForSelector('.modal');
  ok((await page.locator('.modal .field:has(.lbl:text-is("Matière")) select').inputValue()) === 'co_inter', 'la modification rouvre la matière enregistrée');
  await page.selectOption('.modal .field:has(.lbl:text-is("Matière")) select', 'maths'); await page.click('.modal-foot .btn.primary'); await sleep(900);
  cr = await page.evaluate((id) => Cls.get(id).creneaux, cid);
  ok(cr[0].matiere === undefined, 'retour à « maths » : pas de champ superflu');

  console.log('# Toutes les matières, calculs et import');
  const r = await page.evaluate((id) => {
    const cl = Cls.get(id);
    cl.creneaux = [{ jour: 1, debut: '08:00', duree: 110, semaine: 1 }, { jour: 2, debut: '10:00', duree: 55, matiere: 'consolidation' }, { jour: 3, debut: '14:00', duree: 55, matiere: 'rcd' }, { jour: 4, debut: '09:00', duree: 55, matiere: 'co_inter' }];
    DB.save('fs_classes', cl);
    const next = Plan.nextSlots(cl, '2026-11-02', 6, {}).map((x) => x.date + ' ' + x.debut);
    const cons = Plan.nextSlots(cl, '2026-11-02', 2, { matiere: 'consolidation' }).map((x) => x.date + ' ' + x.debut);
    const h = Plan.heuresHebdo(cl);
    return { next, cons, par: h.par, ini: ['maths', 'co_inter', 'consolidation', 'soutien', 'aide_devoirs', 'techno', 'sciences', 'rcd'].map((m) => m + ':' + JSON.stringify(slotSeanceInit({ matiere: m, duree: 55 }))) };
  }, cid);
  console.log('     dates (maths + co-inter) :', r.next.join(', '));
  ok(r.next.length === 6 && r.next.every((x) => [1, 4].indexOf(new Date(x.slice(0, 10) + 'T12:00:00').getDay()) >= 0), 'dates de séances : seulement lundi (maths) et jeudi (co-inter), pas les autres matières');
  ok(r.cons.length === 2 && r.cons.every((x) => /^2026-11-(03|10|17)/.test(x)), 'dates d’un créneau de consolidation sur demande : ' + r.cons.join(', '));
  ok(r.par.maths.s1 === 110 && r.par.consolidation.s2 === 55 && r.par.rcd.s1 === 55, 'heures hebdo par matière : ' + JSON.stringify(r.par));
  ok(/co_intervention/.test(r.ini[1]) && /"type":"ap"/.test(r.ini[2]) && /"type":"ap"/.test(r.ini[3]) && /"type":"ap"/.test(r.ini[4]) && !/type/.test(r.ini[5]) && !/type/.test(r.ini[7]), 'séance depuis un créneau : co-inter → co-intervention, consolidation/soutien/aide → AP');
  await page.evaluate(() => Views.rerender()); await page.waitForSelector('text=Par matière');
  const t2 = await page.locator('.tt-sum').nth(1).innerText();
  ok(/Consolidation/.test(t2) && /RCD/.test(t2) && /Co-intervention/.test(t2), 'tableau « Par matière » affiché');
  await page.goto(BASE + '#/classe/' + cid); await page.waitForSelector('.page-head h1');
  ok(/RCD/.test(await page.locator('.page').innerText()) && /Consolidation/.test(await page.locator('.page').innerText()), 'page de la classe : matière dans la liste des créneaux');
  await page.click('text=✎ Modifier'); await page.waitForSelector('.modal .cren-row');
  const sels = await page.locator('.modal .cren-row').nth(2).locator('select').evaluateAll((a) => a.map((s) => s.value));
  ok(sels[3] === 'rcd', 'fenêtre de la classe : matière du 3e créneau = rcd');
  await page.locator('.modal .cren-row').nth(0).locator('select').nth(3).selectOption('techno');
  await page.click('.modal-foot .btn.primary'); await sleep(900);
  ok((await page.evaluate((id) => Cls.get(id).creneaux[0].matiere, cid)) === 'techno', 'matière modifiée depuis la fiche classe');
  // export / import
  const imp = await page.evaluate((id) => { const cl = Cls.get(id); return JSON.stringify(cl.creneaux.map((c) => c.matiere || 'maths')); }, cid);
  ok(imp === '["techno","consolidation","rcd","co_inter"]', 'matières conservées : ' + imp);
  ok(errors.length === 0, 'aucune erreur console / page' + (errors.length ? ' : ' + errors.slice(0, 3).join(' | ') : ''));
  console.log('\n' + pass + ' ok, ' + fail + ' échecs');
  await browser.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
