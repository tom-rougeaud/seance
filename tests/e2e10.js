'use strict';
/* « Mon année » : périodes entre vacances, une pastille par semaine, emploi du temps de la semaine, éditeur de séance, retour */
const { chromium } = require('playwright');
const { install, makeState } = require('./mock-supabase');
const BASE = (process.env.BASE || 'http://127.0.0.1:8765/index.html');
const SHOT = process.env.SHOT || '';
let pass = 0, fail = 0;
function ok(c, msg) { if (c) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ ' + msg); } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch(); const st = makeState();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, locale: 'fr-FR' }); await install(ctx, st);
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/status of (400|404)/.test(m.text())) errors.push('console: ' + m.text()); });
  await page.goto(BASE); await page.waitForSelector('.auth-card'); await page.fill('input[type=email]', 'prof@test.fr'); await page.fill('input[type=password]', 'secret12'); await page.click('.auth-card button[type=submit]'); await page.waitForSelector('#view');

  console.log('# Mise en place');
  const cid = await page.evaluate(() => {
    Plan.PRESETS['2026-2027'].forEach((p) => DB.create('fs_calendrier', { annee_scolaire: '2026-2027', class_id: null, type: p.type, label: p.label, debut: p.debut, fin: p.fin }));
    Plan.setAltConfig('2026-2027', { lundi: '2026-08-31', type: 1, sauter_vacances: false });
    const a = DB.create('fs_classes', { nom: '2MRCU', niveau_id: 'bp2', groupement: 'A', avec_pc: true, poursuite: false, metier: '', annee_scolaire: '2026-2027', couleur: '#2B4C7E', creneaux: [{ jour: 1, debut: '08:00', duree: 110, semaine: 1 }, { jour: 4, debut: '09:00', duree: 55, semaine: 2 }, { jour: 3, debut: '14:00', duree: 55, matiere: 'co_inter' }], notes: '', ordre: 0 });
    DB.create('fs_classes', { nom: '1CAP', niveau_id: 'bp2', groupement: 'A', avec_pc: true, poursuite: false, metier: '', annee_scolaire: '2026-2027', couleur: '#3F7A5C', creneaux: [], notes: '', ordre: 1 });
    return a.id;
  });

  console.log('# La page « Mon année »');
  await page.goto(BASE + '#/annee'); await page.waitForSelector('.an-per');
  const titles = await page.locator('.an-per h2').allInnerTexts();
  ok(titles.length === 5 && titles[0] === 'Rentrée → Toussaint' && titles[1] === 'Toussaint → Noël', 'cinq périodes entre les vacances : ' + titles.join(' | '));
  const nW = await page.locator('.an-w').count();
  ok(nW >= 36 && nW <= 42, 'une pastille par semaine travaillée (' + nW + ')');
  ok((await page.locator('.an-per').nth(0).locator('.an-w').count()) === 7, 'rentrée → Toussaint : 7 semaines');
  ok(await page.locator('.an-vac').count() === 4, 'les vacances sont de simples séparateurs, sans pastille');
  ok((await page.locator('.an-w').first().innerText()).replace(/\s+/g, ' ').trim() === 'S1 31/8 0/2', 'pastille : semaine, date du lundi, séances préparées');
  ok((await page.locator('.an-cl').allInnerTexts()).join() === 'Toutes,2MRCU,1CAP' && (await page.locator('.an-cl.on').innerText()) === 'Toutes', 'filtre de classe : Toutes (par défaut), puis chaque classe');
  ok(await page.locator('.an-w.on').count() === 1, 'une semaine est déjà sélectionnée (la prochaine à venir)');

  console.log('# Toucher une semaine : mon emploi du temps apparaît');
  await page.click('.an-w[data-w="2026-08-31"]');
  ok(await page.locator('.an-tt .tt-dh').count() === 5, 'grille de la semaine : 5 jours');
  ok((await page.locator('.an-tt .tt-dh').allInnerTexts()).join('|').replace(/\s+/g, ' ') === 'Lundi 31|Mardi 1|Mercredi 2|Jeudi 3|Vendredi 4', 'jours datés');
  let blocks = await page.locator('.an-tb').allInnerTexts();
  ok(blocks.length === 2 && /2MRCU/.test(blocks[0]) && /08:00–09:50/.test(blocks[0]) && /Préparer/.test(blocks[0]), 'semaine 1 : 2 cours en blocs (lundi + mercredi co-inter) — ' + blocks.map((x) => x.replace(/\s+/g, ' ')).join(' / '));
  ok(/Co-inter/.test(blocks[1]), 'les autres matières sont des blocs cliquables aussi');
  ok(await page.locator('.an-tb.has').count() === 0, 'aucun bloc plein : rien n’est encore préparé');
  await page.click('button[aria-label="Semaine suivante"]');
  ok(/Semaine du 7 sept\. · S2/.test(await page.locator('.an-st h2').innerText()) && await page.locator('.an-tb').count() === 2, 'flèche « semaine suivante » : semaine 2, cours du jeudi');
  await page.click('button[aria-label="Semaine précédente"]');

  console.log('# Toucher un cours : l’éditeur de séance s’ouvre directement');
  await page.locator('.an-tb').first().click(); await page.waitForFunction(() => /#\/seance\//.test(location.hash));
  ok(await page.locator('.modal').count() === 0, 'aucune fenêtre intermédiaire');
  const s1 = await page.evaluate(() => DB.list('fs_seances')[0]);
  ok(s1.date_prevue === '2026-08-31' && s1.duree_min === 110, 'séance créée à la bonne date, durée du créneau (' + s1.date_prevue + ', ' + s1.duree_min + ' min)');
  ok(s1.data.creneau && s1.data.creneau.debut === '08:00' && s1.data.creneau.matiere === 'maths', 'le créneau est mémorisé dans la séance');
  ok((await page.locator('#view input[type=date]').first().inputValue()) === '2026-08-31', 'c’est le même éditeur de séance, avec la bonne date');
  ok(/Mon emploi du temps \(semaine du 31 août\)/.test(await page.locator('.page-head .back').innerText()), 'lien de retour en haut : mon emploi du temps');
  await page.waitForSelector('.guide .btn.primary.big');
  ok(/Valider et revenir à mon emploi du temps/.test(await page.locator('.guide .btn.primary.big').innerText()), 'bouton principal en bas : valider et revenir');

  console.log('# Valider : retour à l’emploi du temps de la même semaine');
  await page.click('.guide .btn.primary.big'); await page.waitForFunction(() => location.hash === '#/annee'); await page.waitForSelector('.an-tt');
  ok((await page.locator('.an-w.on').getAttribute('data-w')) === '2026-08-31', 'on retrouve la même semaine');
  ok(await page.locator('.an-tb.has').count() === 1 && /prête/.test(await page.locator('.an-tb.has').innerText()), 'le cours est maintenant plein : séance prête');
  ok((await page.locator('.an-w[data-w="2026-08-31"]').innerText()).replace(/\s+/g, ' ').includes('1/2'), 'pastille « 1/2 »');
  ok((await page.evaluate(() => DB.list('fs_seances')[0].statut)) === 'prete', 'séance marquée « prête »');
  await page.locator('.an-tb').nth(1).click(); await page.waitForFunction(() => /#\/seance\//.test(location.hash)); await sleep(200);
  const s2 = await page.evaluate(() => DB.list('fs_seances').filter((s) => s.date_prevue === '2026-09-02')[0]);
  ok(s2 && s2.modalite === 'co_intervention' && s2.duree_min === 55, 'cours de co-intervention : modalité et durée reprises');
  await page.click('.guide .btn.primary.big'); await page.waitForFunction(() => location.hash === '#/annee'); await page.waitForSelector('.an-tt');
  ok((await page.locator('.an-w[data-w="2026-08-31"]').innerText()).includes('✓'), 'toutes les séances de la semaine préparées : ✓ sur la pastille');
  await page.locator('.an-tb').first().click(); await page.waitForFunction(() => /#\/seance\//.test(location.hash));
  ok((await page.evaluate(() => DB.list('fs_seances').length)) === 2, 'un cours déjà préparé rouvre sa séance (pas de doublon)');
  await page.goBack(); await page.waitForSelector('.an-tt');

  console.log('# Séances anciennes ou hors créneau');
  await page.evaluate((id) => { const cl = Cls.get(id); createSeance(cl, { date_prevue: '2026-09-14', titre: 'Ancienne séance' }); createSeance(cl, { date_prevue: '2026-09-15', titre: 'Séance hors créneau' }); }, cid);
  await page.goto(BASE + '#/annee'); await page.waitForSelector('.an-per'); await page.click('.an-w[data-w="2026-09-14"]');
  ok(/Ancienne séance/.test(await page.locator('.an-tb.has').first().innerText()), 'une ancienne séance est rattachée au créneau du jour');
  ok(/Séance hors créneau/.test(await page.locator('.an-other').first().innerText()), 'une séance hors créneau est listée sous la grille');

  console.log('# Séquence par glissement (toutes classes : on demande la classe)');
  const box = async (w) => (await page.locator('.an-w[data-w="' + w + '"]').boundingBox());
  const a = await box('2026-09-07'), b = await box('2026-09-21');
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
  ok(await page.locator('.an-w.drag').count() === 3, 'pendant le glissement, les 3 semaines sont surlignées');
  await page.mouse.up(); await page.waitForSelector('.modal');
  ok(/Pour quelle classe/.test(await page.locator('.modal').innerText()), 'avec « Toutes », la classe est demandée');
  await page.selectOption('.modal select', cid); await page.click('.modal-foot .btn.primary'); await sleep(250);
  let seqs = await page.evaluate(() => DB.list('fs_sequences'));
  ok(seqs.length === 1 && seqs[0].data.plan.a === '2026-09-07' && seqs[0].data.plan.b === '2026-09-25', 'séquence du 07/09 au 25/09 : ' + JSON.stringify(seqs[0] && seqs[0].data.plan));
  ok(await page.locator('.an-bar').count() === 3, 'un trait coloré sous chacune des 3 pastilles');
  ok(await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('an-name')), 'le champ nom est prêt à la saisie');
  const info = (await page.locator('.an-band .an-info').first().innerText()).replace(/\s+/g, ' ');
  ok(/3 semaines/.test(info) && /prévu : 6 h 25/.test(info), 'durée prévue calculée d’après les créneaux : ' + info);
  await page.keyboard.type('Pourcentages'); await page.keyboard.press('Tab'); await sleep(200);
  ok((await page.evaluate(() => DB.list('fs_sequences')[0].titre)) === 'Pourcentages', 'nom enregistré');
  await page.click('.an-w[data-w="2026-09-14"]');
  if (SHOT) await page.screenshot({ path: SHOT + '/annee-bureau.png', fullPage: true });
  ok(/Pourcentages/.test(await page.locator('.an-inband').innerText()), 'la semaine indique sa séquence');
  await page.click('.an-w[data-w="2026-09-21"]'); await page.locator('.an-tb').first().click(); await page.waitForFunction(() => /#\/seance\//.test(location.hash));
  const s3 = await page.evaluate(() => DB.list('fs_seances').filter((s) => s.date_prevue === '2026-09-23')[0]);
  ok(s3 && s3.sequence_id === seqs[0].id, 'la séance d’une semaine de la séquence est rattachée à la séquence');
  await page.goto(BASE + '#/annee'); await page.waitForSelector('.an-per');

  console.log('# Filtre par classe, séquence par deux touchers');
  await page.click('.an-cl:has-text("2MRCU")');
  await page.click('.an-w[data-w="2026-11-02"]'); await page.click('text=Prévoir une séquence à partir d’ici');
  ok(await page.locator('.an-pick').count() === 1, 'invitation « touchez la dernière semaine »');
  await page.click('.an-w[data-w="2026-11-09"]'); await sleep(250);
  seqs = await page.evaluate(() => DB.list('fs_sequences'));
  ok(await page.locator('.modal').count() === 0 && seqs.length === 2 && seqs[1].data.plan.a === '2026-11-02' && seqs[1].data.plan.b === '2026-11-13', 'avec une classe choisie : séquence du 02/11 au 13/11, sans question');

  console.log('# Retirer');
  await page.locator('.an-per').nth(1).locator('.an-band').getByText('Retirer').click(); await sleep(200);
  ok((await page.evaluate(() => DB.list('fs_sequences').length)) === 1, 'séquence vide supprimée');
  await page.evaluate(() => { const q = DB.list('fs_sequences')[0]; const cl = Cls.get(q.class_id); createSeance(cl, { sequence_id: q.id, date_prevue: '2026-09-08', titre: 'Dans la séquence' }); });
  await page.reload(); await page.waitForSelector('.an-per');
  await page.locator('.an-per').nth(0).locator('.an-band').first().getByText('Retirer').click(); await sleep(200);
  const q0 = await page.evaluate(() => DB.list('fs_sequences')[0]);
  ok(q0 && q0.data.plan === null && (await page.evaluate(() => DB.list('fs_seances').filter((s) => s.titre === 'Dans la séquence').length)) === 1, 'séquence avec contenu : seulement retirée du calendrier, séances conservées');

  console.log('# Classe sans créneaux');
  await page.click('.an-cl:has-text("1CAP")');
  ok(/Aucun créneau n’est encore saisi/.test(await page.locator('.an-side').innerText()), 'invitation à remplir l’emploi du temps');
  await page.click('.an-cl:has-text("Toutes")');

  console.log('# Navigation et téléphone');
  ok((await page.locator('.nav a').allInnerTexts()).some((t) => /Mon année/.test(t)), 'entrée « Mon année » dans le menu');
  const mob = await ctx.newPage(); await mob.setViewportSize({ width: 390, height: 844 });
  await mob.goto(BASE + '#/annee'); await mob.waitForSelector('.an-per'); await mob.click('.an-w[data-w="2026-08-31"]'); await sleep(600);
  const over = await mob.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok(over <= 1, 'pas de défilement horizontal sur téléphone (' + over + ' px)');
  const dim = await mob.evaluate(() => { const r = Array.from(document.querySelectorAll('.an-w')).map((e) => e.getBoundingClientRect()); return [Math.min.apply(null, r.map((x) => x.width)), Math.min.apply(null, r.map((x) => x.height))]; });
  ok(dim[0] >= 44 && dim[1] >= 44, 'pastilles assez grandes pour le doigt (' + Math.round(dim[0]) + '×' + Math.round(dim[1]) + ' px)');
  ok(await mob.evaluate(() => { const n = document.querySelector('.nav'); return n.scrollWidth - n.clientWidth <= 1; }), 'le menu du bas tient en largeur avec 8 entrées');
  ok(await mob.locator('.an-tb').count() === 2, 'l’emploi du temps de la semaine s’affiche aussi sur téléphone');
  if (SHOT) await mob.screenshot({ path: SHOT + '/annee-tel.png', fullPage: false });

  ok(errors.length === 0, 'aucune erreur JS' + (errors.length ? ' : ' + errors.join(' ; ') : ''));
  await browser.close(); console.log('\nRésultat : ' + pass + ' ✓, ' + fail + ' ✗'); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
