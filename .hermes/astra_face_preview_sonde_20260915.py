import unreal,json,traceback
from pathlib import Path
root=Path('E:/narvosprime-web-prototype');out={'ok':False}
try:
 bp=unreal.load_asset('/Game/Narvos/PontMetaHuman/ABP_NarvosPersonnalisationVisage')
 out['bones']=sorted(set(str(n.get_editor_property('node').get_editor_property('bone_to_modify').get_editor_property('bone_name')) for n in bp.get_nodes_of_class(unreal.AnimGraphNode_ModifyBone)))
 out['component_methods']={n:getattr(unreal.SkeletalMeshComponent,n).__doc__ for n in dir(unreal.SkeletalMeshComponent) if any(k in n for k in ['post_process','update_animation_in_editor','tick_animation','get_socket_transform','set_skinned_asset','get_bone_name','get_num_bones'])}
 out['variables']={}
 info=json.loads((root/'.hermes/ASTRA_face_source_info_20260915.json').read_text())
 cdo=unreal.get_default_object(bp.generated_class())
 for v in info['variables']:
  try:out['variables'][v['name']]=str(cdo.get_editor_property(v['name']))
  except Exception:pass
 out['ok']=True
except Exception:out['error']=traceback.format_exc()
(root/'.hermes/ASTRA_face_preview_sonde_20260915.json').write_text(json.dumps(out,indent=2),encoding='utf-8')
print('FACE_PREVIEW_SONDE',out['ok'],out.get('error',''))