/* ═══ FICHES · correspondance programme du BO ↔ chapitres de mes manuels « Maths et MCV » / « 3ème Série Pro » ═══ */
'use strict';
var Manuels = (function () {
  var BASE = 'https://tom-rougeaud.github.io/';
  function N(n, t, refs, notions) { return { n: n, t: t, refs: refs, notions: notions.map(function (x) { return { t: x[0], re: new RegExp(x[1]) }; }) }; }
  var M = {
    bp2: { nom: 'Maths et MCV · 2de', url: BASE + 'mcv/2de/', chap: [
      N(1, 'Prix, marges et TVA', ['bp2.calc'], [['Prendre un pourcentage', 'pourcentage|proportion'], ['Le coefficient multiplicateur', 'coefficient|multiplicateur|evolution'], ['Prix HT, TVA, prix TTC', 'tva|ttc|\\bht\\b|taxe'], ['La marge, le taux de marge, le taux de marque', 'marge|taux de marque|prix de vente|prix d.achat|cout'], ['Appliquer une baisse avec le coefficient', 'baisse|hausse|diminu|augment']]),
      N(2, 'Statistique à une variable', ['bp2.stat1'], [['Effectifs et fréquences', 'effectif|frequence|tableau'], ['La moyenne', 'moyenne|moyen'], ['La médiane et les quartiles', 'mediane|quartile'], ['Dispersion et boîte à moustaches', 'dispersion|etendue|ecart|boite|moustache|interquartile']]),
      N(3, 'Problèmes du premier degré', ['bp2.eq1'], [['Résoudre une équation', 'equation'], ['Mettre un problème en équation', 'probleme|mettre en equation|modelis'], ['Les intervalles', 'intervalle'], ['Résoudre une inéquation', 'inequation']]),
      N(4, 'Factures, réductions et intérêts', ['bp2.calc'], [['Les réductions commerciales', 'reduction|remise|rabais|ristourne|solde|escompte'], ['Devis et facture', 'devis|facture|commande'], ['L’intérêt simple', 'interet'], ['Deux remises successives', 'successiv']]),
      N(5, 'Fonctions', ['bp2.fonc'], [['Image et antécédent', 'image|antecedent'], ['Tableau de valeurs et courbe', 'tableau de valeurs|courbe|representation|graphique|tracer'], ['Fonction affine : la pente', 'affine|lineaire|pente|coefficient directeur|droite'], ['La fonction carré, le sens de variation', 'carre|variation|croissan|decroissan|extremum']]),
      N(6, 'Fluctuation et probabilités', ['bp2.proba'], [['Qu’est-ce qu’une probabilité ?', 'probabilite|experience aleatoire|evenement|issue'], ['Calculer une probabilité', 'equiprobab|calcul'], ['Compter avec un arbre ou un tableau', 'arbre|tableau|denombr'], ['Fréquence et fluctuation', 'frequence|fluctuation|echantillon|simulation'], ['Probabilité et événement contraire', 'contraire']]),
      N(7, 'Géométrie', ['bp2.geo'], [['Aires et périmètres', 'aire|perimetre|surface'], ['Volumes et contenances', 'volume|contenance|capacite|solide'], ['Le théorème de Pythagore', 'pythagore|triangle rectangle|hypotenuse'], ['Agrandir et réduire', 'agrand|reduction|reduire|thales|homothet|echelle']]),
      N(8, 'Croisement de deux variables', ['bp2.stat1', 'bp2.proba'], [['Lire un tableau croisé', 'croise|double entree|deux variables'], ['Compléter un tableau croisé', 'croise|completer'], ['Sur le total, ou « parmi » ?', 'parmi|sachant|conditionnel'], ['Comparer deux groupes', 'comparer|croise']])] },
    bp1: { nom: 'Maths et MCV · 1re', url: BASE + 'mcv/1ere/', chap: [
      N(1, 'Calculs commerciaux et financiers', ['bp1.calc'], [['Coût total, recette et résultat', 'cout total|recette|resultat|benefice|cout fixe|cout variable'], ['Coût moyen et coût marginal', 'moyen|marginal'], ['Les intérêts simples', 'interet'], ['Les taux : an, mois, quinzaine, jour', 'taux|equivalent|proportionnel|quinzaine|mensuel']]),
      N(2, 'Résolution graphique d’équations et d’inéquations', ['bp1.resgraph'], [['Lire une image et un antécédent', 'image|antecedent|lire'], ['Résoudre f(x) = g(x)', 'equation|intersection|resoudre'], ['Comparer : f(x) ≥ g(x)', 'inequation|comparer|superieur'], ['Le seuil de rentabilité', 'seuil|rentabilite']]),
      N(3, 'Fonctions polynômes de degré 2', ['bp1.poly2'], [['La parabole : ax² + bx + c', 'parabole|degre 2|second degre|polynome'], ['Les racines : f(x) = 0', 'racine|discriminant|annul|f\\(x\\) ?= ?0'], ['Forme factorisée et signe', 'factoris|signe'], ['Le sommet et l’extremum', 'sommet|extremum|maximum|minimum|axe de symetrie|variation']]),
      N(4, 'Fonction dérivée et étude des variations', ['bp1.deriv'], [['Taux de variation et tangente', 'taux de variation|tangente|nombre derive'], ['La fonction dérivée', 'fonction derivee|deriv|formule'], ['Signe de la dérivée et variations', 'signe|variation|extremum'], ['Dérivée et coût marginal', 'marginal'], ['La fonction inverse', 'inverse']]),
      N(5, 'Suites numériques', ['bp1.suites'], [['Notation indicielle et termes', 'notation|indice|terme|rang|recurrence|explicite'], ['Le sens de variation d’une suite', 'variation|croissan|decroissan|monoton'], ['Les suites arithmétiques', 'arithmetique|raison'], ['La somme des premiers termes', 'somme'], ['Les suites géométriques', 'geometrique|exponentiel']]),
      N(6, 'Statistique à deux variables quantitatives', ['bp1.stat2'], [['Nuage de points et point moyen', 'nuage|point moyen|representer|deux variables'], ['La droite d’ajustement', 'ajustement|droite|moindres|affine'], ['Le coefficient de détermination R²', 'coefficient de determination|r2|qualite|determination'], ['Prévoir et rester prudent', 'prevoir|prevision|extrapol|interpol|estim']]),
      N(7, 'Probabilités', ['bp1.proba'], [['Expérience aléatoire et probabilité', 'experience|probabilite|loi|equiprobab|univers|issue'], ['Contraire et incompatibles', 'contraire|incompatible'], ['Réunion et intersection', 'reunion|intersection|formule'], ['Le tableau croisé', 'tableau|croise|arbre'], ['La probabilité conditionnelle', 'condition|sachant|arbre']]),
      N(8, 'Géométrie dans l’espace', ['bp1.espace'], [['Représenter un solide en perspective', 'perspective|representer|patron|solide|cavaliere'], ['Volumes : prismes, cylindres, pyramides, cônes', 'volume|prisme|cylindre|pyramide|cone'], ['Le volume de la boule', 'boule|sphere'], ['Les sections planes', 'section'], ['Les solides composés', 'compose|assembl|decompos']])] },
    bpt: { nom: 'Maths et MCV · Terminale', url: BASE + 'mcv/terminale/', chap: [
      N(1, 'Suites numériques', ['bpt.suites'], [['Reconnaître une suite géométrique', 'geometrique|raison|reconnaitre'], ['Le terme de rang n', 'rang|terme general|explicite|recurrence'], ['Sens de variation et nuage de points', 'variation|nuage|representation|croissan'], ['La somme des premiers termes', 'somme'], ['Évolution à taux fixe et fonction exponentielle', 'taux|evolution|exponentiel|modelis']]),
      N(2, 'Calculs commerciaux et financiers', ['bpt.calc'], [['Les intérêts composés', 'interets? compos|capital|valeur acquise|placement'], ['La durée d’un placement', 'duree|periode|logarithme'], ['Taux mensuel équivalent et taux moyen', 'equivalent|moyen|taux'], ['L’emprunt à amortissement constant', 'amortissement'], ['L’emprunt à annuités constantes', 'annuite|mensualite|emprunt']]),
      N(3, 'Fonctions polynômes de degré 3', ['bpt.poly3'], [['La fonction cube', 'cube|degre 3|polynome'], ['Dériver un polynôme de degré 3', 'deriv'], ['Variations et extremums locaux', 'variation|extremum|signe'], ['Nombre de solutions de f(x) = c', 'solution|equation|valeurs intermediaires']]),
      N(4, 'Fonctions exponentielles et logarithme décimal', ['bpt.expo'], [['La fonction exponentielle x ↦ qˣ', 'exponentiel'], ['Les propriétés opératoires', 'propriete|operatoire|regle|puissance'], ['Le logarithme décimal', 'logarithme|\\blog\\b'], ['Résoudre qˣ = a', 'resoudre|equation'], ['Équation log(x) = a et inéquations', 'inequation|equation']]),
      N(5, 'Statistique à deux variables', ['bpt.stat2'], [['Nuage de points et choix d’un modèle', 'nuage|modele|choisir'], ['Le coefficient de détermination R²', 'determination|r2|qualite'], ['Le changement de variable z = log(y)', 'changement de variable|log'], ['Les changements de variable z = 1/x et z = qˣ', 'changement de variable|inverse'], ['Interpoler et extrapoler', 'interpol|extrapol|prevoir|estim']]),
      N(6, 'Probabilités', ['bpt.proba'], [['L’arbre pondéré', 'arbre|pondere'], ['La probabilité d’un chemin', 'chemin|produit'], ['La probabilité conditionnelle', 'condition|sachant'], ['La formule des probabilités totales', 'totale'], ['Évènements indépendants', 'independan']]),
      N(7, 'Exponentielle et logarithme népérien', ['bpt.lnexp'], [['Le nombre e et la fonction exponentielle', 'nombre e|exponentielle'], ['Dérivée de eˣ et croissance continue', 'deriv|croissance'], ['Le logarithme népérien', 'neperien|\\bln\\b'], ['Résoudre eˣ = a et ln(x) = a', 'resoudre|equation']])] },
    pm: { nom: '3ème Série Pro', url: BASE + '3eme/', chap: [
      N(1, 'Nombres entiers et arithmétique', ['pm.A3'], [['Multiples, diviseurs et critères de divisibilité', 'multiple|diviseur|divisib|critere'], ['Nombres premiers', 'premier'], ['Décomposer en produit de facteurs premiers', 'decompos|produit de facteurs'], ['Rendre une fraction irréductible', 'irreductible|fraction|pgcd']]),
      N(2, 'Fractions, puissances et écriture scientifique', ['pm.A1', 'pm.A2'], [['Additionner et soustraire des fractions', 'fraction|addition|soustra'], ['Prendre une fraction d’une quantité', 'fraction'], ['Puissances de 10 et préfixes', 'puissance|prefixe'], ['L’écriture scientifique', 'scientifique']]),
      N(3, 'Calcul littéral et équations', ['pm.A4'], [['Développer une expression', 'develop'], ['Factoriser et prouver avec une lettre', 'factoris|identit|prouver'], ['Résoudre une équation du premier degré', 'equation|resoudre'], ['Résoudre une équation produit nul', 'produit nul']]),
      N(4, 'Proportionnalité, pourcentages et grandeurs composées', ['pm.B7', 'pm.C9'], [['Proportionnalité et quatrième proportionnelle', 'proportionnalit|quatrieme|coefficient'], ['Pourcentages d’évolution', 'pourcentage|evolution|taux'], ['Grandeurs composées : vitesse et débit', 'vitesse|debit|grandeur|unite|conversion'], ['Partager selon un ratio', 'ratio|partage']]),
      N(5, 'Fonctions linéaires et affines', ['pm.B8'], [['Image, antécédent, lecture graphique', 'image|antecedent|lecture|notion de fonction|graphique|courbe'], ['Fonction linéaire et proportionnalité', 'lineaire'], ['Fonction affine', 'affine'], ['Comparer deux formules', 'comparer|formule|tableur|programme de calcul']]),
      N(6, 'Statistiques', ['pm.B5'], [['Calculer une moyenne', 'moyenne|moyen'], ['Médiane et étendue', 'mediane|etendue|quartile|dispersion'], ['Lire et comparer des diagrammes', 'diagramme|histogramme|representer|graphique|interpreter'], ['Fréquences et tableur', 'frequence|tableur|effectif']]),
      N(7, 'Probabilités', ['pm.B6'], [['Calculer une probabilité', 'probabilit|issue|equiprobab'], ['Événement contraire, impossible, certain', 'contraire|impossible|certain'], ['Une expérience à deux épreuves', 'epreuve|arbre|tableau'], ['Fréquence et probabilité', 'frequence|simulation|fluctuation']]),
      N(8, 'Pythagore et trigonométrie', ['pm.D12'], [['Le théorème de Pythagore', 'pythagore'], ['Prouver qu’un triangle est rectangle', 'reciproque|rectangle'], ['Calculer une longueur avec la trigonométrie', 'trigonom|sinus|cosinus|tangente'], ['Calculer un angle', 'angle']]),
      N(9, 'Échelles, agrandissements et Thalès', ['pm.D12', 'pm.C9', 'pm.D10'], [['Utiliser une échelle', 'echelle|plan|maquette'], ['Agrandir et réduire des longueurs', 'agrand|reduction|homothet|rapport'], ['Aires et volumes : k² et k³', 'aire|volume|coefficient'], ['Le théorème de Thalès', 'thales']]),
      N(10, 'Espace, transformations et programmes', ['pm.D11', 'pm.D10', 'pm.E13', 'pm.C9'], [['Volume d’un cylindre, d’un cône, d’une pyramide', 'volume|solide|cylindre|cone|pyramide|section'], ['Volume d’une boule', 'boule|sphere'], ['Se repérer sur la Terre', 'latitude|longitude|terre|coordonn'], ['Les transformations', 'transform|symetrie|translation|rotation|homothetie'], ['Programmer une boucle avec Scratch', 'scratch|programm|algorithm|boucle|instruction']])] }
  };

  function norm(t) { return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function has(niveauId) { return !!M[niveauId]; }
  function get(niveauId) { return M[niveauId] || null; }

  /* chapitres (et notions) du manuel qui correspondent à une séance : [{ chap, notions: [titres] }] */
  function match(niveauId, data, titre) {
    var m = M[niveauId]; if (!m) return null;
    var chapIds = (data.chapitres || []).slice();
    (data.items || []).forEach(function (i) { if (i.chap && chapIds.indexOf(i.chap) < 0) chapIds.push(i.chap); });
    var out = [];
    m.chap.forEach(function (c) {
      var hit = c.refs.filter(function (r) { return chapIds.indexOf(r) >= 0; }); if (!hit.length) return;
      var txt = norm((data.items || []).filter(function (i) { return hit.indexOf(i.chap) >= 0 || !i.chap; }).map(function (i) { return i.txt; }).join(' ') + ' ' + (titre || '') + ' ' + (data.objectif || ''));
      var ns = c.notions.filter(function (n) { return n.re.test(txt); }).map(function (n) { return n.t; });
      out.push({ chap: c, notions: ns.slice(0, 3), exact: ns.length > 0 });
    });
    /* si un chapitre du BO correspond à plusieurs chapitres du manuel, on garde ceux où une notion est reconnue */
    var withN = out.filter(function (x) { return x.exact; });
    if (withN.length) out = withN; else out = out.slice(0, 1);
    return out.slice(0, 2);
  }
  return { get: get, has: has, match: match, norm: norm };
})();
