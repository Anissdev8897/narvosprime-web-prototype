# ══════════════════════════════════════════════════════════════════════════════
# adk-recolter-maps-ville.py — relever le contenu des maps CITY_PACK, sans rien
# modifier.
#
#   Depuis l'editeur ouvert :
#       exec(open(r"...\adk-recolter-maps-ville.py", encoding="utf-8").read())
#
# ── POURQUOI RECOLTER AVANT DE COPIER ─────────────────────────────────────────
# CITY_PACK compte 18 maps. Six s'appellent `OVERVIEW` : ce sont des grilles de
# presentation de props, pas des scenes jouables. Les copier melangerait un
# etalage de mobilier avec un hopital.
#
# Et surtout : on ne sait pas combien d'acteurs chaque map porte, ni quelle
# emprise elle occupe. Poser 18 scenes au meme endroit ferait un empilement ;
# les espacer demande de connaitre leur taille. Cette mesure precede donc la
# copie, elle ne la remplace pas.
#
# ⚠ AUCUNE ECRITURE. Le script charge chaque niveau, releve, et rend la main.
# `load_level` DETRUIT les modifications non sauvegardees du niveau courant :
# on sauvegarde donc avant, et on verifie qu'il ne reste rien de sale.
# ══════════════════════════════════════════════════════════════════════════════

import unreal
import json
import io

SORTIE = "E:/narvosprime-web-prototype/.hermes/maps_ville.json"
RAPPORT = "E:/narvosprime-web-prototype/.hermes/maps_ville.txt"

MAPS = [
    "/Game/Narvos/CITY_PACK/BIG_CITY/MAPS/BIG_CITY_NIGHT_1",
    "/Game/Narvos/CITY_PACK/BIG_CITY/MAPS/BIG_CITY_NIGHT_OPENNING",
    "/Game/Narvos/CITY_PACK/BIG_CITY/MAPS/OVERVIEW_BIGCITY",
    "/Game/Narvos/CITY_PACK/INTERIORS/DJ_HALL_DISCO/Maps/Dj_Hall",
    "/Game/Narvos/CITY_PACK/INTERIORS/DJ_HALL_DISCO/Maps/Probs_Scene",
    "/Game/Narvos/CITY_PACK/INTERIORS/GENERATOR_ROOM/MAPS/POWER_GENERATOR_ROOM",
    "/Game/Narvos/CITY_PACK/INTERIORS/GENERATOR_ROOM/MAPS/OVERVIEW",
    "/Game/Narvos/CITY_PACK/INTERIORS/HOSPITAL/MAPS/HOSPITAL",
    "/Game/Narvos/CITY_PACK/INTERIORS/HOSPITAL/MAPS/OVERVIEW",
    "/Game/Narvos/CITY_PACK/INTERIORS/LIBRARY/MAPS/LIBRARY",
    "/Game/Narvos/CITY_PACK/INTERIORS/LIBRARY/MAPS/OVERVIEW",
    "/Game/Narvos/CITY_PACK/INTERIORS/SCI_FI_APARTMENT/MAPS/APARTMENT",
    "/Game/Narvos/CITY_PACK/INTERIORS/SCI_FI_APARTMENT/MAPS/OVERVIEW",
    "/Game/Narvos/CITY_PACK/INTERIORS/SCI_FI_LABORATORY/MAP/LABORATORY",
    "/Game/Narvos/CITY_PACK/INTERIORS/TERMINAL/MAPS/TERMINAL",
    "/Game/Narvos/CITY_PACK/INTERIORS/TERMINAL/MAPS/OVERVIEW",
    "/Game/Narvos/CITY_PACK/INTERIORS/WEAPON_CENTER/MAPS/WEAPON_CENTER",
    "/Game/Narvos/CITY_PACK/INTERIORS/WEAPON_CENTER/MAPS/Overview",
]

lignes = []
def dire(s):
    lignes.append(str(s))
    unreal.log("[NARVOS] " + str(s))


# ── Rien de sale avant de changer de niveau ──────────────────────────────────
sales = unreal.EditorLoadingAndSavingUtils.get_dirty_content_packages() or []
smap = unreal.EditorLoadingAndSavingUtils.get_dirty_map_packages() or []
if sales or smap:
    dire("sauvegarde prealable : %d contenu, %d map" % (len(sales), len(smap)))
    unreal.EditorLoadingAndSavingUtils.save_dirty_packages(True, True)

recolte = {}
dire("")
dire("%-46s %7s %9s %9s %s" % ("MAP", "ACTEURS", "EMPRISE X", "EMPRISE Y", "TYPES"))
dire("-" * 100)

for chemin in MAPS:
    try:
        unreal.EditorLevelLibrary.load_level(chemin)
    except Exception as e:
        dire("%-46s CHARGEMENT IMPOSSIBLE : %s" % (chemin.split("/")[-1], str(e)[:40]))
        continue

    acteurs = unreal.EditorLevelLibrary.get_all_level_actors()
    items = []
    types = {}
    x0 = y0 = z0 = 1e12
    x1 = y1 = z1 = -1e12

    for a in acteurs:
        cn = a.get_class().get_name()
        types[cn] = types.get(cn, 0) + 1

        # On ne releve QUE les StaticMeshActor : ce sont eux qui portent le
        # decor, et ce sont les seuls qu'on sait re-spawner a l'identique.
        # Une lumiere ou un volume demanderait ses propres proprietes, et un
        # Blueprint son propre etat — les copier a l'aveugle donnerait des
        # acteurs presents et inertes.
        if cn != "StaticMeshActor":
            continue
        comps = a.get_components_by_class(unreal.StaticMeshComponent)
        if not comps:
            continue
        mesh = comps[0].static_mesh
        if mesh is None:
            continue

        t = a.get_actor_transform()
        loc, rot, ech = t.translation, t.rotation.rotator(), t.scale3d
        x0 = min(x0, loc.x); x1 = max(x1, loc.x)
        y0 = min(y0, loc.y); y1 = max(y1, loc.y)
        z0 = min(z0, loc.z); z1 = max(z1, loc.z)

        # Les surcharges de materiau par slot : sans elles, un mesh re-spawne
        # reprend les materiaux de l'ASSET et perd ce que la scene lui avait mis.
        mats = []
        for m in comps[0].get_editor_property("override_materials") or []:
            mats.append(m.get_path_name() if m is not None else None)

        items.append({
            "mesh": mesh.get_path_name(),
            "loc": [loc.x, loc.y, loc.z],
            "rot": [rot.roll, rot.pitch, rot.yaw],
            "ech": [ech.x, ech.y, ech.z],
            "mats": mats,
            "label": a.get_actor_label(),
        })

    court = chemin.split("/")[-1]
    if items:
        recolte[chemin] = {
            "nom": court,
            "acteurs": items,
            "bornes": [x0, x1, y0, y1, z0, z1],
        }
        principaux = sorted(types.items(), key=lambda kv: -kv[1])[:3]
        dire("%-46s %7d %9.0f %9.0f  %s" % (
            court[:46], len(items), x1 - x0, y1 - y0,
            ", ".join("%s x%d" % (k, v) for k, v in principaux)))
    else:
        dire("%-46s %7d  (aucun StaticMeshActor)" % (court[:46], 0))

# ── Retour au niveau du jeu ──────────────────────────────────────────────────
unreal.EditorLevelLibrary.load_level("/Game/Narvos/Maps/Map_Narvos")

total = sum(len(v["acteurs"]) for v in recolte.values())
dire("")
dire("%d map(s) recoltee(s), %d StaticMeshActor au total" % (len(recolte), total))

io.open(SORTIE, "w", encoding="utf-8").write(json.dumps(recolte, indent=1))
io.open(RAPPORT, "w", encoding="utf-8").write(chr(10).join(lignes))
dire("ecrit : " + SORTIE)