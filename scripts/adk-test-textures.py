# ══════════════════════════════════════════════════════════════════════════════
# adk-test-textures.py — expérience isolée : un GLB, un dossier neuf.
#
#   UnrealEditor-Cmd.exe <ADK>.uproject -run=pythonscript
#       -script="D:/.../scripts/adk-test-textures.py"
#
# POURQUOI : les personnages arrivent sans textures alors que le pipeline les
# active (`import_textures = True`, vérifié par adk-probe-textures.py). Les
# hypothèses successives — taille, squelette forcé, drapeaux désactivés — sont
# toutes tombées. On arrête de raisonner et on isole.
#
# Trois variantes du MÊME fichier, dans trois dossiers vierges :
#   A  pipeline complet, tel que l'import de production le construit
#   B  sans squelette forcé          -> le forçage est-il en cause ?
#   C  pipeline par défaut, intact   -> notre configuration est-elle en cause ?
#
# Un dossier vierge par variante : `search_location = LOCAL` fait RÉUTILISER un
# matériau déjà présent, ce qui suffirait à masquer le résultat.
# ══════════════════════════════════════════════════════════════════════════════

import unreal

SOURCE = ("E:/narvosprime-web-prototype/WebPortal/public/models/"
          "personnages/CyberpunkSamurai/Meshes/SK_CyberpunkSamurai_Torso.glb")

SQUELETTE = "/Game/NanosWorld/Characters/Common/SKEL_Mannequin"
BASE = "/Game/_TestTextures"


def journal(message):
    unreal.log("[NARVOS] " + message)


def compter(dossier):
    """Ce que le registre voit sous un dossier, par classe."""
    registre = unreal.AssetRegistryHelpers.get_asset_registry()
    actifs = registre.get_assets_by_path(dossier, recursive=True)
    par_classe = {}
    for a in actifs:
        c = str(a.asset_class_path.asset_name)
        par_classe[c] = par_classe.get(c, 0) + 1
    return par_classe


def importer(destination, avec_squelette, pipeline_perso):
    manager = unreal.InterchangeManager.get_interchange_manager_scripted()
    params = unreal.ImportAssetParameters()
    params.set_editor_property("is_automated", True)

    if pipeline_perso:
        pipeline = unreal.InterchangeGenericAssetsPipeline()
        if avec_squelette:
            commun = pipeline.get_editor_property(
                "common_skeletal_meshes_and_animations_properties")
            commun.set_editor_property("skeleton", unreal.load_asset(SQUELETTE))
        try:
            params.set_editor_property("override_pipelines",
                                       [unreal.SoftObjectPath(pipeline.get_path_name())])
        except Exception as e:                               # noqa: BLE001
            journal("  override refuse : %s" % e)

    source = manager.create_source_data(SOURCE)
    ok = manager.import_asset(destination, source, params)
    unreal.EditorAssetLibrary.save_directory(destination, only_if_is_dirty=False, recursive=True)
    return ok


for nom, avec_sq, perso in (
    ("A_pipeline_complet", True, True),
    ("B_sans_squelette", False, True),
    ("C_pipeline_defaut", False, False),
):
    destination = BASE + "/" + nom

    # Repartir d'un dossier VIERGE : sans ça, la variante B réutiliserait les
    # matériaux créés par la A et le test ne dirait plus rien.
    if unreal.EditorAssetLibrary.does_directory_exist(destination):
        unreal.EditorAssetLibrary.delete_directory(destination)

    journal("=== %s ===" % nom)
    ok = importer(destination, avec_sq, perso)
    journal("  import rendu : %s" % ok)

    for classe, n in sorted(compter(destination).items()):
        journal("    %-28s %d" % (classe, n))

journal("")
journal("Lecture : la variante qui produit des Texture2D dit ce qui bloquait.")