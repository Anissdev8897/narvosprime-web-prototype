import unreal,json,traceback
from pathlib import Path
root=Path('E:/narvosprime-web-prototype');out={'ok':False,'parents':[]}
try:
 reg=unreal.AssetRegistryHelpers.get_asset_registry()
 opts=unreal.AssetRegistryDependencyOptions(include_hard_package_references=True,include_soft_package_references=False)
 for p in ['/Game/Narvos/CITY_PACK/INTERIORS/HOSPITAL/MATERIALS/M_Parent_Mat','/Game/Narvos/CITY_PACK/INTERIORS/SCI_FI_LABORATORY/Materials/M_Parent_Mat_Emmisive']:
  mat=unreal.load_asset(p);row={'path':p,'params':[],'instances':[],'other_referencers':[]};out['parents'].append(row)
  for n in unreal.ObjectIterator(unreal.MaterialExpressionTextureSampleParameter2D):
   if n.get_path_name().startswith(mat.get_path_name()+':'):
    texture=n.get_editor_property('texture')
    row['params'].append({'node':n.get_name(),'name':str(n.get_editor_property('parameter_name')),'texture':texture.get_path_name() if texture else None,'sampler':str(n.get_editor_property('sampler_type'))})
  for ref in reg.get_referencers(p,opts):
   for a in reg.get_assets_by_package_name(ref):
    if str(a.asset_class_path.asset_name)=='MaterialInstanceConstant':
     m=a.get_asset();t=unreal.MaterialEditingLibrary.get_material_instance_texture_parameter_value(m,'AO_Rough_Metal')
     row['instances'].append({'path':str(ref),'orm':t.get_path_name() if t else None,'srgb':bool(t.get_editor_property('srgb')) if t else None})
    else:row['other_referencers'].append({'path':str(ref),'class':str(a.asset_class_path.asset_name)})
 out['ok']=True
except Exception:out['error']=traceback.format_exc()
(root/'.hermes/ASTRA_city_orm_sonde_20260915.json').write_text(json.dumps(out,indent=2),encoding='utf-8')
print('ORM_SONDE',out['ok'])