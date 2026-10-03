# ══════════════════════════════════════════════════════════════════════════════
# adk-navmesh-v5.py — forcer la régénération en détruisant le navmesh data.
#
# ══ POURQUOI ══════════════════════════════════════════════════════════════════
# Mesuré : le ResavePackages -buildnavigationdata a construit 0 tile en 0,03 s
# — le navmesh data (recréé VIDE et sauvé « propre » par la V4) n'a aucune
# zone dirty à regénérer. Le seul chemin PROUVÉ sur ce projet est la génération
# AU CHARGEMENT de la map (LogNavigation vu au load V3). On détruit donc
# l'agent RecastNavMesh : au rechargement, le NavigationSystem en recrée un
# (bAutoCreateNavigationData) et génère TOUT depuis le volume — pendant le
# load lui-même. La sauvegarde qui suit capture les tiles.
# ══════════════════════════════════════════════════════════════════════════════

import os

import unreal

APPLIQUER = os.environ.get("NARVOS_NAVMESH_APPLIQUER") == "1"
MAPE = "/Game/Narvos/Maps/Map_Narvos"

def journal(txt):
    try:
        unreal.log("[NARVOS] " + txt)
    except Exception:
        pass

def construire():
    journal("─ V5 : destruction du navmesh data, regeneration au load ─")
    try:
        unreal.EditorLoadingAndSavingUtils.load_map(MAPE)
        journal("load_map OK")
    except Exception as e:
        journal("load_map a echoue (%s)" % e)
        unreal.EditorLevelLibrary.load_level(MAPE)

    acteurs = unreal.EditorLevelLibrary.get_all_level_actors()
    n_agents, n_volumes = 0, 0
    for a in acteurs:
        try:
            cls = a.get_class().get_name()
        except Exception:
            continue
        if "RecastNavMesh" in cls:
            n_agents += 1
            if APPLIQUER:
                a.destroy_actor()
        elif cls == "NavMeshBoundsVolume":
            n_volumes += 1
            journal("volume conserve : %s" % a.get_actor_label())
    journal("agents RecastNavMesh : %d (detruits) | volumes : %d"
            % (n_agents, n_volumes))

    if not APPLIQUER:
        journal("MESURE SEULE — relancer avec NARVOS_NAVMESH_APPLIQUER=1.")
        return

    unreal.EditorLevelLibrary.save_all_dirty_levels()
    journal("sauvegarde 1 (sans navmesh data)")

    try:
        unreal.EditorLoadingAndSavingUtils.load_map(MAPE)
        journal("rechargement OK — l'agent se recree, la generation part au load")
    except Exception as e:
        journal("rechargement echoue : %s" % e)

    unreal.EditorLevelLibrary.save_all_dirty_levels()
    journal("sauvegarde 2 (navmesh genere)")
    journal("TERMINE")

construire()