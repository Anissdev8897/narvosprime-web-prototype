# ══════════════════════════════════════════════════════════════════════════════
# adk-copier-ville-vers-narvos.py — poser CITY_PACK dans Map_Narvos.
#
#   Depuis l'editeur ouvert :
#       exec(open(r"...\adk-copier-ville-vers-narvos.py", encoding="utf-8").read())
#
#   NARVOS_VILLE_APPLIQUER=1 pour ecrire ; sans, il SIMULE et annonce le plan.
#
# ── POURQUOI UNE COPIE D'ACTEURS ET PAS UN SOUS-NIVEAU ────────────────────────
# Verifie le 2026-09-08 sur les 18 .umap de CITY_PACK : `LandscapeProxy=0`,
# `LandscapeHeightfieldCollision=0`, `LandscapeInfo=0`, `LandscapeGizmo=0`, et
# zero fichier `*Landscape*` sur disque. Le temoin positif (`SpringLandscape`)
# rend bien `Heightfield=1`, donc le zero n'est pas un faux negatif d'outil.
#
# Un Landscape ne se copie PAS entre niveaux — seul un sous-niveau le garde
# intact. Sans Landscape, la copie d'acteurs est la voie simple : les acteurs
# entrent dans le niveau persistant, sans streaming a gerer.
#
# ── CE QUI EST ECARTE, ET POURQUOI ────────────────────────────────────────────
#   BIG_CITY_NIGHT_OPENNING  3 186 acteurs, EMPRISE IDENTIQUE AU PIXEL a
#                            BIG_CITY_NIGHT_1 (753 960 x 404 573). Meme ville en
#                            variante « ouverture ». La copier la dedoublerait.
#   les 6 OVERVIEW           690 acteurs de grilles de presentation de props.
#                            Un etalage de mobilier, pas une scene.
#
# ── LE PLAN ───────────────────────────────────────────────────────────────────
# `BIG_CITY_NIGHT_1` fait 7 540 x 4 046 m : c'est une VILLE, pas un interieur.
# Elle devient la capitale. Les huit interieurs sont ses batiments.
#
# La capitale se pose en suivant l'espacement DEJA etabli des mondes :
#   forge Y ~ 2 km   tower Y ~ 24 km   alien Y ~ 44 km   -> la ville a Y ~ 64 km
# Ce n'est pas un choix esthetique : c'est la suite de la serie existante, donc
# la position qu'un lecteur du catalogue attendra.
#
# Les interieurs s'alignent au NORD de la ville, chacun espace de sa propre
# emprise plus une marge. Deux interieurs qui se chevauchent donnent deux
# hopitaux imbriques, et ca ne se voit qu'en y entrant.
#
# ⚠ TOUT EST REVERSIBLE ET DEPLACABLE EN BLOC. Chaque acteur pose recoit un
# label prefixe `NARVOS_VILLE_<MAP>_` : une recherche sur ce prefixe les
# selectionne tous. L'offset applique est ecrit dans le rapport, donc le retour
# en arriere est une translation, pas une reconstruction.
# ══════════════════════════════════════════════════════════════════════════════

import unreal
import json
import io
import os

PLAN = "E:/narvosprime-web-prototype/.hermes/maps_ville.json"
RAPPORT = "E:/narvosprime-web-prototype/.hermes/ville_posee.txt"
APPLIQUER = os.environ.get("NARVOS_VILLE_APPLIQUER") == "1"

# Suite de l'espacement des mondes existants : forge ~2 km, tower ~24, alien ~44.
CAPITALE = unreal.Vector(-8513420.0, 6385420.0, 151800.0)

# Marge entre deux interieurs. 20 000 unites = 200 m : large devant les plus
# grands (145 m), et lisible dans l'outliner.
MARGE = 20000.0

ECARTES = ("BIG_CITY_NIGHT_OPENNING", "OVERVIEW", "OVERVIEW_BIGCITY", "Overview")

lignes = []
def dire(s):
    lignes.append(str(s))
    unreal.log("[NARVOS] " + str(s))


recolte = json.load(io.open(PLAN, encoding="utf-8"))

ville, interieurs = None, []
for chemin, d in recolte.items():
    if d["nom"] in ECARTES:
        continue
    if d["nom"] == "BIG_CITY_NIGHT_1":
        ville = (chemin, d)
    else:
        interieurs.append((chemin, d))

if ville is None:
    dire("ARRET : BIG_CITY_NIGHT_1 absente de la recolte")
    raise SystemExit

# Du plus grand au plus petit : les gros d'abord, l'alignement reste lisible.
interieurs.sort(key=lambda kv: -(kv[1]["bornes"][1] - kv[1]["bornes"][0]))

dire("=== PLAN ===" + ("" if APPLIQUER else "   (SIMULATION — NARVOS_VILLE_APPLIQUER=1 pour ecrire)"))
dire("")

# ── L'offset de chaque scene ────────────────────────────────────────────────
#
# On recentre chaque scene sur son point cible : l'offset est
# `cible - centre_de_la_scene`. Recentrer plutot que translater brutalement
# evite qu'une scene dont le contenu est loin de son origine parte a des
# kilometres de la ou on la croit.
plans = []

b = ville[1]["bornes"]
cx, cy = (b[0] + b[1]) / 2.0, (b[2] + b[3]) / 2.0
plans.append((ville[0], ville[1], unreal.Vector(
    CAPITALE.x - cx, CAPITALE.y - cy, CAPITALE.z - b[4])))

# Les interieurs remontent vers +Y depuis le bord nord de la ville.
curseur = CAPITALE.y + (b[3] - b[2]) / 2.0 + MARGE
for chemin, d in interieurs:
    bb = d["bornes"]
    largeur = bb[3] - bb[2]
    ccx, ccy = (bb[0] + bb[1]) / 2.0, (bb[2] + bb[3]) / 2.0
    cible_y = curseur + largeur / 2.0
    plans.append((chemin, d, unreal.Vector(
        CAPITALE.x - ccx, cible_y - ccy, CAPITALE.z - bb[4])))
    curseur = cible_y + largeur / 2.0 + MARGE

dire("%-26s %7s  %14s %14s  %s" % ("SCENE", "ACTEURS", "CIBLE X (km)", "CIBLE Y (km)", "OFFSET APPLIQUE"))
dire("-" * 104)
for chemin, d, off in plans:
    bb = d["bornes"]
    dire("%-26s %7d  %14.2f %14.2f  (%.0f, %.0f, %.0f)" % (
        d["nom"][:26], len(d["acteurs"]),
        ((bb[0] + bb[1]) / 2.0 + off.x) / 100000.0,
        ((bb[2] + bb[3]) / 2.0 + off.y) / 100000.0,
        off.x, off.y, off.z))

total = sum(len(d["acteurs"]) for _, d, _ in plans)
dire("")
dire("%d scene(s), %d acteur(s) a poser" % (len(plans), total))
dire("")
dire("⚠ pour tout retirer : selectionner le prefixe NARVOS_VILLE_ dans l'outliner.")

if not APPLIQUER:
    io.open(RAPPORT, "w", encoding="utf-8").write(chr(10).join(lignes))
    dire("Rien ecrit.")
    raise SystemExit

# ── Pose ────────────────────────────────────────────────────────────────────
unreal.EditorLevelLibrary.load_level("/Game/Narvos/Maps/Map_Narvos")
eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)

# ⚠ Un mesh est charge UNE fois. 13 490 acteurs sur ~2 000 meshes distincts :
# recharger a chaque acteur multiplierait le temps par sept.
cache = {}
def mesh_de(chemin_mesh):
    if chemin_mesh not in cache:
        cache[chemin_mesh] = unreal.load_asset(chemin_mesh.split(".")[0])
    return cache[chemin_mesh]

poses, rates = 0, 0
for chemin, d, off in plans:
    n = 0
    for it in d["acteurs"]:
        m = mesh_de(it["mesh"])
        if m is None:
            rates += 1
            continue
        loc = unreal.Vector(it["loc"][0] + off.x, it["loc"][1] + off.y, it["loc"][2] + off.z)
        rot = unreal.Rotator(it["rot"][0], it["rot"][1], it["rot"][2])
        a = eas.spawn_actor_from_object(m, loc, rot)
        if a is None:
            rates += 1
            continue
        a.set_actor_scale3d(unreal.Vector(it["ech"][0], it["ech"][1], it["ech"][2]))
        a.set_actor_label("NARVOS_VILLE_%s_%d" % (d["nom"], n))

        # Les surcharges de materiau : sans elles, le mesh reprend celles de
        # l'ASSET et perd ce que la scene lui avait pose.
        if it["mats"]:
            comps = a.get_components_by_class(unreal.StaticMeshComponent)
            if comps:
                for i, mp in enumerate(it["mats"]):
                    if not mp:
                        continue
                    mat = unreal.load_asset(mp.split(".")[0])
                    if mat is not None:
                        comps[0].set_material(i, mat)
        n += 1
        poses += 1
    dire("  POSE  %-26s %d acteur(s)" % (d["nom"], n))

dire("")
dire("%d acteur(s) pose(s), %d rate(s), %d mesh(es) distincts charges" % (poses, rates, len(cache)))

unreal.EditorLoadingAndSavingUtils.save_dirty_packages(True, True)
restant = len(unreal.EditorLoadingAndSavingUtils.get_dirty_map_packages() or [])
dire("sauvegarde : %d map(s) sale(s) restante(s)" % restant)

io.open(RAPPORT, "w", encoding="utf-8").write(chr(10).join(lignes))