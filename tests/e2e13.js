'use strict';
/* =====================================================================
   Projet : Fiches — test de bout en bout du bloc Compte  ·  Date : 21/11/2026
   Auteur : Tom Rougeaud  ·  Licence : CC BY-NC 4.0
   Réalisé avec l’aide de l’IA : Claude Sonnet 5.5 (Anthropic)
   Couvre : écran de connexion, création (pseudo / e-mail), règles du mot de passe,
            disponibilité du pseudo en temps réel, mot de passe oublié, changement de mot de passe,
            suppression de compte, bloc « Vos données », avertissement mot de passe faible.
   ===================================================================== */
const { chromium } = require('playwright');
const { install, makeState } = require('./mock-supabase');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/index.html';
let pass = 0, fail = 0;
function ok(c, msg) { if (c) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ ' + msg); } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BON = 'Abcdefghij1!';   /* respecte toutes les règles */
(async () => {
  const browser = await chromium.launch(); const st = makeState();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, locale: 'fr-FR' }); await install(ctx, st);
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/status of (400|404)/.test(m.text())) errors.push('console: ' + m.text()); });
  page.on('dialog', (d) => { errors.push('DIALOG: ' + d.message()); d.dismiss(); });

  console.log('# Écran de connexion');
  await page.goto(BASE); await page.waitForSelector('.auth-card');
  ok(await page.locator('#compte-id').count() === 1 && (await page.getAttribute('#compte-id', 'placeholder')) === 'Pseudo (ou e-mail d’un ancien compte)', 'champ identifiant : pseudo, ou e-mail d’un ancien compte');
  ok(!(await page.locator('.regles').isVisible()), 'règles du mot de passe masquées en mode connexion');
  ok(await page.locator('text=Mot de passe oublié ?').isVisible(), 'lien « Mot de passe oublié ? » visible');
  ok(await page.locator('.compte-donnees summary').isVisible(), 'bloc « Vos données » présent');
  await page.click('.compte-donnees summary');
  const donnees = await page.locator('.compte-donnees').innerText();
  ok(/Supabase/.test(donnees) && /GitHub Pages/.test(donnees) && /Ce qui n’est pas visible/.test(donnees) && /Code de récupération/.test(donnees) && /supprimer votre compte/.test(donnees), 'données : tiers, ce qui n’est pas visible, code de récupération et droits annoncés');
  await page.click('.compte-donnees summary');
  /* mot de passe visible à la demande */
  await page.fill('#compte-mdp', 'secret'); ok((await page.getAttribute('#compte-mdp', 'type')) === 'password', 'mot de passe masqué par défaut');
  await page.click('.mdp-voir'); ok((await page.getAttribute('#compte-mdp', 'type')) === 'text' && (await page.getAttribute('.mdp-voir', 'aria-pressed')) === 'true', 'bouton Afficher : mot de passe lisible');
  await page.click('.mdp-voir'); ok((await page.getAttribute('#compte-mdp', 'type')) === 'password', 'bouton Masquer : de nouveau masqué');
  /* mot de passe oublié */
  await page.fill('#compte-id', ''); await page.click('text=Mot de passe oublié ?');
  ok(/Saisissez d’abord/.test(await page.locator('.auth-msg').innerText()), 'oubli sans identifiant : consigne');
  await page.fill('#compte-id', 'eleve_01'); await page.click('text=Mot de passe oublié ?');
  ok(/responsable/.test(await page.locator('.auth-msg').innerText()) && !st.log.includes('RECOVER'), 'oubli avec pseudo : explication honnête, aucun e-mail envoyé');
  await page.fill('#compte-id', 'prof@test.fr'); await page.click('text=Mot de passe oublié ?'); await sleep(300);
  ok(st.log.includes('RECOVER'), 'oubli avec e-mail : demande de réinitialisation envoyée');

  console.log('# Création de compte');
  await page.click('text=Créer un compte');
  ok(await page.locator('.regles').isVisible() && (await page.locator('.regles li').count()) === 5, 'cinq règles affichées à la création');
  ok(/! @ #/.test(await page.locator('.zone-creation').innerText()), 'liste des caractères spéciaux affichée');
  ok(!(await page.locator('text=Mot de passe oublié ?').isVisible()), 'lien « oublié » masqué à la création');
  await page.fill('#compte-mdp', 'abc'); await sleep(50);
  ok((await page.locator('.regles li.ok').count()) === 1, 'règles cochées en direct : seule « minuscule » valide pour « abc »');
  await page.fill('#compte-mdp', BON); await sleep(50);
  ok((await page.locator('.regles li.ok').count()) === 5 && /^✓/.test(await page.locator('.regles li').first().innerText()), 'cinq règles cochées avec ✓ (pas seulement la couleur)');
  /* disponibilité du pseudo en temps réel */
  await page.fill('#compte-id', 'PRIS-12'); await page.waitForFunction(() => /déjà pris/.test(document.querySelector('.pseudo-etat').textContent), null, { timeout: 4000 });
  ok(st.log.includes('PSEUDO?pris-12'), 'pseudo en majuscules compris comme le pseudo en minuscules');
  ok(true, 'pseudo pris : « déjà pris » affiché');
  await page.fill('#compte-id', 'Abcde'); await page.waitForFunction(() => /Format non valide/.test(document.querySelector('.pseudo-etat').textContent), null, { timeout: 4000 });
  ok(true, 'pseudo trop court : format refusé sans appel à la base');
  ok(!st.log.includes('PSEUDO?abcde'), 'aucun appel à la base pour un pseudo invalide');
  ok(st.lastApp === 'fiches', 'la disponibilité du pseudo est demandée pour l’appli fiches');
  await page.fill('#compte-id', 'Nouveau_Eleve'); await page.waitForFunction(() => /disponible/.test(document.querySelector('.pseudo-etat').textContent), null, { timeout: 4000 });
  ok(st.log.includes('PSEUDO?nouveau_eleve'), 'pseudo normalisé en minuscules avant la question à la base');
  /* création par e-mail : refusée (les nouveaux comptes sont des pseudos propres à l’appli) */
  await page.fill('#compte-id', 'quelquun@exemple.fr'); await sleep(600);
  ok(/avec un pseudo/.test(await page.locator('.pseudo-etat').innerText()) && !st.log.includes('PSEUDO?quelquun@exemple.fr'), 'création par e-mail refusée dès la saisie, sans appel à la base');
  await page.fill('#compte-id', 'Nouveau_Eleve'); await sleep(700);
  /* mot de passe trop faible : refus sans création */
  await page.fill('#compte-mdp', 'faible'); const avant = st.log.filter((x) => x === 'SIGNUP').length;
  await page.click('.auth-card button[type=submit]'); await sleep(200);
  ok(/ne respecte pas toutes les règles/.test(await page.locator('.auth-msg').innerText()) && st.log.filter((x) => x === 'SIGNUP').length === avant, 'mot de passe faible refusé : aucune création de compte');
  /* serveur qui ne confirme pas automatiquement : refus AVANT de créer un compte inutilisable */
  st.autoconfirm = false; await page.fill('#compte-mdp', BON);
  await page.click('.auth-card button[type=submit]'); await sleep(300);
  ok(/pas encore activés/.test(await page.locator('.auth-msg').innerText()) && st.log.filter((x) => x === 'SIGNUP').length === avant, 'confirmation e-mail active : compte à pseudo non créé, message clair');
  st.autoconfirm = true;
  /* création réussie avec pseudo */
  st.signupConnecte = true; await page.click('.auth-card button[type=submit]'); await page.waitForSelector('#view', { timeout: 8000 });
  ok(st.lastSignup && st.lastSignup.email === 'nouveau_eleve@fiches.pseudo.invalid' && st.lastSignup.data && st.lastSignup.data.pseudo === 'nouveau_eleve' && st.lastSignup.password === BON, 'inscription : e-mail technique + pseudo transmis, mot de passe envoyé tel quel');
  ok(JSON.stringify(st.lastSignup).indexOf('@gmail') < 0, 'aucune adresse personnelle dans la requête');

  console.log('# Carte « Compte » dans les Réglages');
  await page.goto(BASE + '#/reglages'); await page.waitForSelector('text=Changer mon mot de passe');
  ok(/Pseudo : nouveau_eleve/.test(await page.locator('#view').innerText()), 'pseudo affiché dans la carte Compte (sans le suffixe technique)');
  await page.click('text=Changer mon mot de passe'); await page.waitForSelector('#compte-nouveau');
  await page.fill('#compte-nouveau', 'court'); await page.fill('#compte-confirmation', 'court'); await page.click('.form-mdp button[type=submit]'); await sleep(150);
  ok(/ne respecte pas/.test(await page.locator('.form-mdp .auth-msg').innerText()) && !st.log.includes('PW_CHANGED'), 'changement refusé si la règle n’est pas respectée');
  await page.fill('#compte-nouveau', BON); await page.fill('#compte-confirmation', BON + 'x'); await page.click('.form-mdp button[type=submit]'); await sleep(150);
  ok(/différents/.test(await page.locator('.form-mdp .auth-msg').innerText()) && !st.log.includes('PW_CHANGED'), 'changement refusé si les deux saisies diffèrent');
  await page.fill('#compte-confirmation', BON); await page.click('.form-mdp button[type=submit]'); await sleep(300);
  ok(st.log.includes('PW_CHANGED'), 'changement de mot de passe envoyé quand tout est bon');
  /* suppression de compte */
  await page.click('button:has-text("Supprimer mon compte")'); await page.waitForSelector('input[placeholder="SUPPRIMER"]');
  await page.fill('input[placeholder="SUPPRIMER"]', 'oui'); await page.click('button:has-text("Supprimer définitivement")'); await sleep(300);
  ok(!st.log.includes('DELETE_USER'), 'mauvaise confirmation : compte conservé');
  await page.click('button:has-text("Supprimer mon compte")'); await page.waitForSelector('input[placeholder="SUPPRIMER"]');
  await page.fill('input[placeholder="SUPPRIMER"]', 'SUPPRIMER'); await page.click('button:has-text("Supprimer définitivement")');
  await page.waitForSelector('.auth-card', { timeout: 8000 });
  ok(st.log.includes('DELETE_USER'), 'suppression confirmée : fonction delete_user appelée, retour à l’écran de connexion');

  console.log('# Mot de passe faible à la connexion (ancien compte)');
  st.mdpFaible = true; await page.fill('#compte-id', 'prof@test.fr'); await page.fill('#compte-mdp', BON); /* le mot de passe a été changé plus haut dans ce test */ await page.click('.auth-card button[type=submit]');
  await page.waitForSelector('#view'); await page.waitForSelector('text=ne respecte plus la règle actuelle', { timeout: 5000 });
  ok(true, 'ancien mot de passe faible : accès conservé + invitation à le changer');

  ok(errors.length === 0, 'aucune erreur console ni boîte de dialogue' + (errors.length ? ' : ' + errors.slice(0, 3).join(' | ') : ''));
  await browser.close();
  console.log('\n' + pass + ' ok, ' + fail + ' échecs'); process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('ECHEC TEST', e.message.split('\n')[0]); process.exit(1); });
