"""Audit des dépendances directes des maps recensées, sans ouvrir ni sauver de niveau."""
import unreal,json,traceback
from pathlib import Path
root=Path('E:/narvosprime-web-prototype')
maps=json.loads((root/'.hermes/ASTRA_maps_registry.json').read_text())
ar=unreal.AssetRegistryHelpers.get_asset_registry()
opts=unreal.AssetRegistryDependencyOptions(include_soft_package_references=True,include_hard_package_references=True,include_searchable_names=False,include_soft_management_references=False,include_hard_management_references=False)
r={'maps':[],'errors':[]}
try:
 for entry in maps:
  package=entry['package']
  deps=[str(d) for d in ar.get_dependencies(package,opts) or []]
  missing=[d for d in deps if d.startswith('/Game/') and not ar.get_assets_by_package_name(d)]
  r['maps'].append({'package':package,'dependencies':deps,'missing_game_dependencies':missing})
except Exception:r['errors'].append(traceback.format_exc())
(root/'.hermes/ASTRA_maps_dependencies.json').write_text(json.dumps(r,ensure_ascii=False,indent=2),encoding='utf-8')