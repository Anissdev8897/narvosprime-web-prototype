# [recupere de l'historique : ecrit le 2026-09-06T11:19:06Z sous le nom _mesurer.py, lance dans l'editeur par ue-remote.py]
# Mesure le monde OUVERT et ajoute au JSON. load_level est differe : un appel par niveau.
import unreal, json, io, os
from collections import Counter
OUT = r"C:/Users/aniss/AppData/Local/Temp/claude/niveaux.json"
res = {}
if os.path.exists(OUT):
    try: res = json.loads(io.open(OUT, encoding="utf-8").read())
    except Exception: res = {}
w = unreal.EditorLevelLibrary.get_editor_world()
nom = w.get_name()
acteurs = unreal.EditorLevelLibrary.get_all_level_actors()
par_classe = Counter(type(a).__name__ for a in acteurs)
mn = [1e18]*3; mx = [-1e18]*3
land = []
for a in acteurs:
    cn = type(a).__name__
    try:
        o, e = a.get_actor_bounds(False)
    except Exception:
        continue
    if e.x <= 0 and e.y <= 0 and e.z <= 0: continue
    # une SkyLight/coque de ciel fausse les bornes : on ecarte les extents delirants
    if max(e.x, e.y, e.z) > 5e6: continue
    for i, (c, ex) in enumerate(zip([o.x, o.y, o.z], [e.x, e.y, e.z])):
        mn[i] = min(mn[i], c - ex); mx[i] = max(mx[i], c + ex)
    if "Landscape" in cn:
        land.append({"nom": a.get_actor_label(), "classe": cn,
                     "origine": [round(o.x,1), round(o.y,1), round(o.z,1)],
                     "extent": [round(e.x,1), round(e.y,1), round(e.z,1)]})
res[nom] = {
  "acteurs": len(acteurs),
  "par_classe": par_classe.most_common(20),
  "bornes_min": [round(v,1) for v in mn],
  "bornes_max": [round(v,1) for v in mx],
  "taille_m": [round((mx[i]-mn[i])/100.0, 1) for i in range(3)],
  "landscapes": land,
}
io.open(OUT,"w",encoding="utf-8").write(json.dumps(res,indent=1,ensure_ascii=False))
