import unreal,json,traceback
from pathlib import Path
root=Path('E:/narvosprime-web-prototype')
out={'ok':False,'mapping':[],'copied':[]}
try:
 report=json.loads((root/'.hermes/ASTRA_dependances_cibles_20260915.json').read_text(encoding='utf-8'))[0]
 originals=sorted(set(x['dep'] for x in report['missing']+report['outside']))
 plan=[]
 for old in originals:
  assert old.startswith(('/Game/CITY_PACK/','/Game/City_Traffic_Pro/')),old
  usual=old.replace('/Game/','/Game/Narvos/',1)
  if unreal.EditorAssetLibrary.does_asset_exist(usual):
   plan.append((old,usual,False));continue
  assert '/DEMO/' in old or '/Demo/' in old,old
  new=old.replace('/Game/','/Game/Narvos/DependancesVille/',1)
  assert not unreal.EditorAssetLibrary.does_asset_exist(new),'Deja copie : verifier avant relance '+new
  obj=unreal.load_asset(old);assert obj,old
  assert not isinstance(obj,unreal.World),'Ne pas dupliquer une map'
  plan.append((old,new,True))
 for old,new,copy in plan:
  if copy:
   obj=unreal.AssetToolsHelpers.get_asset_tools().duplicate_asset(new.rsplit('/',1)[1],new.rsplit('/',1)[0],unreal.load_asset(old))
   assert obj and obj.get_path_name().split('.')[0]==new
   assert unreal.EditorAssetLibrary.save_loaded_asset(obj,only_if_is_dirty=False)
   out['copied'].append(new)
  out['mapping'].append({'old':old,'new':new})
 out['ok']=True
except Exception:out['error']=traceback.format_exc()
(root/'.hermes/ASTRA_city_dependances_preparation_20260915.json').write_text(json.dumps(out,indent=2),encoding='utf-8')
print(out['ok'],len(out['mapping']),len(out['copied']),out.get('error',''))