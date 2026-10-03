import unreal,json,traceback
from pathlib import Path
root=Path('E:/narvosprime-web-prototype');out={'ok':False,'components':[]}
try:
 sub=unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
 world=unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
 out['world']=world.get_path_name()
 actors=unreal.GameplayStatics.get_all_actors_of_class(world,unreal.Actor)
 out['tests']=[a.get_actor_label() for a in actors if 'ASTRA_TEST' in a.get_actor_label()]
 actor=next(x for x in actors if x.get_actor_label()=='ASTRA_TEST_WORK_TRANSIENT')
 for c in actor.get_components_by_class(unreal.SkeletalMeshComponent):
  out['components'].append({'name':c.get_name(),'mesh':str(c.get_skinned_asset()),'visible':c.get_editor_property('visible'),'hidden_in_game':c.get_editor_property('hidden_in_game'),'scale':str(c.get_editor_property('relative_scale3d')),'world_transform':str(c.get_world_transform()),'materials':[str(m) for m in c.get_materials()],'leader':str(c.get_editor_property('leader_pose_component'))})
 out['ok']=True
except Exception:out['error']=traceback.format_exc()
(root/'.hermes/ASTRA_work_preview_sonde_20260915.json').write_text(json.dumps(out,indent=2),encoding='utf-8')