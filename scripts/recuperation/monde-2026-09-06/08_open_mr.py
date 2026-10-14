# [recupere de l'historique : ecrit le 2026-09-06T11:22:26Z sous le nom _open_mr.py, lance dans l'editeur par ue-remote.py]
import unreal, json, io
from collections import Counter
OUT = r"C:/Users/aniss/AppData/Local/Temp/claude/spacescenes.json"
reg = unreal.AssetRegistryHelpers.get_asset_registry()
c = Counter(); n = 0
for d in reg.get_assets_by_path("/Game/SpaceScenes", recursive=True):
    c[str(d.asset_class_path.asset_name)] += 1; n += 1
io.open(OUT,"w",encoding="utf-8").write(json.dumps({"total": n, "classes": c.most_common(30)}, indent=1))
unreal.EditorLoadingAndSavingUtils.load_map("/Game/Narvos/MWLandscapeAutoMaterial/Maps/LandscapeAutoMaterial_MountainRange_Example")
