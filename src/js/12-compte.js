/* =====================================================================
   Projet : Fiches — bloc « Compte » commun  ·  Version : 1.0.0  ·  Date : 21/11/2026
   Auteur : Tom Rougeaud  ·  Licence : CC BY-NC 4.0
   Réalisé avec l’aide de l’IA : Claude Sonnet 5.5 (Anthropic)
   Rôle : écran de connexion / création de compte, nouveau mot de passe,
          carte « Compte » (changer le mot de passe, supprimer le compte).
   Ce bloc est conçu pour être identique dans toutes les applis :
   seule la section « ADAPTATEUR » ci-dessous change d’une appli à l’autre.
   ===================================================================== */
'use strict';
var Compte = (function () {

  /* ===== SECTION : ADAPTATEUR (à adapter pour chaque appli) ===== */
  var ADAPTATEUR = {
    /* identifiant court de l’appli (a-z, 0-9, tiret) : chaque appli a ses propres comptes à pseudo.
       Il sert de suffixe à l’identifiant technique : pseudo@<appId>.pseudo.invalid */
    appId: 'fiches',
    /* ce que l’appli enregistre pour la personne (phrase affichée dans « Vos données ») */
    contenu: 'vos classes, séquences, séances, liens et fichiers ajoutés',
    /* fonction SQL qui efface les données de la personne et renvoie les chemins de fichiers à supprimer */
    rpcEffacerDonnees: 'fs_effacer_mes_donnees',
    /* adresse de la page de confidentialité de l’appli */
    lienConfidentialite: '#/confidentialite'
  };

  /* ===== SECTION : Constantes ===== */
  var DOMAINE_PSEUDO = ADAPTATEUR.appId + '.pseudo.invalid';  /* faux domaine réservé (.invalid), propre à l’appli : un pseudo n’a jamais de vraie adresse e-mail */
  var SUFFIXE_ANCIEN = 'pseudo.invalid';  /* anciens comptes à pseudo (sans appli) : reconnus à l’affichage */
  var LONGUEUR_MIN = 8;                   /* longueur minimale du mot de passe */
  var OCTETS_MAX = 72;                    /* limite technique de bcrypt (hachage des mots de passe) */
  var SYMBOLES = "!@#$%^&*()_+-=[]{};'\\:\"|<>?,./`~"; /* liste exacte des caractères spéciaux comptés par Supabase */
  var DELAI_PSEUDO = 400;                 /* ms d’attente après la dernière frappe avant de vérifier le pseudo */

  /* ===== SECTION : Règles (fonctions pures, testées dans Node) ===== */

  /* Met un pseudo en forme : sans espaces autour, en minuscules. */
  function normaliserPseudo(s) { return String(s == null ? '' : s).trim().toLowerCase(); }

  /* Un pseudo valide : 6 à 20 caractères parmi a-z, 0-9, tiret et tiret bas (exception unique : « tom »).
     Le texte est d’abord mis en minuscules par normaliserPseudo : majuscule et minuscule sont équivalentes. */
  function pseudoValide(s) { return /^([a-z0-9_-]{6,20}|tom)$/.test(s); }

  /* Vrai si l’identifiant saisi est une adresse e-mail (présence d’un @). */
  function estEmail(s) { return String(s == null ? '' : s).indexOf('@') >= 0; }

  /* Convertit l’identifiant saisi en « e-mail » de connexion :
     une adresse (ancien compte) reste telle quelle, un pseudo devient pseudo@<appli>.pseudo.invalid. */
  function identifiantVersEmail(id) {
    id = String(id == null ? '' : id).trim();
    return estEmail(id) ? id : normaliserPseudo(id) + '@' + DOMAINE_PSEUDO;
  }

  /* Nombre d’octets d’un texte en UTF-8 (un accent ou un emoji compte plus d’un octet). */
  function octets(s) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(s).length;
    return unescape(encodeURIComponent(s)).length;
  }

  /* Évalue un mot de passe selon les règles : 8 caractères mini, minuscule, majuscule, chiffre, caractère spécial.
     Les lettres sont comptées comme côté serveur (a-z / A-Z sans accent). */
  function evaluerMdp(pw) {
    pw = String(pw == null ? '' : pw);
    var r = { longueur: pw.length >= LONGUEUR_MIN, minuscule: /[a-z]/.test(pw), majuscule: /[A-Z]/.test(pw), chiffre: /[0-9]/.test(pw), symbole: false, tropLong: octets(pw) > OCTETS_MAX };
    for (var i = 0; i < pw.length; i++) { if (SYMBOLES.indexOf(pw.charAt(i)) >= 0) { r.symbole = true; break; } }
    r.ok = r.longueur && r.minuscule && r.majuscule && r.chiffre && r.symbole && !r.tropLong;
    return r;
  }

  /* ===== SECTION : Petits éléments d’interface ===== */

  /* Champ mot de passe avec bouton « Afficher / Masquer » (accessible : aria-pressed). */
  function champMdp(id, autocomplete) {
    var input = h('input', { class: 'inp', type: 'password', id: id, autocomplete: autocomplete, autocapitalize: 'none', spellcheck: 'false', required: true });
    var bouton = h('button', { class: 'btn ghost small mdp-voir', type: 'button', 'aria-pressed': 'false' }, 'Afficher');
    bouton.addEventListener('click', function () {
      var voir = input.type === 'password';
      input.type = voir ? 'text' : 'password';
      bouton.textContent = voir ? 'Masquer' : 'Afficher';
      bouton.setAttribute('aria-pressed', voir ? 'true' : 'false');
    });
    return { wrap: h('div', { class: 'mdp-wrap' }, input, bouton), input: input };
  }

  /* Liste des règles du mot de passe : se coche en direct (✓ / ○, jamais la couleur seule). */
  function listeRegles() {
    var items = [['longueur', LONGUEUR_MIN + ' caractères au minimum'], ['minuscule', 'une lettre minuscule (a-z)'], ['majuscule', 'une lettre majuscule (A-Z)'], ['chiffre', 'un chiffre (0-9)'], ['symbole', 'un caractère spécial']];
    var ul = h('ul', { class: 'regles' }), lis = {};
    items.forEach(function (it) { lis[it[0]] = h('li', null, '○ ' + it[1]); ul.appendChild(lis[it[0]]); });
    var aide = h('p', { class: 'small muted' }, 'Caractères spéciaux acceptés : ' + SYMBOLES.split('').join(' ') + ' — les lettres accentuées et signes comme é è à ç § ² € sont permis dans le mot de passe, mais ne comptent pas comme caractère spécial.');
    var alerte = h('p', { class: 'small', role: 'status' });
    function maj(pw) {
      var r = evaluerMdp(pw);
      items.forEach(function (it) { var ok = r[it[0]]; lis[it[0]].textContent = (ok ? '✓ ' : '○ ') + it[1]; lis[it[0]].className = ok ? 'ok' : ''; });
      alerte.textContent = r.tropLong ? 'Mot de passe trop long (72 octets au maximum).' : '';
      return r;
    }
    return { el: h('div', null, ul, aide, alerte), maj: maj };
  }

  /* Bloc dépliable « Vos données » : ce qui est enregistré, qui y accède, quels tiers, quels droits. */
  function blocDonnees() {
    return h('details', { class: 'compte-donnees' },
      h('summary', null, 'Vos données : qui y a accès ?'),
      h('ul', { class: 'small' },
        h('li', null, h('strong', null, 'Enregistré : '), 'votre identifiant (pseudo ou adresse e-mail d’un ancien compte), votre mot de passe sous forme d’empreinte irréversible (nul ne peut le relire, pas même l’administrateur), et ' + ADAPTATEUR.contenu + '.'),
        h('li', null, h('strong', null, 'Qui y accède : '), 'vous, avec votre compte. L’administrateur de la base (Tom Rougeaud) a techniquement accès aux données enregistrées, sauf aux mots de passe.'),
        h('li', null, h('strong', null, 'Compte propre à cette appli : '), 'votre pseudo n’existe que dans cette appli. Un même pseudo dans une autre appli est un autre compte, avec un autre mot de passe. Supprimer cette appli ou votre compte ici ne touche pas vos comptes ailleurs. Seuls les anciens comptes avec adresse e-mail sont partagés entre plusieurs applis.'),
        h('li', null, h('strong', null, 'Services tiers : '), 'Supabase (hébergement de la base de données et des comptes, serveurs situés en France) et GitHub Pages (hébergement des pages de l’appli, qui reçoit votre adresse IP comme tout site web). Aucun traceur, aucune publicité, aucun autre service.'),
        h('li', null, h('strong', null, 'Vos droits : '), 'exporter vos données, les effacer, ou supprimer votre compte à tout moment (Réglages › Compte).')),
      h('p', { class: 'small' }, h('a', { href: ADAPTATEUR.lienConfidentialite }, 'Lire la page Confidentialité')));
  }

  /* Traduit une erreur technique en message clair pour la personne. */
  function messageErreur(err, mode) {
    if (!err) return 'Un problème est survenu. Réessayez.';
    if (err.silent && err.texte) return err.texte;
    if (err.network) return 'Réseau indisponible. Réessayez.';
    var m = String(err.message || '');
    if (/Invalid login/i.test(m)) return 'Identifiant ou mot de passe incorrect.';
    if (err.status === 429 || /rate limit|too many/i.test(m)) return 'Trop de tentatives : patientez quelques minutes avant de réessayer.';
    if (/already registered|already been registered/i.test(m)) return 'Cet identifiant est déjà utilisé.';
    if (/Database error saving new user/i.test(m)) return 'Ce pseudo vient d’être pris : choisissez-en un autre.';
    if (/weak|password/i.test(m) && mode === 'up') return 'Mot de passe refusé par le serveur : ' + m;
    return m || 'Un problème est survenu. Réessayez.';
  }

  /* ===== SECTION : Écran de connexion / création de compte ===== */
  function connexion() {
    var mode = 'in';        /* 'in' = se connecter, 'up' = créer un compte */
    var minuteur = null, dernier = 0;

    var ident = h('input', { class: 'inp', type: 'text', id: 'compte-id', autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false', placeholder: 'Pseudo (ou e-mail d’un ancien compte)', required: true });
    var mdp = champMdp('compte-mdp', 'current-password');
    var regles = listeRegles();
    var aidePseudo = h('p', { class: 'small muted' }, 'Pseudo : 6 à 20 caractères — lettres, chiffres, tiret (-) et tiret bas (_), sans accent ni espace ; majuscules et minuscules sont équivalentes. Ce pseudo est propre à cette appli. Un ancien compte avec adresse e-mail reste utilisable pour se connecter.');
    var etatPseudo = h('div', { class: 'pseudo-etat small', 'aria-live': 'polite' });
    var msg = h('div', { class: 'auth-msg', role: 'alert' });
    var btn = h('button', { class: 'btn primary wide', type: 'submit' }, 'Se connecter');
    var bascule = h('button', { class: 'linklike', type: 'button' }, 'Créer un compte');
    var oubli = h('button', { class: 'linklike', type: 'button' }, 'Mot de passe oublié ?');
    var zoneCreation = h('div', { class: 'zone-creation', hidden: true }, aidePseudo, etatPseudo, regles.el);

    /* Passe d’un mode à l’autre en adaptant les champs et les textes. */
    function changerMode(m) {
      mode = m;
      btn.textContent = m === 'in' ? 'Se connecter' : 'Créer mon compte';
      bascule.textContent = m === 'in' ? 'Créer un compte' : 'J’ai déjà un compte';
      mdp.input.setAttribute('autocomplete', m === 'in' ? 'current-password' : 'new-password');
      ident.setAttribute('autocomplete', m === 'in' ? 'username' : 'off');
      zoneCreation.hidden = (m === 'in');
      oubli.hidden = (m !== 'in');
      msg.className = 'auth-msg'; msg.textContent = ''; etatPseudo.textContent = '';
    }
    bascule.onclick = function () { changerMode(mode === 'in' ? 'up' : 'in'); };

    /* Vérifie la disponibilité du pseudo auprès de la base (réponse vrai/faux uniquement).
       Renvoie une promesse : true (libre), false (refusé) ou null (indéterminé). */
    function verifierPseudo(valeur) {
      var v = normaliserPseudo(valeur);
      if (!v) { etatPseudo.textContent = ''; return Promise.resolve(null); }
      if (estEmail(v)) { etatPseudo.textContent = '✗ La création se fait avec un pseudo (pas d’adresse e-mail).'; return Promise.resolve(false); }
      if (!pseudoValide(v)) { etatPseudo.textContent = '✗ Format non valide : 6 à 20 caractères (lettres, chiffres, - et _).'; return Promise.resolve(false); }
      etatPseudo.textContent = 'Vérification…';
      var n = ++dernier;   /* ignore les réponses devenues périmées si la personne a continué à taper */
      return Api.rest.rpc('pseudo_disponible', { p: v, p_app: ADAPTATEUR.appId }).then(function (ok) {
        if (n !== dernier) return null;
        etatPseudo.textContent = ok === true ? '✓ Pseudo disponible' : '✗ Pseudo déjà pris ou non autorisé';
        return ok === true;
      }, function () { if (n === dernier) etatPseudo.textContent = 'Vérification impossible (réseau). Réessayez.'; return null; });
    }
    ident.addEventListener('input', function () {
      if (mode !== 'up') return;
      clearTimeout(minuteur);
      minuteur = setTimeout(function () { verifierPseudo(ident.value); }, DELAI_PSEUDO);
    });
    mdp.input.addEventListener('input', function () { if (mode === 'up') regles.maj(mdp.input.value); });

    oubli.onclick = function () {
      var id = ident.value.trim();
      msg.className = 'auth-msg';
      if (!id) { msg.textContent = 'Saisissez d’abord votre pseudo ou votre adresse e-mail.'; return; }
      if (!estEmail(id)) { msg.textContent = 'Compte à pseudo : aucune adresse e-mail n’est enregistrée, la réinitialisation automatique est impossible. Demandez à l’administrateur de l’appli de réinitialiser votre mot de passe.'; return; }
      Api.auth.recover(id).then(function () { msg.className = 'auth-msg ok'; msg.textContent = 'Si ce compte existe, un e-mail de réinitialisation vient d’être envoyé.'; }, function (e) { msg.textContent = messageErreur(e, 'in'); });
    };

    /* Inscription : vérifie les règles, puis crée le compte (pseudo propre à l’appli ; l’e-mail est réservé aux anciens comptes). */
    function inscrire(id, pw) {
      if (!evaluerMdp(pw).ok) return Promise.reject({ silent: true, texte: 'Le mot de passe ne respecte pas toutes les règles de la liste.' });
      if (estEmail(id)) return Promise.reject({ silent: true, texte: 'Pour créer un compte, choisissez un pseudo. L’adresse e-mail ne sert qu’à se connecter à un ancien compte.' });
      var v = normaliserPseudo(id);
      if (!pseudoValide(v)) return Promise.reject({ silent: true, texte: 'Pseudo non valide : 6 à 20 caractères (lettres, chiffres, - et _).' });
      /* Un pseudo n’a pas d’e-mail à confirmer : on vérifie que le serveur l’accepte AVANT de créer le compte,
         pour ne pas laisser un compte inutilisable qui bloquerait le pseudo. */
      return Api.auth.reglages().then(function (s) {
        if (s && s.mailer_autoconfirm === false) throw { silent: true, texte: 'Les comptes à pseudo ne sont pas encore activés sur cette appli. Contactez l’administrateur.' };
        return verifierPseudo(v);
      }).then(function (libre) {
        if (libre !== true) throw { silent: true, texte: 'Ce pseudo n’est pas disponible : choisissez-en un autre.' };
        return Api.auth.signUp(identifiantVersEmail(v), pw, v);
      }).then(function (r) { return { connecte: r.connected, email: false }; });
    }

    var form = h('form', { class: 'auth-card', autocomplete: 'on', onsubmit: function (e) {
      e.preventDefault(); msg.className = 'auth-msg'; msg.textContent = ''; btn.disabled = true;
      if (!Api.configured()) { msg.textContent = 'La base n’est pas configurée (config.js).'; btn.disabled = false; return; }
      var id = ident.value.trim(), pw = mdp.input.value;
      var p = mode === 'in'
        ? Api.auth.signIn(identifiantVersEmail(id), pw).then(function () {
            /* ancien mot de passe qui ne respecte plus la règle actuelle : on prévient sans bloquer l’accès */
            if (Api.auth.faible()) UI.toast('Votre mot de passe ne respecte plus la règle actuelle : changez-le dans Réglages › Compte.');
            Main.afterLogin();
          })
        : inscrire(id, pw).then(function (r) {
            if (!r.connecte) { msg.className = 'auth-msg ok'; msg.textContent = 'Compte créé : confirmez votre adresse via l’e-mail reçu, puis connectez-vous.'; changerMode('in'); return; }
            Main.afterLogin();
          });
      p.then(null, function (err) { msg.textContent = messageErreur(err, mode); }).then(function () { btn.disabled = false; });
    } },
      h('div', { class: 'auth-logo' }, APP.manuels ? '📘' : '📋'), h('h1', null, APP.nom),
      h('p', { class: 'muted' }, APP.manuels ? 'Séances de maths construites sur mes manuels : chapitres, pages, exercices et liens.' : 'Séances et séquences de maths, reliées aux programmes officiels et à votre progression.'),
      UI.field('Pseudo ou adresse e-mail', ident), UI.field('Mot de passe', mdp.wrap), zoneCreation, msg, btn,
      h('div', { class: 'auth-links' }, bascule, oubli),
      blocDonnees(),
      h('p', { class: 'muted small' }, 'Même compte que « Suivi Progression » si vous en avez déjà un. Aucune donnée d’élève n’est nécessaire.'),
      h('p', { class: 'small' }, h('a', { href: '#/confidentialite' }, 'Confidentialité'), ' · ', h('a', { href: '#/apropos' }, 'À propos')));
    return h('div', { class: 'auth-wrap' }, form);
  }

  /* ===== SECTION : Formulaire « nouveau mot de passe » (réutilisé deux fois) ===== */
  function formulaireNouveauMdp(auSucces) {
    var p1 = champMdp('compte-nouveau', 'new-password'), p2 = champMdp('compte-confirmation', 'new-password');
    var regles = listeRegles();
    var msg = h('div', { class: 'auth-msg', role: 'alert' });
    var btn = h('button', { class: 'btn primary wide', type: 'submit' }, 'Enregistrer le mot de passe');
    p1.input.addEventListener('input', function () { regles.maj(p1.input.value); });
    return h('form', { class: 'form-mdp', onsubmit: function (e) {
      e.preventDefault(); msg.className = 'auth-msg'; msg.textContent = '';
      if (!evaluerMdp(p1.input.value).ok) { msg.textContent = 'Le mot de passe ne respecte pas toutes les règles de la liste.'; return; }
      if (p1.input.value !== p2.input.value) { msg.textContent = 'Les deux mots de passe sont différents.'; return; }
      btn.disabled = true;
      Api.auth.updatePassword(p1.input.value).then(function () { auSucces(); }, function (err) { msg.textContent = messageErreur(err, 'up'); btn.disabled = false; });
    } }, UI.field('Nouveau mot de passe', p1.wrap), regles.el, UI.field('Confirmation', p2.wrap), msg, btn);
  }

  /* Écran affiché après le lien « mot de passe oublié » reçu par e-mail. */
  function nouveauMdp() {
    return h('div', { class: 'auth-wrap' }, h('div', { class: 'auth-card' },
      h('div', { class: 'auth-logo' }, '🔑'), h('h1', null, 'Nouveau mot de passe'), h('p', { class: 'muted' }, 'Choisissez un mot de passe pour votre compte.'),
      formulaireNouveauMdp(function () { Main.afterLogin(); })));
  }

  /* ===== SECTION : Carte « Compte » dans les Réglages ===== */

  /* Supprime les fichiers de la personne (par lots de 50), puis son compte : tout est effacé en cascade côté base. */
  /* Vrai si le compte connecté est un ancien compte (sans appli), valable dans plusieurs applis. */
  function compteAncienPartage() {
    var e = String((Api.user() || {}).email || '');
    return e.slice(-(DOMAINE_PSEUDO.length + 1)) !== '@' + DOMAINE_PSEUDO;
  }

  function supprimerCompte() {
    UI.promptText('Supprimer mon compte', { help: 'Supprime définitivement votre compte et toutes vos données (classes, fiches, ressources et fichiers). Cette action est irréversible. Tapez SUPPRIMER pour confirmer. Pensez à exporter une sauvegarde avant.' + (compteAncienPartage() ? ' Attention : cet ancien compte est partagé avec d’autres applis, il sera supprimé pour toutes.' : ''), placeholder: 'SUPPRIMER', ok: 'Supprimer définitivement' }).then(function (v) {
      if (v === null) return;
      if (v.trim() !== 'SUPPRIMER') { UI.toast('Confirmation incorrecte : rien n’a été supprimé.'); return; }
      Api.rest.rpc(ADAPTATEUR.rpcEffacerDonnees, {}).then(function (paths) {
        paths = (Array.isArray(paths) ? paths : []).filter(function (p) { return typeof p === 'string'; });
        var lots = []; for (var i = 0; i < paths.length; i += 50) lots.push(paths.slice(i, i + 50));
        return lots.reduce(function (p, lot) { return p.then(function () { return Api.storage.remove(lot).catch(function () { /* fichier déjà supprimé */ }); }); }, Promise.resolve());
      }).then(function () { return Api.rest.rpc('delete_user', {}); }).then(function () {
        DB.reset(); Main.logout(true); UI.toast('Votre compte a été supprimé.');
      }, function (e) { UI.toast('Échec de la suppression : ' + (e && e.message || e), 'err'); });
    });
  }

  /* Carte « Compte » : identifiant, changement de mot de passe, déconnexion, suppression. */
  function carte() {
    var u = Api.user() || {}, email = String(u.email || ''), suffixe = '@' + DOMAINE_PSEUDO;
    var estPseudo = email.slice(-suffixe.length) === suffixe;
    var ancienPseudo = !estPseudo && email.slice(-(SUFFIXE_ANCIEN.length + 1)) === '@' + SUFFIXE_ANCIEN;   /* ancien compte à pseudo (sans appli) */
    if (ancienPseudo) { suffixe = '@' + SUFFIXE_ANCIEN; estPseudo = true; }
    var zone = h('div', { class: 'zone-mdp', hidden: true }, formulaireNouveauMdp(function () { zone.hidden = true; UI.toast('Mot de passe modifié.'); }));
    return h('section', { class: 'card' }, h('h2', null, 'Compte'),
      h('p', null, (estPseudo ? 'Pseudo : ' : 'Adresse e-mail : ') + (estPseudo ? email.slice(0, -suffixe.length) : email)),
      h('div', { class: 'row-gap' },
        h('button', { class: 'btn', type: 'button', onclick: function () { zone.hidden = !zone.hidden; } }, '🔑 Changer mon mot de passe'),
        h('button', { class: 'btn', type: 'button', onclick: function () { Main.logout(); } }, 'Se déconnecter'),
        h('button', { class: 'btn danger', type: 'button', onclick: supprimerCompte }, '🗑 Supprimer mon compte')),
      zone, blocDonnees());
  }

  /* ===== SECTION : Interface publique du bloc ===== */
  return {
    connexion: connexion, nouveauMdp: nouveauMdp, carte: carte,
    regles: { normaliserPseudo: normaliserPseudo, pseudoValide: pseudoValide, estEmail: estEmail, identifiantVersEmail: identifiantVersEmail, evaluerMdp: evaluerMdp, SYMBOLES: SYMBOLES }
  };
})();

/* Export pour les tests Node (sans effet dans le navigateur, où « module » n’existe pas). */
if (typeof module !== 'undefined' && module.exports) module.exports = Compte.regles;
