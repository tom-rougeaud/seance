'use strict';
/* Tests unitaires du chiffrement (Node). Auteur : Tom Rougeaud · Réalisé avec l’aide de Claude Sonnet 5.5 (Anthropic) */
const T = require('../src/js/13-chiffre.js')._test;
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
(async () => {
  const c = await T.creer('Mot-de-passe-1');
  ok(/^([A-Z2-9]{4}-){5}[A-Z2-9]{4}$/.test(c.code), 'code de récupération : 24 signes, alphabet sans 0/O/1/I');
  ok(new Set(Array.from({ length: 200 }, T.nouveauCode)).size === 200, '200 codes tous différents');
  const viaMdp = await T.ouvre(await T.cleMdp('Mot-de-passe-1', c.rec.salt), c.rec.wrap_mdp);
  const viaCode = await T.ouvre(await T.cleCode(c.code.toLowerCase().replace(/-/g, ' ')), c.rec.wrap_rec);
  ok(Buffer.compare(Buffer.from(viaMdp), Buffer.from(c.brut)) === 0 && Buffer.compare(Buffer.from(viaCode), Buffer.from(c.brut)) === 0, 'mot de passe et code ouvrent la même clé');
  let refus = false; try { await T.ouvre(await T.cleMdp('mauvais', c.rec.salt), c.rec.wrap_mdp); } catch (e) { refus = true; }
  ok(refus, 'mauvais mot de passe refusé');
  refus = false; try { await T.ouvre(await T.cleCode('AAAA-BBBB-CCCC-DDDD-EEEE-FFFF'), c.rec.wrap_rec); } catch (e) { refus = true; }
  ok(refus, 'mauvais code refusé');
  const k = await crypto.subtle.importKey('raw', c.brut, 'AES-GCM', false, ['encrypt', 'decrypt']);
  const a = await T.scelle(k, new TextEncoder().encode('Bonjour é€')), b = await T.scelle(k, new TextEncoder().encode('Bonjour é€'));
  ok(a !== b, 'deux chiffrements du même texte sont différents (iv aléatoire)');
  ok(new TextDecoder().decode(await T.ouvre(k, a)) === 'Bonjour é€', 'aller-retour avec accents');
  const u = T.b64d(a); u[20] ^= 1; refus = false; try { await T.ouvre(k, T.b64e(u)); } catch (e) { refus = true; }
  ok(refus, 'texte modifié détecté (intégrité)');
  ok(c.rec.salt !== (await T.creer('Mot-de-passe-1')).rec.salt, 'sel différent à chaque création');
  const tables = Object.keys(T.ENC); ok(tables.length === 10 && !('user_id' in Object.assign({}, ...Object.values(T.ENC))), '10 tables couvertes, user_id jamais chiffré');
  console.log('\n' + pass + ' ok, ' + fail + ' échecs'); process.exit(fail ? 1 : 0);
})();
