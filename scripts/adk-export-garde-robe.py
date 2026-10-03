# ══════════════════════════════════════════════════════════════════════════════
# adk-export-garde-robe.py — sort la garde-robe MetaCustom/MetaWardrobe de l'ADK
# en glTF, pour trancher hors Unreal les trois questions qui décident du chantier.
#
#   UnrealEditor-Cmd.exe <adk>.uproject -run=pythonscript
#       -script="E:/narvosprime-web-prototype/scripts/adk-export-garde-robe.py"
#
# ── LES TROIS QUESTIONS ───────────────────────────────────────────────────────
# `AddSkeletalMeshAttached` exige le MÊME squelette que le corps, et nanos exige
# SKEL_Mannequin (68 os, UE4). La garde-robe est skinnée sur MetaHuman (314 os).
# Mesuré sur disque le 2026-09-10 : les 61 os DÉFORMANTS du Mannequin sont TOUS
# présents dans MetaHuman ; seuls 7 `ik_*` manquent, et ils ne déforment rien.
# Le rebind est donc plausible. Restent trois inconnues, et aucune ne se lit dans
# la table de noms d'un `.uasset` :
#
#   1. les POIDS de peau touchent-ils les 253 os en trop ? `spine_04`/`spine_05`
#      sont les plus dangereux : un haut pondéré dessus s'affaisserait sur
#      `spine_03` au rebind.
#   2. les CHAÎNES PARENTALES concordent-elles ? (mêmes noms ≠ même hiérarchie —
#      c'est l'erreur MetaHuman déjà payée, cf. narvos-hierarchie-os.mjs)
#   3. la POSE DE LIAISON est-elle la même ? (A-pose Manny vs T-pose : trois
#      poses différentes déjà rencontrées sur ce projet)
#
# Le glTF porte les trois : hiérarchie de nœuds, JOINTS_0/WEIGHTS_0, et les
# matrices inverse-bind. Un export suffit donc à tout trancher, sans l'éditeur
# interactif.
#
# ── CE QUI EST REPRIS DE `adk-export-mannequin.py`, ET POURQUOI ───────────────
# `automated = True` : sans lui l'exporteur ouvre une boîte de dialogue et un
# processus sans interface reste bloqué jusqu'au timeout.
# ⚠ **FBX INTERDIT.** Mesuré le 2026-09-02 : l'export FBX d'un SkeletalMesh passe
# par MeshMergeUtilities, qui exige un MeshObject de rendu qu'un commandlet
# n'initialise pas — assertion fatale `SkinnedMeshComponent.cpp:4677`, et le
# processus meurt AVANT les cibles suivantes. Le glTF passe sans rendu.
# ══════════════════════════════════════════════════════════════════════════════

import os
import unreal

SORTIE = "E:/narvosprime-web-prototype/WebPortal/Server/adk/_export/garde_robe"

# Un échantillon, pas la garde-robe entière : si ces quatre-là répondent la même
# chose, la question est tranchée pour la famille. S'ils divergent, c'est CETTE
# divergence qu'il faut connaître avant de toucher aux 988 autres.
CIBLES = [
    # Le corps MetaHuman lui-même : la référence de la famille.
    "/Game/Metahuman_Customization_System/Meta_Body_Tool/Skeletal_Meshes/metahuman_base_skel",
    # Une robe : la pièce la plus exposée aux os de torse (spine_04/05).
    "/Game/Metahuman_Customization_System/Metawadrobe/Meshes/F_Tal_Nrm_Medieval/SK_Dress",
    # Une tenue complète : couvre torse, bras et jambes d'un coup.
    "/Game/Metahuman_Customization_System/Metawadrobe/Meshes/F_Tal_Nrm_Fantasy/SK_Fantasy_outfit_1",
    # Une ceinture : petite, localisée sur le bassin — si elle aussi nomme
    # 255 os, c'est que le mesh porte le squelette entier sans le pondérer.
    "/Game/Metahuman_Customization_System/Metawadrobe/Meshes/F_Tal_Nrm_Medieval/SK_Belt",
]

os.makedirs(SORTIE, exist_ok=True)


def journal(message):
    unreal.log("[NARVOS] " + message)


def charger(chemin):
    try:
        actif = unreal.load_asset(chemin)
    except Exception as erreur:                      # noqa: BLE001
        journal("INTROUVABLE %s (%s)" % (chemin, erreur))
        return None
    if actif is None:
        journal("INTROUVABLE %s" % chemin)
    return actif


def exporter_gltf(actif, nom):
    destination = os.path.join(SORTIE, nom + ".glb")
    try:
        options = unreal.GLTFExportOptions()
        # Sans les poids, l'export ne répond à AUCUNE des trois questions.
        options.set_editor_property("export_vertex_skin_weights", True)
        options.set_editor_property("export_animation_sequences", False)
        tache = unreal.AssetExportTask()
        tache.set_editor_property("object", actif)
        tache.set_editor_property("filename", destination)
        tache.set_editor_property("automated", True)
        tache.set_editor_property("replace_identical", True)
        tache.set_editor_property("prompt", False)
        tache.set_editor_property("options", options)
        if unreal.Exporter.run_asset_export_task(tache):
            journal("glTF  OK    " + destination)
            return True
        journal("glTF  REFUSE " + nom)
    except Exception as erreur:                      # noqa: BLE001
        journal("glTF  ECHEC  %s (%s)" % (nom, erreur))
    return False


journal("export garde-robe vers " + SORTIE)

reussis, echecs = 0, 0
for chemin in CIBLES:
    actif = charger(chemin)
    if actif is None:
        echecs += 1
        continue
    nom = chemin.rsplit("/", 1)[-1]
    journal("--- %s (%s)" % (nom, type(actif).__name__))
    if exporter_gltf(actif, nom):
        reussis += 1
    else:
        echecs += 1

journal("TERMINE : %d export(s), %d echec(s)" % (reussis, echecs))