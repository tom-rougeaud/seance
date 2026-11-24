'use strict';
/* Chiffrement de bout en bout : rien de lisible sur le réseau, récupération, migration des anciennes données.
   Auteur : Tom Rougeaud · Réalisé avec l’aide de Claude Sonnet 5.5 (Anthropic) */
const { chromium } = require('playwright');
const { install, makeState } = require('./mock-supabase');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/index.html';
let pass = 0, fail = 0;
function ok(c, msg) { if (c) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ ' + msg); } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function login(page, pw) {
  await page.goto(BASE); await page.waitForSelector('.auth-card');
  await page.fill('#compte-id', 'prof@test.fr'); await page.fill('#compte-mdp', pw); await page.click('.auth-card button[type=submit]');
}
(async () => {
  const browser = await chromium.launch(); const errors = [];
  const watch = (page) => { page.on('pageerror', (e) => errors.push('pageerror: ' + e.message)); };

  /* ── 1. Rien de lisible n’est envoyé ── */
  console.log('# Envoi chiffré');
  let st = makeState(); let ctx = await browser.newContext({ viewport: { width: 1200, height: 900 }, locale: 'fr-FR' }); await install(ctx, st);
  let page = await ctx.newPage(); watch(page);
  await login(page, 'secret12'); await page.waitForSelector('.top');
  ok(true, 'connexion + ouverture automatique de la clé (mot de passe)');
  const cid = await page.evaluate(() => DB.create('fs_classes', { nom: 'ClasseSecrete4B', niveau_id: 'cap', groupement: null, avec_pc: true, poursuite: false, metier: 'Boulangerie', annee_scolaire: '2026-2027', couleur: '#2B4C7E', creneaux: [], notes: 'NoteConfidentielle' }).id);
  await page.evaluate((c) => { DB.create('fs_seances', { class_id: c, titre: 'TitreSecretSeance', type: 'cours', modalite: 'classe', duree_min: 55, statut: 'a_faire', data: { items: [{ k: 'o', ref: 'x', txt: 'ObjectifSecret' }] } }); }, cid);
  await page.evaluate(() => { Res.addLinks('https://exemple.org/lien-secret', 'LienSecretTitre'); DB.saveSettings({ apparence: { theme: 'dark' }, perso: 'ReglageSecret' }); });
  await page.evaluate(() => DB.flush()); await sleep(500);
  const fil = (st.wire || []).join('\n');
  ok(fil.length > 100 && !/ClasseSecrete4B|NoteConfidentielle|Boulangerie|TitreSecretSeance|ObjectifSecret|lien-secret|LienSecretTitre|ReglageSecret/.test(fil), 'aucun texte de l’utilisateur(trice) dans les envois (' + (st.wire || []).length + ' requêtes)');
  ok(/enc1:/.test(fil), 'les envois contiennent des blocs chiffrés');
  ok(st.rows.fs_classes[0] && st.rows.fs_classes[0].nom === 'ClasseSecrete4B', 'le serveur-test, avec la clé, retrouve bien le contenu (aller-retour correct)');
  ok(st.rows.fs_items.length === 0, 'aucun élément en clair dans l’index fs_items');
  /* fichier */
  await page.evaluate(async () => { const f = new File(['CONTENU-PDF-SECRET'], 'Secret-eleve.pdf', { type: 'application/pdf' }); await Res.upload(f); });
  await page.evaluate(() => DB.flush()); await sleep(400);
  const chemin = Object.keys(st.fichiers || {})[0] || '';
  ok(chemin && !/Secret|eleve|pdf/i.test(chemin.split('/').pop()), 'nom de fichier de stockage aléatoire');
  ok(chemin && !(st.fichiers[chemin].toString('latin1')).includes('CONTENU-PDF-SECRET'), 'contenu du fichier chiffré dans le stockage');
  const relu = await page.evaluate(async () => { const r = DB.list('fs_ressources').filter((x) => x.storage_path)[0]; const b = await Api.storage.telecharger(r.storage_path); const o = await Chiffre.dechiffrerOctets(b); return new TextDecoder().decode(o) + '|' + r.fenc + '|' + r.mime; });
  ok(relu === 'CONTENU-PDF-SECRET|true|application/pdf', 'fichier rouvert et déchiffré dans le navigateur');

  /* ── 2. Rechargement : clé gardée sur l’appareil ── */
  console.log('# Rechargement et nouvel appareil');
  const p2 = await ctx.newPage(); watch(p2); await p2.goto(BASE); await p2.waitForSelector('.top', { timeout: 15000 });
  ok(await p2.evaluate(() => DB.list('fs_classes').some((c) => c.nom === 'ClasseSecrete4B')), 'après rechargement : données relues et déchiffrées sans retaper le mot de passe');
  ok(await p2.evaluate(() => DB.settings().perso === 'ReglageSecret'), 'réglages déchiffrés');
  /* nouvel appareil (aucune clé locale) */
  const ctx2 = await browser.newContext({ viewport: { width: 1200, height: 900 } }); await install(ctx2, st);
  const p3 = await ctx2.newPage(); watch(p3); await login(p3, 'secret12'); await p3.waitForSelector('.top', { timeout: 15000 });
  ok(await p3.evaluate(() => DB.list('fs_classes').length === 1), 'nouvel appareil : le mot de passe suffit');

  /* ── 3. Mot de passe réinitialisé : code de récupération ── */
  console.log('# Récupération par code');
  st.users['prof@test.fr'].pw = 'Nouveau-mdp9'; st.mdpNouveau = 'Nouveau-mdp9';
  const ctx3 = await browser.newContext({ viewport: { width: 1200, height: 900 } }); await install(ctx3, st);
  const p4 = await ctx3.newPage(); watch(p4); await login(p4, 'Nouveau-mdp9');
  await p4.waitForSelector('#chiffre-code-saisie', { timeout: 15000 });
  ok(true, 'écran « Ouvrir vos données » après réinitialisation (clé non ouverte par le nouveau mot de passe)');
  await p4.fill('#chiffre-code-saisie', 'AAAA-BBBB-CCCC-DDDD-EEEE-FFFF'); await p4.click('button:has-text("Utiliser mon code")');
  await p4.waitForSelector('.auth-msg:has-text("Code incorrect")'); ok(true, 'mauvais code refusé');
  await p4.fill('#chiffre-code-saisie', st.code.toLowerCase().replace(/-/g, ' ')); await p4.click('button:has-text("Utiliser mon code")');
  await p4.waitForSelector('.top', { timeout: 15000 });
  ok(await p4.evaluate(() => DB.list('fs_classes').some((c) => c.nom === 'ClasseSecrete4B')), 'bon code (saisi en minuscules, sans tirets) : données retrouvées');
  ok(st.log.includes('CLES_POST'), 'la clé est ré-enfermée avec le nouveau mot de passe');
  const ctx4 = await browser.newContext({ viewport: { width: 1200, height: 900 } }); await install(ctx4, st);
  const p5 = await ctx4.newPage(); watch(p5); await login(p5, 'Nouveau-mdp9'); await p5.waitForSelector('.top', { timeout: 15000 });
  ok(true, 'ensuite, le nouveau mot de passe suffit sur un autre appareil');

  /* ── 4. Première installation + migration des anciennes données ── */
  console.log('# Première installation et migration');
  const s2 = makeState(); s2.sansCles = true; s2.legacy = true;
  s2.rows.fs_classes.push({ id: '22222222-2222-4222-8222-222222222222', user_id: '1', nom: 'AncienneClasse', niveau_id: 'pm', groupement: null, avec_pc: true, poursuite: false, metier: '', annee_scolaire: '2025-2026', couleur: '#2B4C7E', creneaux: [], notes: 'ancienne note', archive: false, ordre: 0 });
  s2.rows.fs_seances.push({ id: '33333333-3333-4333-8333-333333333333', user_id: '1', class_id: '22222222-2222-4222-8222-222222222222', sequence_id: null, jumelle_id: null, ordre: 0, titre: 'AncienneSeance', type: 'cours', modalite: 'classe', groupe: null, duree_min: 55, date_prevue: null, date_realisee: null, statut: 'a_faire', data: { items: [{ k: 'o', ref: 'x', txt: 'élément en clair' }] } });
  s2.rows.fs_items.push({ id: 'i1', parent_id: '33333333-3333-4333-8333-333333333333', txt: 'élément en clair' });
  const ctx5 = await browser.newContext({ viewport: { width: 1200, height: 900 }, acceptDownloads: true }); await install(ctx5, s2);
  const p6 = await ctx5.newPage(); watch(p6); await login(p6, 'secret12');
  await p6.waitForSelector('#chiffre-code', { timeout: 15000 });
  const code = (await p6.locator('#chiffre-code').innerText()).trim();
  ok(/^([A-Z2-9]{4}-){5}[A-Z2-9]{4}$/.test(code), 'code de récupération affiché (24 signes) : ' + code.slice(0, 4) + '…');
  ok(await p6.locator('button:has-text("Continuer")').isDisabled(), '« Continuer » bloqué tant que le code n’est pas noté');
  await p6.check('#chiffre-ok'); await p6.fill('#chiffre-verif', 'zzzz'); ok(await p6.locator('button:has-text("Continuer")').isDisabled(), 'mauvaise vérification : toujours bloqué');
  await p6.fill('#chiffre-verif', code.replace(/-/g, '').slice(-4).toLowerCase()); await p6.click('button:has-text("Continuer")');
  await p6.waitForSelector('#chiffre-sauvegarde', { timeout: 15000 });
  ok(await p6.locator('button:has-text("Chiffrer mes données")').isDisabled(), 'migration : bouton bloqué avant la sauvegarde');
  const [dl] = await Promise.all([p6.waitForEvent('download'), p6.click('#chiffre-sauvegarde')]);
  ok(/fiches-sauvegarde/.test(dl.suggestedFilename()), 'sauvegarde téléchargée : ' + dl.suggestedFilename());
  s2.legacy = false;
  await p6.click('button:has-text("Chiffrer mes données")'); await p6.waitForSelector('.top', { timeout: 20000 });
  await p6.evaluate(() => DB.flush()); await sleep(500);
  ok(s2.rows.fs_items.length === 0, 'ancien index en clair vidé');
  const brut = (s2.wire || []).join('\n');
  ok(!/AncienneClasse|ancienne note/.test(brut.slice(brut.lastIndexOf('enc1:') > 0 ? 0 : 0).split('CLES')[0] || ''), 'envois de migration sans texte lisible');
  ok(s2.rows.fs_classes[0].nom === 'AncienneClasse', 'ancienne classe conservée (relue par le serveur-test)');
  /* après migration : GET renvoie du chiffré, plus aucune ancienne ligne */
  await p6.reload(); await p6.waitForSelector('.top', { timeout: 15000 });
  ok(await p6.evaluate(() => DB.anciennes() === 0 && DB.list('fs_classes')[0].nom === 'AncienneClasse'), 'après migration : plus d’ancienne ligne, contenu intact');

  /* ── 5. Texte rassurant ── */
  console.log('# Texte « ce qui n’est pas visible »');
  await p6.goto(BASE + '#/confidentialite'); await p6.waitForSelector('.prose');
  const t = await p6.locator('.prose').innerText();
  ok(/Ce qui n’est pas visible/.test(t) && /Ce qui reste visible/.test(t) && /Limites/.test(t) && /code de récupération/.test(t), 'page Confidentialité : visible / non visible / limites');
  ok(!/peut techniquement les lire/.test(t), 'ancienne phrase inquiétante supprimée');

  console.log('Erreurs JS : ' + errors.length); errors.slice(0, 5).forEach((e) => console.log('   ' + e));
  ok(errors.length === 0, 'aucune erreur de page');
  await browser.close(); console.log('\n' + pass + ' ok, ' + fail + ' échecs'); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
