import unreal,json,traceback
from pathlib import Path
root=Path('E:/narvosprime-web-prototype')
out={'ok':False,'actors':[],'errors':[]}
try:
 data=json.loads((root/'.hermes/ASTRA_mcs_apercu_20260915.json').read_text())
 for path in data['actors'][:2]:
  a=unreal.find_object(None,path);assert a,path
  row={'path':path,'components':[]};out['actors'].append(row)
  for comp in a.get_components_by_class(unreal.MeshComponent):
   if comp.get_name() not in ['Body','Face','Hair']:continue
   c={'name':comp.get_name(),'visible':comp.is_visible(),'transform':str(comp.get_world_transform()),'materials':[],'overrides':[m.get_path_name() if m else None for m in comp.get_editor_property('override_materials')]};row['components'].append(c)
   for m in comp.get_materials():
    c['materials'].append({'path':m.get_path_name() if m else None,'blend':str(m.get_blend_mode()) if m else None})
   if isinstance(comp,unreal.SkeletalMeshComponent):
    mesh=comp.get_skinned_asset();c['mesh']=mesh.get_path_name()
    c['bones']={b:str(comp.get_socket_transform(b,unreal.RelativeTransformSpace.RTS_WORLD)) for b in ['root','head','FACIAL_C_FacialRoot','FACIAL_C_Nose','FACIAL_L_Eye']}
    c['postprocess']=str(comp.get_post_process_instance());c['leader']=str(comp.get_editor_property('leader_pose_component'))
   else:
    c['groom']=str(comp.get_editor_property('groom_asset'));c['binding']=str(comp.get_editor_property('binding_asset'));c['cards']=comp.get_editor_property('use_cards')
 out['ok']=True
except Exception:out['errors'].append(traceback.format_exc())
(root/'.hermes/ASTRA_mcs_apercu_mesures_20260915.json').write_text(json.dumps(out,indent=2),encoding='utf-8')