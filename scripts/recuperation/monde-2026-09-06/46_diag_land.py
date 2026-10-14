# [recupere de l'historique : ecrit le 2026-09-06T13:18:09Z sous le nom _diag_land.py, lance dans l'editeur par ue-remote.py]
# Ou sont les trois Landscape, et ou DEVRAIENT-ils etre ?
# On mesure deux choses distinctes : la transform du SOUS-NIVEAU, et la position
# de l'acteur. Un monde peut deriver par l'une ou par l'autre.
import unreal, json, io
OUT = r"C:/Users/aniss/AppData/Local/Temp/claude/diag_land.json"
ATTENDU = {"Map_Orbital": [0,0,0], "Map_Forge": [-8000000,0,0],
           "Map_Tower": [-8000000,2000000,0], "Map_Alien": [-8000000,4000000,0]}
w = unreal.EditorLevelLibrary.get_editor_world()
res = {"monde": w.get_name(), "sous_niveaux": [], "landscapes": [], "dossiers": {}}
for nom, att in ATTENDU.items():
    d = {"nom": nom, "attendu": att}
    try:
        ls = unreal.GameplayStatics.get_streaming_level(w, nom)
        if ls:
            t = ls.get_editor_property("level_transform")
            tr, ro, sc = t.translation, t.rotation.rotator(), t.scale3d
            d["transform"] = [round(tr.x), round(tr.y), round(tr.z)]
            d["rotation"] = [round(ro.pitch,2), round(ro.yaw,2), round(ro.roll,2)]
            d["echelle"] = [round(sc.x,3), round(sc.y,3), round(sc.z,3)]
            d["derive"] = [round(tr.x - att[0]), round(tr.y - att[1]), round(tr.z - att[2])]
        else:
            d["transform"] = None
    except Exception as e:
        d["transform"] = "ERR " + str(e)[:120]
    res["sous_niveaux"].append(d)

from collections import Counter
dossiers = Counter()
for a in unreal.EditorLevelLibrary.get_all_level_actors():
    try:
        dossiers[str(a.get_folder_path())] += 1
    except Exception:
        pass
    if "Landscape" not in type(a).__name__: continue
    l = a.get_actor_location(); s = a.get_actor_scale3d()
    o, e = a.get_actor_bounds(False)
    niveau = "?"
    try: niveau = a.get_outer().get_outer().get_name()
    except Exception: pass
    res["landscapes"].append({
        "label": a.get_actor_label(), "classe": type(a).__name__, "niveau": niveau,
        "acteur": [round(l.x), round(l.y), round(l.z)],
        "echelle": [round(s.x,2), round(s.y,2), round(s.z,2)],
        "bornes_centre": [round(o.x), round(o.y), round(o.z)],
        "bornes_demi": [round(e.x), round(e.y), round(e.z)]})
res["dossiers"] = dossiers.most_common(20)
res["total_acteurs"] = sum(dossiers.values())
io.open(OUT,"w",encoding="utf-8").write(json.dumps(res, indent=1, ensure_ascii=False))
