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
    ['pm', 'bp2', 'bp1', 'bpt', 'cap'].forEach((n) => {
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
  ok(chk.cap === true && chk.levels.cap.mapped >= 7, 'CAP : manuel relié au programme (' + chk.levels.cap.mapped + '/' + chk.levels.cap.chapBO + ' chapitres du BO)');

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
  ok(!/accroche|exercices d’entraînement|La séance a comporté|Déroulé/i.test(d1.v1.contenu) && /^Objectif : /.test(d1.v1.contenu) && /\nNotions? abordées? : /.test(d1.v1.contenu), 'V1 : lignes Objectif / Notion abordée, aucune étape du déroulé');
  ok(d1.v2.contenu !== d1.v1.contenu && !/indicateurs de position/.test(d1.v2.contenu) && /^Objectif : Moyenne et médiane/.test(d1.v2.contenu), 'V2 distincte de V1 : s’appuie sur le manuel, pas sur les phrases du BO');
  ok(d1.v1.manuel === false && !/manuel/.test(d1.v1.contenu), 'V1 : sans renvoi au manuel');
  ok(d1.v2.manuel && /Manuel : Maths et MCV · 2de, chapitre 2 « Statistique à une variable »/.test(d1.v2.contenu) && /La moyenne/.test(d1.v2.contenu) && /https:\/\/tom-rougeaud\.github\.io\/mcv\/2de\//.test(d1.v2.contenu), 'V2 : renvoi au manuel 2de, chapitre 2 et notions reconnues, lien de l’appli');
  ok(/^Revoir : /.test(d1.v2.travail) && /chapitre 2/.test(d1.v2.travail), 'V2 : travail à faire proposé (revoir la notion dans le manuel)');
  ok(/Notions? à aborder : /.test(d1.f2.contenu) && !/abordées?/.test(d1.f2.contenu), 'V2 au futur (« à aborder »)');
  ok(!/[\u{1F300}-\u{1FAFF}☀-➿]/u.test(d1.v2.contenu), 'aucun émoji');
  const capv2 = await page.evaluate((id) => { const s = DB.byId('fs_seances', id); return Pronote.draft(s, Cls.get(s.class_id), 'passe', 2); }, ids.s2);
  ok(capv2.manuel === true && /Manuel : Maths · CAP, chapitre 1/.test(capv2.contenu) && /cap\//.test(capv2.contenu), 'CAP : version 2 s’appuie sur le manuel CAP');

  console.log('# Interface : Pronote (public) et mémo perso (manuels)');
  await page.goto(BASE + '#/seance/' + ids.s); await page.waitForSelector('.page-head h1');
  ok(await page.locator('button:has-text("✨ Rédiger la synthèse")').count() === 1 && await page.locator('button:has-text("Version 2")').count() === 0, 'section Pronote : un seul bouton (aucune trace des manuels)');
  await page.click('text=📋 Pronote'); await sleep(400);
  await page.click('text=✨ Rédiger la synthèse'); await sleep(400);
  const t1 = await page.locator('textarea[placeholder^="Objectif"]').inputValue();
  ok(/^Objectif : /.test(t1) && !/manuel|Appli :/i.test(t1), 'texte Pronote : ce qui a été fait, sans manuel ni lien');
  ok(!/^Revoir/.test(await page.locator('textarea[placeholder^="Travail à faire"]').inputValue()), 'travail à faire Pronote : pas de renvoi au manuel');
  ok(await page.locator('button:has-text("🔒 Mémo manuels")').count() === 1, 'bouton « Mémo manuels » dans la barre d’actions de la séance');
  await page.locator('button:has-text("🔒 Mémo manuels")').first().click(); await sleep(300);
  ok(await page.locator('details.sec:has-text("Mémo perso")[open]').count() === 1, 'le bouton ouvre le mémo perso');
  await page.click('text=✨ Rédiger le mémo avec mes manuels'); await sleep(500);
  const memo = await page.locator('textarea[placeholder^="Mémo pour moi"]').inputValue();
  console.log('     mémo » ' + memo);
  ok(/Manuel : Maths et MCV · 2de/.test(memo) && /La moyenne/.test(memo) && /tom-rougeaud\.github\.io\/mcv\/2de\//.test(memo) && /À revoir \/ à faire : Revoir /.test(memo), 'mémo perso : chapitre, notions, appli, à revoir');
  await page.click('text=📋 Copier le mémo'); await sleep(200);
  ok((await page.evaluate(() => navigator.clipboard.readText())) === memo, 'mémo copiable');
  await sleep(2800);
  const row = st.rows.fs_seances.find((x) => x.id === ids.s);
  ok(row.data.pronote.perso === memo && !/manuel/.test(row.data.pronote.contenu), 'mémo enregistré à part, texte Pronote intact');
  const exp = await page.evaluate((id) => Exp.seanceHtml(DB.byId('fs_seances', id), {}) + Exp.historyHtml([Cls.get(DB.byId('fs_seances', id).class_id)], {}).html, ids.s);
  ok(!exp.includes('Mémo perso') && !exp.includes('mcv/2de'), 'le mémo perso n’apparaît dans aucun export de fiche');
  await page.screenshot({ path: SHOTS + '/40-memo-perso.png' });
  await page.goto(BASE + '#/seance/' + ids.s2); await page.waitForSelector('.page-head h1'); await page.locator('button:has-text("🔒 Mémo manuels")').first().click(); await sleep(300);
  ok(await page.locator('button:has-text("Rédiger le mémo")').count() === 1, 'CAP : le mémo avec mes manuels est proposé');

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
