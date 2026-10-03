import unreal,json,traceback
from pathlib import Path
root=Path('E:/narvosprime-web-prototype');out={'ok':False,'materials':[]}
try:
 plan=json.loads((root/'.hermes/ASTRA_city_materiaux_sources_20260915.json').read_text(encoding='utf-8'))
 for row in plan['assets']:
  if not row['restore']:continue
  mat=unreal.load_asset(row['new']);assert isinstance(mat,unreal.Material)
  record={'path':mat.get_path_name(),'textures':[],'functions':[]}
  for node in unreal.ObjectIterator(unreal.MaterialExpressionTextureSample):
   if not node.get_path_name().startswith(mat.get_path_name()+':'):continue
   texture=node.get_editor_property('texture');assert texture,node.get_path_name()
   record['textures'].append({'node':node.get_name(),'texture':texture.get_path_name(),'sampler':str(node.get_editor_property('sampler_type'))})
  for node in unreal.ObjectIterator(unreal.MaterialExpressionMaterialFunctionCall):
   if not node.get_path_name().startswith(mat.get_path_name()+':'):continue
   function=node.get_editor_property('material_function');assert function,node.get_path_name()
   record['functions'].append(function.get_path_name())
  assert record['textures'],'Sonde vide'
  assert unreal.EditorAssetLibrary.save_loaded_asset(mat,only_if_is_dirty=False)
  out['materials'].append(record)
 out['ok']=len(out['materials'])==5
except Exception:out['error']=traceback.format_exc()
(root/'.hermes/ASTRA_city_shader_validation_20260915.json').write_text(json.dumps(out,indent=2),encoding='utf-8')
print('CITY_SHADER_VALIDATION',out['ok'],out.get('error',''))