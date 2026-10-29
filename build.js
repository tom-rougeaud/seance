#!/usr/bin/env node
/* Compile src/ en un seul index.html (aucune dépendance). Usage : node build.js */
'use strict';
const fs = require('fs'), path = require('path');
const root = __dirname, src = path.join(root, 'src');
const read = (p) => fs.readFileSync(path.join(src, p), 'utf8');
const js = fs.readdirSync(path.join(src, 'js')).filter((f) => f.endsWith('.js')).sort();
const ref = JSON.stringify(JSON.parse(read('data/referentiels.json'))).replace(/<\//g, '<\\/');
const code = js.map((f) => '/* ── ' + f + ' ── */\n' + read('js/' + f)).join('\n');
if (/<\/script/i.test(code)) { console.error('Erreur : « </script » présent dans le code JS.'); process.exit(1); }
const build = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
let html = read('index.template.html');
html = html.replace('/*CSS*/', () => read('css/app.css')).replace('/*REF*/', () => ref).replace('/*JS*/', () => code);
fs.writeFileSync(path.join(root, 'index.html'), html);
fs.writeFileSync(path.join(root, 'sw.js'), read('sw.template.js').replace('__BUILD__', build));
console.log('index.html : ' + (html.length / 1024).toFixed(0) + ' Ko · sw.js cache fiches-' + build + ' · ' + js.length + ' fichiers JS');
