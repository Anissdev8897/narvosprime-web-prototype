# [recupere de l'historique : ecrit le 2026-09-06T11:16:16Z sous le nom _maps.py, lance dans l'editeur par ue-remote.py]
import unreal, json, io
OUT = r"C:/Users/aniss/AppData/Local/Temp/claude/maps.json"
eal = unreal.EditorAssetLibrary
res = {}
for d in ["/Game/Narvos/MWLandscapeAutoMaterial/Maps", "/Game/SpaceScenes/Maps"]:
    l = []
    for p in sorted(eal.list_assets(d, recursive=True, include_folder=False)):
        ad = eal.find_asset_data(p)
        l.append([str(ad.asset_class_path.asset_name), str(p)])
    res[d] = l
w = unreal.EditorLevelLibrary.get_editor_world()
res["ouvert"] = w.get_name() if w else None
io.open(OUT, "w", encoding="utf-8").write(json.dumps(res, indent=1, ensure_ascii=False))
