# [recupere de l'historique : ecrit le 2026-09-06T12:05:21Z sous le nom _wp.py, lance dans l'editeur par ue-remote.py]
import unreal, json, io
OUT = r"C:/Users/aniss/AppData/Local/Temp/claude/wp.json"
res = {}
eal = unreal.EditorAssetLibrary
# 1. Nos mondes sont-ils partitionnes ?
for nom in ["Map_Narvos","Map_Orbital","Map_Forge","Map_Tower","Map_Alien"]:
    w = eal.load_asset("/Game/Narvos/Maps/" + nom)
    d = {}
    try:
        wp = w.get_editor_property("world_partition")
        d["world_partition"] = bool(wp)
    except Exception as e:
        d["world_partition"] = "?" + str(e)[:70]
    res[nom] = d
# 2. Que propose l'API Python ?
res["api_wp"] = sorted(n for n in dir(unreal) if "WorldPartition" in n)[:40]
res["api_hlod"] = sorted(n for n in dir(unreal) if "HLOD" in n or "Hierarchical" in n)[:30]
res["api_datalayer"] = sorted(n for n in dir(unreal) if "DataLayer" in n)[:30]
res["api_pcg"] = sorted(n for n in dir(unreal) if n.startswith("PCG"))[:30]
# 3. Nanite : combien de nos meshes lourds le sont ?
reg = unreal.AssetRegistryHelpers.get_asset_registry()
nan_on = nan_off = 0
ech = []
for a in reg.get_assets_by_path("/Game/Narvos/SpaceScenes", recursive=True):
    if str(a.asset_class_path.asset_name) != "StaticMesh": continue
    sm = eal.load_asset(str(a.package_name))
    try:
        on = bool(sm.get_editor_property("nanite_settings").enabled)
    except Exception:
        continue
    if on: nan_on += 1
    else:
        nan_off += 1
        if len(ech) < 8: ech.append(str(a.asset_name))
res["nanite_space"] = {"actifs": nan_on, "inactifs": nan_off, "exemples_inactifs": ech}
io.open(OUT,"w",encoding="utf-8").write(json.dumps(res, indent=1, ensure_ascii=False))
