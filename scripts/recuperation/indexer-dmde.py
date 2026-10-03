# -*- coding: utf-8 -*-
"""
indexer-dmde.py — cherche, dans TOUS les lots rendus par DMDE, les fichiers texte
sains qui sont une version d'un fichier du projet, où qu'ils aient été rangés.

DMDE rend les fichiers d'un disque formaté par fragments de l'ancienne table : une
partie garde son chemin (`racine-projet\\scripts\\…`), une autre atterrit dans des
dossiers `$F…` sans nom, ou dans des copies de sauvegarde faites par un agent. Un
tel fichier, s'il est SAIN, est un instantané exact du fichier à sa date de
modification — une source plus sûre que n'importe quelle reconstruction.

Deux façons de savoir à quel fichier du projet il correspond :

  · PAR SA PLACE : il sort d'un dossier dont on connaît l'origine (lots.COPIES) ;
  · PAR SON CONTENU : même nom qu'un fichier de l'extraction, et il lui ressemble
    assez (SEUIL) — et nettement plus qu'à tout autre fichier du même nom.

Sortie : `INDEX_DMDE.tsv` dans le dossier d'extraction —

    chemin du projet <tab> fichier DMDE <tab> date de modification <tab> lignes <tab> ressemblance

`extraire-historiques.py --dmde=…` rejoue alors ces fichiers comme des écritures
complètes à leur date : la suite des événements s'applique par-dessus.

⚠ L'index se calcule contre une extraction faite SANS `--dmde` (sinon l'étalon se
compare à lui-même).

  python indexer-dmde.py <dossier d'extraction>
"""
import datetime
import difflib
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sante import fichier_sain  # noqa: E402
from lots import LOTS, DERIVES, IGNORES, MARQUES, chemin_connu  # noqa: E402

TEXTE = {".lua", ".ts", ".tsx", ".js", ".mjs", ".cjs", ".json", ".css", ".html", ".md", ".txt", ".toml", ".py",
         ".sh", ".ps1", ".yaml", ".yml", ".cpp", ".h", ".ini"}
SEUIL = 0.6                  # ressemblance minimale pour dire « c'est ce fichier-là »
ECART = 0.1                  # … et avance exigée sur le second candidat du même nom
TAILLE_MAX = 2_000_000


def lignes(chemin):
    with open(chemin, encoding="utf-8", errors="replace") as f:
        return f.read().replace("\r\n", "\n").rstrip("\n").split("\n")


def main():
    extraction = sys.argv[1]
    base = os.path.join(extraction, "fichiers")
    par_nom, par_chemin = {}, {}
    for d, dirs, fichiers in os.walk(base):
        for f in fichiers:
            rel = os.path.relpath(os.path.join(d, f), base)
            par_nom.setdefault(f.lower(), []).append(rel)
            par_chemin[os.path.normcase(rel)] = rel

    candidats = []
    for lot in sorted(os.listdir(LOTS)):
        racine = os.path.join(LOTS, lot)
        if not os.path.isdir(racine) or lot.startswith(DERIVES):
            continue
        for d, dirs, fichiers in os.walk(racine):
            dirs[:] = [x for x in dirs if x not in IGNORES]
            for f in fichiers:
                if os.path.splitext(f)[1].lower() in TEXTE and f.lower() in par_nom:
                    candidats.append(os.path.join(d, f))
    print(f"{len(candidats)} fichier(s) des lots portent le nom d'un fichier de l'extraction")

    cache, sortie, compte = {}, [], {"sains": 0, "par place": 0, "par contenu": 0, "ambigus": 0}

    def utiles(rel):
        if rel not in cache:
            cache[rel] = [l for l in lignes(os.path.join(base, rel)) if not any(m in l for m in MARQUES)]
        return cache[rel]

    for p in candidats:
        try:
            if os.path.getsize(p) > TAILLE_MAX or os.path.getsize(p) == 0 or not fichier_sain(p):
                continue
        except OSError:
            continue
        compte["sains"] += 1
        a = lignes(p)
        place = chemin_connu(p)
        if place is not None:
            rel = par_chemin.get(os.path.normcase(place))
            if rel is None:
                continue             # jamais touché par un agent : assembler-final le copiera tel quel
            ress = difflib.SequenceMatcher(None, a, utiles(rel), autojunk=False).ratio()
            compte["par place"] += 1
        else:
            notes = sorted(((difflib.SequenceMatcher(None, a, utiles(r), autojunk=False).ratio(), r)
                            for r in par_nom[os.path.basename(p).lower()]), reverse=True)
            ress, rel = notes[0]
            if ress < SEUIL or (len(notes) > 1 and ress - notes[1][0] < ECART):
                compte["ambigus"] += ress >= SEUIL
                continue
            compte["par contenu"] += 1
        mt = datetime.datetime.fromtimestamp(os.path.getmtime(p), datetime.timezone.utc)
        sortie.append((rel, p, mt.strftime("%Y-%m-%dT%H:%M:%SZ"), len(a), f"{ress:.3f}"))
    sortie.sort()
    with open(os.path.join(extraction, "INDEX_DMDE.tsv"), "w", encoding="utf-8", newline="\n") as f:
        f.write("chemin\tfichier_dmde\tmodifie\tlignes\tressemblance\n")
        for l in sortie:
            f.write("\t".join(str(x) for x in l) + "\n")
    print(f"{compte['sains']} sain(s) : {compte['par place']} situés par leur place, "
          f"{compte['par contenu']} reconnus à leur contenu, {compte['ambigus']} ambigus écartés")
    print(f"-> {len(sortie)} instantané(s) pour {len(set(l[0] for l in sortie))} fichier(s) du projet : INDEX_DMDE.tsv")


if __name__ == "__main__":
    main()
