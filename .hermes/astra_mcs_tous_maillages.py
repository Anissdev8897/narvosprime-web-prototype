import unreal,json,traceback,re
from pathlib import Path
root=Path('E:/narvosprime-web-prototype');r={'checks':[],'errors':[]}
def path(o):return o.get_path_name() if o else None
try:
 ar=unreal.AssetRegistryHelpers.get_asset_registry()
 catalog=(root/'WebPortal/Server/nanos_world/packages/narvos/Shared/Catalogs/MetaCustom.lua').read_text(encoding='utf-8')
 for data in ar.get_assets_by_path('/Game/Narvos/MetaCustom/Skeletal_Meshes',recursive=True):
  if str(data.asset_class_path.asset_name)!='SkeletalMesh':continue
  mesh=data.get_asset()
  r['checks'].append({'id':str(data.package_name).split('/')[-2]+'/'+str(data.asset_name),'mesh':path(mesh),'catalogued':path(mesh) in catalog,'slots':[{'slot':str(s.get_editor_property('material_slot_name')),'imported_slot':str(s.get_editor_property('imported_material_slot_name')),'material':path(s.get_editor_property('material_interface'))} for s in mesh.get_editor_property('materials')]})
except Exception:r['errors'].append(traceback.format_exc())
finally:(root/'.hermes/ASTRA_mcs_tous_maillages.json').write_text(json.dumps(r,indent=2),encoding='utf-8')