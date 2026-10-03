# ══════════════════════════════════════════════════════════════════════════════
# adk-export-mannequin.py — sort le Mannequin UE4 de l'ADK vers un fichier
# lisible hors Unreal.
#
#   UnrealEditor-Cmd.exe <projet>.uproject -run=pythonscript
#       -script="D:/.../scripts/adk-export-mannequin.py"
#
# POURQUOI : nanos exige que tout personnage partage le squelette
# `SKEL_Mannequin` — le Mannequin **UE4** (~68 os), PAS le Manny UE5 (89) sur
# lequel nos 10 065 GLB sont normalisés. Sans une copie de ce squelette hors
# Unreal, impossible de préparer le retargeting dans Blender : un `.uasset` est
# un paquet binaire UE, aucun autre outil ne l'ouvre.
#
# L'ADK livre ce squelette. C'est la référence, et elle est autoritative : ce
# n'est pas « un » Mannequin UE4 trouvé quelque part, c'est celui que le moteur
# du jeu attend.
#
# FORMATS : on tente glTF (GLTFExporter) ET FBX. Le premier va droit dans le
# pipeline web du projet ; le second est le format d'échange de squelettes que
# Blender et Unreal partagent le plus fidèlement. Les deux sont demandés parce
# qu'on ne sait pas encore lequel préserve le mieux la hiérarchie d'os — et le
# savoir demande de comparer, pas de choisir à l'avance.
# ══════════════════════════════════════════════════════════════════════════════

import os
import unreal

SORTIE = "E:/narvosprime-web-prototype/WebPortal/Server/adk/_export"

# Chemins de paquet : Content/ correspond à /Game/.
CIBLES = [
    "/Game/NanosWorld/Characters/Mannequin/SK_Mannequin",
    "/Game/NanosWorld/Characters/Common/SKEL_Mannequin",
    "/Game/NanosWorld/Characters/DefaultAnimations/A_Mannequin_Idle",
    "/Game/NanosWorld/Characters/DefaultAnimations/A_Mannequin_Walk",
    "/Game/NanosWorld/Characters/DefaultAnimations/A_Mannequin_Run",
]

os.makedirs(SORTIE, exist_ok=True)


def journal(message):
    unreal.log("[NARVOS] " + message)


def charger(chemin):
    """Charge un asset, ou None en le disant. `load_asset` lève sur un chemin
    absent : on préfère continuer sur les autres cibles plutôt que tout perdre
    parce qu'une animation a été renommée."""
    try:
        actif = unreal.load_asset(chemin)
    except Exception as erreur:                      # noqa: BLE001
        journal("INTROUVABLE %s (%s)" % (chemin, erreur))
        return None
    if actif is None:
        journal("INTROUVABLE %s" % chemin)
    return actif


def exporter(actif, destination, options=None):
    """Lance une tâche d'export. `automated = True` est indispensable : sans lui
    l'exporteur ouvre une boîte de dialogue, ce qui bloque un processus sans
    interface jusqu'au timeout."""
    tache = unreal.AssetExportTask()
    tache.set_editor_property("object", actif)
    tache.set_editor_property("filename", destination)
    tache.set_editor_property("automated", True)
    tache.set_editor_property("replace_identical", True)
    tache.set_editor_property("prompt", False)
    if options is not None:
        tache.set_editor_property("options", options)
    return unreal.Exporter.run_asset_export_task(tache)


def exporter_gltf(actif, nom):
    destination = os.path.join(SORTIE, nom + ".glb")
    try:
        options = unreal.GLTFExportOptions()
        # Le squelette et ses animations sont tout l'intérêt de l'export :
        # les laisser sur leur valeur par défaut risquerait un mesh nu.
        options.set_editor_property("export_animation_sequences", True)
        options.set_editor_property("export_vertex_skin_weights", True)
        if exporter(actif, destination, options):
            journal("glTF  OK   " + destination)
            return True
    except Exception as erreur:                      # noqa: BLE001
        journal("glTF  ECHEC %s (%s)" % (nom, erreur))
    return False


def exporter_fbx(actif, nom):
    destination = os.path.join(SORTIE, nom + ".fbx")
    try:
        if exporter(actif, destination):
            journal("FBX   OK   " + destination)
            return True
    except Exception as erreur:                      # noqa: BLE001
        journal("FBX   ECHEC %s (%s)" % (nom, erreur))
    return False


journal("export vers " + SORTIE)

reussis, echecs = 0, 0
for chemin in CIBLES:
    actif = charger(chemin)
    if actif is None:
        echecs += 1
        continue

    nom = chemin.rsplit("/", 1)[-1]
    journal("--- %s (%s)" % (nom, type(actif).__name__))

    # ⚠ FBX DÉSACTIVÉ — mesuré le 2026-09-02. L'exporteur FBX d'un SkeletalMesh
    # passe par MeshMergeUtilities, qui exige un MeshObject de rendu qu'un
    # commandlet n'initialise pas : assertion fatale
    # `SkinnedMeshComponent.cpp:4677`, et le processus meurt AVANT de traiter les
    # cibles suivantes. Une seule des cinq était sortie.
    #
    # Le glTF, lui, passe sans rendu — et il suffit : le SK_Mannequin.glb obtenu
    # porte ses 68 os et ses poids de skinning, vérifiés. Ne pas réactiver le FBX
    # sans `-AllowCommandletRendering`, et le mettre EN DERNIER de toute façon.
    if exporter_gltf(actif, nom):
        reussis += 1
    else:
        echecs += 1

journal("bilan : %d exporte(s), %d en echec" % (reussis, echecs))

# Inventaire de ce qui a réellement atterri sur le disque : un exporteur peut
# rendre True sans écrire, et c'est le fichier qui compte, pas le retour.
for fichier in sorted(os.listdir(SORTIE)):
    chemin = os.path.join(SORTIE, fichier)
    journal("  %-40s %8.1f ko" % (fichier, os.path.getsize(chemin) / 1024.0))