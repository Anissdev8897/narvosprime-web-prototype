# ══════════════════════════════════════════════════════════════════════════════
# adk-retarget-anims.py — les 1 701 animations UEFN portées sur le Mannequin UE4,
# c'est-à-dire sur le squelette que nanos exige.
#
# ── OÙ LE LANCER ──────────────────────────────────────────────────────────────
#
# Dans le projet **GameAnimationSample**, PAS dans l'ADK : le retargeter, les
# deux meshes et les animations y vivent tous. Le résultat sera migré vers l'ADK
# ensuite (voir « APRÈS » en bas de ce fichier).
#
# L'éditeur étant ouvert, le projet est verrouillé : un commandlet
# `UnrealEditor-Cmd -run=pythonscript` échouerait. On passe donc par la console
# Python de l'éditeur (Output Log → menu déroulant `Cmd` → `Python`) :
#
#     py "E:/narvosprime-web-prototype/scripts/adk-retarget-anims.py"
#
# Par défaut il ne fabrique RIEN : il compte et affiche. Pour écrire :
#
#     import os; os.environ["NARVOS_APPLY"] = "1"
#     py "E:/narvosprime-web-prototype/scripts/adk-retarget-anims.py"
#
# Et pour n'essayer qu'un lot d'abord — recommandé, `Idle` fait 47 fichiers :
#
#     import os; os.environ["NARVOS_LOT"] = "Idle"
#
# ── POURQUOI CE SCRIPT ────────────────────────────────────────────────────────
#
# nanos impose `SKEL_Mannequin`, le Mannequin **UE4** (68 os). Les 1 701
# animations du sample sont sur `SK_UEFN_Mannequin`. Elles sont donc
# inutilisables telles quelles — et ce n'est pas une correspondance d'os à
# deviner : Epic livre la table toute faite, `RTG_UEFN_to_UE4_Mannequin`.
#
# ── LES TROIS PIÈGES, RELEVÉS DANS LA SOURCE 5.7 ──────────────────────────────
#
# 1. `SK_` EST LE SQUELETTE, `SKM_` EST LE MESH.
#    `duplicate_and_retarget` veut des `USkeletalMesh`. Lui passer `SK_…` rend
#    `None` au chargement typé et l'opération ne fait rien. Mesuré sur disque :
#    `SK_UE4_Mannequin.uasset` = 24 Ko (squelette), `SKM_…` = 8,5 Mo (mesh).
#
# 2. LES DOUBLONS ATTERRISSENT DANS `/Game`, À LA RACINE.
#    `UIKRetargetBatchOperation::DuplicateAndRetarget` n'expose pas le dossier de
#    sortie ; il remplit un `FNameDuplicationRule` dont `FolderPath` vaut par
#    défaut `"/Game"` (EditorAnimUtils.h:27), et `DuplicateAssetsInternal` s'en
#    sert tel quel (EditorAnimUtils.cpp:480). Sans déplacement, 1 701 assets en
#    vrac à la racine du Content.
#    → on traite lot par lot et on RANGE après chaque lot, pour que la racine ne
#      contienne jamais plus d'un lot à la fois.
#
# 3. `CreateUniqueAssetName` RENOMME EN SILENCE.
#    Si un asset du même nom traîne déjà à la racine, le doublon devient
#    `Nom_1` — sans erreur, et le catalogue Lua qui cherchera `Nom` ne trouvera
#    rien. C'est la même panne muette que les 67 animations mortes de 2026-09.
#    → on compare le nombre rendu au nombre demandé, et on refuse de continuer
#      si la racine n'est pas vide au départ.
#
# ── CE QUI N'EST PAS FAIT ICI ─────────────────────────────────────────────────
#
# Les AnimSequence seules sont portées. Les 193 `MotionMatchingData` sont des
# PoseSearchDatabase et les 19 `ExperimentalStateMachineData` des assets de
# graphe : nanos joue une animation par `PlayAnimation(chemin)` en Lua, pas par
# AnimBP. Les porter n'aurait servi à rien tant qu'on n'a pas prouvé qu'un AnimBP
# se cuit dans un asset pack nanos — ce qui reste à démontrer.
# ══════════════════════════════════════════════════════════════════════════════

import os

import unreal

# ── Constantes ────────────────────────────────────────────────────────────────

# ── PARAMETRABLE DEPUIS LE 2026-09-13 ─────────────────────────────────────────
# Ecrit pour GameAnimationSample ; reutilise pour AI Behavior System (animations
# sur Manny UE5, retargeter `RTG_UE5Manny_UE4Manny` livre par le pack). Les
# valeurs par defaut restent celles du premier usage ; chaque constante se
# surcharge par une variable d'environnement du meme nom prefixee `NARVOS_RT_`.
SOURCE = os.environ.get("NARVOS_RT_SOURCE", "/Game/Characters/UEFN_Mannequin/Animations")
MESH_SOURCE = os.environ.get("NARVOS_RT_MESH_SOURCE", "/Game/Characters/UEFN_Mannequin/Meshes/SKM_UEFN_Mannequin")
MESH_CIBLE = os.environ.get("NARVOS_RT_MESH_CIBLE", "/Game/Characters/UE4_Mannequin/Meshes/SKM_UE4_Mannequin")
RETARGETER = os.environ.get("NARVOS_RT_RETARGETER", "/Game/Characters/UE4_Mannequin/Rigs/RTG_UEFN_to_UE4_Mannequin")

# Où les animations portées sont rangées. Un dossier à nous, migrable d'un bloc.
DESTINATION = os.environ.get("NARVOS_RT_DESTINATION", "/Game/NARVOS_Retarget")

# Racine où `duplicate_and_retarget` dépose ses doublons — imposée par le moteur,
# pas par nous. Voir piège n°2.
DEPOT = "/Game"

CLASSE_ANIM = unreal.TopLevelAssetPath("/Script/Engine", "AnimSequence")

APPLIQUER = os.environ.get("NARVOS_APPLY", "").strip() not in ("", "0", "false", "False")
LOT_UNIQUE = os.environ.get("NARVOS_LOT", "").strip()


def journal(message):
    unreal.log("[NARVOS] " + message)


# ── Chargement des trois pièces ───────────────────────────────────────────────


def charger(chemin, classe_attendue, role):
    """Charge un asset et vérifie sa classe.

    Le contrôle de classe n'est pas décoratif : `SK_` et `SKM_` se ressemblent,
    et passer le squelette au lieu du mesh ne lève rien — l'opération se termine
    « avec succès » sans produire un seul fichier."""
    actif = unreal.load_asset(chemin)
    if actif is None:
        journal("INTROUVABLE (%s) : %s" % (role, chemin))
        return None
    if not isinstance(actif, classe_attendue):
        journal("MAUVAISE CLASSE (%s) : %s est %s, attendu %s"
                % (role, chemin, type(actif).__name__, classe_attendue.__name__))
        return None
    return actif


# ── Inventaire ────────────────────────────────────────────────────────────────


def lots():
    """Les sous-dossiers d'animations, avec leurs AnimSequence.

    Rend une liste (nom, [AssetData]) triée par nom, pour que deux exécutions
    fassent le même travail dans le même ordre."""
    registre = unreal.AssetRegistryHelpers.get_asset_registry()

    # ⚠ Le registre n'est peuplé que par un scan. Sans cette ligne, un projet
    # dont le cache est froid rend ZÉRO asset et le script se dit « terminé ».
    journal("scan du registre...")
    registre.search_all_assets(True)

    trouves = {}
    filtre = unreal.ARFilter(
        package_paths=[SOURCE],
        recursive_paths=True,
        class_paths=[CLASSE_ANIM],
    )
    for actif in registre.get_assets(filtre):
        chemin = str(actif.package_name)
        reste = chemin[len(SOURCE) + 1:]
        lot = reste.split("/")[0] if "/" in reste else "_racine"
        trouves.setdefault(lot, []).append(actif)

    return sorted(trouves.items())


def contenu_dossier(chemin):
    """Les AnimSequence deja presentes dans un dossier de destination."""
    registre = unreal.AssetRegistryHelpers.get_asset_registry()
    filtre = unreal.ARFilter(
        package_paths=[chemin],
        recursive_paths=False,
        class_paths=[CLASSE_ANIM],
    )
    return [str(a.package_name) for a in registre.get_assets(filtre)]


def contenu_depot():
    """Les AnimSequence posées à la racine du Content.

    Doit être vide avant de lancer un lot : sinon `CreateUniqueAssetName`
    suffixerait les nouvelles (piège n°3) et on ne saurait plus lesquelles
    ranger."""
    registre = unreal.AssetRegistryHelpers.get_asset_registry()
    filtre = unreal.ARFilter(
        package_paths=[DEPOT],
        recursive_paths=False,
        class_paths=[CLASSE_ANIM],
    )
    return [str(a.package_name) for a in registre.get_assets(filtre)]


# ── Traitement d'un lot ───────────────────────────────────────────────────────


def traiter(nom_lot, assets, mesh_source, mesh_cible, retargeter):
    """Porte un lot, puis le range. Rend (demandes, produites, rangees)."""
    demandes = len(assets)
    journal("")
    journal("── %s : %d animation(s)" % (nom_lot, demandes))

    if not APPLIQUER:
        return (demandes, 0, 0)

    # Un lot deja range en entier est SAUTE, pas refait.
    #
    # Sans ce saut, la relance reproduit les memes doublons dans /Game, puis
    # `rename_asset` les refuse un a un (la destination existe deja) et ils
    # RESTENT a la racine. Le lot suivant tombe alors sur le garde-fou du depot
    # et tout ce qui suit est refuse. Mesure du 2026-09-04 : 5 lots passes,
    # 8 refuses, 44 orphelins a la racine — pour avoir relance Idle.
    dossier = "%s/%s" % (DESTINATION, nom_lot)
    deja = contenu_dossier(dossier)
    if len(deja) >= demandes:
        journal("   deja range (%d presente(s)) — saute" % len(deja))
        return (demandes, 0, len(deja))

    residu = contenu_depot()
    if residu:
        journal("   REFUS : %d AnimSequence traine(nt) deja dans %s." % (len(residu), DEPOT))
        journal("   Les ranger ou les supprimer avant de relancer — sinon les")
        journal("   nouvelles seront suffixees _1 en silence.")
        for chemin in residu[:5]:
            journal("      %s" % chemin)
        return (demandes, 0, 0)

    produites = unreal.IKRetargetBatchOperation.duplicate_and_retarget(
        assets_to_retarget=assets,
        source_mesh=mesh_source,
        target_mesh=mesh_cible,
        ik_retarget_asset=retargeter,
        search="",
        replace="",
        prefix="",
        suffix="",
        include_referenced_assets=True,
        overwrite_existing_files=True,
    )
    journal("   %d produite(s)" % len(produites))

    if not unreal.EditorAssetLibrary.does_directory_exist(dossier):
        unreal.EditorAssetLibrary.make_directory(dossier)

    ranges = 0
    for actif in produites:
        depart = str(actif.package_name)
        arrivee = "%s/%s" % (dossier, depart.rsplit("/", 1)[-1])
        # `rename_asset` n'ecrase pas : une destination occupee le fait echouer,
        # et le doublon reste a la racine. Sur un lot PARTIEL relance, la cible
        # est notre propre sortie precedente — on la retire d'abord.
        if unreal.EditorAssetLibrary.does_asset_exist(arrivee):
            unreal.EditorAssetLibrary.delete_asset(arrivee)
        if unreal.EditorAssetLibrary.rename_asset(depart, arrivee):
            ranges += 1
        else:
            journal("   DEPLACEMENT REFUSE : %s -> %s" % (depart, arrivee))

    unreal.EditorAssetLibrary.save_directory(dossier, only_if_is_dirty=True, recursive=True)
    journal("   %d rangee(s) dans %s" % (ranges, dossier))

    if ranges != demandes:
        journal("   ECART : %d demandees, %d rangees — relire la liste ci-dessus."
                % (demandes, ranges))

    return (demandes, len(produites), ranges)


# ── Exécution ─────────────────────────────────────────────────────────────────


def executer():
    journal("=== APPLIQUE ===" if APPLIQUER else "=== SIMULATION (NARVOS_APPLY=1 pour ecrire) ===")

    mesh_source = charger(MESH_SOURCE, unreal.SkeletalMesh, "mesh source")
    mesh_cible = charger(MESH_CIBLE, unreal.SkeletalMesh, "mesh cible")
    retargeter = charger(RETARGETER, unreal.IKRetargeter, "retargeter")
    if not (mesh_source and mesh_cible and retargeter):
        journal("Une piece manque — rien fait.")
        return

    groupes = lots()
    if LOT_UNIQUE:
        groupes = [(n, a) for (n, a) in groupes if n == LOT_UNIQUE]
        if not groupes:
            journal("LOT INCONNU : %s" % LOT_UNIQUE)
            journal("Lots disponibles : %s" % ", ".join(n for (n, _) in lots()))
            return

    total = sum(len(a) for (_, a) in groupes)
    journal("%d lot(s), %d AnimSequence au total" % (len(groupes), total))

    demandes = produites = ranges = 0
    for nom, assets in groupes:
        d, p, r = traiter(nom, assets, mesh_source, mesh_cible, retargeter)
        demandes += d
        produites += p
        ranges += r

    journal("")
    journal("=== BILAN ===")
    journal("   demandees : %d" % demandes)
    if APPLIQUER:
        journal("   produites : %d" % produites)
        journal("   rangees   : %d  sous %s" % (ranges, DESTINATION))
        if ranges == demandes:
            journal("")
            journal("APRES : migrer %s vers l'ADK (clic droit > Migrate), puis" % DESTINATION)
            journal("cuire le pack avec scripts/nanos-build-asset-pack.mjs.")
    else:
        journal("   Rien ecrit.")


executer()

# Lance par l'editeur COMPLET (`-ExecutePythonScript`), le script doit le fermer
# lui-meme, sinon la chaine qui attend la fin du processus attend pour toujours.
# `rename_asset` passe par AssetTools, qui veut une application Slate : c'est
# pourquoi on ne tourne pas en commandlet.
if os.environ.get("NARVOS_RT_QUITTER", "").strip() not in ("", "0", "false", "False"):
    journal("fermeture de l'editeur (NARVOS_RT_QUITTER)")
    unreal.SystemLibrary.quit_editor()