# [recupere de l'historique : ecrit le 2026-09-06T11:32:19Z sous le nom _cover.py, lance dans l'editeur par ue-remote.py]
import unreal, json, io
OUT = r"C:/Users/aniss/AppData/Local/Temp/claude/cover.json"
eal = unreal.EditorAssetLibrary
reg = unreal.AssetRegistryHelpers.get_asset_registry()
res = {"materiaux": []}
for a in reg.get_assets_by_path("/Game/Narvos/MWLandscapeAutoMaterial/Materials", recursive=True):
    cl = str(a.asset_class_path.asset_name)
    if cl not in ("Material", "MaterialInstanceConstant"): continue
    p = str(a.package_name)
    o = eal.load_asset(p)
    par = None
    try:
        pp = o.get_editor_property("parent"); par = pp.get_name() if pp else None
    except Exception: pass
    res["materiaux"].append([cl, p, par])
io.open(OUT,"w",encoding="utf-8").write(json.dumps(res, indent=1, ensure_ascii=False))
