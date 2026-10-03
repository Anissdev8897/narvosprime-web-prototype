# adk-navmesh-v7.py — boot FRAIS : le load déclenche l'auto-création de l'agent
# et la génération (flux prouvé en V3, qui suivait la sauvegarde des volumes de
# la V2 dans un run séparé). Ici la map contient déjà le volume (V6) sans agent.
import unreal

def journal(txt):
    try:
        unreal.log("[NARVOS] " + txt)
    except Exception:
        pass

def construire():
    journal("─ V7 : boot frais, generation au load, sauvegarde ─")
    try:
        unreal.EditorLoadingAndSavingUtils.load_map("/Game/Narvos/Maps/Map_Narvos")
        journal("load_map OK")
    except Exception as e:
        journal("load_map echoue (%s)" % e)
        unreal.EditorLevelLibrary.load_level("/Game/Narvos/Maps/Map_Narvos")

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
    journal("apres load : %d volume(s), %d agent(s)" % (n_volumes, n_agents))

    unreal.EditorLevelLibrary.save_all_dirty_levels()
    journal("sauvegarde")
    journal("TERMINE")

construire()