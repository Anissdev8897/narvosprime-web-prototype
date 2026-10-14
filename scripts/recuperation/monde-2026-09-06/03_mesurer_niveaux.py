# [recupere de l'historique : ecrit le 2026-09-06T11:17:40Z sous le nom _mesurer_niveaux.py, lance dans l'editeur par ue-remote.py]
# Mesure les 4 niveaux candidats : partition, nombre d'acteurs, bornes, landscape.
import unreal, json, io
OUT = r"C:/Users/aniss/AppData/Local/Temp/claude/niveaux.json"
NIV = [
 "/Game/SpaceScenes/Maps/Map_Overview",
 "/Game/Narvos/MWLandscapeAutoMaterial/Maps/LandscapeAutoMaterial_MountainRange_Example",
 "/Game/Narvos/MWLandscapeAutoMaterial/Maps/LandscapeAutoMaterial_Desert_Example",
 "/Game/Narvos/MWLandscapeAutoMaterial/Maps/LandscapeAutoMaterial_Island_Example",
]
eal = unreal.EditorAssetLibrary
res = {}
for p in NIV:
    w = eal.load_asset(p)
    d = {"classe": type(w).__name__}
    try:
        d["partition"] = bool(w.get_editor_property("is_partitioned_world"))
    except Exception as e:
        d["partition"] = "?" + str(e)[:60]
    res[p] = d
io.open(OUT,"w",encoding="utf-8").write(json.dumps(res,indent=1,ensure_ascii=False))
