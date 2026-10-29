# Fiches — séances et séquences de maths

Application web (une seule page HTML, installable sur l’écran d’accueil) pour préparer ses **séances** et **séquences** de mathématiques en voie professionnelle : **3e Prépa-Métiers, CAP, Bac Pro 2de / 1re / Tle**, tous groupements.

- Objectifs, notions et automatismes des programmes officiels proposés en **accordéons à cocher** ; ajout, renommage ou masquage de ses propres éléments.
- Fiches séance / séquence entièrement éditables : déroulé, matériel, différenciation, trace écrite, évaluation, **DM** (classe entière ou demi-groupe), **demi-groupes** (séance jumelle ou deux groupes en parallèle), co-intervention.
- **Progression automatique** : les séances marquées « faites » remplissent la progression de la classe (par chapitre, calendrier annuel, reste à faire) ; statut modifiable à la main.
- Liens, vidéos, PDF et fichiers par saisie ou glisser-déposer, bibliothèque réutilisable.
- **Emploi du temps** lundi→vendredi (8 h–18 h) : créneaux créés en glissant sur la grille, modifiables à tout moment ; **semaines 1 / 2** (semaine de rentrée à indiquer) ; heures par classe et par semaine ; dates de séances proposées selon l’alternance.
- **Synthèse Pronote** : quelques phrases rédigées automatiquement à partir de la séance — ce qui a été traité (pas le déroulé) —, modifiables et copiables en un clic. À part, un **🔒 Mémo perso** réservé à l’enseignant(e), appuyé sur les manuels (« Maths et MCV » 2de / 1re / Tle, « 3ème Série Pro ») : chapitre, notions, lien de l’appli, notions à revoir ; il n’apparaît dans aucun export (table de correspondance dans `src/js/57-manuels.js` ; pas de manuel pour le CAP).
- **Historique des fiches** : par classe (ou toutes), uniquement les éléments saisis, export PDF (fenêtre d’impression › « Enregistrer au format PDF »), Word et HTML ; boutons d’export aussi en bas des fiches.
- **Modèles de séances d’1 h** : pour chaque chapitre, les objectifs et notions sont regroupés en séances d’environ 1 h (≈ 270 propositions sur les 5 niveaux), chargeables dans une séance ou créables en lot ; « 💾 Enregistrer comme modèle » pour vos propres modèles (table `fs_modeles`).
- **Apparence** : 8 palettes calmes (clair / sombre, dont un contraste élevé), 6 polices libres intégrées (OFL, aucun téléchargement), taille du texte ; le choix suit le compte.
- Impression A4, export Word, texte détaillé pour le cahier de textes, sauvegarde / import JSON.
- Données enregistrées dans **Supabase** (même projet et même compte que « Suivi Progression » / « Flash Maths »), lecture hors connexion.
- Aucune donnée d’élève, aucun traceur, aucune ressource externe (pas de CDN, pas de police distante).

## Mise en route

1. **Base de données** — Supabase › SQL Editor : exécuter une fois `sql/supabase_fiches.sql` (idempotent : peut être rejoué sans risque). Il crée les tables `fs_*`, les règles de sécurité (RLS : chaque compte ne voit que ses lignes), les fonctions et le bucket privé `fiches-ressources`.
2. **Configuration** — `config.js` contient l’URL du projet et la clé *publishable* (publique par conception).
3. **Mise en ligne** — GitHub Pages sur la branche `main`, dossier racine : <https://tom-rougeaud.github.io/seance/>.

## Développement

```
node build.js          # src/ → index.html + sw.js (aucune dépendance)
```

- `src/js/` : modules chargés dans l’ordre des numéros ; `src/data/referentiels.json` : programmes (intégrés dans la page) ; `src/css/app.css` ; `src/index.template.html`.
- `tests/` : tests de bout en bout Playwright avec un faux Supabase (`node tests/e2e.js`, `node tests/e2e2.js`, serveur statique sur le port 8765) ; `tests/rls_test.sql` : test d’isolation des comptes (PostgreSQL).

## Sources et licence

Polices intégrées : Source Sans 3, Lora, Nunito, Atkinson Hyperlegible, Patrick Hand (SIL OFL 1.1, voir `src/fonts/LICENSES-polices.txt`).


Programmes : Bulletin officiel / éduscol (3e cycle 4 et DNB 2026 ; CAP, BO n°30 du 23 juillet 2020 ; Bac Pro 2de BO spécial n°5 du 11 avril 2019 ; 1re et Tle BO spécial n°1 du 6 février 2020). Calendrier zone A 2026-2027 : service-public.gouv.fr, à vérifier avec l’établissement.

© Tom Rougeaud — licence [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/deed.fr).
