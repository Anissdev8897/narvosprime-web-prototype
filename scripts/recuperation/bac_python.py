# -*- coding: utf-8 -*-
"""
bac_python.py — exécute UN script Python d'historique dans un bac à sable : aucun
fichier réel n'est lu ni écrit, aucune commande n'est lancée. Lancé par bac.py, qui
lui passe le travail en JSON sur l'entrée standard et lit le résultat sur la sortie.

    travail  : {"code", "args", "cwd", "script", "mode", "racines": [...],
                "fichiers": {clé: contenu | null}, "connus": [chemins relatifs],
                "decisions": [bool], "instant": secondes | null}
    résultat : {"ok", "erreur", "manque": clé | null, "ecrits": {clé: contenu | null},
                "lus": [clés], "noms": {clé: chemin}, "incertains": n,
                "attente": [[ancien, neuf, partout]], "aveugles": [clés ou motifs],
                "generes": [clés écrites sans avoir été lues], "troues": [clés lues, trouées]}

Les CLÉS : "p:<chemin relatif au projet, minuscules>" pour un fichier du projet (quelle
que soit la racine sous laquelle le script le nomme), "h:<chemin absolu, minuscules>"
hors du projet. Un fichier que le script ouvre et que le travail ne fournit pas arrête
tout : le résultat dit lequel MANQUE, bac.py le fournit et relance.

Ce qui est permis : lire les fichiers de l'installation de Python (la bibliothèque
standard en a besoin). Tout le reste est virtuel.
"""
import builtins
import codecs
import fnmatch
import io
import json
import ntpath
import os
import re
import sys
import types

TRAVAIL = json.loads(sys.stdin.buffer.read().decode("utf-8"))
RACINES = [r.lower().rstrip("\\") for r in TRAVAIL["racines"]]
FICHIERS = TRAVAIL["fichiers"]
CONNUS = TRAVAIL.get("connus") or []                 # chemins relatifs au projet, casse d'origine
ETAT = {"cwd": None, "ecrits": {}, "lus": [], "manque": None, "captures": [], "noms": {}, "aveugles": [],
        "generes": [], "troues": []}
VRAI_ABSOLU = os.path.abspath
PYTHON = [os.path.normcase(VRAI_ABSOLU(p)) for p in {sys.prefix, sys.base_prefix, sys.exec_prefix}]
VRAI_OPEN = builtins.open
SORTIE_REELLE = sys.stdout.buffer


class Manque(BaseException):
    """Un fichier que le travail ne fournit pas (BaseException : un `except Exception`
    du script ne doit pas l'avaler)."""


# ── Les réponses À L'AVEUGLE ─────────────────────────────────────────────────
# Le bac ne tient que le TEXTE que les historiques ont vu. Un fichier binaire (`.glb`,
# `.uasset`, `.png`…) y est donc toujours « absent », et un dossier dont on ne connaît
# aucun fichier, toujours vide — quoi qu'il y ait eu sur le disque. Un script qui en
# dépend (« combien de modèles ? », « ce squelette est-il compatible ? ») écrit ici autre
# chose qu'alors. Chaque réponse de ce genre est NOTÉE : l'appelant ne posera pas ce que
# le script a écrit (mesuré le 02/10/2026 : `regression-report.json` disait « 22 assets
# manquants sur 22 », `trooper-squelettes.json` « lus : 0 »).
BINAIRE = re.compile(
    r"\.(?:glb|gltf|bin|uasset|umap|uexp|ubulk|pak|png|jpe?g|webp|ktx2|basis|tga|bmp|gif|ico|wav|ogg|mp3|mp4|webm"
    r"|fbx|obj|blend|vrm|ttf|otf|woff2?|zip|7z|rar|gz|tar|exe|dll|pdb|db|sqlite3?|pdf|psd|hdr|exr|dds|wasm|pyc"
    r"|unitypackage|asset|prefab|anim)$", re.I)


def aveugle(quoi):
    if quoi not in ETAT["aveugles"]:
        ETAT["aveugles"].append(quoi)


def noter_ecriture(c, prolonge=False):
    """Avant la PREMIÈRE écriture d'un fichier : est-il GÉNÉRÉ (écrit sans avoir été lu) ou
    MODIFIÉ en place (lu, puis réécrit — ou prolongé) ? Un fichier modifié tient son
    contenu de lui-même ; un fichier généré le tient de ce que le script a vu, réponses à
    l'aveugle comprises. L'appelant ne pose pas un fichier généré par un script qui a
    répondu à l'aveugle."""
    if c not in ETAT["ecrits"] and c not in ETAT["lus"] and not prolonge and c not in ETAT["generes"]:
        ETAT["generes"].append(c)


# ── L'indulgence : un texte TROUÉ ne répond pas « non » comme un texte entier ──
# Le script cherche un passage ; on ne tient pas toutes les lignes du fichier. Ne pas le
# trouver ne prouve pas qu'il n'y est pas : il est peut-être dans un trou. Deux règles
# (le détail de la relance est dans bac.executer) :
#   · une VÉRIFICATION (`a in s`, `s.count(a)`) répond d'abord non ; si le script échoue
#     ensuite, bac.py relance en imposant « oui » à la dernière vérification incertaine
#     — la commande d'origine avait réussi, donc cette vérification était passée ;
#   · un REMPLACEMENT dont l'ancre n'est pas dans ce qu'on tient n'est pas « rien à
#     faire » : il a eu lieu dans un trou. Il ressort comme modification SANS POSITION,
#     signalée par une marque posée en fin de texte, qui voyage avec lui jusqu'à
#     l'écriture (le texte peut redevenir une chaîne ordinaire en chemin).
DECISIONS = TRAVAIL.get("decisions") or []     # réponses imposées aux vérifications incertaines, dans l'ordre
INCERTAINS = [0]                               # combien de vérifications incertaines ont eu lieu
PRESUMES = set()                               # textes tenus pour présents dans un trou
ATTENTE = []                                   # modifications sans position : [ancien, neuf, partout]


def partiel(t):
    return str.__contains__(t, "\x00TROU") or str.__contains__(t, "\x00FIN")


def substantiel(a):
    """Un texte assez long pour être une ancre (pas `\\r\\n`, pas une tabulation)."""
    return isinstance(a, str) and len(a.strip()) >= 6 and "\x00" not in a


def decider():
    i = INCERTAINS[0]
    INCERTAINS[0] = i + 1
    return i < len(DECISIONS) and bool(DECISIONS[i])


class Texte(str):
    """Le contenu d'un fichier troué, tel que le script le lit."""
    __slots__ = ()

    def _presume(self, a):
        if not substantiel(a) or not partiel(self):
            return False
        if a in PRESUMES:
            return True
        if decider():
            PRESUMES.add(a)
            return True
        return False

    def __contains__(self, a):
        return str.__contains__(self, a) or self._presume(a)

    def count(self, a, *bornes):
        n = str.count(self, a, *bornes)
        return n if (n or bornes) else int(self._presume(a))

    def replace(self, a, b, n=-1):
        fait = Texte(str.replace(self, a, b, n))
        if not (substantiel(a) and isinstance(b, str) and a != b and partiel(self)) or str.__contains__(self, a):
            return fait                              # faite là où on la voit : rien n'attend
        # Introuvable dans ce qu'on tient : elle est dans un trou.
        ATTENTE.append([a, b, n != 1])
        marque = "\x00MODIF%d\x00\n" % (len(ATTENTE) - 1)
        return Texte(str.__add__(fait, ("" if str.endswith(fait, "\n") else "\n") + marque))

    # Le texte reste un Texte à travers les opérations courantes d'un correctif.
    def __add__(self, autre):
        r = str.__add__(self, autre)
        return Texte(r) if isinstance(r, str) else r

    def __getitem__(self, i):
        r = str.__getitem__(self, i)
        return Texte(r) if isinstance(i, slice) else r

    def strip(self, *a):
        return Texte(str.strip(self, *a))

    def rstrip(self, *a):
        return Texte(str.rstrip(self, *a))

    def lstrip(self, *a):
        return Texte(str.lstrip(self, *a))


class Lecture(io.StringIO):
    """Un fichier ouvert en lecture : lu d'un bloc, un fichier troué rend un Texte."""

    def read(self, n=-1):
        t = super().read(n)
        return Texte(t) if (n is None or n < 0) and partiel(t) else t


def absolu(p):
    """Chemin absolu Windows, casse gardée, d'après le dossier courant VIRTUEL."""
    p = os.fspath(p)
    if isinstance(p, bytes):
        p = p.decode("utf-8", "replace")
    m = re.match(r"^/([a-zA-Z])(?:/(.*))?$", p)
    if m:                                             # chemin MSYS : /d/x -> d:\x
        p = m.group(1) + ":\\" + (m.group(2) or "")
    if p.startswith("~"):
        p = "C:\\Users\\aniss" + p[1:]
    p = p.replace("/", "\\")
    if not re.match(r"^[A-Za-z]:\\", p):
        p = ntpath.join(ETAT["cwd"], p)
    return ntpath.normpath(p)


def cle(p):
    origine = absolu(p)
    a = origine.lower()
    c = "h:" + a
    for r in RACINES:
        if a == r or a.startswith(r + "\\"):
            c = "p:" + a[len(r) + 1:]
            break
    ETAT["noms"][c] = origine                           # le chemin tel que le script le nomme (casse gardée)
    return c


def dans_python(p):
    try:
        a = os.path.normcase(VRAI_ABSOLU(os.fspath(p)))
    except Exception:
        return False
    return any(a.startswith(x + os.sep) for x in PYTHON)


def contenu(c):
    """Le contenu d'un fichier virtuel ; FileNotFoundError s'il n'existe pas ; Manque
    si on ne sait pas encore."""
    if c in ETAT["ecrits"]:
        v = ETAT["ecrits"][c]
    elif c in FICHIERS:
        v = FICHIERS[c]
    else:
        ETAT["manque"] = c
        raise Manque(c)
    if v is None:
        if BINAIRE.search(c):
            aveugle(c)                                   # « absent » : on n'en sait rien
        raise FileNotFoundError(2, "No such file or directory (bac à sable)", c)
    return v


def existe(c):
    try:
        contenu(c)
        return True
    except FileNotFoundError:
        return False


class CaptureTexte(io.StringIO):
    def __init__(self, c, initial=""):
        super().__init__()
        self._cle = c
        if initial:
            self.write(initial)
        ETAT["captures"].append(self)

    def valeur(self):
        return self.getvalue() if not self.closed else self._fin

    def close(self):
        if not self.closed:
            self._fin = self.getvalue()
        super().close()


class CaptureOctets(io.BytesIO):
    def __init__(self, c, initial=b""):
        super().__init__()
        self._cle = c
        if initial:
            self.write(initial)
        ETAT["captures"].append(self)

    def valeur(self):
        brut = self.getvalue() if not self.closed else self._fin
        return brut.decode("utf-8", "replace")

    def close(self):
        if not self.closed:
            self._fin = self.getvalue()
        super().close()


def ouvrir(file, mode="r", buffering=-1, encoding=None, errors=None, newline=None, closefd=True, opener=None):
    if isinstance(file, int):
        return VRAI_OPEN(file, mode, buffering, encoding, errors, newline, closefd, opener)
    ecrit = any(x in mode for x in "wax+")
    if not ecrit and dans_python(file):
        return VRAI_OPEN(file, mode, buffering, encoding, errors, newline, closefd, opener)
    c = cle(file)
    if ecrit:
        initial = ""
        if "a" in mode or "+" in mode and "w" not in mode:
            try:
                initial = contenu(c)
            except FileNotFoundError:
                initial = ""
        if "x" in mode and existe(c):
            raise FileExistsError(17, "File exists (bac à sable)", c)
        noter_ecriture(c, prolonge=bool(initial))
        ETAT["ecrits"].setdefault(c, initial)          # créé, même si rien n'y est écrit
        if "b" in mode:
            return CaptureOctets(c, initial.encode("utf-8"))
        return CaptureTexte(c, initial)
    texte = contenu(c)
    ETAT["lus"].append(c)
    if partiel(texte) and c not in ETAT["troues"]:
        ETAT["troues"].append(c)                        # une entrée dont on ne tient pas tout
    if "b" in mode:
        return io.BytesIO(texte.encode("utf-8"))
    return Lecture(texte)


def relever():
    """Verse dans `ecrits` ce que les fichiers ouverts en écriture ont reçu."""
    for cap in ETAT["captures"]:
        ETAT["ecrits"][cap._cle] = cap.valeur()


# ── Arborescence virtuelle ───────────────────────────────────────────────────
def enfants(dossier_abs):
    """{nom: est_un_dossier} des entrées connues d'un dossier."""
    c = cle(dossier_abs)
    out = {}
    if c.startswith("p:"):
        base = c[2:]
        for rel in CONNUS:
            bas = rel.lower()
            if base and not bas.startswith(base + "\\"):
                continue
            reste = rel[len(base) + 1:] if base else rel
            nom, sep, _ = reste.partition("\\")
            if nom:
                out[nom] = bool(sep) or out.get(nom, False)
    for k, v in list(ETAT["ecrits"].items()) + list(FICHIERS.items()):
        if v is None or not k.startswith(c + "\\"):
            continue
        nom, sep, _ = k[len(c) + 1:].partition("\\")
        if nom and nom.lower() not in {x.lower() for x in out}:
            out[nom] = bool(sep)
    return out


def est_dossier(p):
    return bool(enfants(absolu(p)))


def lister(p):
    e = enfants(absolu(p))
    if not e:
        aveugle(cle(p) + "\\")                           # dossier dont on ne connaît rien
        raise FileNotFoundError(3, "No such directory (bac à sable)", str(p))
    return sorted(e)


def parcourir(haut, topdown=True, onerror=None, followlinks=False):
    e = enfants(absolu(haut))
    if not e:
        aveugle(cle(haut) + "\\")
    dossiers = sorted(n for n, d in e.items() if d)
    fichiers = sorted(n for n, d in e.items() if not d)
    yield str(haut), dossiers, fichiers
    for d in dossiers:
        yield from parcourir(ntpath.join(str(haut), d))


def developper(motif, recursive=False, **_):
    """glob virtuel : les fichiers connus qui répondent au motif, rendus dans la forme
    du motif (absolu ou relatif)."""
    motif = os.fspath(motif)
    relatif_au_cwd = not re.match(r"^(?:[A-Za-z]:[\\/]|/)", motif)
    m_abs = absolu(motif)
    racine = next((r for r in RACINES if m_abs.lower().startswith(r + "\\")), None)
    if racine is None:
        if BINAIRE.search(motif):
            aveugle("glob:" + m_abs.lower())
        return []
    prefixe = m_abs[:len(racine)]
    expr = re.escape(m_abs.lower())
    # Les classes `[abc]` du motif d'abord : les jokers posent ensuite leurs propres crochets.
    expr = re.sub(r"\\\[(.*?)\\\]", lambda m: "[" + m.group(1).replace("\\", "") + "]", expr)
    expr = expr.replace(r"\*\*\\", r"(?:.*\\)?").replace(r"\*\*", ".*").replace(r"\*", r"[^\\]*").replace(r"\?", r"[^\\]")
    regle = re.compile("^" + expr + "$")
    out = []
    for rel in CONNUS:
        complet = prefixe + "\\" + rel
        if regle.match(complet.lower()) and FICHIERS.get("p:" + rel.lower(), "") is not None:
            out.append(ntpath.relpath(complet, ETAT["cwd"]) if relatif_au_cwd else complet)
    if not out and BINAIRE.search(motif):
        aveugle("glob:" + m_abs.lower())                 # un motif de binaires ne trouve jamais rien ici
    return sorted(out)


# ── L'horloge ────────────────────────────────────────────────────────────────
def figer_horloge(instant):
    """L'heure qu'il est pour le script : celle de sa commande d'origine (secondes).

    Un script qui date ce qu'il écrit (`"genere_le": datetime.now().isoformat()`) y
    poserait sinon l'heure du REJEU : une date d'après la perte dans un fichier d'avant,
    et deux extractions de suite qui ne rendent pas le même fichier."""
    import datetime as _dt
    import time as _time

    vrais = {n: getattr(_time, n) for n in ("localtime", "gmtime", "strftime", "asctime")}
    _time.time = lambda: instant
    _time.time_ns = lambda: int(instant * 1e9)
    _time.localtime = lambda s=None: vrais["localtime"](instant if s is None else s)
    _time.gmtime = lambda s=None: vrais["gmtime"](instant if s is None else s)
    _time.strftime = lambda f, t=None: vrais["strftime"](f, vrais["localtime"](instant) if t is None else t)
    _time.asctime = lambda t=None: vrais["asctime"](vrais["localtime"](instant) if t is None else t)
    _time.ctime = lambda s=None: vrais["asctime"](vrais["localtime"](instant if s is None else s))

    class Meta(type):
        """`isinstance(x, datetime.date)` reste vrai pour une date faite ailleurs."""

        def __instancecheck__(cls, x):
            return isinstance(x, cls._vraie)

        def __subclasscheck__(cls, c):
            return issubclass(c, cls._vraie)

    class Jour(_dt.date, metaclass=Meta):
        _vraie = _dt.date

        @classmethod
        def today(cls):
            return cls.fromtimestamp(instant)

    class DateHeure(_dt.datetime, metaclass=Meta):
        _vraie = _dt.datetime

        @classmethod
        def now(cls, tz=None):
            return cls.fromtimestamp(instant, tz)

        @classmethod
        def utcnow(cls):
            return cls.fromtimestamp(instant, _dt.timezone.utc).replace(tzinfo=None)

        @classmethod
        def today(cls):
            return cls.fromtimestamp(instant)

    _dt.date, _dt.datetime = Jour, DateHeure


# ── L'environnement ──────────────────────────────────────────────────────────
# Des réglages qu'un script (ou la bibliothèque standard) consulte sans que ce qu'il écrit
# en dépende : absents, sans plus.
ENV_SANS_EFFET = re.compile(r"^(PYTHON|LC_|LANG|TZ$|TERM$|COLUMNS$|LINES$|NO_COLOR$|FORCE_COLOR$|PATH$|PATHEXT$|HOME$|"
                            r"SOURCE_DATE_EPOCH$|DEBUG$|CI$|SHELL$|PWD$|TMPDIR$)", re.I)


class Environnement(dict):
    """`os.environ` du script : celui de CETTE machine (TEMP, USERPROFILE… n'ont pas changé).
    Une variable qui n'y est pas n'est pas « absente » : elle est INCONNUE — la commande
    d'origine l'avait peut-être posée (`SORTIE=… python x.py`). La réponse est donnée à
    l'aveugle, et notée (voir `aveugle`)."""

    @staticmethod
    def _nom(nom):
        return nom.upper() if isinstance(nom, str) else nom      # Windows ne distingue pas la casse

    def _manque(self, nom):
        if isinstance(nom, str) and not ENV_SANS_EFFET.match(nom):
            aveugle("env:" + nom)

    def __getitem__(self, nom):
        if not dict.__contains__(self, self._nom(nom)):
            self._manque(nom)
        return dict.__getitem__(self, self._nom(nom))

    def get(self, nom, defaut=None):
        if not dict.__contains__(self, self._nom(nom)):
            self._manque(nom)
        return dict.get(self, self._nom(nom), defaut)

    def __contains__(self, nom):
        present = dict.__contains__(self, self._nom(nom))
        if not present:
            self._manque(nom)
        return present

    def __setitem__(self, nom, valeur):
        dict.__setitem__(self, self._nom(nom), valeur)

    def setdefault(self, nom, defaut=None):
        return dict.setdefault(self, self._nom(nom), defaut)

    def pop(self, nom, *defaut):
        return dict.pop(self, self._nom(nom), *defaut)


# ── Installation des substituts ──────────────────────────────────────────────
def installer():
    ETAT["cwd"] = absolu_initial(TRAVAIL.get("cwd") or "C:\\")
    if isinstance(TRAVAIL.get("instant"), (int, float)):
        figer_horloge(float(TRAVAIL["instant"]))
    builtins.open = ouvrir
    io.open = ouvrir
    codecs.open = lambda f, mode="r", encoding=None, errors="strict", buffering=-1: ouvrir(f, mode, encoding=encoding)

    os.getcwd = lambda: ETAT["cwd"]

    def chdir(p):
        ETAT["cwd"] = absolu(p)
    os.chdir = chdir
    os.path.abspath = lambda p: absolu(p)
    os.path.realpath = lambda p, **_: absolu(p)
    os.path.exists = lambda p: existe_quelque_chose(p)
    os.path.isfile = lambda p: existe_fichier(p)
    os.path.isdir = dossier_existe
    os.path.getsize = lambda p: len(contenu(cle(p)).encode("utf-8"))
    os.path.getmtime = lambda p: (contenu(cle(p)), 0.0)[1]
    os.listdir = lambda p=".": lister(p)
    os.walk = parcourir
    os.makedirs = lambda *a, **k: None
    os.mkdir = lambda *a, **k: None
    os.utime = lambda *a, **k: None
    os.system = lambda *a, **k: 0
    os.startfile = lambda *a, **k: None

    def supprimer(p, *a, **k):
        contenu(cle(p))
        ETAT["ecrits"][cle(p)] = None
    os.remove = os.unlink = supprimer

    def renommer(a, b, *x, **k):
        # (Une copie ou un renommage ne GÉNÈRE rien : le contenu vient d'un fichier qu'on tient.)
        ETAT["ecrits"][cle(b)] = contenu(cle(a))
        ETAT["ecrits"][cle(a)] = None
    os.rename = os.replace = renommer

    import glob as _glob
    _glob.glob = developper
    _glob.iglob = lambda *a, **k: iter(developper(*a, **k))

    import pathlib
    P = pathlib.Path
    P.read_text = lambda self, encoding=None, errors=None, **_: ouvrir(self, "r").read()
    def lire_octets(self):
        texte = contenu(cle(self))
        ETAT["lus"].append(cle(self))
        if partiel(texte) and cle(self) not in ETAT["troues"]:
            ETAT["troues"].append(cle(self))
        return texte.encode("utf-8")
    P.read_bytes = lire_octets

    def ecrire_texte(self, data, encoding=None, errors=None, newline=None):
        noter_ecriture(cle(self))
        ETAT["ecrits"][cle(self)] = data
        return len(data)
    P.write_text = ecrire_texte

    def ecrire_octets(self, data):
        noter_ecriture(cle(self))
        ETAT["ecrits"][cle(self)] = bytes(data).decode("utf-8", "replace")
        return len(data)
    P.write_bytes = ecrire_octets
    P.open = lambda self, mode="r", buffering=-1, encoding=None, errors=None, newline=None: ouvrir(self, mode, encoding=encoding)
    P.exists = lambda self, **_: existe_quelque_chose(self)
    P.is_file = lambda self, **_: existe_fichier(self)
    P.is_dir = lambda self, **_: dossier_existe(self)
    P.mkdir = lambda self, *a, **k: None
    P.unlink = lambda self, missing_ok=False: supprimer(self)
    P.resolve = lambda self, strict=False: P(absolu(self))
    P.absolute = lambda self: P(absolu(self))
    P.iterdir = lambda self: iter(P(ntpath.join(str(self), n)) for n in lister(self))
    P.glob = lambda self, motif, **_: iter(P(x) for x in developper(ntpath.join(str(self), motif)))
    P.rglob = lambda self, motif, **_: iter(P(x) for x in developper(ntpath.join(str(self), "**", motif)))
    P.cwd = classmethod(lambda c: P(ETAT["cwd"]))

    # Modules qui agissent sur le monde : remplacés par des coquilles inertes.
    class Acheve:
        returncode = 0
        stdout = ""
        stderr = ""

        def check_returncode(self):
            return None

        def communicate(self, *a, **k):
            return "", ""

        def wait(self, *a, **k):
            return 0

        def poll(self):
            return 0

    faux = types.ModuleType("subprocess")
    faux.run = faux.Popen = lambda *a, **k: Acheve()
    faux.call = faux.check_call = lambda *a, **k: 0
    faux.check_output = lambda *a, **k: "" if k.get("text") or k.get("encoding") or k.get("universal_newlines") else b""
    faux.getoutput = lambda *a, **k: ""
    faux.PIPE, faux.STDOUT, faux.DEVNULL = -1, -2, -3
    faux.CalledProcessError = type("CalledProcessError", (Exception,), {})
    faux.TimeoutExpired = type("TimeoutExpired", (Exception,), {})
    faux.CompletedProcess = Acheve
    sys.modules["subprocess"] = faux

    faux = types.ModuleType("shutil")

    def copier(a, b, *x, **k):
        cible = cle(b)
        if est_dossier(b):
            cible = cle(ntpath.join(str(b), ntpath.basename(str(a))))
        ETAT["ecrits"][cible] = contenu(cle(a))
        return b
    faux.copy = faux.copy2 = faux.copyfile = copier
    faux.move = lambda a, b, *x, **k: (copier(a, b), supprimer(a), b)[2]
    faux.rmtree = faux.copytree = lambda *a, **k: None
    faux.which = lambda *a, **k: None
    faux.get_terminal_size = lambda *a, **k: os.terminal_size((120, 40))
    sys.modules["shutil"] = faux

    for interdit in ("socket", "urllib.request", "requests", "ctypes", "multiprocessing", "tempfile", "sqlite3",
                     "winreg", "webbrowser", "http.client", "ftplib", "smtplib", "zipfile", "tarfile", "unreal"):
        sys.modules[interdit] = None                    # `import x` lève ImportError

    # En dernier : rien de ce qui précède ne doit passer pour une question du SCRIPT.
    os.environ = Environnement({k.upper(): v for k, v in os.environ.items()})
    os.getenv = lambda nom, defaut=None: os.environ.get(nom, defaut)


def absolu_initial(p):
    ETAT["cwd"] = "C:\\"
    return absolu(p)


def existe_fichier(p):
    try:
        return existe(cle(p))
    except Manque:
        raise


def dossier_existe(p):
    """`os.path.isdir` : vrai pour un dossier dont on connaît au moins un fichier. Sinon
    faux — mais un chemin SANS extension dont on ne connaît rien est un dossier d'assets
    aussi bien qu'un dossier absent : la réponse est donnée à l'aveugle, et notée."""
    if est_dossier(p):
        return True
    if not ntpath.splitext(absolu(p))[1]:
        aveugle(cle(p) + "\\")
    return False


def existe_quelque_chose(p):
    return dossier_existe(p) or existe_fichier(p)


def main():
    installer()
    code = TRAVAIL["code"]
    script = TRAVAIL.get("script") or "<stdin>"
    # `python x.py a` : argv = [x.py, a] ; `python - a` : [-, a] ; `python -c CODE a` : [-c, a].
    tete = script if script != "<stdin>" else ("-c" if TRAVAIL.get("mode") == "arg" else "-")
    sys.argv = [tete] + list(TRAVAIL.get("args") or [])

    class Muette(io.StringIO):
        def reconfigure(self, *a, **k):
            return None
    sys.stdout = Muette()
    sys.stderr = Muette()
    espace = {"__name__": "__main__", "__builtins__": builtins}
    if script != "<stdin>":
        espace["__file__"] = absolu(script)
    ok, erreur = True, ""
    try:
        exec(compile(code, script, "exec"), espace)
    except Manque:
        ok, erreur = False, "manque"
    except SystemExit as e:
        if e.code not in (0, None):
            ok, erreur = False, f"sortie {e.code!r}"
    except BaseException as e:                           # noqa: BLE001 — tout doit revenir au parent
        ok, erreur = False, f"{type(e).__name__}: {e}"[:400]
    if ETAT["manque"] and erreur != "manque" and ETAT["manque"] not in FICHIERS:
        ok, erreur = False, "manque"                     # un `except:` nu du script l'avait avalé
    try:
        relever()
    except Exception:
        pass
    resultat = {"ok": ok, "erreur": erreur, "manque": ETAT["manque"] if erreur == "manque" else None,
                "ecrits": ETAT["ecrits"], "lus": ETAT["lus"],
                "noms": {c: ETAT["noms"].get(c) for c in ETAT["ecrits"]},
                "incertains": INCERTAINS[0], "attente": ATTENTE, "aveugles": ETAT["aveugles"],
                "generes": ETAT["generes"], "troues": ETAT["troues"]}
    SORTIE_REELLE.write(json.dumps(resultat, ensure_ascii=False).encode("utf-8", "surrogatepass"))
    SORTIE_REELLE.flush()


main()
