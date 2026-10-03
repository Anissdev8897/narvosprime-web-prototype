"""Lecture seule des visages et coiffures supplementaires deja importes."""
import unreal, json, traceback
from pathlib import Path
root=Path('E:/narvosprime-web-prototype')
result={'ok':False,'faces':[],'grooms':[],'bindings':[]}
try:
 assets=json.loads((root/'WebPortal/Server/adk/_assets-inventory.json').read_text())['assets']
 for row in assets:
  path=row['paquet']
  if row['classe']=='SkeletalMesh' and ('Kellan_FaceMesh' in path or '/CoreC/' in path and 'Base_Face' in path):
   mesh=unreal.load_asset(path)
   result['faces'].append({'asset':path,'skeleton':mesh.skeleton.get_path_name() if mesh.skeleton else None,
    'morphs':[m.get_name() for m in mesh.get_editor_property('morph_targets')],
    'materials':[{'index':i,'slot':str(m.material_slot_name),'material':m.material_interface.get_path_name() if m.material_interface else None} for i,m in enumerate(mesh.materials)],
    'post_process':str(mesh.get_editor_property('post_process_anim_blueprint'))})
  if row['classe'] in ['GroomAsset','GroomBindingAsset'] and ('/ExternalAssets/' in path or '/MetaHumans/Kellan/' in path):
   asset=unreal.load_asset(path)
   if row['classe']=='GroomAsset':
    result['grooms'].append({'asset':path,'materials':[{'slot':str(m.get_editor_property('slot_name')),'material':m.get_editor_property('material').get_path_name() if m.get_editor_property('material') else None} for m in asset.get_editor_property('hair_groups_materials')]})
   else:
    def ref(name):
     val=asset.get_editor_property(name)
     return val.get_path_name() if val else None
    result['bindings'].append({'asset':path,'target':ref('target_skeletal_mesh'),'source':ref('source_skeletal_mesh'),'groom':ref('groom')})
 result['ok']=True
except Exception: result['error']=traceback.format_exc()
(root/'.hermes/ASTRA_mcs_extensions_audit_20260915.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print('ASTRA_EXTENSIONS',result['ok'],len(result['faces']),len(result['grooms']))