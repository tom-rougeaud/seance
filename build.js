#!/usr/bin/env node
/* Compile src/ en un seul index.html (aucune dépendance). Usage : node build.js */
'use strict';
const fs = require('fs'), path = require('path');
const root = __dirname, src = path.join(root, 'src');
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
let html = read('index.template.html');
html = html.replace('/*CSS*/', () => fontCss + read('css/app.css')).replace('/*REF*/', () => ref).replace('/*JS*/', () => code);
fs.writeFileSync(path.join(root, 'index.html'), html);
fs.writeFileSync(path.join(root, 'sw.js'), read('sw.template.js').replace('__BUILD__', build));
console.log('index.html : ' + (html.length / 1024).toFixed(0) + ' Ko · sw.js cache fiches-' + build + ' · ' + js.length + ' fichiers JS');
