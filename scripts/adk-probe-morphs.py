# ══════════════════════════════════════════════════════════════════════════════
# adk-probe-morphs.py — les morph targets ont-ils survécu à l'import ?
#
#   UnrealEditor-Cmd.exe <ADK>.uproject -run=pythonscript
#       -script="D:/.../scripts/adk-probe-morphs.py"
#
# POURQUOI : le GLB de tête porte 52 morph targets — exactement le jeu ARKit —
# mais SANS noms ni poids, d'où l'avertissement d'Interchange :
#
#     The glTF node's MorphTargetNames count does not match its
#     MorphTargetWeights count.
#
# Un avertissement n'est pas un refus. La question est donc : le SkeletalMesh
# importé a-t-il ses 52 cibles, et sous quels NOMS ? nanos pilote les morphs par
# `SetMorphTarget(nom, valeur)` — sans nom exploitable, le système existe mais
# reste inatteignable depuis le Lua.
#
# C'est le même mécanisme que l'éditeur SASSA du runtime web, qui pilote déjà
# des morphs MPFB2. Savoir si le chemin Unreal les préserve décide si la
# personnalisation NARVOS peut exister dans nanos.
# ══════════════════════════════════════════════════════════════════════════════

import unreal


def journal(message):
    unreal.log("[NARVOS] " + message)


CIBLES = [
    "/Game/Narvos/CyberpunkSamurai/Meshes/SK_CyberpunkSamurai_Head",
    "/Game/Narvos/CyberpunkSamurai/Meshes/SK_CyberpunkSamurai_WithHelmet",
    "/Game/Narvos/CyberpunkSamurai/Demo/Animations/FaceRigTest",
]

for chemin in CIBLES:
    mesh = unreal.load_asset(chemin)
    if mesh is None:
        journal("INTROUVABLE %s" % chemin)
        continue

    nom = chemin.rsplit("/", 1)[-1]

    # L'API a bougé entre versions : on tente les deux accès connus plutôt que
    # de parier sur un seul.
    noms = None
    for accesseur in ("get_all_morph_target_names", "get_morph_target_names"):
        if hasattr(mesh, accesseur):
            try:
                noms = list(getattr(mesh, accesseur)())
                break
            except Exception:                                # noqa: BLE001
                pass

    if noms is None:
        try:
            noms = [str(m.get_name()) for m in mesh.get_editor_property("morph_targets")]
        except Exception as erreur:                          # noqa: BLE001
            journal("%s : morphs illisibles (%s)" % (nom, erreur))
            continue

    journal("%s : %d morph target(s)" % (nom, len(noms)))
    for n in noms[:14]:
        journal("      %s" % n)
    if len(noms) > 14:
        journal("      … et %d autres" % (len(noms) - 14))