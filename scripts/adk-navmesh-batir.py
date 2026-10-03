# ══════════════════════════════════════════════════════════════════════════════
# adk-navmesh-batir.py — V4 : le volume du SPAWN, et lui seul.
#
#   NARVOS_NAVMESH_APPLIQUER=1 \
#   UnrealEditor-Cmd.exe NanosWorldADK.uproject -run=pythonscript \
#       -script=scripts/adk-navmesh-batir.py -unattended -nosplash
#
# ══ CE QUE LA V3 A MESURÉ ═════════════════════════════════════════════════════
# · `build_navigation` N'EXISTE PAS dans l'API python 5.7 — mais le
#   NavigationSystem génère TOUT SEUL au CHARGEMENT de la map (LogNavigation vu
#   pendant le load). Le flux devient : poser les volumes, sauvegarder,
#   RE-CHARGER la map (la génération part au load), re-sauvegarder (capturée).
# · Les 6 volumes 3×3 km ont déclenché « Navmesh bounds are too large!
#   Limiting requested tiles count (4435968) to (1048576) » : génération
#   tronquée. Un volume de 800×800×150 m autour du SPAWN = la zone où les PNJ
#   existent vraiment (ils naissent devant le joueur). Les autres zones
#   attendront que celle-ci soit PROUVÉE en jeu.
# · Géométrie : le diagnostic par `component.bounds` rendait 0/16635 — la
#   lecture python des bounds de composant ne vaut rien en commandlet. Ici on
#   mesure par les MESH ASSETS (`comp.static_mesh` non nul) : si les meshes
#   sont chargés, la génération a de quoi mordre.
# ══════════════════════════════════════════════════════════════════════════════

import os

import unreal

APPLIQUER = os.environ.get("NARVOS_NAVMESH_APPLIQUER") == "1"
MAPE = "/Game/Narvos/Maps/Map_Narvos"

X_SPAWN, Y_SPAWN, Z_SPAWN = -8599810.0, 195026.0, 146475.0
DEMIE = 40000.0      # 400 m de demi-côté -> 800×800 m
DEMI_Z = 7500.0      # 75 m de demi-hauteur -> 150 m
COTE_BRUSH = 200.0

def journal(txt):
    try:
        unreal.log("[NARVOS] " + txt)
    except Exception:
        pass

def construire():
    journal("─ V4 : volume du spawn uniquement ─")
    try:
        unreal.EditorLoadingAndSavingUtils.load_map(MAPE)
        journal("load_map OK")
    except Exception as e:
        journal("load_map a echoue (%s), repli load_level" % e)
        unreal.EditorLevelLibrary.load_level(MAPE)

    acteurs = unreal.EditorLevelLibrary.get_all_level_actors()
    journal("acteurs : %d" % len(acteurs))

    # ── Diagnostic géométrie par MESH ASSET ───────────────────────────────────
    n_comp, n_mesh = 0, 0
    for a in acteurs:
        try:
            comps = a.get_components_by_class(unreal.StaticMeshComponent)
        except Exception:
            continue
        for comp in comps:
            n_comp += 1
            try:
                if comp.static_mesh is not None:
                    n_mesh += 1
            except Exception:
                pass
    journal("composants StaticMesh : %d | avec mesh charge : %d" % (n_comp, n_mesh))

    # ── Agent Recast : configurer la taille de cellule ────────────────────────
    n_agent = 0
    for a in acteurs:
        try:
            if "RecastNavMesh" in a.get_class().get_name():
                n_agent += 1
                if APPLIQUER:
                    for prop, val in (("cell_size", 25.0), ("agent_radius", 35.0),
                                      ("agent_height", 144.0), ("agent_max_step_height", 45.0)):
                        try:
                            a.set_editor_property(prop, val)
                        except Exception as e:
                            journal("reglage %s refuse : %s" % (prop, e))
        except Exception:
            pass
    journal("agents RecastNavMesh : %d" % n_agent)

    # ── Nettoyage des volumes géants + pose du volume resserré ────────────────
    n_detruits = 0
    for a in acteurs:
        try:
            if a.get_class().get_name() == "NavMeshBoundsVolume":
                label = a.get_actor_label()
                if label.startswith("NavMeshBounds_"):
                    if APPLIQUER:
                        a.destroy_actor()
                    n_detruits += 1
        except Exception:
            pass
    journal("anciens volumes : %d" % n_detruits)

    cx, cy, cz = X_SPAWN, Y_SPAWN, Z_SPAWN
    large, prof, haut = 2 * DEMIE, 2 * DEMIE, 2 * DEMI_Z
    echelle = (large / COTE_BRUSH, prof / COTE_BRUSH, haut / COTE_BRUSH)
    journal("volume spawn : centre (%.0f, %.0f, %.0f) m, taille %.0f x %.0f x %.0f m"
            % (cx/100, cy/100, cz/100, large/100, prof/100, haut/100))

    if not APPLIQUER:
        journal("MESURE SEULE — relancer avec NARVOS_NAVMESH_APPLIQUER=1.")
        return

    vol = unreal.EditorLevelLibrary.spawn_actor_from_class(
        unreal.NavMeshBoundsVolume.static_class(),
        unreal.Vector(cx, cy, cz), unreal.Rotator(0, 0, 0))
    if vol is not None:
        vol.set_actor_scale3d(unreal.Vector(*echelle))
        vol.set_actor_label("NavMeshBounds_spawn_zone")
        journal("volume pose")

    unreal.EditorLevelLibrary.save_all_dirty_levels()
    journal("sauvegarde 1 (volumes)")

    # ── RE-CHARGEMENT : la génération part au load. ───────────────────────────
    try:
        unreal.EditorLoadingAndSavingUtils.load_map(MAPE)
        journal("rechargement OK (la generation demarre au load)")
    except Exception as e:
        journal("rechargement echoue : %s" % e)

    try:
        unreal.EditorLevelLibrary.save_all_dirty_levels()
        journal("sauvegarde 2 (navmesh genere)")
    except Exception as e:
        journal("sauvegarde 2 echoue : %s" % e)
    journal("TERMINE")

construire()