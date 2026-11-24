/* =====================================================================
   Projet : Fiches — chiffrement de bout en bout  ·  Version : 1.0.0  ·  Date : 21/11/2026
   Auteur : Tom Rougeaud  ·  Licence : CC BY-NC 4.0
   Réalisé avec l’aide de l’IA : Claude Sonnet 5.5 (Anthropic)
   Rôle : le contenu de la personne (noms de classes, titres, notes, séances, liens,
          fichiers) est chiffré DANS LE NAVIGATEUR avant d’être envoyé à la base.
          Le serveur ne reçoit que du texte illisible : ni le responsable du projet
          ni l’hébergeur ne peuvent le lire.
   Principe :
     - une clé de données aléatoire (AES-GCM 256 bits) chiffre les données ;
     - cette clé est elle-même enfermée deux fois : par le mot de passe
       (PBKDF2 + SHA-256) et par un code de récupération à noter ;
     - sans le mot de passe ni le code, personne ne peut rouvrir les données.
   ===================================================================== */
'use strict';
var Chiffre = (function () {

  /* ===== SECTION : Outils de base (WebCrypto, aussi testable sous Node) ===== */
  var C = (typeof crypto !== 'undefined' && crypto.subtle) ? crypto : (typeof require === 'function' ? require('node:crypto').webcrypto : null);
  var ITERATIONS = 310000;                         /* PBKDF2 : coût d’une tentative de mot de passe */
  var ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; /* 32 signes, sans 0/O/1/I : 5 bits chacun */
  var PREFIXE = 'enc1:';                           /* version du format chiffré */
  var enc = new TextEncoder(), dec = new TextDecoder();

  /* octets <-> texte base64 */
  function b64e(u) { var s = '', i; for (i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192)); return btoa(s); }
  function b64d(t) { var s = atob(t), u = new Uint8Array(s.length), i; for (i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
  function alea(n) { var u = new Uint8Array(n); C.getRandomValues(u); return u; }
  function colle(a, b) { var u = new Uint8Array(a.length + b.length); u.set(a, 0); u.set(b, a.length); return u; }

  /* clé dérivée du mot de passe (lente exprès) */
  function cleMdp(mdp, selB64) {
    return C.subtle.importKey('raw', enc.encode(String(mdp).normalize('NFKC')), 'PBKDF2', false, ['deriveKey']).then(function (k) {
      return C.subtle.deriveKey({ name: 'PBKDF2', salt: b64d(selB64), iterations: ITERATIONS, hash: 'SHA-256' }, k, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    });
  }
  /* mise en forme d’un code de récupération saisi (majuscules, sans tirets ni espaces) */
  function normCode(code) { return String(code || '').toUpperCase().split('').filter(function (c) { return ALPHABET.indexOf(c) >= 0; }).join(''); }
  /* clé dérivée du code de récupération (le code a 120 bits : pas besoin d’une dérivation lente) */
  function cleCode(code) {
    return C.subtle.digest('SHA-256', enc.encode('fiches-recup:' + normCode(code))).then(function (d) { return C.subtle.importKey('raw', d, 'AES-GCM', false, ['encrypt', 'decrypt']); });
  }
  /* génère un code de récupération : 24 signes en 6 groupes de 4 */
  function nouveauCode() {
    var u = alea(24), s = '', i;
    for (i = 0; i < 24; i++) { s += ALPHABET.charAt(u[i] & 31); if (i % 4 === 3 && i < 23) s += '-'; }
    return s;
  }
  /* chiffre des octets : iv (12 octets) + texte chiffré, le tout en base64 */
  function scelle(cle, octets) {
    var iv = alea(12);
    return C.subtle.encrypt({ name: 'AES-GCM', iv: iv }, cle, octets).then(function (ct) { return b64e(colle(iv, new Uint8Array(ct))); });
  }
  function ouvre(cle, b64) {
    var u = b64d(b64);
    return C.subtle.decrypt({ name: 'AES-GCM', iv: u.subarray(0, 12) }, cle, u.subarray(12)).then(function (b) { return new Uint8Array(b); });
  }
  function cleDonnees(brut) { return C.subtle.importKey('raw', brut, 'AES-GCM', false, ['encrypt', 'decrypt']); }

  /* ===== SECTION : Cycle de vie des clés ===== */
  var etat = { brut: null, cle: null, rec: null, memo: null };   /* brut : clé de données en mémoire (si connue) ; memo : mot de passe saisi à l’instant */

  /* petite base locale (IndexedDB) : garde la clé NON EXPORTABLE pour rouvrir l’appli sans retaper le mot de passe */
  var IDB_NOM = 'fiches_chiffre';
  function idb(fn) {
    return new Promise(function (ok) {
      try {
        var rq = indexedDB.open(IDB_NOM, 1);
        rq.onupgradeneeded = function () { rq.result.createObjectStore('k'); };
        rq.onerror = function () { ok(null); };
        rq.onsuccess = function () {
          try { var tx = rq.result.transaction('k', 'readwrite'); var r = fn(tx.objectStore('k')); tx.oncomplete = function () { ok(r && r.result !== undefined ? r.result : null); }; tx.onerror = function () { ok(null); }; } catch (e) { ok(null); }
        };
      } catch (e) { ok(null); }
    });
  }
  function cacheLire(uid) { return idb(function (s) { return s.get(uid); }); }
  function cacheEcrire(uid, cle, empreinte) { return idb(function (s) { return s.put({ cle: cle, fp: empreinte }, uid); }); }
  function cacheEffacer(uid) { return idb(function (s) { return s.delete(uid); }); }
  function empreinte(rec) { return String(rec && rec.wrap_rec || '').slice(0, 24); }

  function retenir(brut) {
    etat.brut = brut;
    return cleDonnees(brut).then(function (k) {
      etat.cle = k;
      if (typeof Api !== 'undefined' && Api.uid()) return cacheEcrire(Api.uid(), k, empreinte(etat.rec));
    });
  }
  function enregistrerCles(rec) {
    return Api.rest.upsert('fs_cles', [{ user_id: Api.uid(), salt: rec.salt, wrap_mdp: rec.wrap_mdp, wrap_rec: rec.wrap_rec, version: 1 }]).then(function () { etat.rec = rec; });
  }
  /* enferme la clé de données avec un mot de passe (nouveau sel) */
  function enfermerMdp(brut, mdp) {
    var sel = b64e(alea(16));
    return cleMdp(mdp, sel).then(function (k) { return scelle(k, brut); }).then(function (w) { return { salt: sel, wrap_mdp: w }; });
  }

  /* Prépare une première installation : renvoie les données à envoyer + le code à montrer. */
  function creer(mdp) {
    var brut = alea(32), code = nouveauCode();
    return Promise.all([enfermerMdp(brut, mdp), cleCode(code).then(function (k) { return scelle(k, brut); })]).then(function (r) {
      return { brut: brut, code: code, rec: { salt: r[0].salt, wrap_mdp: r[0].wrap_mdp, wrap_rec: r[1] } };
    });
  }
  function installer(mdp) {
    return creer(mdp).then(function (c) { return enregistrerCles(c.rec).then(function () { return retenir(c.brut); }).then(function () { return c.code; }); });
  }
  function deverrouillerMdp(mdp) {
    if (!etat.rec) return Promise.reject(new Error('Aucune clé enregistrée.'));
    return cleMdp(mdp, etat.rec.salt).then(function (k) { return ouvre(k, etat.rec.wrap_mdp); }).then(retenir);
  }
  /* ré-enferme avec un (nouveau) mot de passe, sans changer la clé de données ni le code */
  function reenfermer(mdp) {
    return enfermerMdp(etat.brut, mdp).then(function (e) { return enregistrerCles({ salt: e.salt, wrap_mdp: e.wrap_mdp, wrap_rec: etat.rec.wrap_rec }); });
  }
  function deverrouillerCode(code, mdp) {
    return cleCode(code).then(function (k) { return ouvre(k, etat.rec.wrap_rec); }).then(retenir).then(function () { return mdp ? reenfermer(mdp) : null; });
  }
  /* nouveau code de récupération : l’ancien cesse de fonctionner */
  function nouveauCodeRecup() {
    var code = nouveauCode();
    return cleCode(code).then(function (k) { return scelle(k, etat.brut); }).then(function (w) { return enregistrerCles({ salt: etat.rec.salt, wrap_mdp: etat.rec.wrap_mdp, wrap_rec: w }); }).then(function () { return retenir(etat.brut); }).then(function () { return code; });
  }

  /* Au démarrage : 'ok' (clé disponible), 'verrouille' (il faut le mot de passe ou le code), 'aucune' (première installation). */
  function init() {
    etat.brut = null; etat.cle = null; etat.rec = null;
    return Api.rest.select('fs_cles', {}).then(function (rows) {
      etat.rec = (rows && rows[0]) || null;
      if (!etat.rec) { cacheEffacer(Api.uid()); return 'aucune'; }
      return cacheLire(Api.uid()).then(function (c) {
        if (c && c.cle && c.fp === empreinte(etat.rec)) { etat.cle = c.cle; return 'ok'; }
        if (etat.memo) return deverrouillerMdp(etat.memo).then(function () { return 'ok'; }, function () { return 'verrouille'; });
        return 'verrouille';
      });
    }, function (e) {
      /* hors connexion : si la clé est déjà sur cet appareil, on continue avec la copie locale */
      if (e && e.network) return cacheLire(Api.uid()).then(function (c) { if (c && c.cle) { etat.cle = c.cle; return 'ok'; } throw e; });
      throw e;
    });
  }
  function memo(mdp) { etat.memo = mdp; }
  function oublier() { var u = Api.uid(); etat.brut = null; etat.cle = null; etat.rec = null; etat.memo = null; return u ? cacheEffacer(u) : Promise.resolve(); }
  /* la clé de cet appareil ne convient plus (clé changée ailleurs) : on l’oublie mais on garde les clés du compte */
  function invalider() { var u = Api.uid(); etat.brut = null; etat.cle = null; return u ? cacheEffacer(u) : Promise.resolve(); }
  function actif() { return !!etat.cle; }
  function brutConnu() { return !!etat.brut; }
  function aMemo() { return !!etat.memo; }

  /* ===== SECTION : Chiffrement des lignes de la base ===== */
  /* Colonnes chiffrées par table, avec la valeur neutre laissée en clair dans la colonne d’origine.
     Restent en clair (sans texte libre) : identifiants, liens entre lignes, ordre, statut, type, niveau, dates, taille, couleur. */
  var ENC = {
    fs_classes: { nom: '•', annee_scolaire: '', metier: '', creneaux: [], notes: '' },
    fs_sequences: { titre: '', data: {} },
    fs_seances: { titre: '', data: {} },
    fs_ref_perso: { txt: '' },
    fs_ressources: { titre: '', url: null, mime: null, tags: [], note: '' },
    fs_attachments: { note: '' },
    fs_calendrier: { label: '' },
    fs_progress_override: { note: '' },
    fs_modeles: { titre: '', data: {} },
    fs_settings: { data: {} }
  };
  var VIRTUELLES = { fs_ressources: ['fenc'] };   /* champs qui n’existent pas en base : ils voyagent dans le bloc chiffré */

  /* Prépare une ligne à envoyer : bloc chiffré + valeurs neutres. Sans clé : on retire seulement les champs virtuels. */
  function versBase(table, ligne) {
    var sortie = {}, k, virt = VIRTUELLES[table] || [];
    for (k in ligne) if (Object.prototype.hasOwnProperty.call(ligne, k) && virt.indexOf(k) < 0 && k !== '_ancien' && k !== '_illisible') sortie[k] = ligne[k];
    var spec = ENC[table];
    if (!etat.cle || !spec) return Promise.resolve(sortie);
    var bloc = {};
    Object.keys(spec).concat(virt).forEach(function (c) { if (ligne[c] !== undefined) bloc[c] = ligne[c]; });
    Object.keys(spec).forEach(function (c) { sortie[c] = JSON.parse(JSON.stringify(spec[c])); });
    return scelle(etat.cle, enc.encode(JSON.stringify(bloc))).then(function (t) { sortie.chiffre = PREFIXE + t; return sortie; });
  }
  /* Relit une ligne reçue de la base : déchiffre si besoin. Une ligne sans bloc chiffré est une ancienne ligne (à migrer). */
  function depuisBase(table, ligne) {
    if (!ligne || !ENC[table]) return Promise.resolve(ligne);
    if (!ligne.chiffre) { ligne._ancien = true; return Promise.resolve(ligne); }
    if (!etat.cle || String(ligne.chiffre).indexOf(PREFIXE) !== 0) { ligne._illisible = true; delete ligne.chiffre; return Promise.resolve(ligne); }
    return ouvre(etat.cle, ligne.chiffre.slice(PREFIXE.length)).then(function (o) {
      var obj = JSON.parse(dec.decode(o)); delete ligne.chiffre; Object.keys(obj).forEach(function (c) { ligne[c] = obj[c]; }); return ligne;
    }, function () { ligne._illisible = true; delete ligne.chiffre; return ligne; });
  }
  /* fichiers : octets chiffrés avec la même clé (iv + texte chiffré, en binaire) */
  function chiffrerOctets(buf) {
    var iv = alea(12);
    return C.subtle.encrypt({ name: 'AES-GCM', iv: iv }, etat.cle, buf).then(function (ct) { return colle(iv, new Uint8Array(ct)); });
  }
  function dechiffrerOctets(buf) {
    var u = new Uint8Array(buf);
    return C.subtle.decrypt({ name: 'AES-GCM', iv: u.subarray(0, 12) }, etat.cle, u.subarray(12)).then(function (b) { return new Uint8Array(b); });
  }

  /* ===== SECTION : Écrans ===== */
  function ecran(carte) { var app = $('#app'); clear(app); app.appendChild(h('div', { class: 'auth-wrap' }, carte)); window.scrollTo(0, 0); }
  function champ(id, label, auto) { var i = h('input', { class: 'inp', type: 'password', id: id, autocomplete: auto || 'off', autocapitalize: 'none', spellcheck: 'false', required: true }); return { input: i, el: UI.field(label, i) }; }

  /* Affiche le code de récupération et exige qu’on l’ait noté avant de continuer. */
  function ecranCode(code, suite, titre) {
    var coche = h('input', { type: 'checkbox', id: 'chiffre-ok' });
    var verif = h('input', { class: 'inp', type: 'text', id: 'chiffre-verif', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', maxlength: 9, placeholder: 'Ex. : AB12' });
    var btn = h('button', { class: 'btn primary wide', type: 'button', disabled: true }, 'Continuer');
    var fin = code.replace(/-/g, '').slice(-4);
    function maj() { btn.disabled = !(coche.checked && normCode(verif.value) === fin); }
    coche.addEventListener('change', maj); verif.addEventListener('input', maj);
    btn.addEventListener('click', function () { suite(); });
    ecran(h('div', { class: 'auth-card' }, h('div', { class: 'auth-logo' }, '🔐'), h('h1', null, titre || 'Votre code de récupération'),
      h('p', null, 'Vos données sont chiffrées : seul(e) vous pouvez les lire. Si vous oubliez votre mot de passe, ce code est le seul moyen de les récupérer.'),
      h('p', { class: 'code-recup', id: 'chiffre-code', style: 'font-size:1.4em;font-weight:700;letter-spacing:.06em;text-align:center;word-break:break-all' }, code),
      h('div', { class: 'row-gap' },
        h('button', { class: 'btn', type: 'button', onclick: function () { try { navigator.clipboard.writeText(code); UI.toast('Code copié.'); } catch (e) { UI.toast('Copie impossible : notez le code à la main.'); } } }, '📋 Copier'),
        h('button', { class: 'btn', type: 'button', onclick: function () { downloadBlob(new Blob(['Code de récupération de ' + APP.nom + '\r\n\r\n' + code + '\r\n\r\nGardez ce fichier hors de l’appareil (papier, coffre de mots de passe). Il ouvre vos données.\r\n'], { type: 'text/plain;charset=utf-8' }), 'code-recuperation-' + APP.id + '.txt'); } }, '⬇ Télécharger')),
      h('p', { class: 'small muted' }, 'Gardez-le dans un endroit sûr, à part de votre mot de passe. Personne, pas même le responsable du projet, ne peut le retrouver pour vous.'),
      h('label', { class: 'check' }, coche, ' J’ai noté ce code dans un endroit sûr.'),
      UI.field('Pour vérifier, recopiez les 4 derniers signes du code', verif), btn));
  }

  /* Première installation : choisir (retaper) le mot de passe, puis noter le code. */
  function ecranInstallation(suite) {
    function lancer(mdp, msg, btn) {
      installer(mdp).then(function (code) { etat.memo = null; ecranCode(code, suite); }, function (e) { if (msg) msg.textContent = 'Échec : ' + (e && e.message || e); if (btn) btn.disabled = false; });
    }
    if (etat.memo) { var m = etat.memo; ecran(h('div', { class: 'auth-card' }, h('div', { class: 'auth-logo' }, '🔐'), h('h1', null, 'Chiffrement en cours…'), h('div', { class: 'spinner' }))); lancer(m); return; }
    var mdp = champ('chiffre-mdp', 'Votre mot de passe actuel', 'current-password');
    var msg = h('div', { class: 'auth-msg', role: 'alert' });
    var btn = h('button', { class: 'btn primary wide', type: 'submit' }, 'Protéger mes données');
    ecran(h('form', { class: 'auth-card', onsubmit: function (e) { e.preventDefault(); btn.disabled = true; lancer(mdp.input.value, msg, btn); } },
      h('div', { class: 'auth-logo' }, '🔐'), h('h1', null, 'Protégez vos données'),
      h('p', null, 'Vos données vont être chiffrées dans votre navigateur. Retapez votre mot de passe pour créer votre clé.'), mdp.el, msg, btn));
  }

  /* Anciennes données en clair : sauvegarde obligatoire, puis chiffrement. Renvoie une promesse résolue à la fin. */
  function ecranMigration(n) {
    return new Promise(function (ok) {
      var fait = false;
      var btn = h('button', { class: 'btn primary wide', type: 'button', disabled: true }, 'Chiffrer mes données');
      var sauve = h('button', { class: 'btn wide', type: 'button', id: 'chiffre-sauvegarde', onclick: function () { Exp.json(); fait = true; btn.disabled = false; } }, '⬇ 1. Télécharger ma sauvegarde');
      btn.addEventListener('click', function () {
        if (!fait) return; btn.disabled = true; sauve.disabled = true; btn.textContent = 'Chiffrement en cours…';
        DB.migrer().then(function () { ok(); }, function (e) { btn.textContent = 'Échec : ' + (e && e.message || e) + ' — réessayer'; btn.disabled = false; });
      });
      ecran(h('div', { class: 'auth-card' }, h('div', { class: 'auth-logo' }, '🔐'), h('h1', null, 'Chiffrer vos anciennes données'),
        h('p', null, n + ' élément(s) enregistré(s) auparavant sont encore lisibles côté serveur. Ils vont être chiffrés dans votre navigateur.'),
        h('p', { class: 'small' }, 'Par précaution, téléchargez d’abord une sauvegarde : le bouton suivant ne s’active qu’après.'), sauve, btn));
    });
  }

  /* Clé absente de cet appareil : mot de passe, ou code de récupération. */
  function ecranVerrou(suite) {
    var msgA = h('div', { class: 'auth-msg', role: 'alert' }), msgB = h('div', { class: 'auth-msg', role: 'alert' });
    var mdpA = champ('chiffre-mdp', 'Mot de passe', 'current-password');
    var btnA = h('button', { class: 'btn primary wide', type: 'submit' }, 'Ouvrir mes données');
    var code = h('input', { class: 'inp', type: 'text', id: 'chiffre-code-saisie', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', placeholder: 'XXXX-XXXX-XXXX-XXXX-XXXX-XXXX', required: true });
    var mdpB = etat.memo ? null : champ('chiffre-mdp-b', 'Votre mot de passe actuel (pour le réenregistrer)', 'current-password');
    var btnB = h('button', { class: 'btn wide', type: 'submit' }, 'Utiliser mon code de récupération');
    var formA = h('form', { onsubmit: function (e) {
      e.preventDefault(); btnA.disabled = true; msgA.textContent = '';
      deverrouillerMdp(mdpA.input.value).then(suite, function () { msgA.textContent = 'Ce mot de passe n’ouvre pas vos données. S’il a été réinitialisé, utilisez votre code de récupération.'; btnA.disabled = false; });
    } }, mdpA.el, msgA, btnA);
    var formB = h('form', { onsubmit: function (e) {
      e.preventDefault(); btnB.disabled = true; msgB.textContent = '';
      deverrouillerCode(code.value, etat.memo || mdpB.input.value).then(suite, function () { msgB.textContent = 'Code incorrect. Vérifiez chaque signe (les tirets et espaces sont facultatifs).'; btnB.disabled = false; });
    } }, UI.field('Code de récupération', code), mdpB ? mdpB.el : null, msgB, btnB);
    ecran(h('div', { class: 'auth-card' }, h('div', { class: 'auth-logo' }, '🔐'), h('h1', null, 'Ouvrir vos données'),
      h('p', null, 'Vos données sont chiffrées. Cet appareil n’a pas encore la clé pour les ouvrir.'),
      etat.memo ? null : formA, h('h2', { class: 'small' }, etat.memo ? 'Utilisez votre code de récupération' : 'Mot de passe oublié ou réinitialisé ?'), formB,
      h('button', { class: 'btn ghost wide', type: 'button', onclick: function () { Main.logout(true); } }, 'Se déconnecter')));
  }

  /* Bloc « Sécurité des données » de la carte Compte : nouveau code de récupération. */
  function carteSecurite() {
    var zone = h('div', { hidden: true });
    var mdp = champ('chiffre-mdp-nc', 'Mot de passe actuel', 'current-password');
    var msg = h('div', { class: 'auth-msg', role: 'alert' });
    var btn = h('button', { class: 'btn primary', type: 'submit' }, 'Créer un nouveau code');
    zone.appendChild(h('form', { onsubmit: function (e) {
      e.preventDefault(); btn.disabled = true; msg.textContent = '';
      deverrouillerMdp(mdp.input.value).then(nouveauCodeRecup).then(function (c) {
        ecranCode(c, function () { location.hash = '#/reglages'; Main.afterLogin(); }, 'Votre nouveau code');
      }, function () { msg.textContent = 'Mot de passe incorrect.'; btn.disabled = false; });
    } }, h('p', { class: 'small' }, 'L’ancien code ne fonctionnera plus. Notez le nouveau.'), mdp.el, msg, btn));
    return h('div', { class: 'secu-donnees' }, h('h3', null, '🔐 Sécurité des données'),
      h('p', { class: 'small' }, 'Vos données sont chiffrées dans votre navigateur. Votre code de récupération est la seule autre clé : gardez-le en lieu sûr.'),
      h('button', { class: 'btn', type: 'button', onclick: function () { zone.hidden = !zone.hidden; } }, '🔁 Créer un nouveau code de récupération'), zone);
  }

  return {
    init: init, memo: memo, oublier: oublier, invalider: invalider, actif: actif, brutConnu: brutConnu, aMemo: aMemo,
    installer: installer, deverrouillerMdp: deverrouillerMdp, deverrouillerCode: deverrouillerCode, reenfermer: reenfermer, nouveauCodeRecup: nouveauCodeRecup,
    versBase: versBase, depuisBase: depuisBase, chiffrerOctets: chiffrerOctets, dechiffrerOctets: dechiffrerOctets,
    ecranInstallation: ecranInstallation, ecranMigration: ecranMigration, ecranVerrou: ecranVerrou, ecranCode: ecranCode, carteSecurite: carteSecurite,
    /* pour les tests */
    _test: { creer: creer, cleMdp: cleMdp, cleCode: cleCode, scelle: scelle, ouvre: ouvre, normCode: normCode, nouveauCode: nouveauCode, ENC: ENC, etat: etat, b64e: b64e, b64d: b64d }
  };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Chiffre;
