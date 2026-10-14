# [recupere de l'historique : ecrit le 2026-09-06T11:50:09Z sous le nom _pieces_espace.py, lance dans l'editeur par ue-remote.py]
import unreal, json, io
OUT = r"C:/Users/aniss/AppData/Local/Temp/claude/pieces_espace.json"
reg = unreal.AssetRegistryHelpers.get_asset_registry()
res = {"meshes": [], "particules": [], "blueprints": []}
for a in reg.get_assets_by_path("/Game/Narvos/SpaceScenes", recursive=True):
    cl = str(a.asset_class_path.asset_name); n = str(a.asset_name); p = str(a.package_name)
    if cl == "StaticMesh": res["meshes"].append([n, p])
    elif cl in ("ParticleSystem", "NiagaraSystem"): res["particules"].append([n, p])
    elif cl == "Blueprint": res["blueprints"].append([n, p])
io.open(OUT,"w",encoding="utf-8").write(json.dumps(res, indent=1, ensure_ascii=False))
