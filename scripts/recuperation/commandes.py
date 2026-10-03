# -*- coding: utf-8 -*-
"""
commandes.py — ce qu'une commande de shell a LU dans des fichiers, d'après sa ligne
de commande et sa sortie. Sans dépendance aux sources : testable seul
(test_commandes.py).

    lectures("sed -n '10,12p' a.lua", "x\\ny\\nz", cwd)
        -> [(("a.lua", cwd), [(10, "x"), (11, "y"), (12, "z")], 0, 10)]

Chaque lecture rendue est (fichier et dossier courant, lignes numérotées, longueur
du fichier si la commande la PROUVE — 0 sinon —, numéro de la ligne dont les blancs
de tête sont perdus — None sinon).

── CE QUI REND L'EXERCICE DANGEREUX ──────────────────────────────────────────
Une sortie de commande ne porte pas le nom du fichier ni, souvent, le numéro des
lignes : on les DÉDUIT. Une déduction fausse pose les lignes d'un fichier dans un
autre, ou les décale — et le cœur de la reconstruction y verrait une nouvelle
version du fichier. Trois faits mesurés le 01/10/2026 gouvernent donc tout :

  1. LA SORTIE EST ROGNÉE par l'outil (`trim`) : les lignes vides du DÉBUT
     disparaissent, la première ligne perd son indentation, les lignes vides de la
     FIN disparaissent. `sed -n '10,20p'` dont la ligne 10 est vide rend 10 lignes
     qu'on prendrait pour 10-19 : toutes fausses d'un rang.
  2. UNE PLAGE PEUT ÊTRE COURTE : `sed -n '90,120p'` sur 100 lignes en rend 11. Sans
     borne, les lignes de la commande suivante passeraient pour la suite.
  3. UN SÉPARATEUR PEUT FIGURER DANS LE FICHIER (`---` en Markdown).

D'où la règle : une sortie ne s'aligne que si elle SE COMPTE ou SE BORNE, et au
moindre doute on ne garde rien du GROUPE en cause. Les lignes qui portent leur propre
numéro (`grep -n`, `cat -n`) échappent à ces pièges : c'est la source la plus sûre.

── FORMES RECONNUES ──────────────────────────────────────────────────────────
  sed -n 'A,Bp' F   sed -n 'Ap' F   head [-n] K F   cat F      (positions déduites)
  cat -n F   nl -ba F   grep -n … F [F…]                       (numéros portés)
  cd D   NOM=valeur   echo TEXTE                               (sans lecture)
reliées par `;`, `&&` ou des retours à la ligne.

── CE QUI N'EST PAS RECONNU (depuis le 03/10/2026) ───────────────────────────
Un programme quelconque (`ls`, `node x.mjs`, `wc -l`, un `grep -c`…) écrit on ne sait
quoi : il devient un émetteur INCONNU. Il emporte son GROUPE — ce qui n'est séparé de
lui par aucun `echo` — et pas la commande : les lectures bornées par des `echo`
restent alignées. (Avant : 21 457 commandes sur 30 904 étaient écartées en entier.)
Reste écartée toute commande dont un segment change l'ÉTAT du shell (`pushd`,
`export`, `for … do`, `cd -`, une redirection, `||`) : on ne sait plus où l'on est.
Une substitution (`$(…)`, accents graves) rend son mot INSOLUBLE, pas la commande
illisible. Une plage courte en TÊTE de sortie part en lecture FLOTTANTE, que le
fichier tel qu'on le tient cale ou non (`Reconstitution._caler`).
"""
import os
import re

EXT = r"(?:lua|mjs|cjs|js|ts|tsx|css|html|md|toml|json|py|txt|cpp|h|ini|sh|ps1|yaml|yml)"
LIGNE_NUM = re.compile(r"^\s*(\d+)\t(.*)$")                       # cat -n, nl -ba
LIGNE_GREP = re.compile(r"^(\d+)([:-])(.*)$")                    # grep -n, un seul fichier
LIGNE_GREP_MULTI = re.compile(r"^(.+?\." + EXT + r")([:-])(\d+)\2(.*)$", re.I)
TRONCATURE = re.compile(r"\[\d+ (?:lines|characters|chars) truncated\]|<persisted-output>|Output too large")
SORTIE_LONGUE = 25000        # l'outil coupe les sorties vers 30 000 caractères
OPERATEURS = ("&&", "||", ">>", "<<", ";", "|", "&", ">", "<", "(", ")")
NOM_VAR = re.compile(r"[A-Za-z_][A-Za-z0-9_]*")
PLAGE = re.compile(r"^(\d+)(?:,(\d+))?p$")
# Options de grep qui prennent leur argument dans le jeton SUIVANT.
GREP_AVEC_ARGUMENT = {"-A", "-B", "-C", "-m", "-e", "-f", "--include", "--exclude", "--exclude-dir",
                      "--max-count", "--after-context", "--before-context", "--context", "--regexp"}
# Lettres d'options courtes qui changent la FORME des lignes rendues.
GREP_LETTRES_INTERDITES = set("oclLqbZzT")
GREP_LONGUES_INTERDITES = ("--only-matching", "--count", "--files-with", "--files-without", "--null",
                           "--quiet", "--silent", "--byte-offset", "--color", "--colour", "--json")


# ── Découpage ────────────────────────────────────────────────────────────────
# Une valeur que le shell calcule en lançant une commande (`$(…)`, accents graves) : jamais
# résolue — le mot qui la porte ne vaut rien de connu — mais on sait où elle FINIT.
INSOLUBLE = ("var", "\x00substitution")


def _fin_substitution(commande, i):
    """`commande[i]` ouvre la parenthèse d'un `$(` : l'indice qui suit la parenthèse fermante
    correspondante. None si elle ne se ferme pas, ou si elle porte un heredoc (son corps
    peut contenir n'importe quoi : on ne sait pas le sauter d'ici)."""
    n, profondeur, j = len(commande), 0, i
    while j < n:
        c = commande[j]
        if c == "\\":
            j += 2
            continue
        if c == "'":
            k = commande.find("'", j + 1)
            if k < 0:
                return None
            j = k + 1
            continue
        if c == '"':
            j += 1
            while j < n and commande[j] != '"':
                if commande[j] == "\\":
                    j += 2
                elif commande.startswith("$(", j):
                    j = _fin_substitution(commande, j + 1)
                    if j is None:
                        return None
                else:
                    j += 1
            if j >= n:
                return None
            j += 1
            continue
        if c == "`":
            j = _fin_accent_grave(commande, j)
            if j is None:
                return None
            continue
        if commande.startswith("<<", j) and not commande.startswith("<<<", j):
            return None
        if c == "(":
            profondeur += 1
        elif c == ")":
            profondeur -= 1
            if profondeur == 0:
                return j + 1
        j += 1
    return None


def _fin_accent_grave(commande, i):
    """`commande[i]` est un accent grave ouvrant : l'indice qui suit celui qui le ferme, ou
    None (non fermé, ou porteur d'un heredoc)."""
    j = i + 1
    while j < len(commande) and commande[j] != "`":
        j += 2 if commande[j] == "\\" else 1
    if j >= len(commande) or "<<" in commande[i:j]:
        return None
    return j + 1


def jetons(commande):
    """[("op", symbole) | ("mot", [("lit", texte) | ("var", nom)])], ou None si la
    commande n'est pas analysable (guillemet ouvert, `${x%y}`, `$'…'`…).

    Une substitution de commande (`$(…)`, accents graves) ne rend plus la commande illisible :
    le mot qui la porte est seulement INSOLUBLE (`resoudre` rend None), et le segment où il
    figure devient un émetteur inconnu. Mesuré le 03/10/2026 : 1 181 commandes du projet
    lisaient des fichiers et n'étaient écartées que pour un `F=$(…)` en tête."""
    commande = re.sub(r"(?<![\w/&])2>\s*(?:/dev/null|&1|nul)(?![\w.])", " ", commande.replace("\r", ""))
    out, parts, en_mot = [], [], False
    i, n = 0, len(commande)

    def lit(s):
        if parts and parts[-1][0] == "lit":
            parts[-1] = ("lit", parts[-1][1] + s)
        else:
            parts.append(("lit", s))

    def finir():
        nonlocal parts, en_mot
        if en_mot:
            out.append(("mot", parts))
        parts, en_mot = [], False

    def variable(i, dans_guillemets=False):
        """À `$` : rend (élément, indice suivant), ou None pour ce qu'on n'analyse pas."""
        suite = commande[i + 1:i + 2]
        if suite == "(":
            # `$(…)` : une valeur qu'on ne connaîtra pas, mais dont on sait où elle finit.
            fin = _fin_substitution(commande, i + 1)
            return (INSOLUBLE, fin) if fin else None
        if suite in ("'", '"') and not dans_guillemets:
            return None                                  # $'…', $"…"
        if suite == "{":
            j = commande.find("}", i)
            nom = commande[i + 2:j] if j > 0 else ""
            return (("var", nom), j + 1) if NOM_VAR.fullmatch(nom) else None
        m = NOM_VAR.match(commande, i + 1)
        if m:
            return ("var", m.group(0)), m.end()
        if suite and suite in "?!@*#$-0123456789":
            return ("var", suite), i + 2                 # paramètre spécial : jamais résolu
        return ("lit", "$"), i + 1                       # `$` littéral (fin de motif)

    while i < n:
        c = commande[i]
        if c in " \t":
            finir()
            i += 1
        elif c == "\n":
            finir()
            out.append(("op", ";"))
            i += 1
        elif c == "#" and not en_mot:
            while i < n and commande[i] != "\n":
                i += 1
        elif c == "'":
            j = commande.find("'", i + 1)
            if j < 0:
                return None
            en_mot = True
            lit(commande[i + 1:j])
            i = j + 1
        elif c == '"':
            en_mot = True
            lit("")
            i += 1
            while i < n and commande[i] != '"':
                ch = commande[i]
                if ch == "\\" and commande[i + 1:i + 2] in ('"', "\\", "$", "`"):
                    lit(commande[i + 1])
                    i += 2
                elif ch == "`":
                    fin = _fin_accent_grave(commande, i)
                    if fin is None:
                        return None
                    parts.append(INSOLUBLE)
                    i = fin
                elif ch == "$":
                    r = variable(i, True)
                    if r is None:
                        return None
                    if r[0][0] == "lit":
                        lit(r[0][1])
                    else:
                        parts.append(r[0])
                    i = r[1]
                else:
                    lit(ch)
                    i += 1
            if i >= n:
                return None
            i += 1
        elif c == "\\":
            if i + 1 >= n:
                return None
            if commande[i + 1] != "\n":                  # `\` + retour : continuation de ligne
                en_mot = True
                lit(commande[i + 1])
            i += 2
        elif c == "`":
            fin = _fin_accent_grave(commande, i)
            if fin is None:
                return None
            en_mot = True
            parts.append(INSOLUBLE)
            i = fin
        elif c == "$":
            r = variable(i)
            if r is None:
                return None
            en_mot = True
            if r[0][0] == "lit":
                lit(r[0][1])
            else:
                parts.append(r[0])
            i = r[1]
        else:
            for op in OPERATEURS:
                if commande.startswith(op, i):
                    finir()
                    out.append(("op", op))
                    i += len(op)
                    break
            else:
                en_mot = True
                lit(c)
                i += 1
    finir()
    return out


def _affectation_insoluble(parts):
    """Le NOM que pose un mot `NOM=…` dont la valeur ne se résout pas (`F=$(ls | head -1)`),
    sinon None. La variable existe, sa valeur nous échappe : il faut OUBLIER celle qu'on lui
    connaissait — sans quoi un `$F` plus bas désignerait l'ancien fichier."""
    if parts and parts[0][0] == "lit":
        m = re.match(r"^([A-Za-z_][A-Za-z0-9_]*)=", parts[0][1])
        return m.group(1) if m else None
    return None


def resoudre(parts, env):
    """Le texte d'un mot, ou None si une variable est inconnue."""
    out = []
    for genre, valeur in parts:
        if genre == "lit":
            out.append(valeur)
        elif valeur in env:
            out.append(env[valeur])
        else:
            return None
    return "".join(out)


# ── Analyse d'un segment ─────────────────────────────────────────────────────
def _entier(s):
    return int(s) if isinstance(s, str) and s.isdigit() else None


def _tete(mots):
    """`head …` : (nombre de lignes, opérandes), ou None."""
    k, operandes, i = 10, [], 1
    while i < len(mots):
        m = mots[i]
        if m == "-n" and i + 1 < len(mots):
            k = _entier(mots[i + 1])
            i += 2
        elif m.startswith("-n") and _entier(m[2:]) is not None:
            k = int(m[2:])
            i += 1
        elif m.startswith("-") and _entier(m[1:]) is not None:
            k = int(m[1:])
            i += 1
        elif m.startswith("-"):
            return None                                  # -c, -q, -n -5…
        else:
            operandes.append(m)
            i += 1
        if k is None or k < 1:
            return None
    return k, operandes


def _plage_sed(mots):
    """`sed -n 'A,Bp' [F]` : (a, b, opérandes), ou None."""
    if len(mots) < 3 or mots[1] != "-n":
        return None
    m = PLAGE.match(mots[2])
    if not m:
        return None
    a = int(m.group(1))
    b = int(m.group(2)) if m.group(2) else a
    return (a, b, mots[3:]) if b >= a >= 1 else None


def _grep(mots):
    """`grep …` : (numérote, opérandes fichiers, récursif, force le nom, cache le nom),
    ou None si une option change la forme des lignes rendues."""
    numerote = recursif = force = cache = False
    motif_vu, fichiers, i = False, [], 1
    while i < len(mots):
        m = mots[i]
        if m == "--":
            fichiers.extend(mots[i + 1:] if motif_vu else mots[i + 2:])
            motif_vu = True
            break
        if m.startswith("--"):
            if m.startswith(GREP_LONGUES_INTERDITES):
                return None
            if m == "--line-number":
                numerote = True
            elif m in ("--recursive", "--dereference-recursive"):
                recursif = True
            elif m == "--with-filename":
                force = True
            elif m == "--no-filename":
                cache = True
            if m in GREP_AVEC_ARGUMENT:
                if m == "--regexp":
                    motif_vu = True
                i += 1
            i += 1
            continue
        if m.startswith("-") and len(m) > 1:
            if m in GREP_AVEC_ARGUMENT:
                if m in ("-e", "-f"):
                    motif_vu = True
                i += 2
                continue
            lettres = m[1:].rstrip("0123456789")          # -A3, -nC2 : nombre collé
            if GREP_LETTRES_INTERDITES & set(lettres):
                return None
            numerote = numerote or "n" in lettres
            recursif = recursif or "r" in lettres or "R" in lettres
            force = force or "H" in lettres
            cache = cache or "h" in lettres
            # -e / -f collés en fin de grappe prennent le jeton suivant
            if lettres.endswith(("e", "f")) and m[-1] in "ef":
                motif_vu = True
                i += 1
            i += 1
            continue
        if not motif_vu:
            motif_vu = True
        else:
            fichiers.append(m)
        i += 1
    if not motif_vu:
        return None
    return numerote, fichiers, recursif, force, cache


def _filtre_inoffensif(mots):
    """Un filtre de tube qui ne retouche pas les lignes numérotées qu'il laisse passer."""
    if not mots:
        return False
    if mots[0] in ("head", "tail"):
        return all(re.fullmatch(r"-n|-?\+?\d+|-n\+?\d+", m) for m in mots[1:])
    if mots[0] == "sed":
        return len(mots) == 3 and mots[1] == "-n" and bool(PLAGE.match(mots[2]))
    if mots[0] == "grep":
        g = _grep(mots)
        return bool(g) and not g[0] and not g[1]         # ni -n, ni fichier : il filtre l'entrée
    return False


def _borne(filtres):
    """Le plus petit maximum de lignes qu'imposent les filtres d'un tube (`head -K`,
    `tail -K`, `sed -n 'A,Bp'`), ou None si aucun ne borne la sortie."""
    borne = None
    for f in filtres:
        k = None
        if f and f[0] in ("head", "tail"):
            if len(f) == 1:
                k = 10
            elif len(f) == 2 and re.fullmatch(r"-n?\d+", f[1]):
                k = int(f[1].lstrip("-n"))
            elif len(f) == 3 and f[1] == "-n" and f[2].isdigit():
                k = int(f[2])
        elif f and f[0] == "sed" and len(f) == 3:
            m = PLAGE.match(f[2])
            if m:
                k = int(m.group(2) or m.group(1)) - int(m.group(1)) + 1
        if k is not None and k > 0:
            borne = k if borne is None else min(borne, k)
    return borne


def analyser(commande, cwd=""):
    """La suite des ÉMETTEURS de la commande, ou None si elle n'est pas analysable.

    ("echo", texte) | ("pos", fichier, cwd, a, b|None) | ("num", fichier|None, cwd, max|None)
    où fichier None signale des lignes préfixées par leur chemin (grep sur plusieurs
    fichiers), et max le nombre de lignes qu'un filtre (`| head -K`) laisse passer au plus.
    """
    js = jetons(commande or "")
    if js is None:
        return None
    segments, courant = [], [[]]
    for genre, valeur in js:
        if genre == "op":
            if valeur in (";", "&&"):
                segments.append(courant)
                courant = [[]]
            elif valeur == "|":
                courant.append([])
            else:
                return None                              # redirection, sous-shell, ||, &
        else:
            courant[-1].append(valeur)
    segments.append(courant)

    env, emetteurs = {}, []
    for etages in segments:
        if etages == [[]]:
            continue
        mots_etages = [[resoudre(p, env) for p in etage] for etage in etages]
        if len(etages) == 1 and len(etages[0]) == 1 and mots_etages[0][0] is None:
            nom = _affectation_insoluble(etages[0][0])
            if nom:
                env.pop(nom, None)                       # `F=$(…)` : F existe, sa valeur nous échappe
                continue
        if any(not mots for mots in mots_etages) or mots_etages[0][0] is None:
            return None                                  # tube sans commande, ou commande elle-même inconnue (`$X …`)
        emetteur = _emetteur(mots_etages, env, cwd)
        if emetteur is None:
            return None
        if emetteur[0] == "cd":
            cwd = emetteur[1]
        elif emetteur[0] != "rien":
            emetteurs.append(emetteur)
    return emetteurs


# Ce qui change l'ÉTAT du shell — dossier courant, variables, enchaînement : après lui, on ne
# sait plus où l'on est ni ce qui tourne. La commande entière reste écartée.
CHANGE_LE_SHELL = {"pushd", "popd", "source", ".", "eval", "exec", "export", "set", "unset", "shopt", "alias",
                   "unalias", "declare", "local", "typeset", "readonly", "read", "trap", "exit", "return", "wait",
                   "if", "then", "else", "elif", "fi", "for", "while", "until", "do", "done", "case", "esac",
                   "function", "select", "{", "}", "!", "[[", "((", "time", "builtin", "command", "coproc", "break",
                   "continue", "shift", "getopts", "mapfile", "readarray", "let"}
INCONNU = ("inconnu",)


def _emetteur(mots_etages, env, cwd):
    """Ce qu'UN segment de commande envoie dans la sortie :

        ("cd", dossier)   ("rien",)   ("echo", texte)   ("pos", …)   ("num", …)   ("opaque", K)
        ("inconnu",)      il écrit on ne sait quoi, sur on ne sait combien de lignes
        None              on ne sait plus où l'on est : la commande entière est écartée

    ⚠ UN SEGMENT INCONNU N'EMPORTE PLUS LA COMMANDE. Mesuré le 03/10/2026 : 21 457 commandes
    sur 30 904 étaient « non analysables », le plus souvent pour un seul `ls`, `node x.mjs`,
    `find`, `wc -l` ou `grep -c` au milieu de lectures par ailleurs bornées par des
    `echo "=== … ==="`. Un programme lancé ne change ni le dossier courant ni les variables
    du shell : sa sortie est seulement imprévisible. Il devient un émetteur INCONNU, que
    `aligner_lignes` enferme entre ses séparateurs — et tout ce qui n'en est pas séparé
    par un `echo` reste écarté, comme avant.
    """
    tete, filtres = mots_etages[0], mots_etages[1:]
    # `NOM=valeur commande …` : la variable ne vaut que pour ce programme.
    while len(tete) > 1 and re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*=.*", tete[0], re.S):
        tete = tete[1:]
        if tete[0] is None:
            return None
    verbe = tete[0]
    if len(tete) == 1 and not filtres and re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*=.*", verbe, re.S):
        nom, _, valeur = verbe.partition("=")
        env[nom] = valeur
        return ("rien",)
    if verbe == "cd":
        if len(tete) != 2 or filtres or tete[1] is None or tete[1] in ("-", "~"):
            return None
        return ("cd", tete[1] if re.match(r"^(?:[A-Za-z]:|/|\\)", tete[1]) or not cwd
                else cwd.rstrip("/\\") + "/" + tete[1])
    if os.path.basename(verbe) in CHANGE_LE_SHELL or any(f[0] in CHANGE_LE_SHELL for f in filtres if f[0]):
        return None
    if any(m is None for mots in mots_etages for m in mots):
        return INCONNU                                   # un argument qu'on ne sait pas résoudre
    if verbe == "echo" and not filtres:
        if any(m.startswith("-") and set(m[1:]) <= set("neE") and len(m) > 1 for m in tete[1:2]):
            return None                                  # echo -e / -n : colle sa sortie à la ligne suivante
        return ("echo", " ".join(tete[1:]))
    if verbe == "sed":
        p = _plage_sed(tete)
        if not p or len(p[2]) != 1:
            return INCONNU
        a, b, (fichier,) = p
        for f in filtres:
            t = _tete(f) if f and f[0] == "head" else None
            if not t or t[1]:
                return INCONNU
            b = min(b, a + t[0] - 1)
        return ("pos", fichier, cwd, a, b)
    if verbe == "head":
        t = _tete(tete)
        if not t or len(t[1]) != 1 or filtres:
            return INCONNU
        return ("pos", t[1][0], cwd, 1, t[0])
    if verbe == "tail":
        # Les K dernières lignes : on ne sait pas lesquelles, mais on sait qu'il y en a
        # K au plus — de quoi COMPTER la sortie quand tout le reste se compte aussi.
        t = _tete(tete)
        if not t or len(t[1]) != 1 or filtres:
            return INCONNU
        return ("opaque", t[0])
    if verbe in ("cat", "nl"):
        numerote = (verbe == "cat" and tete[1:2] == ["-n"]) or (verbe == "nl" and tete[1:2] == ["-ba"])
        operandes = tete[2:] if numerote else tete[1:]
        if len(operandes) != 1 or operandes[0].startswith("-") or (verbe == "nl" and not numerote):
            return INCONNU
        if numerote:
            if not all(_filtre_inoffensif(f) for f in filtres):
                return INCONNU
            return ("num", operandes[0], cwd, _borne(filtres))
        b = None
        for f in filtres:
            t = _tete(f) if f and f[0] == "head" else None
            if not t or t[1]:
                return INCONNU
            b = t[0] if b is None else min(b, t[0])
        return ("pos", operandes[0], cwd, 1, b)
    if verbe == "grep":
        g = _grep(tete)
        if not g or not g[0] or not g[1] or not all(_filtre_inoffensif(f) for f in filtres):
            return INCONNU
        _, fichiers, recursif, force, cache = g
        # `grep -rn motif UN_FICHIER` ne préfixe pas ses lignes : `-r` ne nomme les fichiers
        # que s'il en parcourt plusieurs (un dossier, ou plus d'un opérande).
        un_fichier = len(fichiers) == 1 and bool(re.search(r"\." + EXT + r"$", fichiers[0], re.I))
        prefixe = (force or len(fichiers) > 1 or (recursif and not un_fichier)) and not cache
        if not prefixe and len(fichiers) != 1:
            return INCONNU                               # plusieurs fichiers sans nom : inattribuable
        return ("num", None if prefixe else fichiers[0], cwd, _borne(filtres))
    return INCONNU                                       # un programme quelconque


# ── Écritures par heredoc ────────────────────────────────────────────────────
HEREDOC = re.compile(r"\bcat\s*(>>?)\s*(\"[^\"\n]+\"|'[^'\n]+'|[^\s<>|;&]+)\s*<<(-?)\s*(['\"])([A-Za-z_][A-Za-z0-9_]*)\4[ \t]*\n"
                     r"(.*?)\n\5[ \t]*(?=\n|$)", re.S)


def _contexte(prefixe, cwd):
    """(dossier courant, variables) après les `cd` et affectations d'un début de
    commande ; None si un `cd` n'est pas lisible (on ne saurait plus où l'on écrit)."""
    js = jetons(prefixe)
    if js is None:
        return None
    env, segments, courant = {}, [], []
    for genre, valeur in js:
        if genre == "op":
            segments.append(courant)
            courant = []
        else:
            courant.append(valeur)
    segments.append(courant)
    for seg in segments:
        if not seg:
            continue
        mots = [resoudre(p, env) for p in seg]
        if len(seg) == 1 and mots[0] is None:
            env.pop(_affectation_insoluble(seg[0]), None)    # `F=$(…)` : oublier l'ancienne valeur
            continue
        if mots[0] == "cd":
            if len(mots) != 2 or mots[1] is None or mots[1] in ("-", "~"):
                return None
            cwd = mots[1] if re.match(r"^(?:[A-Za-z]:|/|\\)", mots[1]) or not cwd else cwd.rstrip("/\\") + "/" + mots[1]
        elif len(mots) == 1 and mots[0] and re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*=.*", mots[0], re.S):
            nom, _, valeur = mots[0].partition("=")
            env[nom] = valeur
        elif mots[0] in ("pushd", "popd"):
            return None
    return cwd, env


def ecritures(commande, cwd="", reduire=True):
    """[((fichier, cwd), contenu)] des fichiers ÉCRITS par `cat > F <<'FIN' … FIN`.

    Une écriture par heredoc est une écriture COMPLÈTE que les outils de fichiers ne
    voient pas : le contenu est dans la commande. On ne prend que les délimiteurs
    CITÉS (`<<'FIN'`) : sans guillemets, le shell développe `$VAR` et `$(…)`.

    ⚠ Le shell ne reçoit pas le texte que la transcription enregistre : les paires
    d'antislashs y sont réduites (voir `reduire_antislashs`). Le fichier sur le disque
    porte donc le texte RÉDUIT : on applique la même réduction.
    """
    return _heredocs(commande, cwd, reduire, ">")


def ajouts(commande, cwd="", reduire=True):
    """[((fichier, cwd), contenu)] des textes AJOUTÉS en fin de fichier par
    `cat >> F <<'FIN' … FIN` — 135 commandes des historiques (un bloc de CSS, un cas de
    test de plus) qu'aucun outil de fichiers n'a vues. Mêmes règles que `ecritures` ;
    l'ajout ne se place que contre l'état du fichier à cet instant (`derouler_scripts`)."""
    return [a for genre, a in actions(commande, cwd, reduire) if genre == "ajout"]


def _heredocs(commande, cwd, reduire, operateur):
    out, travail = [], (commande or "").replace("\r", "")
    for m in HEREDOC.finditer(travail):
        if m.group(1) != operateur:
            continue
        # Le début de la commande, sans le corps des heredocs qui précèdent.
        prefixe = HEREDOC.sub(":", travail[:m.start()])
        ctx = _contexte(prefixe, cwd)
        if ctx is None:
            continue
        ici, env = ctx
        cible = jetons(m.group(2))
        if not cible or len(cible) != 1 or cible[0][0] != "mot":
            continue
        fichier = resoudre(cible[0][1], env)
        if not fichier:
            continue
        corps = m.group(6)
        if m.group(3):
            corps = "\n".join(l.lstrip("\t") for l in corps.split("\n"))
        out.append(((fichier, ici), (reduire_antislashs(corps) if reduire else corps) + "\n"))
    return out


SUITE_ANTISLASHS = re.compile(r"\\+")


def reduire_antislashs(texte):
    """Le texte tel que le shell de Claude Code le REÇOIT sous Windows.

    La commande passe par la ligne de commande de Windows avant d'atteindre bash, et
    l'analyseur d'arguments de MSYS y réduit chaque PAIRE d'antislashs à un seul —
    sauf dans une suite d'antislashs qui précède immédiatement un guillemet double
    (celle-là, l'outil l'avait doublée exprès). Mesuré le 02/10/2026, heredoc cité :

        "a\\\\b"  ->  "a\\b"         'a\\\\'  ->  'a\\'        [/\\\\]  ->  [/\\]
        "a\\\\"   ->  "a\\\\"  (inchangé : la suite précède un guillemet double)

    Un script lancé par heredoc s'exécute donc avec ce texte réduit, pas avec celui
    que la transcription enregistre.

    ⚠ UN PIÈGE DE MESURE, payé le 02/10/2026. Rejoués des deux façons, 9 scripts
    d'historique ne RÉUSSISSENT que si l'on ne réduit pas : on en conclurait que les
    sessions d'avant la perte ne réduisaient pas. C'est le contraire — ces 9 scripts
    avaient ÉCHOUÉ quand ils ont tourné (`Traceback` dans leur sortie), parce que la
    réduction avait défait leur ancre. Un rejeu « qui réussit » ne prouve rien si l'on
    n'a pas regardé ce que le script avait fait pour de vrai : voir
    `extraire-historiques.echecs_reels`.
    """
    def reduit(m):
        if texte[m.end():m.end() + 1] == '"':
            return m.group(0)
        n = len(m.group(0))
        return "\\" * ((n + 1) // 2)

    return SUITE_ANTISLASHS.sub(reduit, texte)


# ── Scripts exécutés ─────────────────────────────────────────────────────────
HEREDOC_TOUT = re.compile(r"<<(-?)[ \t]*(['\"]?)([A-Za-z_][A-Za-z0-9_]*)\2")
OPTIONS_SANS_SCRIPT = {"--check", "-c", "--version", "-v", "-V", "-m", "--help", "-h", "-p", "--print"}
OPTIONS_AVEC_ARGUMENT = {"-r", "--require", "-X", "-W", "--loader", "--import"}
INTERPRETES = {"python": "python", "python3": "python", "py": "python", "node": "node"}


def _sans_heredocs(commande):
    """(commande où chaque heredoc est réduit à `<<HEREDOC_k`, [(corps, cité)]), ou None
    si un heredoc n'est pas fermé."""
    lignes, out, corps, i = commande.split("\n"), [], [], 0
    while i < len(lignes):
        l = lignes[i]
        m = HEREDOC_TOUT.search(l)
        if not m:
            out.append(l)
            i += 1
            continue
        marque, j = m.group(3), i + 1
        while j < len(lignes) and (lignes[j].lstrip("\t") if m.group(1) else lignes[j]).rstrip() != marque:
            j += 1
        if j >= len(lignes):
            return None
        bloc = lignes[i + 1:j]
        if m.group(1):
            bloc = [x.lstrip("\t") for x in bloc]
        out.append(l[:m.start()] + f"<<HEREDOC_{len(corps)}" + l[m.end():])
        corps.append(("\n".join(bloc), bool(m.group(2))))
        i = j + 1
    return "\n".join(out), corps


def _commandes_simples(commande, cwd, reduire):
    """Comme `_commandes`, sans la redirection de sortie : (mots, entrée, dossier)."""
    for mots, entree, ici, _ in _commandes(commande, cwd, reduire):
        yield mots, entree, ici


def _commandes(commande, cwd, reduire):
    """Les commandes simples d'une ligne de shell, une à une, DANS L'ORDRE :
    (mots, entrée, dossier, sortie).

    `mots` : le premier étage de chaque segment (ce qui précède un éventuel `|`), une
    fois ôtées les redirections et résolues les variables posées plus haut ; `entrée` :
    (corps, cité) du heredoc qui l'alimente, ou None ; `dossier` : le dossier courant à
    cet endroit, `cd` compris ; `sortie` : (">" ou ">>", fichier) si la commande verse
    sa sortie dans un fichier, sinon None. Les antislashs sont ceux que le shell a REÇUS.
    """
    for _, mots, entree, ici, sortie, _, _ in _segments(commande, cwd, reduire):
        if mots and mots[0] != "cd":
            yield mots, entree, ici, sortie


def _segments(commande, cwd, reduire):
    """TOUS les segments d'une ligne de shell, dans l'ordre :
    (lien, mots, entrée, dossier, sortie, étages, structure).

    Comme `_commandes`, plus ce qu'il faut pour savoir si un segment a été LANCÉ :
    `lien` est l'opérateur qui le précède (None pour le premier ; ";" vaut aussi pour un
    retour à la ligne ; "&&", "||", "&") ; `mots` vaut None pour un segment illisible
    (variable inconnue), [] pour une affectation seule, ["cd", …] pour un `cd` (déjà
    appliqué au dossier rendu) ; `étages` compte les étages du tube ; `structure` dit que
    le segment porte une parenthèse (sous-shell, groupe) qu'on ne suit pas."""
    commande = (commande or "").replace("\r", "")
    if reduire:
        commande = reduire_antislashs(commande)
    sans = _sans_heredocs(commande)
    if sans is None:
        return
    reduite, corps = sans
    js = jetons(reduite)
    if js is None:
        return
    # Segments (séparés par ; && || ou un retour), chacun fait d'étages (séparés par |).
    segments, courant, lien = [], [[]], None
    for genre, valeur in js:
        if genre == "op" and valeur in (";", "&&", "||", "&"):
            if courant == [[]]:
                # Rien entre deux séparateurs (`A &&` + retour + `B`) : le retour ne défait
                # pas le lien qui attend sa commande.
                if valeur != ";" or lien is None:
                    lien = valeur if segments else None
                continue
            segments.append((lien, courant))
            courant, lien = [[]], valeur
        elif genre == "op" and valeur == "|":
            courant.append([])
        else:
            courant[-1].append((genre, valeur))
    segments.append((lien, courant))

    env = {}
    for lien, etages in segments:
        etage = etages[0]
        structure = any(g == "op" and v in ("(", ")") for e in etages for g, v in e)
        mots, entree, sortie, k, lisible = [], None, None, 0, True
        while k < len(etage):
            genre, valeur = etage[k]
            if genre == "op":
                suivant = etage[k + 1] if k + 1 < len(etage) else None
                if valeur == "<<" and suivant and suivant[0] == "mot":
                    nom = resoudre(suivant[1], env)
                    m = re.fullmatch(r"HEREDOC_(\d+)", nom or "")
                    if m:
                        entree = corps[int(m.group(1))]
                elif valeur in (">", ">>") and suivant and suivant[0] == "mot" and len(etages) == 1:
                    cible = resoudre(suivant[1], env)
                    sortie = (valeur, cible) if cible else None
                k += 2                                   # l'opérateur et sa cible
                continue
            mot = resoudre(valeur, env)
            if mot is None:
                lisible = False
                break
            mots.append(mot)
            k += 1
        if not lisible:
            if len(etages) == 1 and len(etage) == 1 and etage[0][0] == "mot":
                env.pop(_affectation_insoluble(etage[0][1]), None)   # `F=$(…)` : oublier l'ancienne valeur
            yield lien, None, None, cwd, None, len(etages), structure
            continue
        if not mots:
            if etage:                                    # une redirection sans commande (`> f`)
                yield lien, None, None, cwd, None, len(etages), structure
            continue
        # Affectations de tête (`VAR=x cmd`), `cd`, puis la commande.
        while mots and re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*=.*", mots[0], re.S):
            if len(mots) == 1:
                nom, _, valeur = mots[0].partition("=")
                env[nom] = valeur
            mots = mots[1:]
        if mots and mots[0] == "cd":
            if len(mots) == 2 and mots[1] not in ("-", "~"):
                cwd = mots[1] if re.match(r"^(?:[A-Za-z]:|/|\\)", mots[1]) or not cwd else cwd.rstrip("/\\") + "/" + mots[1]
        yield lien, mots, entree, cwd, sortie, len(etages), structure


def executions(commande, cwd="", reduire=True):
    """[(langage, code ou None, chemin du script ou None, arguments, dossier courant, mode)]
    des scripts Python et Node qu'une commande de shell EXÉCUTE — `mode` dit d'où vient
    le script ("entree", "arg" ou "fichier") : la liste d'arguments qu'il VOIT en dépend.

        python - <<'FIN' … FIN        node - a b <<'FIN' … FIN       (script sur l'entrée)
        python -c "…"                 node -e '…'                    (script en argument)
        python outil.py a b           node outil.mjs a b             (script dans un fichier)

    précédés de `cd …` et d'affectations, suivis ou non d'un tube. Le code est rendu
    tel que l'interpréteur l'a REÇU (voir `reduire_antislashs`). Un heredoc non cité
    n'est pris que s'il ne porte ni `$` ni accent grave : le shell y développerait
    des variables qu'on ne connaît pas.
    """
    return [a for genre, a in actions(commande, cwd, reduire) if genre == "script"]


def _execution(mots, entree, ici):
    """L'exécution d'un script par UNE commande simple (voir `executions`), ou None."""
    langage = INTERPRETES.get(os.path.basename(mots[0]).lower().replace(".exe", ""))
    if not langage:
        return None
    # Options, puis `-` / `-c CODE` / chemin, puis les arguments du script.
    code, chemin, args, mode, i = None, None, [], "entree", 1
    while i < len(mots):
        m = mots[i]
        if m in ("-c", "-e", "--eval") and i + 1 < len(mots) and (m != "-c" or langage == "python"):
            code, args, mode = mots[i + 1], mots[i + 2:], "arg"
            break
        if m in OPTIONS_SANS_SCRIPT:
            entree = None
            break
        if m in OPTIONS_AVEC_ARGUMENT:
            i += 2
            continue
        if m == "-":
            args = mots[i + 1:]
            break
        if m.startswith("-"):
            i += 1
            continue
        chemin, args, mode = m, mots[i + 1:], "fichier"
        break
    if code is None and chemin is None and entree is not None:
        corps_script, cite = entree
        if cite or not re.search(r"[$`]", corps_script):
            code = corps_script
    if code is not None or chemin is not None:
        return langage, code, chemin, args, ici, mode
    return None


def editions_sed(commande, cwd="", reduire=True):
    """[(arguments de sed, fichiers, dossier courant)] des `sed -i …` d'une commande —
    une modification EN PLACE qu'aucun outil de fichiers n'a vue. Les arguments sont
    rendus sans les fichiers : de quoi relancer le même `sed` sur ce qu'on tient d'eux.
    """
    return [a for genre, a in actions(commande, cwd, reduire) if genre == "sed"]


def _edition_sed(mots, ici):
    """Le `sed -i` d'UNE commande simple (voir `editions_sed`), ou None."""
    if os.path.basename(mots[0]).lower().replace(".exe", "") != "sed":
        return None
    args, positionnels, en_place, script_par_e, i = [], [], False, False, 1
    while i < len(mots):
        m = mots[i]
        if m == "--":
            positionnels.extend(mots[i + 1:])
            break
        if m in ("-e", "--expression") and i + 1 < len(mots):
            args.extend([m, mots[i + 1]])
            script_par_e = True
            i += 2
            continue
        if m in ("-f", "--file"):
            return None                                  # script de sed dans un fichier : on ne l'a pas
        if m.startswith("-") and len(m) > 1:
            if m == "--in-place" or (not m.startswith("--") and "i" in m):
                en_place = True
                m = re.sub(r"i.*$", "i", m) if not m.startswith("--") else m     # `-i.bak` : pas de copie
            args.append(m)
            i += 1
            continue
        positionnels.append(m)
        i += 1
    if not en_place:
        return None
    if not script_par_e:
        if not positionnels:
            return None
        args.append(positionnels.pop(0))
    return (args, positionnels, ici) if positionnels else None


def deplacements(commande, cwd="", reduire=True):
    """[(genre, sources, destination | None, dossier courant)] de ce qu'une commande a
    fait AUX FICHIERS sans toucher à leur contenu :

        ("mv", [a], b)   ("cp", [a], b)   ("rm", [a, …], None)   ("restaurer", [a, …], None)

    Un `mv` change le nom d'un fichier qu'on tient : sans lui l'ancien nom reste, périmé,
    et le nouveau n'existe que par ses lectures. Un `rm` qu'on ne voit pas laisse dans le
    projet remonté un fichier supprimé. `git restore` / `git checkout -- f` remet la
    version du dépôt, qu'on ne connaît pas : le fichier a changé, on ne sait pas comment.

    On ne prend que les formes simples : une source et une destination pour `mv`/`cp`
    (pas `-r`), des fichiers nommés pour `rm` (un `*` y est gardé tel quel : c'est
    `derouler_scripts` qui sait quels fichiers existent à cet instant)."""
    return [a for genre, a in actions(commande, cwd, reduire) if genre == "fichiers"]


def _deplacement(mots, ici):
    """Ce qu'UNE commande simple a fait aux fichiers (voir `deplacements`), ou None."""
    verbe = os.path.basename(mots[0]).lower().replace(".exe", "")
    if verbe in ("mv", "cp", "rm"):
        options = [m for m in mots[1:] if m.startswith("-") and m != "--"]
        noms = [m for m in mots[1:] if not m.startswith("-")]
        recursif = any(o.startswith("--recursive") or (not o.startswith("--") and ("r" in o or "R" in o))
                       for o in options)
        if verbe == "rm":
            return ("rm", noms, None, ici) if noms and not recursif else None
        return (verbe, [noms[0]], noms[1], ici) if len(noms) == 2 and not recursif else None
    if verbe == "git" and len(mots) > 2:
        if mots[1] == "restore" and ("--staged" not in mots and "-S" not in mots or "--worktree" in mots):
            noms = [m for m in mots[2:] if not m.startswith("-")]
        elif mots[1] == "checkout" and "--" in mots:
            noms = mots[mots.index("--") + 1:]
        else:
            noms = []
        return ("restaurer", noms, None, ici) if noms else None
    return None


def actions(commande, cwd="", reduire=True):
    """Tout ce qu'une commande de shell a fait aux fichiers hors des outils de fichiers,
    DANS L'ORDRE où elle l'a fait :

        ("script",   (langage, code, chemin, arguments, dossier, mode))    voir `executions`
        ("sed",      (arguments, fichiers, dossier))                        voir `editions_sed`
        ("fichiers", (genre, sources, destination, dossier))                voir `deplacements`
        ("ajout",    ((fichier, dossier), texte))                           `cat >> f` + heredoc cité

    ⚠ L'ordre compte. Mesuré le 02/10/2026, `Zones.lua` : une même commande SAUVE le
    fichier (`cp f f.bak`), y pose un défaut volontaire par un script, lance le harnais
    pour le voir rougir, puis RESTAURE (`mv f.bak f`). Rejouer ces actions par genre —
    les scripts ensemble, les copies ensemble — laissait le défaut dans le fichier.
    """
    out = []
    for mots, entree, ici, sortie in _commandes(commande, cwd, reduire):
        genre, action = _classer(mots, entree, ici, sortie)
        if genre in ("script", "sed", "fichiers", "ajout"):
            out.append((genre, action))
    return out


def _classer(mots, entree, ici, sortie):
    """(genre, action) d'UNE commande simple : les genres d'`actions`, "ecriture" pour un
    `cat > f` + heredoc cité (que `ecritures` rend de son côté), sinon ("autre", None)."""
    action = _execution(mots, entree, ici)
    if action:
        return "script", action
    action = _edition_sed(mots, ici)
    if action:
        return "sed", action
    action = _deplacement(mots, ici)
    if action:
        return "fichiers", action
    # Délimiteur CITÉ seulement : sans guillemets, le shell développe `$VAR` dans le texte.
    if mots == ["cat"] and entree is not None and entree[1] and sortie:
        return ("ajout" if sortie[0] == ">>" else "ecriture"), ((sortie[1], ici), entree[0] + "\n")
    return "autre", None


# Ce qui ne peut pas faire échouer un enchaînement (ou si rarement qu'on le verrait).
SANS_ECHEC = {"cd", "mkdir", "echo", "printf", "export", "true", ":", "pwd", "date", "sleep"}
# Un mot de structure du shell : ce qui suit ne se lance que sous condition, ou plusieurs fois.
MOTS_DE_STRUCTURE = {"if", "then", "else", "elif", "fi", "for", "while", "until", "do", "done", "case", "esac",
                     "{", "}", "function", "!", "exit", "return", "trap", "exec", "eval", "source", ".", "set"}


def actions_lancees(commande, cwd="", reduire=True, echoues=()):
    """Ce qu'une commande FINIE EN ERREUR a fait aux fichiers À COUP SÛR, dans l'ordre :
    [(genre, action, rang, décisif)] — les genres d'`actions`, plus "ecriture" ; `rang`
    est celui du script parmi les scripts d'`actions` (None pour le reste).

    ⚠ UNE COMMANDE EN ERREUR N'EST PAS UNE COMMANDE QUI N'A RIEN FAIT. Son code de sortie
    est celui de sa DERNIÈRE liste : `python - <<'PY' … PY` (réussi, le fichier est
    modifié) suivi de `node --check f && node f` (échec) rend 1. Mesuré le 02/10/2026 :
    171 commandes en erreur portaient une action sur des fichiers — 71 scripts sans
    trace d'échec, 81 fichiers écrits par heredoc puis lancés — et aucune n'était
    rejouée (`narvos-audit-packs.mjs` : une modification perdue, puis un doute).

    On suit l'enchaînement comme le shell : une liste (`;`, retour) repart de zéro ;
    après `&&` un segment ne tourne que si ce qui précède a réussi, après `||` que si
    cela a échoué. Réussite SÛRE : `cd`, `mkdir`, `echo`…, et une action qui n'est pas en
    échec ; `echoues` porte les rangs des scripts dont la sortie montre la trace. Le
    statut d'une commande inconnue (`grep -q`, un harnais) est inconnu : ce qui en
    dépend n'est PAS rendu.

    DÉCISIF : l'action dont le statut EST le code de sortie de la commande — le dernier
    segment s'il a tourné, ou la dernière action de la dernière liste quand tout y
    passe pour réussi (`python - <<'PY' … PY && echo ok` en erreur sans trace : c'est le
    script qui est sorti en échec, sans rien dire). Elle a échoué, quoi que dise
    l'absence de trace.

    Rien n'est rendu si la commande porte une structure qu'on ne suit pas (`if`, `for`,
    sous-shell, `set -e`…), ni si son échec reste sans explication."""
    segments = list(_segments(commande, cwd, reduire))
    if not segments or any(structure or (mots and mots[0] in MOTS_DE_STRUCTURE)
                           for _, mots, _, _, _, _, structure in segments):
        return []
    out, etat, rang, liste = [], "succes", -1, []
    for k, (lien, mots, entree, ici, sortie, etages, _) in enumerate(segments):
        if lien in (None, ";", "&"):
            lance, liste = True, []                      # une nouvelle liste repart de zéro
        elif lien == "&&":
            lance = {"succes": True, "echec": False}.get(etat)
        else:
            lance = {"succes": False, "echec": True}.get(etat)
        genre, action = _classer(mots, entree, ici, sortie) if mots else ("autre", None)
        if genre == "script":
            rang += 1
        if lance is None:
            etat = "inconnu"
            continue
        if lance is False:
            continue                                     # sauté : le statut de la liste ne change pas
        decisif = k == len(segments) - 1 and etages == 1
        if mots is not None and (not mots or mots[0] in SANS_ECHEC):
            etat = "succes"
        elif genre == "autre":
            etat = "inconnu"
        else:
            liste.append(len(out))
            out.append((genre, action, rang if genre == "script" else None, decisif))
            etat = "echec" if decisif or (genre == "script" and rang in echoues) else "succes"
    if etat == "succes":
        # Tout dans la dernière liste passe pour réussi, et la commande a échoué.
        if not liste:
            return []
        genre, action, r, _ = out[liste[-1]]
        out[liste[-1]] = (genre, action, r, True)
    return out


# ── Alignement ───────────────────────────────────────────────────────────────
def _numerotees(lignes, fichier, cwd, strict=False):
    """Lectures tirées de lignes qui portent leur numéro (None = ligne inconnue).

    `strict` : toute ligne connue DOIT être une ligne numérotée ou un séparateur de
    contexte (`--`) ; sinon la tranche n'est pas ce qu'on croit, et on rend None.
    """
    par = {}
    for l in lignes:
        if l is None:
            continue
        if fichier is None:
            m = LIGNE_GREP_MULTI.match(l)
            if m:
                par.setdefault(m.group(1), []).append((int(m.group(3)), m.group(4)))
            elif strict and l != "--":
                return None
            continue
        m = LIGNE_NUM.match(l) or LIGNE_GREP.match(l)
        if m:
            par.setdefault(fichier, []).append((int(m.group(1)), m.group(m.lastindex)))
        elif strict and l != "--":
            return None
    return [((f, cwd), frag, 0, None) for f, frag in par.items()]


def _maximum(e):
    """Le plus grand nombre de lignes qu'un émetteur peut rendre ; None s'il n'est pas borné."""
    if e[0] == "echo":
        return 1
    if e[0] == "opaque":
        return e[1]
    if e[0] == "pos":
        return None if e[4] is None else e[4] - e[3] + 1
    return e[3] if len(e) > 3 else None


def _est_numerotee(ligne, e):
    """Cette ligne a-t-elle la FORME de ce que rend l'émetteur numéroté `e` ?"""
    if ligne is None:
        return False
    if e[1] is None:
        return bool(LIGNE_GREP_MULTI.match(ligne))
    return bool(LIGNE_NUM.match(ligne) or LIGNE_GREP.match(ligne))


def _longueur_du_numerote(groupe, bornes, j, tranche):
    """Combien de lignes le producteur numéroté NON BORNÉ `groupe[j]` a-t-il rendues, entre
    des voisins qui, eux, se comptent ? None si ce n'est pas certain.

    Mesuré le 03/10/2026 (`inventaire.css`, 15/09 14:41) :

        sed -n 100,160p f; sed -n 190,216p f; sed -n 320,350p f; grep -n "x" a.toml b.toml

    Les trois `sed` se comptent (61 + 27 + 31), le `grep` non : toute la sortie était
    écartée, et avec elle la seule lecture de 20 lignes ajoutées ce jour-là. Or ses
    lignes se reconnaissent (`a.toml:12:…`). La coupe est certaine si :
      · les voisins rendent TOUT ce qu'ils peuvent (leurs maxima se retrouvent de part et
        d'autre) ;
      · entre eux, chaque ligne a la forme numérotée — et pour un seul fichier, des
        numéros qui ne reculent pas ;
      · la ligne qui précède le bloc et celle qui le suit ne l'ont PAS : un `sed` court
        (fichier plus petit que la plage) ou une sortie rognée auraient décalé la
        frontière, et une ligne numérotée se trouverait du mauvais côté.
    """
    avant, apres = sum(bornes[:j]), sum(bornes[j + 1:])
    m = len(tranche) - avant - apres
    if m < 0:
        return None
    e = groupe[j]
    bloc = tranche[avant:avant + m]
    if any(l != "--" and not _est_numerotee(l, e) for l in bloc):
        return None
    if avant and _est_numerotee(tranche[avant - 1], e):
        return None
    if apres and _est_numerotee(tranche[avant + m], e):
        return None
    if e[1] is not None:
        numeros = [int((LIGNE_NUM.match(l) or LIGNE_GREP.match(l)).group(1)) for l in bloc if l != "--"]
        if any(b < a for a, b in zip(numeros, numeros[1:])):
            return None
    return m


def lectures(commande, sortie, cwd=""):
    """[((fichier, cwd), [(n°, texte)], total, rogne)] — voir l'en-tête du module."""
    return aligner(analyser(commande, cwd), sortie)


def aligner(emetteurs, sortie, rognee=True, longue=SORTIE_LONGUE):
    """Répartit une sortie entre les émetteurs d'une commande (voir `analyser`).

    `rognee` : l'outil a rogné la sortie (début et fin). Faux pour un outil qui la rend
    telle quelle : les positions en tête de sortie sont alors sûres, et une plage
    courte prouve la fin du fichier même en fin de sortie.
    """
    sortie = (sortie or "").replace("\r\n", "\n")
    if TRONCATURE.search(sortie):
        return []
    lignes = sortie.split("\n")
    if lignes and lignes[-1] == "":
        lignes.pop()
    return aligner_lignes(emetteurs, lignes, rognee, len(sortie) > longue)


def aligner_lignes(emetteurs, lignes, rognee=True, longue=False):
    """Comme `aligner`, sur une liste de lignes où None tient la place d'une ligne
    INCONNUE — une sortie tronquée en son milieu dont on connaît le nombre total de
    lignes : ce qui précède la coupure se compte depuis le début, ce qui la suit depuis
    la fin.
    """
    if not lignes or not emetteurs or not any(e[0] in ("pos", "num") for e in emetteurs):
        return []
    if any(e[0] == "echo" and "\n" in e[1] for e in emetteurs):
        return []                                        # un `echo` de plusieurs lignes ne se compte pas
    n = len(lignes)

    def egal(i, texte):
        """La ligne i est-elle cet `echo` ? Aux bords, une sortie rognée a perdu ses blancs."""
        l = lignes[i]
        if l is None:
            return False
        if rognee and i == 0:
            return l == texte.lstrip() or l == texte.strip()
        if rognee and i == n - 1:
            return l == texte.rstrip()
        return l == texte

    def positions(e, tranche, premiere, total):
        _, fichier, c, a, _ = e
        frag = [(a + k, l) for k, l in enumerate(tranche) if l is not None]
        return (fichier, c), frag, total, (a if premiere and tranche[0] is not None else None)

    # 1. TOUT SE COMPTE : chaque émetteur a un maximum et la sortie les atteint tous.
    #    Aucun n'a donc été court, et rien n'a été rogné : la coupe est certaine, même
    #    sans séparateur, même à travers une zone inconnue.
    maxima = [_maximum(e) for e in emetteurs]
    if all(m is not None for m in maxima) and sum(maxima) == n:
        out, i = [], 0
        for e, m in zip(emetteurs, maxima):
            tranche = lignes[i:i + m]
            if e[0] == "echo":
                if lignes[i] is not None and not egal(i, e[1]):
                    return []
            elif e[0] == "opaque":
                pass                                     # compté, mais sans position : rien à en tirer
            elif e[0] == "num":
                lues = _numerotees(tranche, e[1], e[2], strict=True)
                if lues is None:
                    return []
                out.extend(lues)
            else:
                out.append(positions(e, tranche, rognee and i == 0, 0))
            i += m
        return [x for x in out if x[1]]

    echos = [e[1] for e in emetteurs if e[0] == "echo"]
    # Un `echo` vide ou blanc au bord de la sortie est mangé par le rognage.
    if rognee and emetteurs[0][0] == "echo" and not emetteurs[0][1].strip():
        return []
    if rognee and emetteurs[-1][0] == "echo" and not emetteurs[-1][1].strip():
        return []
    # Le texte d'un séparateur ne doit apparaître qu'autant de fois qu'il est émis.
    for texte in set(echos):
        if sum(1 for i in range(n) if egal(i, texte)) != echos.count(texte):
            return []

    # 2. PAR SÉPARATEURS : les producteurs situés entre deux `echo` consécutifs.
    #
    # Un émetteur INCONNU (un programme quelconque) emporte son groupe — ce qui n'est séparé
    # de lui par aucun `echo` —, pas la commande : le reste se borne toujours. Sa sortie
    # d'erreur ne déborde pas chez ses voisins : l'outil entrelace les deux sorties dans
    # l'ordre (vérifié le 03/10/2026 sur l'historique — `ls: cannot access …` précède le
    # `echo` qui suit, il n'est pas rejeté en fin de sortie).
    out, i, k = [], 0, 0
    while k < len(emetteurs):
        if emetteurs[k][0] == "echo":
            if i >= n or not egal(i, emetteurs[k][1]):
                return []
            i += 1
            k += 1
            continue
        groupe = []
        while k < len(emetteurs) and emetteurs[k][0] != "echo":
            groupe.append(emetteurs[k])
            k += 1
        if k < len(emetteurs):                           # borné par l'`echo` suivant
            fin = next((j for j in range(i, n) if egal(j, emetteurs[k][1])), None)
            if fin is None:
                return []
        else:
            fin = n
        tranche, premiere, derniere = lignes[i:fin], rognee and i == 0, rognee and fin == n
        i = fin
        if any(e[0] == "inconnu" for e in groupe):
            continue
        if len(groupe) > 1:
            # Plusieurs producteurs sans séparateur : seulement si TOUT se compte — ou si le
            # seul qui ne se compte pas se RECONNAÎT (voir `_longueur_du_numerote`).
            bornes = [_maximum(e) for e in groupe]
            libres = [r for r, b in enumerate(bornes) if b is None]
            if len(libres) == 1 and groupe[libres[0]][0] == "num":
                longueur = _longueur_du_numerote(groupe, bornes, libres[0], tranche)
                if longueur is None:
                    return []
                bornes[libres[0]] = longueur
            if any(b is None for b in bornes) or len(tranche) != sum(bornes):
                return []
            p = 0
            for rang, (e, b) in enumerate(zip(groupe, bornes)):
                if e[0] == "opaque":
                    pass
                elif e[0] == "num":
                    lues = _numerotees(tranche[p:p + b], e[1], e[2], strict=True)
                    if lues is None:
                        return []
                    out.extend(lues)
                else:
                    out.append(positions(e, tranche[p:p + b], premiere and rang == 0, 0))
                p += b
            continue
        e = groupe[0]
        if e[0] == "opaque":
            if len(tranche) > e[1]:
                return []
            continue
        if e[0] == "num":
            if len(e) > 3 and e[3] is not None and len(tranche) > e[3]:
                return []
            out.extend(_numerotees(tranche, e[1], e[2]))
            continue
        a, b = e[3], e[4]
        if not tranche:
            continue
        if b is not None and len(tranche) > b - a + 1:
            return []                                    # plus de lignes que la plage n'en rend
        plein = b is not None and len(tranche) == b - a + 1
        # En tête d'une sortie ROGNÉE, les lignes vides de début ont pu disparaître : une
        # plage incomplète qui ne commence pas à la ligne 1 n'a plus de position certaine.
        if premiere and not plein and a > 1:
            # Position FLOTTANTE : si les premières lignes de la plage étaient vides, le
            # rognage les a mangées et tout est décalé d'autant — de 0 à (plage − reçu)
            # rangs. On ne tranche pas ici : la lecture part avec sa marge, et c'est le
            # fichier tel qu'on le tient à cet instant qui la CALE (`Reconstitution.lire`),
            # ou la laisse tomber. Les groupes suivants, eux, sont bornés par leurs `echo`.
            if b is None or longue:
                return []
            frag = [(a + rang, l) for rang, l in enumerate(tranche) if l is not None]
            if frag:
                out.append(((e[1], e[2]), frag, 0, ("flottant", a, b - a + 1 - len(tranche))))
            continue
        total = 0
        if b is None:
            total = a + len(tranche) - 1                 # tout le fichier, jusqu'à sa fin
        elif not plein and not derniere:
            total = a + len(tranche) - 1                 # plage courte et bornée : fin du fichier
        if longue and not plein:
            return []
        out.append(positions(e, tranche, premiere, total))
    if i != n:
        return []
    return [x for x in out if x[1]]

