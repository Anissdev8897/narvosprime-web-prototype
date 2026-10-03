import unreal,json,collections
from pathlib import Path
root=Path('E:/narvosprime-web-prototype')
reg=unreal.AssetRegistryHelpers.get_asset_registry()
# Les neuf meshes et deux ABP ont change depuis le cache initial.
modified=[x['mesh'].split('.')[0] for x in json.loads((root/'.hermes/ASTRA_mcs_postprocess_resultat_20260915.json').read_text())['meshes']]
modified+=['/Game/Narvos/PontMetaHuman/ABP_NarvosPersonnalisation'+s for s in ['Corps','Visage']]
reg.scan_modified_asset_files([str(root/'WebPortal/Server/adk/Content'/((p.removeprefix('/Game/'))+'.uasset')) for p in modified])
opts=unreal.AssetRegistryDependencyOptions(include_soft_package_references=False,include_hard_package_references=True)
start='/Game/Narvos/PontMetaHuman/BP_NarvosMH_F'
q=collections.deque([start]);parents={start:None};paths=[]
while q:
 p=q.popleft()
 if p.endswith('/BP_Meta_Styler') or p.endswith('/AnimBP_Face_Tool') or p.endswith('/AnimBP_Body_Tool1'):
  chain=[];n=p
  while n:chain.insert(0,n);n=parents[n]
  paths.append(chain)
 for d in reg.get_dependencies(p,opts) or []:
  d=str(d)
  if d.startswith('/Game/Narvos/') and d not in parents:parents[d]=p;q.append(d)
(root/'.hermes/ASTRA_dependances_chemins_20260915.json').write_text(json.dumps({'paths':paths,'count':len(parents)},indent=2),encoding='utf-8')
print('DEPENDANCES',len(parents),len(paths))