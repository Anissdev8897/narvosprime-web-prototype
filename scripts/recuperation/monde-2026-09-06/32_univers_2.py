# [recupere de l'historique : ecrit le 2026-09-06T11:40:28Z sous le nom _univers_2.py, lance dans l'editeur par ue-remote.py]
# Etape 2 : renommer les quatre mondes sous /Game/Narvos/Maps.
# Les noms d'exemple du pack ne disent rien du jeu ; ceux-ci correspondent aux
# `id` de Shared/Catalogs/Mondes.lua (forge, tower, orbital) plus `alien`.
import unreal, json, io
OUT = r"C:/Users/aniss/AppData/Local/Temp/claude/univers2.json"
eal = unreal.EditorAssetLibrary
B = "/Game/Narvos/MWLandscapeAutoMaterial/Maps/LandscapeAutoMaterial_"
PAIRES = [
    (B + "MountainRange_Example", "/Game/Narvos/Maps/Map_Forge"),
    (B + "Desert_Example",        "/Game/Narvos/Maps/Map_Tower"),
    (B + "Island_Example",        "/Game/Narvos/Maps/Map_Alien"),
    ("/Game/Narvos/SpaceScenes/Maps/Map_Overview", "/Game/Narvos/Maps/Map_Orbital"),
]
res = []
for src, dst in PAIRES:
    d = {"src": src, "dst": dst}
    if eal.does_asset_exist(dst):
        d["etat"] = "cible existe deja"
    elif not eal.does_asset_exist(src):
        d["etat"] = "source absente"
    else:
        try:
            d["rename"] = bool(eal.rename_asset(src, dst))
        except Exception as e:
            d["rename"] = "ERR " + str(e)[:160]
        if not d.get("rename"):
            # repli eprouve : dupliquer puis supprimer (un World charge refuse le rename)
            try:
                d["duplique"] = bool(eal.duplicate_asset(src, dst))
                if d["duplique"]:
                    eal.save_asset(dst, only_if_is_dirty=False)
                    d["supprime"] = bool(eal.delete_asset(src))
            except Exception as e:
                d["duplique"] = "ERR " + str(e)[:160]
        d["etat"] = "OK" if eal.does_asset_exist(dst) else "ECHEC"
    res.append(d)
io.open(OUT,"w",encoding="utf-8").write(json.dumps(res, indent=1, ensure_ascii=False))
