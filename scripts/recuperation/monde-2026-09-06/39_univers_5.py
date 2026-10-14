# [recupere de l'historique : ecrit le 2026-09-06T11:48:16Z sous le nom _univers_5.py, lance dans l'editeur par ue-remote.py]
# Etape 5 : trois planetes praticables, et le sol des trois mondes mesure.
#
# ── POURQUOI DEPLACER DES PLANETES QUI EXISTENT DEJA ─────────────────────────
# Les 25 spheres de la map d'origine sont du DECOR de presentation : soit des
# fonds de galaxie (MI_Galaxy_*), soit des planetes a 11 km du hub et larges de
# 23 m. nanos n'a aucun vehicule volant ; a la vitesse d'un personnage en vol
# libre, 11 km font presque une heure. Une porte qu'on ne peut pas atteindre
# n'est pas une porte.
#
# On garde donc les ACTEURS et leurs materiaux — ce sont bien les planetes
# existantes — et on leur donne une place et une taille jouables : 2,5 km du hub,
# 120 degres d'ecart, rayon 415 m.
import unreal, json, io, math
OUT = r"C:/Users/aniss/AppData/Local/Temp/claude/univers5.json"

R_ORBITE = 250000.0    # 2,5 km du hub
ECHELLE  = 0.9         # 46 186 uu de rayon a l'echelle 1 -> 415 m
CHOIX = [
    ("SM_PlanetSphere",   "forge",  90.0,  20000.0),
    ("SM_PlanetSphere2",  "tower",  210.0, -30000.0),
    ("SM_PlanetSphere11", "alien",  330.0,  60000.0),
]
# Sol des trois mondes, au centre de chaque landscape. Les decalages sont ceux
# des sous-niveaux ; le raycast se fait donc en coordonnees MONDE.
SONDES = {
    "forge": (-8000000.0, 0.0, 0.0),
    "tower": (-8000000.0, 2000000.0, 0.0),
    "alien": (-8000000.0, 4000000.0, 0.0),
}

w = unreal.EditorLevelLibrary.get_editor_world()
res = {"monde": w.get_name(), "planetes": [], "sols": {}}
acteurs = {a.get_actor_label(): a for a in unreal.EditorLevelLibrary.get_all_level_actors()}

for label, monde, angle, z in CHOIX:
    a = acteurs.get(label)
    d = {"acteur": label, "monde": monde}
    if not a:
        d["etat"] = "absent"; res["planetes"].append(d); continue
    rad = math.radians(angle)
    loc = unreal.Vector(R_ORBITE * math.cos(rad), R_ORBITE * math.sin(rad), z)
    a.set_actor_location(loc, False, False)
    a.set_actor_scale3d(unreal.Vector(ECHELLE, ECHELLE, ECHELLE))
    o, e = a.get_actor_bounds(False)
    d.update({"loc": [round(loc.x), round(loc.y), round(loc.z)],
              "rayon": round(max(e.x, e.y, e.z)),
              "materiau": a.static_mesh_component.get_material(0).get_name()})
    res["planetes"].append(d)

# ── Le sol, au raycast. Jamais a l'oeil : une arrivee sous le terrain fait
# tomber le joueur a travers le decor, et une arrivee trop haute le fait chuter.
for monde, (x, y, _) in SONDES.items():
    depart = unreal.Vector(x, y, 60000.0)
    arrivee = unreal.Vector(x, y, -60000.0)
    hit = unreal.SystemLibrary.line_trace_single(
        w, depart, arrivee, unreal.TraceTypeQuery.TRACE_TYPE_QUERY1, True, [],
        unreal.DrawDebugTrace.NONE, True, unreal.LinearColor.RED,
        unreal.LinearColor.GREEN, 0.0)
    if hit:
        p = hit.to_tuple()[4]
        res["sols"][monde] = {"z": round(p.z, 1), "acteur": str(hit.to_tuple()[9].get_actor_label()) if hit.to_tuple()[9] else None}
    else:
        res["sols"][monde] = {"z": None}
unreal.get_editor_subsystem(unreal.LevelEditorSubsystem).save_all_dirty_levels()
io.open(OUT,"w",encoding="utf-8").write(json.dumps(res, indent=1, ensure_ascii=False))
