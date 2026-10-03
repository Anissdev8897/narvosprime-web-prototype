import unreal,json,traceback
from pathlib import Path
out={'ok':False};sub=unreal.get_editor_subsystem(unreal.EditorActorSubsystem);a=None
try:
 bp=unreal.load_asset('/Game/Narvos/PontMetaHuman/BP_NarvosMH_M')
 a=sub.spawn_actor_from_class(bp.generated_class(),unreal.Vector(0,0,0),transient=True)
 face=next(c for c in a.get_components_by_class(unreal.SkeletalMeshComponent) if c.get_name()=='Face')
 def snap():return {'mesh':str(face.get_skinned_asset()),'bones':face.get_num_bones(),'anim':str(face.get_anim_instance()),'pp':str(face.get_post_process_instance()),'leader':str(face.get_editor_property('leader_pose_component'))}
 out['before']=snap();mesh=unreal.load_asset('/Game/Narvos/MetaCustom/Metahuman_Ref/MCSGavin/Face/MCSGavin_FaceMesh');out['requested']=mesh.get_path_name()
 a.call_method('NarvosMaillage',('Face',mesh.get_path_name()));out['after_call']=snap()
 face.set_skinned_asset_and_update(mesh,True);out['after_direct']=snap()
 out['ok']=True
except Exception:out['error']=traceback.format_exc()
finally:
 if a:sub.destroy_actor(a)
Path('E:/narvosprime-web-prototype/.hermes/ASTRA_face_maillage_sonde_20260915.json').write_text(json.dumps(out,indent=2),encoding='utf-8')