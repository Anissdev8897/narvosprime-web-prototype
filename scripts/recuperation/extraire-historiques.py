# -*- coding: utf-8 -*-
"""
extraire-historiques.py — reconstruit les fichiers du projet NARVOS à partir des
historiques d'agents, seuls endroits où le code survit au formatage du disque E:
(26/09/2026) :

  1. les transcriptions Claude Code   C:\\Users\\aniss\\.claude\\projects\\**\\*.jsonl
     — fils principaux ET sous-agents, tous dossiers de projet confondus ;
  2. la base Hermes                   C:\\Users\\aniss\\AppData\\Local\\hermes\\state.db
  3. les sorties de commandes des deux (recherches, sed -n) pour les fichiers connus.

Ce fichier ne fait que LIRE LES SOURCES et les traduire en événements. La
reconstruction elle-même — époques, décalages, alignement — vit dans
reconstitution.py, qui a ses tests (test_reconstitution.py).

CE QU'UN ÉVÉNEMENT DOIT ÊTRE POUR COMPTER
  · RÉUSSI : une écriture ou une modification que l'outil a refusée n'a rien changé
    sur le disque. On lit donc les RÉSULTATS d'outils, jamais les demandes seules.
  · D'AVANT LA PERTE : après, les outils ne voient plus que l'arbre reconstruit
    (voir PERTE).
  · UNIQUE : une session reprise recopie son historique (voir Dossier.ajouter).

  python extraire-historiques.py <sortie> [--ecrire] [--sans-hermes] [--dmde=<INDEX_DMDE.tsv>]

DEUX PASSAGES, DEUX USAGES
  · SANS `--dmde` : ce que les historiques savent SEULS. C'est ce passage qu'on mesure
    contre le disque (evaluer.py) — l'étalon ne doit pas être dans la copie.
  · AVEC `--dmde` : les fichiers sains rendus par DMDE entrent comme instantanés à
    leur date (indexer-dmde.py). C'est ce passage qui sert à remonter le projet.
"""
import collections
import fnmatch
import glob
import json
import ntpath
import os
import pickle
import re
import shutil
import sqlite3
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from reconstitution import Reconstitution, hunks_depuis_diff, hunks_depuis_structure  # noqa: E402
from commandes import lectures as lectures_commande, ecritures as ecritures_commande  # noqa: E402
from commandes import actions as actions_commande, actions_lancees  # noqa: E402
import bac  # noqa: E402
import codex  # noqa: E402

# Un script n'est rejoué que s'il ÉCRIT : la plupart ne font que lire et afficher.
ECRITURE_SCRIPT = re.compile(r"writeFileSync|appendFileSync|\.write\(|\.writelines\(|write_text|write_bytes|"
                             r"renameSync|unlinkSync|os\.remove|os\.rename|os\.replace|shutil\.")

# Le Bash de Claude Code réduisait-il les paires d'antislashs (`\\` -> `\`) avant la perte ?
# OUI — et il faut le savoir pour ne pas se tromper de conclusion. Rejoués des deux
# façons, 9 scripts en ligne (27/07 → 13/09) ne RÉUSSISSENT que bruts : on en déduirait
# que le shell ne réduisait pas. C'est l'inverse : ces 9 scripts avaient ÉCHOUÉ pour de
# vrai (leur sortie porte un `Traceback … AssertionError`), précisément parce que la
# réduction avait changé leur ancre — et l'agent écrivait ensuite « bash mange les
# antislashs des heredocs : on les fabrique (chr(92)) ». La commande, elle, n'était pas
# en erreur : ce qui suivait le script avait réussi. Voir `echecs_reels`.
REDUIRE_CLAUDE = True

# ── Ce qu'un script a fait POUR DE VRAI, lu dans la sortie de sa commande ────
CADRE_PYTHON = re.compile(r'^\s+File "([^"]+)", line (\d+), in (\S+)')
ENTETE_NODE = re.compile(r"^(\[stdin\]|\[eval\d*\]|file:///\S+?|[A-Za-z]:[\\/]\S+?|/\S+?):(\d+)$")
CADRE_NODE = re.compile(r"^\s+at .*?(\[stdin\]|\[eval\d*\]|file:///[^\s():]+|[A-Za-z]:[\\/][^\s():]+):(\d+):\d+\)?$")
SORTIE_GARDEE = 6000         # caractères de sortie gardés avec chaque script (début et fin)
ARRET_FORCE = "ARRET_FORCE_NARVOS"


def _origine(nom):
    """D'où vient le code d'un cadre de pile : "entree", "arg", ou le nom du fichier."""
    if nom in ("<stdin>", "[stdin]"):
        return "entree"
    if nom == "<string>" or nom.startswith("[eval"):
        return "arg"
    return ntpath.basename(nom.replace("/", "\\")).lower()


def traces(sortie):
    """Les échecs de scripts qu'une sortie de commande raconte, dans l'ordre :
    [(langage, origine, ligne)] — `ligne` est celle de l'instruction de premier niveau
    qui a échoué (ou None).

    Python : `Traceback (most recent call last):` puis ses cadres `File "<stdin>", line
    54, in <module>`. Node : l'en-tête `[stdin]:16`, la pile, et la ligne `Node.js v…`
    qui clôt une exception non rattrapée."""
    out, lignes = [], sortie.split("\n")
    i = 0
    while i < len(lignes):
        l = lignes[i].rstrip("\r")
        if l.startswith("Traceback (most recent call last):"):
            cadres, i = [], i + 1
            while i < len(lignes) and (lignes[i].startswith((" ", "\t")) or not lignes[i].strip()):
                m = CADRE_PYTHON.match(lignes[i])
                if m:
                    cadres.append((m.group(1), int(m.group(2)), m.group(3)))
                i += 1
            if cadres:
                module = next((c for c in cadres if c[2] == "<module>"), cadres[0])
                out.append(("python", _origine(cadres[0][0]), module[1]))
            continue
        m = ENTETE_NODE.match(l)
        if m:
            # L'exception de Node : en-tête, extrait de code, message, pile, puis « Node.js v… ».
            fin = next((j for j in range(i + 1, min(i + 60, len(lignes))) if lignes[j].startswith("Node.js v")), None)
            if fin is not None:
                origine, ligne = m.group(1), int(m.group(2))
                for j in range(i + 1, fin):
                    c = CADRE_NODE.match(lignes[j].rstrip("\r"))
                    if c and c.group(1) == origine:
                        ligne = int(c.group(2))            # le cadre le plus EXTÉRIEUR du script
                out.append(("node", _origine(origine), ligne))
                i = fin + 1
                continue
        i += 1
    return out


def echecs_reels(sortie, scripts):
    """Pour les scripts d'UNE commande — [(langage, mode, chemin ou None)], dans l'ordre —,
    dit ce que chacun a fait quand elle a tourné : [(état, ligne)], état valant True (il
    a échoué), False (il a réussi) ou None (pas de sortie : on ne sait pas), et `ligne`
    celle où il s'est arrêté.

    ⚠ UNE COMMANDE « RÉUSSIE » PEUT PORTER UN SCRIPT QUI A ÉCHOUÉ. `python - <<'PY' … PY`
    suivi de `node --check x && node x` : le script lève une AssertionError, la suite
    réussit, et la commande n'est pas en erreur. Rejouer ce script comme s'il avait
    réussi, c'est soit refaire ce qu'il n'a pas fait, soit — s'il échoue ici aussi —
    mettre en doute un fichier qu'il n'a jamais touché (mesuré le 02/10/2026 :
    `narvos-ateliers-to-lua.mjs`, un générateur complet rendu « ancienne version »).

    Chaque trace est rendue au script d'où elle vient : `<stdin>` à celui qui lisait
    son entrée, `<string>` / `[eval]` à celui passé en argument, un nom de fichier au
    script de ce nom. Une trace que rien ne réclame (`node --check x.mjs`) n'accuse
    personne."""
    if not isinstance(sortie, str):
        return [(None, None)] * len(scripts)
    libres = traces(sortie)
    out = []
    for langage, mode, chemin in scripts:
        origine = mode if mode in ("entree", "arg") else ntpath.basename((chemin or "").replace("/", "\\")).lower()
        k = next((i for i, t in enumerate(libres) if t[0] == langage and t[1] == origine), None)
        if k is None:
            out.append((False, None))
        else:
            out.append((True, libres.pop(k)[2]))
    return out


def arret_force(langage, code, ligne):
    """Le script, arrêté AVANT l'instruction où il s'était arrêté pour de vrai — ou None
    si l'on ne sait pas l'y arrêter proprement.

    Sert quand le script RÉUSSIT dans le bac alors qu'il avait échoué : ce qu'il a écrit
    avant de tomber est réel, ce qui suit ne l'est pas (mesuré le 02/10/2026 : un script
    Node réécrit `interface.js`, puis lève « DessinerRadar introuvable » sur
    `ateliers.js` — n'en rien garder perdait la première écriture, tout garder
    inventait les deux suivantes)."""
    lignes = code.split("\n")
    if not ligne or ligne > len(lignes):
        return None
    if langage == "python":
        import ast
        try:
            arbre = ast.parse(code)
        except SyntaxError:
            return None
        # L'instruction la plus INTÉRIEURE qui contient la ligne : c'est elle qui tournait.
        cible = None
        for n in ast.walk(arbre):
            if isinstance(n, ast.stmt) and n.lineno <= ligne <= (n.end_lineno or n.lineno):
                if cible is None or n.lineno >= cible.lineno:
                    cible = n
        if cible is None:
            return None
        retrait = lignes[cible.lineno - 1][:cible.col_offset]
        if retrait.strip():
            return None                                  # l'instruction ne commence pas sa ligne (`a; b`)
        return "\n".join(lignes[:cible.lineno - 1] + [retrait + f"raise SystemExit({ARRET_FORCE!r})"]
                         + lignes[cible.lineno - 1:])
    # Node : l'arrêt se pose en tête de la ligne, si elle commence bien une instruction.
    precedente = next((l.strip() for l in reversed(lignes[:ligne - 1]) if l.strip()), "")
    if precedente and not precedente.endswith((";", "{", "}")) and not precedente.startswith("//"):
        return None
    lignes[ligne - 1] = f"throw new Error({ARRET_FORCE!r}); " + lignes[ligne - 1]
    return "\n".join(lignes)

def _lignes_parlantes(texte):
    return [l.strip() for l in texte.split("\n") if len(l.strip()) >= 4 and "\x00" not in l]


def litteral(contenu, code):
    """Le texte qu'un script a écrit est-il ÉCRIT DANS le script (plus de la moitié de ses
    lignes s'y lisent telles quelles) ? Un tel fichier ne doit rien à ce que le script a
    lu : on peut le poser même si le script, par ailleurs, a regardé à l'aveugle."""
    lignes = _lignes_parlantes(contenu)
    if not lignes:
        return True                                      # rien qui puisse être inventé
    if not code:
        return False
    return sum(1 for l in lignes if l in code) >= 0.6 * len(lignes)


def peu_semblable(avant, apres):
    """Un fichier relu puis réécrit est-il encore LUI-MÊME (modifié en place) ou un autre
    (régénéré) ? Moins de la moitié des lignes écrites se lisaient dans l'ancien : régénéré."""
    if avant is None:
        return True
    lignes = _lignes_parlantes(apres)
    if not lignes:
        return False
    anciennes = set(_lignes_parlantes(avant))
    return sum(1 for l in lignes if l in anciennes) < 0.5 * len(lignes)


# Un échec qui vient du BAC (ce qu'il ne sait pas fournir ou exécuter), pas du script :
# il ne dit rien de l'état du fichier (voir `derouler_scripts`).
PANNE_DU_BAC = re.compile(
    r"^(manque|trop de fichiers|délai dépassé|bac muet|ModuleNotFoundError|ImportError|SyntaxError|IndentationError"
    r"|NameError|ReferenceError|FileNotFoundError|NotADirectoryError|PermissionError|UnicodeDecodeError"
    r"|UnicodeEncodeError|NotImplementedError|RecursionError)|module absent du bac|ENOENT")

PROJETS = r"C:\Users\aniss\.claude\projects"
HERMES_DB = r"C:\Users\aniss\AppData\Local\hermes\state.db"

# Emplacements successifs du projet (D: jusqu'au 19/09, E: ensuite).
RACINES = [
    r"d:\mes_projet\narvosprime-web-prototype",
    r"e:\narvosprime-web-prototype",
    r"e:\mes_projet\narvosprime-web-prototype",
]
EXCLUS = ("\\node_modules\\", "\\.venv\\", "\\__pycache__\\", "\\dist\\", "\\.vite\\",
          "\\deriveddatacache\\", "\\intermediate\\", "\\saved\\", "\\binaries\\", "\\.git\\")
EXT = r"(?:lua|mjs|cjs|js|ts|tsx|css|html|md|toml|json|py|txt|cpp|h|ini|sh|ps1|yaml|yml)"
LONGUEUR_SUSPECTE = 480      # au-delà, l'outil de recherche a pu tronquer la ligne
LIMITE_LECTURE = 2000        # lignes rendues par défaut par l'outil de lecture de Claude Code
LARGEUR_LECTURE = 2000       # au-delà, ce même outil tronque la ligne À L'AFFICHAGE

# ⚠ LA COUPURE. Le disque a été formaté le 26/09/2026 vers 20 h 46 (heure locale,
# 18 h 46 UTC) ; le dernier événement d'avant la perte est à 11:52:37Z. Tout ce qui
# vient APRÈS ne parle plus du projet d'origine mais de l'arbre RECONSTRUIT : relire
# un fichier troué ou recousu en ferait « la version la plus récente », et la
# reconstruction s'empoisonnerait elle-même à chaque passage. Ces événements sont
# donc écartés (et comptés dans le journal).
PERTE = datetime(2026, 9, 26, 18, 0, 0, tzinfo=timezone.utc).timestamp()


def relatif(chemin):
    """(clé en minuscules, chemin relatif en casse d'origine), ou (None, None)."""
    if not isinstance(chemin, str) or not chemin:
        return None, None
    brut = chemin.strip().replace("/", "\\")
    m = re.match(r"^\\([a-zA-Z])\\(.*)$", brut)      # chemins MSYS : \e\... -> e:\...
    if m:
        brut = m.group(1) + ":\\" + m.group(2)
    bas = brut.lower()
    for r in RACINES:
        if bas.startswith(r + "\\"):
            rel = bas[len(r) + 1:]
            if any(x in "\\" + rel for x in EXCLUS):
                return None, None
            return rel, brut[len(r) + 1:]
    return None, None


def secondes(t):
    if isinstance(t, (int, float)):
        return float(t)
    if not isinstance(t, str) or not t:
        return 0.0
    try:
        return datetime.fromisoformat(t.replace("Z", "+00:00")).timestamp()
    except Exception:
        return 0.0


def iso(s):
    return datetime.fromtimestamp(s, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ") if s else ""


def marque_pour(nom):
    """Un marqueur doit être un COMMENTAIRE du langage du fichier : `--` casse un .js."""
    ext = os.path.splitext(nom)[1].lower()
    if ext == ".lua":
        return lambda s: "-- " + s
    if ext in (".js", ".mjs", ".cjs", ".ts", ".tsx", ".cpp", ".h", ".hpp", ".c", ".cs", ".glsl"):
        return lambda s: "// " + s
    if ext in (".py", ".sh", ".toml", ".ps1", ".yaml", ".yml", ".ini"):
        return lambda s: "# " + s
    if ext == ".css":
        return lambda s: "/* " + s + " */"
    if ext in (".html", ".md", ".xml", ".svg"):
        return lambda s: "<!-- " + s + " -->"
    return lambda s: s


def empreinte(genre, charge):
    """Ce qui fait qu'un événement est LE MÊME qu'un autre survenu au même instant."""
    if genre in ("supprimer", "douter"):
        return 0
    if genre == "poser":
        return hash((tuple(charge[0]), charge[1]))
    if genre == "ecrire":
        return hash(charge)
    if genre == "lire":
        return hash((tuple(charge[0]), charge[1]))
    return hash((charge["ancien"], charge["neuf"], charge["tout"],
                 tuple((h.avant, h.n_avant, h.apres, h.n_apres) for h in charge["hunks"])))


class Dossier:
    """Tous les fichiers vus, et leurs événements en attente de rejeu."""

    def __init__(self):
        self.evts = {}       # clé -> [(instant, rang, genre, charge, source)]
        self.noms = {}       # clé -> chemin relatif en casse d'origine
        self.vus = set()     # signatures des événements déjà pris (voir `ajouter`)
        self.rang = 0
        self.apres_perte = 0  # événements écartés parce que postérieurs à PERTE
        self.scripts = []    # scripts exécutés : (instant, rang, langage, code, chemin, arguments, cwd, source, mode, réel, sortie)
        self.hors = {}       # fichiers HORS projet écrits par un outil : chemin absolu -> [(instant, rang, contenu)]
        self.echecs = []     # scripts que le bac n'a pas su rejouer : (instant, source, langage, erreur, lus, code)
        # (départ, résultat) des commandes qui ÉCRIVENT : elles sont datées de leur résultat,
        # mais ce qu'elles écrivent l'est AVANT — voir `scanner_dmde`.
        self.fenetres = []

    def connu(self, cle):
        return cle in self.evts

    def ajouter_script(self, ts, langage, code, chemin, args, cwd, source, mode="entree", reel=None, sortie=""):
        """Un script Python ou Node qu'une commande a exécuté (voir `derouler_scripts`).
        `mode` dit d'où venait le code : "entree" (heredoc), "arg" (-c / -e), "fichier" ;
        `reel` ce que la sortie de la commande dit de lui (True : il avait échoué ; False :
        réussi ; None : on ne sait pas — voir `echecs_reels`) ; `sortie`, un extrait de
        cette sortie."""
        if ts > PERTE:
            return False
        signature = ("script", ts, hash((langage, code, chemin, json.dumps(args or []))))
        if signature in self.vus:
            return False
        self.vus.add(signature)
        self.rang += 1
        self.scripts.append((ts, self.rang, langage, code, chemin, list(args or []), cwd, source, mode, reel,
                             sortie))
        return True

    def ajouter_hors(self, chemin, ts, contenu):
        """Un fichier écrit HORS du projet (un script dans un dossier de brouillon, que
        la commande suivante lance)."""
        absolu = absolu_windows(chemin)
        if not absolu or ts > PERTE or not isinstance(contenu, str) or len(contenu) > 400000:
            return False
        self.rang += 1
        self.hors.setdefault(absolu.lower(), []).append((ts, self.rang, contenu))
        return True

    def ajouter(self, chemin, ts, genre, charge, source, creer=True):
        cle, orig = relatif(chemin)
        if not cle or (not creer and cle not in self.evts):
            return False
        if ts > PERTE:
            self.apres_perte += 1
            return False
        # ⚠ UN ÉVÉNEMENT N'EST REJOUÉ QU'UNE FOIS. Une session reprise ou compactée
        # recopie son historique dans un nouveau fichier : chaque opération y figure
        # deux fois. Rejouer deux fois une modification qui change la longueur du
        # fichier décale tout ce qui suit (mesuré : HumanCharacter.tsx, 219 lignes
        # au lieu de 509).
        signature = (cle, ts, genre, empreinte(genre, charge))
        if signature in self.vus:
            return False
        self.vus.add(signature)
        self.rang += 1
        self.evts.setdefault(cle, []).append((ts, self.rang, genre, charge, source))
        self.noms[cle] = orig
        return True

    def cle_connue(self, chemin, bases, toutes=False):
        """La clé d'un fichier DÉJÀ CONNU que désigne ce chemin.

        `bases` : les dossiers contre lesquels un chemin relatif peut se lire, le plus sûr
        d'abord. Pour une commande de shell, seul le PREMIER dossier absolu compte (celui où
        elle tournait, `cd` compris) ; `toutes=True` (recherches : la racine fouillée, puis
        le dossier de la session) les essaie tous — aucun n'est un repli à l'aveugle.

        ⚠ UN DOSSIER COURANT CONNU FAIT FOI. Les transcriptions de TOUS les projets de la
        machine sont lues ; un `grep -n … .env.example` lancé dans
        `C:/…/goldluxuryking-shop/server` nomme le `.env.example` de CE projet-là. La
        première version essayait ensuite la racine de NARVOS « au cas où » : la lecture
        d'un fichier étranger devenait une nouvelle époque du nôtre (mesuré le 03/10/2026 —
        notre `.env.example` de 50 lignes rendu avec 88 lignes dont 72 trous). Le repli sur
        les racines ne vaut que si l'on ignore où la commande a tourné.
        """
        def absolu(x):
            return bool(re.match(r"^[A-Za-z]:[\\/]", x or ""))

        p = chemin_msys(chemin)
        if not p:
            return None
        ancres = [chemin_msys(b) for b in bases if b]
        if absolu(p):
            candidats = [p]
        elif any(absolu(b) for b in ancres):
            sures = [b for b in ancres if absolu(b)]
            candidats = [os.path.join(b, p) for b in (sures if toutes else sures[:1])]
        else:
            # Dossier courant inconnu, ou relatif (`cd WebPortal` depuis on ne sait où) : on
            # l'essaie sous chaque racine du projet, puis le chemin seul.
            candidats = [os.path.join(r, b, p) for b in ancres for r in RACINES]
            candidats += [os.path.join(r, p) for r in RACINES]
        for c in candidats:
            cle, _ = relatif(c)
            if cle and cle in self.evts:
                return c
        return None


def chemin_msys(p):
    m = re.match(r"^/([a-zA-Z])/(.*)$", p or "")
    return (m.group(1) + ":\\" + m.group(2).replace("/", "\\")) if m else p


def absolu_windows(chemin, cwd=None):
    """Chemin absolu Windows (antislashs, casse gardée) d'un chemin tel qu'un outil ou un
    script le nomme — MSYS (`/d/x`), barres obliques, relatif à `cwd` — ou None."""
    if not isinstance(chemin, str) or not chemin.strip():
        return None
    p = chemin_msys(chemin.strip()).replace("/", "\\")
    if p.startswith("~"):
        p = r"C:\Users\aniss" + p[1:]
    if not re.match(r"^[A-Za-z]:\\", p):
        base = absolu_windows(cwd) if cwd else None
        if not base:
            return None
        p = base.rstrip("\\") + "\\" + p
    return ntpath.normpath(p)


def chemin_resolu(chemin, bases):
    """Le chemin absolu d'un fichier que la commande a CRÉÉ (il n'est pas encore connu)."""
    p = chemin_msys(chemin)
    if not p or p.startswith("~"):
        return None
    if re.match(r"^[A-Za-z]:[\\/]", p):
        return p
    base = next((chemin_msys(b) for b in bases if b), None)
    return os.path.normpath(os.path.join(base, p)) if base else None


# Un fichier né d'un heredoc n'entre dans la reconstruction que s'il est connu par
# ailleurs, ou s'il a l'air DURABLE : dans un dossier de code, et pas un brouillon
# (`_sonde.py`, `_tmp-x.mjs` : des centaines, jetés aussitôt lancés).
DOSSIERS_DURABLES = ("scripts\\", "webportal\\", ".hermes\\", ".claude\\", "docs\\")


def durable(cle):
    nom = cle.rsplit("\\", 1)[-1]
    return cle.startswith(DOSSIERS_DURABLES) and not nom.startswith("_") and "tmp" not in nom


def extrait(sortie):
    """Le début et la fin d'une sortie de commande : de quoi y retrouver un message."""
    if not isinstance(sortie, str):
        return ""
    return sortie if len(sortie) <= SORTIE_GARDEE else sortie[:SORTIE_GARDEE // 2] + "\n…\n" + sortie[-SORTIE_GARDEE // 2:]


def actions_de_shell(dossier, ts, commande, cwd, source, reduire, sortie=None, en_erreur=False, ecrits=None):
    """Verse au dossier ce qu'une commande de shell (bash) a fait aux fichiers hors des
    outils de fichiers ; rend le nombre d'actions retenues. Elles seront rejouées contre
    l'état des fichiers à cet instant (`derouler_scripts`).

    L'ORDRE est celui de la commande (`commandes.actions`) : `cp f f.bak ; python … ;
    mv f.bak f` sauve, modifie, puis restaure — rejoué autrement, le fichier garderait
    la modification.

    `en_erreur` : la commande a tourné mais fini sur un code de sortie non nul. On n'en
    garde que ce qui a été lancé À COUP SÛR (`commandes.actions_lancees`) ; l'action qui
    DÉCIDE du code de sortie a échoué — un script y est tenu pour tel même sans trace,
    le reste (`sed`, `mv`…) n'est pas rejoué. Les fichiers écrits par heredoc dans une
    telle commande vont dans `ecrits`, comme ceux d'une commande réussie."""
    n = 0
    toutes = actions_commande(commande, cwd, reduire)
    # Ce que la SORTIE dit de chaque script : a-t-il échoué quand la commande a tourné ?
    scripts = [a for g, a in toutes if g == "script"]
    etats = echecs_reels(sortie, [(a[0], a[5], a[2]) for a in scripts])
    court = extrait(sortie)
    if en_erreur:
        suite = []
        for genre, action, rang, decisif in actions_lancees(commande, cwd, reduire,
                                                            {k for k, e in enumerate(etats) if e[0]}):
            if genre == "script":
                suite.append((genre, action, (True, None) if decisif and not etats[rang][0] else etats[rang]))
            elif not decisif:
                suite.append((genre, action, None))
    else:
        reels = dict(zip(map(id, scripts), etats))
        suite = [(genre, action, reels.get(id(action))) for genre, action in toutes]
    for genre, action, reel in suite:
        if genre == "script":
            langage, code, script, args, cwd_s, mode = action
            if code is None or ECRITURE_SCRIPT.search(code):
                n += dossier.ajouter_script(ts, langage, code, script, args, cwd_s, source, mode, reel, court)
        elif genre == "ecriture":
            (chemin, cwd_e), contenu = action
            if ecrits is not None:
                ecrits.append((ts, chemin, [cwd_e], contenu, None, None, source.replace("-script", "-heredoc")))
                n += 1
        elif genre == "sed":
            regles, cibles, cwd_s = action
            n += dossier.ajouter_script(ts, "sed", None, None, [regles, cibles], cwd_s, source)
        elif genre == "fichiers":
            nature, sources, dest, cwd_d = action
            n += dossier.ajouter_script(ts, "fichiers", None, None, [nature, sources, dest], cwd_d, source)
        elif genre == "ajout":
            (chemin, cwd_a), contenu = action
            n += dossier.ajouter_script(ts, "ajout", None, None, [contenu, chemin], cwd_a, source)
    return n


SORTIE_EN_ERREUR = re.compile(r"^(?:Error: )?Exit code (\d+)(?:\n|$)")
# Codes d'une commande qui est allée AU BOUT : 1 à 123, 126 et 127 (sa dernière commande
# simple était introuvable — un mot parasite en fin de ligne, le reste a tourné). 124 est
# un délai dépassé, au-delà de 128 un signal : arrêtée on ne sait où.
CODES_D_ECHEC = frozenset(range(1, 124)) | {126, 127}
# Ce qui, dans la sortie, interdit de croire l'enchaînement : un `cd` raté ou un
# interpréteur introuvable (ce qui suit n'a pas tourné comme on le pense), une erreur de
# syntaxe du shell, un `mv`, `cp`, `rm`, `sed`, `mkdir` ou `cat` qui se plaint (l'action
# qu'on tiendrait pour faite ne l'est pas).
PLAINTE_DU_SHELL = re.compile(
    r"^(?:/usr/bin/)?(?:bash|sh)(?:\.exe)?: (?:-c: )?(?:line \d+: )?"
    r"(?:(?:cd|pushd|popd|python3?|py|node)(?:\.exe)?: |syntax error|unexpected )"
    r"|^(?:/usr/bin/)?(?:mv|cp|rm|sed|mkdir|cat|cd)(?:\.exe)?: ", re.M)


def commande_en_erreur(dossier, ts, commande, cwd, source, reduire, sortie, ecrits):
    """Une commande de shell FINIE EN ERREUR : verse ce qu'elle avait fait aux fichiers
    avant d'échouer, rend le nombre d'actions retenues.

    Trois résultats se disent « en erreur » : la commande refusée (« The user doesn't
    want to proceed… », un hook, une permission) qui n'a pas tourné ; celle qui a dépassé
    son délai, arrêtée on ne sait où ; et celle qui a TOURNÉ et rendu un code non nul —
    « Exit code 1 » en tête de sa sortie. Seule la troisième est reprise, et seulement
    si rien dans sa sortie ne montre le shell lui-même en défaut."""
    m = SORTIE_EN_ERREUR.match(sortie) if isinstance(sortie, str) else None
    if not m or int(m.group(1)) not in CODES_D_ECHEC:
        return 0
    corps = sortie[m.end():]
    if PLAINTE_DU_SHELL.search(corps) or "<persisted-output>" in corps:
        return 0                                         # shell en défaut, ou sortie versée ailleurs : traces invisibles
    return actions_de_shell(dossier, ts, commande, cwd, source, reduire, corps, en_erreur=True, ecrits=ecrits)


# ── Sorties de commandes ─────────────────────────────────────────────────────
LIGNE_GREP_MULTI =re.compile(r"^(.+?\." + EXT + r")([:-])(\d+)\2(.*)$")
LIGNE_GREP_SEUL = re.compile(r"^(\d+)([:-])(.*)$")
CWD_REMIS = re.compile(r"\n?Shell cwd was reset to [^\n]*$")


def fragments_grep(contenu, base, base_est_fichier):
    """[(chemin, n°, texte)] tirés d'une recherche de Claude Code.

    ⚠ SOUS WINDOWS, L'OUTIL NORMALISE CHAQUE LIGNE RENDUE COMME UN CHEMIN : `/` devient
    `\\`, et `//` un seul `\\`. Mesuré le 01/10/2026 : `// Utilisation future :` est
    enregistré `\\ Utilisation future :`. Reprise telle quelle, une ligne
    `Package.Require("Catalogs/X.lua")` deviendrait `"Catalogs\\X.lua"` — du code
    faux qui compile. Toute ligne portant un antislash est donc ÉCARTÉE : on ne peut
    pas savoir s'il était là ou s'il remplace une barre oblique.
    """
    out = []
    for l in contenu.split("\n"):
        if not l or l == "--" or len(l) > LONGUEUR_SUSPECTE or "[Omitted" in l:
            continue
        if base_est_fichier:
            m = LIGNE_GREP_SEUL.match(l)
            if m and "\\" not in m.group(3) and "/" not in m.group(3):
                out.append((base, int(m.group(1)), m.group(3)))
            continue
        m = LIGNE_GREP_MULTI.match(l)
        if m and "\\" not in m.group(4) and "/" not in m.group(4):
            out.append((m.group(1), int(m.group(3)), m.group(4)))
    return out


# ── Source 1 : Claude Code ───────────────────────────────────────────────────
LIGNE_AFFICHEE = re.compile(r"^ *(\d+)(?:\t|→)(.*)$")


def transcriptions():
    """Toutes les transcriptions Claude Code, sous-agents compris.

    ⚠ `*.jsonl` à la racine d'un dossier de projet NE SUFFIT PAS : chaque session
    range ses sous-agents dans `<session>/subagents/**/agent-*.jsonl`. Mesuré le
    01/10/2026 : 744 fichiers jamais lus, où dormaient 860 lectures et 60 écritures
    ou modifications de fichiers du projet. On lit aussi les dossiers des AUTRES
    projets : un événement n'est retenu que si son chemin tombe sous une racine du
    projet (voir `relatif`), d'où qu'il vienne.
    """
    return sorted(glob.glob(os.path.join(PROJETS, "**", "*.jsonl"), recursive=True))


def texte_resultat(bloc):
    c = bloc.get("content")
    if isinstance(c, str):
        return c
    if isinstance(c, list):
        return "".join(x.get("text", "") for x in c if isinstance(x, dict) and x.get("type") == "text")
    return ""


def fragment_affiche(texte):
    """([(n°, texte)], nombre de lignes numérotées) d'une lecture telle que l'outil l'AFFICHE.

    Un sous-agent n'enregistre pas le résultat brut de ses outils : il ne reste que le
    texte rendu au modèle, `N<tab>ligne` (ou `N→ligne` dans les anciennes versions).
    Les lignes s'y suivent sans saut ; ce qui vient après (rappels système) ne porte
    pas de numéro. ⚠ Une ligne de plus de 2 000 caractères y est TRONQUÉE : elle est
    comptée mais pas reprise — mieux vaut un trou qu'une ligne coupée.
    """
    frag, vues, attendu = [], 0, None
    for l in texte.split("\n"):
        m = LIGNE_AFFICHEE.match(l)
        if not m:
            if vues:
                break
            continue
        n = int(m.group(1))
        if attendu is not None and n != attendu:
            break
        attendu = n + 1
        vues += 1
        if len(m.group(2)) < LARGEUR_LECTURE:
            frag.append((n, m.group(2)))
    return frag, vues


def operation_affichee(dossier, outil, entree, texte, ts):
    """Une opération de SOUS-AGENT, connue par sa demande et par le texte rendu."""
    chemin = entree.get("file_path")
    if outil == "Read":
        frag, vues = fragment_affiche(texte)
        if not frag:
            return False
        try:
            limite = int(entree.get("limit") or LIMITE_LECTURE)
        except (TypeError, ValueError):
            limite = LIMITE_LECTURE
        # Moins de lignes que demandé : la lecture a atteint la FIN du fichier.
        total = frag[-1][0] if vues < limite else 0
        return dossier.ajouter(chemin, ts, "lire", (frag, total), "claude-agent")
    if outil == "Write":
        if isinstance(entree.get("content"), str) and ("successfully" in texte or "has been updated" in texte):
            if relatif(chemin)[0] is None:
                dossier.ajouter_hors(chemin, ts, entree["content"])
                return False
            return dossier.ajouter(chemin, ts, "ecrire", entree["content"], "claude-agent")
        return False
    if outil == "Edit":
        if isinstance(entree.get("old_string"), str) and "has been updated" in texte:
            charge = {"original": None, "hunks": [], "ancien": entree["old_string"],
                      "neuf": entree.get("new_string") or "", "tout": bool(entree.get("replace_all"))}
            return dossier.ajouter(chemin, ts, "modifier", charge, "claude-agent")
    return False


def operation_brute(dossier, tur, ts):
    """Une opération du FIL PRINCIPAL : l'outil a enregistré son résultat brut."""
    lu = tur.get("file")
    if isinstance(lu, dict) and isinstance(lu.get("content"), str):
        debut = int(lu.get("startLine") or 1)
        frag = list(enumerate(lu["content"].split("\n"), debut))
        return dossier.ajouter(lu.get("filePath"), ts, "lire", (frag, int(lu.get("totalLines") or 0)), "claude")
    chemin = tur.get("filePath")
    if tur.get("type") in ("create", "update") and isinstance(tur.get("content"), str):
        if relatif(chemin)[0] is None:
            dossier.ajouter_hors(chemin, ts, tur["content"])     # un script de brouillon, peut-être lancé ensuite
            return False
        return dossier.ajouter(chemin, ts, "ecrire", tur["content"], "claude")
    if isinstance(tur.get("oldString"), str):
        charge = {"original": tur.get("originalFile") if isinstance(tur.get("originalFile"), str) else None,
                  "hunks": hunks_depuis_structure(tur.get("structuredPatch")),
                  "ancien": tur["oldString"], "neuf": tur.get("newString") or "",
                  "tout": bool(tur.get("replaceAll"))}
        return dossier.ajouter(chemin, ts, "modifier", charge, "claude")
    return False


SKILL_INVOQUE = re.compile(r"^Base directory for this skill: ([^\n]+)\n\n(.*)$", re.S)


def corps_de_skill(texte):
    """[(chemin du SKILL.md, lignes du corps)] d'un message d'invocation de skill.

    Quand un skill est invoqué, l'outil injecte dans la conversation le fichier
    `SKILL.md` ENTIER moins son en-tête (`---` … `---`), précédé de son dossier et,
    s'il y a lieu, suivi des arguments. C'est une lecture complète que personne n'a
    demandée — et la seule trace de certains skills (`wasm-engine` : 126 lignes sur
    165 jamais lues autrement). Les rappels d'après compaction, eux, sont tronqués et
    en portent plusieurs : on ne prend que le message d'invocation lui-même.
    """
    m = SKILL_INVOQUE.match(texte)
    if not m or "skill content truncated" in texte or texte.count("Base directory for this skill") != 1:
        return []
    corps = re.sub(r"\n\nARGUMENTS: .*$", "", m.group(2), flags=re.S)
    lignes = corps.split("\n")
    while lignes and lignes[-1].strip() == "":
        lignes.pop()
    return [(os.path.join(m.group(1).strip(), "SKILL.md"), lignes)] if lignes else []


def premiere_ligne(evenements, corps, ts):
    """À quel numéro commence ce corps, d'après l'événement le plus PROCHE dans le temps
    où figure sa première ligne reconnaissable ? None si on ne le sait pas."""
    rang = next((i for i, l in enumerate(corps) if len(l.strip()) >= 12), None)
    if rang is None:
        return None
    cherchee = corps[rang].rstrip("\r")
    meilleur = None
    for t, _, genre, charge, _ in evenements:
        if genre == "lire":
            numeros = [n for n, l in charge[0] if l.rstrip("\r") == cherchee]
        elif genre == "ecrire":
            numeros = [i for i, l in enumerate(charge.split("\n"), 1) if l.rstrip("\r") == cherchee]
        else:
            continue
        if len(numeros) == 1 and numeros[0] - rang >= 1 and (meilleur is None or abs(t - ts) < meilleur[0]):
            meilleur = (abs(t - ts), numeros[0] - rang)
    return meilleur[1] if meilleur else None


PERSISTEE = re.compile(r"^<persisted-output>\nOutput too large \([^)]*\)\. Full output saved to: (.+?)\n")


def sortie_persistee(tur, texte):
    """La sortie ENTIÈRE d'une commande trop bavarde, ou None si elle n'a pas été versée.

    Au-delà de 30 Ko, l'outil verse la sortie dans `<session>\\tool-results\\<id>.txt` et
    n'en garde dans la transcription qu'un début COUPÉ AU MILIEU D'UNE LIGNE (30 000
    caractères pour le fil principal, 2 Ko pour un sous-agent). Ce sont justement les
    grosses lectures — un `cat` de fichier entier. Si le fichier versé a disparu, on
    rend une sortie VIDE : mieux vaut rien qu'un début dont la dernière ligne est fausse.
    """
    chemin = tur.get("persistedOutputPath") if isinstance(tur, dict) else None
    if not chemin:
        m = PERSISTEE.match(texte or "")
        chemin = m.group(1).strip() if m else None
    if not chemin:
        return None
    try:
        with open(chemin, encoding="utf-8", errors="replace") as f:
            return f.read()
    except OSError:
        return ""


def scanner_claude(dossier, journal):
    """Une passe sur toutes les transcriptions.

    Pose les opérations sur fichiers (Read / Write / Edit) et REND les sorties de
    commandes (recherches, `sed -n`) : elles ne complètent que des fichiers déjà
    connus, et ne peuvent donc être rattachées qu'une fois toutes les sources lues
    (voir `rattacher_sorties`).
    """
    n = collections.Counter()
    sorties = []
    for jsonl in transcriptions():
        appels = {}
        with open(jsonl, encoding="utf-8", errors="replace") as f:
            for ligne in f:
                skill = "Base directory for this skill" in ligne
                if ('"tool_use' not in ligne and '"tool_result"' not in ligne and '"toolUseResult"' not in ligne
                        and not skill):
                    continue
                try:
                    rec = json.loads(ligne)
                except Exception:
                    continue
                ts = secondes(rec.get("timestamp"))
                tur = rec.get("toolUseResult")
                brut = isinstance(tur, dict)
                if brut and operation_brute(dossier, tur, ts):
                    n["fil principal"] += 1
                contenu = (rec.get("message") or {}).get("content")
                if skill:
                    for texte in ([contenu] if isinstance(contenu, str) else
                                  [b.get("text", "") for b in contenu or [] if isinstance(b, dict)]):
                        for chemin, corps in corps_de_skill(texte or ""):
                            sorties.append((ts, chemin, [], corps, None, None, "claude-skill"))
                if not isinstance(contenu, list):
                    continue
                for b in contenu:
                    if not isinstance(b, dict):
                        continue
                    if b.get("type") == "tool_use":
                        if b.get("name") in ("Read", "Write", "Edit", "Grep", "Bash", "PowerShell"):
                            appels[b.get("id")] = (b["name"], b.get("input") or {}, rec.get("cwd") or "", ts)
                        continue
                    if b.get("type") != "tool_result" or b.get("tool_use_id") not in appels:
                        continue
                    # `ts` est l'instant du RÉSULTAT ; `lance`, celui où la commande est PARTIE.
                    # Ce qu'elle ÉCRIT l'est entre les deux (voir `Dossier.fenetres`).
                    outil, entree, cwd, lance = appels.pop(b["tool_use_id"])
                    if b.get("is_error") or isinstance(tur, str):
                        # Opération refusée : rien n'a changé sur le disque. SAUF une commande
                        # qui a tourné et fini sur un code non nul : ce qu'elle a fait avant
                        # d'échouer est fait (voir `commande_en_erreur`).
                        if outil == "Bash":
                            ecrit = commande_en_erreur(dossier, ts, entree.get("command") or "", cwd,
                                                       "claude-script", REDUIRE_CLAUDE, texte_resultat(b), sorties)
                            n["scripts"] += ecrit
                            n["commandes en erreur reprises"] += bool(ecrit)
                            if ecrit and lance < ts:
                                dossier.fenetres.append((lance, ts))
                        continue
                    texte = texte_resultat(b)
                    if outil in ("Read", "Write", "Edit"):
                        if not brut and operation_affichee(dossier, outil, entree, texte, ts):
                            n["sous-agents"] += 1
                    elif outil == "Grep":
                        # Une recherche ne rend des LIGNES ENTIÈRES numérotées que sans `-o`
                        # (motif seul) et avec les numéros : sinon ce qu'on prendrait pour la
                        # ligne 12 serait un bout de texte, ou une ligne commençant par « 12: ».
                        if entree.get("-o") or entree.get("-n") is False or entree.get("multiline"):
                            continue
                        if brut:
                            if tur.get("mode") != "content" or not isinstance(tur.get("content"), str):
                                continue
                            rendu = tur["content"]
                        elif entree.get("output_mode") == "content":
                            # Un résultat trop long n'est rendu qu'en APERÇU, coupé au milieu
                            # d'une ligne : seul le fichier où il a été versé fait foi.
                            rendu = sortie_persistee(None, texte)
                            if rendu is None:
                                rendu = texte
                        else:
                            continue
                        base = entree.get("path") or cwd
                        est_fichier = bool(re.search(r"\." + EXT + r"$", base or "", re.I))
                        par = {}
                        for chemin, num, t in fragments_grep(rendu, base, est_fichier):
                            par.setdefault(chemin, []).append((num, t))
                        for chemin, frag in par.items():
                            sorties.append((ts, chemin, [cwd] if est_fichier else [base, cwd], frag, 0, None,
                                            "claude-grep"))
                    elif outil in ("Bash", "PowerShell"):
                        rendu = sortie_persistee(tur if brut else None, texte)
                        if rendu is None:
                            rendu = tur.get("stdout") if brut else texte
                        if not isinstance(rendu, str):
                            continue
                        rendu = CWD_REMIS.sub("", rendu)
                        if outil == "PowerShell":
                            lues = codex.lectures_powershell(entree.get("command") or "", rendu, cwd, rognee=True)
                        else:
                            # L'alignement d'une sortie de shell a ses propres pièges : commandes.py.
                            lues = lectures_commande(entree.get("command") or "", rendu, cwd)
                        for (chemin, cwd_seg), frag, total, rogne in lues:
                            sorties.append((ts, chemin, [cwd_seg, cwd], frag, total, rogne, "claude-shell"))
                        # Un heredoc écrit un fichier ENTIER sans passer par l'outil d'écriture.
                        ecrit = 0
                        if outil == "Bash":
                            # ⚠ `reduire=False` : dans les sessions d'AVANT la perte, le shell
                            # recevait le texte tel que la transcription l'enregistre (voir
                            # `commandes.reduire_antislashs` : la réduction des paires
                            # d'antislashs est un trait de l'application de bureau d'octobre).
                            for (chemin, cwd_h), contenu in ecritures_commande(entree.get("command") or "", cwd,
                                                                               reduire=REDUIRE_CLAUDE):
                                sorties.append((ts, chemin, [cwd_h], contenu, None, None, "claude-heredoc"))
                                ecrit += 1
                            # … et le reste de la commande agit sur des fichiers sans qu'aucun
                            # outil de fichiers le voie (voir `derouler_scripts`).
                            ecrit += actions_de_shell(dossier, ts, entree.get("command") or "", cwd,
                                                      "claude-script", REDUIRE_CLAUDE, rendu)
                        else:
                            # PowerShell : une chaîne `@'…'@` versée dans un fichier (codex.py).
                            for mode_e, chemin, cwd_e, contenu in codex.ecritures_powershell(
                                    entree.get("command") or "", cwd):
                                if mode_e == "ecrire":
                                    sorties.append((ts, chemin, [cwd_e], contenu, None, None, "claude-heredoc"))
                                    ecrit += 1
                                else:
                                    ecrit += dossier.ajouter_script(ts, "ajout", None, None, [contenu, chemin],
                                                                    cwd_e, "claude-script")
                        n["scripts"] += ecrit
                        if ecrit and lance < ts:
                            dossier.fenetres.append((lance, ts))
    journal.write(f"claude : {n['fil principal']} operations du fil principal, "
                  f"{n['sous-agents']} de sous-agents, {n['scripts']} scripts executes "
                  f"(dont {n['commandes en erreur reprises']} commandes finies en erreur)\n")
    return sorties


def rattacher_sorties(dossier, sorties, journal, etiquette="sorties"):
    """Lignes tirées des recherches et des commandes de shell, pour les fichiers CONNUS."""
    n = collections.Counter()
    # Les écritures d'abord : une lecture ne complète qu'un fichier déjà connu.
    for ts, chemin, bases, frag, total, rogne, source in sorted(sorties, key=lambda x: not x[6].endswith("-heredoc")):
        if source in ("claude-heredoc", "hermes-heredoc"):
            absolu = chemin_resolu(chemin, bases)
            cle, _ = relatif(absolu)
            if cle and (cle in dossier.evts or durable(cle)) and dossier.ajouter(absolu, ts, "ecrire", frag, source):
                n[source] += 1
            elif not cle and absolu:
                dossier.ajouter_hors(absolu, ts, frag)       # hors projet : un script de brouillon
            continue
        if source == "claude-skill":
            # Le corps du skill est le fichier SANS son en-tête : il faut savoir à quelle
            # ligne il commence. On le demande aux autres lectures du même fichier.
            cle, _ = relatif(chemin)
            debut = premiere_ligne(dossier.evts.get(cle, []), frag, ts) if cle else None
            if debut and dossier.ajouter(chemin, ts, "lire", (list(enumerate(frag, debut)), 0, None), source,
                                         creer=False):
                n[source] += 1
            continue
        reel = dossier.cle_connue(chemin, bases, toutes=source.endswith(("-grep", "-search")))
        if reel and dossier.ajouter(reel, ts, "lire", (frag, total, rogne), source, creer=False):
            n[source] += 1
    journal.write(etiquette + " : " + (", ".join(f"{v} {k}" for k, v in sorted(n.items())) or "0") + "\n")
    return sum(n.values())


# ── Source 2 : Hermes ────────────────────────────────────────────────────────
LIGNE_HERMES = re.compile(r"^\s*(\d+)\|(.*)$")
COUPE_HERMES = "... [truncated]"


def fragment_hermes(contenu):
    """[(numéro, texte)] d'une lecture Hermes (`N|texte`).

    ⚠ Hermes termine TOUTE lecture par le numéro de la ligne suivante, sans texte
    (`…\\n204|}\\n205|`). Prise pour une vraie ligne, cette amorce écrasait la bonne
    valeur par du vide : mesuré le 01/10/2026 sur `rpg/types.ts`, dont la ligne 101
    (`| "legs"`) devenait vide après une lecture limitée à 100 lignes. On la retire.
    """
    frag = []
    for l in contenu.split("\n"):
        m = LIGNE_HERMES.match(l)
        if m:
            frag.append((int(m.group(1)), m.group(2)))
    if frag and frag[-1][1] == "":
        frag.pop()
    # ⚠ Hermes coupe à 2 000 caractères et le dit en fin de ligne. Une ligne coupée
    # n'est pas la ligne : elle reste un trou (mesuré : 38 lignes, dont les tableaux
    # SPIR-V de `mesh_frag.ts`, rendus « complets » avec une ligne amputée).
    return [(n, t) for n, t in frag if not (len(t) >= LARGEUR_LECTURE and t.endswith(COUPE_HERMES))]


def scanner_hermes(dossier, journal):
    if not os.path.exists(HERMES_DB):
        journal.write("hermes : base absente\n")
        return []
    c = sqlite3.connect(f"file:{HERMES_DB}?mode=ro", uri=True)
    appels = {}
    for tc, ts in c.execute("select tool_calls, timestamp from messages where role='assistant' "
                            "and tool_calls is not null and tool_calls != ''"):
        try:
            liste = json.loads(tc)
        except Exception:
            continue
        for appel in liste if isinstance(liste, list) else []:
            fn = appel.get("function") or {}
            if fn.get("name") not in ("read_file", "write_file", "patch", "terminal", "search_files", "execute_code"):
                continue
            args = fn.get("arguments")
            try:
                args = json.loads(args) if isinstance(args, str) else args
            except Exception:
                continue
            if isinstance(args, dict) and appel.get("id"):
                appels[appel["id"]] = (fn["name"], args, float(ts or 0))
    vus, n, sorties, lues = set(), 0, [], []
    decodeur = json.JSONDecoder()
    for tcid, contenu, outil in c.execute("select tool_call_id, content, tool_name from messages "
                                          "where role='tool' and tool_name in "
                                          "('read_file','write_file','patch','terminal','search_files','execute_code')"):
        if not tcid or tcid in vus or tcid not in appels:
            continue
        vus.add(tcid)
        nom, args, ts = appels[tcid]
        try:
            # `raw_decode` : un résultat de recherche est parfois suivi d'un conseil en clair.
            res = decodeur.raw_decode(contenu)[0] if isinstance(contenu, str) else {}
        except Exception:
            res = {}
        if not isinstance(res, dict) or res.get("error"):
            continue           # opération refusée : rien n'a changé sur le disque
        if nom == "search_files":
            for chemin, frag in fragments_recherche_hermes(res):
                lues.append((ts, chemin, [args.get("path") or ""], frag, 0, None, "hermes-search"))
            continue
        if nom == "terminal":
            if isinstance(args.get("command"), str) and isinstance(res.get("output"), str):
                ici = args.get("workdir") or args.get("cwd") or ""
                sorties.append((args["command"], res["output"], ts, ici))
                if res.get("exit_code") in (0, None):
                    # Hermes ne passe pas par la ligne de commande de Windows : rien n'y
                    # réduit les antislashs (`reduire=False`).
                    for (chemin, cwd_h), contenu_h in ecritures_commande(args["command"], ici, reduire=False):
                        lues.append((ts, chemin, [cwd_h], contenu_h, None, None, "hermes-heredoc"))
                    actions_de_shell(dossier, ts, args["command"], ici, "hermes-script", False, res["output"])
                elif (isinstance(res.get("exit_code"), int) and res["exit_code"] in CODES_D_ECHEC
                      and not PLAINTE_DU_SHELL.search(res["output"])):
                    # Finie en erreur : ce qu'elle avait fait avant d'échouer est fait.
                    actions_de_shell(dossier, ts, args["command"], ici, "hermes-script", False, res["output"],
                                     en_erreur=True, ecrits=lues)
            continue
        if nom == "execute_code":
            if isinstance(args.get("code"), str) and ECRITURE_SCRIPT.search(args["code"]):
                dossier.ajouter_script(ts, "python", args["code"], None, [], "", "hermes-script")
            continue
        chemin = args.get("path")
        if nom == "write_file" and isinstance(args.get("content"), str):
            n += dossier.ajouter(chemin, ts, "ecrire", args["content"], "hermes")
        elif nom == "patch" and isinstance(args.get("old_string"), str):
            charge = {"original": None, "hunks": hunks_depuis_diff(res.get("diff")),
                      "ancien": args["old_string"], "neuf": args.get("new_string") or "",
                      "tout": bool(args.get("replace_all"))}
            n += dossier.ajouter(chemin, ts, "modifier", charge, "hermes")
        elif nom == "read_file" and isinstance(res.get("content"), str) and not res.get("is_binary"):
            frag = fragment_hermes(res["content"])
            if frag:
                n += dossier.ajouter(chemin, ts, "lire", (frag, int(res.get("total_lines") or 0)), "hermes")
    journal.write(f"hermes : {n} operations reussies\n")
    for cmd, sortie, ts, cwd in sorties:
        sortie = re.sub(r"\n?__HERMES_CWD_[0-9a-f]+__.*$", "", sortie, flags=re.S)
        for (chemin, cwd_seg), frag, total, rogne in lectures_commande(cmd, sortie, cwd):
            lues.append((ts, chemin, [cwd_seg, cwd], frag, total, rogne, "hermes-shell"))
    return lues           # rattachées une fois TOUTES les sources lues (voir `charger`)


LIGNE_RECHERCHE = re.compile(r"^  (\d+)[:-](?: (.*))?$")


def fragments_recherche_hermes(res):
    """[(chemin, [(n°, texte)])] d'une recherche d'Hermes (`search_files`, mode contenu).

    Deux formes : une liste `matches` ({path, line, content}), ou un texte `matches_text`
    groupé par fichier — le chemin seul sur sa ligne, puis `  N: contenu` par ligne
    trouvée (lignes de contexte comprises). Vérifié le 02/10/2026 contre les lectures
    faites dans la demi-heure : 10 236 lignes identiques, les écarts sont des
    modifications. Une ligne de 500 caractères est COUPÉE par l'outil : écartée.
    """
    par = {}
    if isinstance(res.get("matches"), list):
        for x in res["matches"]:
            if (isinstance(x, dict) and isinstance(x.get("path"), str) and isinstance(x.get("line"), int)
                    and isinstance(x.get("content"), str) and len(x["content"]) < LONGUEUR_SUSPECTE):
                par.setdefault(x["path"], []).append((x["line"], x["content"]))
    if isinstance(res.get("matches_text"), str):
        lignes = res["matches_text"].split("\n")
        if res.get("truncated") and lignes:
            lignes.pop()                             # résultat coupé : sa dernière ligne peut l'être aussi
        chemin = None
        for l in lignes:
            m = LIGNE_RECHERCHE.match(l)
            if m:
                if chemin and len(m.group(2) or "") < LONGUEUR_SUSPECTE:
                    par.setdefault(chemin, []).append((int(m.group(1)), m.group(2) or ""))
            elif l.strip() and not l.startswith(" "):
                chemin = l.strip()
    return list(par.items())


# ── Source 3 : Codex (« Astra ») ──────────────────────────────────────────────
def scanner_codex(dossier, journal):
    """Codex (voir codex.py) : sa BASE d'historique d'abord — modifications positionnées,
    commandes résolues, sorties entières — puis ses sessions pour ce que la base ne
    couvre pas. Rend les LECTURES, à rattacher aux fichiers connus."""
    n, lues = collections.Counter(), []
    fenetres = codex.fenetres_base()

    def flux():
        yield from codex.evenements_base()
        yield from codex.evenements(secondes, hors=fenetres)

    for ts, genre, chemin, bases, charge in flux():
        if genre == "lire":
            lues.append((ts, chemin, bases, charge[0], charge[1], charge[2], "codex-shell"))
            continue
        absolu = chemin_resolu(chemin, bases)
        if genre == "ecrire":
            n[genre] += dossier.ajouter(absolu, ts, "ecrire", charge, "codex")
        elif genre == "supprimer":
            n[genre] += dossier.ajouter(absolu, ts, "supprimer", None, "codex")
        elif genre == "diff":
            # Diff unifié de la base : positionné, comme ceux d'Hermes.
            hunks = hunks_depuis_diff(charge)
            if hunks:
                n["modifier (positionné)"] += dossier.ajouter(
                    absolu, ts, "modifier", {"original": None, "hunks": hunks, "ancien": "", "neuf": "", "tout": False},
                    "codex")
        elif genre == "ajouter":
            # `Add-Content` : ne se place que contre l'état du fichier à cet instant.
            n["ajouter en fin"] += dossier.ajouter_script(ts, "ajout", None, None, [charge, absolu], "", "codex-script")
        else:
            for ancien, neuf in charge:
                n[genre] += dossier.ajouter(absolu, ts, "modifier",
                                            {"original": None, "hunks": [], "ancien": ancien, "neuf": neuf,
                                             "tout": False, "entieres": True}, "codex")
    journal.write(f"codex : base d'historique {'lue' if fenetres else 'ABSENTE'} ({len(fenetres)} fil(s)) ; "
                  + (", ".join(f"{v} {k}" for k, v in sorted(n.items())) or "0") + "\n")
    return lues


# ── Source 4 : les fichiers sains rendus par DMDE ─────────────────────────────
MARGE_DMDE = 5.0             # secondes : voir scanner_dmde


def scanner_dmde(dossier, journal, index):
    """Rejoue comme des écritures complètes les fichiers SAINS rendus par DMDE et
    rapprochés d'un fichier du projet (`indexer-dmde.py`).

    Un tel fichier est un instantané exact à sa date de modification. ⚠ Il est posé
    quelques secondes APRÈS cette date : l'outil qui a fait la dernière modification
    l'a consignée juste après l'avoir écrite, et rejouée APRÈS l'instantané elle
    serait appliquée deux fois — le diff ne s'accorderait plus avec le fichier, et la
    version exacte passerait pour périmée. Une date postérieure à la perte n'est pas
    celle du fichier d'origine (copie, restauration) : on ne sait pas la situer.
    """
    n = hors = 0
    with open(index, encoding="utf-8") as f:
        rangs = [l.rstrip("\n").split("\t") for l in f][1:]
    for chemin, fichier, modifie, _, _ in (r for r in rangs if len(r) == 5):
        ts = secondes(modifie) + MARGE_DMDE
        if ts > PERTE:
            hors += 1
            continue
        try:
            with open(fichier, "rb") as b:
                brut = b.read()
        except OSError:
            continue
        try:
            contenu = brut.decode("utf-8")
        except UnicodeDecodeError:
            contenu = brut.decode("cp1252", errors="replace")
        n += dossier.ajouter(os.path.join(RACINES[1], chemin), ts, "ecrire", contenu, "dmde")
    journal.write(f"dmde : {n} fichiers sains rejoues, {hors} dates posterieures a la perte ecartes\n")
    return n


# ── Scripts : le rejeu en bac à sable ────────────────────────────────────────
def ordre(evenement):
    """Clé de tri d'un événement. À instant égal (une même commande) : ce qu'un heredoc
    a écrit d'abord, ce qu'un script en a fait ensuite, ce que la commande a lu enfin."""
    ts, rang, genre, _, source = evenement
    if genre == "ecrire" and source.endswith("-heredoc"):
        priorite = 0
    elif source.endswith("-script"):
        priorite = 1
    else:
        priorite = 2
    return ts, priorite, rang


def derouler_scripts(dossier, journal):
    """Rejoue, DANS L'ORDRE DU TEMPS et tous fichiers confondus, les scripts que les
    commandes ont exécutés, chacun contre l'état des fichiers à cet instant (bac.py), et
    verse ce qu'ils ont écrit dans les événements des fichiers :

      · un fichier réécrit       -> "poser"  (ses lignes, None pour les inconnues) ;
      · un remplacement dont l'ancre est dans un trou -> "modifier" sans position : il
        attendra d'être placé sur une version où l'ancre se voit (bac.executer) ;
      · un fichier supprimé      -> "supprimer" ;
      · un script en ligne dont la vérification échoue -> "douter" sur le dernier
        fichier du projet qu'il a lu : il a changé, on ne sait pas comment.

    Après ce passage, chaque fichier se rejoue seul comme avant (`rejouer`).
    """
    flux = []
    for cle, evts in dossier.evts.items():
        for e in evts:
            flux.append((ordre(e), "fichier", cle, e))
    for s in dossier.scripts:
        flux.append(((s[0], 1, s[1]), "script", None, s))
    for chemin, versions in dossier.hors.items():
        for ts, rang, contenu in versions:
            flux.append(((ts, 0, rang), "hors", chemin, contenu))
    flux.sort(key=lambda x: x[0])

    etats, hors = {}, {}
    connus = sorted(dossier.noms.values())
    bilan = collections.Counter()

    def fournir_pour(lus):
        def fournir(cle):
            if cle.startswith("h:"):
                return hors.get(cle[2:])
            r = etats.get(cle[2:])
            if cle[2:] not in lus:
                lus.append(cle[2:])
            return bac.texte_virtuel(r.carte, r.total) if r is not None and not r.supprime else None
        return fournir

    # ⚠ UNE COMMANDE EST DATÉE DE SON RÉSULTAT, MAIS CE QU'ELLE ÉCRIT L'EST AVANT — souvent
    # au début, suivi de vingt secondes de tests. Un fichier sain d'un lot, lui, porte la
    # date de sa dernière écriture : il se rejoue donc AVANT la commande qui l'a produit,
    # et celle-ci, rejouée ensuite, s'appliquait une seconde fois (mesuré le 02/10/2026 :
    # `modularEditorState.ts`, 362 lignes vraies, 372 rejouées). Si le disque a été
    # photographié PENDANT la commande, ce qu'elle a fait à ce fichier y est déjà.
    instantanes = {}                                     # clé -> instant du dernier instantané rejoué
    departs = {resultat: depart for depart, resultat in dossier.fenetres}

    def deja_sur_disque(cle_f, ts):
        vu = instantanes.get(cle_f)
        if vu is not None and departs.get(ts, ts) <= vu - MARGE_DMDE <= ts:
            bilan["déjà dans l'instantané du disque (non rejoué)"] += 1
            return True
        return False

    for _, nature, cle, e in flux:
        if nature == "fichier":
            appliquer(etats.setdefault(cle, Reconstitution()), e[2], e[3], e[4])
            if e[4] == "dmde":
                instantanes[cle] = e[0]
            continue
        if nature == "hors":
            hors[cle] = e
            continue
        ts, _, langage, code, script, args, cwd, source, mode, reel, sortie = e
        if langage == "ajout":
            # Un texte versé en FIN de fichier (`Add-Content`, `Out-File -Append`) : il se pose
            # après la dernière ligne — si l'on sait où le fichier finit.
            contenu, cible = args
            absolu = absolu_windows(cible, cwd)
            cle_f = relatif(absolu)[0] if absolu else None
            r = etats.get(cle_f) if cle_f else None
            avant = bac.texte_virtuel(r.carte, r.total) if r is not None and not r.supprime else None
            if avant is None or cle_f not in dossier.noms or r.total is None:
                bilan["ajout en fin : fichier ou fin inconnus"] += 1
                continue
            if deja_sur_disque(cle_f, ts):
                continue
            charge = bac.relire(avant + contenu + ("" if contenu.endswith("\n") else "\n"))
            absolu = RACINES[1] + "\\" + dossier.noms[cle_f]
            bilan["ajout en fin : posés"] += 1
            if dossier.ajouter(absolu, ts, "poser", charge, source):
                appliquer(r, "poser", charge, source)
            continue
        if langage == "fichiers":
            # `mv`, `cp`, `rm`, `git restore` : le contenu ne change pas, le fichier si.
            genre_d, sources, dest = args

            def situer(p):
                a = absolu_windows(p, cwd)
                return (relatif(a)[0], a) if a else (None, None)

            def tenu(cle_f):
                r = etats.get(cle_f)
                return r is not None and cle_f in dossier.noms and not r.supprime and bool(
                    r.carte or r.incertaines or r.anciennes)

            if genre_d in ("rm", "restaurer"):
                cibles = []
                for s in sources:
                    cle_s, _ = situer(s)
                    if not cle_s:
                        continue
                    if any(c in cle_s for c in "*?["):
                        # Un joker ne vaut que dans le nom du fichier : `rm -f scripts/_tmp-*.mjs`.
                        dossier_s, motif = cle_s.rpartition("\\")[0], cle_s.rpartition("\\")[2]
                        if any(c in dossier_s for c in "*?["):
                            continue
                        cibles += [k for k in etats if k.rpartition("\\")[0] == dossier_s
                                   and fnmatch.fnmatchcase(k.rpartition("\\")[2], motif)]
                    else:
                        cibles.append(cle_s)
                for cle_f in cibles:
                    if not tenu(cle_f) or deja_sur_disque(cle_f, ts):
                        continue
                    genre_e = "supprimer" if genre_d == "rm" else "douter"
                    absolu = RACINES[1] + "\\" + dossier.noms[cle_f]
                    if dossier.ajouter(absolu, ts, genre_e, None, source):
                        appliquer(etats[cle_f], genre_e, None, source)
                        bilan["fichiers : supprimés (rm)" if genre_d == "rm" else "fichiers : remis à la version du dépôt (doute)"] += 1
                continue
            (cle_s, abs_s), (cle_d, abs_d) = situer(sources[0]), situer(dest)
            if not abs_s or not abs_d:
                continue
            # La destination est un DOSSIER si elle finit par une barre ou si l'on y connaît des fichiers.
            if dest.rstrip().endswith(("/", "\\")) or (cle_d and any(k.startswith(cle_d + "\\") for k in etats)):
                cle_d, abs_d = situer(dest.rstrip("/\\") + "/" + ntpath.basename(abs_s))
            elif not re.search(r"\.\w+$", abs_d):
                continue                                 # ni dossier connu ni nom de fichier : on ne devine pas
            if cle_s:
                contenu = bac.texte_virtuel(etats[cle_s].carte, etats[cle_s].total) if tenu(cle_s) else None
            else:
                contenu = hors.get(abs_s.lower())
            if contenu is None:
                bilan["fichiers : source inconnue (mv, cp)"] += 1
                continue
            if cle_d:
                if (cle_d in dossier.evts or durable(cle_d)) and not deja_sur_disque(cle_d, ts):
                    charge = bac.relire(contenu)
                    r_d = etats.setdefault(cle_d, Reconstitution())
                    if dossier.ajouter(abs_d, ts, "poser", charge, source):
                        appliquer(r_d, "poser", charge, source)
                        bilan["fichiers : copiés ou renommés"] += 1
            elif "\x00" not in contenu:
                hors[abs_d.lower()] = contenu
            if genre_d == "mv" and cle_s and tenu(cle_s):
                absolu = RACINES[1] + "\\" + dossier.noms[cle_s]
                if dossier.ajouter(absolu, ts, "supprimer", None, source):
                    appliquer(etats[cle_s], "supprimer", None, source)
            continue
        if langage == "sed":
            # `sed -i` : le vrai sed, relancé sur ce qu'on tient de chaque fichier visé.
            regles, cibles = args
            for cible in cibles:
                absolu = absolu_windows(cible, cwd)
                cle_f = relatif(absolu)[0] if absolu else None
                r = etats.get(cle_f) if cle_f else None
                avant = bac.texte_virtuel(r.carte, r.total) if r is not None and not r.supprime else None
                if avant is None or cle_f not in dossier.noms:
                    bilan["sed : fichier inconnu"] += 1
                    continue
                if deja_sur_disque(cle_f, ts):
                    continue
                apres = bac.rejouer_sed(regles, avant)
                absolu = RACINES[1] + "\\" + dossier.noms[cle_f]
                if apres is None:
                    genre, charge = "douter", None
                    bilan["sed : échecs (fichier mis en doute)"] += 1
                elif apres == avant:
                    bilan["sed : sans effet"] += 1
                    continue
                else:
                    genre, charge = "poser", bac.relire(apres)
                    bilan["sed : rejoués"] += 1
                if dossier.ajouter(absolu, ts, genre, charge, source):
                    appliquer(r, genre, charge, source)
            continue
        chemin_script = None
        if code is None:
            # Le script est un fichier : du projet (son état à cet instant) ou de brouillon.
            chemin_script = absolu_windows(script, cwd)
            cle_s = relatif(chemin_script)[0] if chemin_script else None
            if cle_s and cle_s in etats and etats[cle_s].total and len(etats[cle_s].carte) == etats[cle_s].total:
                r = etats[cle_s]
                code = "\n".join(r.carte[i] for i in range(1, r.total + 1)) + "\n"
            elif chemin_script and chemin_script.lower() in hors:
                code = hors[chemin_script.lower()]
            if code is None or not ECRITURE_SCRIPT.search(code):
                bilan["sans code connu, ou sans écriture"] += 1
                continue
        lus = []
        echoue_alors, ligne_alors = reel if isinstance(reel, tuple) else (reel, None)
        res = bac.executer(langage, code, args, absolu_windows(cwd) or "C:\\", fournir_pour(lus), connus,
                           chemin_script, mode, indulgent=echoue_alors is not True, instant=ts)
        erreur = res.get("erreur") or ""
        # ⚠ CE QUE LE SCRIPT A FAIT POUR DE VRAI (voir `echecs_reels`). S'il avait échoué et
        # qu'il réussit ici, on n'applique rien : il n'a rien fait. S'il échoue ici comme il
        # avait échoué — même trace, ou même message de sortie retrouvé dans la sortie de la
        # commande —, l'échec est FIDÈLE : ce qu'il a écrit avant de s'arrêter vaut, et
        # aucun fichier n'est mis en doute.
        quitte = re.match(r"^sortie (['\"])(.+)\1$", erreur, re.S)
        message = quitte.group(2).split("\\n")[0].strip()[:80] if quitte else ""
        fidele = not res.get("ok") and (echoue_alors is True
                                        or bool(message and "\\" not in message and message in sortie))
        if res.get("ok") and echoue_alors is True:
            # Réussi ICI, échoué ALORS : on l'arrête là où il s'était arrêté. Ce qu'il a écrit
            # avant est réel ; ce qui suit ne l'est pas.
            force = arret_force(langage, code, ligne_alors)
            res = bac.executer(langage, force, args, absolu_windows(cwd) or "C:\\", fournir_pour(lus), connus,
                               chemin_script, mode, instant=ts) if force else {}
            if ARRET_FORCE not in (res.get("erreur") or ""):
                bilan["réussis ici mais échoués alors (rien n'est appliqué)"] += 1
                continue
            fidele, erreur = True, "arrêt à la ligne où le script s'était arrêté"
            bilan["réussis ici mais échoués alors (arrêtés à la même ligne)"] += 1
        ecrits = {k: v for k, v in (res.get("ecrits") or {}).items()}
        # ⚠ RÉPONSES À L'AVEUGLE (voir bac_python.py). Le bac ne tient que le TEXTE vu par les
        # historiques : un `.glb`, un `.uasset` y est toujours « absent », un dossier d'assets
        # toujours vide. Un script qui en dépend GÉNÈRE ici autre chose qu'alors — mesuré le
        # 02/10/2026 : `regression-report.json` rejoué disait « 22 assets manquants sur 22 »,
        # `trooper-squelettes.json` « lus : 0 ». Poser cela serait inventer ; garder l'ancien
        # contenu comme s'il était à jour serait mentir aussi (le script a bien réécrit le
        # fichier). Un fichier GÉNÉRÉ (écrit sans avoir été lu) par un tel script n'est donc
        # pas posé, et s'il était connu il est mis en doute.
        #
        # Un fichier MODIFIÉ EN PLACE (lu, puis réécrit) reste posé : il tient son contenu de
        # lui-même. Première règle essayée — ne rien poser du tout : le script de migration du
        # 19/09 parcourt aussi un dossier inconnu, et 159 fichiers qu'il n'avait fait que
        # corriger passaient en doute.
        #
        # Même défaut par une autre porte : une ENTRÉE TROUÉE. `narvos-manifeste-squelettes.mjs`
        # lit `Assets.toml`, dont on tient 580 lignes sur 68 418 : il n'y trouve aucune clé et
        # écrit « lus : 0 », sans avoir rien demandé à l'aveugle. Un fichier généré à partir
        # d'une entrée trouée n'est posé que s'il PORTE ses trous (les lignes inconnues l'ont
        # traversé : une copie, un découpage) — sinon elles ont été comptées pour rien.
        #
        # Deux gardes contre l'excès : un contenu LITTÉRAL (ses lignes sont écrites dans le
        # script) ne doit rien à ce que le script a vu, et reste posé — c'est le cas courant
        # « créer un module, puis l'inscrire dans un Index.lua troué ». Et un fichier relu
        # puis réécrit n'est « modifié en place » que s'il se ressemble encore
        # (`regression-report.json` relit son rapport précédent avant de l'écraser).
        aveugles = [a for a in (res.get("aveugles") or [])
                    if a not in ecrits and not (a.endswith("\\") and any(k.startswith(a) for k in ecrits))]
        troues = [t for t in (res.get("troues") or [])]
        generes = set(res.get("generes") or [])

        def calcule_sans_savoir(k, contenu):
            """Ce fichier écrit est-il CALCULÉ à partir de ce que le bac ne sait pas ?"""
            if not (aveugles or troues) or contenu is None:
                return False
            if not aveugles and "\x00" in contenu:
                return False                             # il porte ses trous : les lignes inconnues l'ont traversé
            if litteral(contenu, code):
                return False
            if k in generes:
                return True
            r_avant = etats.get(k[2:])
            avant = bac.texte_virtuel(r_avant.carte, r_avant.total) if r_avant is not None else None
            return peu_semblable(avant, contenu)

        ecartes = []
        noms = res.get("noms") or {}
        touches = 0
        for k, contenu in ecrits.items():
            if k.startswith("h:"):
                if contenu is not None:
                    hors[k[2:]] = contenu
                continue
            cle_f = k[2:]
            if calcule_sans_savoir(k, contenu):
                r = etats.get(cle_f)
                doute = False
                # (S'il avait échoué pour de vrai, il n'a peut-être rien écrit : pas de doute.)
                if (echoue_alors is not True and r is not None and cle_f in dossier.noms and (r.carte or r.incertaines)
                        and not r.supprime and not deja_sur_disque(cle_f, ts)):
                    if dossier.ajouter(RACINES[1] + "\\" + dossier.noms[cle_f], ts, "douter", None, source):
                        appliquer(r, "douter", None, source)
                        doute = True
                bilan["calculés sans savoir (à l'aveugle ou d'une entrée trouée) : "
                      + ("fichiers connus mis en doute" if doute else "fichiers non posés")] += 1
                ecartes.append(cle_f + (" ⚠ MIS EN DOUTE" if doute else ""))
                continue
            # Le chemin d'origine : celui qu'on connaît, sinon celui que le script a nommé.
            absolu = (RACINES[1] + "\\" + dossier.noms[cle_f]) if cle_f in dossier.noms else noms.get(k)
            if not absolu or relatif(absolu)[0] != cle_f:
                continue
            if cle_f not in dossier.evts and not durable(cle_f):
                continue                                 # un brouillon de plus, né et mort dans le projet
            if deja_sur_disque(cle_f, ts):
                continue
            r = etats.setdefault(cle_f, Reconstitution())
            # Ce que le script a remplacé là où l'on ne voit pas (voir bac.executer) : des
            # modifications SANS POSITION, à la suite de ce qu'il a fait là où l'on voit.
            en_attente = (res.get("attentes") or {}).get(k) or []
            suite = []
            if contenu is None:
                suite.append(("supprimer", None))
            else:
                lignes, fin_connue = bac.relire(contenu)
                avant = bac.texte_virtuel(r.carte, r.total)
                if avant is None or bac.relire(avant) != (lignes, fin_connue):
                    suite.append(("poser", (lignes, fin_connue)))    # sinon : réécrit à l'identique
                for ancien, neuf, partout in en_attente:
                    suite.append(("modifier", {"ancien": ancien, "neuf": neuf, "tout": bool(partout), "hunks": [],
                                               "original": None}))
                    bilan["modifications en attente (ancre dans un trou)"] += 1
            for genre, charge in suite:
                if dossier.ajouter(absolu, ts, genre, charge, source):
                    appliquer(r, genre, charge, source)
                    touches += 1
        if ecartes:
            cause = ("à l'aveugle : " + ", ".join(aveugles[:3])) if aveugles else ("entrée trouée : " + ", ".join(troues[:3]))
            dossier.echecs.append((iso(ts), source, langage, cause[:160], ecartes[-4:],
                                   (code or "")[:1200].replace("\n", " ⏎ ")))
        if res.get("ok"):
            bilan["rejoués, fichiers du projet modifiés" if touches else "rejoués, sans effet sur le projet"] += 1
        elif fidele:
            bilan["échecs fidèles (le script avait échoué aussi)"] += 1
        else:
            # Échec dans le bac alors que le script avait réussi : nos fichiers ne sont pas
            # ceux d'alors, ou le script lit ce qu'on n'a pas.
            #
            # ⚠ LE DOUTE EST ÉTROIT. Mettre en doute tout ce que le script avait ouvert
            # fermait l'époque de fichiers simplement LUS (un générateur lit dix catalogues
            # et n'en écrit aucun) : 295 doutes au premier passage, presque tous à tort.
            # On ne doute que du DERNIER fichier du projet lu avant l'échec, et seulement
            # si le script est écrit dans la commande (un correctif jetable : il lit sa
            # cible, vérifie, réécrit) et s'il s'est arrêté DE LUI-MÊME — une vérification
            # qui ne passe pas dit que le fichier n'est pas celui qu'on tient ; une panne
            # du bac ne dit rien.
            doutes = 0
            lus_script = [k[2:] for k in (res.get("lus") or []) if k.startswith("p:")]
            erreur = res.get("erreur") or ""
            # (Un script qui a reçu une réponse à l'aveugle a pu échouer À CAUSE d'elle — « ce
            # modèle n'existe pas » : son échec ne dit rien du fichier qu'il lisait.)
            if lus_script and mode != "fichier" and not PANNE_DU_BAC.search(erreur) and not aveugles:
                cle_f = lus_script[-1]
                r = etats.get(cle_f)
                # (Photographié pendant la commande, le fichier porte DÉJÀ ce que le script
                # cherchait à faire : son ancre n'y est plus, et c'est normal.)
                if (("p:" + cle_f) not in ecrits and r is not None and cle_f in dossier.noms
                        and (r.carte or r.incertaines) and not deja_sur_disque(cle_f, ts)):
                    absolu = RACINES[1] + "\\" + dossier.noms[cle_f]
                    if dossier.ajouter(absolu, ts, "douter", None, source):
                        appliquer(r, "douter", None, source)
                        doutes += 1
            bilan["échecs" + (" (fichier mis en doute)" if doutes else "")] += 1
            dossier.echecs.append((iso(ts), source, langage, erreur[:160],
                                   lus_script[-3:] + (["⚠ MIS EN DOUTE"] if doutes else []),
                                   (code or "")[:1200].replace("\n", " ⏎ ")))
    journal.write("scripts : " + (", ".join(f"{v} {k}" for k, v in sorted(bilan.items())) or "aucun") + "\n")
    return bilan


def charger(journal, sans_hermes=False, index_dmde=None, sans_scripts=False):
    """Toutes les sources, dans l'ordre qui convient : les fichiers d'abord, les sorties
    ensuite, les scripts enfin (ils ont besoin de l'état de tous les fichiers)."""
    dossier = Dossier()
    sorties = scanner_claude(dossier, journal)
    if not sans_hermes:
        sorties += scanner_hermes(dossier, journal)
    sorties += scanner_codex(dossier, journal)
    if index_dmde:
        scanner_dmde(dossier, journal, index_dmde)
    rattacher_sorties(dossier, sorties, journal)
    if not sans_scripts:
        derouler_scripts(dossier, journal)
    journal.write(f"apres la perte ({iso(PERTE)}) : {dossier.apres_perte} evenements ecartes\n")
    return dossier


# ── Les événements d'une extraction, gardés pour les outils de diagnostic ────
# Charger toutes les sources et rejouer les scripts prend dix minutes. Une extraction
# garde donc ses événements à côté de son manifeste ; tracer.py, ruptures.py et
# chaine.py les relisent (`--extraction <dossier>`) au lieu de tout refaire.
EVENEMENTS = "EVENEMENTS.pickle"


def sauver_evenements(dossier, sortie):
    with open(os.path.join(sortie, EVENEMENTS), "wb") as f:
        pickle.dump({"evts": dossier.evts, "noms": dossier.noms, "echecs": dossier.echecs}, f, protocol=4)


def relire_evenements(extraction):
    """Le Dossier d'une extraction déjà faite (ses événements, scripts rejoués compris)."""
    dossier = Dossier()
    with open(os.path.join(extraction, EVENEMENTS), "rb") as f:
        garde = pickle.load(f)
    dossier.evts, dossier.noms, dossier.echecs = garde["evts"], garde["noms"], garde.get("echecs", [])
    return dossier


def charger_pour_diagnostic(journal, arguments):
    """`charger`, ou la relecture d'une extraction si `--extraction <dossier>` est donné.
    Rend (dossier, arguments restants)."""
    if "--extraction" in arguments:
        i = arguments.index("--extraction")
        return relire_evenements(arguments[i + 1]), arguments[:i] + arguments[i + 2:]
    return charger(journal), arguments


# ── Rejeu ────────────────────────────────────────────────────────────────────
def appliquer(r, genre, charge, source):
    """Applique UN événement à une reconstitution (partagé avec tracer.py et ruptures.py)."""
    if genre == "ecrire":
        r.ecrire(charge)
    elif genre == "lire":
        r.lire(charge[0], charge[1], charge[2] if len(charge) > 2 else None)
    elif genre == "modifier":
        if charge["original"] is not None:
            # L'outil a rendu le fichier ENTIER d'avant la modification : état certain.
            r.ecrire(charge["original"])
        if charge["hunks"]:
            # Les diffs de Claude Code ont perdu leurs tabulations (reconstitution.etaler) :
            # on donne les textes exacts pour les rétablir.
            r.modifier(charge["hunks"], charge["ancien"], charge["neuf"], etale=(source == "claude"))
        else:
            r.remplacer(charge["ancien"], charge["neuf"], charge["tout"], charge.get("entieres", False))
    elif genre == "supprimer":
        r.supprimer()
    elif genre == "poser":
        r.poser(charge[0], charge[1])
    elif genre == "douter":
        r.douter()


def rejouer(evenements):
    """Rejoue les événements d'un fichier dans l'ordre du temps. Rend (Reconstitution, sources, dernier)."""
    r = Reconstitution()
    sources, dernier = set(), 0.0
    for ts, _, genre, charge, source in sorted(evenements, key=ordre):
        sources.add(source)
        dernier = max(dernier, ts)
        appliquer(r, genre, charge, source)
    return r, sources, dernier


def main():
    sortie = sys.argv[1] if len(sys.argv) > 1 else r"E:\mes_projet\narvos-reconstruit-v4"
    ecrire = "--ecrire" in sys.argv
    if relatif(os.path.join(sortie, "x"))[0] is not None or os.path.abspath(sortie).lower() in RACINES:
        sys.exit("refus : la sortie ne doit pas être DANS le projet (elle est effacée à chaque passage)")
    os.makedirs(sortie, exist_ok=True)
    if ecrire:
        # Une extraction précédente laisse des fichiers que celle-ci ne produit plus
        # (mesuré : les outils nés après la perte, écartés depuis par la coupure).
        # Repris par l'assemblage, ils écraseraient les vrais. On repart de zéro.
        for sous in ("fichiers", "EDITS_NON_APPLIQUES"):
            shutil.rmtree(os.path.join(sortie, sous), ignore_errors=True)
    journal = open(os.path.join(sortie, "JOURNAL.txt"), "w", encoding="utf-8")
    index_dmde = next((a[7:] for a in sys.argv if a.startswith("--dmde=")), None)
    dossier = charger(journal, "--sans-hermes" in sys.argv, index_dmde)
    sauver_evenements(dossier, sortie)

    manifeste = []
    complets = partiels = vides = supprimes = 0
    for cle in sorted(dossier.evts):
        nom = dossier.noms[cle]
        r, sources, dernier = rejouer(dossier.evts[cle])
        texte, bilan = r.assembler(marque_pour(nom))
        if texte is None:
            if bilan.get("supprime"):
                supprimes += 1
                journal.write(f"supprime\t{nom}\t{iso(dernier)}\n")
            else:
                vides += 1
            continue
        incomplet = (bilan["trous"] > 0 or bilan["anciennes"] > 0 or bilan.get("fin_inconnue", 0) > 0
                     or bilan.get("modifs_perdues", 0) > 0)
        if incomplet:
            partiels += 1
        else:
            complets += 1
        n = bilan["lignes"]
        couverture = 100 * (n - bilan["trous"]) // n if n else 0
        manifeste.append((nom, n, couverture, bilan["trous"], bilan["anciennes"], bilan.get("reprises", 0),
                          r.epoques, r.lectures, r.ecritures, r.modifications, len(r.non_appliquees),
                          iso(dernier), "+".join(sorted(sources)), bilan.get("fin_inconnue", 0),
                          bilan.get("indentation_perdue", 0)))
        if ecrire:
            cible = os.path.join(sortie, "fichiers", nom)
            os.makedirs(os.path.dirname(cible), exist_ok=True)
            with open(cible, "w", encoding="utf-8", newline="\n") as f:
                f.write(texte)
            if r.non_appliquees:
                cible = os.path.join(sortie, "EDITS_NON_APPLIQUES", nom + ".txt")
                os.makedirs(os.path.dirname(cible), exist_ok=True)
                with open(cible, "w", encoding="utf-8", newline="\n") as f:
                    for ancien, neuf, tout in r.non_appliquees:
                        f.write(f"===== (replace_all={tout})\n--- ANCIEN\n{ancien}\n--- NOUVEAU\n{neuf}\n\n")

    with open(os.path.join(sortie, "MANIFESTE.tsv"), "w", encoding="utf-8", newline="\n") as f:
        f.write("chemin\tlignes\tcouverture%\ttrous\tlignes_ancienne_version\treprises_alignees\tepoques\t"
                "lectures\tecritures\tmodifications\tmodifs_non_appliquees\tdernier_instant\thistoriques\t"
                "fin_inconnue\tindentation_perdue\n")
        for l in manifeste:
            f.write("\t".join(str(x) for x in l) + "\n")
    journal.close()

    print(f"fichiers vus       : {len(dossier.evts)}")
    print(f"  complets         : {complets}")
    print(f"  incomplets       : {partiels}   (trous, blocs d'ancienne version ou fin inconnue)")
    print(f"  sans contenu     : {vides}")
    print(f"  supprimés        : {supprimes}   (dernier événement connu : une suppression — non rendus)")
    print(f"écartés (après la perte du {iso(PERTE)[:10]}) : {dossier.apres_perte} événement(s)")
    print(f"sortie             : {sortie}" + ("" if ecrire else "   (simulation — passer --ecrire)"))


if __name__ == "__main__":
    main()
