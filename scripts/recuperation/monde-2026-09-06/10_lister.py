# [recupere de l'historique : ecrit le 2026-09-06T11:23:00Z sous le nom _lister.py, lance dans l'editeur par ue-remote.py]
import unreal, json, io, os
from collections import Counter
OUT = r"C:/Users/aniss/AppData/Local/Temp/claude/contenu.json"
res = {}
if os.path.exists(OUT):
    try: res = json.loads(io.open(OUT, encoding="utf-8").read())
    except Exception: res = {}
w = unreal.EditorLevelLibrary.get_editor_world(); nom = w.get_name()
par_mesh = Counter(); loin = []
for a in unreal.EditorLevelLibrary.get_all_level_actors():
    if type(a).__name__ != "StaticMeshActor": continue
    m = ""
    try:
        sm = a.static_mesh_component.static_mesh
        if sm: m = sm.get_name()
    except Exception: pass
    par_mesh[m] += 1
    l = a.get_actor_location()
    if max(abs(l.x), abs(l.y)) > 110000:
        loin.append([a.get_actor_label(), m, round(l.x), round(l.y), round(l.z)])
res[nom] = {"par_mesh": par_mesh.most_common(40), "hors_landscape": loin[:40], "n_hors": len(loin)}
io.open(OUT,"w",encoding="utf-8").write(json.dumps(res, indent=1, ensure_ascii=False))
