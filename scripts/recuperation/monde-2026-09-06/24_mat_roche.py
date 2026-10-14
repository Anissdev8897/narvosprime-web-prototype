# [recupere de l'historique : ecrit le 2026-09-06T11:34:22Z sous le nom _mat_roche.py, lance dans l'editeur par ue-remote.py]
import unreal, json, io
OUT = r"C:/Users/aniss/AppData/Local/Temp/claude/mat_roche.json"
reg = unreal.AssetRegistryHelpers.get_asset_registry()
eal = unreal.EditorAssetLibrary
res = {}
for nom in ["M_RockPile_MeshEmit_01", "Rock1Brick_MatInst"]:
    trouve = [str(a.package_name) for a in reg.get_assets_by_path("/Game", recursive=True)
              if str(a.asset_name) == nom]
    res[nom] = {"chemins": trouve}
    if not trouve: continue
    o = eal.load_asset(trouve[0])
    d = {"classe": type(o).__name__}
    try:
        par = o.get_editor_property("parent"); d["parent"] = par.get_path_name() if par else None
    except Exception: d["parent"] = None
    try:
        tp = o.get_editor_property("texture_parameter_values")
        d["textures"] = [[str(x.parameter_info.name), (x.parameter_value.get_name() if x.parameter_value else None)] for x in tp]
    except Exception as e: d["textures"] = "n/a"
    # pour un Material pur : ses expressions Texture
    try:
        exprs = unreal.MaterialEditingLibrary.get_num_material_expressions(o)
        d["expressions"] = exprs
    except Exception: pass
    res[nom].update(d)
# quels meshes portent ces materiaux
for nom in ["SM_Rock_01", "Rock_SM"]:
    res[nom] = [str(a.package_name) for a in reg.get_assets_by_path("/Game", recursive=True)
                if str(a.asset_name) == nom]
io.open(OUT,"w",encoding="utf-8").write(json.dumps(res, indent=1, ensure_ascii=False))
