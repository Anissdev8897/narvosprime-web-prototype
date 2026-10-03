# ══════════════════════════════════════════════════════════════════════════════
# adk-verifier-visage-foret.py — AVANT le cook : les deux correctifs du 2026-09-13
# tiennent-ils dans l'EDITEUR ? LECTURE SEULE, puis fermeture de l'editeur.
#
#   UnrealEditor.exe NanosWorldADK.uproject -ExecutePythonScript=<ce fichier> -unattended
#   (lance par .hermes/session-visage-foret.sh, qui lit ensuite le journal)
#
# Editeur COMPLET, pas commandlet : un commandlet ne rend rien, les materiaux n'y
# traduisent pas leur graphe — « Failed to compile Material » n'apparaitrait pas.
#
# VISAGE  le gabarit Face.AnimClass de BP_NarvosMH_M/F doit valoir ABP_NarvosVisage_C
#         (les ClassRedirects s'appliquent au chargement) ; les ABP de visage
#         compilent (erreurs [Compiler] relues dans le journal par la session).
# FORET   les 7 maitres OpenWorlds se chargent avec leur graphe ; les 55 paquets
#         restaures retrouvent leurs references (terrain : textures de couche non
#         nulles ; arbres : aucun emplacement de materiau vide).
# ══════════════════════════════════════════════════════════════════════════════
import json
import runpy

import unreal

RACINE = "E:/narvosprime-web-prototype"
SCRIPTS = RACINE + "/scripts"
MANIFESTE = RACINE + "/WebPortal/Server/adk/_manifests/openworlds-foret-restauration.json"
MEL = unreal.MaterialEditingLibrary
MAITRES = [
    "/Game/Narvos/OpenWorlds/Materials/M_Trees",
    "/Game/Narvos/OpenWorlds/Materials/M_TreesBarks",
    "/Game/Narvos/OpenWorlds/Materials/M_TreesSSTEx",
    "/Game/Narvos/OpenWorlds/Materials/M_Mask_Variation",
    "/Game/Narvos/OpenWorlds/Materials/M_Compress_Emission",
    "/Game/Narvos/OpenWorlds/Materials/M_Water",
    "/Game/Narvos/OpenWorlds/Landscape/Material/M_LandscapeMaster",
]
VISAGES = {
    "/Game/Narvos/PontMetaHuman/BP_NarvosMH_M": "/Game/Narvos/PontMetaHuman/ABP_NarvosVisage.ABP_NarvosVisage_C",
    "/Game/Narvos/PontMetaHuman/BP_NarvosMH_F": "/Game/Narvos/PontMetaHuman/ABP_NarvosVisage.ABP_NarvosVisage_C",
}


def dire(texte):
    unreal.log("[VERIF] " + texte)


def etape(nom, fonction):
    dire("=== " + nom)
    try:
        fonction()
    except Exception as e:  # une etape qui leve ne doit pas empecher la fermeture
        dire("ECHEC %s : %s" % (nom, e))


def visage():
    pont = runpy.run_path(SCRIPTS + "/adk-pont-metahuman.py", run_name="narvos_verif_visage")
    for chemin_bp, attendu in VISAGES.items():
        bp = unreal.load_asset(chemin_bp)
        if bp is None:
            dire("VISAGE ECHEC %s introuvable" % chemin_bp)
            continue
        _sds, _lib, _poignees, noms = pont["_sous_objets"](bp)
        face = noms.get("Face")
        classe = face[1].get_editor_property("anim_class") if face else None
        obtenu = classe.get_path_name() if classe else "None"
        dire("VISAGE %s %s Face.AnimClass=%s" % ("OK" if obtenu == attendu else "ECHEC", chemin_bp, obtenu))
    for abp in ("/Game/Narvos/PontMetaHuman/ABP_NarvosVisage", "/Game/Narvos/PontMetaHuman/ABP_NarvosVisageOutil"):
        objet = unreal.load_asset(abp)
        if objet is None:
            dire("VISAGE ECHEC %s introuvable" % abp)
            continue
        unreal.BlueprintEditorLibrary.compile_blueprint(objet)
        dire("VISAGE compile %s (erreurs eventuelles : lignes [Compiler] du journal)" % abp)


def foret():
    unreal.AssetRegistryHelpers.get_asset_registry().wait_for_completion()
    for chemin in MAITRES:
        mat = unreal.load_asset(chemin)
        if mat is None:
            dire("FORET ECHEC maitre introuvable %s" % chemin)
            continue
        dire("FORET maitre %s : %d expression(s)" % (chemin.split("/")[-1], MEL.get_num_material_expressions(mat)))

    donnees = json.load(open(MANIFESTE, encoding="utf-8"))
    vides_total = 0
    for entree in donnees["perdues"]:
        chemin = "/Game/Narvos/OpenWorlds/" + entree["asset"].rsplit(".", 1)[0]
        objet = unreal.load_asset(chemin)
        if objet is None:
            dire("FORET ECHEC restaure illisible %s" % chemin)
            continue
        if isinstance(objet, unreal.StaticMesh):
            vides = [i for i, s in enumerate(objet.get_editor_property("static_materials"))
                     if s.get_editor_property("material_interface") is None]
            vides_total += len(vides)
            if vides:
                dire("FORET ECHEC %s : emplacement(s) de materiau vide(s) %s" % (chemin, vides))
        elif isinstance(objet, unreal.MaterialInstance):
            noms = MEL.get_texture_parameter_names(objet)
            nulles = [str(n) for n in noms if MEL.get_material_instance_texture_parameter_value(objet, n) is None]
            parent = objet.get_editor_property("parent")
            # Un parametre laisse vide par l'auteur n'est pas une perte : seul le TERRAIN
            # est juge sur le nombre (25 textures sur 26 perdues avant restauration).
            if parent is None:
                dire("FORET ECHEC %s : sans parent" % chemin)
            if chemin.endswith("MI_LandscapeForestKitOne"):
                dire("FORET %s terrain : %d/%d texture(s) de couche renseignee(s)" % (
                    "OK" if len(noms) - len(nulles) >= 20 else "ECHEC", len(noms) - len(nulles), len(noms)))
    dire("FORET %d paquet(s) restaure(s) relu(s), %d emplacement(s) de materiau vide(s)" % (
        len(donnees["perdues"]), vides_total))


try:
    etape("visage des MetaHumans", visage)
    etape("foret OpenWorlds", foret)
finally:
    dire("=== fermeture de l'editeur")
    unreal.SystemLibrary.quit_editor()