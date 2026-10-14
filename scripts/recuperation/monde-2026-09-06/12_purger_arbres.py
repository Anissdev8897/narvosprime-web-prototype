# [recupere de l'historique : ecrit le 2026-09-06T11:23:30Z sous le nom _purger_arbres.py, lance dans l'editeur par ue-remote.py]
# Retire la vegetation que J'AI posee sur MountainRange. Garde les 8 montagnes de
# fond et le color checker : ils viennent du pack, pas de moi.
import unreal, json, io
OUT = r"C:/Users/aniss/AppData/Local/Temp/claude/purge.json"
GARDER = ("SM_MWAM_", "SM_MW_")
w = unreal.EditorLevelLibrary.get_editor_world()
nom = w.get_name()
res = {"monde": nom}
if nom != "LandscapeAutoMaterial_MountainRange_Example":
    res["arret"] = "mauvais monde ouvert"
else:
    a_tuer = []
    for a in unreal.EditorLevelLibrary.get_all_level_actors():
        if type(a).__name__ != "StaticMeshActor": continue
        m = ""
        try:
            sm = a.static_mesh_component.static_mesh
            if sm: m = sm.get_name()
        except Exception: pass
        if not m or m.startswith(GARDER): continue
        a_tuer.append(a)
    n = 0
    for a in a_tuer:
        try:
            unreal.EditorLevelLibrary.destroy_actor(a); n += 1
        except Exception: pass
    res["detruits"] = n
    res["restants"] = sum(1 for a in unreal.EditorLevelLibrary.get_all_level_actors()
                          if type(a).__name__ == "StaticMeshActor")
    unreal.EditorLevelLibrary.save_current_level()
io.open(OUT,"w",encoding="utf-8").write(json.dumps(res, indent=1))
