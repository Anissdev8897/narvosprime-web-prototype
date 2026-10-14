# [recupere de l'historique : ecrit le 2026-09-06T11:45:30Z sous le nom _univers_3b.py, lance dans l'editeur par ue-remote.py]
# Reprise : les 4 sous-niveaux sont montes (les warnings LogLandscape le disent),
# le script precedent est mort sur `persistent_level`, qui n'existe pas sur World.
# Ici : verifier, regler les drapeaux de streaming, sauver.
import unreal, json, io
OUT = r"C:/Users/aniss/AppData/Local/Temp/claude/univers3.json"
res = {"monde": unreal.EditorLevelLibrary.get_editor_world().get_name(), "sous_niveaux": []}
w = unreal.EditorLevelLibrary.get_editor_world()
for ls in w.get_editor_property("streaming_levels"):
    nom = str(ls.get_editor_property("world_asset").get_path_name()) if ls.get_editor_property("world_asset") else "?"
    try:
        ls.set_editor_property("should_be_loaded", True)
        ls.set_editor_property("should_be_visible", True)
    except Exception as e:
        pass
    t = ls.get_editor_property("level_transform").translation
    res["sous_niveaux"].append({"asset": nom, "classe": type(ls).__name__,
                                "decalage": [round(t.x), round(t.y), round(t.z)],
                                "charge": bool(ls.get_editor_property("should_be_loaded")),
                                "visible": bool(ls.get_editor_property("should_be_visible"))})
sub = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
res["sauve"] = bool(sub.save_all_dirty_levels())
io.open(OUT,"w",encoding="utf-8").write(json.dumps(res, indent=1, ensure_ascii=False))
