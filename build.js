#!/usr/bin/env node
/* Compile src/ en un seul index.html (aucune dépendance). Usage : node build.js */
'use strict';
const fs = require('fs'), path = require('path');
const root = __dirname, src = path.join(root, 'src');
/* Deux versions à partir du même code : « seance » (programme officiel, à la racine) et « maseance » (mes manuels, dans dist/maseance). */
const target = (process.argv[2] || 'seance').replace(/^--?(app=)?/, '');
const APPS = {
  seance: { id: 'seance', nom: 'Fiches', titre: 'Fiches — séances et séquences de maths', court: 'Fiches', version: 'v1', prefix: 'fiches_v1_', cache: 'fiches-', manuels: false, url: 'https://tom-rougeaud.github.io/seance/', frere: { nom: 'Ma séance (mes manuels)', url: 'https://tom-rougeaud.github.io/maseance/' }, theme: '#2B4C7E', palette: 'marine', out: root },
  maseance: { id: 'maseance', nom: 'Ma séance', titre: 'Ma séance — séances construites sur mes manuels', court: 'Ma séance', version: 'v1', prefix: 'maseance_v1_', cache: 'maseance-', manuels: true, url: 'https://tom-rougeaud.github.io/maseance/', frere: { nom: 'Fiches (programme officiel)', url: 'https://tom-rougeaud.github.io/seance/' }, theme: '#3C6B52', palette: 'foret', out: path.join(root, 'dist', 'maseance') }
};
const A = APPS[target];
if (!A) { console.error('Version inconnue : ' + target + ' (seance | maseance)'); process.exit(1); }
const read = (p) => fs.readFileSync(path.join(src, p), 'utf8');
const js = fs.readdirSync(path.join(src, 'js')).filter((f) => f.endsWith('.js')).sort();
/* polices libres (OFL) intégrées en base64 : aucune ressource externe */
const FONTS = { 'Source Sans 3': 'source-sans-3', 'Lora': 'lora', 'Nunito': 'nunito', 'Atkinson Hyperlegible': 'atkinson-hyperlegible', 'Patrick Hand': 'patrick-hand' };
let fontCss = '';
for (const [fam, file] of Object.entries(FONTS)) for (const w of [400, 700]) {
  const fp = path.join(src, 'fonts', file + '-latin-' + w + '-normal.woff2');
  if (!fs.existsSync(fp)) continue;
  fontCss += '@font-face{font-family:"' + fam + '";font-style:normal;font-weight:' + w + ';font-display:swap;src:url(data:font/woff2;base64,' + fs.readFileSync(fp).toString('base64') + ') format("woff2")}\n';
}
const ref = JSON.stringify(JSON.parse(read('data/referentiels.json'))).replace(/<\//g, '<\\/');
const code = js.map((f) => '/* ── ' + f + ' ── */\n' + read('js/' + f)).join('\n');
if (/<\/script/i.test(code)) { console.error('Erreur : « </script » présent dans le code JS.'); process.exit(1); }
const build = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
const appObj = { id: A.id, nom: A.nom, version: A.version, build: build, prefix: A.prefix, cache: A.cache, manuels: A.manuels, url: A.url, frere: A.frere, palette: A.palette };
let man = 'null';
if (A.manuels) man = JSON.stringify(JSON.parse(read('data/manuels.json'))).replace(/<\//g, '<\\/');
let html = read('index.template.html');
html = html.replace('/*CSS*/', () => fontCss + read('css/app.css')).replace('/*REF*/', () => ref).replace('/*MANUELS*/', () => man).replace('/*JS*/', () => code)
  .replace('__TITRE__', A.titre).replace(/__COURT__/g, A.court).replace('__THEME__', A.theme);
html = html.replace(/var APP = \{[^\n]*\};/, () => 'var APP = ' + JSON.stringify(appObj) + ';');
fs.mkdirSync(A.out, { recursive: true });
fs.writeFileSync(path.join(A.out, 'index.html'), html);
fs.writeFileSync(path.join(A.out, 'sw.js'), read('sw.template.js').replace(/__BUILD__/g, build).replace(/__CACHE__/g, A.cache));
if (A.out !== root) {
  const man2 = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));
  man2.name = A.titre; man2.short_name = A.court; man2.theme_color = A.theme; man2.description = 'Préparer ses séances de maths en s’appuyant sur ses manuels (pages, exercices, liens).';
  fs.writeFileSync(path.join(A.out, 'manifest.webmanifest'), JSON.stringify(man2, null, 2));
  for (const f of ['config.js', 'LICENSE']) if (fs.existsSync(path.join(root, f))) fs.copyFileSync(path.join(root, f), path.join(A.out, f));
  fs.cpSync(path.join(root, fs.existsSync(path.join(root, 'icons-' + A.id)) ? 'icons-' + A.id : 'icons'), path.join(A.out, 'icons'), { recursive: true });
}
console.log(target + ' → ' + path.relative(root, path.join(A.out, 'index.html')) + ' : ' + (html.length / 1024).toFixed(0) + ' Ko · cache ' + A.cache + build + ' · ' + js.length + ' fichiers JS');
