# [recupere de l'historique : ecrit le 2026-09-06T11:51:22Z sous le nom _espace_v2.py, lance dans l'editeur par ue-remote.py]
# Trois systemes solaires ECARTES, et de quoi voyager entre eux.
#
# ── LES DISTANCES ─────────────────────────────────────────────────────────────
# 40 km entre le hub et chaque etoile, 69 km entre deux systemes. C'est loin
# expres : un systeme solaire qui tient dans le champ de vision n'est pas un
# systeme solaire, c'est une vitrine.
#
# ── CE QUI REND LE TRAJET SUPPORTABLE ─────────────────────────────────────────
# Deux choses, et elles vont ensemble :
#   1. la vitesse — `Character:SetSpeedMultiplier` en orbite (cote Lua) ;
#   2. le CONTENU — un couloir vide de 40 km se traverse une fois et jamais deux.
# On seme donc la route : champs d'asteroides, epaves-reperes, poussiere, et des
# meteores en feu. Le skill de level design le dit : « Micro : souche, squelette,
# epave. Casse les environnements qui se repetent. Devient critique quand aucun
# macro n'est visible. » En orbite, AUCUN macro n'est visible entre deux etoiles.
import unreal, json, io, math, random
OUT = r"C:/Users/aniss/AppData/Local/Temp/claude/espace_v2.json"

R_SYSTEME = 4000000.0     # 40 km
D_PLANETE =  400000.0     # 4 km entre l'etoile et sa planete
D_LUNE    =  100000.0     # 1 km
E_ETOILE, E_PLANETE, E_LUNE = 3.0, 0.9, 0.12

SYSTEMES = [
    {"monde": "forge", "nom": "Verdant", "angle":  90.0, "z":  200000.0,
     "etoile": "SM_PlanetSphere27", "planete": "SM_PlanetSphere",
     "lunes": ["SM_PlanetSphere3", "SM_PlanetSphere4"]},
    {"monde": "tower", "nom": "Ocre",    "angle": 210.0, "z": -300000.0,
     "etoile": "SM_PlanetSphere28", "planete": "SM_PlanetSphere2",
     "lunes": ["SM_PlanetSphere5", "SM_PlanetSphere6"]},
    {"monde": "alien", "nom": "Azur",    "angle": 330.0, "z":  400000.0,
     "etoile": "SM_PlanetSphere29", "planete": "SM_PlanetSphere11",
     "lunes": ["SM_PlanetSphere9", "SM_PlanetSphere10"]},
]

CAILLOUX = ["/Game/Narvos/SpaceScenes/Scenery/Asteroids/NormalAsteroids/Meshes/SM_Asteroid_01",
            "/Game/Narvos/SpaceScenes/Scenery/Asteroids/NormalAsteroids/Meshes/SM_Asteroid_02",
            "/Game/Narvos/SpaceScenes/Effects/Meshes/SM_Small_Astroid_1",
            "/Game/Narvos/SpaceScenes/Scenery/Props/Meshes/SM_Chunk_1",
            "/Game/Narvos/SpaceScenes/Scenery/Props/Meshes/SM_Chunk_2",
            "/Game/Narvos/SpaceScenes/Scenery/Props/Meshes/SM_Chunk_3",
            "/Game/Narvos/SpaceScenes/Scenery/Props/Meshes/SM_Chunk_4",
            "/Game/Narvos/SpaceScenes/Scenery/Props/Meshes/SM_Chunk_5",
            "/Game/Narvos/SpaceScenes/Scenery/Props/Meshes/SM_Chunk_6"]
PILIERS = ["/Game/Narvos/SpaceScenes/Scenery/Asteroids/PillarAsteroids/Meshes/SM_Astroid_Pillar_1",
           "/Game/Narvos/SpaceScenes/Scenery/Asteroids/PillarAsteroids/Meshes/SM_Astroid_Pillar_2",
           "/Game/Narvos/SpaceScenes/Scenery/Asteroids/PillarAsteroids/Meshes/SM_Astroid_Pillar_3"]
EPAVES  = ["/Game/Narvos/SpaceScenes/Scenery/SpaceStations/Broken_Spaceship/Meshes/SM_Spaceship_broken_front",
           "/Game/Narvos/SpaceScenes/Scenery/SpaceStations/Broken_Spaceship/Meshes/SM_Spaceship_broken_back"]
POUSSIERE = ["/Game/Narvos/SpaceScenes/Effects/ParticleSystems/P_Dust_01",
             "/Game/Narvos/SpaceScenes/Effects/ParticleSystems/P_Dust_02",
             "/Game/Narvos/SpaceScenes/Effects/ParticleSystems/P_Mist_01",
             "/Game/Narvos/SpaceScenes/Effects/ParticleSystems/P_Mist_03",
             "/Game/Narvos/SpaceScenes/Effects/ParticleSystems/P_Mist_05"]
METEORES = ["/Game/Narvos/SpaceScenes/Effects/ParticleSystems/FireBalls/P_FireBall_Arc_P_%d" % i
            for i in (1, 2, 3, 4, 5, 6)]

MARQUE = "NarvosEspace_"          # prefixe : tout ce que ce script pose
rng = random.Random(20260906)     # graine fixe : deux passes donnent la meme carte

w = unreal.EditorLevelLibrary.get_editor_world()
res = {"monde": w.get_name(), "systemes": [], "semis": {}}
sub = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
if w.get_name() != "Map_Narvos":
    res["arret"] = "Map_Narvos n'est pas ouvert"
    io.open(OUT,"w",encoding="utf-8").write(json.dumps(res, indent=1)); raise SystemExit(0)

sub.set_current_level_by_name("Map_Orbital")
acteurs = {a.get_actor_label(): a for a in unreal.EditorLevelLibrary.get_all_level_actors()}

# ── Purge d'une passe precedente : le script doit pouvoir se rejouer ──────────
vieux = [a for a in unreal.EditorLevelLibrary.get_all_level_actors()
         if a.get_actor_label().startswith(MARQUE)]
for a in vieux:
    try: unreal.EditorLevelLibrary.destroy_actor(a)
    except Exception: pass
res["purges"] = len(vieux)

charges = {}
def actif(chemin):
    if chemin not in charges: charges[chemin] = unreal.EditorAssetLibrary.load_asset(chemin)
    return charges[chemin]

compte = {"cailloux": 0, "piliers": 0, "epaves": 0, "poussiere": 0, "meteores": 0}
def poser_objet(chemin, x, y, z, echelle, cle):
    o = actif(chemin)
    if not o: return None
    rot = unreal.Rotator(rng.uniform(0, 360), rng.uniform(0, 360), rng.uniform(0, 360))
    a = unreal.EditorLevelLibrary.spawn_actor_from_object(o, unreal.Vector(x, y, z), rot)
    if not a: return None
    a.set_actor_scale3d(unreal.Vector(echelle, echelle, echelle))
    compte[cle] += 1
    a.set_actor_label("%s%s_%d" % (MARQUE, cle, compte[cle]))
    return a

def poser_particule(chemin, x, y, z, echelle, cle):
    o = actif(chemin)
    if not o: return None
    a = unreal.EditorLevelLibrary.spawn_actor_from_class(
        unreal.Emitter, unreal.Vector(x, y, z), unreal.Rotator())
    if not a: return None
    try:
        a.particle_system_component.set_template(o)
    except Exception:
        pass
    a.set_actor_scale3d(unreal.Vector(echelle, echelle, echelle))
    compte[cle] += 1
    a.set_actor_label("%s%s_%d" % (MARQUE, cle, compte[cle]))
    return a

def bouger(label, x, y, z, echelle):
    a = acteurs.get(label)
    if not a: return None
    a.set_actor_location(unreal.Vector(x, y, z), False, False)
    a.set_actor_scale3d(unreal.Vector(echelle, echelle, echelle))
    o, e = a.get_actor_bounds(False)
    return {"label": label, "loc": [round(x), round(y), round(z)], "rayon": round(max(e.x, e.y, e.z))}

mat_soleil = None
ph = acteurs.get("Planet_Half")
if ph: mat_soleil = ph.static_mesh_component.get_material(0)

for s in SYSTEMES:
    rad = math.radians(s["angle"])
    cx, cy, cz = R_SYSTEME * math.cos(rad), R_SYSTEME * math.sin(rad), s["z"]
    d = {"monde": s["monde"], "nom": s["nom"], "centre": [round(cx), round(cy), round(cz)]}

    e = acteurs.get(s["etoile"])
    if e:
        d["etoile"] = bouger(s["etoile"], cx, cy, cz, E_ETOILE)
        if mat_soleil:
            for i in range(e.static_mesh_component.get_num_materials()):
                e.static_mesh_component.set_material(i, mat_soleil)

    px, py, pz = cx + D_PLANETE * math.cos(rad), cy + D_PLANETE * math.sin(rad), cz
    d["planete"] = bouger(s["planete"], px, py, pz, E_PLANETE)
    d["lunes"] = []
    for k, nom in enumerate(s["lunes"]):
        a2 = rad + math.pi / 2.0 + k * math.pi
        r = bouger(nom, px + D_LUNE * math.cos(a2), py + D_LUNE * math.sin(a2),
                   pz + (12000 if k else -12000), E_LUNE)
        if r: d["lunes"].append(r)

    # ── La route, du hub jusqu'au systeme ────────────────────────────────────
    # 60 asteroides repartis le long du segment, ecartes lateralement de facon
    # croissante : dense pres du hub (on voit qu'on part), aere ensuite.
    for i in range(60):
        t = (i + 1) / 62.0
        bx, by, bz = cx * t, cy * t, cz * t
        etal = 30000.0 + 90000.0 * t
        poser_objet(rng.choice(CAILLOUX),
                    bx + rng.uniform(-etal, etal), by + rng.uniform(-etal, etal),
                    bz + rng.uniform(-etal * 0.6, etal * 0.6),
                    rng.uniform(1.5, 9.0), "cailloux")
    # Trois piliers-reperes par route : « jusqu'au pilier, puis a gauche ».
    for i in (1, 2, 3):
        t = i / 4.0
        poser_objet(rng.choice(PILIERS), cx * t, cy * t, cz * t + rng.uniform(-20000, 20000),
                    rng.uniform(3.0, 6.0), "piliers")
    # Une epave a mi-chemin : le repere le plus lisible qui soit.
    poser_objet(EPAVES[SYSTEMES.index(s) % 2], cx * 0.5 + 60000, cy * 0.5, cz * 0.5 + 15000,
                4.0, "epaves")
    # Poussiere et brume : cinq nappes echelonnees.
    for i in range(5):
        t = (i + 1) / 6.0
        poser_particule(rng.choice(POUSSIERE), cx * t, cy * t, cz * t, rng.uniform(8, 20), "poussiere")
    # Meteores en feu : quatre par route, decales du couloir pour se voir passer.
    for i in range(4):
        t = rng.uniform(0.15, 0.9)
        poser_particule(rng.choice(METEORES),
                        cx * t + rng.uniform(-120000, 120000),
                        cy * t + rng.uniform(-120000, 120000),
                        cz * t + rng.uniform(-60000, 60000), rng.uniform(15, 40), "meteores")
    # Ceinture d'asteroides autour de l'etoile.
    for i in range(28):
        ang = rng.uniform(0, 2 * math.pi)
        r = rng.uniform(600000, 900000)
        poser_objet(rng.choice(CAILLOUX), cx + r * math.cos(ang), cy + r * math.sin(ang),
                    cz + rng.uniform(-40000, 40000), rng.uniform(2.0, 7.0), "cailloux")
    res["systemes"].append(d)

res["semis"] = compte
sub.set_current_level_by_name("Map_Narvos")
res["sauve"] = bool(sub.save_all_dirty_levels())
io.open(OUT,"w",encoding="utf-8").write(json.dumps(res, indent=1, ensure_ascii=False))
