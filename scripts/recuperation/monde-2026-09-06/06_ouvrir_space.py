# [recupere de l'historique : ecrit le 2026-09-06T11:19:47Z sous le nom _ouvrir_space.py, lance dans l'editeur par ue-remote.py]
import unreal
eal = unreal.EditorAssetLibrary
for p in ["/Game/Narvos/nature/StylizedSwampForest/materiaux/M_NarvosFeuillage",
          "/Game/Narvos/nature/retro_nature_pack/models/FBX/bushes/bush3"]:
    try: eal.save_asset(p, only_if_is_dirty=True)
    except Exception as e: unreal.log_warning("save %s : %s" % (p, e))
unreal.EditorLoadingAndSavingUtils.load_map("/Game/SpaceScenes/Maps/Map_Overview")
