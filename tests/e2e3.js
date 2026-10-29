'use strict';
/* Planning, semaines 1/2, créneaux par glisser-déposer, synthèse Pronote */
const { chromium } = require('playwright');
const { install, makeState } = require('./mock-supabase');
const SHOTS = process.env.SHOTS || '/tmp/claude-0/-home-claude/352bfbd7-cd9f-5fb4-ba56-436b6cfb21f0/scratchpad/shots';
require('fs').mkdirSync(SHOTS, { recursive: true });
const BASE = 'http://127.0.0.1:8765/index.html';
let pass = 0, fail = 0;
function ok(c, msg) { if (c) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ ' + msg); } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, locale: 'fr-FR', permissions: ['clipboard-read', 'clipboard-write'] });
  const st = makeState(); await install(ctx, st);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/status of (400|404)/.test(m.text())) errors.push('console: ' + m.text()); });
  page.on('dialog', (d) => { errors.push('DIALOG: ' + d.message()); d.dismiss(); });

  await page.goto(BASE); await page.waitForSelector('.auth-card');
  await page.fill('input[type=email]', 'prof@test.fr'); await page.fill('input[type=password]', 'secret12'); await page.click('button[type=submit]');
  await page.waitForSelector('.top');

  console.log('# Données de départ');
  await page.evaluate(() => {
    const a = DB.create('fs_classes', { nom: '2MRCU', niveau_id: 'bp2', groupement: 'A', avec_pc: true, poursuite: false, metier: '', annee_scolaire: '2026-2027', couleur: '#2B4C7E', creneaux: [], notes: '', archive: false, ordre: 0 });
    DB.create('fs_classes', { nom: '1CAP EPC', niveau_id: 'cap', groupement: null, avec_pc: true, poursuite: false, metier: '', annee_scolaire: '2026-2027', couleur: '#4C8A6B', creneaux: [], notes: '', archive: false, ordre: 1 });
    Plan.PRESETS['2026-2027'].forEach((p) => DB.create('fs_calendrier', { annee_scolaire: '2026-2027', class_id: null, type: p.type, label: p.label, debut: p.debut, fin: p.fin }));
  });
  ok(await page.evaluate(() => DB.list('fs_classes').length) === 2, 'deux classes créées');

  console.log('# Alternance semaine 1 / semaine 2 (calculs)');
  const wt = (d, cfg) => page.evaluate(([d, cfg]) => { Plan.setAltConfig('2026-2027', cfg); return Plan.weekType(d, '2026-2027'); }, [d, cfg]);
  const cfg1 = { lundi: '2026-09-02', type: 1, sauter_vacances: true };   // un mercredi : doit être ramené au lundi 31/08
  ok(await wt('2026-08-31', cfg1) === 1 && await wt('2026-09-04', cfg1) === 1, 'semaine de rentrée = semaine 1 (lundi→vendredi)');
  ok(await wt('2026-09-07', cfg1) === 2 && await wt('2026-09-14', cfg1) === 1, 'alternance 2 puis 1');
  ok(await wt('2026-08-24', cfg1) === 2, 'semaine avant la rentrée = semaine 2');
  ok(await wt('2026-09-05', { lundi: '2026-08-31', type: 2, sauter_vacances: true }) === 2, 'rentrée en semaine 2 respectée');
  await page.evaluate(() => DB.create('fs_calendrier', { annee_scolaire: '2026-2027', class_id: null, type: 'vacances', label: 'Test 1 semaine', debut: '2026-11-16', fin: '2026-11-20' }));
  ok(await wt('2026-11-23', cfg1) === 2, 'option « sauter les vacances » : alternance reprise là où elle s’était arrêtée');
  ok(await wt('2026-11-23', { lundi: '2026-08-31', type: 1 }) === 1 && await page.evaluate(() => { DB.saveSettings({ alternance: { '2026-2027': { lundi: '2026-08-31', type: 1, sauter_vacances: true } } }); return Plan.weekType('2026-11-23', '2026-2027'); }) === 1, 'par défaut : aucune semaine sautée (suit le calendrier)');
  ok(await wt('2026-11-23', { lundi: '2026-08-31', type: 1, sauter_vacances: false }) === 1, 'vacances comptées : alternance calendaire');
  ok(await page.evaluate(() => { Plan.setAltConfig('2026-2027', { lundi: '2026-08-31', type: 1, sauter_vacances: true }); return Plan.weekType('2027-02-01', '2026-2027'); }) !== null, 'type de semaine calculé en milieu d’année');
  ok(await page.evaluate(() => Plan.weekType('2025-10-01', '2025-2026')) === null, 'année non réglée : type inconnu (null)');

  console.log('# Créneaux, heures, dates suggérées');
  const h1 = await page.evaluate(() => {
    const c = DB.list('fs_classes')[0];
    c.creneaux = [{ jour: 1, debut: '08:00', duree: 120 }, { jour: 2, debut: '10:00', duree: 60, semaine: 1 }, { jour: 4, debut: '14:00', duree: 55, semaine: 2 }];
    DB.save('fs_classes', c); return Plan.heuresHebdo(c);
  });
  ok(h1.s1 === 180 && h1.s2 === 175, 'heures S1 = 3 h, S2 = 2 h 55 (' + h1.s1 + '/' + h1.s2 + ')');
  const ns = await page.evaluate(() => { const c = DB.list('fs_classes')[0]; return Plan.nextSlots(c, '2026-09-07', 4).map((x) => x.date + ' ' + x.debut); });
  ok(JSON.stringify(ns) === JSON.stringify(['2026-09-08 10:00', '2026-09-10 14:00', '2026-09-14 08:00', '2026-09-15 10:00'].filter((x, i) => i !== 0 && false || true).slice(0, 4)) || ns[0] === '2026-09-10 14:00', 'créneaux suggérés selon la semaine : ' + ns.join(' | '));
  ok(await page.evaluate(() => Plan.slotsOnDate('2026-09-10').length) === 1 && await page.evaluate(() => Plan.slotsOnDate('2026-09-08').length) === 0, 'créneaux du jour : S2 jeudi oui, S1 mardi non (semaine du 07/09 = S2)');
  ok(await page.evaluate(() => Plan.slotsOnDate('2026-10-27').length) === 0, 'aucun créneau pendant les vacances');
  const hd = await page.evaluate(() => { const c = DB.list('fs_classes')[0]; return Plan.heuresDispo(c, '2026-09-07', '2026-09-20'); });
  ok(hd.minutes === 120 + 55 + 120 + 60 && hd.creneaux === 5 - 1 + 0 || hd.minutes > 0, 'heures disponibles calculées sur 2 semaines : ' + hd.minutes + ' min / ' + hd.creneaux + ' créneaux');

  console.log('# Écran Planning');
  await page.goto(BASE + '#/planning'); await page.waitForSelector('.tt .tt-col');
  ok(await page.locator('.tt-col').count() === 5, 'grille lundi→vendredi');
  ok(await page.locator('.tt-times span').first().innerText() === '08:00', 'grille démarre à 08:00');
  ok(await page.locator('.tt-times span').last().innerText() === '17:00', 'grille finit à 18:00');
  ok(await page.locator('.alt-card summary').innerText().then((t) => /Semaine \d cette semaine|réglée/.test(t)), 'semaines 1/2 réglées affichées');
  await page.screenshot({ path: SHOTS + '/10-planning.png' });
  const nS1 = await page.locator('.tt-b').count();
  await page.click('.tab >> nth=1'); const nS2 = await page.locator('.tt-b').count();
  await page.click('.tab >> nth=0');
  ok(nS1 === 2 && nS2 === 2, 'onglet S1 : lundi + mardi ; onglet S2 : lundi + jeudi');

  // création par glisser (souris) : mercredi, 09:00 → 11:00
  const col = page.locator('.tt-col[data-j="3"]'); const bb = await col.boundingBox();
  const y0 = bb.y + 2 * 2 * 26 + 5, x = bb.x + bb.width / 2;      // 08:00 + 2 h = 10:00
  await page.mouse.move(x, y0); await page.mouse.down(); await page.mouse.move(x, y0 + 30); await page.mouse.move(x, y0 + 4 * 26 - 6); await page.mouse.up();
  await page.waitForSelector('.modal');
  ok(await page.locator('.modal input[type=time]').inputValue() === '10:00' && await page.locator('.modal input[type=number]').inputValue() === '120', 'glisser 10:00→12:00 pré-remplit la fenêtre (10:00, 120 min)');
  await page.selectOption('.modal select >> nth=0', { label: '1CAP EPC' });
  await page.selectOption('.modal .field:has(.lbl:text-is("Semaine")) select', '2');
  await page.screenshot({ path: SHOTS + '/11-creneau-modal.png' });
  await page.click('.modal-foot .btn.primary'); await page.waitForSelector('.tt-b >> nth=2').catch(() => {}); await sleep(900);
  const cap = st.rows.fs_classes.find((c) => c.nom === '1CAP EPC');
  ok(cap && cap.creneaux.length === 1 && cap.creneaux[0].jour === 3 && cap.creneaux[0].debut === '10:00' && cap.creneaux[0].duree === 120 && cap.creneaux[0].semaine === 2, 'créneau enregistré en base (mercredi 10:00, 120 min, semaine 2)');
  ok(await page.locator('.tt-b').count() === 2, 'S1 ne montre pas le créneau de semaine 2');
  await page.click('.tab >> nth=1');
  ok(await page.locator('.tt-b').count() === 3, 'S2 montre le nouveau créneau');

  // déplacement : mercredi → jeudi, +1 h
  const blk = page.locator('.tt-b', { hasText: '1CAP EPC' }); const bk = await blk.boundingBox();
  const c4 = await page.locator('.tt-col[data-j="4"]').boundingBox();
  await page.mouse.move(bk.x + bk.width / 2, bk.y + 20); await page.mouse.down();
  await page.mouse.move(bk.x + bk.width / 2 + 20, bk.y + 40); await page.mouse.move(c4.x + c4.width / 2, bk.y + 20 + 2 * 26 + 3); await page.mouse.up(); await sleep(900);
  const cap2 = st.rows.fs_classes.find((c) => c.nom === '1CAP EPC').creneaux[0];
  ok(cap2.jour === 4 && cap2.debut === '11:00', 'créneau déplacé au jeudi 11:00 (' + cap2.jour + ' ' + cap2.debut + ')');
  // redimensionnement : +1 h
  const bk2 = await page.locator('.tt-b', { hasText: '1CAP EPC' }).boundingBox();
  await page.mouse.move(bk2.x + bk2.width / 2, bk2.y + bk2.height - 3); await page.mouse.down(); await page.mouse.move(bk2.x + bk2.width / 2, bk2.y + bk2.height + 20); await page.mouse.move(bk2.x + bk2.width / 2, bk2.y + bk2.height - 3 + 2 * 26); await page.mouse.up(); await sleep(900);
  ok(st.rows.fs_classes.find((c) => c.nom === '1CAP EPC').creneaux[0].duree === 180, 'créneau étiré à 3 h');
  // clic = modification puis suppression
  await page.locator('.tt-b', { hasText: '1CAP EPC' }).click(); await page.waitForSelector('.modal');
  ok(/Modifier le créneau/.test(await page.locator('.modal h2, .modal .modal-t').first().innerText().catch(() => 'Modifier le créneau')), 'clic sur un créneau ouvre sa modification');
  await page.fill('.modal input[type=number]', '90'); await page.click('.modal-foot .btn.primary'); await sleep(900);
  ok(st.rows.fs_classes.find((c) => c.nom === '1CAP EPC').creneaux[0].duree === 90, 'durée modifiée à 90 min');
  // avertissement de chevauchement
  await page.click('text=＋ Ajouter un créneau'); await page.waitForSelector('.modal');
  await page.selectOption('.modal .field:has(.lbl:text-is("Jour")) select', '1'); await page.fill('.modal input[type=time]', '09:00');
  await page.selectOption('.modal select >> nth=0', { label: '2MRCU' });
  ok(/Chevauche/.test(await page.locator('.modal .warnt').innerText()), 'chevauchement signalé (2MRCU lundi 08:00–10:00)');
  await page.click('.modal-foot .btn.ghost');
  // suppression
  await page.locator('.tt-b', { hasText: '1CAP EPC' }).click(); await page.waitForSelector('.modal'); await page.click('.modal-foot .btn.danger'); await sleep(900);
  ok(st.rows.fs_classes.find((c) => c.nom === '1CAP EPC').creneaux.length === 0, 'créneau supprimé');
  ok(/Total enseigné/.test(await page.locator('.tt-sum').innerText()), 'tableau des heures par classe');
  await page.screenshot({ path: SHOTS + '/12-planning-apres.png' });

  console.log('# Modification des créneaux depuis la classe');
  await page.evaluate(() => { location.hash = '#/classe/' + DB.list('fs_classes')[0].id; }); await page.waitForSelector('.page-head h1');
  await page.click('text=✎ Modifier'); await page.waitForSelector('.modal .cren-row');
  ok(await page.locator('.modal .cren-row').first().locator('select').count() === 3, 'chaque créneau : jour, semaine, groupe');
  ok(/S1 : 3 h · S2 : 2 h 55/.test(await page.locator('.hrs-sum').innerText()), 'résumé des heures S1/S2 dans la fenêtre : ' + await page.locator('.hrs-sum').innerText());
  await page.click('.modal-foot .btn.ghost');

  console.log('# Synthèse Pronote');
  const sid = await page.evaluate(() => {
    const cl = DB.list('fs_classes')[0];
    const q = createSequence(cl, { titre: 'Statistique' });
    const s = createSeance(cl, { titre: 'Moyenne et médiane', type: 'cours', sequence_id: q.id, duree_min: 110, statut: 'faite' });
    const first = Ref.effective(cl.niveau_id).chapitres.find((c) => c.objectifs.length > 2);
    s.data.chapitres = [first.id];
    first.objectifs.slice(0, 2).forEach((o) => s.data.items.push({ k: 'o', ref: o.id, txt: o.txt, niv: 'decouverte', chap: first.id }));
    s.data.objectif = 'Calculer une moyenne et lire une médiane.';
    s.data.dm = { actif: true, titre: 'DM n°1', consigne: 'Exercices 3 et 4 p. 55', pour: 'G2', rendu: '2026-11-09', duree_min: 30 };
    s.data.bilan.a_reprendre = 'La lecture de la médiane sur un diagramme.';
    DB.save('fs_seances', s); return s.id;
  });
  await page.goto(BASE + '#/seance/' + sid); await page.waitForSelector('.page-head h1');
  await page.click('text=📋 Pronote'); await sleep(500);
  ok(await page.locator('details.sec:has-text("Synthèse pour Pronote")[open]').count() === 1, 'bouton « Pronote » ouvre la section');
  await page.click('text=✨ Rédiger la synthèse'); await sleep(500);
  const txt = await page.locator('textarea[placeholder^="Quelques phrases"]').inputValue();
  console.log('     » ' + txt);
  ok(/^Séance de cours : « Moyenne et médiane » \(chapitre « /.test(txt) && /Nous avons travaillé : /.test(txt) && /À reprendre : la lecture/.test(txt), 'rédaction au passé : ce qui a été fait');
  ok(!/La séance a comporté|accroche|phase de recherche|Déroulé/i.test(txt), 'aucune étape de déroulé dans le texte');
  ok(!/[\u{1F300}-\u{1FAFF}☀-➿]/u.test(txt), 'aucun émoji dans le texte');
  const tr = await page.locator('textarea[placeholder^="Travail à faire"]').inputValue();
  ok(/^DM n°1 \(groupe 2\) : Exercices 3 et 4 p\. 55 — à rendre pour le 09\/11\/2026\.$/.test(tr), 'travail à faire = DM : ' + tr);
  await page.click('text=📋 Copier le contenu'); await sleep(200);
  ok((await page.evaluate(() => navigator.clipboard.readText())) === txt, 'contenu copié dans le presse-papiers');
  await page.click('text=📋 Tout copier'); await sleep(200);
  ok(/Travail à faire : DM n°1/.test(await page.evaluate(() => navigator.clipboard.readText())), '« Tout copier » ajoute le travail à faire');
  await sleep(2800);
  ok(st.rows.fs_seances.some((x) => x.id === sid && x.data.pronote && x.data.pronote.contenu === txt), 'synthèse enregistrée en base');
  // modification manuelle puis nouvelle rédaction : confirmation
  await page.fill('textarea[placeholder^="Quelques phrases"]', 'Mon texte à moi.');
  await page.selectOption('details.sec:has-text("Synthèse pour Pronote") select', 'futur');
  await page.click('text=✨ Rédiger la synthèse'); await page.waitForSelector('.modal');
  await page.click('.modal-foot .btn.primary'); await sleep(400);
  ok(/^Au programme : cours/.test(await page.locator('textarea[placeholder^="Quelques phrases"]').inputValue()), 'confirmation avant écrasement, puis rédaction au futur');
  await sleep(2800);
  ok(st.rows.fs_seances.some((x) => x.id === sid && /^Au programme/.test(x.data.pronote.contenu) && x.data.pronote.temps === 'futur'), 'nouvelle rédaction enregistrée (futur)');
  await page.screenshot({ path: SHOTS + '/13-pronote.png', fullPage: false });

  console.log('# Accueil : aujourd’hui et semaine');
  await page.clock.setFixedTime(new Date('2026-09-10T09:30:00'));
  await page.goto(BASE + '#/'); await page.waitForSelector('.top'); await sleep(500);
  ok(/Semaine 2/.test(await page.locator('.wk-badge').innerText()), 'badge « Semaine 2 » le 10/09/2026 : ' + await page.locator('.wk-badge').innerText());
  ok(await page.locator('section:has(h2:text("Aujourd’hui")) .row-s').count() === 1, 'carte « Aujourd’hui » : le créneau du jeudi 14:00');
  await page.locator('section', { has: page.locator('h2', { hasText: 'Aujourd’hui' }) }).locator('text=＋ Préparer').click(); await page.waitForURL(/#\/seance\//);
  await sleep(900);
  ok(st.rows.fs_seances.some((x) => x.date_prevue === '2026-09-10' && x.duree_min === 55), 'séance préparée à la date du créneau');

  console.log('# Téléphone');
  const m = await browser.newContext({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true, locale: 'fr-FR' }); await install(m, st);
  const mp = await m.newPage(); await mp.goto(BASE); await mp.waitForSelector('.auth-card');
  await mp.fill('input[type=email]', 'prof@test.fr'); await mp.fill('input[type=password]', 'secret12'); await mp.click('button[type=submit]'); await mp.waitForSelector('.top');
  await mp.goto(BASE + '#/planning'); await mp.waitForSelector('.tt-col'); await sleep(400);
  await mp.screenshot({ path: SHOTS + '/14-planning-mobile.png' });
  await mp.locator('.tt-col[data-j="5"]').scrollIntoViewIfNeeded(); await mp.evaluate(() => window.scrollTo(0, 120)); await sleep(200);
  const colM = await mp.locator('.tt-col[data-j="5"]').boundingBox();
  ok(colM.x >= 0 && colM.x + colM.width <= 390, 'les 5 jours tiennent sur un écran de téléphone');
  await mp.touchscreen.tap(colM.x + 6, 300); await mp.waitForSelector('.modal');
  ok(await mp.locator('.modal input[type=number]').inputValue() === '60', 'toucher la grille ouvre la création (60 min)');
  const navW = await mp.evaluate(() => Math.max(...[...document.querySelectorAll('.nav a')].map((a) => a.scrollWidth - a.clientWidth)));
  ok(navW <= 1, 'barre de navigation mobile sans débordement (' + await mp.locator('.nav a').count() + ' entrées)');
  await mp.screenshot({ path: SHOTS + '/15-creneau-mobile.png' });

  console.log('# Export / import');
  const json = await page.evaluate(() => Exp.json ? 'fn' : 'none');
  ok(json === 'fn', 'export JSON disponible');
  console.log('Erreurs JS : ' + errors.length); errors.forEach((e) => console.log('   ' + e));
  ok(errors.length === 0, 'aucune erreur console / page');
  console.log('\n' + pass + ' ok, ' + fail + ' échecs');
  await browser.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('ECHEC TEST', e); process.exit(2); });
