# [recupere de l'historique : ecrit le 2026-09-06T11:20:01Z sous le nom _space_detail.py, lance dans l'editeur par ue-remote.py]
import unreal, json, io, os
from collections import Counter
OUT = r"C:/Users/aniss/AppData/Local/Temp/claude/space_detail.json"
w = unreal.EditorLevelLibrary.get_editor_world()
nom = w.get_name()
acteurs = unreal.EditorLevelLibrary.get_all_level_actors()
liste = []
for a in acteurs:
    cn = type(a).__name__
    lab = a.get_actor_label()
    loc = a.get_actor_location()
    try: o, e = a.get_actor_bounds(False)
    except Exception: o, e = loc, unreal.Vector()
    mesh = ""
    try:
        c = a.static_mesh_component
        m = c.static_mesh
        if m: mesh = m.get_name()
    except Exception:
        pass
    liste.append({"label": lab, "classe": cn, "mesh": mesh,
                  "loc": [round(loc.x,1), round(loc.y,1), round(loc.z,1)],
                  "ext": [round(e.x,1), round(e.y,1), round(e.z,1)],
                  "scale": [round(v,3) for v in (a.get_actor_scale3d().x, a.get_actor_scale3d().y, a.get_actor_scale3d().z)]})
io.open(OUT,"w",encoding="utf-8").write(json.dumps({"monde": nom, "n": len(acteurs),
  "classes": Counter(x["classe"] for x in liste).most_common(30), "acteurs": liste},
  indent=1, ensure_ascii=False))
