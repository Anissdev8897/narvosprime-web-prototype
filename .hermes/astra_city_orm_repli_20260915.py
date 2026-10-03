"""Repli de donnees PBR, pas une reconstitution des textures source absentes.
AO=1, roughness=0.5, metallic=0. Deux parents seulement, overrides conserves.
"""
import unreal,json,traceback,shutil
from pathlib import Path
root=Path('E:/narvosprime-web-prototype');out={'ok':False,'parents':[]}
try:
 report=json.loads((root/'.hermes/ASTRA_city_orm_sonde_20260915.json').read_text());assert report['ok']
 dest='/Game/Narvos/TechDefaults/T_ORM_Neutre'
 # L'import Interchange initial a sauvegarde cette texture avant une assertion
 # Slate en commandlet. Reprendre uniquement cet import dont la source est connue.
 if not unreal.EditorAssetLibrary.does_asset_exist(dest):
  task=unreal.AssetImportTask();task.filename=str(root/'.hermes/generated/T_ORM_Neutre.png')
  task.destination_path='/Game/Narvos/TechDefaults';task.destination_name='T_ORM_Neutre';task.automated=True;task.replace_existing=False;task.save=True
  unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
 texture=unreal.load_asset(dest);assert isinstance(texture,unreal.Texture2D)
 filenames=texture.get_editor_property('asset_import_data').extract_filenames()
 assert len(filenames)==1 and Path(filenames[0]).resolve()==(root/'.hermes/generated/T_ORM_Neutre.png').resolve()
 texture.set_editor_property('srgb',False)
 texture.set_editor_property('compression_settings',unreal.TextureCompressionSettings.TC_DEFAULT)
 assert unreal.EditorAssetLibrary.save_loaded_asset(texture,False)
 backup=root/'.hermes/sauvegardes/city-orm-repli-20260915';backup.mkdir(parents=True,exist_ok=False)
 for i,row in enumerate(report['parents']):
  mat=unreal.load_asset(row['path'])
  source=root/'WebPortal/Server/adk/Content'/(row['path'].removeprefix('/Game/')+'.uasset')
  shutil.copyfile(source,backup/(str(i)+'-'+source.name))
  nodes=[n for n in unreal.ObjectIterator(unreal.MaterialExpressionTextureSampleParameter2D) if n.get_path_name().startswith(mat.get_path_name()+':') and str(n.get_editor_property('parameter_name'))=='AO_Rough_Metal']
  assert len(nodes)==1 and nodes[0].get_editor_property('texture') is None
  assert nodes[0].get_editor_property('sampler_type')==unreal.MaterialSamplerType.SAMPLERTYPE_LINEAR_COLOR
  nodes[0].set_editor_property('texture',texture)
  assert nodes[0].get_editor_property('texture')==texture
  unreal.MaterialEditingLibrary.recompile_material(mat)
  assert unreal.EditorAssetLibrary.save_loaded_asset(mat,False)
  checks=[]
  for child in row['instances']:
   m=unreal.load_asset(child['path']);actual=unreal.MaterialEditingLibrary.get_material_instance_texture_parameter_value(m,'AO_Rough_Metal')
   expected=child['orm'] or texture.get_path_name()
   assert actual and actual.get_path_name()==expected,child['path']
   checks.append({'instance':child['path'],'orm':actual.get_path_name(),'fallback':child['orm'] is None})
  out['parents'].append({'path':row['path'],'instances':checks})
 out['fallback_asset']=texture.get_path_name();out['source_texture_restored']=False;out['ok']=True
except Exception:out['error']=traceback.format_exc()
(root/'.hermes/ASTRA_city_orm_repli_20260915.json').write_text(json.dumps(out,indent=2),encoding='utf-8')
print('ORM_REPLI',out['ok'],out.get('error',''))