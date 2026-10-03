"""Sonde temporaire : même porteur nanos et attachement root que le runtime.
Aucune sauvegarde d'asset ou de map. Nettoyage par chemins de tâche exacts.
"""
import unreal,json,traceback
from pathlib import Path
root=Path('E:/narvosprime-web-prototype')
out={'ok':False,'actors':[],'pairs':[],'errors':[]}
try:
 exec(compile((root/'.hermes/astra_mcs_apercu_20260915.py').read_text(), 'astra_mcs_apercu_20260915.py','exec'),{})
 preview=json.loads((root/'.hermes/ASTRA_mcs_apercu_20260915.json').read_text())
 assert preview['ok'],preview.get('errors')
 out['actors']=preview['actors'][:]
 sub=unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
 carrier_mesh=unreal.load_asset('/Game/NanosWorld/Characters/Mannequin/SK_Mannequin')
 idle=unreal.load_asset('/Game/NanosWorld/Characters/DefaultAnimations/A_Mannequin_Idle')
 animation=unreal.load_asset('/Game/Narvos/PontMetaHuman/ABP_NanosVersMetaHumanCorps')
 assert carrier_mesh and idle and animation
 for path in preview['actors'][:2]:
  actor=unreal.find_object(None,path);assert actor
  parent=sub.spawn_actor_from_class(unreal.SkeletalMeshActor,actor.get_actor_location(),transient=True)
  out['actors'].append(parent.get_path_name())
  mesh=parent.skeletal_mesh_component
  mesh.set_skinned_asset_and_update(carrier_mesh)
  mesh.set_update_animation_in_editor(True)
  mesh.play_animation(idle,True)
  # Le porteur reste visible ici pour comparer les squelettes superposés.
  rule=unreal.AttachmentRule.SNAP_TO_TARGET
  assert actor.attach_to_component(mesh,'root',rule,rule,rule,False)
  comps={c.get_name():c for c in actor.get_components_by_class(unreal.SkeletalMeshComponent)}
  comps['Body'].set_animation_mode(unreal.AnimationMode.ANIMATION_BLUEPRINT)
  comps['Body'].set_anim_instance_class(animation.generated_class())
  comps['Body'].set_update_animation_in_editor(True)
  comps['Face'].set_update_animation_in_editor(True)
  out['pairs'].append({'metahuman':path,'parent':parent.get_path_name(),'source':carrier_mesh.get_path_name(),'animation':idle.get_path_name()})
 out['ok']=True
except Exception:out['errors'].append(traceback.format_exc())
(root/'.hermes/ASTRA_mcs_attache_20260915.json').write_text(json.dumps(out,indent=2),encoding='utf-8')