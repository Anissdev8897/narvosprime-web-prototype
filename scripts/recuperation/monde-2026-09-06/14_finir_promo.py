# [recupere de l'historique : ecrit le 2026-09-06T11:28:36Z sous le nom _finir_promo.py, lance dans l'editeur par ue-remote.py]
import unreal, json, io
OUT = r"C:/Users/aniss/AppData/Local/Temp/claude/promo2.json"
eal = unreal.EditorAssetLibrary
reg = unreal.AssetRegistryHelpers.get_asset_registry()
res = {}
res["monde_ouvert"] = unreal.EditorLevelLibrary.get_editor_world().get_name()
unreal.SystemLibrary.collect_garbage()
src, dst = "/Game/SpaceScenes/Maps/Map_Overview", "/Game/Narvos/SpaceScenes/Maps/Map_Overview"
try:
    res["map_overview"] = bool(eal.rename_asset(src, dst))
except Exception as e:
    res["map_overview"] = "ERR " + str(e)[:200]
res["cible_existe"] = eal.does_asset_exist(dst)
# Ce qui reste sous l'ancien chemin : redirecteurs ou vrais assets ?
reg.search_all_assets(True)
restants = []
for d in reg.get_assets_by_path("/Game/SpaceScenes", recursive=True):
    restants.append([str(d.asset_class_path.asset_name), str(d.package_name)])
res["restants"] = restants[:40]
res["n_restants"] = len(restants)
io.open(OUT,"w",encoding="utf-8").write(json.dumps(res, indent=1, ensure_ascii=False))
