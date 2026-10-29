/* ═══ FICHES · sélecteur à accordéons (domaine › chapitre › objectifs / notions / automatismes) ═══ */
'use strict';
var Picker = (function () {
  var KIND_LBL = { o: 'Objectifs', k: 'Notions et connaissances', a: 'Automatismes' };
  var KIND_ADD = { o: 'Ajouter mon objectif…', k: 'Ajouter ma notion…', a: 'Ajouter mon automatisme…' };

  /* opt : { niveauId, classe, sel(ref)->item|undefined, onToggle(kind,item,chap,on), kinds:['o','k','a'], onMulti(items,chap,on) } */
  function create(opt) {
    var st = { q: '', only: false, edit: false, domOpen: {}, chapOpen: {}, autoOpen: false, horsOpen: false };
    var kinds = opt.kinds || ['o', 'k', 'a'];
    var root = h('div', { class: 'picker' });
    var listEl = h('div', { class: 'pk-list' });
    var search = h('input', { class: 'inp pk-search', type: 'search', placeholder: 'Rechercher dans le programme…', 'aria-label': 'Rechercher dans le programme' });
    search.addEventListener('input', debounce(function () { st.q = search.value; renderList(); }, 180));
    var onlyBtn = h('button', { class: 'chip', type: 'button', onclick: function () { st.only = !st.only; onlyBtn.classList.toggle('on', st.only); renderList(); } }, '☑ Cochés');
    var editBtn = h('button', { class: 'chip', type: 'button', title: 'Renommer, masquer ou ajouter des éléments du référentiel', onclick: function () { st.edit = !st.edit; editBtn.classList.toggle('on', st.edit); renderList(); } }, '✎ Modifier');
    root.appendChild(h('div', { class: 'pk-tools' }, search, onlyBtn, editBtn));
    root.appendChild(listEl);

    function eff() { return Ref.effective(opt.niveauId); }
    function match(txt) { if (!st.q) return true; return Ref.norm(txt).indexOf(Ref.norm(st.q)) >= 0; }

    function persoAdd(kind, chap, txt) {
      var id = uid(); var ordre = DB.list('fs_ref_perso').length;
      DB.save('fs_ref_perso', { id: id, user_id: Api.uid(), action: 'add', niveau_id: opt.niveauId, chapitre_id: kind === 'a' ? null : chap.id, kind: kind, ref_id: 'p-' + id, domaine: kind === 'a' ? (chap && chap.groupe) || 'Mes automatismes' : null, txt: txt, ordre: ordre });
      Ref.invalidate(); return 'p-' + id;
    }
    function persoRename(item) {
      UI.promptText('Renommer', { value: item.txt, multiline: true, help: item.orig ? 'Texte du BO : ' + item.orig : 'Votre formulation remplace le texte du BO dans tout l’outil.' }).then(function (v) {
        if (v === null || !v.trim()) return;
        var rows = DB.list('fs_ref_perso');
        if (item.perso) { var r = DB.byId('fs_ref_perso', item.rowId); if (r) { r.txt = v.trim(); DB.save('fs_ref_perso', r); } }
        else {
          var ex = rows.filter(function (p) { return p.action === 'rename' && p.ref_id === item.id; })[0];
          if (ex) { ex.txt = v.trim(); DB.save('fs_ref_perso', ex); }
          else DB.save('fs_ref_perso', { id: uid(), user_id: Api.uid(), action: 'rename', niveau_id: opt.niveauId, chapitre_id: null, kind: item.kind === 'c' ? 'chapitre' : item.kind, ref_id: item.id, txt: v.trim(), ordre: 0 });
        }
        Ref.invalidate(); renderList(); if (opt.onRef) opt.onRef();
      });
    }
    function persoHide(item, label) {
      UI.ask('Masquer « ' + (label || item.txt).slice(0, 90) + ' » du programme ? Vous pourrez le rétablir dans Référentiels.', { ok: 'Masquer' }).then(function (ok) {
        if (!ok) return;
        if (item.perso && item.rowId) { DB.remove('fs_ref_perso', item.rowId); }
        else DB.save('fs_ref_perso', { id: uid(), user_id: Api.uid(), action: 'hide', niveau_id: opt.niveauId, chapitre_id: null, kind: item.kind === 'c' ? 'chapitre' : item.kind, ref_id: item.id, txt: '', ordre: 0 });
        Ref.invalidate(); renderList(); if (opt.onRef) opt.onRef();
      });
    }

    function itemRow(it, kind, chap) {
      var on = !!opt.sel(it.id);
      var cb = h('input', { type: 'checkbox', checked: on });
      cb.addEventListener('change', function () { opt.onToggle(kind, it, chap, cb.checked); row.classList.toggle('on', cb.checked); });
      var txt = it.txt + (it.sous && it.sous.length ? ' — ' + it.sous.join(' ; ') : '');
      var row = h('div', { class: 'pk-row' + (on ? ' on' : '') + (it.perso ? ' perso' : '') },
        h('label', null, cb, h('span', { class: 'pk-txt' }, txt, it.perso ? h('em', { class: 'tag' }, 'perso') : null, it.renamed ? h('em', { class: 'tag' }, 'renommé') : null, it.auto ? h('em', { class: 'tag', title: 'Capacité devenant un automatisme les années suivantes' }, 'auto') : null)),
        st.edit ? h('span', { class: 'pk-act' }, h('button', { class: 'icon-btn sm', type: 'button', title: 'Renommer', onclick: function () { persoRename(it); } }, '✎'), h('button', { class: 'icon-btn sm', type: 'button', title: 'Masquer', onclick: function () { persoHide(it); } }, '🗑')) : null);
      return row;
    }

    function addBox(kind, chap, afterAdd) {
      var inp = h('input', { class: 'inp pk-add', type: 'text', placeholder: '＋ ' + KIND_ADD[kind] });
      function add(texts) {
        texts.map(function (t) { return t.trim(); }).filter(Boolean).forEach(function (t) {
          var ref = persoAdd(kind, chap, t);
          var item = { id: ref, txt: t, perso: true, kind: kind, comp: Ref.guessComp(t), sous: [] };
          opt.onToggle(kind, item, chap, true);
        });
        afterAdd();
      }
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter' && inp.value.trim()) { e.preventDefault(); add([inp.value]); } });
      var multi = h('button', { class: 'icon-btn sm', type: 'button', title: 'Coller plusieurs lignes (une par élément)', onclick: function () {
        UI.promptText('Ajouter plusieurs éléments', { multiline: true, help: 'Un élément par ligne. Ils seront ajoutés au programme et cochés.', ok: 'Ajouter' }).then(function (v) { if (v) add(v.split(/\r?\n/)); });
      } }, '☰');
      return h('div', { class: 'pk-addbox' }, inp, multi);
    }

    function chapterBlock(chap, forcedOpen) {
      var ids = chap.objectifs.concat(chap.connaissances).filter(function () { return true; });
      var nTot = ids.length, nOn = ids.filter(function (x) { return !!opt.sel(x.id); }).length;
      var isOpen = forcedOpen || !!st.chapOpen[chap.id];
      var d = h('details', { class: 'pk-chap', open: isOpen ? true : null });
      var allCb = h('input', { type: 'checkbox', title: 'Tout cocher / décocher les objectifs et notions du chapitre', checked: nTot > 0 && nOn === nTot });
      allCb.indeterminate = nOn > 0 && nOn < nTot;
      allCb.addEventListener('click', function (e) { e.stopPropagation(); });
      allCb.addEventListener('change', function () {
        var visible = ids.filter(function (x) { return match(x.txt); });
        visible.forEach(function (x) { var cur = !!opt.sel(x.id); if (cur !== allCb.checked) opt.onToggle(x.kind || 'o', x, chap, allCb.checked); });
        renderList();
      });
      var sum = h('summary', null, h('span', { class: 'pk-ct' }, chap.titre), nTot ? h('span', { class: 'pk-count' + (nOn ? ' on' : '') }, nOn + '/' + nTot) : null, nTot ? allCb : null,
        st.edit ? h('span', { class: 'pk-act' }, h('button', { class: 'icon-btn sm', type: 'button', title: 'Renommer le chapitre', onclick: function (e) { e.preventDefault(); e.stopPropagation(); persoRename({ id: chap.id, txt: chap.titre, kind: 'c', perso: chap.perso, rowId: chap.rowId, orig: chap.titreBO !== chap.titre ? chap.titreBO : null }); } }, '✎'), h('button', { class: 'icon-btn sm', type: 'button', title: 'Masquer le chapitre', onclick: function (e) { e.preventDefault(); e.stopPropagation(); persoHide({ id: chap.id, kind: 'c', perso: chap.perso, rowId: chap.rowId }, chap.titre); } }, '🗑')) : null);
      d.appendChild(sum);
      var body = h('div', { class: 'pk-chap-b' }); d.appendChild(body);
      var built = false;
      function build() {
        built = true; clear(body);
        [['o', chap.objectifs], ['k', chap.connaissances]].forEach(function (kv) {
          var kind = kv[0]; if (kinds.indexOf(kind) < 0) return;
          var items = kv[1].filter(function (x) { return match(x.txt) || (st.q && Ref.norm(chap.titre).indexOf(Ref.norm(st.q)) >= 0); });
          if (st.only) items = items.filter(function (x) { return !!opt.sel(x.id); });
          if (!items.length && (st.q || st.only)) return;
          var grp = h('div', { class: 'pk-grp' }, h('div', { class: 'pk-gt' }, KIND_LBL[kind]));
          items.forEach(function (x) { grp.appendChild(itemRow(x, kind, chap)); });
          if (!st.only) grp.appendChild(addBox(kind, chap, function () { renderList(); }));
          body.appendChild(grp);
        });
        if (!body.children.length) body.appendChild(h('p', { class: 'muted small' }, 'Aucun élément ne correspond.'));
        var bo = chap.bo || {};
        if (!st.q && !st.only && (bo.objectifs || bo.liens || bo.commentaires)) {
          var det = h('details', { class: 'pk-bo' }, h('summary', null, 'Repères du BO (pour mémoire)'));
          [['objectifs', 'Objectifs'], ['liens', 'Liens avec le niveau précédent'], ['exemples', 'Exemples'], ['commentaires', 'Commentaires'], ['bivalence', 'Bivalence']].forEach(function (p) { if (bo[p[0]] && bo[p[0]].length) det.appendChild(h('div', null, h('strong', null, p[1] + ' : '), bo[p[0]].join(' '))); });
          body.appendChild(det);
        }
      }
      d.addEventListener('toggle', function () { st.chapOpen[chap.id] = d.open; if (d.open && !built) build(); });
      if (isOpen) build();
      return d;
    }

    function renderList() {
      var scroll = listEl.scrollTop; var e = eff(); clear(listEl);
      if (!e) return;
      var chaps = e.chapitres.filter(function (c) {
        if (!st.q && !st.only) return true;
        var all = c.objectifs.concat(c.connaissances);
        if (st.only) return all.some(function (x) { return !!opt.sel(x.id); });
        return Ref.norm(c.titre).indexOf(Ref.norm(st.q)) >= 0 || all.some(function (x) { return match(x.txt); });
      });
      var ok = [], hors = [];
      chaps.forEach(function (c) { var p = Ref.portee(c, opt.classe); (p.ok ? ok : hors).push([c, p]); });
      var forced = !!(st.q || st.only);
      function domainBlock(list, titleSuffix) {
        var doms = []; var seen = {};
        list.forEach(function (cp) { var dn = cp[0].domaine; if (!seen[dn]) { seen[dn] = []; doms.push(dn); } seen[dn].push(cp); });
        return doms.map(function (dn) {
          var key = dn + (titleSuffix || '');
          var dd = h('details', { class: 'pk-dom', open: (forced || st.domOpen[key] !== false) ? true : null });
          var cnt = 0, on = 0; seen[dn].forEach(function (cp) { cp[0].objectifs.concat(cp[0].connaissances).forEach(function (x) { cnt++; if (opt.sel(x.id)) on++; }); });
          dd.appendChild(h('summary', null, h('span', null, dn), h('span', { class: 'pk-count' + (on ? ' on' : '') }, on + '/' + cnt)));
          seen[dn].forEach(function (cp) { dd.appendChild(chapterBlock(cp[0], forced)); if (cp[1].why) dd.lastChild.querySelector('summary').appendChild(h('em', { class: 'tag warn', title: cp[1].why }, 'hors')); });
          dd.addEventListener('toggle', function () { st.domOpen[key] = dd.open; });
          return dd;
        });
      }
      domainBlock(ok).forEach(function (d) { listEl.appendChild(d); });
      if (hors.length) {
        var hd = h('details', { class: 'pk-hors', open: (forced || st.horsOpen) ? true : null }, h('summary', null, 'Autres groupements / spécialités (' + hors.length + ')'),
          h('p', { class: 'muted small' }, 'Ces chapitres ne concernent pas le groupement ou la spécialité de cette classe, mais restent utilisables.'));
        domainBlock(hors, '·hors').forEach(function (d) { hd.appendChild(d); });
        hd.addEventListener('toggle', function () { st.horsOpen = hd.open; });
        listEl.appendChild(hd);
      }
      if (kinds.indexOf('a') >= 0) {
        var autos = e.automatismes.filter(function (a) { return match(a.txt) && (!st.only || !!opt.sel(a.id)); });
        if (autos.length || (!st.q && !st.only)) {
          var ad = h('details', { class: 'pk-dom', open: (forced || st.autoOpen) ? true : null }, h('summary', null, h('span', null, 'Automatismes'), h('span', { class: 'pk-count' }, autos.length)));
          var groups = {}; var order = [];
          autos.forEach(function (a) { if (!groups[a.groupe]) { groups[a.groupe] = []; order.push(a.groupe); } groups[a.groupe].push(a); });
          order.forEach(function (g) {
            var gg = h('div', { class: 'pk-grp' }, h('div', { class: 'pk-gt' }, g));
            groups[g].forEach(function (a) { gg.appendChild(itemRow(a, 'a', { id: null, groupe: g, titre: 'Automatismes' })); });
            ad.appendChild(gg);
          });
          if (!st.only) ad.appendChild(addBox('a', { id: null, groupe: 'Mes automatismes', titre: 'Automatismes' }, function () { renderList(); }));
          ad.addEventListener('toggle', function () { st.autoOpen = ad.open; });
          listEl.appendChild(ad);
        }
      }
      if (!st.q && !st.only && kinds.indexOf('o') >= 0) {
        listEl.appendChild(h('button', { class: 'btn ghost small', type: 'button', onclick: function () {
          UI.promptText('Nouveau chapitre', { help: 'Il apparaîtra dans le programme de ce niveau (domaine « Mes chapitres »).', placeholder: 'Titre du chapitre' }).then(function (v) {
            if (!v || !v.trim()) return; var id = uid();
            DB.save('fs_ref_perso', { id: id, user_id: Api.uid(), action: 'add', niveau_id: opt.niveauId, chapitre_id: null, kind: 'chapitre', ref_id: 'p-' + id, domaine: 'Mes chapitres', txt: v.trim(), ordre: DB.list('fs_ref_perso').length });
            Ref.invalidate(); st.chapOpen['p-' + id] = true; renderList(); if (opt.onRef) opt.onRef();
          });
        } }, '＋ Mon chapitre'));
      }
      listEl.scrollTop = scroll;
    }
    renderList();
    root.refresh = renderList;
    root.openChapter = function (chapId) { st.chapOpen[chapId] = true; var c = Ref.effective(opt.niveauId).chapitres.filter(function (x) { return x.id === chapId; })[0]; if (c) st.domOpen[c.domaine] = true; renderList(); };
    return root;
  }
  return { create: create };
})();
