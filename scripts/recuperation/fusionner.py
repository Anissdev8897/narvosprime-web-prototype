# -*- coding: utf-8 -*-
"""
fusionner.py — réunit les deux reconstructions des packages nanos :

  A. E:\\mes_projet\\narvos-rebuild\\nanos_world\\packages     (Hermes, 28/09)
  B. E:\\mes_projet\\narvos-reconstruit-v4\\fichiers\\WebPortal\\Server\\nanos_world\\packages
     (extraire-historiques.py : Claude Code + sous-agents + Hermes) — autre dossier : --b=

RÈGLE (refaite le 01/10/2026, après mesure) :

  1. L'EXTRACTION (B) GAGNE PARTOUT OÙ ELLE A LE FICHIER. Elle rejoue dans l'ordre du
     temps TOUS les historiques, ceux d'Hermes compris : le lot A ne sait rien qu'elle
     ne sache. Mesuré sur les 52 fichiers du lot A : 27 identiques à B ; les autres
     sont des reconstructions PARTIELLES sans marqueur (« LIGNES 141-239 NON
     RÉCUPÉRÉES » écrit en commentaire, `Sorts.lua` rendu en 443 lignes quand le
     fichier en comptait 625), des versions plus anciennes, ou des fichiers corrompus.
     L'ancienne règle — « un fichier sans marqueur bat un fichier troué » — prenait
     ces reconstructions partielles pour des fichiers complets.
  2. Un fichier présent SEULEMENT dans A n'est repris que s'il est sain et qu'aucun
     fichier du même nom n'existe ailleurs dans B (le lot A range des fichiers au
     mauvais endroit : `narvos/Server/Fouille.lua` est `narvos-map-proto/Server/…`).
     Il est alors signalé : écrit par Hermes APRÈS la perte, donc non vérifié.
  3. Rien n'est supprimé : ce qui n'est pas retenu part dans `_ecartes/hermes/`.

Sortie : un arbre fusionné + FUSION.tsv (décision, raison, tailles).

  python fusionner.py [<sortie>] [--b=<packages de l'extraction>] [--ecrire]
"""
import os
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sante import fichier_sain  # noqa: E402

# Les lots de récupération vivent sur E:\mes_projet depuis le 30/09/2026.
A = r"E:\mes_projet\narvos-rebuild\nanos_world\packages"
B = next((a[4:] for a in sys.argv if a.startswith("--b=")),
         r"E:\mes_projet\narvos-reconstruit-v4\fichiers\WebPortal\Server\nanos_world\packages")
SORTIE = next((a for a in sys.argv[1:] if not a.startswith("--")), r"E:\mes_projet\narvos-fusion\packages")
ECRIRE = "--ecrire" in sys.argv


def lister(racine):
    out = {}
    for dossier, _, fichiers in os.walk(racine):
        for n in fichiers:
            p = os.path.join(dossier, n)
            out[os.path.relpath(p, racine).lower().replace("/", "\\")] = p
    return out


def corrompu(chemin):
    """Un fichier rendu par DMDE dont les clusters ont été réalloués : pas du texte
    (sante.py — UTF-8 strict). Il ne vaut rien, même « complet »."""
    try:
        return os.path.getsize(chemin) == 0 or not fichier_sain(chemin)
    except Exception:
        return True


def juger(rel, pa, pb, noms_b):
    """Rend (retenu ou None, écarté ou None, raison)."""
    if pb:
        return pb, pa, "extraction" if pa else "seulement l'extraction"
    if corrompu(pa):
        return None, pa, "Hermes seul, corrompu"
    ailleurs = noms_b.get(os.path.basename(rel))
    if ailleurs:
        return None, pa, "Hermes seul, mal rangé : existe en " + ailleurs
    return pa, None, "Hermes seul — écrit après la perte, NON VÉRIFIÉ"


def main():
    a, b = lister(A), lister(B)
    noms_b = {}
    for rel in b:
        noms_b.setdefault(os.path.basename(rel), rel)
    lignes, compte = [], {}
    if ECRIRE:
        # La sortie est un produit dérivé : on repart de zéro, sinon les fichiers d'un
        # passage précédent (autre règle, autre extraction) resteraient mêlés aux neufs.
        if "narvosprime-web-prototype" in SORTIE.lower() or os.path.basename(SORTIE) != "packages":
            sys.exit("refus : la sortie doit être un dossier `packages` HORS du projet (elle est effacée)")
        shutil.rmtree(SORTIE, ignore_errors=True)
        shutil.rmtree(os.path.join(os.path.dirname(SORTIE), "_ecartes"), ignore_errors=True)
    for rel in sorted(set(a) | set(b)):
        pa, pb = a.get(rel), b.get(rel)
        retenu, ecarte, raison = juger(rel, pa, pb, noms_b)
        compte[raison.split(" : ")[0]] = compte.get(raison.split(" : ")[0], 0) + 1
        lignes.append((rel, "hermes" if retenu and retenu == pa else ("extraction" if retenu else "aucun"), raison,
                       os.path.getsize(pa) if pa else 0, os.path.getsize(pb) if pb else 0))
        if not ECRIRE:
            continue
        if retenu:
            # Le chemin écrit garde la CASSE du fichier retenu, pas la clé.
            cible = os.path.join(SORTIE, os.path.relpath(retenu, A if retenu == pa else B))
            os.makedirs(os.path.dirname(cible), exist_ok=True)
            shutil.copy2(retenu, cible)
        if ecarte:
            cible = os.path.join(os.path.dirname(SORTIE), "_ecartes", "hermes", os.path.relpath(ecarte, A))
            os.makedirs(os.path.dirname(cible), exist_ok=True)
            shutil.copy2(ecarte, cible)
    if ECRIRE:
        with open(os.path.join(os.path.dirname(SORTIE), "FUSION.tsv"), "w", encoding="utf-8", newline="\n") as f:
            f.write("chemin\tretenu\traison\toctets_hermes\toctets_extraction\n")
            for l in lignes:
                f.write("\t".join(str(x) for x in l) + "\n")
    print(f"{len(lignes)} fichier(s)")
    for raison, n in sorted(compte.items(), key=lambda x: -x[1]):
        print(f"  {n:4}  {raison}")
    print(f"sortie : {SORTIE}" + ("" if ECRIRE else "   (simulation — passer --ecrire)"))


if __name__ == "__main__":
    main()
