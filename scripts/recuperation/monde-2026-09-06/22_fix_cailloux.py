# [recupere de l'historique : ecrit le 2026-09-06T11:33:17Z sous le nom _fix_cailloux.py, lance dans l'editeur par ue-remote.py]
# Les montagnes de fond portent MTL_MWAM_Landscape_* : un materiau de LANDSCAPE.
# Il lit les weightmaps du terrain, qu'un StaticMesh n'a pas -> il retombe sur une
# couche unique, plate et sans grain. MTL_MWAM_CoverRocks a pour parent
# MTL_MWAM_CoverFoliage_MASTER, qui est un materiau de MESH.
import unreal, json, io
OUT = r"C:/Users/aniss/AppData/Local/Temp/claude/fix_cailloux.json"
ROCHE = "/Game/Narvos/MWLandscapeAutoMaterial/Materials/Cover/MTL_MWAM_CoverRocks"
mat = unreal.EditorAssetLibrary.load_asset(ROCHE)
res = {"monde": unreal.EditorLevelLibrary.get_editor_world().get_name(), "materiau": bool(mat), "faits": []}
if mat:
    for a in unreal.EditorLevelLibrary.get_all_level_actors():
        if type(a).__name__ != "StaticMeshActor": continue
        if not a.get_actor_label().startswith("SM_MWAM_Mountain"): continue
        c = a.static_mesh_component
        for i in range(c.get_num_materials()):
            c.set_material(i, mat)
        res["faits"].append(a.get_actor_label())
    unreal.EditorLevelLibrary.save_current_level()
io.open(OUT,"w",encoding="utf-8").write(json.dumps(res, indent=1))
