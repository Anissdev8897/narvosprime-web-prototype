# -*- coding: utf-8 -*-
"""
adk-sonder-api-physics.py — QUE sait faire Python sur un PhysicsAsset en 5.7 ?

Ne modifie rien. Ecrit pour repondre a une question precise : la sonde du
2026-09-10 a echoue sur `skeletal_body_setups` et `constraint_setup`
(« Failed to find property »). Avant d'ecrire un correctif, il faut savoir ce
qui EST expose — pas ce qu'on espere.
"""
import sys
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

import unreal

CIBLE = "/Game/Narvos/City_Traffic_Pro/Cars/Meshes/Skeletal_Meshes/SK_Executive_Sedan_PhysicsAsset"
MESH = "/Game/Narvos/City_Traffic_Pro/Cars/Meshes/Skeletal_Meshes/SK_Executive_Sedan"


def dire(t):
    print(t)
    unreal.log(t)


pa = unreal.EditorAssetLibrary.load_asset(CIBLE)
dire("PhysicsAsset charge : %s" % (pa is not None))
if pa is None:
    dire("ARRET : cible introuvable, rien a introspecter.")
    sys.exit(1)

dire("classe : %s" % type(pa).__name__)

# 1. Les proprietes reellement exposees.
props = []
for n in dir(pa):
    if n.startswith("_"):
        continue
    try:
        pa.get_editor_property(n)
        props.append(n)
    except Exception:
        pass
dire("\n--- proprietes lisibles par get_editor_property (%d) ---" % len(props))
dire("  " + ", ".join(sorted(props)) if props else "  AUCUNE")

dire("\n--- tout dir() (%d) ---" % len(dir(pa)))
dire("  " + ", ".join(n for n in dir(pa) if not n.startswith("_")))

# 2. Les outils du module `unreal` qui parlent de physique / body setup.
dire("\n--- symboles unreal.* lies a la physique ---")
mots = ("PhysicsAsset", "BodySetup", "AggregateGeom", "PhysicsControl",
        "SkeletalBody", "PhysicsConstraint")
trouves = []
for n in dir(unreal):
    if any(m.lower() in n.lower() for m in mots):
        trouves.append(n)
for n in sorted(trouves):
    dire("  %s" % n)

# 3. Ce que le SkeletalMesh expose de son cote (l'autre bout du probleme :
#    on pourrait aussi POINTER vers un autre PhysicsAsset au lieu d'editer
#    celui du pack).
sk = unreal.EditorAssetLibrary.load_asset(MESH)
if sk is not None:
    dire("\n--- SkeletalMesh : proprietes lisibles ---")
    lisibles = []
    for n in dir(sk):
        if n.startswith("_"):
            continue
        try:
            sk.get_editor_property(n)
            lisibles.append(n)
        except Exception:
            pass
    dire("  " + ", ".join(sorted(lisibles)))

# 4. Un BodySetup est-il atteignable autrement ? Les sous-objets d'un package.
dire("\n--- sous-objets du package (les corps sont des sous-objets) ---")
try:
    paquet = pa.get_outer() if hasattr(pa, "get_outer") else None
    dire("  outer : %s" % paquet)
except Exception as e:
    dire("  outer illisible : %s" % e)

try:
    sous = unreal.EditorAssetLibrary.find_asset_data(CIBLE)
    dire("  asset_data : %s" % sous.asset_class_path.asset_name)
except Exception as e:
    dire("  find_asset_data : %s" % e)

dire("\nIntrospection terminee — RIEN n'a ete modifie.")