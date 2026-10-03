import unreal,json,traceback,time
from pathlib import Path
root=Path('E:/narvosprime-web-prototype')
plan=json.loads((root/'.hermes/ASTRA_city_resave_plan_20260915.json').read_text(encoding='utf-8'))
out={'ok':False,'saved':[],'errors':[],'unresolved':[]}
file=root/'.hermes/ASTRA_city_resave_resultat_20260915.json'
def flush():file.write_text(json.dumps(out,indent=2),encoding='utf-8')
try:
 reg=unreal.AssetRegistryHelpers.get_asset_registry();reg.search_all_assets(True)
 # Charger d'abord les cibles exactes : les redirects sont lus au demarrage.
 for row in plan['mapping']:
  a=unreal.load_asset(row['old']);assert a and a.get_path_name().split('.')[0]==row['new'],row
 out['redirects_valides']=len(plan['mapping']);flush()
 for row in plan['assets']:
  p=row['package']
  try:
   a=unreal.load_asset(p);assert a,p
   if isinstance(a,unreal.World):ok=unreal.EditorLoadingAndSavingUtils.save_map(a,p)
   else:ok=unreal.EditorAssetLibrary.save_loaded_asset(a,only_if_is_dirty=False)
   assert ok,p
   out['saved'].append(p)
  except Exception:out['errors'].append({'path':p,'error':traceback.format_exc()})
  if len(out['saved'])%10==0:flush()
 opts=unreal.AssetRegistryDependencyOptions(include_soft_package_references=False,include_hard_package_references=True)
 oldnames={x['old'] for x in plan['mapping']}
 for p in out['saved']:
  for dep in reg.get_dependencies(p,opts) or []:
   if str(dep) in oldnames:out['unresolved'].append({'source':p,'dependency':str(dep)})
 out['ok']=not out['errors'] and not out['unresolved'] and len(out['saved'])==len(plan['assets'])
except Exception:out['errors'].append({'error':traceback.format_exc()})
finally:flush();print('ASTRA_CITY_RESAVE',out['ok'],len(out['saved']),len(out['errors']),len(out['unresolved']))