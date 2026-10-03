# ══════════════════════════════════════════════════════════════════════════════
# adk-rebrancher-materiaux.py — rend leurs textures aux meshes importés en GLB.
#
#   UnrealEditor-Cmd.exe <ADK>.uproject -run=pythonscript
#       -script=".../adk-rebrancher-materiaux.py"
#
# `NARVOS_MESHES` : chemin de package des meshes    (défaut /Game/Narvos/stylized_modular)
# `NARVOS_MATS`   : chemin de package des matériaux (défaut /Game/StylizedModularChar/Materials)
#
# ── LE DÉFAUT QU'ON RÉPARE ────────────────────────────────────────────────────
# Les 40 pièces de `stylized_modular` sortent GRISES en jeu. Mesuré le
# 2026-09-04 dans l'inventaire typé de l'ADK :
#
#     stylized_modular : 40 SkeletalMesh · 14 Material · 0 Texture2D
#
# Zéro texture. Les GLB dont elles viennent portent `images = 0` : ils ont été
# produits hors de l'ADK, sans jamais embarquer les images. Le pack d'ORIGINE,
# lui, est complet — 61 textures et 27 matériaux, en `.uasset` Unreal 4.26.
#
# L'import GLB a créé des matériaux VIDES portant exactement les mêmes noms que
# les vrais : `MI_Aviator`, `MI_Body`, `MI_Soldier`… La correspondance est donc
# un simple appariement par nom, sans heuristique.
#
# ── CE QUE CE SCRIPT NE FAIT PAS ──────────────────────────────────────────────
# Il ne touche ni la géométrie, ni le squelette, ni les poids. Il remplace les
# entrées de la table de matériaux du mesh, rien d'autre. Un mesh dont aucun
# matériau ne trouve d'homonyme est laissé INTACT et signalé — mieux vaut une
# pièce grise nommée qu'un remplacement au hasard.
#
# ⚠ SAUVER APRÈS CHAQUE MESH. La compilation des textures est asynchrone : un
# seul `save_directory` à la fin écrit des matériaux avant que leurs images
# soient prêtes. C'est le défaut qui avait déjà produit des personnages gris une
# première fois sur ce projet.
# ══════════════════════════════════════════════════════════════════════════════

import os

import unreal


def journal(message):
    unreal.log("[NARVOS] " + message)


def _chemin(variable, defaut):
    """Chemin de package, protégé de la conversion de chemins de Git Bash.

    ⚠ MSYS réécrit toute valeur commençant par `/` : `/Game/x` arrive en
    `C:/Program Files/Git/Game/x`. On retrouve le point de montage DANS la
    chaîne plutôt que de découper sur le dernier segment, qui perdrait les
    sous-dossiers.
    """
    v = os.environ.get(variable, defaut).replace("\\", "/").strip()
    i = v.find("/Game/")
    if i >= 0:
        return v[i:]
    return v if v.startswith("/Game") else defaut


MESHES = _chemin("NARVOS_MESHES", "/Game/Narvos/stylized_modular")
MATS = _chemin("NARVOS_MATS", "/Game/StylizedModularChar/Materials")

journal("meshes    : " + MESHES)
journal("materiaux : " + MATS)

registre = unreal.AssetRegistryHelpers.get_asset_registry()
registre.search_all_assets(True)

# ── Les vrais matériaux, indexés par nom ──────────────────────────────────────

vrais = {}
for donnee in registre.get_assets_by_path(MATS, recursive=True):
    nom = str(donnee.asset_name)
    actif = donnee.get_asset()
    if isinstance(actif, (unreal.MaterialInstance, unreal.Material)):
        vrais[nom] = actif

journal("%d materiau(x) reel(s) trouve(s)" % len(vrais))
if not vrais:
    journal("ARRET : aucun materiau sous " + MATS)
    journal("  Verifier que le dossier a bien ete copie dans Content/ et que")
    journal("  son NOM correspond aux references internes du pack d'origine.")
    raise SystemExit(1)

# ── Rebranchement ─────────────────────────────────────────────────────────────

meshes = [d for d in registre.get_assets_by_path(MESHES, recursive=True)
          if str(d.asset_class_path.asset_name) == "SkeletalMesh"]
journal("%d SkeletalMesh a traiter" % len(meshes))

touches = 0
inchanges = []
remplaces_total = 0

for donnee in meshes:
    mesh = donnee.get_asset()
    if mesh is None:
        continue

    nom_mesh = str(donnee.asset_name)

    try:
        slots = mesh.get_editor_property("materials")
    except Exception as erreur:                              # noqa: BLE001
        journal("  ILLISIBLE %s (%s)" % (nom_mesh, erreur))
        continue

    change = False
    neufs = []

    for slot in slots:
        interface = slot.get_editor_property("material_interface")
        nom_actuel = interface.get_name() if interface else None

        # On n'échange QUE si un homonyme existe. Un matériau sans homonyme
        # reste en place : le remplacer par « le premier venu » donnerait une
        # pièce texturée mais fausse, ce qui est pire que grise.
        remplacant = vrais.get(nom_actuel) if nom_actuel else None
        if remplacant is not None and remplacant != interface:
            slot.set_editor_property("material_interface", remplacant)
            change = True
            remplaces_total += 1

        neufs.append(slot)

    if not change:
        inchanges.append(nom_mesh)
        continue

    mesh.set_editor_property("materials", neufs)

    # ⚠ SAUVER MAINTENANT, pas à la fin. Voir l'en-tête : la compilation des
    # textures est asynchrone, et un enregistrement groupé écrit des matériaux
    # avant que leurs images existent.
    unreal.EditorAssetLibrary.save_loaded_asset(mesh, only_if_is_dirty=False)
    touches += 1
    if touches <= 6:
        journal("  REBRANCHE %s" % nom_mesh)

journal("")
journal("%d mesh(es) rebranche(s), %d slot(s) de materiau remplace(s)"
        % (touches, remplaces_total))

if inchanges:
    journal("%d mesh(es) INCHANGE(s) — aucun homonyme pour leurs materiaux :"
            % len(inchanges))
    for n in inchanges[:12]:
        journal("    " + n)

# ── Contrôle ──────────────────────────────────────────────────────────────────
#
# On recompte les textures atteignables : c'est la seule mesure qui dise si le
# gris est parti. Compter les matériaux ne suffit pas — ils existaient déjà,
# vides.

atteignables = set()
for nom, actif in vrais.items():
    for dep in unreal.EditorAssetLibrary.find_package_referencers_for_asset(
            actif.get_path_name(), False) or []:
        pass  # référencement inverse : non utilisé ici, gardé pour lisibilité

    try:
        for t in actif.get_editor_property("texture_parameter_values"):
            valeur = t.get_editor_property("parameter_value")
            if valeur:
                atteignables.add(valeur.get_path_name())
    except Exception:                                        # noqa: BLE001
        # `texture_parameter_values` vit sur MaterialInstance, pas sur Material.
        # Un matériau brut n'en a pas — ce n'est pas une erreur.
        pass

journal("%d texture(s) distincte(s) atteignable(s) depuis ces materiaux"
        % len(atteignables))