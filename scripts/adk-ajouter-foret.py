# ══════════════════════════════════════════════════════════════════════════════
# adk-ajouter-foret.py — ForestKitONE devient le 6e monde de NARVOS.
#
#   exec(open(r"...\adk-ajouter-foret.py", encoding="utf-8").read())
#
#   NARVOS_FORET_APPLIQUER=1 pour ecrire ; sans, il MESURE et annonce le plan.
#
# ── POURQUOI UN SOUS-NIVEAU, ET PAS UNE COPIE D'ACTEURS ───────────────────────
# `ForestKitONE` porte un LANDSCAPE. Un Landscape ne se copie PAS entre niveaux :
# c'est ce qui a impose la copie d'acteurs pour CITY_PACK, qui n'en a aucun
# (mesure du 2026-09-08 : LandscapeProxy=0, Heightfield=0, LandscapeInfo=0, avec
# `SpringLandscape` en temoin positif rendant bien 1).
#
# Ici on a le terrain, donc on garde le niveau entier et on le monte en
# sous-niveau — exactement comme `Map_Forge`, `Map_Tower`, `Map_Alien` et
# `Map_Orbital`. Mesure du 2026-09-09 : `EditorLevelUtils.get_levels()` rend bien
# ces 5 niveaux, et `Server/Voyage.lua` s'appuie sur le fait que le moteur les
# charge AVEC la map, avant le premier paquet Lua.
#
# ── DEUX API CORRIGEES ────────────────────────────────────────────────────────
# Premiere version de ce script, ecrite sans sonder :
#   · `monde.get_editor_property("streaming_levels")` — **n'existe pas** sur
#     `World` en 5.7 (« Failed to find property 'streaming_levels' »). La lecture
#     des sous-niveaux passe par `EditorLevelUtils.get_levels(world)`.
#   · `load_level()` sur le niveau foret pour le mesurer, puis retour. Ca marche
#     et ca coute deux rechargements de `Map_Narvos` — 32 Mo, 5 sous-niveaux,
#     15 415 acteurs. On monte d'abord, on mesure sur place ensuite.
#
# ── LA POSITION N'EST PAS UN CHOIX ESTHETIQUE ─────────────────────────────────
# Les centres existants suivent une serie : forge Y≈2 km, tower ≈24, alien ≈44,
# capitale ≈64. La foret prend ≈84. C'est la suite — donc la position qu'un
# lecteur du catalogue attendra, et pas une valeur a retenir.
#
# ⚠ L'ALTITUDE N'EST PAS FIXEE ICI. Ce script pose le niveau en X/Y et laisse Z
# a 0. Le point d'ARRIVEE du joueur se mesure ensuite par raycast sur le terrain
# reel — c'est la regle qui a corrige les quatre precedents. Un joueur qui arrive
# sous le sol tombe sans fin, et ca se lit comme une map cassee.
# ══════════════════════════════════════════════════════════════════════════════

import unreal
import io
import os

RAPPORT = "E:/narvosprime-web-prototype/.hermes/foret_monde.txt"
APPLIQUER = os.environ.get("NARVOS_FORET_APPLIQUER") == "1"

PERSISTANT = "/Game/Narvos/Maps/Map_Narvos"

# Le niveau, promu sous `Narvos/` le 2026-09-09 (1 447 / 1 448 assets). Hors de
# ce dossier il ne serait pas cuit : le builder du pack ne prend que `Narvos/`.
FORET = "/Game/Narvos/OpenWorlds/Levels/ForestKitONE"

# Suite de la serie des centres. X aligne sur tower/alien/capitale.
CIBLE_X = -8513420.0
CIBLE_Y = 8385420.0

lignes = []
def dire(s):
    lignes.append(str(s))
    unreal.log("[NARVOS] " + str(s))

def ecrire():
    io.open(RAPPORT, "w", encoding="utf-8").write(chr(10).join(lignes))
    unreal.log("[NARVOS] ecrit : " + RAPPORT)


dire("=== FORET ===" + ("" if APPLIQUER else "   (MESURE — NARVOS_FORET_APPLIQUER=1 pour ecrire)"))

if not unreal.EditorAssetLibrary.does_asset_exist(FORET):
    dire("ARRET : %s introuvable." % FORET)
    ecrire()
    raise SystemExit

monde = unreal.EditorLevelLibrary.get_editor_world()
dire("")
dire("persistant : %s" % monde.get_path_name())
if PERSISTANT not in monde.get_path_name():
    dire("ARRET : le niveau charge n'est pas Map_Narvos. On ne monte rien a l'aveugle.")
    ecrire()
    raise SystemExit

# ── 1. Deja monte ? ──────────────────────────────────────────────────────────
existants = []
for l in unreal.EditorLevelUtils.get_levels(monde):
    try:
        existants.append(l.get_outermost().get_name())
    except Exception:
        pass

dire("")
dire("=== %d NIVEAU(X) DEJA DANS LE MONDE ===" % len(existants))
for e in existants:
    dire("  %s" % e)

if any("ForestKitONE" in e for e in existants):
    dire("")
    dire("ForestKitONE est DEJA monte. Rien a faire.")
    ecrire()
    raise SystemExit

if not APPLIQUER:
    dire("")
    dire("=== CE QUI SERAIT FAIT ===")
    dire("  1. add_level_to_world_with_transform(%s, LevelStreamingAlwaysLoaded)" % FORET.split("/")[-1])
    dire("  2. mesure de l'emprise de SES acteurs, une fois montes")
    dire("  3. transformation de niveau pour recentrer sur (%.0f, %.0f)" % (CIBLE_X, CIBLE_Y))
    dire("  4. recomptage, puis sauvegarde")
    dire("")
    dire("Rien ecrit.")
    ecrire()
    raise SystemExit

# ── 2. Montage ───────────────────────────────────────────────────────────────
#
# On releve les acteurs AVANT : la difference apres montage donne exactement
# ceux de la foret, sans avoir a interroger le niveau (dont la propriete
# `actors` n'est pas lisible en Python 5.7).
avant = set()
for a in unreal.EditorLevelLibrary.get_all_level_actors():
    avant.add(a.get_path_name())

dire("")
dire("=== MONTAGE ===")
dire("  %d acteur(s) dans le monde avant" % len(avant))

flux = unreal.EditorLevelUtils.add_level_to_world_with_transform(
    monde, FORET, unreal.LevelStreamingAlwaysLoaded, unreal.Transform())

if flux is None:
    dire("ECHEC : add_level_to_world_with_transform n'a rien rendu.")
    ecrire()
    raise SystemExit

dire("  monte : %s" % flux.get_class().get_name())

# ── 3. Mesure de l'emprise, sur place ────────────────────────────────────────
apres = unreal.EditorLevelLibrary.get_all_level_actors()
nouveaux = [a for a in apres if a.get_path_name() not in avant]
dire("  %d acteur(s) apportes par la foret" % len(nouveaux))

if len(nouveaux) == 0:
    dire("")
    dire("⚠ ZERO acteur apporte. Le niveau est monte mais vide — ou ses acteurs")
    dire("  ne sont pas encore charges. On NE POSE PAS de transformation sur une")
    dire("  emprise inconnue : elle enverrait le niveau n'importe ou.")
    unreal.EditorLoadingAndSavingUtils.save_dirty_packages(True, True)
    ecrire()
    raise SystemExit

landscapes = [a for a in nouveaux if "Landscape" in a.get_class().get_name()]
x0 = y0 = 1e12
x1 = y1 = -1e12
zmin = 1e12
zmax = -1e12
for a in nouveaux:
    p = a.get_actor_location()
    x0 = min(x0, p.x); x1 = max(x1, p.x)
    y0 = min(y0, p.y); y1 = max(y1, p.y)
    zmin = min(zmin, p.z); zmax = max(zmax, p.z)

dire("")
dire("=== LA FORET, MESUREE ===")
dire("  acteurs         %d" % len(nouveaux))
dire("  dont Landscape  %d  (%s)" % (
    len(landscapes), ", ".join(sorted(set(a.get_class().get_name() for a in landscapes))) or "aucun"))
dire("  emprise X       %.0f .. %.0f   (%.2f km)" % (x0, x1, (x1 - x0) / 100000.0))
dire("  emprise Y       %.0f .. %.0f   (%.2f km)" % (y0, y1, (y1 - y0) / 100000.0))
dire("  Z               %.0f .. %.0f" % (zmin, zmax))

if len(landscapes) == 0:
    dire("")
    dire("⚠ AUCUN LANDSCAPE APPORTE. Le sous-niveau reste valable (il porte le")
    dire("  decor), mais l'interet principal — garder le terrain intact — tombe.")

# ── 4. Recentrage ────────────────────────────────────────────────────────────
cx = (x0 + x1) / 2.0
cy = (y0 + y1) / 2.0
offset = unreal.Vector(CIBLE_X - cx, CIBLE_Y - cy, 0.0)

t = unreal.Transform()
t.translation = offset
flux.set_editor_property("level_transform", t)

dire("")
dire("=== RECENTRAGE ===")
dire("  centre actuel   (%.0f, %.0f)" % (cx, cy))
dire("  cible           (%.0f, %.0f)   suite : forge 2 km, tower 24, alien 44, capitale 64, foret 84"
     % (CIBLE_X, CIBLE_Y))
dire("  transformation  (%.0f, %.0f, %.0f)" % (offset.x, offset.y, offset.z))

# ── 5. Recomptage — seule preuve ─────────────────────────────────────────────
#
# ⚠ Une ecriture Unreal qui rate ne dit rien. On relit la liste des niveaux et
# la transformation reellement enregistree.
final = []
for l in unreal.EditorLevelUtils.get_levels(monde):
    try:
        final.append(l.get_outermost().get_name())
    except Exception:
        pass

relu = flux.get_editor_property("level_transform").translation
dire("")
dire("=== RECOMPTAGE ===")
dire("  %d niveau(x) : %s" % (len(final), ", ".join(f.split("/")[-1] for f in final)))
dire("  ForestKitONE present  : %s" % ("oui" if any("ForestKitONE" in f for f in final) else "NON"))
dire("  transformation relue  : (%.0f, %.0f, %.0f)" % (relu.x, relu.y, relu.z))
dire("  conforme              : %s" % ("oui" if abs(relu.x - offset.x) < 1.0 and abs(relu.y - offset.y) < 1.0 else "NON"))

unreal.EditorLoadingAndSavingUtils.save_dirty_packages(True, True)
sales = len(unreal.EditorLoadingAndSavingUtils.get_dirty_map_packages() or [])
dire("  sauvegarde : %d map(s) sale(s) restante(s)" % sales)

ecrire()