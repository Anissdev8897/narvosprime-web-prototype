import unreal,json,traceback
from pathlib import Path
root=Path('E:/narvosprime-web-prototype');out={'ok':False,'missing':[],'outside':[],'count':0}
try:
 bindings=json.loads((root/'WebPortal/Server/adk/_manifests/metacustom-liaisons.json').read_text());assert bindings['ok']
 roots=['/Game/Narvos/PontMetaHuman/BP_NarvosMH_M','/Game/Narvos/PontMetaHuman/BP_NarvosMH_F']
 roots+=list({v['liaison'].split('.')[0] for values in bindings['grooms'].values() for v in values.values()});out['roots']=roots
 reg=unreal.AssetRegistryHelpers.get_asset_registry()
 reg.scan_modified_asset_files([str(root/'WebPortal/Server/adk/Content'/((p.removeprefix('/Game/'))+'.uasset')) for p in roots])
 opts=unreal.AssetRegistryDependencyOptions(include_soft_package_references=True,include_hard_package_references=True)
 pending=list(roots);seen=set()
 while pending:
  p=pending.pop()
  if p in seen:continue
  seen.add(p)
  if not reg.get_assets_by_package_name(p):out['missing'].append(p);continue
  for dep in reg.get_dependencies(p,opts) or []:
   dep=str(dep)
   if dep.startswith('/Game/'):
    if not dep.startswith('/Game/Narvos/'):out['outside'].append({'from':p,'dep':dep})
    pending.append(dep)
 out['count']=len(seen);out['ok']=not out['missing'] and not out['outside']
 exec((root/'scripts/adk-dump-assets.py').read_text(encoding='utf8'))
except Exception:out['error']=traceback.format_exc()
(root/'.hermes/ASTRA_mcs_lot6_dependances_20260915.json').write_text(json.dumps(out,indent=2),encoding='utf8')