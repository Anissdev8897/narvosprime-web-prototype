# [recupere de l'historique : ecrit le 2026-09-06T11:38:17Z sous le nom _tex_landscape.py, lance dans l'editeur par ue-remote.py]
import unreal, json, io
OUT = r"C:/Users/aniss/AppData/Local/Temp/claude/tex_landscape.json"
eal = unreal.EditorAssetLibrary
res = {}
for nom in ["MTL_MWAM_Landscape_DesertExample","MTL_MWAM_Landscape_MountainRangeExample","MTL_MWAM_Landscape_IslandExample"]:
    mi = eal.load_asset("/Game/Narvos/MWLandscapeAutoMaterial/Materials/Landscape/" + nom)
    res[nom] = [[str(x.parameter_info.name), (x.parameter_value.get_path_name().split('.')[0] if x.parameter_value else None)]
                for x in mi.get_editor_property("texture_parameter_values")]
# parametres attendus par CoverFoliage_MASTER
m = eal.load_asset("/Game/Narvos/MWLandscapeAutoMaterial/Materials/MASTER/MTL_MWAM_CoverFoliage_MASTER")
try:
    noms, ids = unreal.MaterialEditingLibrary.get_texture_parameter_names(m), None
    res["cover_master_params"] = [str(n) for n in noms]
except Exception as e:
    res["cover_master_params"] = "ERR " + str(e)[:120]
io.open(OUT,"w",encoding="utf-8").write(json.dumps(res, indent=1, ensure_ascii=False))
