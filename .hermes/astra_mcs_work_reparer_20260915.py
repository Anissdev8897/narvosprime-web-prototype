import unreal,json,traceback,shutil
from pathlib import Path
root=Path('E:/narvosprime-web-prototype')
prefix='/Game/Narvos/MetaCustom'
out={'ok':False,'changes':[]}
try:
 target=prefix+'/Material/Inst_Set_3_Work_Suit'
 # Reprise de la creation non sauvegardee : le setter UE5.7 renvoie toujours
 # False (MaterialEditingLibrary.cpp:1187), meme quand la valeur est appliquee.
 # Un MIC sauvegarde seul peut provenir de l'etape precedente ; les meshes
 # doivent toujours etre identiques aux sauvegardes et leurs slots encore nuls.
 meshpaths=[prefix+'/Skeletal_Meshes/Metahuman_Tall_Medium_Female/'+n for n in ['SK_Set_3_Work_Top','SK_Set_3_Work_Skirt']]
 evidence=json.loads((root/'.hermes/ASTRA_mcs_material_imports.json').read_text(encoding='utf-8'))
 repairs=[]
 for p in meshpaths:
  mesh=unreal.load_asset(p); assert mesh
  row=next(x for x in evidence if x['mesh'].split('.')[0]==p)
  for i,s in enumerate(row['slots']):
   assert s['source_material'].endswith('/Inst_Set_3_Work_Suit.Inst_Set_3_Work_Suit')
   assert mesh.get_editor_property('materials')[i].material_interface is None
   repairs.append((mesh,i))
  file=root/'WebPortal/Server/adk/Content'/Path(p.replace('/Game/','')+'.uasset')
  backup=root/'.hermes/sauvegardes/mcs-work-20260915'/file.name
  backup.parent.mkdir(parents=True,exist_ok=True)
  if backup.exists(): assert backup.read_bytes()==file.read_bytes(),'Mesh modifie depuis la sauvegarde'
  else: shutil.copy2(file,backup)
 parent=unreal.load_asset(prefix+'/Material/Mat_Clothing_Master')
 assert isinstance(parent,unreal.Material)
 params={'Diffuse':'T_Work_BaseColor','Normal_Map':'T_Work_Normal','MetalRoughOcclusion':'T_Work_OcclusionRoughnessMetallic'}
 available=[str(x) for x in unreal.MaterialEditingLibrary.get_texture_parameter_names(parent)]
 assert set(params)<=set(available),(params,available)
 textures={k:unreal.load_asset(prefix+'/Textures/'+v) for k,v in params.items()}
 assert all(textures.values())
 out['textures']={k:{'path':v.get_path_name(),'srgb':v.get_editor_property('srgb'),'compression':str(v.get_editor_property('compression_settings'))} for k,v in textures.items()}
 assert textures['Diffuse'].get_editor_property('srgb')
 assert not textures['Normal_Map'].get_editor_property('srgb')
 # Conserver ici le contrat du parent fourni (sampler Color). Le pack a importe
 # son ORM en sRGB ; une conversion lineaire doit modifier ensemble texture et
 # sampler dans un parent dedie, jamais changer silencieusement le parent partage.
 mic=unreal.load_asset(target) if unreal.EditorAssetLibrary.does_asset_exist(target) else unreal.AssetToolsHelpers.get_asset_tools().create_asset('Inst_Set_3_Work_Suit',prefix+'/Material',unreal.MaterialInstanceConstant,unreal.MaterialInstanceConstantFactoryNew())
 unreal.MaterialEditingLibrary.set_material_instance_parent(mic,parent)
 for k,v in textures.items():
  unreal.MaterialEditingLibrary.set_material_instance_texture_parameter_value(mic,k,v)
  assert unreal.MaterialEditingLibrary.get_material_instance_texture_parameter_value(mic,k)==v,(k,'lecture differente')
 unreal.MaterialEditingLibrary.update_material_instance(mic)
 assert unreal.EditorAssetLibrary.save_loaded_asset(mic,only_if_is_dirty=False)
 for mesh,i in repairs:
  slots=mesh.get_editor_property('materials');slot=slots[i];slot.material_interface=mic;slots[i]=slot;mesh.set_editor_property('materials',slots)
  assert mesh.get_editor_property('materials')[i].material_interface==mic
  out['changes'].append({'mesh':mesh.get_path_name(),'slot':i,'material':mic.get_path_name()})
 for p in meshpaths:assert unreal.EditorAssetLibrary.save_asset(p,only_if_is_dirty=False)
 out['ok']=True
except Exception:out['error']=traceback.format_exc()
(root/'.hermes/ASTRA_mcs_work_reparation_20260915.json').write_text(json.dumps(out,indent=2),encoding='utf-8')
print(out['ok'],out.get('error',''))