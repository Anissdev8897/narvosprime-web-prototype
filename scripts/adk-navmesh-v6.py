# ══════════════════════════════════════════════════════════════════════════════
# adk-navmesh-v6.py — rejouer le flux QUI MARCHAIT (V3), avec le petit volume.
#
# Mesuré : en V3, la génération partait AU LOAD parce que la map avait des
# volumes et un navmesh data qui ne les couvrait pas. Les V4/V5 ont échoué car
# la map avait un navmesh data « propre » (recréé vide et sauvé à jour) : plus
# rien à générer. On repart donc de la MAP VIERGE (sauvegarde d'avant les
# volumes, restaurée par le bash avant ce script) : pose du volume resserré,
# sauvegarde, RE-CHARGEMENT (le système crée l'agent et génère), sauvegarde.
# ══════════════════════════════════════════════════════════════════════════════

import os

import unreal

APPLIQUER = os.environ.get("NARVOS_NAVMESH_APPLIQUER") == "1"
MAPE = "/Game/Narvos/Maps/Map_Narvos"
X_SPAWN, Y_SPAWN, Z_SPAWN = -8599810.0, 195026.0, 146475.0
DEMIE, DEMI_Z = 40000.0, 7500.0
COTE_BRUSH = 200.0

def journal(txt):
    try:
        unreal.log("[NARVOS] " + txt)
    except Exception:
        pass

def construire():
    journal("─ V6 : map vierge + volume + generation au load ─")
    try:
        unreal.EditorLoadingAndSavingUtils.load_map(MAPE)
        journal("load_map OK")
    except Exception as e:
        journal("load_map echoue (%s)" % e)
        unreal.EditorLevelLibrary.load_level(MAPE)

    acteurs = unreal.EditorLevelLibrary.get_all_level_actors()
    n_volumes, n_agents = 0, 0
    for a in acteurs:
        try:
            cls = a.get_class().get_name()
        except Exception:
            continue
        if cls == "NavMeshBoundsVolume":
            n_volumes += 1
        if "RecastNavMesh" in cls:
            n_agents += 1
    journal("etat initial : %d volume(s), %d agent(s)" % (n_volumes, n_agents))

    vol = unreal.EditorLevelLibrary.spawn_actor_from_class(
        unreal.NavMeshBoundsVolume.static_class(),
        unreal.Vector(X_SPAWN, Y_SPAWN, Z_SPAWN), unreal.Rotator(0, 0, 0))
    if vol is not None:
        vol.set_actor_scale3d(unreal.Vector(
            (2 * DEMIE) / COTE_BRUSH, (2 * DEMIE) / COTE_BRUSH, (2 * DEMI_Z) / COTE_BRUSH))
        vol.set_actor_label("NavMeshBounds_spawn_zone")
        journal("volume pose")

    if not APPLIQUER:
        journal("MESURE SEULE — relancer avec NARVOS_NAVMESH_APPLIQUER=1.")
        return

    unreal.EditorLevelLibrary.save_all_dirty_levels()
    journal("sauvegarde 1 (volume sur map vierge)")

    try:
        unreal.EditorLoadingAndSavingUtils.load_map(MAPE)
        journal("rechargement OK — agent cree + generation au load")
    except Exception as e:
        journal("rechargement echoue : %s" % e)

    unreal.EditorLevelLibrary.save_all_dirty_levels()
    journal("sauvegarde 2 (navmesh genere)")
    journal("TERMINE")

construire()