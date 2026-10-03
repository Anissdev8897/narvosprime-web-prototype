"""
adk-mesurer-bornes-ako.py — MESURE la boite de bornes de la minimap Ako : la
demi-etendue du mesh Box_board et l'echelle du composant BOX_Bounds dans
BP_MAP_Bounds. Lecture seule.

    UnrealEditor-Cmd.exe <ADK>.uproject -run=pythonscript -script="<...>/scripts/adk-mesurer-bornes-ako.py" -unattended -nosplash

Sortie : WebPortal/Server/adk/_manifests/ako-bornes.json, lu par
scripts/narvos-minimap-to-lua.mjs.

-- POURQUOI ---------------------------------------------------------------------
Le widget suit le joueur « base sur la boite de bornes » (MAPBouns_type =
BASE_ON_BOX_BOUND, sonde du 2026-09-13). Un monde NARVOS fait 6 km de rayon ; la
boite de la demo, (200, 200, 50) fois Box_board. Pour la dimensionner a un monde,
le client doit connaitre la taille REELLE de la boite : mesuree ici, jamais
devinee.

-- ⚠ ISOLE DE LA SONDE -----------------------------------------------------------
La sonde adk-sonder-ako.py a tue le commandlet en editant une structure
Blueprint (copie Python). Cette mesure-ci ne touche AUCUNE structure : un mesh,
ses bornes, les composants d'un Blueprint — deux appels deja passes sans incident.
"""
import json
import traceback

import unreal

SORTIE = "E:/narvosprime-web-prototype/WebPortal/Server/adk/_manifests/ako-bornes.json"
BOITE = "/Game/Narvos/Ako_Mini_Map_sys/Example_Content_Demo/static_mesh_proj/Box_board"
BOUNDS = "/Game/Narvos/Ako_Mini_Map_sys/ako_mini_map_Content/map_data_blueprint/ACTORS/BP_MAP_Bounds"
rapport = {"erreurs": []}


def journal(message):
    unreal.log("[NARVOS] " + message)
    print("[NARVOS] " + message)


def vecteur(v):
    return {"x": float(v.x), "y": float(v.y), "z": float(v.z)}


try:
    boite = unreal.load_asset(BOITE)
    if boite is None:
        rapport["erreurs"].append("Box_board introuvable : " + BOITE)
    else:
        bornes = boite.get_bounds()
        rapport["box_board"] = {"origine": vecteur(bornes.origin), "demi_etendue": vecteur(bornes.box_extent)}
        journal("Box_board demi-etendue %s" % rapport["box_board"]["demi_etendue"])

    bp = unreal.load_asset(BOUNDS)
    if bp is None:
        rapport["erreurs"].append("BP_MAP_Bounds introuvable : " + BOUNDS)
    else:
        sous = unreal.get_engine_subsystem(unreal.SubobjectDataSubsystem)
        for poignee in sous.k2_gather_subobject_data_for_blueprint(bp):
            donnee = unreal.SubobjectDataBlueprintFunctionLibrary.get_data(poignee)
            objet = unreal.SubobjectDataBlueprintFunctionLibrary.get_object(donnee)
            if objet is not None and objet.get_name().startswith("BOX_Bounds"):
                rapport["box_bounds"] = {
                    "echelle": vecteur(objet.get_editor_property("relative_scale3d")),
                    "position": vecteur(objet.get_editor_property("relative_location")),
                }
                break
        journal("BOX_Bounds %s" % rapport.get("box_bounds"))
except Exception:
    rapport["erreurs"].append(traceback.format_exc())
    journal("EXCEPTION : " + traceback.format_exc())
finally:
    with open(SORTIE, "w", encoding="utf-8") as f:
        json.dump(rapport, f, ensure_ascii=False, indent=1)
    journal("mesure ecrite : " + SORTIE)