# ══════════════════════════════════════════════════════════════════════════════
# adk-export-echantillon.py — sort UN mesh par squelette, en glTF.
#
#   UnrealEditor-Cmd.exe <projet>.uproject -run=pythonscript
#       -script=".../adk-export-echantillon.py"
#
# `NARVOS_SORTIE` : dossier de destination (chemin Windows absolu).
# `NARVOS_ETIQUETTE` : préfixe des fichiers, pour ne pas mélanger deux packs.
# `NARVOS_FILTRE` : ne garder que les squelettes dont le chemin contient ce texte.
# `NARVOS_TOUT=1` : exporter TOUS les meshes, pas un seul par squelette. À
#     n'utiliser qu'une fois le squelette validé — sinon on sort des centaines de
#     fichiers pour découvrir ensuite qu'ils sont incompatibles.
#
# ── POURQUOI ──────────────────────────────────────────────────────────────────
# `adk-audit-skeletons.py` groupe par RÉFÉRENCE d'asset et conclut « retargeting
# obligatoire » dès que le squelette n'est pas `SKEL_Mannequin`. C'est exact au
# sens d'Unreal, mais ça surestime souvent le coût réel : beaucoup de packs
# modulaires sont bâtis sur la hiérarchie du Mannequin UE4 et livrés avec leur
# PROPRE `USkeleton`, une simple copie renommée. Dans ce cas il suffit de forcer
# le squelette à l'import — ce que `adk-import-narvos.py` fait déjà — et le
# retargeting devient inutile.
#
# Ce qui tranche, ce sont les NOMS d'os. Python ne les expose pas de façon
# fiable (`USkeleton::BoneTree` porte `Name_DEPRECATED` en UE5, les noms vivent
# dans `ReferenceSkeleton`, non exposé). On passe donc par la voie déjà prouvée
# sur SK_Mannequin : export glTF, puis lecture par `narvos-skeleton-compat.mjs`.
#
# UN SEUL mesh par squelette suffit : tous les meshes d'un même `USkeleton`
# partagent par construction la même liste d'os.
#
# ⚠ NE PAS ajouter d'export FBX. Mesuré le 2026-09-02 : l'exporteur FBX d'un
# SkeletalMesh passe par MeshMergeUtilities, qui exige un MeshObject de rendu
# qu'un commandlet n'initialise pas — assertion fatale et mort du processus.
# ══════════════════════════════════════════════════════════════════════════════

import os

import unreal


def journal(message):
    unreal.log("[NARVOS] " + message)


def _env(nom, defaut):
    """Lit une variable d'environnement en se méfiant de Git Bash.

    ⚠ MSYS réécrit toute valeur qui ressemble à un chemin POSIX avant de la
    passer au processus. On n'accepte donc qu'un chemin Windows absolu, et on
    retombe sur le défaut sinon — plutôt qu'écrire dans un dossier surprise.
    """
    v = os.environ.get(nom, "").replace("\\", "/").strip()
    return v if v else defaut


SORTIE = _env("NARVOS_SORTIE", unreal.Paths.project_saved_dir() + "echantillons")
ETIQUETTE = _env("NARVOS_ETIQUETTE", "pack")
FILTRE = _env("NARVOS_FILTRE", "")
TOUT = _env("NARVOS_TOUT", "") == "1"

os.makedirs(SORTIE, exist_ok=True)

registre = unreal.AssetRegistryHelpers.get_asset_registry()

# Sans scan explicite, un projet jamais ouvert rend zéro asset ET se déclare en
# succès — le pire des retours. Voir adk-audit-skeletons.py.
journal("scan du registre...")
registre.search_all_assets(True)

actifs = registre.get_assets_by_path("/Game", recursive=True)
meshes = [a for a in actifs if str(a.asset_class_path.asset_name) == "SkeletalMesh"]

journal("%d SkeletalMesh dans %s" % (len(meshes), ETIQUETTE))

# ── un représentant par squelette ─────────────────────────────────────────────
representants = {}

for a in meshes:
    chemin = str(a.package_name)
    actif = unreal.load_asset(chemin)
    if actif is None:
        continue
    try:
        squelette = actif.get_editor_property("skeleton")
    except Exception:                                            # noqa: BLE001
        continue
    if squelette is None:
        continue

    cle = squelette.get_path_name().split(".")[0]
    if FILTRE and FILTRE not in cle:
        continue

    if TOUT:
        # Clé unique par mesh : on veut tout le pack, pas un représentant.
        representants[chemin] = (chemin, actif)
    elif cle not in representants:
        representants[cle] = (chemin, actif)

if FILTRE:
    journal("filtre : %s" % FILTRE)
journal("%d asset(s) a exporter (%s)" % (
    len(representants), "tout le pack" if TOUT else "un par squelette"))


def exporter_gltf(actif, destination):
    """`automated = True` est indispensable : sans lui l'exporteur ouvre une
    boîte de dialogue, ce qui bloque un processus sans interface."""
    tache = unreal.AssetExportTask()
    tache.set_editor_property("object", actif)
    tache.set_editor_property("filename", destination)
    tache.set_editor_property("automated", True)
    tache.set_editor_property("replace_identical", True)
    tache.set_editor_property("prompt", False)

    options = unreal.GLTFExportOptions()
    # Sans les poids de skinning, le GLB sort sans squelette : l'export
    # réussirait et la comparaison d'os rendrait « SANS OS » à tort.
    options.set_editor_property("export_vertex_skin_weights", True)
    options.set_editor_property("export_animation_sequences", False)
    tache.set_editor_property("options", options)

    return unreal.Exporter.run_asset_export_task(tache)


reussis, echecs = 0, 0
deja_vus = {}

for cle in sorted(representants):
    chemin, actif = representants[cle]
    nom = "%s__%s" % (ETIQUETTE, cle.split("/")[-1])

    # Deux meshes homonymes dans des dossiers différents (Male/Chest/SK_X et
    # Female/Chest/SK_X) s'écraseraient SANS erreur : le bilan annoncerait 40
    # exports pour 38 fichiers. On suffixe plutôt que de perdre en silence.
    if nom in deja_vus:
        deja_vus[nom] += 1
        journal("HOMONYME %s — suffixe _%d" % (nom, deja_vus[nom]))
        nom = "%s_%d" % (nom, deja_vus[nom])
    else:
        deja_vus[nom] = 0

    destination = os.path.join(SORTIE, nom + ".glb")

    journal("--- %s" % cle)
    journal("    mesh : %s" % chemin)

    try:
        ok = exporter_gltf(actif, destination)
    except Exception as erreur:                                  # noqa: BLE001
        journal("    ECHEC (%s)" % erreur)
        echecs += 1
        continue

    # Un exporteur peut rendre True sans rien écrire : c'est le fichier qui
    # compte, pas le retour.
    if ok and os.path.exists(destination):
        journal("    OK   %s (%.1f ko)" % (destination, os.path.getsize(destination) / 1024.0))
        reussis += 1
    else:
        journal("    ECHEC — aucun fichier ecrit")
        echecs += 1

journal("bilan : %d exporte(s), %d en echec" % (reussis, echecs))