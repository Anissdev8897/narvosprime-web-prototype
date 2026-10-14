# [recupere de l'historique : ecrit le 2026-09-06T11:45:49Z sous le nom _univers_3c.py, lance dans l'editeur par ue-remote.py]
import unreal, json, io
OUT = r"C:/Users/aniss/AppData/Local/Temp/claude/univers3.json"
w = unreal.EditorLevelLibrary.get_editor_world()
res = {"monde": w.get_name(), "niveaux": [], "streaming": []}
try:
    for lv in unreal.EditorLevelUtils.get_levels(w):
        res["niveaux"].append(str(lv.get_outer().get_name()))
except Exception as e:
    res["niveaux"] = "ERR " + str(e)[:160]
for nom in ["Map_Orbital", "Map_Forge", "Map_Tower", "Map_Alien"]:
    d = {"nom": nom}
    try:
        ls = unreal.GameplayStatics.get_streaming_level(w, nom)
        d["trouve"] = bool(ls)
        if ls:
            ls.set_editor_property("should_be_loaded", True)
            ls.set_editor_property("should_be_visible", True)
            t = ls.get_editor_property("level_transform").translation
            d["classe"] = type(ls).__name__
            d["decalage"] = [round(t.x), round(t.y), round(t.z)]
    except Exception as e:
        d["trouve"] = "ERR " + str(e)[:160]
    res["streaming"].append(d)
res["sauve"] = bool(unreal.get_editor_subsystem(unreal.LevelEditorSubsystem).save_all_dirty_levels())
io.open(OUT,"w",encoding="utf-8").write(json.dumps(res, indent=1, ensure_ascii=False))
