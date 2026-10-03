# ══════════════════════════════════════════════════════════════════════════════
# adk-sonder-worldgrid.py — quel WorldGridMaterial gagne, celui du moteur ou
# celui du projet ?
#
#   NARVOS_RACINE=/Game/Narvos/chunks_unreal_v3 \
#   UnrealEditor-Cmd.exe <ADK>.uproject -run=pythonscript -script="…"
#
# ── LA QUESTION, ET POURQUOI ELLE DÉCIDE DU CORRECTIF ─────────────────────────
# Un GLB qui nomme son matériau `WorldGridMaterial` fabrique un homonyme de
# `/Engine/EngineMaterials/WorldGridMaterial`. Deux issues, deux réparations
# opposées :
#
#   slot -> /Engine/…      Interchange a substitué le matériau du MOTEUR. Le
#                          matériau de projet existe mais n'est référencé par
#                          personne. Renommer côté Unreal ne changerait RIEN :
#                          `rename_asset` ne réécrit que les références vers
#                          l'asset renommé. Il faut renommer DANS LE GLB et
#                          réimporter.
#
#   slot -> /Game/…        Le bon matériau est bien référencé. Le gris vient
#                          alors du GRAPHE du matériau — ses textures ne sont pas
#                          câblées — et il faut le reconstruire, pas réimporter.
#
# Se tromper de branche coûte un import et un cook, soit une demi-heure, pour
# revenir au même gris.
#
# On imprime aussi combien de Texture2D le paquet du matériau référence : un
# matériau correctement câblé en dépend, un matériau vide n'en dépend d'aucune.
# ══════════════════════════════════════════════════════════════════════════════

import os

import unreal

RACINE = os.environ.get("NARVOS_RACINE", "/Game/Narvos/chunks_unreal_v3").replace("\\", "/").strip()
MOTIF = os.environ.get("NARVOS_MOTIF", "Landscape")


def journal(message):
    unreal.log("[NARVOS] " + message)


registre = unreal.AssetRegistryHelpers.get_asset_registry()
options = unreal.AssetRegistryDependencyOptions(include_hard_package_references=True)

vus = 0
for donnees in registre.get_assets_by_path(RACINE, recursive=True):
    if str(donnees.asset_class_path.asset_name) != "StaticMesh":
        continue
    nom = str(donnees.asset_name)
    if MOTIF not in nom:
        continue

    mesh = donnees.get_asset()
    if mesh is None:
        continue

    for slot in mesh.get_editor_property("static_materials") or []:
        interface = slot.get_editor_property("material_interface")
        if interface is None:
            journal("%-34s slot VIDE" % nom)
            continue
        chemin = interface.get_path_name()
        journal("%-34s -> %s" % (nom, chemin))
    vus += 1
    if vus >= 8:
        break

# ── Le matériau de projet, s'il existe : à quoi tient-il ? ────────────────────

paquet = RACINE + "/WorldGridMaterial"
journal("")
journal("=== paquet de projet : " + paquet)

trouve = registre.get_assets_by_package_name(unreal.Name(paquet)) or []
if not trouve:
    journal("  ABSENT — Interchange n'a pas cree de materiau de projet.")
else:
    for d in trouve:
        journal("  %s : %s" % (d.asset_class_path.asset_name, d.asset_name))
    deps = registre.get_dependencies(unreal.Name(paquet), options) or []
    textures = []
    for dep in deps:
        for d in registre.get_assets_by_package_name(dep) or []:
            if str(d.asset_class_path.asset_name) == "Texture2D":
                textures.append(str(d.asset_name))
    journal("  dependances Texture2D : %d" % len(textures))
    for t in textures:
        journal("    " + t)

journal("")
journal("=== moteur")
journal("  /Engine/EngineMaterials/WorldGridMaterial existe : %s"
        % unreal.EditorAssetLibrary.does_asset_exist("/Engine/EngineMaterials/WorldGridMaterial"))