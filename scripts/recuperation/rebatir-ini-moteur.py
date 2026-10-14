# -*- coding: utf-8 -*-
"""
rebatir-ini-moteur.py — rebâtit `adk\\Config\\DefaultEngine.ini`, le SEUL fichier de
configuration de l'ADK que DMDE n'a pas rendu. Sans lui, pas de cook : c'est lui qui porte
les CoreRedirects (un pack promu sous Narvos/ dont les imports pointent encore l'ancien
chemin sort GRIS en jeu, sans une erreur au cook).

  python rebatir-ini-moteur.py                 # simulation : écrit <lots>\\_ini_moteur\\
  python rebatir-ini-moteur.py --installer     # pose le résultat dans adk\\Config (jamais
                                               # par-dessus un DefaultEngine.ini existant)
  python rebatir-ini-moteur.py --sans-balayage # réemploie le relevé des mentions déjà fait

── D'OÙ VIENT CHAQUE LIGNE ──────────────────────────────────────────────────────────────
  1. `DefaultEngine.ini.avant-coreredirects` — le VRAI fichier du 06/09, rendu par DMDE.
     Il comble les lignes que les histoires n'ont jamais relues (profils de collision,
     surfaces physiques) : entre deux lignes connues retrouvées dans ce fichier, un trou
     n'est comblé que s'il a EXACTEMENT la longueur de l'intervalle correspondant.
  2. La reconstitution par les histoires (`adk.reconstruit\\Config\\DefaultEngine.ini`) :
     l'état du 13/09 (480 lignes) et l'édition du 23/09.
  3. Les lectures de Codex du 15/09 (`Get-Content -TotalCount 65`, `rg -n`) : elles ne
     créent rien, elles VÉRIFIENT (texte et numéros de ligne).
  4. Les redirects EXACTS de la ville. Astra (Codex) en a ajouté 109 + 22 + 70 le 15/09
     par trois scripts (`.hermes/astra_city_*_20260915.py`) dont les données — des JSON
     produits dans l'éditeur — sont perdues, et dont les lignes n'ont jamais été affichées.
     Ils sont RÉGÉNÉRÉS depuis l'état réel du disque, par la règle d'Astra : pour chaque
     ancien chemin `/Game/CITY_PACK/…` ou `/Game/City_Traffic_Pro/…` encore cité par un
     paquet qui cuit, la copie promue `/Game/Narvos/…` si elle existe, sinon la copie
     `/Game/Narvos/DependancesVille/…`. Ce n'est pas la liste d'Astra (une partie de ses
     109 visait Map_Narvos, resauvée depuis, et perdue) : c'est celle dont le disque a
     besoin AUJOURD'HUI.

── CE QUE L'OUTIL NE SAIT PAS ───────────────────────────────────────────────────────────
  · 7 lignes d'un paragraphe de COMMENTAIRE (redirects PNJ retirés le 12/09) n'ont jamais
    été relues : une ligne le dit à leur place. Sans effet sur le moteur.
  · Ce que l'éditeur a pu réécrire de lui-même entre le 23/09 et le 26/09.
"""
import collections
import glob
import json
import os
import re
import struct
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lots import PROJET, LOTS, RACINE, MARQUES  # noqa: E402

ADK = os.path.join(RACINE, "Server", "adk")
BASE = os.path.join(ADK, "Config", "DefaultEngine.ini.avant-coreredirects")
RECON = os.path.join(PROJET, "WebPortal", "Server", "adk.reconstruit", "Config", "DefaultEngine.ini")
INI_JEU = os.path.join(ADK, "Config", "DefaultGame.ini")
CONTENT = os.path.join(ADK, "Content")
SORTIE = os.path.join(LOTS, "_ini_moteur")
CIBLE = os.path.join(ADK, "Config", "DefaultEngine.ini")

MAGIE = b"\xc1\x83\x2a\x9e"
PLAFOND_ENTETE = 96 * 1024 * 1024
# Racines dont un paquet de Narvos/ peut dépendre sans rien devoir au pack : le contenu
# du client (NanosWorld) et le pack lui-même.
RACINES_LIVREES = ("Narvos", "NanosWorld")
# Les anciens emplacements de la ville : ceux qu'Astra a traités par redirects EXACTS.
PREFIXES_VILLE = ("/Game/CITY_PACK/", "/Game/City_Traffic_Pro/")
DEPENDANCES_VILLE = "/Game/Narvos/DependancesVille/"
TROU = "# [TROU —"
NOTE_COMMENTAIRE = ("; [rebâti le 2026-10-03 après la perte du disque : {n} ligne(s) de ce paragraphe de "
                    "commentaire n'ont jamais été relues — sans effet sur le moteur]")
REDIRECT = re.compile(r'^\+(Package|Object|Class)Redirects=\(OldName="([^"]+)",\s*NewName="([^"]+)"'
                      r'(,\s*MatchSubstring=true)?\)\s*$', re.I)
MENTION = re.compile(rb"/Game/[\x20-\x7e]+")
JAMAIS_CUIT = re.compile(r'DirectoriesToNeverCook=\(Path="([^"]+)"\)')


def lire_lignes(chemin):
    with open(chemin, encoding="utf-8-sig", errors="replace") as f:
        return f.read().replace("\r\n", "\n").split("\n")


# ── 1. Le squelette : la reconstitution, ses trous, sans ses marqueurs ────────────────────

def squelette(lignes):
    """La reconstitution rendue en lignes du fichier FINAL : `None` pour une ligne jamais
    lue, et plus aucune ligne de marqueur. Les blocs « ancienne version » y restent à leur
    place : ici la dernière époque ne couvre que le haut du fichier, et la suite de
    l'ancienne version EST la suite du fichier (un ini ne se réordonne pas)."""
    final = []
    for l in lignes:
        if l.startswith(TROU):
            final.append(None)
        elif any(m in l for m in MARQUES) and l.lstrip().startswith("#"):
            continue
        else:
            final.append(l)
    while final and final[-1] == "":
        final.pop()
    return final


def combler(final, base):
    """Comble les trous de `final` avec les lignes de `base` (le vrai fichier, plus ancien).

    Un trou n'est comblé que s'il est ENCADRÉ : la ligne connue qui le précède et celle qui
    le suit se retrouvent toutes deux dans `base`, dans cet ordre, et l'intervalle entre
    elles y a exactement la longueur du trou. Un trou en tête de fichier n'a qu'une borne :
    il faut alors que la ligne qui le suit soit à la même place dans `base`.
    Rend (lignes, comblés, [trous laissés sous la forme (début, fin)])."""
    import difflib
    connues = [(i, l) for i, l in enumerate(final) if l is not None]
    textes = [l for _, l in connues]
    apparie = {}
    for a, b, n in difflib.SequenceMatcher(None, textes, base, autojunk=False).get_matching_blocks():
        for k in range(n):
            apparie[connues[a + k][0]] = b + k
    final = list(final)
    combles, laisses = 0, []
    i = 0
    while i < len(final):
        if final[i] is not None:
            i += 1
            continue
        j = i
        while j < len(final) and final[j] is None:
            j += 1
        avant, apres = apparie.get(i - 1), apparie.get(j)
        if i == 0:
            avant = -1
        if avant is not None and apres is not None and apres - avant - 1 == j - i:
            final[i:j] = base[avant + 1:apres]
            combles += j - i
        else:
            laisses.append((i, j - 1))
        i = j
    return final, combles, laisses


def noter_commentaires(final, laisses):
    """Un trou resté ouvert au milieu d'un paragraphe de commentaire garde SA LONGUEUR :
    une ligne de commentaire qui le dit, puis des lignes `;` — les numéros de ligne du
    reste du fichier ne bougent pas, ce qui laisse les lectures anciennes vérifiables.
    Tout autre trou arrête l'outil : on n'invente pas de réglage."""
    for debut, fin in laisses:
        avant = final[debut - 1] if debut else ""
        apres = final[fin + 1] if fin + 1 < len(final) else ""
        if not (avant.startswith(";") and (apres.startswith(";") or apres == "")):
            raise SystemExit(f"ARRÊT : trou des lignes {debut + 1}-{fin + 1} hors d'un commentaire "
                             f"(avant : {avant[:60]!r}, après : {apres[:60]!r}) — rien n'est inventé.")
        final[debut:fin + 1] = [NOTE_COMMENTAIRE.format(n=fin - debut + 1)] + [";"] * (fin - debut)
    return final


# ── 2. Ce que les paquets qui cuisent citent hors du pack ─────────────────────────────────

def entete(chemin):
    """Les octets de l'en-tête d'un paquet NON cuit (résumé, table de noms, imports), ou
    None si ce n'est pas un paquet sain. On ne lit que l'en-tête : les sources pèsent des
    centaines de Go."""
    try:
        with open(chemin, "rb") as f:
            d = f.read(65536)
            if d[:4] != MAGIE or len(d) < 64:
                return None
            o = 4
            legacy, = struct.unpack_from("<i", d, o)
            o += 4
            if legacy != -4:
                o += 4                                   # LegacyUE3Version
            o += 4                                       # FileVersionUE4
            ue5 = 0
            if legacy <= -8:
                ue5, = struct.unpack_from("<i", d, o)
                o += 4
            o += 4                                       # licencié
            if ue5 >= 1016:
                o += 20                                  # SavedHash
                total, = struct.unpack_from("<i", d, o)
            else:
                n, = struct.unpack_from("<i", d, o)
                o += 4 + n * 20                          # versions personnalisées
                if o + 4 > len(d):
                    return d
                total, = struct.unpack_from("<i", d, o)
            if total <= len(d):
                return d[:max(total, 0)] or d
            f.seek(0)
            return f.read(min(total, PLAFOND_ENTETE))
    except (OSError, struct.error):
        return None


def mentions_hors_pack(octets):
    """Les chemins de PAQUET `/Game/<racine>/…` cités dans un en-tête, hors des racines
    livrées. Surestime (une mention n'est pas un import) : un manque réel n'échappe pas."""
    vus = set()
    for m in MENTION.finditer(octets):
        chemin = m.group(0).decode("latin1").split(".")[0].split(":")[0].rstrip("/")
        morceaux = chemin.split("/")
        if len(morceaux) < 4 or morceaux[2] in RACINES_LIVREES:
            continue
        vus.add(chemin)
    return vus


def jamais_cuits(texte_ini_jeu):
    """Les dossiers `DirectoriesToNeverCook`, en chemins `/Game/…` sans barre finale."""
    return [("/Game/" + p.strip("/")) if not p.startswith("/") else p.rstrip("/")
            for p in JAMAIS_CUIT.findall(texte_ini_jeu)]


def sous(chemin, dossiers):
    return any(chemin == d or chemin.startswith(d + "/") for d in dossiers)


def balayer(content, exclus, progres=None):
    """{paquet de Narvos/ qui cuit: {chemins /Game/ cités hors pack}} + nombre de paquets
    lus et de fichiers malades."""
    cites, lus, malades = {}, 0, []
    racine = os.path.join(content, "Narvos")
    for d, dirs, fichiers in os.walk(racine):
        rel = "/Game/" + os.path.relpath(d, content).replace(os.sep, "/")
        dirs[:] = [x for x in dirs if not sous(rel + "/" + x, exclus)]
        for f in fichiers:
            if not f.lower().endswith((".uasset", ".umap")):
                continue
            octets = entete(os.path.join(d, f))
            if octets is None:
                malades.append(rel + "/" + f)
                continue
            lus += 1
            m = mentions_hors_pack(octets)
            if m:
                cites[rel + "/" + os.path.splitext(f)[0]] = m
            if progres and lus % 5000 == 0:
                progres(lus)
    return cites, lus, malades


# ── 3. Les redirects ───────────────────────────────────────────────────────────────────

def redirects_actifs(lignes):
    """[(genre, ancien, nouveau, sous_chaine)] des lignes `+…Redirects=` d'un ini."""
    out = []
    for l in lignes:
        m = REDIRECT.match(l or "")
        if m:
            out.append((m.group(1).capitalize(), m.group(2), m.group(3), bool(m.group(4))))
    return out


def couvert(chemin, redirects):
    """Un redirect de PAQUET déjà écrit s'applique-t-il à ce chemin ?"""
    for genre, ancien, _, sous_chaine in redirects:
        if genre != "Package":
            continue
        if (sous_chaine and ancien in chemin) or (not sous_chaine and ancien == chemin):
            return True
    return False


def redirect_exact(ancien, existe):
    """La règle d'Astra (astra_city_dependances_preparer_20260915.py) : la copie promue
    `/Game/Narvos/<suite>` si elle existe, sinon la copie `Narvos/DependancesVille/<suite>`,
    sinon rien (la cible n'est nulle part : aucun redirect ne la rendra)."""
    suite = ancien[len("/Game/"):]
    for cible in ("/Game/Narvos/" + suite, DEPENDANCES_VILLE + suite):
        if existe(cible):
            return cible
    return None


def existe_sur_disque(content):
    def existe(paquet):
        rel = paquet[len("/Game/"):].replace("/", os.sep)
        return any(os.path.isfile(os.path.join(content, rel + e)) for e in (".uasset", ".umap"))
    return existe


def bloc_ville(cites, redirects, existe, exclus):
    """Les redirects exacts à écrire, et ce qui reste sans cible.
    Rend ([(ancien, nouveau)], {ancien: [paquets qui le citent]} sans cible,
          [(ancien, nouveau)] dont la cible est dans un dossier jamais cuit)."""
    par_ancien = collections.defaultdict(list)
    for paquet, anciens in cites.items():
        for a in anciens:
            if a.startswith(PREFIXES_VILLE) and not couvert(a, redirects):
                par_ancien[a].append(paquet)
    ecrire, orphelins, hors_cook = [], {}, []
    for ancien in sorted(par_ancien):
        nouveau = redirect_exact(ancien, existe)
        if nouveau is None:
            orphelins[ancien] = sorted(par_ancien[ancien])
            continue
        ecrire.append((ancien, nouveau))
        if sous(nouveau, exclus):
            hors_cook.append((ancien, nouveau))
    return ecrire, orphelins, hors_cook


# ── 4. Les lectures de Codex : des témoins, pas des sources ───────────────────────────────

# Un `rg -n` dont l'ini est le SEUL fichier fouillé : ses lignes sortent « numéro:texte ».
# Avec deux fichiers, rg préfixe par le chemin — ces sorties-là ne sont pas des témoins.
RG_SUR_L_INI_SEUL = re.compile(r"rg -n '[^']+' '?[^ ';]*DefaultEngine\.ini'?\s*(?:;|\"|$)")


def lectures_codex(racine=None):
    """Ce que Codex a LU du fichier le 15/09/2026, après ses propres ajouts ou juste avant :
    {numéro de ligne du 15/09: texte}. Vide si ses journaux ne sont plus là."""
    temoins = {}
    racine = racine or os.path.join(os.path.expanduser("~"), ".codex", "sessions")
    for chemin in sorted(glob.glob(os.path.join(racine, "2026", "09", "*", "*.jsonl"))):
        attente = {}
        try:
            f = open(chemin, encoding="utf-8", errors="replace")
        except OSError:
            continue
        with f:
            for ligne in f:
                if "call_id" not in ligne:
                    continue
                try:
                    e = json.loads(ligne)
                except ValueError:
                    continue
                p = e.get("payload") or {}
                if not (p.get("type") or "").endswith("_output"):
                    if "DefaultEngine.ini" in ligne and e.get("timestamp", "") >= "2026-09-15T04:00":
                        attente[p.get("call_id")] = " ".join(_chaines(p))
                    continue
                commande = attente.pop(p.get("call_id"), None)
                if commande is None:
                    continue
                for sortie in _sorties(p.get("output")):
                    lignes = sortie.replace("\r\n", "\n").split("\n")
                    if "DefaultEngine.ini' -TotalCount 65" in commande and lignes and lignes[0] == "[URL]":
                        for n, l in enumerate(lignes[:65], 1):
                            temoins[n] = l
                    elif RG_SUR_L_INI_SEUL.search(commande):
                        for l in lignes:
                            m = re.match(r"^(\d+):(.*)$", l)
                            if m:
                                temoins.setdefault(int(m.group(1)), m.group(2))
    return temoins


def _chaines(o):
    if isinstance(o, str):
        yield o
    elif isinstance(o, dict):
        for v in o.values():
            yield from _chaines(v)
    elif isinstance(o, list):
        for v in o:
            yield from _chaines(v)


def _sorties(brut):
    """Les champs `output` des morceaux JSON qu'une sortie d'outil de Codex emboîte : la
    sortie est une liste de textes, dont certains sont eux-mêmes `{"chunk_id":…,"output":…}`."""
    if isinstance(brut, str):
        try:
            brut = json.loads(brut)
        except ValueError:
            pass
    for s in _chaines(brut):
        if '"output"' not in s:
            continue
        try:
            d = json.loads(s)
        except ValueError:
            continue
        if isinstance(d, dict) and isinstance(d.get("output"), str):
            yield d["output"]


def numeros_du_15_09(final):
    """Pour chaque ligne du fichier rebâti, son numéro dans le fichier du 15/09 (None si
    elle lui est postérieure). Seul ajout connu depuis : le bloc du 23/09, reconnu à son
    texte — les réglages MetaHuman remis par l'éditeur puis recommentés."""
    debut = next((i for i, l in enumerate(final) if l and l.startswith("; ── 2026-09-23")), None)
    fin = next((i for i, l in enumerate(final) if l == "; SkeletalMesh.UseExperimentalChunking=1"), None)
    numeros, n = [], 0
    for i in range(len(final)):
        if debut is not None and fin is not None and debut <= i <= fin:
            numeros.append(None)
        else:
            n += 1
            numeros.append(n)
    return numeros


def confronter(final, numeros, temoins):
    """Les lignes lues par Codex le 15/09 sont-elles, dans le fichier rebâti, à la place
    que leur numéro annonce ? Rend (accords, [(numéro, lu, rebâti)])."""
    place = {n: i for i, n in enumerate(numeros) if n is not None}
    accords, ecarts = 0, []
    for n, attendu in sorted(temoins.items()):
        obtenu = final[place[n]] if n in place else None
        if obtenu == attendu:
            accords += 1
        else:
            ecarts.append((n, attendu, obtenu))
    return accords, ecarts


# ── 5. L'assemblage ───────────────────────────────────────────────────────────────────

def rebatir(sans_balayage=False, journal=print):
    base = lire_lignes(BASE)
    while base and base[-1] == "":
        base.pop()
    final = squelette(lire_lignes(RECON))
    trous = sum(1 for l in final if l is None)
    final, combles, laisses = combler(final, base)
    final = noter_commentaires(final, laisses)
    journal(f"reconstitution : {len(final)} lignes ; {trous} jamais relues, {combles} comblées par le "
            f"fichier du 06/09, {sum(b - a + 1 for a, b in laisses)} dans un commentaire (notées)")

    temoins = lectures_codex()
    if temoins:
        accords, ecarts = confronter(final, numeros_du_15_09(final), temoins)
        journal(f"lectures de Codex du 15/09 : {accords} ligne(s) retrouvée(s) à leur place, "
                f"{len(ecarts)} écart(s)")
        for n, attendu, obtenu in ecarts[:12]:
            journal(f"   ÉCART ligne {n} du 15/09 : lu {attendu[:90]!r} / rebâti {str(obtenu)[:90]!r}")
        if ecarts:
            raise SystemExit("ARRÊT : le fichier rebâti contredit ce que Codex a lu le 15/09.")
    else:
        journal("lectures de Codex du 15/09 : journaux absents — AUCUNE vérification de ce côté")

    with open(INI_JEU, encoding="utf-8-sig", errors="replace") as f:
        exclus = jamais_cuits(f.read())
    releve = os.path.join(SORTIE, "mentions_hors_pack.json")
    if sans_balayage and os.path.exists(releve):
        with open(releve, encoding="utf-8") as f:
            d = json.load(f)
        cites, lus, malades = {k: set(v) for k, v in d["cites"].items()}, d["lus"], d["malades"]
        journal(f"relevé réemployé : {lus} paquets, {len(malades)} malades")
    else:
        journal("balayage de Content\\Narvos (en-têtes seulement)…")
        cites, lus, malades = balayer(CONTENT, exclus, lambda n: journal(f"   {n} paquets lus"))
        os.makedirs(SORTIE, exist_ok=True)
        with open(releve, "w", encoding="utf-8", newline="\n") as f:
            json.dump({"lus": lus, "malades": malades, "cites": {k: sorted(v) for k, v in cites.items()}},
                      f, ensure_ascii=False, indent=1)
    redirects = redirects_actifs(final)
    ecrire, orphelins, hors_cook = bloc_ville(cites, redirects, existe_sur_disque(CONTENT), exclus)

    # Ce que rien ne couvre, par racine : à lire avant de cuire, pas à corriger ici.
    restes = collections.Counter()
    for paquet, anciens in cites.items():
        for a in anciens:
            if not couvert(a, redirects) and not a.startswith(PREFIXES_VILLE):
                restes[a.split("/")[2]] += 1

    bloc = ["",
            "; ── Ville : références exactes — REBÂTIES le 2026-10-03 après la perte du disque ──────",
            "; Astra avait écrit ici, le 15/09, 109 + 22 + 70 redirects exacts (CITY_PACK et",
            "; City_Traffic_Pro : copies promues sous Narvos/, ressources de démo dupliquées sous",
            "; Narvos/DependancesVille, matériaux d'origine restaurés). Ses listes sont perdues.",
            "; Celles-ci sont régénérées par sa règle depuis l'état du disque : un redirect par",
            "; ancien chemin ENCORE cité par un paquet qui cuit, vers la copie promue si elle",
            "; existe, sinon vers DependancesVille (scripts/recuperation/rebatir-ini-moteur.py).",
            "; Exacts, sans MatchSubstring : la cible ne peut pas être réappliquée à elle-même.",
            "[CoreRedirects]"]
    bloc += [f'+PackageRedirects=(OldName="{a}",NewName="{n}")' for a, n in ecrire]
    rapport = [f"paquets de Narvos lus : {lus} ; fichiers malades (en-tête illisible) : {len(malades)}",
               f"redirects déjà connus : {len(redirects)}",
               f"redirects exacts de la ville régénérés : {len(ecrire)} "
               f"(dont {sum(1 for _, n in ecrire if n.startswith(DEPENDANCES_VILLE))} vers DependancesVille ; "
               f"Astra en avait écrit 109 + 22 + 70 = 201)",
               f"anciens chemins de la ville SANS cible nulle part : {len(orphelins)}",
               f"cibles dans un dossier jamais cuit : {len(hors_cook)}",
               "mentions hors pack qu'aucun redirect ne couvre, par racine : "
               + (", ".join(f"{r}×{n}" for r, n in restes.most_common(25)) or "aucune")]
    for l in rapport:
        journal(l)
    return final + (bloc if ecrire else []), rapport, orphelins, hors_cook, malades


def main():
    final, rapport, orphelins, hors_cook, malades = rebatir("--sans-balayage" in sys.argv)
    os.makedirs(SORTIE, exist_ok=True)
    sortie = os.path.join(SORTIE, "DefaultEngine.ini")
    with open(sortie, "w", encoding="utf-8", newline="") as f:
        f.write("\r\n".join(final) + "\r\n")
    with open(os.path.join(SORTIE, "RAPPORT.txt"), "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(rapport) + "\n\n— anciens chemins sans cible (et qui les cite) :\n")
        for a, qui in sorted(orphelins.items()):
            f.write(f"{a}\n" + "".join(f"    <- {q}\n" for q in qui[:6]))
        f.write("\n— redirects dont la cible est dans un dossier jamais cuit :\n")
        f.write("".join(f"{a} -> {n}\n" for a, n in hors_cook))
        f.write("\n— fichiers malades :\n" + "".join(m + "\n" for m in malades))
    print("écrit :", sortie, f"({len(final)} lignes)")
    if "--installer" in sys.argv:
        if os.path.exists(CIBLE):
            raise SystemExit(f"REFUS : {CIBLE} existe déjà — on n'écrase pas un ini de l'ADK.")
        import shutil
        shutil.copyfile(sortie, CIBLE)
        print("installé :", CIBLE)


if __name__ == "__main__":
    main()
