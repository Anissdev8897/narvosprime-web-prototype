# -*- coding: utf-8 -*-
"""
adk-sonder-mcs.py — relire, dans l'éditeur ouvert, CE QUE le Meta Customization
System propose et COMMENT il l'applique. LECTURE SEULE : rien n'est sauvé.

    python scripts/ue-remote.py --fichier scripts/adk-sonder-mcs.py

Sortie : WebPortal/Server/adk/_manifests/metacustom-sonde.json

Trois questions, chacune tranchée par l'éditeur et non par un nom :
  1. les OPTIONS du Styler (vêtements, coiffures, peaux, tatouages, liaisons de
     groom) : valeurs par défaut de la classe BP_Meta_Styler_C et gabarits de
     ses composants (Top_1, Groom_1, Male_Groom_3…) ;
  2. l'ABP qui porte les CURSEURS : AnimClass des composants Body/Face des
     Blueprints prémontés, et Post Process Anim Blueprint des maillages ;
  3. les fonctions « par nom » disponibles pour poser une variable d'AnimInstance
     depuis un Blueprint (SetFloatPropertyByName & co).
"""
import json
import os
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

import unreal

RACINE = "/Game/Metahuman_Customization_System"
SORTIE = os.path.join(unreal.Paths.project_dir(), "_manifests", "metacustom-sonde.json")
STYLER = RACINE + "/Meta_Styler/Bluepritns/BP_Meta_Styler"
PREMONTES = [RACINE + "/Premade_Blueprints/" + n for n in
             ("BP_MH_Male", "BP_MH_Female", "BP_MH_Male_Playable", "BP_Playable_MH")]
IDENTITES = [
    "/Game/Narvos/PontMetaHuman/BP_NarvosMH_M",
    "/Game/Narvos/PontMetaHuman/BP_NarvosMH_F",
]


def dire(texte):
    unreal.log("[SONDE-MCS] " + texte)
    print("[SONDE-MCS] " + texte)


def chemin(obj):
    if obj is None:
        return None
    try:
        return obj.get_path_name()
    except Exception:
        return str(obj)


def valeur(v):
    """Une valeur de propriété rendue en JSON lisible."""
    if v is None:
        return None
    if isinstance(v, (bool, int, float, str)):
        return v
    if isinstance(v, unreal.Name):
        return str(v)
    if isinstance(v, unreal.SoftObjectPath):
        return str(v.export_text()) if hasattr(v, "export_text") else str(v)
    if isinstance(v, unreal.Object):
        return chemin(v)
    if isinstance(v, (list, tuple)) or type(v).__name__ == "Array":
        return [valeur(x) for x in v]
    try:
        return v.export_text()
    except Exception:
        return str(v)


def sous_objets(bp):
    sds = unreal.get_engine_subsystem(unreal.SubobjectDataSubsystem)
    lib = unreal.SubobjectDataBlueprintFunctionLibrary
    noms = {}
    for h in sds.k2_gather_subobject_data_for_blueprint(bp):
        d = sds.k2_find_subobject_data_from_handle(h)
        o = lib.get_object(d)
        if o is None or not isinstance(o, unreal.ActorComponent):
            continue
        try:
            nom = str(lib.get_variable_name(d))
        except Exception:
            nom = o.get_name().replace("_GEN_VARIABLE", "")
        noms[nom] = o
    return noms


def decrire_composant(o):
    r = {"classe": o.get_class().get_name()}
    for prop in ("skeletal_mesh_asset", "skinned_asset", "groom_asset", "binding_asset",
                 "anim_class", "override_materials", "leader_pose_component"):
        try:
            r[prop] = valeur(o.get_editor_property(prop))
        except Exception:
            pass
    return r


def sonder_blueprint(chemin_bp):
    bp = unreal.load_asset(chemin_bp)
    if bp is None:
        return {"erreur": "introuvable"}
    comps = sous_objets(bp)
    return {nom: decrire_composant(o) for nom, o in sorted(comps.items())}


def variables_de_classe(chemin_bp, noms):
    classe = unreal.load_object(None, chemin_bp + "." + chemin_bp.rsplit("/", 1)[1] + "_C")
    if classe is None:
        return {"erreur": "classe introuvable"}
    cdo = unreal.get_default_object(classe)
    sortie = {}
    for n in noms:
        try:
            sortie[n] = valeur(cdo.get_editor_property(n))
        except Exception as e:
            sortie[n] = "ILLISIBLE: " + str(e)[:80]
    return sortie


def post_process(chemin_mesh):
    m = unreal.load_asset(chemin_mesh)
    if m is None:
        return None
    r = {}
    for prop in ("post_process_anim_blueprint", "skeleton", "physics_asset"):
        try:
            r[prop] = valeur(m.get_editor_property(prop))
        except Exception as e:
            r[prop] = "ILLISIBLE: " + str(e)[:60]
    return r


def main():
    rapport = {}

    # 1. les composants des Blueprints prémontés et de nos identités
    rapport["premontes"] = {p: sonder_blueprint(p) for p in PREMONTES + IDENTITES}

    # 2. le Styler : composants (gabarits d'options) + variables d'options
    rapport["styler_composants"] = sonder_blueprint(STYLER)
    noms = []
    for genre in ("Male", "Female"):
        for sorte in ("Top", "Bottoms", "Shoes", "Costume", "Prop", "Groom_Binding"):
            noms += ["%s_%s_%d" % (genre, sorte, i) for i in range(1, 9)]
    for sorte in ("Body_Mat", "Face_Mat", "Additional_Body_Mat", "Additional_Face_Mat",
                  "Male_Body_Mat", "Male_Face_Mat", "Additional_Male_Body_Mat",
                  "Male_Additional_Face_Mat", "Binding_Asset", "Additional_Binding_Asset"):
        noms += ["%s_%d" % (sorte, i) for i in range(1, 5)]
    for sorte in ("Face_Tattoo", "Body_Tattoo", "Face_Tattoo_Diffuse", "Body_Tattoo_Diffuse"):
        noms += ["%s_%d" % (sorte, i) for i in range(1, 9)]
    noms += ["Master_Body_Material", "Master_Face_Material", "Master_Binding_Asset",
             "Eye_Brightness_Value", "Eye_Outer_Value", "Eye_Inner_Value",
             "Skin_Tint_H_Value", "Skin_Tint_S_Value", "Skin_Tint_V_Value", "Skin_Tint_Amount",
             "Hair_Value_1", "Hair_Value_2", "Male_Metahuman", "Female_Metahuman",
             "Playable_Male_Metahuman", "Playable_Female_Metahuman", "Additional_Male_Body_Mat"]
    rapport["styler_variables"] = variables_de_classe(STYLER, noms)

    # 3. post-process des corps et visages cités par nos identités
    mailles = set()
    for comps in rapport["premontes"].values():
        if not isinstance(comps, dict):
            continue
        for c in comps.values():
            if isinstance(c, dict):
                for prop in ("skeletal_mesh_asset", "skinned_asset"):
                    v = c.get(prop)
                    if isinstance(v, str) and v.startswith("/Game/"):
                        mailles.add(v.split(".")[0])
    rapport["post_process"] = {m: post_process(m) for m in sorted(mailles)}

    # 4. les fonctions « par nom »
    fonctions = {}
    for f in ("set_float_property_by_name", "set_bool_property_by_name", "set_int_property_by_name"):
        fonctions[f] = hasattr(unreal.SystemLibrary, f)
    rapport["fonctions_par_nom_python"] = fonctions

    os.makedirs(os.path.dirname(SORTIE), exist_ok=True)
    with open(SORTIE, "w", encoding="utf-8") as fh:
        json.dump(rapport, fh, ensure_ascii=False, indent=1)
    dire("ecrit : " + SORTIE)


main()