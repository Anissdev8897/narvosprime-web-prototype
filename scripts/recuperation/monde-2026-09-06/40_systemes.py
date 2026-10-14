# [recupere de l'historique : ecrit le 2026-09-06T11:49:48Z sous le nom _systemes.py, lance dans l'editeur par ue-remote.py]
# Trois systemes solaires, un par monde. Le hub (vaisseau-mere, stations, epaves)
# reste a l'origine : c'est le carrefour, pas un systeme.
#
# Chaque systeme = une etoile + la planete de destination + deux lunes, a 6 km
# de l'origine, 120 degres d'ecart. Distance entre deux systemes : 10,4 km.
# Rien n'est cree : on reemploie les 25 spheres deja presentes dans la map.
import unreal, json, io, math
OUT = r"C:/Users/aniss/AppData/Local/Temp/claude/systemes.json"

R_SYSTEME  = 600000.0     # 6 km entre le hub et le centre d'un systeme
D_PLANETE  = 250000.0     # 2,5 km entre l'etoile et sa planete
D_LUNE     =  70000.0     # 700 m entre la planete et ses lunes
E_ETOILE   = 2.0          # rayon 923 m
E_PLANETE  = 0.9          # rayon 415 m
E_LUNE     = 0.12         # rayon 55 m

SYSTEMES = [
    {"monde": "forge", "nom": "Verdant", "angle":  90.0, "z":  20000.0,
     "etoile": "SM_PlanetSphere27", "planete": "SM_PlanetSphere",
     "lunes": ["SM_PlanetSphere3", "SM_PlanetSphere4"]},
    {"monde": "tower", "nom": "Ocre",    "angle": 210.0, "z": -30000.0,
     "etoile": "SM_PlanetSphere28", "planete": "SM_PlanetSphere2",
     "lunes": ["SM_PlanetSphere5", "SM_PlanetSphere6"]},
    {"monde": "alien", "nom": "Azur",    "angle": 330.0, "z":  60000.0,
     "etoile": "SM_PlanetSphere29", "planete": "SM_PlanetSphere11",
     "lunes": ["SM_PlanetSphere9", "SM_PlanetSphere10"]},
]
SOLEIL = "/Game/Narvos/SpaceScenes/Scenery/Planets/Materials/M_Sun_Far_M"

w = unreal.EditorLevelLibrary.get_editor_world()
res = {"monde": w.get_name(), "systemes": []}
acteurs = {a.get_actor_label(): a for a in unreal.EditorLevelLibrary.get_all_level_actors()}
mat_soleil = unreal.EditorAssetLibrary.load_asset(SOLEIL)
if not mat_soleil:
    # le chemin exact du materiau de soleil n'est pas garanti : on le retrouve
    # sur l'acteur qui le porte deja plutot que de le deviner.
    ph = acteurs.get("Planet_Half")
    if ph: mat_soleil = ph.static_mesh_component.get_material(0)
res["materiau_soleil"] = mat_soleil.get_path_name() if mat_soleil else None

def poser(a, x, y, z, echelle):
    a.set_actor_location(unreal.Vector(x, y, z), False, False)
    a.set_actor_scale3d(unreal.Vector(echelle, echelle, echelle))
    o, e = a.get_actor_bounds(False)
    return {"label": a.get_actor_label(), "loc": [round(x), round(y), round(z)],
            "rayon": round(max(e.x, e.y, e.z))}

for s in SYSTEMES:
    d = {"monde": s["monde"], "nom": s["nom"]}
    rad = math.radians(s["angle"])
    cx, cy, cz = R_SYSTEME * math.cos(rad), R_SYSTEME * math.sin(rad), s["z"]
    d["centre"] = [round(cx), round(cy), round(cz)]

    e = acteurs.get(s["etoile"])
    if e:
        d["etoile"] = poser(e, cx, cy, cz, E_ETOILE)
        if mat_soleil:
            for i in range(e.static_mesh_component.get_num_materials()):
                e.static_mesh_component.set_material(i, mat_soleil)

    # La planete est posee VERS L'EXTERIEUR du systeme : vue depuis le hub, elle
    # ne se cache pas derriere son etoile.
    px, py, pz = cx + D_PLANETE * math.cos(rad), cy + D_PLANETE * math.sin(rad), cz
    p = acteurs.get(s["planete"])
    if p: d["planete"] = poser(p, px, py, pz, E_PLANETE)

    d["lunes"] = []
    for k, nom in enumerate(s["lunes"]):
        m = acteurs.get(nom)
        if not m: continue
        a2 = rad + (math.pi / 2.0) + k * math.pi
        d["lunes"].append(poser(m, px + D_LUNE * math.cos(a2),
                                py + D_LUNE * math.sin(a2), pz + (5000 if k else -5000), E_LUNE))
    res["systemes"].append(d)

unreal.get_editor_subsystem(unreal.LevelEditorSubsystem).save_all_dirty_levels()
io.open(OUT,"w",encoding="utf-8").write(json.dumps(res, indent=1, ensure_ascii=False))
