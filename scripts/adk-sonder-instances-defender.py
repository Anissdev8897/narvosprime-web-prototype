# -*- coding: utf-8 -*-
"""
adk-sonder-instances-defender.py — pourquoi les 15 pièces modulaires Defender
sont-elles grises ? Ne modifie rien.

    python scripts/ue-remote.py --fichier scripts/adk-sonder-instances-defender.py

── CE QUI EST DÉJÀ MESURÉ ────────────────────────────────────────────────────
`adk-mesurer-personnages.py` (2026-09-12) : SK_Head1..5, SK_Torso1..5,
SK_Legs1..5 dépendent de ZÉRO texture du projet. Les trois pièces de BASE
(SK_HeadBase, SK_TorsoBase, SK_LegsBase) en ont une — et elles portent le
matériau MAÎTRE `M_UE4ModularCharacter`, là où les quinze autres portent les
instances `MI_UE4ModularCharacter1..5` et `MI_UE4Man_ChestLogo`.

Donc la perte est DANS LES INSTANCES. Reste à savoir laquelle des deux causes :
  · l'instance a perdu son PARENT (promotion/migration) — elle n'hérite plus
    rien, et aucun paramètre ne s'applique ;
  · l'instance a gardé son parent mais ses paramètres TEXTURE sont vides.

On ne répare pas à l'aveugle : on demande à chaque instance son parent, ses
paramètres de texture surchargés, et ceux que le parent expose.
"""
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

import unreal

INSTANCES = [
    "/Game/Narvos/Defender/Demo/Meshes/ModularMeshes/Materials/MaterialInstances/MI_UE4ModularCharacter1",
    "/Game/Narvos/Defender/Demo/Meshes/ModularMeshes/Materials/MaterialInstances/MI_UE4ModularCharacter2",
    "/Game/Narvos/Defender/Demo/Meshes/ModularMeshes/Materials/MaterialInstances/MI_UE4ModularCharacter3",
    "/Game/Narvos/Defender/Demo/Meshes/ModularMeshes/Materials/MaterialInstances/MI_UE4ModularCharacter4",
    "/Game/Narvos/Defender/Demo/Meshes/ModularMeshes/Materials/MaterialInstances/MI_UE4ModularCharacter5",
    "/Game/Narvos/Defender/Demo/Meshes/ModularMeshes/Materials/MaterialInstances/MI_UE4Man_ChestLogo",
]
MAITRE = "/Game/Narvos/Defender/Demo/Meshes/ModularMeshes/Materials/M_UE4ModularCharacter"


def dire(t):
    print(t)
    unreal.log("[NARVOS] " + t)


# ── Le matériau maître : ce qu'il EXPOSE ─────────────────────────────────────

maitre = unreal.EditorAssetLibrary.load_asset(MAITRE)
if maitre is None:
    dire("ARRET : matériau maître introuvable : " + MAITRE)
else:
    try:
        noms = unreal.MaterialEditingLibrary.get_texture_parameter_names(maitre)
        dire("maître %s : %d paramètre(s) de texture" % (maitre.get_name(), len(noms)))
        for n in noms:
            valeur = unreal.MaterialEditingLibrary.get_material_default_texture_parameter_value(maitre, n)
            dire("    %-28s défaut = %s" % (str(n), valeur.get_name() if valeur else "(aucune)"))
    except Exception as err:
        dire("maître : paramètres illisibles — %s" % err)

# ── Les instances : parent, surcharges, valeurs effectives ───────────────────

for chemin in INSTANCES:
    dire("")
    inst = unreal.EditorAssetLibrary.load_asset(chemin)
    if inst is None:
        dire("ABSENTE : " + chemin)
        continue

    parent = None
    try:
        parent = inst.get_editor_property("parent")
    except Exception as err:
        dire("%s : parent illisible — %s" % (inst.get_name(), err))

    dire("%s  parent = %s" % (inst.get_name(), parent.get_path_name() if parent else "AUCUN"))

    # Surcharges réellement écrites dans l'instance.
    try:
        surcharges = inst.get_editor_property("texture_parameter_values") or []
        dire("    %d surcharge(s) de texture" % len(surcharges))
        for s in surcharges:
            info = s.get_editor_property("parameter_info")
            tex = s.get_editor_property("parameter_value")
            dire("      %-28s -> %s" % (str(info.get_editor_property("name")),
                                        tex.get_path_name() if tex else "(vide)"))
    except Exception as err:
        dire("    surcharges illisibles — %s" % err)

    # Valeur EFFECTIVE (héritée ou surchargée) pour chaque paramètre du maître.
    if parent is not None:
        try:
            for n in unreal.MaterialEditingLibrary.get_texture_parameter_names(parent):
                v = unreal.MaterialEditingLibrary.get_material_instance_texture_parameter_value(inst, n)
                dire("      effectif %-24s = %s" % (str(n), v.get_name() if v else "(aucune)"))
        except Exception as err:
            dire("    valeurs effectives illisibles — %s" % err)

dire("")
dire("Fin de sonde — rien n'a été modifié.")