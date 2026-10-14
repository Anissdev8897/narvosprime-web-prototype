# -*- coding: utf-8 -*-
"""
manifeste-filtrer.py — réduit un manifeste d'import (narvos-skeleton-compat.mjs ou
narvos-manifeste-brut.mjs) aux seuls PACKS nommés, sans toucher à sa racine.

  python manifeste-filtrer.py <manifeste entrée> <manifeste sortie> <pack> [<pack> ...]

POURQUOI. Rebâtir l'ADK rejoue les imports d'origine, mais le dossier source a grossi
depuis : rejouer `public/models/personnages` EN ENTIER importerait aussi `_parts_png`
(créé le 08/09), que l'inventaire du 23/09 ne connaît pas sous ce nom. Un paquet en trop
décale les clés suffixées `_N` du pack. On n'importe donc que les packs MANQUANTS
(`etat-adk.py`), et la racine du manifeste reste celle d'origine : c'est elle qui décide
du dossier de destination (`/Game/Narvos/<chemin relatif à la racine>`).

Un « pack » est le PREMIER dossier du chemin relatif à la racine. Un pack demandé et
absent du manifeste arrête l'outil : mieux vaut ne rien écrire qu'un manifeste tronqué
sans le dire.
"""
import collections
import json
import sys


def filtrer(manifeste, packs):
    """(manifeste réduit, {pack: nombre de fichiers gardés}).

    Lève ValueError si un pack demandé n'a aucun fichier, ou si un fichier du manifeste
    n'est pas sous sa racine (on ne saurait pas dire à quel pack il appartient)."""
    racine = manifeste["racine"].replace("\\", "/").rstrip("/") + "/"
    voulus = {p.lower(): p for p in packs}
    gardes, compte = [], collections.Counter()
    for entree in manifeste["fichiers"]:
        chemin = entree["fichier"].replace("\\", "/")
        if not chemin.lower().startswith(racine.lower()):
            raise ValueError(f"fichier hors de la racine du manifeste : {chemin}")
        pack = chemin[len(racine):].split("/", 1)[0]
        if pack.lower() in voulus:
            gardes.append(entree)
            compte[voulus[pack.lower()]] += 1
    absents = [p for p in packs if not compte[p]]
    if absents:
        raise ValueError("pack(s) sans aucun fichier dans le manifeste : " + ", ".join(absents))
    reduit = dict(manifeste)
    reduit["fichiers"] = gardes
    reduit["importables"] = len(gardes)
    reduit["reference"] = (str(manifeste.get("reference", "")) + " — réduit à : " + ", ".join(packs)).strip(" —")
    return reduit, dict(compte)


def main():
    if len(sys.argv) < 4:
        raise SystemExit(__doc__)
    entree, sortie, packs = sys.argv[1], sys.argv[2], sys.argv[3:]
    with open(entree, encoding="utf-8") as f:
        manifeste = json.load(f)
    try:
        reduit, compte = filtrer(manifeste, packs)
    except ValueError as erreur:
        raise SystemExit(f"ARRÊT : {erreur}")
    with open(sortie, "w", encoding="utf-8", newline="\n") as f:
        json.dump(reduit, f, ensure_ascii=False, indent=2)
    print(f"{len(manifeste['fichiers'])} fichier(s) au manifeste d'origine, {len(reduit['fichiers'])} gardé(s)")
    for pack in packs:
        print(f"   {compte[pack]:5}  {pack}")
    print("racine  :", reduit["racine"])
    print("écrit   :", sortie)


if __name__ == "__main__":
    main()
