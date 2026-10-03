# -*- coding: utf-8 -*-
"""
adk-sonder-phys-roues.py — LIRE les PhysicsAssets des voitures. Ne modifie rien.

    "D:/Epic Games/UE_5.7/Engine/Binaries/Win64/UnrealEditor-Cmd.exe" \
        WebPortal/Server/adk/NanosWorldADK.uproject \
        -run=pythonscript -script=scripts/adk-sonder-phys-roues.py \
        -unattended -nosplash

POURQUOI UNE SONDE AVANT LE CORRECTIF
─────────────────────────────────────
Le doc nanos interdit toute forme de collision sur les os de roue. La sonde
binaire (`scripts/narvos-phys-roues.mjs`) a établi que les 12 voitures en
portent — mais elle lit la table de NOMS : elle prouve qu'un corps existe,
pas ce qu'il contient ni comment le retirer.

Ce script demande à l'éditeur lui-même. Il répond à trois questions dont
dépend la forme du correctif :

  1. `skeletal_body_setups` est-il seulement LISIBLE depuis Python ?
  2. Combien de formes chaque corps de roue porte-t-il, et de quel type ?
  3. Les contraintes (`constraint_setup`) référencent-elles les roues ? Retirer
     un corps sans sa contrainte laisse une contrainte pendante.

Aucun `save_asset` ici. Une sonde qui écrit n'est plus une sonde.
"""
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8")   # accents + filets, flux cp1252
except Exception:
    pass

import unreal

DOSSIER = "/Game/Narvos/City_Traffic_Pro/Cars/Meshes/Skeletal_Meshes"
ROUES = ("Wheel_FL", "Wheel_FR", "Wheel_RL", "Wheel_RR")


def dire(t):
    print(t)
    unreal.log(t)


ar = unreal.AssetRegistryHelpers.get_asset_registry()
assets = ar.get_assets_by_path(DOSSIER, recursive=False)
phys = [a for a in assets if str(a.asset_class_path.asset_name) == "PhysicsAsset"]

dire("%d PhysicsAsset(s) sous %s" % (len(phys), DOSSIER))
if not phys:
    # Zéro cible = rouge. Jamais « vert par vacuité ».
    dire("AUCUNE CIBLE — le chemin a changé, ou les assets ne sont pas importés.")
    sys.exit(1)

total_roues = 0
illisibles = 0   # toute propriete refusee : le bilan devient ROUGE
for a in sorted(phys, key=lambda x: str(x.package_name)):
    chemin = str(a.package_name)
    obj = unreal.EditorAssetLibrary.load_asset(chemin)
    nom = chemin.rsplit("/", 1)[-1]
    if obj is None:
        dire("%-34s NON CHARGEABLE" % nom)
        continue

    # ── 1. les corps ─────────────────────────────────────────────────────────
    try:
        corps = obj.get_editor_property("skeletal_body_setups")
        lisible = True
    except Exception as e:
        corps, lisible = [], False
        illisibles += 1
        dire("%-34s skeletal_body_setups ILLISIBLE : %s" % (nom, e))

    dire("")
    dire("=== %s ===" % nom)
    dire("  corps : %d  (propriete %s)" % (len(corps), "lisible" if lisible else "ILLISIBLE"))

    for bs in corps:
        try:
            os_nom = str(bs.get_editor_property("bone_name"))
        except Exception:
            os_nom = "?"
        detail = []
        try:
            agg = bs.get_editor_property("agg_geom")
            for champ, etiq in (
                ("sphere_elems", "sphere"),
                ("box_elems", "boite"),
                ("sphyl_elems", "capsule"),
                ("convex_elems", "convexe"),
                ("tapered_capsule_elems", "capsule_conique"),
            ):
                try:
                    n = len(agg.get_editor_property(champ))
                    if n:
                        detail.append("%s x%d" % (etiq, n))
                except Exception:
                    pass
        except Exception as e:
            detail.append("agg_geom illisible (%s)" % e)

        marque = "  <<< ROUE" if os_nom in ROUES else ""
        if os_nom in ROUES:
            total_roues += 1
        dire("    %-14s %s%s" % (os_nom, ", ".join(detail) or "aucune forme", marque))

    # ── 2. les contraintes ───────────────────────────────────────────────────
    # Retirer un corps sans sa contrainte laisserait une contrainte pendante :
    # il faut savoir si les roues en ont.
    try:
        cs = obj.get_editor_property("constraint_setup")
        liees = []
        for c in cs:
            try:
                p = c.get_editor_property("default_instance")
                b1 = str(p.get_editor_property("constraint_bone1"))
                b2 = str(p.get_editor_property("constraint_bone2"))
                if b1 in ROUES or b2 in ROUES:
                    liees.append("%s<->%s" % (b1, b2))
            except Exception:
                pass
        dire("  contraintes : %d, dont sur roues : %s" % (len(cs), ", ".join(liees) or "aucune"))
    except Exception as e:
        dire("  contraintes : ILLISIBLES (%s)" % e)
        illisibles += 1

dire("")
dire("Sonde terminee — RIEN n'a ete modifie ni sauve.")

# ⚠ LE ZERO QUI MENT — incident du 2026-09-10, dans CE fichier.
#
# Premiere execution : `skeletal_body_setups` et `constraint_setup` ne sont PAS
# exposes a Python en UE 5.7 (« Failed to find property »). Les 12 assets ont
# donc rendu « corps : 0 », et le bilan a imprime :
#
#     TOTAL : 0 corps sur des os de roue, sur 12 PhysicsAsset(s).
#
# Lu vite, ca dit « les roues sont propres ». Ca disait en realite « je n'ai
# rien pu lire ». La sonde binaire (`scripts/narvos-phys-roues.mjs`), elle,
# avait deja etabli le contraire sur les MEMES assets : corps sur les 4 roues,
# 12 fois sur 12.
#
# Un compteur qui vaut zero parce que la mesure a echoue doit etre ROUGE, pas
# nul. La regle du projet : *si ca ne marchait pas, ce temoin dirait-il quelque
# chose ?* — ici il disait la meme chose que le succes parfait.
if illisibles:
    dire("")
    dire("ROUGE : %d propriete(s) illisible(s) — la sonde n'a RIEN mesure." % illisibles)
    dire("       Le total ci-dessous ne vaut rien ; ne pas le lire comme « propre ».")
    dire("       Introspection de ce que Python expose reellement :")
    try:
        modele = unreal.load_asset(str(sorted(phys, key=lambda x: str(x.package_name))[0].package_name))
        noms = [n for n in dir(modele) if not n.startswith("_")]
        dire("       %s" % ", ".join(noms))
    except Exception as e:
        dire("       introspection impossible : %s" % e)
    dire("       Repli qui marche sans editeur : node scripts/narvos-phys-roues.mjs")
    sys.exit(1)

dire("TOTAL : %d corps sur des os de roue, sur %d PhysicsAsset(s)." % (total_roues, len(phys)))