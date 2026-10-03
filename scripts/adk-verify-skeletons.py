# ══════════════════════════════════════════════════════════════════════════════
# adk-verify-skeletons.py — à quel squelette chaque mesh importé est-il lié ?
#
#   UnrealEditor-Cmd.exe <ADK>.uproject -run=pythonscript
#       -script="D:/.../scripts/adk-verify-skeletons.py"
#
# POURQUOI CETTE VÉRIFICATION SÉPARÉE : un import peut réussir — assets créés,
# aucune erreur — et produire des meshes liés à un squelette FRAÎCHEMENT CRÉÉ
# plutôt qu'à `SKEL_Mannequin`. nanos les refusera à l'attachement, sans message
# exploitable. Le journal d'import ne le dit pas ; seul l'asset le sait.
#
# On ne fait donc pas confiance au fait que la propriété `skeleton` du pipeline
# ait été acceptée : on relit ce qui est sur le disque.
# ══════════════════════════════════════════════════════════════════════════════

import unreal

RACINE = "/Game/Narvos"
ATTENDU = "/Game/NanosWorld/Characters/Common/SKEL_Mannequin"


def journal(message):
    unreal.log("[NARVOS] " + message)


registre = unreal.AssetRegistryHelpers.get_asset_registry()
actifs = registre.get_assets_by_path(RACINE, recursive=True)

journal("%d asset(s) sous %s" % (len(actifs), RACINE))

par_type = {}
for a in actifs:
    t = str(a.asset_class_path.asset_name)
    par_type[t] = par_type.get(t, 0) + 1
for t in sorted(par_type):
    journal("    %-28s %d" % (t, par_type[t]))

journal("")
journal("=== liaison des SkeletalMesh ===")

bons, mauvais, illisibles = 0, 0, 0
squelettes_vus = {}

for a in actifs:
    if str(a.asset_class_path.asset_name) != "SkeletalMesh":
        continue

    chemin = str(a.package_name)
    mesh = unreal.load_asset(chemin)
    if mesh is None:
        illisibles += 1
        journal("  ILLISIBLE  %s" % chemin)
        continue

    squelette = mesh.get_editor_property("skeleton")
    nom_sq = squelette.get_path_name().split(".")[0] if squelette else "(aucun)"
    squelettes_vus[nom_sq] = squelettes_vus.get(nom_sq, 0) + 1

    if nom_sq == ATTENDU:
        bons += 1
    else:
        mauvais += 1
        journal("  MAUVAIS    %-55s -> %s" % (chemin.split("/")[-1], nom_sq))

journal("")
journal("%d mesh(es) lie(s) a SKEL_Mannequin, %d lie(s) ailleurs, %d illisible(s)"
        % (bons, mauvais, illisibles))

journal("")
journal("=== squelettes references ===")
for sq in sorted(squelettes_vus, key=lambda k: -squelettes_vus[k]):
    marque = "OK " if sq == ATTENDU else "!! "
    journal("  %s%-70s %d mesh(es)" % (marque, sq, squelettes_vus[sq]))

if mauvais > 0:
    journal("")
    journal("ACTION : ces meshes doivent etre reimportes avec le squelette impose,")
    journal("ou retargetes. En l etat nanos refusera de les attacher.")