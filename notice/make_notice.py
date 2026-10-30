from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether, Preformatted
import re
_PP = Paragraph
def Paragraph(t, *a, **k):
    t = re.sub('[\U0001F300-\U0001FAFF\u2600-\u27BF\u2B00-\u2BFF\uFE0F\u2795\uFF0B\u2630]\\s?', '', t)  # pas d’émojis : la police du PDF n’a pas les glyphes
    return _PP(t, *a, **k)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
D='/usr/share/fonts/truetype/dejavu/'
pdfmetrics.registerFont(TTFont('S',D+'DejaVuSans.ttf')); pdfmetrics.registerFont(TTFont('SB',D+'DejaVuSans-Bold.ttf')); pdfmetrics.registerFont(TTFont('M',D+'DejaVuSansMono.ttf'))
pdfmetrics.registerFontFamily('S',normal='S',bold='SB',italic='S',boldItalic='SB')
NAVY=colors.HexColor('#2B4C7E'); SLATE=colors.HexColor('#5C677D'); LINE=colors.HexColor('#D5DBE6'); BG=colors.HexColor('#EAEEF5')
B=ParagraphStyle('b',fontName='S',fontSize=9.6,leading=14,textColor=colors.HexColor('#1B2438'),spaceAfter=4)
H1=ParagraphStyle('h1',parent=B,fontName='SB',fontSize=21,leading=26,textColor=NAVY,spaceAfter=2)
H2=ParagraphStyle('h2',parent=B,fontName='SB',fontSize=12.5,leading=16,textColor=NAVY,spaceBefore=12,spaceAfter=4)
SUB=ParagraphStyle('s',parent=B,fontSize=10.5,textColor=SLATE,spaceAfter=10)
SM=ParagraphStyle('sm',parent=B,fontSize=8.4,leading=11.5,textColor=SLATE)
BUL=ParagraphStyle('bul',parent=B,leftIndent=14,bulletIndent=3,spaceAfter=2)
CODE=ParagraphStyle('c',fontName='M',fontSize=7.6,leading=10,textColor=colors.HexColor('#1B2438'))
def bl(t): return Paragraph(t,BUL,bulletText='•')
def box(title,lines,col=BG):
    data=[[Paragraph('<b>'+title+'</b>',B)]]+[[Paragraph(l,B)] for l in lines]
    t=Table(data,colWidths=[170*mm]); t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),col),('BOX',(0,0),(-1,-1),0.6,LINE),('LEFTPADDING',(0,0),(-1,-1),8),('RIGHTPADDING',(0,0),(-1,-1),8),('TOPPADDING',(0,0),(-1,-1),3),('BOTTOMPADDING',(0,0),(-1,-1),3)])); return t
def step(n,title,body):
    num=Table([[str(n)]],colWidths=[8*mm],rowHeights=[8*mm]); num.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),NAVY),('TEXTCOLOR',(0,0),(-1,-1),colors.white),('FONTNAME',(0,0),(-1,-1),'SB'),('ALIGN',(0,0),(-1,-1),'CENTER'),('VALIGN',(0,0),(-1,-1),'MIDDLE')]))
    t=Table([[num,[Paragraph('<b>'+title+'</b>',B)]+body]],colWidths=[11*mm,159*mm]); t.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),0),('BOTTOMPADDING',(0,0),(-1,-1),6)])); return t
def footer(c,doc):
    c.saveState(); c.setFont('S',7.6); c.setFillColor(SLATE)
    c.drawString(20*mm,12*mm,'Fiches · notice d’installation · CC BY-NC 4.0 · Tom Rougeaud'); c.drawRightString(190*mm,12*mm,'page %d'%doc.page); c.restoreState()
doc=SimpleDocTemplate('Fiches_notice_installation.pdf',pagesize=A4,leftMargin=20*mm,rightMargin=20*mm,topMargin=18*mm,bottomMargin=20*mm,title='Fiches — notice d’installation',author='Tom Rougeaud')
S=[]
S+= [Paragraph('Fiches — notice d’installation',H1),Paragraph('Générateur de séances et de séquences de maths (3PM, CAP, Bac Pro) · progression automatique',SUB)]
S+= [box('En deux mots',['Une page web installable qui propose les objectifs, notions et automatismes des programmes officiels en accordéons à cocher, produit des fiches séance / séquence éditables (DM, demi-groupes, ressources, impression, Word) et remplit <b>automatiquement la progression</b> de chaque classe avec les séances « faites ».','Adresse après mise en ligne : <b>https://tom-rougeaud.github.io/seance/</b>'])]
S+= [Paragraph('Installation en 4 étapes (environ 10 minutes)',H2)]
S+= [step(1,'Préparer la base Supabase (une seule fois)',[
 Paragraph('Ouvrez <b>supabase.com › votre projet › SQL Editor › New query</b>. Collez tout le contenu du fichier <font name="M">sql/supabase_fiches.sql</font> (dans le dépôt GitHub, dossier <font name="M">sql</font>) puis cliquez sur <b>Run</b>. Le script peut être relancé sans risque : il ne supprime rien.',B),
 Paragraph('Il crée onze tables préfixées <font name="M">fs_</font>, les règles de sécurité (chaque compte ne voit que ses propres lignes), deux fonctions et un espace de fichiers privé <font name="M">fiches-ressources</font> (50 Mo par fichier). Vos tables « Suivi Progression » et « Flash Maths » ne sont pas touchées.',B)])]
S+= [step(2,'Vérifier la connexion (Authentication)',[
 Paragraph('L’appli utilise le <b>même compte</b> que vos autres applis (e-mail + mot de passe). Dans <b>Authentication › Providers › Email</b>, laissez « Email » activé. Si « Confirm email » est activé, un nouveau compte doit cliquer sur le lien reçu par e-mail avant la première connexion (pas nécessaire si vous réutilisez votre compte existant).',B)])]
S+= [step(3,'Activer GitHub Pages sur le dépôt « seance »',[
 Paragraph('Sur GitHub : <b>Settings › Pages › Build and deployment</b> : Source « Deploy from a branch », branche <b>main</b>, dossier <b>/ (root)</b>, puis <b>Save</b>. Après une à deux minutes, l’appli répond à l’adresse ci-dessus.',B),
 Paragraph('Le fichier <font name="M">config.js</font> contient déjà l’adresse et la clé publique (« publishable ») de votre projet Supabase : rien à modifier si c’est bien le même projet que vos autres applis.',B)])]
S+= [step(4,'Se connecter et installer sur l’écran d’accueil',[
 bl('<b>iPhone / iPad (Safari)</b> : bouton Partager (carré + flèche) › « Sur l’écran d’accueil » › Ajouter.'),
 bl('<b>Android (Chrome)</b> : menu ⋮ › « Installer l’application » (ou « Ajouter à l’écran d’accueil »).'),
 bl('<b>Ordinateur (Chrome / Edge)</b> : icône d’installation à droite de la barre d’adresse, ou menu › « Installer Fiches ».'),
 Paragraph('L’appli propose aussi elle-même l’installation (bandeau, et Réglages › « Comment installer ? »).',B)])]
S+= [Paragraph('Première utilisation',H2)]
S+= [bl('<b>Planning</b> (menu) : indiquez si la semaine de rentrée est une <b>semaine 1 ou 2</b>, puis faites glisser sur la grille (lundi→vendredi, 8 h–18 h) pour créer vos créneaux ; cliquez un créneau pour le modifier ou le supprimer, tirez-le pour le déplacer. Les heures de chaque classe en semaine 1 et en semaine 2 se calculent seules.'),
 bl('<b>Classes</b> › « Nouvelle classe » : nom, niveau (3PM, CAP, 2de, 1re, Tle), groupement (les créneaux se règlent surtout dans le Planning). Le calendrier zone A 2026-2027 est importé : <b>vérifiez-le</b> avec votre établissement (PFMP, examens, journées banalisées à ajouter dans la page de la classe).'),
 bl('<b>＋ Séquence</b> : cochez objectifs, notions et automatismes dans les accordéons ; ajoutez les vôtres avec la ligne « ＋ Ajouter mon objectif… » (☰ pour en coller plusieurs). « ⚡ Générer un plan type » crée activité, cours, exercices, évaluation avec dates proposées.'),
 bl('<b>Séance</b> : déroulé, matériel, différenciation, DM (classe, groupe 1 ou groupe 2), demi-groupes (« Créer la séance de l’autre demi-groupe » ou deux activités en parallèle), liens / vidéos / PDF par glisser-déposer ou bouton.'),
 bl('<b>Marquez la séance « Faite »</b> : la <b>Progression</b> se met à jour toute seule (par chapitre, calendrier annuel, reste à faire). Un clic sur la pastille d’un objectif force un statut à la main.'),
 bl('<b>📋 Pronote</b> dans l’en-tête d’une séance : « Rédiger la synthèse » écrit quelques phrases sur ce qui a été traité (pas le déroulé) et le travail à faire, que vous modifiez puis copiez ; le texte dit ce qui a été fait (savoir-faire du programme). Le <b>🔒 Mémo perso</b> (bouton « Mémo manuels », section à part, réservé à vous et absent des exports) s’appuie sur vos manuels : chapitre, notions, lien de l’appli, notions à revoir. <b>Imprimer / Word</b> dans l’en-tête de chaque fiche ; <b>Réglages › Exporter (JSON)</b> pour sauvegarder.'),
 bl('<b>📥 Modèles d’1 h</b> (en-tête d’une séance, page classe, séquence, accueil) : chaque chapitre est découpé en séances d’environ 1 h déjà préremplies (objectif, déroulé, trace écrite, matériel) ; chargez-en une ou créez-en plusieurs d’un coup, puis adaptez. <b>💾 Enregistrer comme modèle</b> garde vos propres séances.'),
 bl('<b>📚 Historique</b> (page d’une classe ou « Classes ») : toutes les fiches de la classe, uniquement ce que vous avez saisi ; <b>Imprimer / PDF</b> (choisir « Enregistrer au format PDF »), Word ou HTML. Les boutons d’export sont aussi en bas des fiches.')]
S+= [Paragraph('Parcours guidé',H2)]
S+= [Paragraph('En bas de chaque page, un bloc <b>« 👉 Et maintenant ? »</b> propose <b>le bouton de l’étape suivante</b> (créneaux → séquence → séances → suivi pour une classe ; titre → contenu → déroulé → « prête » → « faite » → synthèse Pronote → bilan → séance suivante pour une séance) et quelques raccourcis. Il s’adapte à l’état de la page.',B)]
S+= [Paragraph('Deux versions : « Fiches » et « Ma séance »',H2)]
S+= [bl('<b>Fiches</b> (<font name="M">tom-rougeaud.github.io/seance/</font>) : la version <b>programme officiel (BO)</b>, destinée à être partagée.'),
 bl('<b>Ma séance</b> (<font name="M">tom-rougeaud.github.io/maseance/</font>) : la version <b>mes manuels</b>, pour vous. Les 4 manuels (2de, 1re, Tle, 3e) sont <b>intégrés au fichier</b> : 33 chapitres, 143 notions avec leurs pages, 202 exercices avec leur page et leur type. Dans une séance, la section « 📘 Manuel » liste chapitre, notions et exercices à cocher ; chaque ligne a un lien vers <b>la bonne page du PDF</b> et vers l’appli du manuel. Les notions cochées ajoutent aussi les objectifs correspondants du BO : la <b>progression</b> reste à jour. Le texte Pronote cite le chapitre, les notions, les exercices et leurs pages.'),
 bl('<b>📥 Modèles › « Mes manuels »</b> : pour chaque chapitre, une séance d’1 h par notion (Je découvre › Je retiens › exercices), une séance de défis et une séance de contrôle, déjà remplies avec pages et numéros d’exercices.'),
 bl('Les deux versions partagent <b>le même compte et les mêmes données</b> Supabase (aucune modification du script SQL). Elles ont chacune leur installation sur l’écran d’accueil (icône bleue / verte), leurs réglages locaux et leur connexion.'),
 Paragraph('<b>Mise en place de « Ma séance » (3 actions, une seule fois)</b> : (1) sur GitHub, dépôt <font name="M">maseance</font> › Settings › Pages › branche <b>main</b>, dossier <b>/ (root)</b> ; (2) dans Supabase › Authentication › URL Configuration › <b>Redirect URLs</b> : ajouter <font name="M">https://tom-rougeaud.github.io/maseance/</font> (pour les liens de réinitialisation du mot de passe) ; (3) ouvrir l’adresse, se connecter avec le même e-mail et mot de passe. Dans « Fiches », le lien vers « Ma séance » n’apparaît dans Réglages que pour les comptes listés dans <font name="M">OWNER_EMAILS</font> de <font name="M">config.js</font>.',B)]
S+= [Paragraph('Voir les mises à jour',H2)]
S+= [bl('La <b>date de version</b> est affichée en haut de l’écran (« v. 30/10 09h50 ») et dans Réglages › « Version et mises à jour ».'),
 bl('À chaque ouverture (et au retour sur l’appli), elle vérifie s’il existe une version plus récente : un <b>bandeau « Mettre à jour maintenant »</b> apparaît et reste affiché tant que vous ne choisissez pas. Réglages › <b>« Rechercher une mise à jour »</b> le fait à la demande ; <b>« Forcer le rechargement complet »</b> vide le cache de l’appli (vos données ne sont pas touchées).'),
 Paragraph('Pour publier une mise à jour à la main : remplacer dans le dépôt les fichiers <font name="M">index.html</font> et <font name="M">sw.js</font> (le reste ne change pas ; ne pas toucher à <font name="M">config.js</font> si le projet Supabase est le même). Si une nouvelle version du script SQL est fournie, la relancer dans le SQL Editor avant.',B)]
S+= [Paragraph('Confidentialité et limites',H2)]
S+= [bl('Aucune donnée d’élève n’est demandée : n’en saisissez pas dans les champs libres. Aucun traceur, aucune police ni script distants.'),
 bl('Les fichiers (PDF, images) vont dans un espace privé de votre Supabase ; les liens YouTube sont enregistrés en version « sans cookies » et ne sont jamais intégrés automatiquement.'),
 bl('Hors connexion : les fiches déjà chargées restent lisibles et modifiables ; les modifications partent au retour du réseau (badge en haut à droite). Se déconnecter avec des modifications en attente demande confirmation.'),
 bl('<b>Programmes</b> : maths uniquement (pas de sciences-physique). Les formulations sont reprises des BO fournis ; la suggestion de compétences d’après le verbe d’action est une aide à valider.'),
 bl('<b>Non testé</b> sur un vrai projet Supabase ni sur de vrais appareils iOS / Android : les tests ont utilisé un faux serveur Supabase et Chromium. Premier réflexe en cas de souci : badge « erreur d’enregistrement » › lire le message (souvent le script SQL non exécuté).')]
doc.build(S,onFirstPage=footer,onLaterPages=footer)
