# [recupere de l'historique : ecrit le 2026-09-06T11:40:11Z sous le nom _univers_1.py, lance dans l'editeur par ue-remote.py]
# Etape 1 : creer le niveau PERSISTANT et l'ouvrir.
# Il faut l'ouvrir AVANT de renommer les quatre autres : renommer un World
# actuellement charge echoue en silence (mesure aujourd'hui sur Map_Overview).
import unreal, json, io
OUT = r"C:/Users/aniss/AppData/Local/Temp/claude/univers1.json"
res = {"avant": unreal.EditorLevelLibrary.get_editor_world().get_name()}
sub = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
try:
    res["cree"] = bool(sub.new_level("/Game/Narvos/Maps/Map_Narvos"))
except Exception as e:
    res["cree"] = "ERR " + str(e)[:200]
io.open(OUT,"w",encoding="utf-8").write(json.dumps(res, indent=1))
