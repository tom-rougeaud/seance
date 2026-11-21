/* =====================================================================
   Projet : Fiches — tests des règles du bloc Compte  ·  Date : 21/11/2026
   Auteur : Tom Rougeaud  ·  Licence : CC BY-NC 4.0
   Réalisé avec l’aide de l’IA : Claude Sonnet 5.5 (Anthropic)
   Usage : node tests/compte-regles.js
   ===================================================================== */
'use strict';
const R = require('../src/js/12-compte.js');
let ok = 0, ko = 0;
function t(c, m) { if (c) { ok++; } else { ko++; console.log('  ✗ ' + m); } }

/* --- mots de passe --- */
t(R.evaluerMdp('Abcdefgh1234!').ok === true, 'mot de passe valide accepté');
t(R.evaluerMdp('Abcde1!').ok === false, 'trop court refusé (7 car.)');
t(R.evaluerMdp('Abcdef1!').ok === true, 'exactement 8 caractères accepté');
t(R.evaluerMdp('Abcde1!').ok === false, '7 caractères refusé');
t(R.evaluerMdp('abcdefghij1!').ok === false, 'sans majuscule refusé');
t(R.evaluerMdp('ABCDEFGHIJ1!').ok === false, 'sans minuscule refusé');
t(R.evaluerMdp('Abcdefghijk!').ok === false, 'sans chiffre refusé');
t(R.evaluerMdp('Abcdefghijk1').ok === false, 'sans caractère spécial refusé');
/* tous les caractères spéciaux annoncés comptent bien */
R.SYMBOLES.split('').forEach(function (c) { t(R.evaluerMdp('Abcdefghij1' + c).ok === true, 'symbole accepté : ' + c); });
/* les accents et signes du clavier français ne comptent PAS comme caractère spécial (même règle que le serveur) */
'éèàçù§²€£µ°¨'.split('').forEach(function (c) { t(R.evaluerMdp('Abcdefghij1' + c).symbole === false, 'non compté comme spécial : ' + c); });
t(R.evaluerMdp('Abcdefghij1é!').ok === true, 'accent permis en plus d’un vrai spécial');
t(R.evaluerMdp('A1!' + 'a'.repeat(70)).tropLong === true, 'plus de 72 octets signalé');
t(R.evaluerMdp('A1!' + 'a'.repeat(69)).tropLong === false, '72 octets pile accepté');
t(R.evaluerMdp('é'.repeat(40) + 'A1!').tropLong === true, 'accents comptés en octets');
t(R.evaluerMdp(null).ok === false && R.evaluerMdp(undefined).ok === false, 'valeur vide sans plantage');

/* --- pseudos (6 à 20 caractères, exception « tom », insensible à la casse) --- */
t(R.pseudoValide(R.normaliserPseudo('TOM')) && R.pseudoValide(R.normaliserPseudo('  Eleve_42 ')), 'majuscules ignorées après normalisation');
t(R.normaliserPseudo('ÉLÈVE1') !== 'eleve1' || !R.pseudoValide(R.normaliserPseudo('ÉLÈVE1')), 'accents toujours refusés');
['eleve_42', 'abc-12', 'a-b_c9', 'x'.repeat(20), 'tom'].forEach(function (p) { t(R.pseudoValide(p), 'pseudo valide : ' + p); });
['ab', 'abcde', 'tomm', 'to', 'x'.repeat(21), 'Éva', 'a b', 'a.b', 'a@b', '', 'élève'].forEach(function (p) { t(!R.pseudoValide(p), 'pseudo refusé : ' + p); });
t(R.normaliserPseudo('  Eleve_42 ') === 'eleve_42', 'normalisation (espaces, majuscules)');
t(R.normaliserPseudo(null) === '', 'normalisation de null');

/* --- identifiant -> e-mail de connexion --- */
t(R.identifiantVersEmail('Eleve_42') === 'eleve_42@fiches.pseudo.invalid', 'pseudo -> e-mail technique');
t(R.identifiantVersEmail(' prof@exemple.fr ') === 'prof@exemple.fr', 'e-mail inchangé');
t(R.estEmail('a@b') && !R.estEmail('abc'), 'détection e-mail');

console.log((ko ? '✗ ' : '✓ ') + ok + ' réussis, ' + ko + ' échec(s)');
process.exit(ko ? 1 : 0);
