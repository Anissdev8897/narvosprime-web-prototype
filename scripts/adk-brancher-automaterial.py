# ══════════════════════════════════════════════════════════════════════════════
# adk-brancher-automaterial.py — donner ses textures a l'auto-material de terrain.
#
#   UnrealEditor-Cmd.exe <ADK>.uproject -run=pythonscript -script="…"
#
# ⚠ EDITEUR FERME. Deux instances d'Unreal sur le meme projet se disputent le
# registre d'assets et le DerivedDataCache.
#
# ── LE DEFAUT, MESURE EN DIRECT LE 2026-09-05 ─────────────────────────────────
# Le terrain de la map Halo sort BLANC. Lu dans l'editeur ouvert via UnrealMCP :
#
#   MTL_MWAM_AutoMaterial_MASTER   40 scalaires, 5 vectoriels, 12 textures
#                                  -> les 12 textures valent "" (VIDES)
#   MTL_MWAM_Landscape_*Example    aucun parametre surcharge
#
# Le graphe est intact, les parametres existent, il n'y a simplement AUCUNE
# texture branchee. Et le pack n'en contenait aucune : `Texture2D` sous
# `MWLandscapeAutoMaterial` = 0 dans l'inventaire. Elles etaient sur le disque,
# jamais importees.
#
# Les 12 PNG (4096x4096) ont ete importes depuis l'editeur. Ce script fait la
# seconde moitie : les poser sur les trois instances.
#
# ── POURQUOI LES INSTANCES ET PAS LE MASTER ───────────────────────────────────
# Modifier les defauts du master demanderait d'editer ses expressions, ce qui a
# fait CRASHER le commandlet lors d'un simple parcours de `expression_collection`.
# `set_material_instance_texture_parameter_value` est l'API stable, deja
# eprouvee sur `MI_NarvosPeau`. Et c'est le fonctionnement voulu par le pack :
# un master generique, une instance par biome.
#
# ⚠ POURQUOI PAS PAR MCP. `set_material_texture_parameter` d'UnrealMCP expire :
# poser un parametre declenche la recompilation du shader, et cet auto-material
# est lourd. Le commandlet, lui, attend.
# ══════════════════════════════════════════════════════════════════════════════

import os

import unreal

PACK = "/Game/Narvos/MWLandscapeAutoMaterial"
SOL = PACK + "/Textures/Ground"
EXTRA = PACK + "/Textures/Extra"

INSTANCES = [
    PACK + "/Materials/Landscape/MTL_MWAM_Landscape_IslandExample",
    PACK + "/Materials/Landscape/MTL_MWAM_Landscape_MountainRangeExample",
    PACK + "/Materials/Landscape/MTL_MWAM_Landscape_DesertExample",
]

# Les 12 parametres du master, apparies par nom. Aucune ambiguite : le pack
# nomme ses fichiers `_col` (couleur), `_nrm` (normale), `_msk` (masque).
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


def journal(m):
    unreal.log("[NARVOS] " + m)


edition = unreal.MaterialEditingLibrary

# ── Les textures existent-elles ? ────────────────────────────────────────────
#
# Poser une texture absente ne leve pas : le parametre reste vide et le terrain
# reste blanc. On refuse donc AVANT d'ecrire quoi que ce soit.

manquantes = [c for c in set(BRANCHEMENTS.values())
              if not unreal.EditorAssetLibrary.does_asset_exist(c)]
if manquantes:
    journal("ARRET : %d texture(s) absente(s) du projet" % len(manquantes))
    for c in sorted(manquantes):
        journal("    " + c)
    journal("Les importer d'abord depuis public/models/materials/MWLandscapeAutoMaterial/Textures/")
    raise SystemExit(0)

journal("%d texture(s) presentes" % len(set(BRANCHEMENTS.values())))

# ── Branchement ──────────────────────────────────────────────────────────────

total = 0
for chemin in INSTANCES:
    if not unreal.EditorAssetLibrary.does_asset_exist(chemin):
        journal("instance ABSENTE, ignoree : " + chemin)
        continue

    instance = unreal.EditorAssetLibrary.load_asset(chemin)
    if instance is None or not isinstance(instance, unreal.MaterialInstanceConstant):
        journal("pas une MaterialInstanceConstant : " + chemin)
        continue

    poses = 0
    for param, tex_chemin in sorted(BRANCHEMENTS.items()):
        texture = unreal.EditorAssetLibrary.load_asset(tex_chemin)
        if texture is None:
            continue
        try:
            edition.set_material_instance_texture_parameter_value(instance, param, texture)
            poses += 1
        except Exception as e:
            journal("  ECHEC %s : %s" % (param, e))

    unreal.EditorAssetLibrary.save_asset(chemin, only_if_is_dirty=False)
    total += poses
    journal("%-46s %2d/%d parametre(s) poses"
            % (chemin.rsplit("/", 1)[-1], poses, len(BRANCHEMENTS)))

journal("")
journal("%d branchement(s) au total" % total)

# ── Controle ─────────────────────────────────────────────────────────────────
#
# Relire ce qu'on vient d'ecrire : une ecriture qui n'a pas pris est le mode
# d'echec habituel ici, et il est silencieux.

journal("")
journal("=== relecture")
for chemin in INSTANCES:
    if not unreal.EditorAssetLibrary.does_asset_exist(chemin):
        continue
    instance = unreal.EditorAssetLibrary.load_asset(chemin)
    vides = []
    for param in sorted(BRANCHEMENTS):
        try:
            t = edition.get_material_instance_texture_parameter_value(instance, param)
            if t is None:
                vides.append(param)
        except Exception:
            vides.append(param)
    if vides:
        journal("%-46s %d PARAMETRE(S) ENCORE VIDE(S)" % (chemin.rsplit("/", 1)[-1], len(vides)))
        for v in vides[:6]:
            journal("      " + v)
    else:
        journal("%-46s les 12 textures sont posees" % chemin.rsplit("/", 1)[-1])