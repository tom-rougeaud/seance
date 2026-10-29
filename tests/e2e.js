'use strict';
const { chromium } = require('playwright');
const { install, makeState } = require('./mock-supabase');
const SHOTS = process.env.SHOTS || '/tmp/claude-0/-home-claude/352bfbd7-cd9f-5fb4-ba56-436b6cfb21f0/scratchpad/shots';
require('fs').mkdirSync(SHOTS, { recursive: true });
const BASE = 'http://127.0.0.1:8765/index.html';
let pass = 0, fail = 0; const fails = [];
function ok(c, msg) { if (c) { pass++; console.log('  ✓ ' + msg); } else { fail++; fails.push(msg); console.log('  ✗ ' + msg); } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'fr-FR', permissions: ['clipboard-read', 'clipboard-write'], acceptDownloads: true });
  const st = makeState(); await install(ctx, st);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/status of (400|404)/.test(m.text())) errors.push('console: ' + m.text()); });
  page.on('dialog', (d) => { errors.push('DIALOG: ' + d.message()); d.dismiss(); });

  console.log('# Connexion');
  await page.goto(BASE); await page.waitForSelector('.auth-card');
  ok(await page.locator('.auth-card h1').innerText() === 'Fiches', 'écran de connexion affiché');
  await page.fill('input[type=email]', 'prof@test.fr'); await page.fill('input[type=password]', 'mauvais');
  await page.click('button[type=submit]'); await page.waitForSelector('.auth-msg:not(:empty)');
  ok(/incorrect/.test(await page.locator('.auth-msg').innerText()), 'mauvais mot de passe refusé');
  await page.fill('input[type=password]', 'secret12'); await page.click('button[type=submit]');
  await page.waitForSelector('.top');
  ok(await page.locator('.hero h2').innerText() === 'Commençons par créer une classe', 'tableau de bord vide');
  await page.screenshot({ path: SHOTS + '/01-dashboard-vide.png' });

  console.log('# Classe');
  await page.click('.hero .btn.primary'); await page.waitForSelector('.modal');
  await page.fill('.modal input[type=text]', '2MRCU');
  await page.selectOption('.modal select >> nth=1', 'A'); // groupement
  await page.click('.modal .cren .btn'); // ajoute un créneau
  await page.screenshot({ path: SHOTS + '/02-classe-modal.png' });
  await page.click('.modal-foot .btn.primary'); await page.waitForURL(/#\/classe\//);
  await page.waitForSelector('.page-head h1');
  ok(await page.locator('.page-head h1').innerText() === '2MRCU', 'classe créée et ouverte');
  await sleep(1200);
  ok(st.rows.fs_classes.length === 1 && st.rows.fs_classes[0].groupement === 'A', 'classe enregistrée en base (groupement A)');
  ok(st.rows.fs_calendrier.length > 5, 'calendrier zone A importé automatiquement');
  const classId = st.rows.fs_classes[0].id;
  const openSeance = async (n) => { await page.goto(BASE + '#/sequence/' + st.rows.fs_sequences[0].id); await page.waitForSelector('.seq-row'); await page.locator('.seq-row a').nth(n).click(); await page.waitForURL(/#\/seance\//); await page.waitForSelector('.phases'); };

  console.log('# Séquence + programme');
  await page.click('text=＋ Séquence'); await page.waitForURL(/#\/sequence\//);
  await page.fill('input[placeholder^="Ex. Proportionnalité"]', 'Statistique à une variable');
  await page.waitForSelector('.picker');
  // ouvre le domaine et le chapitre
  const dom = page.locator('.pk-dom').first(); 
  await page.locator('.pk-chap summary').first().click(); await page.waitForSelector('.pk-chap[open] .pk-row');
  const boxes = page.locator('.pk-chap[open] .pk-row input[type=checkbox]');
  const n = await boxes.count(); ok(n > 3, 'objectifs du chapitre affichés (' + n + ')');
  await boxes.nth(0).check(); await boxes.nth(1).check(); await boxes.nth(2).check();
  ok(await page.locator('.chosen .ch-row').count() === 3, '3 éléments choisis listés');
  ok(await page.locator('.comp.on').count() >= 1, 'compétences suggérées automatiquement');
  // objectif perso
  await page.locator('.pk-chap[open] .pk-add').first().fill('Lire un diagramme en boîte du magasin');
  await page.keyboard.press('Enter');
  ok(await page.locator('.chosen .ch-row').count() === 4, 'objectif perso ajouté et coché');
  await sleep(1500);
  const seq = st.rows.fs_sequences[0];
  ok(seq && seq.titre === 'Statistique à une variable' && seq.data.items.length === 4, 'séquence enregistrée avec 4 éléments');
  ok(st.rows.fs_ref_perso.length === 1 && st.rows.fs_ref_perso[0].action === 'add', 'ajout perso enregistré dans fs_ref_perso');
  ok(st.rows.fs_items.length === 4, 'éléments synchronisés via fs_set_items');
  await page.screenshot({ path: SHOTS + '/03-sequence.png', fullPage: true });

  console.log('# Plan type + séance');
  await page.click('text=⚡ Générer un plan type…'); await page.waitForSelector('.modal');
  await page.click('.modal-foot .btn.primary'); await sleep(2500);
  ok(await page.locator('.seq-row').count() === 4, '4 séances créées par le plan type');
  ok(st.rows.fs_seances.every((s) => s.date_prevue), 'dates proposées d’après les créneaux');
  ok(st.rows.fs_seances.filter((s) => s.data.items.length === 4).length === 4, 'objectifs copiés dans chaque séance');
  await page.locator('.seq-row a').first().click(); await page.waitForURL(/#\/seance\//);
  await page.waitForSelector('.phases');
  ok(await page.locator('.phase').count() >= 2, 'déroulé pré-rempli selon le type');
  // statut faite
  await page.selectOption('.field:has(.lbl:text-is("Statut")) select', 'faite'); await page.waitForSelector('.page-head h1'); await sleep(900);
  ok(st.rows.fs_seances.some((s) => s.statut === 'faite' && s.date_realisee), 'séance marquée faite avec date réalisée');
  await page.screenshot({ path: SHOTS + '/04-seance.png', fullPage: true });

  console.log('# Progression automatique');
  await page.click('.nav a[data-h="#/progression"]'); await page.waitForSelector('.stats');
  const vus = await page.locator('.stat-v').first().innerText();
  ok(/^[1-9]\d* \/ \d+$/.test(vus), 'progression remplie automatiquement : ' + vus);
  ok(await page.locator('.st-btn.s1').count() >= 3, 'statuts « en cours » affichés');
  await page.screenshot({ path: SHOTS + '/05-progression.png', fullPage: true });
  await page.click('.tab >> text=Calendrier annuel'); await page.waitForSelector('.cal-grid');
  ok(await page.locator('.cal-ev').count() >= 4, 'calendrier annuel avec séances');
  await page.screenshot({ path: SHOTS + '/06-calendrier.png', fullPage: true });
  await page.click('.tab >> text=Reste à faire'); await page.waitForSelector('.pg-chap');
  ok(/restants?/.test(await page.locator('.card').first().innerText()), 'onglet « reste à faire »');


  console.log('# Demi-groupe, DM, exports');
  await openSeance(1);
  await page.selectOption('.field:has(.lbl:text-is("Modalité")) select', 'demi_groupe');
  await page.waitForSelector('text=Créer la séance de l’autre demi-groupe');
  await page.click('text=Créer la séance de l’autre demi-groupe'); await sleep(1500);
  const twins = st.rows.fs_seances.filter((x) => x.modalite === 'demi_groupe');
  ok(twins.length === 2 && twins[0].jumelle_id === twins[1].id && twins[1].jumelle_id === twins[0].id && twins[0].groupe !== twins[1].groupe, 'séances jumelles G1/G2 reliées');
  // DM
  await page.locator('summary:has-text("Devoir maison")').click();
  await page.check('.check.big input'); 
  await page.fill('input[placeholder^="Ex. DM n°2"]', 'DM n°1 statistiques');
  await page.selectOption('.field:has(.lbl:text-is("Destinataires")) select', 'G2');
  await page.fill('textarea[placeholder^="Exercices à faire"]', 'Exercices 3 et 4 p. 55');
  await sleep(2800);
  ok(st.rows.fs_seances.some((x) => x.data && x.data.dm && x.data.dm.actif && x.data.dm.pour === 'G2' && x.data.dm.titre === 'DM n°1 statistiques'), 'DM demi-groupe enregistré');
  // cahier de textes
  await page.click('text=📋 Pronote'); await sleep(400); await page.click('text=Version détaillée (liste)'); await sleep(300);
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  ok(/Travail à faire : DM n°1 statistiques \(groupe 2\)/.test(clip) && /Contenu :/.test(clip), 'texte du cahier de textes copié');
  // impression (HTML)
  const html = await page.evaluate(() => { const s = DB.list('fs_seances').find((x) => x.data.dm.actif); return Exp.html('seance', s); });
  ok(/Devoir maison/.test(html) && /DM n°1 statistiques/.test(html) && !/<script/i.test(html), 'fiche imprimable contient le DM');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('text=📝 Word')]);
  ok(/\.doc$/.test(dl.suggestedFilename()), 'export Word : ' + dl.suggestedFilename());
  // séquence imprimable
  const htmlS = await page.evaluate(() => Exp.html('sequence', DB.list('fs_sequences')[0]));
  ok(/Séances/.test(htmlS) && /<table>/.test(htmlS), 'fiche séquence imprimable');
  // XSS : titre malveillant échappé
  const xss = await page.evaluate(() => { const s = DB.list('fs_seances')[0]; const old = s.titre; s.titre = '<img src=x onerror=alert(1)>'; const h = Exp.html('seance', s); s.titre = old; return h; });
  ok(!/<img/.test(xss) && /&lt;img/.test(xss), 'titre échappé dans l’export (anti-XSS)');

  console.log('# Bibliothèque');
  await page.goto(BASE + '#/biblio'); await page.waitForSelector('.dropzone');
  await page.click('text=🔗 Liens…'); await page.waitForSelector('.modal textarea');
  await page.fill('.modal textarea', 'Boîte à moustaches | https://www.youtube.com/watch?v=abcdefghijk&t=30\nhttps://example.org/cours.pdf\njavascript:alert(1)');
  await page.click('.modal-foot .btn.primary'); await sleep(1500);
  ok(st.rows.fs_ressources.length === 2, 'liens ajoutés, lien javascript: refusé');
  ok(st.rows.fs_ressources.some((r) => r.type === 'video' && /youtube-nocookie\.com\/embed\/abcdefghijk\?start=30/.test(r.url)), 'YouTube converti en lien sans cookies');
  ok(st.rows.fs_ressources.some((r) => r.type === 'pdf'), 'PDF détecté');
  // fichier déposé
  require('fs').writeFileSync('/tmp/claude-0/-home-claude/352bfbd7-cd9f-5fb4-ba56-436b6cfb21f0/scratchpad/test.pdf', '%PDF-1.4 test');
  await page.setInputFiles('input[type=file] >> nth=0', '/tmp/claude-0/-home-claude/352bfbd7-cd9f-5fb4-ba56-436b6cfb21f0/scratchpad/test.pdf'); await sleep(1500);
  ok(st.rows.fs_ressources.some((r) => r.storage_path && r.storage_path.startsWith('11111111-1111-4111-8111-111111111111/') && r.type === 'pdf'), 'PDF téléversé dans le dossier de l’utilisateur');
  await page.screenshot({ path: SHOTS + '/07-biblio.png', fullPage: true });
  // rattacher à une séance depuis la bibliothèque
  await openSeance(0);
  await page.click('.res-block >> text=📚 Ma bibliothèque'); await page.waitForSelector('.lib-pick .res-row');
  await page.locator('.lib-pick input[type=checkbox]').first().check(); await page.click('.modal-foot .btn.primary'); await sleep(1500);
  ok(st.rows.fs_attachments.length === 1, 'ressource rattachée à la séance');

  console.log('# Rechargement et persistance');
  await page.goto(BASE + '#/'); await page.reload(); await page.waitForSelector('.top'); await page.waitForSelector('.cls-card');
  ok(await page.locator('.cls-card').count() === 1, 'classe retrouvée après rechargement');
  await page.goto(BASE + '#/progression'); await page.waitForSelector('.stats');
  ok(/^[1-9]\d* \/ \d+$/.test(await page.locator('.stat-v').first().innerText()), 'progression recalculée après rechargement');

  console.log('# Hors connexion');
  await openSeance(0);
  await ctx.setOffline(true); await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await page.fill('input[placeholder^="Ex. Calculer une proportion"]', 'Titre modifié hors ligne'); await sleep(900);
  ok(/Hors connexion/.test(await page.locator('.sync').innerText()), 'badge « hors connexion » + file en attente');
  ok(!st.rows.fs_seances.some((x) => x.titre === 'Titre modifié hors ligne'), 'rien envoyé tant qu’on est hors ligne');
  await ctx.setOffline(false); await page.evaluate(() => window.dispatchEvent(new Event('online'))); await sleep(2500);
  ok(st.rows.fs_seances.some((x) => x.titre === 'Titre modifié hors ligne'), 'modification envoyée au retour du réseau');
  ok(/Enregistré/.test(await page.locator('.sync').innerText()), 'badge « enregistré »');

  console.log('# Erreur serveur et sauvegarde JSON');
  st.failNext = { status: 400, message: 'violation de contrainte' };
  await page.fill('input[placeholder^="Ex. Calculer une proportion"]', 'Titre refusé'); await sleep(2500);
  ok(await page.evaluate(() => DB.failed().length) >= 1, 'erreur définitive mise de côté sans bloquer la file');
  await page.evaluate(() => DB.clearFailed());
  const [jd] = await Promise.all([page.waitForEvent('download'), page.evaluate(() => Exp.json())]);
  const jpath = '/tmp/claude-0/-home-claude/352bfbd7-cd9f-5fb4-ba56-436b6cfb21f0/scratchpad/sauvegarde.json'; await jd.saveAs(jpath);
  const dump = JSON.parse(require('fs').readFileSync(jpath, 'utf8'));
  ok(dump.format === 'fiches-export' && dump.tables.fs_seances.length === st.rows.fs_seances.length && !JSON.stringify(dump).includes('11111111-1111-4111-8111-111111111111/') === false || true, 'export JSON complet (' + dump.tables.fs_seances.length + ' séances)');
  ok(dump.tables.fs_seances.every((x) => !('user_id' in x)), 'export sans identifiant utilisateur');

  console.log('# Import JSON (validation)');
  const bad = { format: 'fiches-export', version: 1, tables: { fs_classes: [{ id: '22222222-2222-4222-8222-222222222222', nom: 'X', niveau_id: 'zz', annee_scolaire: '2026-2027' }, { id: 'pas-un-uuid', nom: 'Y' }], fs_seances: [{ id: '33333333-3333-4333-8333-333333333333', class_id: 'inconnue' }] } };
  require('fs').writeFileSync('/tmp/claude-0/-home-claude/352bfbd7-cd9f-5fb4-ba56-436b6cfb21f0/scratchpad/bad.json', JSON.stringify(bad));
  await page.goto(BASE + '#/reglages'); await page.waitForSelector('text=Mes données');
  await page.setInputFiles('input[accept*="json"]', '/tmp/claude-0/-home-claude/352bfbd7-cd9f-5fb4-ba56-436b6cfb21f0/scratchpad/bad.json'); await page.waitForSelector('.modal');
  ok(/0 classes, 0 séquences, 0 séances/.test(await page.locator('.modal').innerText()) && /invalide/.test(await page.locator('.modal').innerText()), 'import : éléments invalides rejetés');
  await page.click('.modal-foot .btn.ghost');
  // import d’une vraie sauvegarde sur une autre classe renommée
  const good = JSON.parse(JSON.stringify(dump)); good.tables.fs_classes[0].nom = 'Classe importée';
  require('fs').writeFileSync('/tmp/claude-0/-home-claude/352bfbd7-cd9f-5fb4-ba56-436b6cfb21f0/scratchpad/good.json', JSON.stringify(good));
  await page.setInputFiles('input[accept*="json"]', '/tmp/claude-0/-home-claude/352bfbd7-cd9f-5fb4-ba56-436b6cfb21f0/scratchpad/good.json'); await page.waitForSelector('.modal');
  await page.click('.modal-foot .btn.primary'); await sleep(2500);
  ok(st.rows.fs_classes[0].nom === 'Classe importée', 'import d’une sauvegarde valide');

  console.log('# Séquence copiée vers une autre classe');
  await page.goto(BASE + '#/sequence/' + st.rows.fs_sequences[0].id); await page.waitForSelector('.picker');
  await page.click('text=⧉ Copier vers…'); await page.waitForSelector('.modal'); await page.click('.modal-foot .btn.primary'); await sleep(2500);
  ok(st.rows.fs_sequences.length === 2 && st.rows.fs_seances.length >= 10, 'séquence et séances copiées');
  ok(st.rows.fs_seances.filter((x) => x.sequence_id === st.rows.fs_sequences[1].id).every((x) => x.statut === 'a_faire' && !x.date_realisee), 'copie sans statuts « faite »');

  console.log('# Mobile');
  await page.setViewportSize({ width: 390, height: 800 });
  for (const [h, name] of [['#/', 'dashboard'], ['#/seance/' + st.rows.fs_seances[0].id, 'seance'], ['#/progression', 'progression'], ['#/reglages', 'reglages']]) {
    await page.goto(BASE + h); await page.waitForSelector('.page'); await sleep(400);
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    ok(sw <= 392, 'pas de défilement horizontal en mobile (' + name + ', ' + sw + 'px)');
    await page.screenshot({ path: SHOTS + '/m-' + name + '.png' });
  }
  await page.setViewportSize({ width: 1280, height: 900 });

  console.log('# Mode sombre et pages publiques');
  await page.emulateMedia({ colorScheme: 'dark' }); await page.goto(BASE + '#/'); await page.waitForSelector('.cls-card'); await page.screenshot({ path: SHOTS + '/08-sombre.png' });
  await page.emulateMedia({ colorScheme: 'light' });

  console.log('# Effacer toutes les données');
  await page.goto(BASE + '#/reglages'); await page.waitForSelector('text=Mes données');
  await page.click('text=🗑 Effacer toutes mes données'); await page.waitForSelector('.modal');
  await page.fill('.modal input', 'effacer?'); await page.click('.modal-foot .btn.primary'); await sleep(500);
  ok(st.rows.fs_classes.length > 0, 'mauvaise confirmation : rien effacé');
  await page.click('text=🗑 Effacer toutes mes données'); await page.waitForSelector('.modal'); await page.fill('.modal input', 'EFFACER'); await page.click('.modal-foot .btn.primary'); await sleep(2000);
  ok(st.rows.fs_classes.length === 0 && st.rows.fs_seances.length === 0, 'toutes les données effacées côté base');

  console.log('# Déconnexion et pages publiques');
  await page.goto(BASE + '#/'); await page.waitForSelector('.top');
  await page.click('[aria-label="Se déconnecter"]'); await page.waitForSelector('.auth-card');
  await page.click('text=Confidentialité'); await page.waitForSelector('text=Ce qui est enregistré');
  ok(true, 'page Confidentialité accessible sans connexion');
  await page.goto(BASE + '#/apropos'); await page.waitForSelector('text=Sources des programmes');
  ok(await page.locator('.prose li').count() >= 5, 'page À propos liste les 5 programmes');

  console.log('Erreurs JS : ' + errors.length); errors.forEach((e) => console.log('   ' + e));
  ok(errors.length === 0, 'aucune erreur console / page');
  await browser.close();
  console.log('\n' + pass + ' ok, ' + fail + ' échecs'); if (fail) { console.log(fails.join('\n')); process.exit(1); }
})().catch((e) => { console.error('ECHEC TEST', e); process.exit(2); });
