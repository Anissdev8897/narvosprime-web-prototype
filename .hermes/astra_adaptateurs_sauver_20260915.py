import unreal,json,traceback
from pathlib import Path
r={'ok':False,'saved':[]}
try:
 for suffix in ['Corps','Visage']:
  a=unreal.load_asset('/Game/Narvos/PontMetaHuman/ABP_NarvosPersonnalisation'+suffix)
  assert unreal.EditorAssetLibrary.save_loaded_asset(a,False)
  r['saved'].append(a.get_path_name())
 r['dirty_maps']=[x.get_name() for x in unreal.EditorLoadingAndSavingUtils.get_dirty_map_packages()]
 r['dirty_assets']=[x.get_name() for x in unreal.EditorLoadingAndSavingUtils.get_dirty_content_packages()]
 r['ok']=not r['dirty_maps'] and not r['dirty_assets']
except Exception:r['error']=traceback.format_exc()
Path('E:/narvosprime-web-prototype/.hermes/ASTRA_adaptateurs_sauves_20260915.json').write_text(json.dumps(r,indent=2),encoding='utf-8')
print('ADAPTATEURS_SAUVES',r['ok'])