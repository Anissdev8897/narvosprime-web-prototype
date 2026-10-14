# [recupere de l'historique : ecrit le 2026-09-06T11:16:04Z sous le nom _maps.py, lance dans l'editeur par ue-remote.py]
import unreal
eal = unreal.EditorAssetLibrary
for d in ["/Game/Narvos/MWLandscapeAutoMaterial/Maps", "/Game/SpaceScenes/Maps"]:
    print("==", d)
    for p in sorted(eal.list_assets(d, recursive=True, include_folder=False)):
        ad = eal.find_asset_data(p)
        print("  ", ad.asset_class_path.asset_name, p)
w = unreal.EditorLevelLibrary.get_editor_world()
print("MONDE OUVERT:", w.get_name() if w else None)
