# [recupere de l'historique : ecrit le 2026-09-06T11:28:57Z sous le nom _map_overview.py, lance dans l'editeur par ue-remote.py]
import unreal, json, io
OUT = r"C:/Users/aniss/AppData/Local/Temp/claude/promo3.json"
eal = unreal.EditorAssetLibrary
res = {}
src, dst = "/Game/SpaceScenes/Maps/Map_Overview", "/Game/Narvos/SpaceScenes/Maps/Map_Overview"
# Le rename d'un World deja charge echoue sans message. Le dupliquer puis
# supprimer l'original fait le meme travail et n'exige pas de le decharger.
try:
    res["duplique"] = bool(eal.duplicate_asset(src, dst))
except Exception as e:
    res["duplique"] = "ERR " + str(e)[:200]
res["cible_existe"] = eal.does_asset_exist(dst)
if res["cible_existe"]:
    try:
        eal.save_asset(dst, only_if_is_dirty=False)
        res["supprime_source"] = bool(eal.delete_asset(src))
    except Exception as e:
        res["supprime_source"] = "ERR " + str(e)[:200]
# Fix up des redirecteurs restants
outils = unreal.AssetToolsHelpers.get_asset_tools()
reg = unreal.AssetRegistryHelpers.get_asset_registry()
reg.search_all_assets(True)
redirs = [unreal.load_asset(str(d.package_name)) for d in reg.get_assets_by_path("/Game/SpaceScenes", recursive=True)
          if str(d.asset_class_path.asset_name) == "ObjectRedirector"]
redirs = [r for r in redirs if r]
res["redirecteurs"] = len(redirs)
try:
    if redirs: outils.fixup_referencers(redirs, True, unreal.RedirectFixupMode.DELETE_DEST_UASSET_FILES)
except Exception as e:
    try:
        if redirs: outils.fixup_referencers(redirs)
        res["fixup"] = "simple"
    except Exception as e2:
        res["fixup"] = "ERR " + str(e2)[:160]
reg.search_all_assets(True)
res["restants"] = len(list(reg.get_assets_by_path("/Game/SpaceScenes", recursive=True)))
io.open(OUT,"w",encoding="utf-8").write(json.dumps(res, indent=1, ensure_ascii=False))
