# [recupere de l'historique : ecrit le 2026-09-06T11:47:30Z sous le nom _planetes.py, lance dans l'editeur par ue-remote.py]
import unreal, json, io
OUT = r"C:/Users/aniss/AppData/Local/Temp/claude/planetes.json"
res = []
for a in unreal.EditorLevelLibrary.get_all_level_actors():
    if type(a).__name__ != "StaticMeshActor": continue
    try:
        c = a.static_mesh_component; sm = c.static_mesh
    except Exception: continue
    if not sm or "Planet" not in sm.get_name(): continue
    mats = []
    for i in range(c.get_num_materials()):
        m = c.get_material(i)
        mats.append(m.get_name() if m else None)
    l = a.get_actor_location(); s = a.get_actor_scale3d()
    o, e = a.get_actor_bounds(False)
    res.append({"label": a.get_actor_label(), "mesh": sm.get_name(), "mats": mats,
                "loc": [round(l.x), round(l.y), round(l.z)], "sc": round(s.x, 3),
                "rayon": round(max(e.x, e.y, e.z))})
io.open(OUT,"w",encoding="utf-8").write(json.dumps(res, indent=1, ensure_ascii=False))
