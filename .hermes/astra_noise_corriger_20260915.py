import unreal,json,shutil,traceback,hashlib
from pathlib import Path
root=Path('E:/narvosprime-web-prototype');out={'ok':False,'nodes':[]}
try:
 old=json.loads((root/'.hermes/ASTRA_noise_et_rigs_sonde_20260915.json').read_text())['noise']
 assert len(old)==2 and all(x['input_names']==['World Position'] for x in old)
 path='/Game/Narvos/CITY_PACK/BIG_CITY/MATERIALS/M_Fake_Interior2'
 asset=root/'WebPortal/Server/adk/Content/Narvos/CITY_PACK/BIG_CITY/MATERIALS/M_Fake_Interior2.uasset'
 backup=root/'.hermes/sauvegardes/city-noise-20260915.uasset'
 if backup.exists():assert hashlib.sha256(asset.read_bytes()).digest()==hashlib.sha256(backup.read_bytes()).digest(),'Asset change depuis sauvegarde'
 else:shutil.copyfile(asset,backup)
 mat=unreal.load_asset(path);mel=unreal.MaterialEditingLibrary
 nodes={n.get_name():n for n in unreal.ObjectIterator(unreal.MaterialExpressionVectorNoise) if n.get_path_name().startswith(mat.get_path_name()+':')}
 for row in old:
  n=nodes[row['node']];inputs=mel.get_inputs_for_material_expression(mat,n)
  assert len(inputs)==1 and inputs[0].get_name()==row['inputs'][0]['name']
  source=inputs[0];x,y=mel.get_material_expression_node_position(n)
  mask=mel.create_material_expression(mat,unreal.MaterialExpressionComponentMask,x-180,y-100);assert mask
  for key,value in [('r',True),('g',True),('b',True),('a',False)]:mask.set_editor_property(key,value)
  mask_inputs=mel.get_material_expression_input_names(mask);assert len(mask_inputs)==1
  assert mel.connect_material_expressions(source,row['inputs'][0]['output_name'],mask,mask_inputs[0])
  assert mel.connect_material_expressions(mask,'',n,'World Position')
  assert mel.get_inputs_for_material_expression(mat,n)[0]==mask
  assert mel.get_inputs_for_material_expression(mat,mask)[0]==source
  out['nodes'].append({'noise':n.get_name(),'source':source.get_name(),'mask':mask.get_name(),'channels':'RGB'})
 mel.recompile_material(mat);assert unreal.EditorAssetLibrary.save_loaded_asset(mat,False)
 out['ok']=True
except Exception:out['error']=traceback.format_exc()
(root/'.hermes/ASTRA_noise_correction_20260915.json').write_text(json.dumps(out,indent=2),encoding='utf-8')
print('NOISE_CORRECTION',out['ok'],out.get('error',''))
if out['ok']:
 exec((root/'.hermes/astra_noise_et_rigs_sonde_20260915.py').read_text(encoding='utf-8'))