import unreal,json,traceback
from pathlib import Path
out={'ok':False,'nodes':[]}
try:
 a=unreal.load_asset('/Game/Narvos/MetaCustom/Metahuman_Face_Customization/AnimBP_Face_Tool')
 out['docs']={k:getattr(a,k).__doc__ for k in ['get_animation_graphs','get_nodes_of_class']}
 for cls in [unreal.AnimGraphNode_ControlRig,unreal.AnimGraphNode_PoseDriver,unreal.AnimGraphNode_CopyPoseFromMesh]:
  nodes=a.get_nodes_of_class(cls)
  for x in nodes:
   row={'name':x.get_name(),'class':x.get_class().get_name()}
   try:
    n=x.get_editor_property('node');row['struct']=str(n);row['props']=[p for p in dir(n) if not p.startswith('_')]
    for prop in ['control_rig_class','pose_asset','source_bones','source_mesh_component','copy_curves']:
     try: row[prop]=str(n.get_editor_property(prop))
     except Exception: pass
   except Exception as e:row['error']=str(e)
   out['nodes'].append(row)
 for name in ['Neck_CtrlRig','HeadMovementIK_Proc_CtrlRig']:
  rig=unreal.load_asset('/Game/Narvos/MetaHumans/Common/Face/'+name)
  out[name]={'keys':[str(x) for x in rig.hierarchy.get_all_keys()]}
 out['ok']=True
except Exception:out['error']=traceback.format_exc()
Path('E:/narvosprime-web-prototype/.hermes/ASTRA_face_nodes_20260915.json').write_text(json.dumps(out,indent=2),encoding='utf-8')
print(out['ok'],out.get('error',''))