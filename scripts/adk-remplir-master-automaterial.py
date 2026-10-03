# ══════════════════════════════════════════════════════════════════════════════
# adk-remplir-master-automaterial.py — donner ses textures par DEFAUT au master
# de l'auto-material de terrain.
#
#   UnrealEditor-Cmd.exe <ADK>.uproject -run=pythonscript -script="…"
#
# ⚠ EDITEUR FERME. Verifie avant de lancer.
# ⚠ SAUVEGARDE PREALABLE dans Server/adk/_sauvegarde-materiaux/.
#
# ── POURQUOI LE MASTER ET PAS SEULEMENT LES INSTANCES ─────────────────────────
# `adk-brancher-automaterial.py` a pose les 12 textures sur les trois instances,
# en SURCHARGE. Ca repare ces trois-la, et rien d'autre : le master garde ses 12
# parametres a "" (relu le 2026-09-05 via UnrealMCP).
#
# Consequence concrete, vecue par le user : dans l'editeur d'une instance, un
# parametre NON COCHE herite du parent et reste grise. Le parent etant vide, on
# ne voit rien et on ne peut rien deposer — d'ou « je n'arrive pas a assigner ».
#
# Remplir le master fait disparaitre ce piege : toute instance, presente ou
# future, herite d'une texture valable sans qu'on ait rien a cocher.
#
# ── LE RISQUE, ET COMMENT IL EST TENU ─────────────────────────────────────────
# Il n'existe aucune API de haut niveau pour poser le defaut d'un parametre de
# materiau : `MaterialEditingLibrary` ne sait le faire que sur des INSTANCES. Il
# faut donc parcourir les expressions du graphe — et un simple parcours de
# `expression_collection` a fait planter le commandlet le 2026-09-05.
#
# D'ou : sauvegarde du .uasset AVANT, parcours sous `try`, et relecture apres.
# Un plantage laisse le fichier d'origine intact et copiable.
# ══════════════════════════════════════════════════════════════════════════════

import os

import unreal

PACK = "/Game/Narvos/MWLandscapeAutoMaterial"
MASTER = PACK + "/Materials/MASTER/MTL_MWAM_AutoMaterial_MASTER"
SOL = PACK + "/Textures/Ground"
EXTRA = PACK + "/Textures/Extra"

BRANCHEMENTS = {
    "MW_TextureDirtBaseColor": SOL + "/TEX_MWAM_Dirt_col",
    "MW_TextureDirtNormal": SOL + "/TEX_MWAM_Dirt_nrm",
    "MW_TextureGrassBaseColor": SOL + "/TEX_MWAM_Grass_col",
    "MW_TextureGrassNormal": SOL + "/TEX_MWAM_Grass_nrm",
    "MW_TextureRockBaseColor": SOL + "/TEX_MWAM_Rock_col",
    "MW_TextureRockNormal": SOL + "/TEX_MWAM_Rock_nrm",
    "MW_TextureStonesBaseColor": SOL + "/TEX_MWAM_Stones_col",
    "MW_TextureStonesNormal": SOL + "/TEX_MWAM_Stones_nrm",
    "MW_TextureSnowBaseColor": SOL + "/TEX_MWAM_Snow_col",
    "MW_TextureSnowNormal": SOL + "/TEX_MWAM_Snow_nrm",
    "MW_TextureLandscapeVariationMask": EXTRA + "/TEX_MWAM_Variation_msk",
    "MW_TextureLandscapeVariationNormal": EXTRA + "/TEX_MWAM_Variation_nrm",
}

INSTANCES = [
    PACK + "/Materials/Landscape/MTL_MWAM_Landscape_IslandExample",
    PACK + "/Materials/Landscape/MTL_MWAM_Landscape_MountainRangeExample",
    PACK + "/Materials/Landscape/MTL_MWAM_Landscape_DesertExample",
]


def journal(m):
    unreal.log("[NARVOS] " + m)


edition = unreal.MaterialEditingLibrary

# ── Les textures d'abord ─────────────────────────────────────────────────────

textures = {}
manquantes = []
for param, chemin in BRANCHEMENTS.items():
    t = unreal.EditorAssetLibrary.load_asset(chemin)
    if t is None:
        manquantes.append(chemin)
    else:
        textures[param] = t

if manquantes:
    journal("ARRET : %d texture(s) introuvable(s)" % len(manquantes))
    for c in manquantes:
        journal("    " + c)
    raise SystemExit(0)

journal("%d texture(s) chargee(s)" % len(textures))

# ── Le master ────────────────────────────────────────────────────────────────

master = unreal.EditorAssetLibrary.load_asset(MASTER)
if master is None:
    journal("ARRET : master introuvable " + MASTER)
    raise SystemExit(0)

# ⚠ SOUS `try`. C'est cet acces qui avait tue le commandlet.
try:
    expressions = list(master.get_editor_property("expression_collection").expressions)
except Exception as e:
    journal("ARRET : lecture des expressions impossible (%s)" % e)
    journal("Le .uasset n'a pas ete modifie. Restaurer depuis _sauvegarde-materiaux/ si besoin.")
    raise SystemExit(0)

journal("%d expression(s) dans le graphe" % len(expressions))

poses = 0
inconnus = []
for e in expressions:
    if not isinstance(e, unreal.MaterialExpressionTextureSampleParameter2D):
        continue
    try:
        nom = str(e.get_editor_property("parameter_name"))
    except Exception:
        continue

    if nom not in textures:
        inconnus.append(nom)
        continue

    try:
        e.set_editor_property("texture", textures[nom])
        poses += 1
        journal("  %-38s <- %s" % (nom, BRANCHEMENTS[nom].rsplit("/", 1)[-1]))
    except Exception as ex:
        journal("  ECHEC %s : %s" % (nom, ex))

journal("")
journal("%d parametre(s) de texture rempli(s) sur %d attendus" % (poses, len(BRANCHEMENTS)))
if inconnus:
    journal("%d sampler(s) hors de notre table (laisses tels quels) : %s"
            % (len(inconnus), ", ".join(sorted(set(inconnus))[:8])))

if poses == 0:
    journal("Rien pose : le master n'est pas sauvegarde.")
    raise SystemExit(0)

try:
    edition.recompile_material(master)
except Exception as e:
    journal("recompilation : %s" % e)

unreal.EditorAssetLibrary.save_asset(MASTER)
journal("master sauvegarde")

# ── Relecture : le master, puis les instances ────────────────────────────────
#
# Une ecriture qui n'a pas pris est le mode d'echec habituel ici, et il est
# silencieux. On relit systematiquement.

journal("")
journal("=== relecture du master")
try:
    relu = unreal.EditorAssetLibrary.load_asset(MASTER)
    vides = []
    for e in list(relu.get_editor_property("expression_collection").expressions):
        if not isinstance(e, unreal.MaterialExpressionTextureSampleParameter2D):
            continue
        nom = str(e.get_editor_property("parameter_name"))
        tex = e.get_editor_property("texture")
        if nom in BRANCHEMENTS:
            journal("  %-38s %s" % (nom, tex.get_name() if tex else "(VIDE)"))
            if tex is None:
                vides.append(nom)
    journal("  -> %d parametre(s) encore vide(s)" % len(vides))
except Exception as e:
    journal("  relecture impossible : %s" % e)

journal("")
journal("=== relecture des instances (surcharges posees precedemment)")
for chemin in INSTANCES:
    inst = unreal.EditorAssetLibrary.load_asset(chemin)
    if inst is None:
        journal("  ABSENTE : " + chemin)
        continue
    vides = 0
    for param in BRANCHEMENTS:
        try:
            if edition.get_material_instance_texture_parameter_value(inst, param) is None:
                vides += 1
        except Exception:
            vides += 1
    journal("  %-44s %d/%d texture(s) resolues"
            % (chemin.rsplit("/", 1)[-1], len(BRANCHEMENTS) - vides, len(BRANCHEMENTS)))