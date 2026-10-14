# [recupere de l'historique : ecrit le 2026-09-06T11:43:53Z sous le nom _univers_3.py, lance dans l'editeur par ue-remote.py]
# Etape 3 : monter les quatre mondes en SOUS-NIVEAUX de Map_Narvos, decales.
#
# ── POURQUOI DES SOUS-NIVEAUX ET PAS UNE FUSION ───────────────────────────────
# Un Landscape ne se copie pas d'un niveau a l'autre (LandscapeInfo, proxies,
# GUID). Le sous-niveau est la seule voie qui le garde intact, et il porte sa
# propre transform : decaler le monde ne touche a aucun asset.
#
# ── POURQUOI DES SOUS-NIVEAUX *DYNAMIQUES* ────────────────────────────────────
# `Level.LoadStreamLevel` / `SetStreamLevelVisibility` de nanos sont d'autorite
# CLIENT : chaque joueur pilote son propre streaming. Un sous-niveau ALWAYS_LOADED
# ne repondrait a rien. On pose donc du LevelStreamingDynamic, charge et visible
# au demarrage — ce qui donne les deux comportements a la fois.
#
# ── LES DECALAGES ─────────────────────────────────────────────────────────────
# Chaque landscape fait 2 016 m, ses montagnes de fond portent l'emprise a 10 km.
# L'orbital, lui, occupe deja +-1 km autour de l'origine (et jusqu'a 266 km pour
# ses planetes lointaines). 80 km separent donc l'orbital des planetes, et 20 km
# separent les planetes entre elles.
import unreal, json, io
OUT = r"C:/Users/aniss/AppData/Local/Temp/claude/univers3.json"
M = [
    ("/Game/Narvos/Maps/Map_Orbital", (0.0, 0.0, 0.0)),
    ("/Game/Narvos/Maps/Map_Forge",   (-8000000.0, 0.0, 0.0)),
    ("/Game/Narvos/Maps/Map_Tower",   (-8000000.0, 2000000.0, 0.0)),
    ("/Game/Narvos/Maps/Map_Alien",   (-8000000.0, 4000000.0, 0.0)),
]
res = {"monde": unreal.EditorLevelLibrary.get_editor_world().get_name(), "ajouts": []}
if res["monde"] != "Map_Narvos":
    res["arret"] = "Map_Narvos n'est pas ouvert"
else:
    w = unreal.EditorLevelLibrary.get_editor_world()
    for chemin, (x, y, z) in M:
        d = {"niveau": chemin, "decalage": [x, y, z]}
        t = unreal.Transform(unreal.Vector(x, y, z), unreal.Rotator(), unreal.Vector(1, 1, 1))
        try:
            ls = unreal.EditorLevelUtils.add_level_to_world_with_transform(
                w, chemin, unreal.LevelStreamingDynamic, t)
            d["ajoute"] = bool(ls)
            if ls:
                ls.set_editor_property("should_be_loaded", True)
                ls.set_editor_property("should_be_visible", True)
                d["transform"] = [ls.get_editor_property("level_transform").translation.x,
                                  ls.get_editor_property("level_transform").translation.y,
                                  ls.get_editor_property("level_transform").translation.z]
        except Exception as e:
            d["ajoute"] = "ERR " + str(e)[:220]
        res["ajouts"].append(d)
    unreal.EditorLevelUtils.make_level_current(unreal.EditorLevelLibrary.get_editor_world().persistent_level)
    unreal.get_editor_subsystem(unreal.LevelEditorSubsystem).save_all_dirty_levels()
    res["sous_niveaux"] = [str(l.get_outer().get_name()) for l in unreal.EditorLevelUtils.get_levels(w)]
io.open(OUT,"w",encoding="utf-8").write(json.dumps(res, indent=1, ensure_ascii=False))
