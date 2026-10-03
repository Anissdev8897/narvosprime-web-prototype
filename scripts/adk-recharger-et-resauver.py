# -*- coding: utf-8 -*-
"""
adk-recharger-et-resauver.py — recharger depuis le DISQUE des assets empoisonnes,
puis les resauver.

  python scripts/ue-remote.py --statement "exec(open(r'E:/narvosprime-web-prototype/scripts/adk-recharger-et-resauver.py', encoding='utf-8').read()); finaliser('/Game/Narvos/Defender')"

── LE PIEGE QU'IL REPARE (paye le 2026-09-11) ────────────────────────────────
Un asset CHARGE alors que sa reference etait morte garde une reference NULLE en
memoire, meme quand la cible reapparait ensuite (redirecteur, duplicata). La
mesure de `adk-reparer-squelettes-promus.py` avait charge les 60 SkeletalMesh
de Defender AVANT la reparation : apres elle, ils avaient toujours
`skeleton = None`, alors que la chaine de redirecteurs etait posee sur disque.

Recharger le PAQUET relit les imports : ils se resolvent par les redirecteurs
jusqu'a la cible finale. Resauver ecrit l'import de la cible finale, et le
.uasset cesse de nommer l'ancien chemin — c'est ce qu'on verifie ensuite sur
disque, dans un autre processus.
"""
import sys
import unreal

EAL = unreal.EditorAssetLibrary
JOURNAL = "E:/narvosprime-web-prototype/WebPortal/Server/adk/_reparer-squelettes.log"


def dire(texte):
    sys.stdout.write(str(texte) + "\n")
    with open(JOURNAL, "a", encoding="utf-8") as f:
        f.write(str(texte) + "\n")


def _classe(chemin):
    try:
        return str(EAL.find_asset_data(chemin).asset_class_path.asset_name)
    except Exception:
        return "?"


def finaliser(racine, classes=("SkeletalMesh",)):
    paquets = sorted({str(a).split(".")[0] for a in EAL.list_assets(racine, recursive=True, include_folder=False)})
    cibles = [p for p in paquets if _classe(p) in classes]
    pkgs = []
    for p in cibles:
        o = unreal.load_asset(p)
        if o is not None:
            pkgs.append(o.get_outermost())
    ok, message = unreal.EditorLoadingAndSavingUtils.reload_packages(
        pkgs, unreal.ReloadPackagesInteractionMode.ASSUME_POSITIVE)
    dire("[R] rechargement de %d paquet(s) : %s %s" % (len(pkgs), ok, message))

    compte, sauves = {}, 0
    for p in cibles:
        o = unreal.load_asset(p)
        sq = o.get_editor_property("skeleton") if (o is not None and _classe(p) == "SkeletalMesh") else None
        cle = sq.get_path_name().split(".")[0] if sq else "None"
        compte[cle] = compte.get(cle, 0) + 1
        if o is not None and EAL.save_asset(p, only_if_is_dirty=False):
            sauves += 1
    dire("[R] squelettes apres rechargement : %s" % compte)
    dire("[R] %d asset(s) resauve(s)" % sauves)