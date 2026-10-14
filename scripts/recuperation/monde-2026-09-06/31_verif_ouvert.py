# [recupere de l'historique : ecrit le 2026-09-06T11:40:11Z sous le nom _verif_ouvert.py, lance dans l'editeur par ue-remote.py]
import unreal, json, io
w = unreal.EditorLevelLibrary.get_editor_world()
io.open(r"C:/Users/aniss/AppData/Local/Temp/claude/ouvert.json","w",encoding="utf-8").write(
    json.dumps({"monde": w.get_name(), "chemin": w.get_path_name()}, indent=1))
