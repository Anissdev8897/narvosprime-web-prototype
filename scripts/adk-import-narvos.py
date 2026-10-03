# ══════════════════════════════════════════════════════════════════════════════
# adk-import-narvos.py — importe des GLB NARVOS dans l'ADK, liés au squelette
# que nanos exige.
#
#   UnrealEditor-Cmd.exe <ADK>.uproject -run=pythonscript
#       -script="D:/.../scripts/adk-import-narvos.py"
#
# Le pack à importer se choisit par la variable d'environnement NARVOS_PACK
# (défaut : CyberpunkSamurai).
#
# ── POURQUOI L'IMPORTEUR NATIF ET PAS UniGLB ──────────────────────────────────
# UniGLB est présent et fonctionne dans l'éditeur, mais son import HEADLESS est
# déjà documenté comme cassé dans ce projet : il n'écrivait que le
# `VA_*_VrmAssetList` (4 ko) sans persister les sous-assets, à cause d'un
# `bAssetSave = false` et d'un auto-rig post-import. Unreal 5.7 lit le glTF
# nativement via Interchange — un chemin plus court, sans plugin tiers, et qui
# se pilote en commandlet.
#
# ── LE POINT QUI DÉCIDE DE TOUT ───────────────────────────────────────────────
# nanos exige que chaque mesh de personnage PARTAGE `SKEL_Mannequin`. Un import
# qui laisse Unreal créer un squelette neuf produit un asset qui se charge, se
# voit dans l'éditeur, et que le jeu REFUSE d'attacher — sans erreur claire.
# On force donc le squelette existant. Si la propriété ne peut pas être posée,
# le script le DIT et n'importe rien : un import silencieusement mal lié coûte
# plus cher qu'un import qui n'a pas eu lieu.
#
# Le squelette de référence a été mesuré : 68 os, racine `root`, hiérarchie UE4
# (cf. scripts/narvos-skeleton-compat.mjs).
# ══════════════════════════════════════════════════════════════════════════════

import os
import unreal

SOURCE_RACINE = "E:/narvosprime-web-prototype/WebPortal/public/models/personnages"
PACK = os.environ.get("NARVOS_PACK", "CyberpunkSamurai")

# ⚠ `Narvos` et pas `MyAssetPack` : la doc de l'ADK impose un nom de dossier
# UNIQUE, il devient le nom du pack monté dans nanos. Et surtout : ne JAMAIS
# écrire sous /Game/NanosWorld/, rien n'en est exporté.
#
# En mode manifeste la racine est le dossier des modèles : le nom du pack fait
# alors partie du chemin relatif et `sous_dossier()` le reproduit tout seul.
# L'ajouter ici donnerait /Game/Narvos/<pack>/<pack>/...
DESTINATION = "/Game/Narvos" if os.environ.get("NARVOS_MANIFEST") else "/Game/Narvos/" + PACK

SQUELETTE = "/Game/NanosWorld/Characters/Common/SKEL_Mannequin"


def journal(message):
    unreal.log("[NARVOS] " + message)


# ── Squelette de référence ────────────────────────────────────────────────────

# ── Import SANS squelette ─────────────────────────────────────────────────────
#
# `NARVOS_SANS_SQUELETTE=1` laisse Interchange décider seul du type d'asset.
#
# ⚠ POUR QUOI, ET SEULEMENT POUR QUOI. Certains packs sont riggés sur un AUTRE
# squelette que SKEL_Mannequin. Mesuré le 2026-09-04 : les GLB de
# `public/models/pnj` et de `pnj_monstre` ont 24 os (Grunt) à 102 (RobotGirl),
# nommés selon la convention Meshy — verdict ETRANGER de
# `narvos-skeleton-compat.mjs`, qui compare les NOMS.
#
# Leur imposer SKEL_Mannequin ne les retargete pas : Interchange apparie les os
# par leur nom, n'en reconnaît aucun, et produit un SkeletalMesh dont les sommets
# pendent à la racine. En jeu, le modèle s'effondre en un point.
#
# Sans squelette imposé, Interchange crée un squelette PROPRE à chaque fichier —
# 37 squelettes et 208 AnimSequence pour ces 60 meshes, mesurés par
# `adk-verify-skeletons.py`. Ces meshes sont alors jouables par `CharacterSimple`,
# qui n'impose aucun squelette, mais JAMAIS par `Character`, qui exige le
# Mannequin et n'afficherait qu'une capsule de collision.
#
# Ne JAMAIS l'activer sur un pack de personnages : Interchange fabriquerait alors
# un squelette NEUF par fichier, et nanos refuse tout ce qui n'est pas
# SKEL_Mannequin.
SANS_SQUELETTE = os.environ.get("NARVOS_SANS_SQUELETTE") == "1"

squelette = None
if SANS_SQUELETTE:
    journal("MODE SANS SQUELETTE : Interchange decide du type d'asset.")
    journal("  (pour les packs rigges sur un AUTRE squelette — voir l'en-tete)")
else:
    squelette = unreal.load_asset(SQUELETTE)
    if squelette is None:
        journal("ARRET : squelette introuvable a " + SQUELETTE)
        raise SystemExit(1)
    journal("squelette cible : %s (%s)" % (SQUELETTE, type(squelette).__name__))


# ── Collecte ──────────────────────────────────────────────────────────────────

def collecter(racine):
    """Chemins GLB, triés pour que deux exécutions donnent le même ordre — un
    import dont l'ordre varie rend les journaux incomparables d'un run à l'autre."""
    trouves = []
    for dossier, _, fichiers in os.walk(racine):
        for f in fichiers:
            if f.lower().endswith(".glb"):
                trouves.append(os.path.join(dossier, f).replace("\\", "/"))
    return sorted(trouves)


# Deux modes. Le manifeste est le mode NORMAL : il ne contient que les fichiers
# dont le squelette est réellement liable à SKEL_Mannequin et dont les textures
# sont lisibles par Unreal (les KTX2 en sont exclus). Le mode « un pack » reste
# pour tester un dossier précis.
#
# La règle de compatibilité vit dans narvos-skeleton-compat.mjs et NULLE PART
# ailleurs : la redupliquer ici, en Python, garantirait qu'elles divergent.
MANIFESTE = os.environ.get("NARVOS_MANIFEST", "")

if MANIFESTE:
    import json as _json

    if not os.path.isfile(MANIFESTE):
        journal("ARRET : manifeste introuvable " + MANIFESTE)
        raise SystemExit(1)

    with open(MANIFESTE, "r", encoding="utf-8") as fh:
        donnees = _json.load(fh)

    racine_pack = donnees["racine"]
    fichiers = [e["fichier"] for e in donnees["fichiers"]]
    journal("manifeste : %d fichier(s), racine %s" % (len(fichiers), racine_pack))
    if donnees.get("ecartes_ktx2"):
        journal("  (%d ecarte(s) en amont : textures KTX2)" % donnees["ecartes_ktx2"])
else:
    racine_pack = os.path.join(SOURCE_RACINE, PACK).replace("\\", "/")
    if not os.path.isdir(racine_pack):
        journal("ARRET : pack introuvable " + racine_pack)
        raise SystemExit(1)
    fichiers = collecter(racine_pack)
    journal("%d GLB trouves dans %s" % (len(fichiers), PACK))


# ── Pipeline d'import ─────────────────────────────────────────────────────────

def construire_pipeline():
    """Pipeline Interchange réglé pour lier au squelette existant.

    Les noms de propriétés d'Interchange ont bougé entre versions d'Unreal. On
    tente les chemins connus dans l'ordre et on JOURNALISE celui qui a pris —
    sans quoi un échec silencieux produirait des meshes liés à un squelette
    neuf, c'est-à-dire inutilisables par nanos sans qu'on le voie.
    """
    pipeline = unreal.InterchangeGenericAssetsPipeline()

    # ⚠ EN MODE SANS SQUELETTE, IL N'Y A RIEN À POSER.
    #
    # `squelette` vaut None : les deux tentatives ci-dessous appelleraient
    # `set_editor_property("skeleton", None)`, qui LÈVE. `pose` resterait faux,
    # la fonction rendrait None, et l'import s'arrêterait sur
    # « impossible de forcer le squelette » — un message qui décrit exactement
    # ce qu'on avait DEMANDÉ. Défaut trouvé le 2026-09-04 en important les
    # coiffures Trooper, qui ont leur propre squelette à 2 os.
    pose = SANS_SQUELETTE
    if SANS_SQUELETTE:
        journal("SANS_SQUELETTE : aucun squelette impose, Interchange decide.")

    # Chemin 5.1+ : les réglages squelette vivent dans un sous-objet commun.
    # Sauté quand aucun squelette n'est imposé : voir le garde ci-dessus.
    try:
        if SANS_SQUELETTE:
            raise ValueError("aucun squelette a poser")
        commun = pipeline.get_editor_property("common_skeletal_meshes_and_animations_properties")
        commun.set_editor_property("skeleton", squelette)
        # Sans ceci, Interchange peut quand meme fabriquer un squelette neuf.
        try:
            commun.set_editor_property("import_only_animations", False)
        except Exception:                                    # noqa: BLE001
            pass
        pose = True
        journal("squelette pose via common_skeletal_meshes_and_animations_properties")
    except Exception as erreur:                              # noqa: BLE001
        journal("chemin commun indisponible (%s)" % erreur)

    if not pose:
        # Repli : propriete a plat sur le pipeline.
        try:
            if SANS_SQUELETTE:
                raise ValueError("aucun squelette a poser")
            pipeline.set_editor_property("skeleton", squelette)
            pose = True
            journal("squelette pose a plat sur le pipeline")
        except Exception as erreur:                          # noqa: BLE001
            journal("chemin a plat indisponible (%s)" % erreur)

    if not pose:
        # On refuse d'importer plutot que de produire des assets mal lies.
        journal("PROPRIETES DISPONIBLES sur InterchangeGenericAssetsPipeline :")
        for nom in sorted(dir(pipeline)):
            if not nom.startswith("_"):
                journal("    " + nom)
        return None

    # ── Textures et materiaux ────────────────────────────────────────────────
    #
    # ⚠ MESURE DU 2026-09-03 : sur 23 GLB importes, un SEUL a produit des
    # textures (SM_AssaultRifle, 4). Les MATERIAUX etaient crees partout
    # (MI_Body, MI_Head, MI_Katana) mais vides — d'ou des personnages GRIS.
    # Aucune erreur, aucun avertissement : l'import se declarait complet.
    #
    # Ce n'est ni la taille (le katana en 2048 echouait comme le corps en 4096),
    # ni le squelette (les meshes, eux, arrivaient bien). Le suspect est ce
    # pipeline : construit a neuf en Python, on n'y reglait QUE le squelette et
    # ses sous-pipelines materiaux/textures gardaient des defauts jamais
    # verifies. On les force donc explicitement, et on JOURNALISE ce qui a pu
    # etre pose — un reglage refuse en silence est ce qui nous a couté ce
    # diagnostic.
    for chemin, valeur in (
        ("import_textures", True),
        ("import_materials", True),
        ("bImportTextures", True),
        ("bImportMaterials", True),
    ):
        try:
            pipeline.set_editor_property(chemin, valeur)
            journal("pipeline : %s = %s" % (chemin, valeur))
        except Exception:                                    # noqa: BLE001
            pass  # la propriete n'existe pas sous ce nom dans cette version

    # ── Fusion des meshes statiques ──────────────────────────────────────────
    #
    # ⚠ MESURE DU 2026-09-03. Par défaut `combine_static_meshes = False` :
    # Interchange crée UN ASSET PAR NŒUD du glTF. La map Forge (un seul GLB de
    # 3 Go) a ainsi donné 12 987 StaticMesh distincts. Les poser dans le monde
    # fait 12 987 ENTITÉS, et le serveur s'écroule :
    #
    #     Tick 34 ms au repos, 113 ms des qu'un joueur se connecte
    #     (cible 33,33 ms — soit 8 images/s au lieu de 30)
    #
    # Ce n'est pas le volume de géométrie qui coûte, c'est le NOMBRE d'entités :
    # chacune a son transform, sa relevance réseau et sa place dans la boucle.
    #
    # `NARVOS_COMBINE=1` fusionne tout le GLB en un seul mesh. À réserver au
    # DÉCOR : sur des personnages, la fusion souderait les pièces modulaires
    # qu'on veut justement pouvoir attacher séparément.
    if os.environ.get("NARVOS_COMBINE") == "1":
        try:
            maillage = pipeline.get_editor_property("mesh_pipeline")
            maillage.set_editor_property("combine_static_meshes", True)
            journal("pipeline : combine_static_meshes = True (decor)")
        except Exception as erreur:                          # noqa: BLE001
            journal("ARRET : fusion impossible (%s)" % erreur)
            return None

    # ── Forcer le type StaticMesh ────────────────────────────────────────────
    #
    # Les coiffures de SciFi_Trooper_Set portent leur PROPRE squelette : deux os,
    # `root_heaD` et `head_acc`, quand les pieces d'armure en ont 68
    # (`root, pelvis, spine_01…`). Mesure du 2026-09-04 sur les 127 GLB du pack.
    #
    # `AddSkeletalMeshAttached` exige le meme squelette que le corps : une
    # coiffure importee en SkeletalMesh serait donc refusee. Attachee au socket
    # `head` — un os bien present dans les 68 — un StaticMesh suit la tete sans
    # avoir besoin d'etre skinne, ce qui est exactement ce qu'une coiffure fait.
    #
    # `NARVOS_STATIC=1` force donc le type. A reserver aux accessoires rigides :
    # sur un corps, cela supprimerait le skinning et le mesh resterait en T-pose.
    # ⚠ PAS `force_all_mesh_as_type`. L'enum `InterchangeForceMeshType` existe
    # bien en 5.7 (IFMT_STATIC_MESH), mais la PROPRIETE n'est pas exposee au
    # Python : `InterchangeGenericMeshPipeline: Failed to find property
    # 'force_all_mesh_as_type'`. Sonde du 2026-09-04 — le pipeline n'offre que
    # combine_skeletal_meshes, combine_static_meshes, fallback_collision_type,
    # force_collision_primitive_generation, import_skeletal_meshes,
    # import_static_meshes, skeletal_mesh_import_content_type.
    #
    # Refuser le SkeletalMesh suffit : un GLB skinne dont on n'importe pas le
    # SkeletalMesh ressort en StaticMesh.
    if os.environ.get("NARVOS_STATIC") == "1":
        try:
            maillage = pipeline.get_editor_property("mesh_pipeline")
            maillage.set_editor_property("import_skeletal_meshes", False)
            maillage.set_editor_property("import_static_meshes", True)
            journal("pipeline : SkeletalMesh refuse, StaticMesh seul (accessoires)")
        except Exception as erreur:                          # noqa: BLE001
            journal("ARRET : type StaticMesh impossible (%s)" % erreur)
            return None

    # ── Textures hors puissance de deux ──────────────────────────────────────
    #
    # ⚠ `allow_non_power_of_two` vaut False par défaut, et Interchange REFUSE
    # alors la texture avec un message clair mais fatal pour elle seule :
    #
    #     Cannot import texture with non-power of two dimensions
    #
    # Ça arrive dès qu'un redimensionnement préserve le ratio : une source
    # 4096×2048 ramenée à 2048 de côté donne 2048×1024, mais une source non
    # carrée sort de la puissance de deux. C'est exactement ce que produit
    # `puzzle-chunks.mjs` sur la map. Le mesh s'importe, la texture non — et le
    # décor arrive gris, comme les personnages hier.
    #
    # Unreal gère les NPOT ; il refusait seulement de le faire sans qu'on le
    # demande.
    try:
        textures = (pipeline
                    .get_editor_property("material_pipeline")
                    .get_editor_property("texture_pipeline"))
        textures.set_editor_property("allow_non_power_of_two", True)
        journal("pipeline : allow_non_power_of_two = True")
    except Exception as erreur:                              # noqa: BLE001
        journal("pipeline : NPOT non reglable (%s)" % erreur)

    for sous in ("texture_pipeline", "material_pipeline", "common_meshes_properties"):
        try:
            objet = pipeline.get_editor_property(sous)
            journal("pipeline : sous-objet %s = %s" % (sous, type(objet).__name__))
        except Exception as erreur:                          # noqa: BLE001
            journal("pipeline : pas de sous-objet %s (%s)" % (sous, erreur))

    return pipeline


pipeline = construire_pipeline()
if pipeline is None:
    journal("ARRET : impossible de forcer le squelette. Rien importe.")
    raise SystemExit(1)


# ── Import ────────────────────────────────────────────────────────────────────

def sous_dossier(chemin):
    """Reproduit l'arborescence du pack sous /Game/Narvos/<pack>/ : un import a
    plat melangerait Meshes/ et Animations/, et les noms se marcheraient dessus."""
    relatif = os.path.relpath(os.path.dirname(chemin), racine_pack).replace("\\", "/")
    if relatif in (".", ""):
        return DESTINATION
    return DESTINATION + "/" + relatif


# ⚠ NE PAS UTILISER AssetTools.import_asset_tasks() ICI.
#
# Mesuré le 2026-09-02 : après l'import, AssetTools synchronise le navigateur de
# contenu (SyncBrowserToFolders / SetSelectedPaths). Un commandlet n'a pas
# d'application Slate → `Assertion failed: CurrentApplication.IsValid()`
# (SlateApplication.h:321) et le processus meurt, import perdu. La pile le dit
# sans ambiguïté : ContentBrowser.dll → AssetTools.dll → InterchangeEngine.dll.
#
# C'est le même mur que `scripts/unreal-uniglb-headless.mjs` contourne en
# patchant la source d'UniGLB. Ici le fautif est le moteur : on ne patche pas,
# on passe à côté. InterchangeManager fait l'import sans jamais toucher au
# navigateur.

manager = unreal.InterchangeManager.get_interchange_manager_scripted()

parametres = unreal.ImportAssetParameters()
parametres.set_editor_property("is_automated", True)
try:
    parametres.set_editor_property("override_pipelines", [pipeline])
    journal("pipeline impose via override_pipelines")
except Exception as erreur:                              # noqa: BLE001
    # Certaines versions attendent des SoftObjectPath plutôt que des objets.
    journal("override_pipelines refuse l objet (%s) — tentative par chemin" % erreur)
    try:
        parametres.set_editor_property(
            "override_pipelines", [unreal.SoftObjectPath(pipeline.get_path_name())]
        )
        journal("pipeline impose par SoftObjectPath")
    except Exception as erreur2:                         # noqa: BLE001
        journal("ARRET : pipeline non imposable (%s)" % erreur2)
        raise SystemExit(1)

journal("import de %d fichier(s) vers %s" % (len(fichiers), DESTINATION))

reussis, echecs, sautes = 0, 0, 0
destinations_touchees = []
for i, chemin in enumerate(fichiers, 1):
    destination = sous_dossier(chemin)
    nom = os.path.splitext(os.path.basename(chemin))[0]

    # Un import de 600 fichiers sera relancé — après un plantage, pour ajouter un
    # pack, pour reprendre. Réimporter ce qui est déjà là coûterait des dizaines
    # de minutes pour un résultat identique.
    if unreal.EditorAssetLibrary.does_asset_exist(destination + "/" + nom):
        sautes += 1
        continue

    try:
        source = manager.create_source_data(chemin)
        if manager.import_asset(destination, source, parametres):
            reussis += 1
            if destination not in destinations_touchees:
                destinations_touchees.append(destination)
            journal("[%d/%d] OK    %-45s -> %s" % (i, len(fichiers), os.path.basename(chemin), destination))

            # ⚠ SAUVEGARDE APRÈS CHAQUE FICHIER, pas une fois à la fin.
            #
            # Mesuré le 2026-09-03 par expérience isolée : le MÊME GLB importé
            # seul produit ses 10 Texture2D, et zéro quand il est enchaîné avec
            # 21 autres — sans la moindre erreur. Les textures compilent en
            # ASYNCHRONE (LogAsyncCompilation) ; une sauvegarde globale en fin de
            # course écrit ce qui est prêt et abandonne le reste, puis le
            # processus sort et le travail en cours est perdu.
            #
            # Sauver le dossier du fichier qu'on vient d'importer force l'attente
            # de SES compilations. C'est plus lent — une passe de sauvegarde par
            # fichier — mais c'est la différence entre des personnages texturés
            # et des personnages gris.
            unreal.EditorAssetLibrary.save_directory(destination, only_if_is_dirty=True, recursive=False)
        else:
            echecs += 1
            journal("[%d/%d] ECHEC %s" % (i, len(fichiers), os.path.basename(chemin)))
    except Exception as erreur:                          # noqa: BLE001
        echecs += 1
        journal("[%d/%d] ERREUR %s : %s" % (i, len(fichiers), os.path.basename(chemin), erreur))

journal("import : %d ok, %d en echec, %d deja presents" % (reussis, echecs, sautes))

# `import_asset` laisse les paquets en mémoire, marqués sales. Sans cette
# sauvegarde explicite, le commandlet se termine et TOUT est perdu — c'est
# précisément le symptôme qu'avait l'import headless d'UniGLB (des assets
# visibles pendant le run, aucun fichier sur le disque après).
# Filet de sécurité : chaque fichier a déjà été sauvé juste après son import
# (voir la boucle). Ce passage final ne rattrape que ce qui aurait été sali
# entre-temps.
#
# ⚠ `only_if_is_dirty=True`, PAS False. Avec False, cet appel réécrivait les
# 32 000 assets de /Game/Narvos — map comprise, soit 13 Go — à chaque import,
# pour quelques dizaines de fichiers nouveaux. La sauvegarde durait plus
# longtemps que l'import lui-même.
journal("sauvegarde finale (differentielle)...")
# ⚠ LES SEULS DOSSIERS DE CET IMPORT, PLUS `/Game/Narvos` EN ENTIER (2026-09-13).
# `Narvos/` porte désormais des LIENS DURS vers les packs d'origine (Hyper,
# Hypernova, motos…) : un asset lié qu'un chargement aurait marqué sale serait
# réécrit, et un lien dur partage son contenu avec l'original acheté. On ne
# sauve que ce que cet import a produit.
for dossier in destinations_touchees:
    unreal.EditorAssetLibrary.save_directory(dossier, only_if_is_dirty=True, recursive=False)

# Vérification indépendante : ce que le registre voit réellement sous notre
# dossier. Le retour d'une tâche peut mentir ; le registre, non.
registre = unreal.AssetRegistryHelpers.get_asset_registry()
sous_narvos = registre.get_assets_by_path(DESTINATION, recursive=True)
journal("registre : %d asset(s) sous %s" % (len(sous_narvos), DESTINATION))

par_type = {}
for a in sous_narvos:
    t = str(a.asset_class_path.asset_name) if hasattr(a, "asset_class_path") else "?"
    par_type[t] = par_type.get(t, 0) + 1
for t in sorted(par_type):
    journal("    %-30s %d" % (t, par_type[t]))