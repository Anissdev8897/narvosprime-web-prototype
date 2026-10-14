# [recupere de l'historique : ecrit le 2026-09-06T11:30:28Z sous le nom _probe_api.py, lance dans l'editeur par ue-remote.py]
import unreal, json, io
OUT = r"C:/Users/aniss/AppData/Local/Temp/claude/api.json"
res = {}
res["EditorLevelUtils"] = [m for m in dir(unreal.EditorLevelUtils) if not m.startswith("_")]
res["LevelStreamingDynamic"] = [m for m in dir(unreal.LevelStreamingDynamic) if not m.startswith("_")][:80]
res["classes_streaming"] = [n for n in dir(unreal) if "LevelStreaming" in n]
res["EditorLoadingAndSavingUtils"] = [m for m in dir(unreal.EditorLoadingAndSavingUtils) if not m.startswith("_")]
res["LevelEditorSubsystem"] = [m for m in dir(unreal.LevelEditorSubsystem) if not m.startswith("_")]
io.open(OUT,"w",encoding="utf-8").write(json.dumps(res, indent=1))
