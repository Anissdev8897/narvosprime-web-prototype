# [recupere de l'historique : ecrit le 2026-09-06T11:32:51Z sous le nom _bornes_m3.py, lance dans l'editeur par ue-remote.py]
import unreal, json, io
OUT = r"C:/Users/aniss/AppData/Local/Temp/claude/m3.json"
res = []
for a in unreal.EditorLevelLibrary.get_all_level_actors():
    if type(a).__name__ != "StaticMeshActor": continue
    if not a.get_actor_label().startswith("SM_MWAM_Mountain"): continue
    o, e = a.get_actor_bounds(False)
    s = a.get_actor_scale3d()
    res.append({"label": a.get_actor_label(), "o": [round(o.x), round(o.y), round(o.z)],
                "e": [round(e.x), round(e.y), round(e.z)], "sc": [round(s.x,2), round(s.y,2), round(s.z,2)]})
io.open(OUT,"w",encoding="utf-8").write(json.dumps(res, indent=1))
