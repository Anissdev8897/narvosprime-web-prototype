# [recupere de l'historique : ecrit le 2026-09-06T13:19:57Z sous le nom _apres_repar.py, lance dans l'editeur par ue-remote.py]
import unreal, json, io
OUT = r"C:/Users/aniss/AppData/Local/Temp/claude/apres_repar.json"
w = unreal.EditorLevelLibrary.get_editor_world()
res = {"foliage": [], "forge_map": {}, "sols": {}}

mn = [1e18]*3; mx = [-1e18]*3
n_forge = 0
for a in unreal.EditorLevelLibrary.get_all_level_actors():
    cn = type(a).__name__
    if cn == "InstancedFoliageActor":
        niveau = "?"
        try: niveau = a.get_outer().get_outer().get_name()
        except Exception: pass
        o, e = a.get_actor_bounds(False)
        n = 0
        for c in a.get_components_by_class(unreal.FoliageInstancedStaticMeshComponent):
            n += c.get_instance_count()
        res["foliage"].append({"niveau": niveau, "instances": n,
            "centre": [round(o.x), round(o.y), round(o.z)],
            "demi": [round(e.x), round(e.y), round(e.z)]})
    try:
        if str(a.get_folder_path()) == "forge_map":
            n_forge += 1
            o, e = a.get_actor_bounds(False)
            if max(e.x, e.y, e.z) > 5e6: continue
            for i, (c, ex) in enumerate(zip([o.x,o.y,o.z], [e.x,e.y,e.z])):
                mn[i] = min(mn[i], c-ex); mx[i] = max(mx[i], c+ex)
    except Exception:
        pass
if n_forge:
    res["forge_map"] = {"acteurs": n_forge,
        "min": [round(v) for v in mn], "max": [round(v) for v in mx],
        "centre": [round((mn[i]+mx[i])/2) for i in range(3)],
        "taille_m": [round((mx[i]-mn[i])/100.0, 1) for i in range(3)]}

# Sol au centre de chaque monde, apres reparation
SONDES = {"forge": None, "tower": (-8000000.0, 2000000.0), "alien": (-8000000.0, 4000000.0)}
if n_forge:
    SONDES["forge"] = (float(res["forge_map"]["centre"][0]), float(res["forge_map"]["centre"][1]))
for monde, xy in SONDES.items():
    if not xy: continue
    x, y = xy
    hit = unreal.SystemLibrary.line_trace_single(
        w, unreal.Vector(x, y, 400000.0), unreal.Vector(x, y, -400000.0),
        unreal.TraceTypeQuery.TRACE_TYPE_QUERY1, True, [],
        unreal.DrawDebugTrace.NONE, True, unreal.LinearColor.RED,
        unreal.LinearColor.GREEN, 0.0)
    if hit:
        t = hit.to_tuple()
        res["sols"][monde] = {"xy": [round(x), round(y)], "z": round(t[4].z, 1),
                              "acteur": str(t[9].get_actor_label()) if t[9] else None}
    else:
        res["sols"][monde] = {"xy": [round(x), round(y)], "z": None}
io.open(OUT,"w",encoding="utf-8").write(json.dumps(res, indent=1, ensure_ascii=False))
