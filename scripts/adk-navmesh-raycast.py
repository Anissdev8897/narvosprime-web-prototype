# adk-navmesh-raycast.py — y a-t-il un SOL sous les zones ? (lecture seule)
# Réutilise le pattern de raycast d'adk-poser-foret.py : 6 sondes par zone.
import unreal

X_SPAWN, Y_SPAWN, Z_SPAWN = -8599810.0, 195026.0, 146475.0

ZONES = [
    ("spawn_zone", X_SPAWN, Y_SPAWN),
    ("forge",      X_SPAWN, 2000000.0),
    ("tower",      X_SPAWN, 24000000.0),
    ("alien",      X_SPAWN, 44000000.0),
    ("capitale",   X_SPAWN, 64000000.0),
    ("foret",      X_SPAWN, 84000000.0),
]

def journal(txt):
    try:
        unreal.log("[NARVOS] " + txt)
    except Exception:
        pass

journal("─ raycast de controle : le sol existe-t-il ? ─")
try:
    unreal.EditorLoadingAndSavingUtils.load_map("/Game/Narvos/Maps/Map_Narvos")
except Exception as e:
    journal("load_map echoue : %s" % e)
    unreal.EditorLevelLibrary.load_level("/Game/Narvos/Maps/Map_Narvos")

monde = unreal.EditorLevelLibrary.get_editor_world()
journal("monde : " + str(monde.get_name() if monde else "AUCUN"))

for nom, cx, cy in ZONES:
    touches = 0
    zs = []
    for ddx, ddy in ((0, 0), (10000, 0), (-10000, 0), (0, 10000), (0, -10000), (20000, 20000)):
        debut = unreal.Vector(cx + ddx, cy + ddy, Z_SPAWN + 5000.0)
        fin = unreal.Vector(cx + ddx, cy + ddy, Z_SPAWN - 50000.0)
        try:
            r = unreal.SystemLibrary.line_trace_single(
                monde, debut, fin, unreal.TraceTypeQuery.TRACE_TYPE_QUERY1, False, [],
                unreal.DrawDebugTrace.NONE, True)
        except Exception as e:
            journal("  %s : raycast refuse (%s)" % (nom, e))
            continue
        if r:
            touches += 1
            zs.append(r.to_tuple()[4].z)
    if zs:
        zs.sort()
        journal("%-12s %d/6 sol(s)  Z[%.0f..%.0f] m" % (nom, touches, zs[0]/100, zs[-1]/100))
    else:
        journal("%-12s AUCUN SOL (%d/6)" % (nom, touches))

journal("─ raycast termine ─")