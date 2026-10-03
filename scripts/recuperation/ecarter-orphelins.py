# -*- coding: utf-8 -*-
"""
ecarter-orphelins.py — sort du projet les fichiers qu'AUCUNE source ne produit plus et
qui ne devraient pas y être : restes d'un assemblage antérieur (fichiers du lot Hermes
rangés au mauvais endroit, fichiers DMDE corrompus posés avant le test de santé strict).

Rien n'est supprimé : chaque fichier est DÉPLACÉ dans
`E:\\mes_projet\\_orphelins_reassemblage_<date>\\`, à son chemin relatif.

Ne sont JAMAIS écartés : ce qui est né après la perte et sert au projet
(`package.json`, `package-lock.json`), et les dossiers `.reconstruit`.

  python ecarter-orphelins.py [--ecrire]
"""
import datetime
import os
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sante import fichier_sain  # noqa: E402
from lots import PROJET, LOTS  # noqa: E402

GARDES = ("package.json", "package-lock.json")
# Les rapports de la récupération elle-même : écrits après la perte, aucune source ne
# les « produit » — ce sont pourtant les seuls documents qui disent ce qui a été fait.
NES_APRES = (os.path.join(".hermes", "RAPPORT_RECUPERATION_"),)
# Un dossier PAR PASSAGE : voir assembler-final.py.
DESTINATION = os.path.join(LOTS, "_orphelins_reassemblage_" + datetime.datetime.now().strftime("%Y-%m-%d_%Hh%M"))
PRECEDENT = os.path.join(LOTS, "ASSEMBLAGE_precedent.tsv")


def poses_avant():
    """Ce que l'assemblage PRÉCÉDENT avait posé dans des dossiers `.reconstruit` (chemins
    relatifs, casse normalisée).

    Un dossier `.reconstruit` porte deux choses : un vrai dossier d'avant, renommé quand
    une jonction a pris sa place — à ne jamais toucher —, et les fichiers reconstruits
    qu'un assemblage y pose pour ne pas écrire à travers la jonction. Seuls les seconds
    peuvent devenir des restes : si l'extraction ne les produit plus (un manifeste au
    contenu inventé par un rejeu à l'aveugle, écarté depuis), ils doivent sortir."""
    poses = set()
    if os.path.exists(PRECEDENT):
        with open(PRECEDENT, encoding="utf-8") as f:
            for l in f:
                c = l.rstrip("\n").split("\t")
                if c[0] == "HORS_JONCTION" and len(c) >= 4:
                    poses.add(os.path.normcase(c[3]))
    return poses


def main():
    ecrire = "--ecrire" in sys.argv
    avant = poses_avant()
    with open(os.path.join(PROJET, "ASSEMBLAGE.tsv"), encoding="utf-8") as f:
        orphelins = [l.rstrip("\n").split("\t")[1] for l in f if l.startswith("ORPHELIN\t")]
    for rel in orphelins:
        src = os.path.join(PROJET, rel)
        if not os.path.isfile(src):
            continue
        reste = ".reconstruit" + os.sep in rel and os.path.normcase(rel) in avant
        # Un JSON valide que l'assembleur a laissé en place, la reconstruction (à marqueurs)
        # posée à côté en `.reconstruit` : c'est lui qui sert, il reste.
        a_cote = os.path.exists(src + ".reconstruit")
        if (os.path.basename(rel) in GARDES or (".reconstruit" + os.sep in rel and not reste) or a_cote
                or rel.startswith(NES_APRES)):
            print("gardé    ", rel + ("   (JSON valide, reconstruction à côté)" if a_cote else ""))
            continue
        raison = "sain, hors des sources" if fichier_sain(src) else "CORROMPU"
        print(f"écarté    {rel}   ({raison})")
        if ecrire:
            dst = os.path.join(DESTINATION, rel)
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.move(src, dst)
            # Un dossier laissé vide par ce départ n'a plus lieu d'être.
            d = os.path.dirname(src)
            while d != PROJET and os.path.isdir(d) and not os.listdir(d):
                os.rmdir(d)
                d = os.path.dirname(d)
    print("destination :", DESTINATION if ecrire else "(simulation — passer --ecrire)")


if __name__ == "__main__":
    main()
