# [recupere de l'historique : ecrit le 2026-09-06T11:19:37Z sous le nom _dirty.py, lance dans l'editeur par ue-remote.py]
import unreal, json, io
OUT = r"C:/Users/aniss/AppData/Local/Temp/claude/dirty.json"
sales = [p.get_name() for p in unreal.EditorLoadingAndSavingUtils.get_dirty_content_packages()]
sales += [p.get_name() for p in unreal.EditorLoadingAndSavingUtils.get_dirty_map_packages()]
io.open(OUT,"w",encoding="utf-8").write(json.dumps({"sales": sales}, indent=1))
