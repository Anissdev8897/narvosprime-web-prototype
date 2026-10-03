# -*- coding: utf-8 -*-
"""
bac.py — rejoue un script d'historique (Python ou Node) dans un BAC À SABLE, contre
l'état reconstitué des fichiers au moment où il a tourné.

POURQUOI (mesuré le 02/10/2026) : 967 commandes ont modifié des fichiers du projet par
un script — `python - <<'FIN' … s = s.replace(ancien, neuf) … FIN`, `node -e …` —
plutôt que par l'outil de modification. Aucun outil de fichiers ne les a vues : c'est
la première cause des « anciennes versions » et des fichiers complets mais périmés.
Le script, lui, est dans la transcription. Le relancer sur ce qu'on tient du fichier
redonne la modification EXACTE — et si l'on ne tient pas le passage qu'il cherche, il
échoue comme il aurait échoué, ce qui dit que le fichier a changé sans qu'on sache où.

RIEN DE RÉEL N'EST TOUCHÉ : le script tourne dans un processus séparé où `open`, `os`,
`pathlib`, `glob` (et `fs` pour Node) sont remplacés par un système de fichiers en
mémoire ; `subprocess`, le réseau, etc. sont inertes ou absents.

    executer(langage, code, args, cwd, fournir, connus, script=None)
        -> {"ok", "erreur", "ecrits": {clé: contenu | None}, "lus": [clés]}

`fournir(clé)` rend le contenu d'un fichier que le script ouvre (None s'il n'existe
pas) ; les clés sont "p:<relatif au projet>" ou "h:<absolu hors projet>", en minuscules.

LES LIGNES INCONNUES : un fichier troué est fourni avec, à la place de chaque ligne
jamais lue, une ligne-témoin (`temoin(n)`) qu'aucun script ne peut vouloir chercher.
Ce que le script écrit se relit avec `relire()` : les témoins redeviennent des trous,
à leur NOUVELLE place — la modification a décalé le fichier comme il faut.
"""
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

ICI = os.path.dirname(os.path.abspath(__file__))
RACINES = [r"d:\mes_projet\narvosprime-web-prototype", r"e:\narvosprime-web-prototype",
           r"e:\mes_projet\narvosprime-web-prototype"]
TEMOIN = re.compile(r"^\x00TROU(\d+)\x00$")
MODIF = re.compile(r"\x00MODIF(\d+)\x00\n?")       # marque d'une modification en attente (voir `executer`)
FIN_OUVERTE = "\x00FIN\x00"
ESSAIS = 60                    # relances qu'un script peut coûter
LOT = 600                      # fichiers d'un dossier donnés d'un coup
DELAI = 30                     # secondes par exécution


def temoin(n):
    return f"\x00TROU{n}\x00"


def texte_virtuel(carte, total):
    """Le fichier tel qu'on le donne au script : lignes connues, témoins ailleurs, et un
    témoin de fin si l'on ignore où il s'arrête. None si l'on n'en tient rien."""
    if not carte:
        return None
    fin = total or max(carte)
    lignes = [carte.get(i, temoin(i)) for i in range(1, fin + 1)]
    if total is None:
        lignes.append(FIN_OUVERTE)
    return "\n".join(lignes) + "\n"


def relire(contenu):
    """(lignes, fin connue) d'un contenu écrit par un script : None pour une ligne
    inconnue — un témoin intact, ou une ligne où le script a touché à un témoin."""
    lignes = contenu.replace("\r\n", "\n").split("\n")
    if len(lignes) > 1 and lignes[-1] == "":
        lignes.pop()
    fin_connue = True
    if lignes and FIN_OUVERTE in lignes[-1]:
        lignes.pop()
        fin_connue = False
    out = []
    for l in lignes:
        if "\x00" in l:
            if FIN_OUVERTE in l:
                fin_connue = False               # la fin ouverte a été déplacée : on ne sait plus rien après
                break
            out.append(None)
        else:
            out.append(l)
    return out, fin_connue


def _lancer(langage, travail):
    programme = ([sys.executable, "-X", "utf8", os.path.join(ICI, "bac_python.py")] if langage == "python"
                 else ["node", os.path.join(ICI, "bac_node.js")])
    try:
        r = subprocess.run(programme, input=json.dumps(travail).encode("utf-8"), capture_output=True,
                           timeout=DELAI, cwd=ICI)
    except subprocess.TimeoutExpired:
        return {"ok": False, "erreur": "délai dépassé", "manque": None, "ecrits": {}, "lus": []}
    try:
        return json.loads(r.stdout.decode("utf-8", "surrogatepass"))
    except Exception:
        return {"ok": False, "erreur": "bac muet : " + r.stderr.decode("utf-8", "replace")[-300:], "manque": None,
                "ecrits": {}, "lus": []}


SED = shutil.which("sed") or r"C:\Program Files\Git\usr\bin\sed.exe"


def rejouer_sed(arguments, contenu):
    """Le contenu d'un fichier après `sed -i <arguments>` — le VRAI sed, sur une copie
    dans un dossier temporaire — ou None s'il échoue. Les lignes-témoins traversent
    comme les autres : celles que les règles touchent redeviendront des trous."""
    if not os.path.exists(SED):
        return None
    dossier = tempfile.mkdtemp(prefix="narvos-sed-")
    try:
        fichier = os.path.join(dossier, "f.txt")
        with open(fichier, "wb") as f:
            f.write(contenu.encode("utf-8", "surrogatepass"))
        r = subprocess.run([SED] + list(arguments) + [fichier], capture_output=True, timeout=DELAI, cwd=dossier)
        if r.returncode != 0:
            return None
        with open(fichier, "rb") as f:
            return f.read().decode("utf-8", "replace").replace("\r\n", "\n")
    except (OSError, subprocess.TimeoutExpired):
        return None
    finally:
        shutil.rmtree(dossier, ignore_errors=True)


def _sans_marques(res):
    """Retire des fichiers écrits les marques des modifications en attente, et dit à quel
    fichier chacune appartient : res["attentes"] = {clé: [(ancien, neuf, partout)]}."""
    attente = res.get("attente") or []
    attentes = {}
    for cle, contenu in (res.get("ecrits") or {}).items():
        if not isinstance(contenu, str) or "\x00MODIF" not in contenu:
            continue
        rangs = [int(n) for n in MODIF.findall(contenu)]
        res["ecrits"][cle] = MODIF.sub("", contenu)
        siennes = [tuple(attente[n]) for n in dict.fromkeys(rangs) if n < len(attente)]
        if siennes:
            attentes[cle] = siennes
    res["attentes"] = attentes
    return res


def executer(langage, code, args, cwd, fournir, connus, script=None, mode="entree", indulgent=True, instant=None):
    """Lance le script ; chaque fichier qu'il ouvre et qu'on ne lui a pas encore donné
    l'arrête (`manque`) : on le fournit et on relance, depuis le début — un script
    d'historique est déterministe et, ici, sans effet.

    `instant` (secondes) : l'heure qu'il est POUR LE SCRIPT — celle de sa commande. Sans
    elle, un script qui date ce qu'il écrit (`genere_le: new Date().toISOString()`) y
    poserait l'heure du rejeu : une date d'après la perte dans un fichier d'avant, et
    une extraction qui ne rend pas deux fois la même chose.

    Un script qui balaie un dossier le ferait fichier par fichier : au troisième
    manque dans un même dossier, on lui donne d'un coup tout ce qu'on en connaît.

    L'INDULGENCE. La commande d'origine avait réussi. Si le script échoue ici après avoir
    cherché, dans un fichier TROUÉ, un passage qu'on ne tient pas (`assert ancre in s`),
    c'est que ce passage est dans un trou : on relance en imposant « présent » à la
    DERNIÈRE vérification incertaine d'avant l'échec — pas aux précédentes, qui sont
    souvent des gardes (« déjà fait ? ») auxquelles la vraie réponse était non. Le
    remplacement qui suit, impossible à placer, ressort en attente (res["attentes"]).
    Une relance n'est gardée que si elle FAIT quelque chose : un script retourné qui
    conclut « rien à faire » ne vaut pas mieux que l'échec, qui lui met le fichier en doute.
    ⚠ Tout cela suppose que le SCRIPT avait réussi, pas seulement sa commande : quand la
    sortie d'origine montre qu'il avait échoué, l'appelant passe `indulgent=False`.
    """
    fichiers, par_dossier, decisions, echec = {}, {}, [], None
    for _ in range(ESSAIS):
        res = _lancer(langage, {"code": code, "args": list(args or []), "cwd": cwd or "C:\\", "script": script,
                                "mode": mode, "racines": RACINES, "fichiers": fichiers, "connus": connus,
                                "decisions": decisions, "instant": instant})
        manque = res.get("manque")
        if manque:
            if manque in fichiers:
                break
            fichiers[manque] = fournir(manque)
            if manque.startswith("p:"):
                dossier = manque[2:].rpartition("\\")[0]
                par_dossier[dossier] = par_dossier.get(dossier, 0) + 1
                if par_dossier[dossier] == 3:
                    prefixe = dossier + "\\" if dossier else ""
                    for rel in [c for c in connus if c.lower().startswith(prefixe)][:LOT]:
                        fichiers.setdefault("p:" + rel.lower(), fournir("p:" + rel.lower()))
            continue
        res = _sans_marques(res)
        if not res.get("ok"):
            echec = echec or res                         # le premier échec : celui du script tel quel
            n = res.get("incertains") or 0
            # `indulgent=False` : on SAIT que le script avait échoué (sa sortie le dit) — il
            # n'y a aucune vérification à tenir pour passée.
            if indulgent and n and not (n <= len(decisions) and decisions[n - 1]):
                decisions = (decisions + [False] * n)[:n - 1] + [True]
                continue
            return echec
        if echec is not None and not res["attentes"] and all(
                fichiers.get(c) == v for c, v in (res.get("ecrits") or {}).items()):
            return echec                                 # retourné pour ne rien faire : l'échec dit plus
        return res
    return {"ok": False, "erreur": "trop de fichiers", "ecrits": {}, "lus": []}
