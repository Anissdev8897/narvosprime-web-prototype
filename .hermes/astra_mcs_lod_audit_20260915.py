import unreal,json,traceback
from pathlib import Path
root=Path('E:/narvosprime-web-prototype');out={'ok':False,'blueprints':[]}
try:
 for sex in ['M','F']:
  bp=unreal.load_asset('/Game/Narvos/PontMetaHuman/BP_NarvosMH_'+sex)
  a=unreal.get_editor_subsystem(unreal.EditorActorSubsystem).spawn_actor_from_class(bp.generated_class(),unreal.Vector(),transient=True)
  row={'blueprint':bp.get_path_name(),'components':[]}
  for comp in a.get_components_by_class(unreal.ActorComponent):
   if comp.get_name().lower() not in ['face','body','lodsync']:continue
   c={'name':comp.get_name(),'class':comp.get_class().get_name()}
   for prop in ['forced_lod','min_lod','forced_lod_model','disable_morph_target','post_process_anim_bplod_threshold','disable_post_process_blueprint','leader_pose_component','override_post_process_anim_bp']:
    try:c[prop]=str(comp.get_editor_property(prop))
    except Exception:pass
   if isinstance(comp,unreal.SkeletalMeshComponent):
    pp=comp.get_post_process_instance();c['post_process_instance']=pp.get_class().get_path_name() if pp else None
    c['mesh']=comp.get_skinned_asset().get_path_name()
    c['morph_count']=len(comp.get_skinned_asset().get_editor_property('morph_targets'))
   row['components'].append(c)
  out['blueprints'].append(row)
  unreal.get_editor_subsystem(unreal.EditorActorSubsystem).destroy_actor(a)
 out['ok']=True
except Exception:out['error']=traceback.format_exc()
(root/'.hermes/ASTRA_mcs_lod_audit_20260915.json').write_text(json.dumps(out,indent=2))