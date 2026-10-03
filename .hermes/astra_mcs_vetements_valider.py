import unreal,json,traceback
from pathlib import Path
root=Path('E:/narvosprime-web-prototype')
code=(root/'.hermes/astra_mcs_vetements_probe.py').read_text(encoding='utf-8').replace('ASTRA_mcs_vetements_probe.json','ASTRA_mcs_vetements_apres.json')
exec(code)
result=json.loads((root/'.hermes/ASTRA_mcs_vetements_apres.json').read_text(encoding='utf-8'))
try:
 assert not result['errors'] and len(result['checks'])==10
 assert all(row['leader']=='Body' for row in result['checks'])
 assert all(result['cleanup'])
 result['saved']=[]
 for sex in ('M','F'):
  bp=unreal.load_asset('/Game/Narvos/PontMetaHuman/BP_NarvosMH_'+sex)
  assert unreal.EditorAssetLibrary.save_loaded_asset(bp,only_if_is_dirty=False)
  result['saved'].append(bp.get_path_name())
 result['ok']=True
except Exception:result['ok']=False;result['errors'].append(traceback.format_exc())
(root/'.hermes/ASTRA_mcs_vetements_apres.json').write_text(json.dumps(result,indent=2),encoding='utf-8')