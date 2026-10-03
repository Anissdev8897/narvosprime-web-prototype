import unreal,json,traceback
from pathlib import Path
root=Path('E:/narvosprime-web-prototype');out={'ok':False,'materials':[]}
try:
 plan=json.loads((root/'.hermes/ASTRA_city_shader_lot2_plan_20260915.json').read_text())
 for row in plan['assets']:
  if not row['restore']:continue
  mat=unreal.load_asset(row['new']);assert isinstance(mat,unreal.Material)
  record={'path':mat.get_path_name(),'missing_textures':[],'missing_functions':[],'expressions':[]}
  for cls in [unreal.MaterialExpressionTextureSample,unreal.MaterialExpressionTextureObjectParameter,unreal.MaterialExpressionMaterialFunctionCall,unreal.MaterialExpressionVectorNoise]:
   for node in unreal.ObjectIterator(cls):
    if not node.get_path_name().startswith(mat.get_path_name()+':'):continue
    item={'name':node.get_name(),'class':node.get_class().get_name()}
    for prop in ['texture','material_function','position','parameter_name']:
     try:
      value=node.get_editor_property(prop)
      item[prop]=value.get_path_name() if isinstance(value,unreal.Object) else str(value)
      if prop=='texture' and value is None:record['missing_textures'].append(node.get_name())
      if prop=='material_function' and value is None:record['missing_functions'].append(node.get_name())
     except Exception:pass
    record['expressions'].append(item)
  assert unreal.EditorAssetLibrary.save_loaded_asset(mat,False)
  out['materials'].append(record)
 out['ok']=not any(x['missing_textures'] or x['missing_functions'] for x in out['materials'])
except Exception:out['error']=traceback.format_exc()
(root/'.hermes/ASTRA_city_shader_lot2_validation_20260915.json').write_text(json.dumps(out,indent=2),encoding='utf-8')
print('CITY_LOT2',out['ok'],len(out['materials']))