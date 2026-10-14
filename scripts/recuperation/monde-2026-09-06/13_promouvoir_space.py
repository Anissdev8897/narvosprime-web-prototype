# [recupere de l'historique : ecrit le 2026-09-06T11:24:11Z sous le nom _promouvoir_space.py, lance dans l'editeur par ue-remote.py]
# /Game/SpaceScenes -> /Game/Narvos/SpaceScenes, un asset a la fois.
# rename_directory MENT (True sur un dossier vide) et rename_assets TUE le
# commandlet : seul rename_asset par asset est fiable ici. Recomptage a la fin,
# le seul controle qui prouve quelque chose.
import unreal, json, io
OUT = r"C:/Users/aniss/AppData/Local/Temp/claude/promo_space.json"
SRC, DST = "/Game/SpaceScenes", "/Game/Narvos/SpaceScenes"
eal = unreal.EditorAssetLibrary
reg = unreal.AssetRegistryHelpers.get_asset_registry()
reg.search_all_assets(True)

a_faire = []
for d in reg.get_assets_by_path(SRC, recursive=True):
    p = str(d.package_name)
    cible = DST + p[len(SRC):]
    if eal.does_asset_exist(cible): continue
    a_faire.append((p, cible))

faits, rates, erreurs = 0, 0, []
for p, cible in a_faire:
    try:
        if eal.rename_asset(p, cible): faits += 1
        else:
            rates += 1
            if len(erreurs) < 15: erreurs.append("ECHEC " + p)
    except Exception as e:
        rates += 1
        if len(erreurs) < 15: erreurs.append("ERR %s : %s" % (p, str(e)[:120]))

reg.search_all_assets(True)
arrives = sum(1 for _, c in a_faire if eal.does_asset_exist(c))
restes = sum(1 for p, _ in a_faire if eal.does_asset_exist(p))
io.open(OUT, "w", encoding="utf-8").write(json.dumps(
    {"a_faire": len(a_faire), "faits": faits, "rates": rates,
     "arrives": arrives, "restes_a_la_source": restes, "erreurs": erreurs},
    indent=1, ensure_ascii=False))
