'use strict';
/* Correspondance manuels, texte Pronote (versions 1 et 2), alternance sans saut, créneau par défaut */
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
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'fr-FR' }); await install(ctx, st);
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/status of (400|404)/.test(m.text())) errors.push('console: ' + m.text()); });
  await login(page);

  console.log('# Manuels : identifiants du BO valides et correspondance');
  const chk = await page.evaluate(() => {
    const out = { bad: [], noMatch: [], levels: {} };
    ['pm', 'bp2', 'bp1', 'bpt'].forEach((n) => {
      const man = Manuels.get(n), e = Ref.effective(n), ids = e.chapitres.map((c) => c.id);
      let mapped = 0;
      man.chap.forEach((c) => c.refs.forEach((r) => { if (ids.indexOf(r) < 0) out.bad.push(n + ':' + r); }));
      e.chapitres.forEach((c) => {
        const d = { chapitres: [c.id], items: c.objectifs.concat(c.connaissances).map((i) => ({ k: 'o', ref: i.id, txt: i.txt, chap: c.id })), objectif: '' };
        const m = Manuels.match(n, d, '');
        if (m && m.length) mapped++; else out.noMatch.push(c.id);
      });
      out.levels[n] = { chapMan: man.chap.length, chapBO: e.chapitres.length, mapped };
    });
    out.cap = Manuels.has('cap');
    return out;
  });
  ok(chk.bad.length === 0, 'toutes les références de chapitres existent dans le BO (' + chk.bad.join(',') + ')');
  console.log('     chapitres sans manuel :', chk.noMatch.join(', '));
  ok(chk.levels.bp2.mapped === 6 && chk.levels.bp1.mapped === 8 && chk.levels.bpt.mapped >= 7 && chk.levels.pm.mapped >= 12, 'chapitres du BO reliés à un chapitre de manuel : ' + JSON.stringify(Object.fromEntries(Object.entries(chk.levels).map(([k, v]) => [k, v.mapped + '/' + v.chapBO]))));
  ok(chk.cap === false, 'CAP : pas de manuel (version 2 non proposée)');

  console.log('# Texte Pronote');
  const ids = await page.evaluate(() => {
    const cl = DB.create('fs_classes', { nom: '2MRCU', niveau_id: 'bp2', groupement: 'A', avec_pc: true, poursuite: false, metier: '', annee_scolaire: '2026-2027', couleur: '#2B4C7E', creneaux: [], notes: '', archive: false, ordre: 0 });
    const cap = DB.create('fs_classes', { nom: '1CAP', niveau_id: 'cap', groupement: null, avec_pc: true, poursuite: false, metier: '', annee_scolaire: '2026-2027', couleur: '#4C8A6B', creneaux: [], notes: '', archive: false, ordre: 1 });
    const e = Ref.effective('bp2'), ch = e.chapitres.find((c) => c.id === 'bp2.stat1');
    const s = createSeance(cl, { titre: 'Moyenne et médiane', type: 'cours', statut: 'faite' });
    const its = ch.objectifs.concat(ch.connaissances).filter((i) => /moyenne|m[ée]diane|quartile/i.test(i.txt)).slice(0, 3);
    s.data.chapitres = [ch.id]; its.forEach((o) => s.data.items.push({ k: ch.objectifs.indexOf(o) >= 0 ? 'o' : 'k', ref: o.id, txt: o.txt, niv: 'decouverte', chap: ch.id }));
    s.data.phases = [{ phase: 'accroche', duree: 5, orga: 'collectif', contenu: 'x' }, { phase: 'exercices', duree: 40, orga: 'binomes', contenu: 'y' }];
    DB.save('fs_seances', s);
    const s2 = createSeance(cap, { titre: 'Stat CAP', type: 'cours', statut: 'faite' }); s2.data.chapitres = ['cap.stat1']; DB.save('fs_seances', s2);
    return { s: s.id, s2: s2.id };
  });
  const d1 = await page.evaluate((id) => { const s = DB.byId('fs_seances', id), cl = Cls.get(s.class_id); return { v1: Pronote.draft(s, cl, 'passe', 1), v2: Pronote.draft(s, cl, 'passe', 2), f2: Pronote.draft(s, cl, 'futur', 2) }; }, ids.s);
  console.log('     V1 » ' + d1.v1.contenu + '\n     V2 » ' + d1.v2.contenu + '\n     V2 travail » ' + d1.v2.travail + '\n     V2 futur » ' + d1.f2.contenu);
  ok(!/accroche|exercices d’entraînement|La séance a comporté|Déroulé/i.test(d1.v1.contenu) && /Nous avons travaillé : /.test(d1.v1.contenu), 'V1 : ce qui a été traité, aucune étape du déroulé');
  ok(d1.v2.contenu !== d1.v1.contenu && !/indicateurs de position/.test(d1.v2.contenu) && /^Séance de cours : « Moyenne et médiane »/.test(d1.v2.contenu), 'V2 distincte de V1 : s’appuie sur le manuel, pas sur les phrases du BO');
  ok(d1.v1.manuel === false && !/manuel/.test(d1.v1.contenu), 'V1 : sans renvoi au manuel');
  ok(d1.v2.manuel && /manuel « Maths et MCV · 2de » : chapitre 2 « Statistique à une variable »/.test(d1.v2.contenu) && /« La moyenne »/.test(d1.v2.contenu) && /https:\/\/tom-rougeaud\.github\.io\/mcv\/2de\//.test(d1.v2.contenu), 'V2 : renvoi au manuel 2de, chapitre 2 et notions reconnues, lien de l’appli');
  ok(/^Revoir /.test(d1.v2.travail) && /chapitre 2/.test(d1.v2.travail), 'V2 : travail à faire proposé (revoir la notion dans le manuel)');
  ok(/^Au programme : cours « Moyenne et médiane »/.test(d1.f2.contenu) && /Nous allons travailler avec le manuel/.test(d1.f2.contenu), 'V2 au futur');
  ok(!/[\u{1F300}-\u{1FAFF}☀-➿]/u.test(d1.v2.contenu), 'aucun émoji');
  const capv2 = await page.evaluate((id) => { const s = DB.byId('fs_seances', id); return Pronote.draft(s, Cls.get(s.class_id), 'passe', 2); }, ids.s2);
  ok(capv2.manuel === false && !/manuel/.test(capv2.contenu), 'CAP : version 2 retombe sur la version 1');

  console.log('# Interface Pronote');
  await page.goto(BASE + '#/seance/' + ids.s); await page.waitForSelector('.page-head h1');
  await page.click('text=📋 Pronote'); await sleep(400);
  await page.click('text=✨ Version 1 · ce qui a été fait'); await sleep(400);
  const t1 = await page.locator('textarea[placeholder^="Quelques phrases"]').inputValue();
  ok(/Nous avons travaillé : /.test(t1) && !/manuel/.test(t1), 'bouton version 1 : texte sans manuel');
  await page.click('text=✨ Version 2 · avec mes manuels'); await page.waitForSelector('.modal'); await page.click('.modal-foot .btn.primary'); await sleep(500);
  const t2 = await page.locator('textarea[placeholder^="Quelques phrases"]').inputValue();
  ok(/manuel « Maths et MCV · 2de »/.test(t2) && t2 !== t1, 'bouton version 2 : texte distinct, avec les manuels');
  const trv = await page.locator('textarea[placeholder^="Travail à faire"]').inputValue(); ok(/^Revoir /.test(trv), 'travail à faire pré-rempli : ' + trv.slice(0, 60));
  await page.click('text=✨ Version 1 · ce qui a été fait'); await page.waitForSelector('.modal'); await page.click('.modal-foot .btn.primary'); await sleep(400);
  ok(await page.locator('textarea[placeholder^="Travail à faire"]').inputValue() === '', 'retour à la version 1 : le travail à faire généré par la version 2 est retiré');
  await sleep(2800);
  ok(st.rows.fs_seances.some((x) => x.id === ids.s && x.data.pronote && /Nous avons travaillé : /.test(x.data.pronote.contenu)), 'texte enregistré en base');
  await page.screenshot({ path: SHOTS + '/40-pronote-v2.png' });
  await page.goto(BASE + '#/seance/' + ids.s2); await page.waitForSelector('.page-head h1'); await page.click('text=📋 Pronote'); await sleep(300);
  ok(await page.locator('details.sec:has-text("Synthèse pour Pronote") button:has-text("Version 2")[disabled]').count() === 1, 'CAP : bouton version 2 désactivé (aucun manuel pour ce niveau)');

  console.log('# Alternance sans saut de semaine');
  const wk = await page.evaluate(() => {
    DB.create('fs_calendrier', { annee_scolaire: '2026-2027', class_id: null, type: 'vacances', label: 'Toussaint', debut: '2026-10-19', fin: '2026-11-01' });
    Plan.setAltConfig('2026-2027', { lundi: '2026-08-31', type: 1 });
    const g = (d) => Plan.weekType(d, '2026-2027');
    return { avant: g('2026-10-12'), vac1: g('2026-10-19'), vac2: g('2026-10-26'), apres: g('2026-11-02'), cfg: DB.settings().alternance['2026-2027'] };
  });
  ok(wk.avant === 1 && wk.vac1 === 2 && wk.vac2 === 1 && wk.apres === 2, 'les semaines de vacances comptent : ' + JSON.stringify([wk.avant, wk.vac1, wk.vac2, wk.apres]) + ' (calendrier continu)');
  ok(wk.cfg.sauter_vacances !== true, 'réglage « sauter les vacances » désactivé par défaut');
  await page.goto(BASE + '#/planning'); await page.waitForSelector('.alt-card');
  await page.click('.alt-card summary').catch(() => {});
  ok(await page.locator('.alt-card input[type=checkbox]').isChecked() === false, 'case « sauter les vacances » décochée');

  console.log('# Nouveau créneau : pas « les deux semaines » par défaut');
  await page.click('.tab:has-text("2")').catch(() => {});
  const col = page.locator('.tt-col[data-j="2"]'); await col.waitFor(); const bb = await col.boundingBox();
  await page.mouse.move(bb.x + bb.width / 2, bb.y + 60); await page.mouse.down(); await page.mouse.move(bb.x + bb.width / 2, bb.y + 90); await page.mouse.move(bb.x + bb.width / 2, bb.y + 140); await page.mouse.up();
  await page.waitForSelector('.modal');
  const semv = await page.locator('.modal .field:has(.lbl:text-is("Semaine")) select').inputValue();
  ok(semv === '2', 'créneau créé depuis l’onglet semaine 2 : « Semaine 2 uniquement » par défaut (valeur ' + semv + ')');
  await page.click('.modal-foot .btn.ghost, .modal-foot .btn:has-text("Annuler")').catch(() => {});
  await page.goto(BASE + '#/classes'); await page.waitForSelector('h1');
  ok(errors.length === 0, 'aucune erreur console (' + errors.slice(0, 3).join(' | ') + ')');
  console.log('\n' + pass + ' ✓  ' + fail + ' ✗'); await browser.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
