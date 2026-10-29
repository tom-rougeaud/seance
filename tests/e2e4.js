'use strict';
/* Apparence : palettes, polices, taille du texte, contraste */
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
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/status of (400|404)/.test(m.text())) errors.push('console: ' + m.text()); });
  await login(page);
  await page.goto(BASE + '#/reglages'); await page.waitForSelector('.pal-grid');
  ok(await page.locator('.pal-btn').count() === 8 && await page.locator('.font-btn').count() === 6, '8 palettes et 6 polices proposées');
  ok(await page.locator('.pal-btn[aria-pressed="true"]').innerText() === 'Marine', 'palette d’origine : Marine');

  console.log('# Choix');
  await page.click('.pal-btn:has-text("Forêt")');
  ok(await page.evaluate(() => document.documentElement.getAttribute('data-palette')) === 'foret', 'palette Forêt appliquée');
  ok(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--primary').trim().toUpperCase()) === '#3C6B52', 'couleur principale changée');
  await page.click('.font-btn:has-text("Arrondie")'); await sleep(300);
  const ff = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  ok(/Nunito/.test(ff), 'police Arrondie appliquée : ' + ff.slice(0, 40));
  ok(await page.evaluate(() => document.fonts.ready.then(() => document.fonts.check('16px Nunito') && [...document.fonts].some((f) => f.family.replace(/"/g, '') === 'Nunito' && f.status === 'loaded'))), 'police Nunito réellement chargée (embarquée)');
  await page.selectOption('.card:has(h2:text("Apparence")) .field:has(.lbl:text-is("Taille du texte")) select', '1.25');
  ok(await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize)) === 20, 'taille « très grand » : 20 px');
  await page.screenshot({ path: SHOTS + '/20-apparence.png', fullPage: true });
  await sleep(2800);
  const ap = st.settings && st.settings.data && st.settings.data.apparence;
  ok(ap && ap.palette === 'foret' && ap.font === 'arrondi' && ap.fs === '1.25', 'choix enregistrés dans le compte (' + JSON.stringify(ap) + ')');
  await page.reload(); await page.waitForSelector('.top');
  ok(await page.evaluate(() => document.documentElement.getAttribute('data-palette') + '/' + document.documentElement.getAttribute('data-font')) === 'foret/arrondi', 'choix conservés après rechargement');

  console.log('# Autre appareil (compte identique)');
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 800 }, locale: 'fr-FR' }); await install(ctx2, st);
  const p2 = await ctx2.newPage(); await login(p2);
  ok(await p2.evaluate(() => document.documentElement.getAttribute('data-palette') + '/' + document.documentElement.getAttribute('data-font')) === 'foret/arrondi', 'le nouvel appareil reprend l’apparence du compte');
  await p2.screenshot({ path: SHOTS + '/21-autre-appareil.png' });

  console.log('# Réinitialisation');
  await page.goto(BASE + '#/reglages'); await page.waitForSelector('.pal-grid'); await page.click('text=Revenir à l’apparence d’origine');
  ok(await page.evaluate(() => !document.documentElement.hasAttribute('data-palette') && !document.documentElement.hasAttribute('data-font') && getComputedStyle(document.documentElement).fontSize === '16px'), 'apparence d’origine rétablie');

  console.log('# Contraste (WCAG) de chaque palette, clair et sombre');
  const lum = (hx) => { const c = hx.replace('#', ''); const f = (i) => { const v = parseInt(c.slice(i, i + 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(0) + 0.7152 * f(2) + 0.0722 * f(4); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const pals = ['marine', 'ardoise', 'foret', 'ocean', 'prune', 'terre', 'bordeaux', 'contraste'];
  for (const mode of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: mode });
    for (const pal of pals) {
      const v = await page.evaluate((pal) => { const r = document.documentElement; pal === 'marine' ? r.removeAttribute('data-palette') : r.setAttribute('data-palette', pal); const g = (n) => getComputedStyle(r).getPropertyValue(n).trim(); return { bg: g('--bg'), surface: g('--surface'), s2: g('--surface2'), text: g('--text'), muted: g('--muted'), primary: g('--primary'), onp: g('--on-primary') }; }, pal);
      const min = pal === 'contraste' ? 7 : 4.5;
      const checks = { 'texte/fond': ratio(v.text, v.bg), 'texte/carte': ratio(v.text, v.surface), 'grisé/carte': ratio(v.muted, v.surface), 'grisé/fond': ratio(v.muted, v.bg), 'grisé/zone': ratio(v.muted, v.s2), 'lien/carte': ratio(v.primary, v.surface), 'bouton': ratio(v.onp, v.primary) };
      const bad = Object.entries(checks).filter(([, r]) => r < min).map(([k, r]) => k + ' ' + r.toFixed(2));
      ok(bad.length === 0, mode + ' · ' + pal + (bad.length ? ' ⚠ ' + bad.join(', ') : ' : tous ≥ ' + min));
    }
  }
  console.log('# Captures');
  await page.emulateMedia({ colorScheme: 'light' });
  for (const pal of ['marine', 'terre', 'prune']) { await page.evaluate((pal) => { pal === 'marine' ? document.documentElement.removeAttribute('data-palette') : document.documentElement.setAttribute('data-palette', pal); }, pal); }
  await page.evaluate(() => { document.documentElement.setAttribute('data-palette', 'ocean'); document.documentElement.setAttribute('data-font', 'lisible'); }); await page.goto(BASE + '#/'); 
  console.log('Erreurs JS : ' + errors.length); errors.forEach((e) => console.log('   ' + e));
  ok(errors.length === 0, 'aucune erreur console / page');
  console.log('\n' + pass + ' ok, ' + fail + ' échecs');
  await browser.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('ECHEC TEST', e); process.exit(2); });
