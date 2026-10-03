import unreal,json,traceback
from pathlib import Path
root=Path('E:/narvosprime-web-prototype')
out={'ok':False,'missing':[],'outside_pack':[],'assets':[]}
try:
 reg=unreal.AssetRegistryHelpers.get_asset_registry()
 roots=['/Game/Narvos/Maps/Map_Narvos','/Game/Narvos/PontMetaHuman/BP_NarvosMH_M','/Game/Narvos/PontMetaHuman/BP_NarvosMH_F']
 roots += [x['bp'].split('.')[0] for x in json.loads((root/'.hermes/ASTRA_spaceships_assemblages_20260915.json').read_text(encoding='utf-8'))['assemblages']]
 roots += [x['mesh'].split('.')[0] for x in json.loads((root/'.hermes/ASTRA_mcs_work_reparation_20260915.json').read_text(encoding='utf-8'))['changes']]
 out['roots']=sorted(set(roots))
 opts=unreal.AssetRegistryDependencyOptions(include_soft_package_references=True,include_hard_package_references=True)
 pending=list(roots);seen=set()
 while pending:
  p=pending.pop()
  if p in seen:continue
  seen.add(p)
  rows=reg.get_assets_by_package_name(p)
  if not rows:out['missing'].append({'source':None,'dependency':p});continue
  out['assets'].append({'package':p,'classes':[str(d.asset_class_path.asset_name) for d in rows]})
  for dep in reg.get_dependencies(p,opts) or []:
   dep=str(dep)
   if not dep.startswith('/Game/'):continue
   if not reg.get_assets_by_package_name(dep):out['missing'].append({'source':p,'dependency':dep});continue
   if not dep.startswith('/Game/Narvos/'):out['outside_pack'].append({'source':p,'dependency':dep})
   pending.append(dep)
 out['ok']=not out['missing'] and not out['outside_pack']
 out['dirty_maps']=[x.get_name() for x in unreal.EditorLoadingAndSavingUtils.get_dirty_map_packages()]
 out['dirty_assets']=[x.get_name() for x in unreal.EditorLoadingAndSavingUtils.get_dirty_content_packages()]
except Exception:out['error']=traceback.format_exc()
(root/'.hermes/ASTRA_livraison_dependances_20260915.json').write_text(json.dumps(out,indent=2),encoding='utf-8')
print('Dependances',out['ok'],len(out['assets']),len(out['missing']),len(out['outside_pack']),out.get('error',''))