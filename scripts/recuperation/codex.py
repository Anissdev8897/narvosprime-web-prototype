# -*- coding: utf-8 -*-
"""
codex.py — troisième historique d'agent : les sessions de Codex (« Astra »).

    C:\\Users\\aniss\\.codex\\sessions\\**\\rollout-*.jsonl

Astra a travaillé sur le projet du 14 au 18/09/2026 : 289 `apply_patch`, des centaines
de lectures. Rien de cela n'est dans les transcriptions Claude ni dans la base Hermes
— c'est ce qui manquait aux fichiers que le disque montrait « plus récents » que nos
historiques.

LA FORME DES SESSIONS
  L'outil d'Astra est un script JavaScript (`exec`) qui enchaîne des appels :

      text(await tools.exec_command({cmd:"Get-Content 'D:/…/x.lua' -TotalCount 80"}));
      text(await tools.apply_patch("*** Begin Patch\\n*** Update File: D:/…/x.lua\\n@@\\n-a\\n+b\\n*** End Patch"));

  et sa sortie est une liste : un en-tête (`Script completed`), puis un élément par
  appel — un JSON `{"output": …}` pour une commande, `{}` pour un patch appliqué.

CE QU'ON EN TIRE
  · `*** Add File`     → une écriture complète ;
  · `*** Update File`  → des remplacements SANS numéro de ligne (contexte + lignes) :
                         le cœur les applique là où le bloc est reconnu (voir
                         `Reconstitution.remplacer`) ;
  · `*** Delete File`  → une suppression ;
  · `Get-Content …`, `rg -n …` → des lectures, alignées par commandes.aligner.

  La sortie de Codex n'est PAS rognée (contrairement à celle de Claude Code), mais
  elle peut être TRONQUÉE au milieu (« …N tokens truncated… ») : on ne garde alors
  que ce qui précède la coupure.
"""
import glob
import json
import os
import re

from commandes import EXT, aligner, aligner_lignes

SESSIONS = r"C:\Users\aniss\.codex\sessions"
APPEL = re.compile(r"tools\.(\w+)\(")
IDENT = re.compile(r"[A-Za-z_$][\w$]*")
ERREUR_PS = re.compile(r"CategoryInfo|FullyQualifiedErrorId|^Get-Content\s*:|^rg: |ItemNotFoundException", re.M)
COUPURE = re.compile(r"…\d+ tokens truncated…")
ENTETE_TRONQUEE = re.compile(r"^Warning: truncated output \(original token count: \d+\)\nTotal output lines: (\d+)\n\n")


# ── JavaScript : les appels et leurs chaînes ─────────────────────────────────
def litteral_js(code, i):
    """La chaîne JS qui commence en code[i] (guillemet) : (valeur, indice suivant).
    (None, i) si elle est dynamique (`${…}`) ou mal formée."""
    q, out, j, n = code[i], [], i + 1, len(code)
    simples = {"n": "\n", "r": "\r", "t": "\t", "b": "\b", "f": "\f", "v": "\v", "0": "\0"}
    try:
        while j < n:
            c = code[j]
            if c == "\\":
                d = code[j + 1:j + 2]
                if d in simples:
                    out.append(simples[d])
                elif d == "x":
                    out.append(chr(int(code[j + 2:j + 4], 16)))
                    j += 2
                elif d == "u":
                    if code[j + 2:j + 3] == "{":
                        k = code.index("}", j)
                        out.append(chr(int(code[j + 3:k], 16)))
                        j = k - 1
                    else:
                        out.append(chr(int(code[j + 2:j + 6], 16)))
                        j += 4
                elif d != "\n":
                    out.append(d)
                j += 2
            elif c == q:
                texte = "".join(out)
                # Les paires de substitution (\\uD83D\\uDE00) redeviennent un caractère.
                return texte.encode("utf-16", "surrogatepass").decode("utf-16", "replace"), j + 1
            elif q == "`" and c == "$" and code[j + 1:j + 2] == "{":
                return None, i
            else:
                out.append(c)
                j += 1
    except (ValueError, IndexError):
        pass
    return None, i


def _blancs(code, j):
    while j < len(code) and code[j] in " \t\r\n,":
        j += 1
    return j


def objet_js(code, i):
    """Les clés à valeur simple d'un objet JS `{cle: "valeur", …}` commençant en code[i]."""
    if code[i:i + 1] != "{":
        return None
    d, j = {}, i + 1
    while j < len(code):
        j = _blancs(code, j)
        if code[j:j + 1] == "}":
            return d
        m = IDENT.match(code, j)
        if m:
            cle, j = m.group(0), m.end()
        elif code[j:j + 1] in ('"', "'"):
            cle, j = litteral_js(code, j)
            if cle is None:
                return None
        else:
            return None
        j = _blancs(code, j)
        if code[j:j + 1] != ":":
            return None
        j = _blancs(code, j + 1)
        if code[j:j + 1] in ('"', "'", "`"):
            valeur, k = litteral_js(code, j)
            if valeur is None:
                return None
            d[cle], j = valeur, k
        elif code[j:j + 1] in ("{", "["):
            return None
        else:
            m = re.compile(r"[^,}]+").match(code, j)
            if not m:
                return None
            d[cle], j = m.group(0).strip(), m.end()
    return None


def appels(code):
    """[(nom, charge)] des appels `tools.nom(…)` du script, dans l'ordre : la chaîne du
    patch pour `apply_patch`, l'objet pour `exec_command`, None sinon ou si illisible."""
    out = []
    for m in APPEL.finditer(code):
        j = _blancs(code, m.end())
        nom, charge = m.group(1), None
        if nom == "apply_patch" and code[j:j + 1] in ('"', "'", "`"):
            charge, _ = litteral_js(code, j)
        elif nom == "exec_command":
            charge = objet_js(code, j)
        out.append((nom, charge))
    return out


# ── apply_patch ──────────────────────────────────────────────────────────────
def operations_patch(texte):
    """[("ajouter", chemin, contenu) | ("modifier", chemin, [(ancien, neuf)]) |
    ("supprimer", chemin) | ("deplacer", chemin, vers)] d'un patch Codex."""
    ops, lignes, i = [], texte.replace("\r\n", "\n").split("\n"), 0
    while i < len(lignes):
        l = lignes[i]
        if l.startswith("*** Add File: "):
            chemin, corps = l[14:].strip(), []
            i += 1
            while i < len(lignes) and not lignes[i].startswith("*** "):
                if lignes[i].startswith("+"):
                    corps.append(lignes[i][1:])
                i += 1
            ops.append(("ajouter", chemin, "\n".join(corps) + "\n"))
        elif l.startswith("*** Delete File: "):
            ops.append(("supprimer", l[17:].strip()))
            i += 1
        elif l.startswith("*** Update File: "):
            chemin, morceaux, courant = l[17:].strip(), [], None
            i += 1
            if i < len(lignes) and lignes[i].startswith("*** Move to: "):
                ops.append(("deplacer", chemin, lignes[i][13:].strip()))
                i += 1
            while i < len(lignes) and (not lignes[i].startswith("*** ") or lignes[i].startswith("*** End of File")):
                x = lignes[i]
                if x.startswith("@@"):
                    courant = {"entete": x[2:].strip(), "lignes": []}
                    morceaux.append(courant)
                elif x[:1] in (" ", "-", "+"):
                    if courant is None:
                        courant = {"entete": "", "lignes": []}
                        morceaux.append(courant)
                    courant["lignes"].append((x[0], x[1:], False))
                elif x == "" and courant is not None:
                    # Une ligne de contexte VIDE perd souvent son espace de tête.
                    courant["lignes"].append((" ", "", True))
                i += 1
            paires = []
            for m in morceaux:
                while m["lignes"] and m["lignes"][-1][2]:
                    m["lignes"].pop()            # vides de FIN : la coupure du patch, pas du contexte
                ancien = [t for s, t, _ in m["lignes"] if s in " -"]
                neuf = [t for s, t, _ in m["lignes"] if s in " +"]
                if not ancien and m["entete"]:
                    ancien, neuf = [m["entete"]], [m["entete"]] + neuf     # ajout pur : après l'en-tête
                if ancien and ancien != neuf:
                    paires.append(("\n".join(ancien), "\n".join(neuf)))
            ops.append(("modifier", chemin, paires))
        else:
            i += 1
    return ops


# ── PowerShell : ce qu'une commande a lu ─────────────────────────────────────
def jetons_ps(cmd):
    """[("op", ";" | "|") | ("mot", texte) | ("var", nom)], ou None si la commande porte
    ce qu'on n'analyse pas (blocs `{}`, parenthèses, chaînes à variables…)."""
    out, mot, en_mot, i, n = [], [], False, 0, len(cmd)

    def finir():
        nonlocal mot, en_mot
        if en_mot:
            out.append(("mot", "".join(mot)))
        mot, en_mot = [], False

    while i < n:
        c = cmd[i]
        if c in " \t\r":
            finir()
            i += 1
        elif c in ";\n":
            finir()
            out.append(("op", ";"))
            i += 1
        elif c == "|":
            finir()
            out.append(("op", "|"))
            i += 1
        elif c == "'":
            en_mot, i = True, i + 1
            while i < n:
                if cmd[i] == "'":
                    if cmd[i + 1:i + 2] == "'":
                        mot.append("'")
                        i += 2
                        continue
                    break
                mot.append(cmd[i])
                i += 1
            if i >= n:
                return None
            i += 1
        elif c == '"':
            en_mot, i = True, i + 1
            while i < n and cmd[i] != '"':
                if cmd[i] == "`" and i + 1 < n:
                    mot.append(cmd[i + 1])
                    i += 2
                elif cmd[i] == "$":
                    return None
                else:
                    mot.append(cmd[i])
                    i += 1
            if i >= n:
                return None
            i += 1
        elif c == "$" and not en_mot:
            m = IDENT.match(cmd, i + 1)
            if not m:
                return None
            finir()
            out.append(("var", m.group(0)))
            i = m.end()
        elif c in "(){}@`<>&" or c == "$":
            return None
        else:
            en_mot = True
            mot.append(c)
            i += 1
    finir()
    return out


def _entier(s):
    return int(s) if isinstance(s, str) and s.isdigit() else None


def _selection(f):
    """`Select-Object -Skip S -First P -Last D` : (saut, premiers, derniers), ou None."""
    if not f or f[0].lower() not in ("select-object", "select"):
        return None
    saut, premiers, derniers, j = 0, None, None, 1
    while j < len(f):
        cle = f[j].lower()
        valeur = _entier(f[j + 1]) if j + 1 < len(f) else None
        if cle == "-skip" and valeur is not None:
            saut = valeur
        elif cle == "-first" and valeur:
            premiers = valeur
        elif cle == "-last" and valeur:
            derniers = valeur
        else:
            return None                              # -Index, -Unique, propriétés… : inconnues
        j += 2
    return saut, premiers, derniers


def _get_content(mots, filtres, cwd):
    """`Get-Content …` [| Select-Object …] : l'émetteur, ou None.

    ("pos", fichier, cwd, a, b) quand les lignes rendues ont une position connue ;
    ("opaque", K) quand on sait seulement qu'il y en a K au plus (`-Tail K`, `-Last K`) —
    de quoi COMPTER la sortie sans rien en tirer.
    """
    fichier, total, queue, i = None, None, None, 1
    while i < len(mots):
        m = mots[i].lower()
        if m in ("-literalpath", "-path") and i + 1 < len(mots):
            fichier, i = mots[i + 1], i + 2
        elif m in ("-totalcount", "-head", "-first") and i + 1 < len(mots):
            total, i = _entier(mots[i + 1]), i + 2
            if not total:
                return None
        elif m in ("-tail", "-last") and i + 1 < len(mots):
            queue, i = _entier(mots[i + 1]), i + 2
            if not queue:
                return None
        elif m in ("-encoding", "-erroraction") and i + 1 < len(mots):
            i += 2
        elif m == "-raw":
            i += 1
        elif m.startswith("-"):
            return None                              # -Wait, -ReadCount, -Delimiter… : forme inconnue
        elif fichier is None:
            fichier, i = mots[i], i + 1
        else:
            return None
    if not fichier:
        return None
    a, b = 1, total
    for f in filtres:
        s = _selection(f)
        if s is None:
            return None
        saut, premiers, derniers = s
        if derniers is not None:
            queue = derniers if queue is None else min(queue, derniers)
            continue
        if queue is not None:
            if premiers is None or saut:
                return None
            queue = min(queue, premiers)
            continue
        a = a + saut
        if b is not None:
            b = b if premiers is None else min(b, a + premiers - 1)
            if b < a:
                return None
        elif premiers is not None:
            b = a + premiers - 1
    if queue is not None:
        return ("opaque", queue if total is None else min(queue, total))
    return ("pos", fichier, cwd, a, b)


RG_AVEC_ARGUMENT = {"-g", "--glob", "-e", "--regexp", "-A", "-B", "-C", "-m", "--max-count", "-t", "--type", "-T",
                    "--type-not", "-j", "--threads", "-M", "--max-columns", "--iglob", "--max-depth", "-d"}
RG_INTERDITS = {"--files", "-l", "--files-with-matches", "-c", "--count", "-o", "--only-matching", "-U",
                "--multiline", "--json", "-r", "--replace", "--vimgrep", "--column", "-N", "--no-line-number",
                "-I", "--no-filename", "--count-matches", "-p", "--pretty", "--heading", "-b", "--byte-offset"}


def _rg(mots, filtres):
    """`rg -n …` : (chemins fouillés, maximum de lignes ou None), ou None si la forme des
    lignes rendues n'est pas sûre."""
    numerote, motif_vu, chemins, i = False, False, [], 1
    while i < len(mots):
        m = mots[i]
        if m in RG_INTERDITS:
            return None
        if m in RG_AVEC_ARGUMENT:
            if m in ("-e", "--regexp"):
                motif_vu = True
            i += 2
            continue
        if m.startswith("--"):
            numerote = numerote or m == "--line-number"
            i += 1
            continue
        if m.startswith("-") and len(m) > 1:
            lettres = m[1:].rstrip("0123456789")
            if set(lettres) & set("lcoUrNIpb"):
                return None
            numerote = numerote or "n" in lettres
            i += 1
            continue
        if not motif_vu:
            motif_vu = True
        else:
            chemins.append(m)
        i += 1
    if not numerote or not motif_vu or not chemins:
        return None
    maximum = None
    for f in filtres:
        s = _selection(f)
        if s is None:
            return None
        for borne in s[1:]:
            if borne is not None:
                maximum = borne if maximum is None else min(maximum, borne)
    return chemins, maximum


def analyser_powershell(cmd, cwd=""):
    """Les émetteurs d'une commande PowerShell (mêmes formes que commandes.analyser), ou None."""
    js = jetons_ps(cmd or "")
    if js is None:
        return None
    segments, courant = [], [[]]
    for j in js:
        if j == ("op", ";"):
            segments.append(courant)
            courant = [[]]
        elif j == ("op", "|"):
            courant.append([])
        else:
            courant[-1].append(j)
    segments.append(courant)
    env, emetteurs = {}, []
    for etages in segments:
        if etages == [[]]:
            continue
        # Affectation simple : `$nom = 'valeur'`, ou `$nom='valeur'` (un seul jeton `=valeur`).
        t = etages[0]
        if len(etages) == 1 and t and t[0][0] == "var" and all(x[0] == "mot" for x in t[1:]):
            if len(t) == 3 and t[1][1] == "=":
                env[t[0][1].lower()] = t[2][1]
                continue
            if len(t) == 2 and t[1][1].startswith("=") and len(t[1][1]) > 1:
                env[t[0][1].lower()] = t[1][1][1:]
                continue
        mots_etages = []
        for etage in etages:
            mots = []
            for genre, valeur in etage:
                if genre == "var":
                    if valeur.lower() not in env:
                        return None
                    mots.append(env[valeur.lower()])
                else:
                    mots.append(valeur)
            if not mots:
                return None
            mots_etages.append(mots)
        tete, filtres = mots_etages[0], mots_etages[1:]
        verbe = tete[0].lower()
        if verbe in ("get-content", "gc", "cat", "type"):
            g = _get_content(tete, filtres, cwd)
            if not g:
                return None
            emetteurs.append(g)
        elif verbe == "rg":
            r = _rg(tete, filtres)
            if not r:
                return None
            chemins, maximum = r
            seul = len(chemins) == 1 and re.search(r"\." + EXT + r"$", chemins[0], re.I)
            emetteurs.append(("num", chemins[0] if seul else None, cwd, maximum))
        elif verbe in ("write-output", "write-host", "echo") and not filtres and len(tete) == 2:
            emetteurs.append(("echo", tete[1]))
        elif verbe in ("set-location", "cd", "sl") and len(tete) == 2 and not filtres:
            cwd = tete[1] if re.match(r"^(?:[A-Za-z]:|/|\\)", tete[1]) or not cwd else cwd.rstrip("/\\") + "/" + tete[1]
        else:
            return None
    return emetteurs


def lectures_powershell(cmd, sortie, cwd="", rognee=False):
    """[((fichier, cwd), [(n°, texte)], total, rogne)] de ce qu'une commande PowerShell a lu.

    ⚠ Une sortie de Codex trop longue est TRONQUÉE EN SON MILIEU :

        Warning: truncated output (original token count: 8512)
        Total output lines: 500
        <début>…1851 tokens truncated…<fin>

    mais elle annonce son nombre total de lignes (vérifié le 02/10/2026 : il vaut
    exactement la somme des lignes demandées quand chaque lecture est pleine). Ce qui
    précède la coupure se compte donc depuis le début, ce qui la suit depuis la fin ;
    la ligne coupée et celles qui manquent restent inconnues.
    """
    emetteurs = analyser_powershell(cmd, cwd)
    if not emetteurs or not isinstance(sortie, str) or ERREUR_PS.search(sortie):
        return []
    sortie = sortie.replace("\r\n", "\n")
    entete = ENTETE_TRONQUEE.match(sortie)
    if not entete and not COUPURE.search(sortie):
        return aligner(emetteurs, sortie, rognee=rognee, longue=10 ** 9)
    if not entete:
        return []                                    # coupée sans total annoncé : la fin ne se compte pas
    lignes = sortie[entete.end():].split("\n")
    if lignes and lignes[-1] == "":
        lignes.pop()
    coupes = [k for k, l in enumerate(lignes) if COUPURE.search(l)]
    if len(coupes) != 1:
        return []
    tete, queue = lignes[:coupes[0]], lignes[coupes[0] + 1:]
    inconnues = int(entete.group(1)) - len(tete) - len(queue)
    if inconnues < 1:
        return []
    return aligner_lignes(emetteurs, tete + [None] * inconnues + queue, rognee=rognee)


# ── PowerShell : ce qu'une commande a ÉCRIT, quand c'est écrit dans la commande ──
# Astra consignait ses reprises ainsi :
#
#     @'
#     ## Suite du 15 septembre …
#     '@ | Add-Content -LiteralPath '.hermes/REPRISE_ASTRA_2026-09-15.md' -Encoding utf8
#
# Aucun outil de fichiers ne voit passer ce texte. Une chaîne `@'…'@` est LITTÉRALE
# (ni variable ni échappement) : ce qui est entre les deux marques est ce qui a été écrit.
ICI_CHAINE = re.compile(r"@'\r?\n(.*?)\r?\n'@[ \t]*\|[ \t]*(Set-Content|Add-Content|Out-File)\b([^\r\n;|]*)", re.S | re.I)
LIEU = re.compile(r"(?:^|[;\n])[ \t]*(?:Set-Location|cd|sl)[ \t]+(?:-(?:Literal)?Path[ \t]+)?(['\"]?)([^'\";\n]+)\1", re.I)
AVEC_VALEUR = {"-encoding", "-width", "-stream", "-delimiter"}
DE_CHEMIN = {"-literalpath", "-path", "-filepath", "-pspath"}


def ecritures_powershell(cmd, cwd=""):
    """[(mode, chemin, cwd, contenu)] — mode "ecrire" (fichier entier) ou "ajouter" (en
    fin de fichier) — des chaînes littérales qu'une commande PowerShell a versées dans
    un fichier. Rien si le chemin est dynamique (variable, sous-expression)."""
    out = []
    for m in ICI_CHAINE.finditer(cmd or ""):
        contenu, verbe, arguments = m.group(1).replace("\r\n", "\n"), m.group(2).lower(), m.group(3)
        js = jetons_ps(arguments)
        if js is None:
            continue
        # Un `Set-Location` plus haut dans la même commande déplace les chemins relatifs.
        for lieu in LIEU.finditer(cmd, 0, m.start()):
            cible = lieu.group(2).strip()
            cwd = cible if re.match(r"^(?:[A-Za-z]:|/|\\)", cible) or not cwd else cwd.rstrip("/\\") + "/" + cible
        chemin, ajoute, j = None, verbe == "add-content", 0
        while j < len(js):
            genre, valeur = js[j]
            if genre != "mot":
                chemin = None
                break
            bas = valeur.lower()
            if bas in DE_CHEMIN:
                if j + 1 >= len(js) or js[j + 1][0] != "mot":
                    chemin = None
                    break
                chemin = js[j + 1][1]
                j += 2
                continue
            if bas in AVEC_VALEUR:
                j += 2
                continue
            if bas == "-append":
                ajoute = True
            elif not bas.startswith("-") and chemin is None:
                chemin = valeur
            j += 1
        if chemin:
            out.append(("ajouter" if ajoute else "ecrire", chemin, cwd, contenu))
    return out


# ── La base d'historique : ce que les sessions ne disent qu'à moitié ─────────
# Trouvée le 02/10/2026 (« as-tu regardé les docs d'Astra ? ») :
#
#     C:\Users\aniss\.codex\thread_history_1.sqlite — table thread_items
#
# L'application y range, pour l'affichage, chaque action de chaque fil. Deux genres
# valent mieux que leur trace dans les sessions :
#
#   · `fileChange` : chaque fichier touché par un patch, avec son DIFF UNIFIÉ — donc ses
#     numéros de ligne. La session ne garde que le patch, sans position : 368
#     modifications qu'il fallait replacer par leur contexte. Un ajout porte le fichier
#     entier.
#   · `commandExecution` : la commande RÉSOLUE (les sessions du 18/09 les fabriquent
#     par gabarits — `${path}` — que l'analyse du JavaScript ne suivait pas : 43
#     modifications et 180 commandes jamais vues) et sa sortie ENTIÈRE, là où la
#     session la coupe (« …N tokens truncated… », 229 sorties).
#
# La base est donc la source d'Astra ; les sessions ne servent plus que pour ce qui
# sort des fenêtres de temps qu'elle couvre (`evenements(…, hors=fenetres_base())`).
BASE = r"C:\Users\aniss\.codex\thread_history_1.sqlite"
MARGE_FENETRE = 2.0          # secondes : un appel consigné juste avant sa première trace en base


def _base(base):
    import sqlite3
    if not os.path.exists(base):
        return None
    return sqlite3.connect("file:" + base.replace("\\", "/") + "?mode=ro", uri=True)


def fenetres_base(base=BASE):
    """[(début, fin)] en secondes — une par fil — de ce que la base couvre."""
    c = _base(base)
    if c is None:
        return []
    try:
        return [(a / 1000.0 - MARGE_FENETRE, b / 1000.0 + MARGE_FENETRE) for a, b in c.execute(
            "select min(created_at_ms), max(created_at_ms) from thread_items "
            "where item_type in ('commandExecution', 'fileChange') group by thread_id")]
    finally:
        c.close()


def evenements_base(base=BASE):
    """Rend (instant, genre, chemin, bases, charge), genre dans : "ecrire" (contenu),
    "diff" (diff unifié, positionné), "supprimer" (None), "lire" ((fragment, total,
    rogne)), "ajouter" (texte versé en fin de fichier)."""
    c = _base(base)
    if c is None:
        return
    try:
        elements = c.execute("select created_at_ms, item_type, item_json from thread_items "
                             "where item_type in ('commandExecution', 'fileChange') "
                             "order by created_at_ms, rollout_ordinal").fetchall()
    finally:
        c.close()
    for ms, genre, brut in elements:
        try:
            e = json.loads(brut)
        except Exception:
            continue
        ts = ms / 1000.0
        if genre == "fileChange":
            if e.get("status") != "completed":
                continue
            for ch in e.get("changes") or []:
                chemin, nature, diff = ch.get("path"), (ch.get("kind") or {}), ch.get("diff")
                if not isinstance(chemin, str) or not isinstance(diff, str):
                    continue
                if nature.get("type") == "add":
                    yield ts, "ecrire", chemin, [], diff
                elif nature.get("type") == "delete":
                    yield ts, "supprimer", chemin, [], None
                elif nature.get("type") == "update":
                    yield ts, "diff", chemin, [], diff
                    if nature.get("move_path"):
                        # Déplacé : on sait ce qui a changé, pas le fichier entier. L'ancien
                        # nom disparaît ; le nouveau ne se connaîtra que par ses lectures.
                        yield ts, "supprimer", chemin, [], None
            continue
        actions = e.get("commandActions") or []
        cmd = actions[0].get("command") if len(actions) == 1 and isinstance(actions[0], dict) else None
        sortie, cwd = e.get("aggregatedOutput"), e.get("cwd") or ""
        if not isinstance(cmd, str):
            continue
        if e.get("exitCode") == 0:
            for mode, chemin, cwd_e, contenu in ecritures_powershell(cmd, cwd):
                yield ts, mode, chemin, [cwd_e], contenu
        for (fichier, cwd_cmd), frag, total, rogne in lectures_powershell(cmd, sortie, cwd):
            yield ts, "lire", fichier, [cwd_cmd, cwd], (frag, total, rogne)


# ── Les sessions ─────────────────────────────────────────────────────────────
def sessions():
    return sorted(glob.glob(os.path.join(SESSIONS, "**", "rollout-*.jsonl"), recursive=True))


def evenements(secondes, hors=()):
    """Rend, pour toutes les sessions : (instant, genre, chemin, bases, charge) avec genre
    dans "ecrire" (contenu), "modifier" ([(ancien, neuf)]), "supprimer" (None),
    "lire" ((fragment, total, rogne)).

    `hors` : des fenêtres de temps [(début, fin)] déjà couvertes par la base d'historique
    (`fenetres_base`). Un appel LANCÉ dans l'une d'elles est sauté : la base le porte,
    mieux — le rejouer aussi appliquerait deux fois la même modification."""
    for chemin_session in sessions():
        cwd, en_attente = "", {}
        with open(chemin_session, encoding="utf-8", errors="replace") as f:
            for ligne in f:
                if '"cwd"' not in ligne and '"custom_tool_call' not in ligne:
                    continue
                try:
                    rec = json.loads(ligne)
                except Exception:
                    continue
                pl = rec.get("payload") if isinstance(rec.get("payload"), dict) else {}
                if rec.get("type") in ("session_meta", "turn_context") and isinstance(pl.get("cwd"), str):
                    cwd = pl["cwd"]
                    continue
                if pl.get("type") == "custom_tool_call" and pl.get("name") == "exec":
                    lance = secondes(rec.get("timestamp"))
                    if not any(debut <= lance <= fin for debut, fin in hors):
                        en_attente[pl.get("call_id")] = (pl.get("input") or "", cwd)
                    continue
                if pl.get("type") != "custom_tool_call_output" or pl.get("call_id") not in en_attente:
                    continue
                code, cwd_appel = en_attente.pop(pl["call_id"])
                ts = secondes(rec.get("timestamp"))
                elements = pl.get("output")
                textes = [e.get("text", "") for e in elements if isinstance(e, dict) and e.get("type") == "input_text"] \
                    if isinstance(elements, list) else []
                if not textes:
                    continue
                liste = appels(code)
                # Les patchs : `{}` par patch appliqué, dans l'ordre. Un script qui échoue
                # s'arrête au premier appel fautif : seuls les premiers ont eu lieu.
                reussis = sum(1 for t in textes[1:] if t.strip() == "{}")
                patchs = [c for n, c in liste if n == "apply_patch"]
                for patch in patchs[:reussis]:
                    if not patch:
                        continue
                    for op in operations_patch(patch):
                        if op[0] == "ajouter":
                            yield ts, "ecrire", op[1], [cwd_appel], op[2]
                        elif op[0] == "modifier" and op[2]:
                            yield ts, "modifier", op[1], [cwd_appel], op[2]
                        elif op[0] in ("supprimer", "deplacer"):
                            yield ts, "supprimer", op[1], [cwd_appel], None
                # Les commandes : un JSON `{"output": …}` par appel, dans l'ordre.
                commandes = [c for n, c in liste if n in ("exec_command", "write_stdin")]
                sorties = []
                for t in textes[1:]:
                    try:
                        j = json.loads(t)
                    except Exception:
                        continue
                    if isinstance(j, dict) and "output" in j:
                        sorties.append(j)
                if len(commandes) != len(sorties):
                    continue
                noms = [n for n, _ in liste if n in ("exec_command", "write_stdin")]
                for nom, charge, sortie in zip(noms, commandes, sorties):
                    if nom != "exec_command" or not isinstance(charge, dict) or not isinstance(charge.get("cmd"), str):
                        continue
                    ici = charge.get("workdir") or cwd_appel
                    for (fichier, cwd_cmd), frag, total, rogne in lectures_powershell(charge["cmd"], sortie.get("output"),
                                                                                      ici):
                        yield ts, "lire", fichier, [cwd_cmd, ici], (frag, total, rogne)
