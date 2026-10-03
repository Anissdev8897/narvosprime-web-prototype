# ══════════════════════════════════════════════════════════════════════════════
# adk-sonder-sousniveaux.py — quels niveaux sont montes dans Map_Narvos, et
# lesquels attendent encore ?
#
#   exec(open(r"...\adk-sonder-sousniveaux.py", encoding="utf-8").read())
#
# ⚠ AUCUNE ECRITURE, ET AUCUN `load_level`. L'editeur peut porter des
# modifications non sauvegardees ; `load_level` les DETRUIT sans confirmation.
# On lit le monde courant et le registre, rien d'autre.
#
# ── POURQUOI CETTE SONDE ──────────────────────────────────────────────────────
# La promotion a fait entrer des `.umap` sous `/Game/Narvos` (ForestKitONE,
# OpenWorlds, Scene1..3, les 18 de CITY_PACK). Etre PROMU et etre MONTE sont
# deux choses differentes : un niveau promu est cuit dans le pack, mais il
# n'apparait en jeu que s'il est sous-niveau du persistant — ou si son contenu a
# ete recopie dedans, ce qui est le cas de CITY_PACK.
# ══════════════════════════════════════════════════════════════════════════════

import unreal
import io

RAPPORT = "E:/narvosprime-web-prototype/.hermes/sousniveaux.txt"

lignes = []
def dire(s):
    lignes.append(str(s))
    unreal.log("[NARVOS] " + str(s))


monde = unreal.EditorLevelLibrary.get_editor_world()
dire("persistant : %s" % monde.get_path_name())

# ── Les sous-niveaux montes ──────────────────────────────────────────────────
#
# `streaming_levels` n'est pas toujours lisible en Python selon la version. On
# essaie, et on dit ce qu'on n'a pas pu lire — plutot que de rendre une liste
# vide qui passerait pour « aucun sous-niveau ».
montes = []
erreur = None
try:
    flux = monde.get_editor_property("streaming_levels") or []
    for s in flux:
        try:
            wa = s.get_editor_property("world_asset")
            t = s.get_editor_property("level_transform").translation
            montes.append((str(wa), (t.x, t.y, t.z), s.get_class().get_name()))
        except Exception as e:
            montes.append((("(illisible: %s)" % str(e)[:40]), (0, 0, 0), "?"))
except Exception as e:
    erreur = str(e)[:120]

dire("")
if erreur:
    dire("streaming_levels ILLISIBLE : %s" % erreur)
    dire("  -> on ne conclut PAS qu'il n'y a aucun sous-niveau.")
else:
    dire("=== %d SOUS-NIVEAU(X) MONTE(S) ===" % len(montes))
    for chemin, t, classe in montes:
        court = chemin.split("/")[-1].replace("'", "").replace('"', "")
        dire("  %-36s (%.0f, %.0f, %.0f)  %s" % (court[:36], t[0], t[1], t[2], classe))
    if not montes:
        dire("  (aucun — les 4 mondes ne sont donc PAS des streaming levels ici)")

# Repli : les niveaux du monde, vus autrement.
try:
    niveaux = monde.get_editor_property("levels") or []
    dire("")
    dire("=== World.levels : %d ===" % len(niveaux))
    for l in niveaux:
        dire("  %s" % l.get_outer().get_name())
except Exception as e:
    dire("(World.levels illisible : %s)" % str(e)[:60])

# ── Tous les niveaux promus sous Narvos ──────────────────────────────────────
noms_montes = " ".join(c for c, _, _ in montes)
registre = unreal.AssetRegistryHelpers.get_asset_registry()
mondes = sorted(str(d.package_name)
                for d in registre.get_assets_by_path("/Game/Narvos", recursive=True)
                if str(d.asset_class_path.asset_name) == "World")

dire("")
dire("=== %d NIVEAU(X) sous /Game/Narvos ===" % len(mondes))
dire("%-7s %-34s %s" % ("ETAT", "NIVEAU", "CHEMIN"))
dire("-" * 96)
for m in mondes:
    court = m.split("/")[-1]
    etat = "MONTE" if court in noms_montes else "-"
    dire("%-7s %-34s %s" % (etat, court[:34], m))

io.open(RAPPORT, "w", encoding="utf-8").write(chr(10).join(lignes))
unreal.log("[NARVOS] ecrit : " + RAPPORT)