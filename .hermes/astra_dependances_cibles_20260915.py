import unreal,json
from pathlib import Path
root=Path('E:/narvosprime-web-prototype')
previous=json.loads((root/'.hermes/ASTRA_livraison_dependances_20260915.json').read_text(encoding='utf-8'))
reg=unreal.AssetRegistryHelpers.get_asset_registry()
opts=unreal.AssetRegistryDependencyOptions(include_soft_package_references=False,include_hard_package_references=True)
out=[]
for p in previous['roots']:
 row={'root':p,'missing':[],'outside':[],'count':0};seen=set();pending=[p]
 while pending:
  source=pending.pop()
  if source in seen:continue
  seen.add(source)
  for dep in reg.get_dependencies(source,opts) or []:
   dep=str(dep)
   if not dep.startswith('/Game/') or dep.startswith('/Game/NanosWorld/'):continue
   if not reg.get_assets_by_package_name(dep):row['missing'].append({'source':source,'dep':dep});continue
   if not dep.startswith('/Game/Narvos/'):row['outside'].append({'source':source,'dep':dep})
   pending.append(dep)
 row['count']=len(seen);out.append(row)
(root/'.hermes/ASTRA_dependances_cibles_20260915.json').write_text(json.dumps(out,indent=2),encoding='utf-8')