# [recupere de l'historique : ecrit le 2026-09-06T11:34:04Z sous le nom _foliage.py, lance dans l'editeur par ue-remote.py]
import unreal, json, io
OUT = r"C:/Users/aniss/AppData/Local/Temp/claude/foliage.json"
res = {"monde": unreal.EditorLevelLibrary.get_editor_world().get_name(), "types": []}
for a in unreal.EditorLevelLibrary.get_all_level_actors():
    if type(a).__name__ != "InstancedFoliageActor": continue
    for comp in a.get_components_by_class(unreal.FoliageInstancedStaticMeshComponent):
        sm = comp.static_mesh
        mats = []
        for i in range(comp.get_num_materials()):
            m = comp.get_material(i)
            mats.append(m.get_name() if m else None)
        smmats = []
        try:
            for s in sm.static_materials:
                mi = s.material_interface
                smmats.append(mi.get_name() if mi else None)
        except Exception: pass
        res["types"].append({"mesh": sm.get_name() if sm else None,
                             "n": comp.get_instance_count(),
                             "mats_comp": mats, "mats_mesh": smmats})
io.open(OUT,"w",encoding="utf-8").write(json.dumps(res, indent=1, ensure_ascii=False))
