# ══════════════════════════════════════════════════════════════════════════════
# adk-navmesh-gui.py — construire le NavMesh dans l'ÉDITEUR INTERACTIF.
#
#   UnrealEditor.exe NanosWorldADK.uproject \
#       -ExecutePythonScript="E:/narvosprime-web-prototype/scripts/adk-navmesh-gui.py" \
#       -nosplash -stdout -log
#
# ══ POURQUOI L'ÉDITEUR INTERACTIF ══════════════════════════════════════════════
# Mesuré sur 5 commandlets headless (2026-09-20) : la scène physique ne
# s'initialise PAS sans frames réelles — raycasts 0/6 partout, bounds de
# composants vides, et la génération Recast construit 0 tile en 0,03 s. Les
# meshes ont pourtant leurs BodySetup (collisions présentes dans les .uasset).
# Le build NavMesh exige des ticks : l'éditeur interactif en produit.
# ══════════════════════════════════════════════════════════════════════════════

import os
import time

import unreal

RAPPORT = "E:/narvosprime-web-prototype/.hermes/navmesh_gui.txt"
MAPE = "/Game/Narvos/Maps/Map_Narvos"
X_SPAWN, Y_SPAWN, Z_SPAWN = -8599810.0, 195026.0, 146475.0
DEMIE, DEMI_Z = 40000.0, 7500.0
COTE_BRUSH = 200.0

def journal(txt):
    try:
        unreal.log("[NARVOS] " + txt)
    except Exception:
        pass
    try:
        with open(RAPPORT, "a", encoding="utf-8") as f:
            f.write(txt + "\n")
    except Exception:
        pass

def construire():
    journal("─ NAVMESH GUI : demarrage ─")

    # 1. Charger Map_Narvos (l'éditeur demarre sur la map nanos).
    try:
        unreal.EditorLoadingAndSavingUtils.load_map(MAPE)
        journal("load_map OK")
    except Exception as e:
        journal("load_map echoue : %s" % e)
        return

    # 2. Laisser le monde se poser (streaming + registration des volumes).
    journal("attente de stabilisation (30 s de frames reelles)...")
    time.sleep(30)

    # 3. AGENT RECAST — sans lui, Navigation.Build n'a RIEN à construire.
    #    La V5 l'avait détruit et le système ne l'a jamais recréé : le spawn
    #    explicite est la seule garantie.
    monde = unreal.EditorLevelLibrary.get_editor_world()
    acteurs = unreal.EditorLevelLibrary.get_all_level_actors()
    n_agent = 0
    for a in acteurs:
        try:
            if "RecastNavMesh" in a.get_class().get_name():
                n_agent += 1
        except Exception:
            pass
    if n_agent == 0:
        agent = unreal.EditorLevelLibrary.spawn_actor_from_class(
            unreal.RecastNavMesh.static_class(), unreal.Vector(0, 0, 0),
            unreal.Rotator(0, 0, 0))
        journal("agent RecastNavMesh pose : %s" % str(agent is not None))
    else:
        journal("agent RecastNavMesh deja present : %d" % n_agent)

    # 4. Volume resserre sur le spawn, idempotent.
    acteurs = unreal.EditorLevelLibrary.get_all_level_actors()
    labels = set()
    for a in acteurs:
        try:
            labels.add(a.get_actor_label())
        except Exception:
            pass
    if "NavMeshBounds_spawn_zone" not in labels:
        vol = unreal.EditorLevelLibrary.spawn_actor_from_class(
            unreal.NavMeshBoundsVolume.static_class(),
            unreal.Vector(X_SPAWN, Y_SPAWN, Z_SPAWN), unreal.Rotator(0, 0, 0))
        if vol is not None:
            vol.set_actor_scale3d(unreal.Vector(
                (2 * DEMIE) / COTE_BRUSH, (2 * DEMIE) / COTE_BRUSH, (2 * DEMI_Z) / COTE_BRUSH))
            vol.set_actor_label("NavMeshBounds_spawn_zone")
            journal("volume pose")
    else:
        journal("volume deja pose")

    # 4. Laisser le NavigationSystem enregistrer le volume.
    time.sleep(10)

    # 5. LE BUILD — commande console de l'éditeur (fonctionne avec frames).
    for cmd in ("Navigation.Build", "BuildNavigation", "RebuildNavigation"):
        try:
            unreal.SystemLibrary.execute_console_command(monde, cmd)
            journal("commande envoyee : %s" % cmd)
            break
        except Exception as e:
            journal("commande %s refusee : %s" % (cmd, e))

    # 6. La generation tourne en tache de fond : lui donner des frames.
    journal("attente de la generation (90 s)...")
    time.sleep(90)

    # 7. Sauvegarde.
    ok = unreal.EditorLevelLibrary.save_all_dirty_levels()
    journal("sauvegarde : %s" % str(ok))
    journal("─ NAVMESH GUI TERMINE ─")

    # 8. Sortir de l'éditeur (la fenetre se ferme seule).
    try:
        unreal.SystemLibrary.quit_editor()
    except Exception:
        pass

construire()