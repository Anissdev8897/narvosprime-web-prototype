"""Restaure seulement les parents prouvés par les instances sources intactes."""
import unreal,json,traceback,shutil,hashlib,re
from pathlib import Path
root=Path('E:/narvosprime-web-prototype')
base='/Game/Narvos/Megastructure_Scifi_World/Materials'
backup=root/'.hermes/sauvegardes/megastructure-emissifs-20260914'
backup.mkdir(parents=True,exist_ok=True)
r={'changes':[],'errors':[]}
def params(mat):
 return {k:[re.sub(r'0x[0-9A-Fa-f]+','PTR',str(v)) for v in mat.get_editor_property(k)] for k in ('scalar_parameter_values','vector_parameter_values','texture_parameter_values')}
try:
 parent=unreal.load_asset(base+'/Master/M_emissive')
 assert isinstance(parent,unreal.Material),'Parent promu absent'
 names=set(str(x) for x in unreal.MaterialEditingLibrary.get_scalar_parameter_names(parent))|set(str(x) for x in unreal.MaterialEditingLibrary.get_vector_parameter_names(parent))
 assert {'Emission','Emissive Color'}<=names,names
 evidence=json.loads((root/'.hermes/ASTRA_megastructure_material_sources.json').read_text())
 for name in ('MI_emissive_red','MI_emissive_white'):
  src=next(x for x in evidence if 'asset_game' in x['path'] and x['path'].endswith(name+'.uasset'))
  data=Path(chr(92)*2+'?'+chr(92)+src['path']).read_bytes()
  assert hashlib.sha256(data).hexdigest()==src['sha256'],'Source modifiée depuis lecture'
  assert "/Script/Engine.Material'/Game/Megastructure_Scifi_World/Materials/Master/M_emissive.M_emissive'" in src['strings']
  mat=unreal.load_asset(base+'/'+name)
  existing=mat.get_editor_property('parent')
  if existing==parent:
   assert name=='MI_emissive_red','Reprise inattendue'
   comparison=json.loads((root/'.hermes/ASTRA_emissif_parameters_compare.json').read_text())
   previous={k:[re.sub(r'0x[0-9A-Fa-f]+','PTR',v) for v in values] for k,values in comparison['previous_before'].items()}
   assert previous==params(mat),'Valeurs différentes de la mesure initiale'
   saved=unreal.EditorAssetLibrary.save_loaded_asset(mat,only_if_is_dirty=False)
   assert saved
   r['changes'].append({'name':name,'parent':parent.get_path_name(),'parameters_preserved':True,'saved':saved,'resumed_after_pointer_comparison':True});continue
  assert existing is None,'Un autre parent est présent : réexaminer'
  file=root/('WebPortal/Server/adk/Content/Narvos/Megastructure_Scifi_World/Materials/'+name+'.uasset')
  target=backup/file.name
  assert not target.exists(),'Sauvegarde déjà présente : examiner la tentative précédente'
  shutil.copy2(file,target)
  before=params(mat)
  unreal.MaterialEditingLibrary.set_material_instance_parent(mat,parent)
  unreal.MaterialEditingLibrary.update_material_instance(mat)
  assert mat.get_editor_property('parent')==parent
  assert params(mat)==before,'Paramètres modifiés'
  saved=unreal.EditorAssetLibrary.save_loaded_asset(mat,only_if_is_dirty=False)
  assert saved,'Sauvegarde échouée'
  r['changes'].append({'name':name,'parent':parent.get_path_name(),'parameters_preserved':True,'saved':saved,'source_sha256':src['sha256']})
 r['ok']=True
except Exception:r['errors'].append(traceback.format_exc());r['ok']=False
finally:(root/'.hermes/ASTRA_megastructure_emissifs_reparation.json').write_text(json.dumps(r,indent=2),encoding='utf-8')