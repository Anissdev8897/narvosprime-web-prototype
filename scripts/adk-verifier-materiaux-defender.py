# -*- coding: utf-8 -*-
"""
adk-verifier-materiaux-defender.py — les materiaux Defender RESTAURES compilent-ils ?

    (editeur COMPLET ouvert)  py -3 scripts/ue-remote.py --statement \
        "exec(open(r'E:/narvosprime-web-prototype/scripts/adk-verifier-materiaux-defender.py', encoding='utf-8').read())"

Charge chaque materiau de corps restaure le 2026-09-13 (original d'achat + redirect
/Game/Defender/ -> /Game/Narvos/Defender/), le recompile, et rend ce qu'il cite
REELLEMENT une fois charge : ses fonctions de materiau et ses textures. Le verdict
de compilation, lui, est dans le journal de l'editeur (« Failed to compile
Material ») : ce script imprime un repere avant et apres pour le borner.

Ne sauve RIEN : `adk-usage-skeletal.py` s'en charge pour les drapeaux d'usage.
"""
import sys

import unreal

MATERIAUX = [
    "/Game/Narvos/Defender/Demo/Characters/Murdock/M_Murdock",
    "/Game/Narvos/Defender/Demo/Characters/Hero/M_Hero",
    "/Game/Narvos/Defender/Demo/Materials/M_MurdockWasteland",
    "/Game/Narvos/Defender/Demo/Materials/M_ShadowOpsPants",
    "/Game/Narvos/Defender/Demo/Materials/M_ShadowOpsUpper",
    "/Game/Narvos/Defender/Demo/Characters/Trooper/M_Trooper",
    "/Game/Narvos/Defender/Demo/Characters/WraithLunarOps/M_WraithLunarOps",
    "/Game/Narvos/Defender/Demo/Characters/MurdockExecutionerV2/Materials/M_Murdock_Body_Executioner_M2",
    "/Game/Narvos/Defender/Demo/Characters/MurdockExecutionerV2/Materials/M_VisorGlass_Executioner_M",
    "/Game/Narvos/Defender/Demo/Materials/M_MurdockShotgun",
    "/Game/Narvos/Defender/Demo/Materials/M_WraithGun",
    "/Game/Narvos/Defender/Demo/Levels/UndergroundBaseLevel/Materials/M_TrainingSoldier",
    "/Game/Narvos/Defender/Demo/Materials/UE5MannyQuinn/M_Mannequin",
]


def journal(m):
    unreal.log("[NARVOS] " + m)
    sys.stdout.write("[NARVOS] " + m + "\n")


journal("=== DEBUT verification materiaux Defender (%d)" % len(MATERIAUX))
for chemin in MATERIAUX:
    nom = chemin.split("/")[-1]
    mat = unreal.load_asset("%s.%s" % (chemin, nom))
    if mat is None:
        journal("  ABSENT   %s" % chemin)
        continue
    try:
        unreal.MaterialEditingLibrary.recompile_material(mat)
    except Exception as e:
        journal("  RECOMPILATION IMPOSSIBLE %s : %s" % (nom, str(e)[:120]))
    deps = unreal.EditorAssetLibrary.find_package_referencers_for_asset(chemin, False)
    registre = unreal.AssetRegistryHelpers.get_asset_registry()
    options = unreal.AssetRegistryDependencyOptions(include_soft_package_references=False, include_hard_package_references=True)
    dependances = [str(d) for d in (registre.get_dependencies(chemin, options) or [])]
    hors = [d for d in dependances if d.startswith("/Game/") and not d.startswith("/Game/Narvos/") and not d.startswith("/Game/NanosWorld/")]
    fonctions = [d for d in dependances if "/MF_" in d or "/ML_" in d or "MaterialFunctions" in d]
    journal("  %-34s skel=%s deps=%d fonctions=%d hors_pack=%d %s"
            % (nom, mat.get_editor_property("used_with_skeletal_mesh"), len(dependances), len(fonctions), len(hors),
               ("HORS:" + ",".join(hors[:3])) if hors else ""))
journal("=== FIN verification materiaux Defender")