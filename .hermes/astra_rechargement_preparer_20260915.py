import unreal,json,hashlib
from pathlib import Path
root=Path('E:/narvosprime-web-prototype')
cleanup=json.loads((root/'.hermes/ASTRA_preview_nettoyage_20260915.json').read_text())
assert not cleanup['remaining'] and not cleanup['dirty_assets']
plan=json.loads((root/'.hermes/ASTRA_city_resave_plan_20260915.json').read_text())
entry=next(x for x in plan['assets'] if x['package']=='/Game/Narvos/Maps/Map_Narvos')
mapfile=root/'WebPortal/Server/adk/Content/Narvos/Maps/Map_Narvos.umap'
assert hashlib.sha256(mapfile.read_bytes()).hexdigest()==entry['sha256']
# Le seul changement non sauvegarde est le cycle creation/suppression de nos
# deux acteurs transitoires. Recharger une map neutre sans sauvegarder cet etat.
w=unreal.EditorLoadingAndSavingUtils.load_map('/Game/NanosWorld/Maps/NanosWorldEntryMap')
assert w
out={'world':w.get_path_name(),'dirty_maps':[x.get_name() for x in unreal.EditorLoadingAndSavingUtils.get_dirty_map_packages()],'dirty_assets':[x.get_name() for x in unreal.EditorLoadingAndSavingUtils.get_dirty_content_packages()]}
(root/'.hermes/ASTRA_rechargement_pret_20260915.json').write_text(json.dumps(out,indent=2))