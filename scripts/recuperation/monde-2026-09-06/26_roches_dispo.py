# [recupere de l'historique : ecrit le 2026-09-06T11:35:23Z sous le nom _roches_dispo.py, lance dans l'editeur par ue-remote.py]
import unreal, json, io, re
OUT = r"C:/Users/aniss/AppData/Local/Temp/claude/roches.json"
reg = unreal.AssetRegistryHelpers.get_asset_registry()
eal = unreal.EditorAssetLibrary
mot = re.compile(r"rock|stone|boulder|cliff|caillou|pierre", re.I)
meshes = []
for a in reg.get_assets_by_path("/Game/Narvos", recursive=True):
    if str(a.asset_class_path.asset_name) != "StaticMesh": continue
    n = str(a.asset_name)
    if not mot.search(n): continue
    p = str(a.package_name)
    sm = eal.load_asset(p)
    mats = []
    try:
        for s in sm.static_materials:
            mi = s.material_interface
            mats.append(mi.get_name() if mi else None)
    except Exception: pass
    meshes.append([n, p, mats])
res = {"meshes": meshes[:80], "n": len(meshes)}
# textures de MTL_MWAM_CoverRocks
mi = eal.load_asset("/Game/Narvos/MWLandscapeAutoMaterial/Materials/Cover/MTL_MWAM_CoverRocks")
try:
    res["coverrocks_textures"] = [[str(x.parameter_info.name), (x.parameter_value.get_name() if x.parameter_value else None)]
                                  for x in mi.get_editor_property("texture_parameter_values")]
except Exception as e:
    res["coverrocks_textures"] = "ERR " + str(e)[:120]
io.open(OUT,"w",encoding="utf-8").write(json.dumps(res, indent=1, ensure_ascii=False))
