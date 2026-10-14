# [recupere de l'historique : ecrit le 2026-09-06T11:31:25Z sous le nom _mat_desert.py, lance dans l'editeur par ue-remote.py]
import unreal, json, io
OUT = r"C:/Users/aniss/AppData/Local/Temp/claude/mat_desert.json"
eal = unreal.EditorAssetLibrary
res = {}
for nom in ["MTL_MWAM_Landscape_DesertExample", "MTL_MWAM_Landscape_MountainRangeExample"]:
    p = "/Game/Narvos/MWLandscapeAutoMaterial/Materials/Landscape/" + nom
    mi = eal.load_asset(p)
    d = {"classe": type(mi).__name__}
    try:
        par = mi.get_editor_property("parent")
        d["parent"] = par.get_path_name() if par else None
        if par:
            d["parent_usage"] = {k: bool(par.get_editor_property(k)) for k in
                ["used_with_static_lighting","used_with_skeletal_mesh","used_with_instanced_static_meshes","used_with_nanite"]}
            d["parent_domaine"] = str(par.get_editor_property("material_domain"))
    except Exception as e:
        d["parent"] = "ERR " + str(e)[:120]
    # textures nulles ?
    try:
        nulles = [str(o.parameter_info.name) for o in mi.get_editor_property("texture_parameter_values")
                  if o.parameter_value is None]
        d["textures_nulles"] = nulles
        d["n_textures"] = len(mi.get_editor_property("texture_parameter_values"))
    except Exception as e:
        d["textures_nulles"] = "ERR " + str(e)[:120]
    res[nom] = d
# materiaux de roche non-landscape dans le pack
reg = unreal.AssetRegistryHelpers.get_asset_registry()
roches = []
for a in reg.get_assets_by_path("/Game/Narvos/MWLandscapeAutoMaterial", recursive=True):
    cl = str(a.asset_class_path.asset_name); n = str(a.asset_name)
    if cl in ("Material","MaterialInstanceConstant") and ("Rock" in n or "Cliff" in n or "Mountain" in n or "Basic" in n):
        roches.append([cl, str(a.package_name)])
res["candidats_roche"] = roches
io.open(OUT,"w",encoding="utf-8").write(json.dumps(res, indent=1, ensure_ascii=False))
