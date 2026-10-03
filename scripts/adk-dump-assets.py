# ══════════════════════════════════════════════════════════════════════════════
# adk-dump-assets.py — sort l'inventaire typé des assets NARVOS en JSON.
#
#   UnrealEditor-Cmd.exe <ADK>.uproject -run=pythonscript
#       -script="D:/.../scripts/adk-dump-assets.py"
#
# POURQUOI : `nanos-build-asset-pack.mjs` doit ranger chaque asset dans la bonne
# section d'`Assets.toml` (`skeletal_meshes`, `static_meshes`, `animations`…).
# Classer par PRÉFIXE DE NOM (`SK_`, `SM_`, `A_`) semblait suffire — la mesure dit
# non : sur 611 SkeletalMesh importés, 44 seulement portent `SK_`. Les autres
# s'appellent `FaceRigTest`, `ThirdPersonIdle`, `SovietZombie1`… et seraient
# rangés en `others`.
#
# Le registre d'assets d'Unreal, lui, connaît la classe RÉELLE de chaque asset.
# C'est la seule source qui ne se trompe pas, et elle n'est lisible que d'ici.
# ══════════════════════════════════════════════════════════════════════════════

import json
import os

import unreal

RACINE = "/Game/Narvos"
SORTIE = "E:/narvosprime-web-prototype/WebPortal/Server/adk/_assets-inventory.json"


def journal(message):
    unreal.log("[NARVOS] " + message)


registre = unreal.AssetRegistryHelpers.get_asset_registry()
actifs = registre.get_assets_by_path(RACINE, recursive=True)

journal("%d asset(s) sous %s" % (len(actifs), RACINE))

entrees = []
par_classe = {}

for a in actifs:
    classe = str(a.asset_class_path.asset_name)
    nom = str(a.asset_name)
    # `package_name` est le chemin logique sans extension : /Game/Narvos/Pack/SK_Truc
    paquet = str(a.package_name)

    par_classe[classe] = par_classe.get(classe, 0) + 1
    entrees.append({"nom": nom, "classe": classe, "paquet": paquet})

for c in sorted(par_classe, key=lambda k: -par_classe[k]):
    journal("    %-30s %d" % (c, par_classe[c]))

os.makedirs(os.path.dirname(SORTIE), exist_ok=True)
with open(SORTIE, "w", encoding="utf-8") as fh:
    json.dump({"racine": RACINE, "total": len(entrees), "assets": entrees}, fh, indent=1)

journal("inventaire ecrit : %s" % SORTIE)