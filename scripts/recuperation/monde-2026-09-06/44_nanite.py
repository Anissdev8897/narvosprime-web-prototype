# [recupere de l'historique : ecrit le 2026-09-06T12:06:07Z sous le nom _nanite.py, lance dans l'editeur par ue-remote.py]
# Nanite sur le decor spatial. Mesure : 0 des 48 meshes de SpaceScenes l'avait.
#
# ⚠ SEULEMENT `/Scenery/`. `/Effects/` porte des plans de FX (GodRay, lightning,
# Sphere_NoCol) et des meshes d'emetteur de particules : Nanite ne s'applique pas
# a de la translucidite, et un mesh de particules n'est pas rendu comme un mesh.
import unreal, json, io
OUT = r"C:/Users/aniss/AppData/Local/Temp/claude/nanite.json"
reg = unreal.AssetRegistryHelpers.get_asset_registry()
eal = unreal.EditorAssetLibrary
faits, sautes, erreurs = [], [], []
for a in reg.get_assets_by_path("/Game/Narvos/SpaceScenes", recursive=True):
    if str(a.asset_class_path.asset_name) != "StaticMesh": continue
    p = str(a.package_name)
    if "/Scenery/" not in p:
        sautes.append(str(a.asset_name)); continue
    sm = eal.load_asset(p)
    if not sm: continue
    try:
        ns = sm.get_editor_property("nanite_settings")
        if ns.enabled:
            sautes.append(str(a.asset_name)); continue
        ns.enabled = True
        sm.set_editor_property("nanite_settings", ns)
        unreal.StaticMeshEditorSubsystem  # presence
        eal.save_asset(p, only_if_is_dirty=False)
        faits.append(str(a.asset_name))
    except Exception as e:
        erreurs.append([str(a.asset_name), str(e)[:120]])
io.open(OUT,"w",encoding="utf-8").write(json.dumps(
    {"actives": len(faits), "sautes": len(sautes), "erreurs": erreurs[:8],
     "liste": faits[:50]}, indent=1, ensure_ascii=False))
