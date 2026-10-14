# [recupere de l'historique : ecrit le 2026-09-06T11:38:36Z sous le nom _brancher_roche.py, lance dans l'editeur par ue-remote.py]
# MTL_MWAM_CoverRocks a MW_TextureBaseColor et MW_TextureNormal a None : le pack
# les laisse vides, a l'utilisateur d'y mettre ses Megascans. Les textures de
# roche du pack existent (TEX_MWAM_Rock_col/nrm) et servent deja la couche
# rocheuse du terrain -> le caillou et la falaise du sol se ressemblent, ce qui
# est exactement l'effet voulu.
import unreal, json, io
OUT = r"C:/Users/aniss/AppData/Local/Temp/claude/brancher_roche.json"
eal = unreal.EditorAssetLibrary
mel = unreal.MaterialEditingLibrary
mi = eal.load_asset("/Game/Narvos/MWLandscapeAutoMaterial/Materials/Cover/MTL_MWAM_CoverRocks")
col = eal.load_asset("/Game/Narvos/MWLandscapeAutoMaterial/Textures/Ground/TEX_MWAM_Rock_col")
nrm = eal.load_asset("/Game/Narvos/MWLandscapeAutoMaterial/Textures/Ground/TEX_MWAM_Rock_nrm")
res = {"mi": bool(mi), "col": bool(col), "nrm": bool(nrm)}
if mi and col and nrm:
    mel.set_material_instance_texture_parameter_value(mi, "MW_TextureBaseColor", col)
    mel.set_material_instance_texture_parameter_value(mi, "MW_TextureNormal", nrm)
    mel.update_material_instance(mi)
    eal.save_asset(mi.get_path_name().split(".")[0], only_if_is_dirty=False)
    res["apres"] = [[str(x.parameter_info.name), (x.parameter_value.get_name() if x.parameter_value else None)]
                    for x in mi.get_editor_property("texture_parameter_values")]
io.open(OUT,"w",encoding="utf-8").write(json.dumps(res, indent=1, ensure_ascii=False))
