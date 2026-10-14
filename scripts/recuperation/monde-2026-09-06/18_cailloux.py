# [recupere de l'historique : ecrit le 2026-09-06T11:30:52Z sous le nom _cailloux.py, lance dans l'editeur par ue-remote.py]
import unreal, json, io
OUT = r"C:/Users/aniss/AppData/Local/Temp/claude/cailloux.json"
res = {"monde": unreal.EditorLevelLibrary.get_editor_world().get_name(), "acteurs": []}
for a in unreal.EditorLevelLibrary.get_all_level_actors():
    if type(a).__name__ != "StaticMeshActor": continue
    c = a.static_mesh_component
    sm = c.static_mesh
    if not sm: continue
    mats = []
    for i in range(c.get_num_materials()):
        m = c.get_material(i)
        mats.append(m.get_path_name() if m else None)
    # materiaux par defaut du mesh lui-meme
    smmats = []
    try:
        for s in sm.static_materials:
            mi = s.material_interface
            smmats.append([str(s.material_slot_name), mi.get_path_name() if mi else None])
    except Exception as e:
        smmats = ["ERR " + str(e)[:80]]
    res["acteurs"].append({"label": a.get_actor_label(), "mesh": sm.get_name(),
                           "mats_composant": mats, "mats_mesh": smmats,
                           "nanite": bool(sm.get_editor_property("nanite_settings").enabled) if hasattr(sm, "get_editor_property") else None})
io.open(OUT,"w",encoding="utf-8").write(json.dumps(res, indent=1, ensure_ascii=False))
