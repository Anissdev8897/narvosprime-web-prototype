# -*- coding: utf-8 -*-
"""
adk-sonder-materiaux-pnj.py — quel materiau chaque slot d'un PNJ reference
REELLEMENT, lu dans la propriete de l'asset charge. Ne modifie rien.

    UnrealEditor-Cmd.exe <ADK>.uproject -run=pythonscript \
      -script="<...>/scripts/adk-sonder-materiaux-pnj.py" \
      -unattended -nosplash -nopause

Ecrit `WebPortal/Server/adk/_materiaux-pnj.json`.

-- POURQUOI CETTE SONDE EXISTE -------------------------------------------------
Le 2026-09-12, deux lectures « sur disque » se sont contredites :

  1. la table de noms du SkeletalMesh cite `/Game/Narvos/pnj/soldat_femme/Material`,
     et aucun `Material.uasset` n'existe — d'ou le diagnostic « renommage
     Interchange », et 20 PackageRedirects Material -> Material_1 ;
  2. apres recook, la chaine est TOUJOURS la, et `Material_1.uasset` la cite
     lui-meme.

Ces chemins vivent dans les METADONNEES D'IMPORT d'Interchange, embarquees en
JSON dans le paquet. Un nom CITE n'est pas une propriete RENSEIGNEE — la regle
ecrite le jour meme apres qu'une autre sonde disque eut tue un cook.

Seul l'asset CHARGE dit ce que son slot porte. Cette sonde le charge et lit
`materials[i].material_interface`.

-- CE QU'ELLE MESURE, PAR SLOT --------------------------------------------------
  materiau    le chemin de l'objet reellement assigne, ou None
  classe      Material / MaterialInstanceConstant
  textures    les textures que ce materiau reference REELLEMENT
"""
import json
import os
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

import unreal

DOSSIER = os.environ.get("NARVOS_DOSSIER", "/Game/Narvos/pnj")
SORTIE = os.environ.get(
    "NARVOS_SORTIE",
    "E:/narvosprime-web-prototype/WebPortal/Server/adk/_materiaux-pnj.json")


def dire(t):
    print(t)
    unreal.log("[NARVOS] " + t)


registre = unreal.AssetRegistryHelpers.get_asset_registry()
# En commandlet le registre n'est pas balaye tout seul : sans cette attente, une
# sonde a deja rendu « 0 » sur un dossier plein (2026-09-12).
registre.scan_paths_synchronous([DOSSIER], True)
registre.wait_for_completion()

donnees = registre.get_assets_by_path(DOSSIER, recursive=True) or []
meshes = [d for d in donnees if str(d.asset_class_path.asset_name) == "SkeletalMesh"]
dire("%d SkeletalMesh sous %s" % (len(meshes), DOSSIER))


def textures_de(materiau):
    """Les textures qu'un materiau reference, par ses dependances de paquet."""
    if materiau is None:
        return []
    paquet = materiau.get_outermost().get_name()
    options = unreal.AssetRegistryDependencyOptions(
        include_soft_package_references=False,
        include_hard_package_references=True,
        include_searchable_names=False,
        include_soft_management_references=False,
        include_hard_management_references=False)
    deps = registre.get_dependencies(paquet, options) or []
    sortie = []
    for dep in deps:
        for d in registre.get_assets_by_package_name(dep) or []:
            if str(d.asset_class_path.asset_name) in ("Texture2D", "TextureCube"):
                sortie.append(str(d.package_name))
    return sorted(set(sortie))


resultats = []
gris = 0
for d in sorted(meshes, key=lambda x: str(x.package_name)):
    chemin = str(d.package_name)
    mesh = unreal.EditorAssetLibrary.load_asset(chemin)
    if mesh is None:
        dire("  ILLISIBLE %s" % chemin)
        continue

    slots = []
    try:
        materiaux = mesh.get_editor_property("materials") or []
    except Exception as err:
        dire("  materials illisible sur %s : %s" % (chemin, err))
        materiaux = []

    for i, sm in enumerate(materiaux):
        interface = None
        try:
            interface = sm.get_editor_property("material_interface")
        except Exception:
            pass
        tex = textures_de(interface)
        slot = {
            "index": i,
            "nom_slot": str(sm.get_editor_property("material_slot_name")),
            "materiau": interface.get_path_name() if interface else None,
            "classe": interface.get_class().get_name() if interface else None,
            "textures": tex,
        }
        slots.append(slot)
        if interface is None or not tex:
            gris += 1

    etat = "ok" if slots and all(s["materiau"] and s["textures"] for s in slots) else "GRIS"
    dire("  %-4s %s" % (etat, chemin))
    for s in slots:
        dire("        slot %d %-12s -> %s  [%s]  %d texture(s)" % (
            s["index"], s["nom_slot"], s["materiau"], s["classe"], len(s["textures"])))
    resultats.append({"mesh": chemin, "etat": etat, "slots": slots})

with open(SORTIE, "w", encoding="utf-8") as f:
    json.dump(resultats, f, ensure_ascii=False, indent=1)

dire("")
dire("%d mesh(es), %d slot(s) sans materiau ou sans texture." % (len(resultats), gris))
dire("Ecrit : " + SORTIE)