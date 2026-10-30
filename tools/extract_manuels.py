#!/usr/bin/env python3
"""Extrait des PDF des manuels (version élève) le catalogue : chapitres, notions, pages, exercices.
Usage : python3 tools/extract_manuels.py  (nécessite pdftotext et les dépôts mcv / 3eme clonés)  → src/data/manuels.json"""
import re, json, subprocess, sys, os
BASE = 'https://tom-rougeaud.github.io/'
SRC = os.environ.get('MANUELS_DIR', '/home/claude/tom-rougeaud')
MAN = {
 'bp2': dict(nom='Maths et MCV · 2de', court='Manuel 2de', pdf='mcv/2de/pdf/maths-et-mcv-2de.pdf', web='mcv/2de/', chdir='mcv/2de/pdf/chapitres/maths-et-mcv-2de-chapitre-%d.pdf'),
 'bp1': dict(nom='Maths et MCV · 1re', court='Manuel 1re', pdf='mcv/1ere/pdf/maths-et-mcv-1re.pdf', web='mcv/1ere/', chdir='mcv/1ere/pdf/chapitres/maths-et-mcv-1re-chapitre-%d.pdf'),
 'bpt': dict(nom='Maths et MCV · Terminale', court='Manuel Tle', pdf='mcv/terminale/pdf/maths-et-mcv-tle.pdf', web='mcv/terminale/', chdir='mcv/terminale/pdf/chapitres/maths-et-mcv-tle-chapitre-%d.pdf'),
 'pm':  dict(nom='3ème Série Pro', court='Manuel 3e', pdf='3eme/pdf/maths-3e-serie-pro.pdf', web='3eme/', chdir='3eme/pdf/chapitres/maths-3e-serie-pro-chapitre-%d.pdf'),
}
def clean(l): return re.sub(r'\s{2,}', '  ', l.strip())
out = {}
for key, m in MAN.items():
    txt = subprocess.run(['pdftotext', '-layout', os.path.join(SRC, m['pdf']), '-'], capture_output=True, text=True).stdout
    pages = txt.split('\f')
    if not pages[-1].strip(): pages.pop()
    P = [[clean(l) for l in p.split('\n') if l.strip()] for p in pages]   # P[i] = lignes de la page PDF i+1
    # ouvertures de chapitre : une page dont la 1re ligne commence par « Chapitre N · »
    opens = []
    for i, L in enumerate(P):
        if L and re.match(r'^Chapitre (\d+) ·', L[0]):
            n = int(re.match(r'^Chapitre (\d+)', L[0]).group(1))
            if not opens or opens[-1][0] != n: opens.append((n, i))
    chaps = []
    for k, (n, i) in enumerate(opens):
        end = opens[k + 1][1] if k + 1 < len(opens) else None
        # fin du dernier chapitre : avant « Réponses » / glossaire / sujets
        if end is None:
            end = len(P)
            for j in range(i + 1, len(P)):
                if P[j] and re.match(r'^(✔️ Réponses|🔤 Glossaire|📚|Sujets|Sujet blanc|Réponses)', P[j][0]) or (P[j] and not re.search(r'Chapitre %d ·' % n, ' '.join(P[j][:2])) and re.match(r'^(Réponses de|Glossaire visuel|Sujet blanc|Brevet blanc)', P[j][0])):
                    end = j; break
        rng = range(i, end)
        titre = P[i][1] if len(P[i]) > 1 else ''
        # si l'ouverture porte le domaine puis le titre (2de : « Chapitre 1 · Calculs commerciaux » / « Prix, marges et TVA »)
        dom = re.sub(r'^Chapitre \d+ · ', '', P[i][0])
        ch = dict(n=n, titre=titre, dom=dom, page=i + 1, fin=end, notions=[], exos=[], depart=None, mots=None, atoi=None, saisfaire=None, evalu=None, retiens=[])
        mode = None
        for j in rng:
            L = P[j]; flat = ' '.join(L)
            if any(x.startswith('🚀 Point de départ') for x in L[:3]): ch['depart'] = j + 1
            if any(x.startswith('🔤 Les mots à connaître') for x in L[:3]): ch['mots'] = j + 1
            if any(x.startswith('✅ Je sais faire') for x in L[:8]) and not ch['saisfaire']: ch['saisfaire'] = j + 1
            if not ch['atoi']:
                for x in L:
                    mm = re.search(r'À toi : (.{3,80}?)(?:  |$)', x)
                    if mm and (x.startswith('✍️') or x.startswith('À toi')):
                        ch['atoi'] = dict(page=j + 1, titre=mm.group(1).strip()); break
            if any(x.startswith('✍️ À toi') for x in L[:12]) and not ch['atoi']:
                t = re.sub(r'^✍️ À toi\s*', '', next(x for x in L[:12] if x.startswith('✍️ À toi')))
                t = re.sub(r'\s*(🧮.*|✏️.*)$', '', t).strip(); ch['atoi'] = dict(page=j + 1, titre=t.replace('À toi : ', '').replace('À toi', '').strip(' :'))
            if any(x.startswith('🧭 Méthodes') for x in L[:3]) and not ch.get('methode'): ch['methode'] = j + 1
            if any(re.match(r'^🎯 S’évaluer', x) for x in L[:3]) and not ch['evalu']:
                ch['evalu'] = dict(page=j + 1, titre=next(x for x in L[:3] if x.startswith('🎯')).replace('🎯 ', '')[:70])
            if any(re.match(r'^📌 JE RETIENS', x) for x in L[:3]): ch['retiens'].append(j + 1)
            # notions : ligne « N  Titre » suivie de « 🔎 JE DÉCOUVRE » (n'importe où dans la page)
            for x_i, x in enumerate(L):
                if 'JE DÉCOUVRE' in x and x_i > 0:
                    head = None
                    for y in reversed(L[max(0, x_i - 5):x_i]):
                        mm = re.match(r'^(\d{1,2})  (\S.{2,100}?)(  |$)', y)
                        if mm: head = (int(mm.group(1)), mm.group(2).strip()); break
                    if head and head[0] == len(ch['notions']) + 1:
                        ch['notions'].append(dict(n=head[0], titre=head[1], page=j + 1, partie=None))
        for nt in ch['notions']:
            j = nt['page'] - 1
            nxt = P[j + 1] if j + 1 < len(P) else []
            nt['pages'] = [nt['page'], nt['page'] + 1] if nxt and any(x.startswith('📌 JE RETIENS') for x in nxt[:3]) else [nt['page'], nt['page']]
        # parties : on suit les lignes « PARTIE X · … » et on les rattache à la notion dont le titre suit
        cur = None
        for j in rng:
            for x in P[j]:
                mm = re.match(r'^(?:📘 LA LEÇON · NOTION \d+ SUR \d+ · )?PARTIE ([A-Z]) · (.+)$', x)
                if mm: cur = mm.group(2).capitalize()
                for nt in ch['notions']:
                    if nt['partie'] is None and nt['page'] == j + 1 and x.startswith('%d  ' % nt['n']) and nt['titre'][:18] in x: nt['partie'] = cur
        # exercices : zone après « Je m’entraîne » jusqu'à « Je sais faire »
        z0 = None
        for j in rng:
            if any('Je m’entraîne' in x and x.startswith('✏️') for x in P[j][:8]): z0 = j; break
        if z0 is None and ch['atoi']: z0 = ch['atoi']['page'] - 1
        if z0 is None and ch.get('methode'): z0 = ch['methode'] - 1
        z1 = (ch['saisfaire'] - 1) if ch['saisfaire'] else (ch['evalu']['page'] - 1 if ch['evalu'] else end)   # indice exclusif
        if z0 is not None:
            started = False; last = 0
            for j in range(z0, z1):
                L = P[j]
                for x_i, x in enumerate(L):
                    if j == z0 and not started:
                        if x.startswith('✏️') and 'Je m’entraîne' in x: started = True
                        continue
                    mm = re.match(r'^(\d{1,2})  (.+)$', x)
                    if not mm: continue
                    num = int(mm.group(1))
                    if num != last + 1: continue
                    rest = mm.group(2); nxt = L[x_i + 1] if x_i + 1 < len(L) else ''
                    tag = re.search(r'notion (\d+)', rest) or re.search(r'^notion (\d+)', nxt)
                    typ = 'probleme' if 'Petit problème' in rest else ('defi' if 'Défi' in rest else 'support')
                    if typ == 'support' and not tag: continue
                    et = re.search(r'Défi · (\d+) étapes?', rest)
                    t = re.sub(r'\s*notion \d+.*$', '', rest); t = re.sub(r'^(Petit problème|🏔️ Défi · \d+ étapes?)\s*', '', t).strip()
                    if not t and typ != 'support': t = rest[:60]
                    ch['exos'].append(dict(n=num, type=typ, titre=t, notion=int(tag.group(1)) if tag else None, page=j + 1, etapes=int(et.group(1)) if et else None)); last = num
        # réponses
        rep = re.search(r'Réponses (?:de « Je m’entraîne » )?p\. (\d+)', ' '.join(' '.join(P[j]) for j in rng))
        ch['reponses'] = int(rep.group(1)) if rep else None
        chaps.append(ch)
    # pages de fin : réponses, glossaire
    rep_page = next((i + 1 for i, L in enumerate(P) if L and re.match(r'^✔️ Réponses|^Réponses de « Je m’entraîne »', L[0]) and i > opens[-1][1]), None)
    glo_page = next((i + 1 for i, L in enumerate(P) if L and re.match(r'^🔤 Glossaire visuel|^Glossaire visuel', L[0]) and i > opens[-1][1]), None)
    for ch in chaps:   # la longueur du PDF du chapitre fait foi pour la dernière page
        cp = os.path.join(SRC, m['chdir'] % ch['n'])
        if os.path.exists(cp):
            info = subprocess.run(['pdfinfo', cp], capture_output=True, text=True).stdout
            npg = int(re.search(r'Pages:\s+(\d+)', info).group(1)); ch['fin'] = ch['page'] + npg - 1; ch['npages'] = npg
    out[key] = dict(id=key, nom=m['nom'], court=m['court'], pdf=BASE + m['pdf'].replace('mcv/', 'mcv/', 1), web=BASE + m['web'], chap_pdf=BASE + m['chdir'], pages=len(P), chapitres=chaps, reponses=rep_page, glossaire=glo_page)
json.dump(out, open(os.path.join(os.path.dirname(__file__), '..', 'src', 'data', 'manuels.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
for k, v in out.items():
    print('==', k, v['nom'], v['pages'], 'p.', 'réponses', v['reponses'], 'glossaire', v['glossaire'])
    for c in v['chapitres']:
        print('  ch', c['n'], c['titre'][:40], 'p', c['page'], '-', c['fin'], '| dép', c['depart'], '| notions', [(n['n'], n['page']) for n in c['notions']], '| àtoi', c['atoi'] and c['atoi']['page'], '| exos', [(e['n'], e['type'][0], e['notion'], e['page']) for e in c['exos']], '| éval', c['evalu'] and c['evalu']['page'], '| sf', c['saisfaire'], '| rép', c['reponses'])
