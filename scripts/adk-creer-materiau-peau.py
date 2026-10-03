# ══════════════════════════════════════════════════════════════════════════════
# adk-creer-materiau-peau.py — rendre la PEAU teintable.
#
#   NARVOS_PEAU_REFAIRE=1 \
#   UnrealEditor-Cmd.exe <ADK>.uproject -run=pythonscript -script="…"
#
# ── LE PROBLÈME, MESURÉ ───────────────────────────────────────────────────────
# Les pièces de peau — Buste, Mains, Jambes, visage neutre — portent `MI_Body`
# (M) ou `MI_Female_Body` (F). Sondés deux fois : ces matériaux n'exposent
# **aucun paramètre vectoriel**, leur teinte est cuite dans la texture. Sur les
# 27 matériaux du pack, 12 ont des paramètres de couleur ; ni l'un ni l'autre.
#
# `SetMaterialColorParameter` sur un paramètre inexistant ne lève pas et
# n'applique rien : un curseur de teint serait muet.
#
# ── LE GRAPHE ─────────────────────────────────────────────────────────────────
#
#     TextureSampleParameter2D("BaseColor")  ──┐
#                                              ├─ Multiply ── Base Color
#     VectorParameter("Teinte", BLANC)       ──┘
#     TextureSampleParameter2D("Normal")     ─────────────── Normal
#
# Le neutre est le BLANC : multiplier par blanc rend la texture inchangée. Un
# joueur qui ne touche à rien voit exactement la peau d'origine.
#
# ── LES TROIS PIÈGES, TOUS PAYÉS LE 2026-09-05 ────────────────────────────────
# La première version rendait le corps GRIS UNI en jeu, capture à l'appui, alors
# que le master exposait bien ses trois paramètres et que les instances
# portaient les bonnes textures. Un matériau qui ne compile pas est remplacé par
# le défaut du moteur — et rien ne le dit.
#
# 1. UN SAMPLER SANS TEXTURE PAR DÉFAUT ne compile pas. Le master doit porter
#    une texture sur chaque `TextureSampleParameter2D`, même si les instances
#    l'écrasent ensuite. D'où la découverte des textures AVANT la construction.
#
# 2. UNE NORMAL MAP LUE EN `SAMPLERTYPE_Color` et branchée sur l'entrée Normal
#    est une erreur de compilation. Il faut `SAMPLERTYPE_NORMAL`, explicitement.
#
# 3. LE CHOIX DE LA TEXTURE NE DOIT RIEN AU HASARD. La première version cherchait
#    « basecolor », « diffuse », « albedo » — aucun ne correspond à `T_Body_C`.
#    Elle retombait sur le premier par ordre alphabétique, qui se trouvait être
#    le bon. Un repli qui a raison par chance est un défaut en attente.
#
# ── CE QU'IL NE FAIT PAS ──────────────────────────────────────────────────────
# Il ne remplace rien sur les meshes. Les pièces gardent `MI_Body` ; c'est le Lua
# qui pose l'instance teintable par `SetMaterial`, et SEULEMENT si le joueur
# choisit une teinte. Au neutre, les corps de base sont intacts.
# ══════════════════════════════════════════════════════════════════════════════

import os

import unreal

DOSSIER = os.environ.get("NARVOS_PEAU_DOSSIER", "/Game/Narvos/StylizedModularChar/Materials")
MASTER = DOSSIER + "/M_NarvosPeau"
REFAIRE = os.environ.get("NARVOS_PEAU_REFAIRE") == "1"

SOURCES = {
    "MI_NarvosPeau_M": DOSSIER + "/MI_Body",
    "MI_NarvosPeau_F": DOSSIER + "/MI_Female_Body",
}


def journal(message):
    unreal.log("[NARVOS] " + message)


registre = unreal.AssetRegistryHelpers.get_asset_registry()
options = unreal.AssetRegistryDependencyOptions(include_hard_package_references=True)
outils = unreal.AssetToolsHelpers.get_asset_tools()
edition = unreal.MaterialEditingLibrary


def textures_de(paquet_materiau):
    """Textures de PROJET dont dépend un matériau, par nom."""
    out = {}
    try:
        deps = registre.get_dependencies(unreal.Name(paquet_materiau), options) or []
    except Exception:
        deps = []
    for dep in deps:
        for d in registre.get_assets_by_package_name(dep) or []:
            if str(d.asset_class_path.asset_name) == "Texture2D" \
                    and not str(d.package_name).startswith("/Engine/"):
                out[str(d.asset_name)] = d.get_asset()
    return out


def choisir(textures, motifs):
    """Texture dont le nom se TERMINE par l'un des suffixes, ou le contient.

    ⚠ Les suffixes d'abord, et en fin de nom : `T_Body_C` est la couleur,
    `T_Body_N` la normale. Chercher « normal » quelque part dans le nom ferait
    correspondre les deux si un pack nommait ses fichiers autrement.
    """
    for motif in motifs:
        for nom, asset in sorted(textures.items()):
            if nom.lower().endswith(motif.lower()):
                return nom, asset
    for motif in motifs:
        for nom, asset in sorted(textures.items()):
            if motif.lower() in nom.lower():
                return nom, asset
    return None, None


# ── Découverte des textures AVANT toute construction ─────────────────────────
#
# Le master a besoin d'une texture par défaut sur chaque sampler (piège 1). On
# prend celles du corps masculin : les instances posent ensuite les leurs.

textures_m = textures_de(SOURCES["MI_NarvosPeau_M"])
nom_base_defaut, tex_base_defaut = choisir(textures_m, ["_c", "_basecolor", "_diffuse", "_albedo"])
nom_norm_defaut, tex_norm_defaut = choisir(textures_m, ["_n", "_normal"])

journal("textures de reference : BaseColor=%s  Normal=%s" % (nom_base_defaut, nom_norm_defaut))
if tex_base_defaut is None:
    journal("ARRET : aucune texture de couleur trouvee sur " + SOURCES["MI_NarvosPeau_M"])
    raise SystemExit(0)

# ── Reconstruction ───────────────────────────────────────────────────────────

if REFAIRE:
    for a in [MASTER] + [DOSSIER + "/" + n for n in SOURCES]:
        if unreal.EditorAssetLibrary.does_asset_exist(a):
            unreal.EditorAssetLibrary.delete_asset(a)
            journal("supprime : " + a)

if unreal.EditorAssetLibrary.does_asset_exist(MASTER):
    journal("master deja present (NARVOS_PEAU_REFAIRE=1 pour le refaire)")
    master = unreal.EditorAssetLibrary.load_asset(MASTER)
else:
    master = outils.create_asset(
        "M_NarvosPeau", DOSSIER, unreal.Material, unreal.MaterialFactoryNew())
    if master is None:
        journal("ARRET : creation du master impossible")
        raise SystemExit(0)

    base = edition.create_material_expression(
        master, unreal.MaterialExpressionTextureSampleParameter2D, -640, -160)
    base.set_editor_property("parameter_name", "BaseColor")
    base.set_editor_property("sampler_type", unreal.MaterialSamplerType.SAMPLERTYPE_COLOR)
    base.set_editor_property("texture", tex_base_defaut)   # piege 1

    teinte = edition.create_material_expression(
        master, unreal.MaterialExpressionVectorParameter, -640, 120)
    teinte.set_editor_property("parameter_name", "Teinte")
    teinte.set_editor_property("default_value", unreal.LinearColor(1.0, 1.0, 1.0, 1.0))

    produit = edition.create_material_expression(
        master, unreal.MaterialExpressionMultiply, -300, -60)

    edition.connect_material_expressions(base, "RGB", produit, "A")
    edition.connect_material_expressions(teinte, "", produit, "B")
    edition.connect_material_property(produit, "", unreal.MaterialProperty.MP_BASE_COLOR)

    # La normale n'est branchee QUE si on en a une : un sampler sans texture ne
    # compile pas, et une peau sans relief vaut mieux qu'un materiau casse.
    if tex_norm_defaut is not None and nom_norm_defaut != nom_base_defaut:
        normale = edition.create_material_expression(
            master, unreal.MaterialExpressionTextureSampleParameter2D, -640, 360)
        normale.set_editor_property("parameter_name", "Normal")
        normale.set_editor_property("sampler_type", unreal.MaterialSamplerType.SAMPLERTYPE_NORMAL)
        normale.set_editor_property("texture", tex_norm_defaut)
        edition.connect_material_property(normale, "RGB", unreal.MaterialProperty.MP_NORMAL)
    else:
        journal("  pas de normale exploitable : le master n'en portera pas")

    edition.recompile_material(master)
    unreal.EditorAssetLibrary.save_asset(MASTER)
    journal("master cree : " + MASTER)

# ── Les instances ────────────────────────────────────────────────────────────

crees = 0
for nom, source in SOURCES.items():
    cible = DOSSIER + "/" + nom
    if unreal.EditorAssetLibrary.does_asset_exist(cible):
        journal("  deja presente : " + nom)
        continue
    if not unreal.EditorAssetLibrary.does_asset_exist(source):
        journal("  source ABSENTE, ignore : " + source)
        continue

    textures = textures_de(source)
    nom_base, tex_base = choisir(textures, ["_c", "_basecolor", "_diffuse", "_albedo"])
    nom_norm, tex_norm = choisir(textures, ["_n", "_normal"])

    instance = outils.create_asset(
        nom, DOSSIER, unreal.MaterialInstanceConstant,
        unreal.MaterialInstanceConstantFactoryNew())
    if instance is None:
        journal("  ECHEC creation " + nom)
        continue

    edition.set_material_instance_parent(instance, master)
    if tex_base is not None:
        edition.set_material_instance_texture_parameter_value(instance, "BaseColor", tex_base)
    if tex_norm is not None and nom_norm != nom_base:
        edition.set_material_instance_texture_parameter_value(instance, "Normal", tex_norm)
    edition.set_material_instance_vector_parameter_value(
        instance, "Teinte", unreal.LinearColor(1.0, 1.0, 1.0, 1.0))

    unreal.EditorAssetLibrary.save_asset(cible)
    crees += 1
    journal("  cree %-18s BaseColor=%-18s Normal=%s" % (nom, nom_base, nom_norm))

journal("")
journal("%d instance(s) creee(s)" % crees)