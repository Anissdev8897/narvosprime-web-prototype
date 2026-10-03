import unreal,json,traceback
from pathlib import Path
root=Path('E:/narvosprime-web-prototype'); out={'ok':False,'checks':[]}
sub=unreal.get_editor_subsystem(unreal.EditorActorSubsystem); actors=[]
try:
 controls=json.loads((root/'.hermes/ASTRA_face_candidats_20260915.json').read_text())['curseurs']
 meshes=[x['mesh'] for x in json.loads((root/'.hermes/ASTRA_mcs_postprocess_resultat_20260915.json').read_text())['meshes'] if '/Face/' in x['mesh']]
 for sex in ['M','F']:
  bp=unreal.load_asset('/Game/Narvos/PontMetaHuman/BP_NarvosMH_'+sex)
  a=sub.spawn_actor_from_class(bp.generated_class(),unreal.Vector(),transient=True);actors.append(a)
  for path in meshes:
   if (('/MCS' in path) != (sex=='M')):continue
   a.call_method('NarvosMaillage',('Face',path))
   c=next(x for x in a.get_components_by_class(unreal.SkeletalMeshComponent) if x.get_name().lower()=='face')
   pp=c.get_post_process_instance()
   row={'mesh':c.get_skinned_asset().get_path_name(),'disable_pp':c.get_editor_property('disable_post_process_blueprint'),'leader':str(c.get_editor_property('leader_pose_component')),'pp':pp.get_class().get_path_name() if pp else None,'controls':[]}
   for ctrl in controls:
    a.call_method('NarvosAnimReel',('Face',ctrl['variable'],ctrl['max']))
    for active in ctrl['activation']:a.call_method('NarvosAnimBool',('Face',active,True))
    row['controls'].append({'variable':ctrl['variable'],'actual':pp.get_editor_property(ctrl['variable']) if pp else None,'expected':ctrl['max'],'active':{v:pp.get_editor_property(v) for v in ctrl['activation']} if pp else {}})
   a.call_method('NarvosMorph',('Face','head_lod0_mesh__cheek_blow_left',1.0))
   row['cheek_value']=c.get_morph_target('head_lod0_mesh__cheek_blow_left')
   out['checks'].append(row)
 out['ok']=True
except Exception:out['error']=traceback.format_exc()
finally:
 for a in actors:sub.destroy_actor(a)
 (root/'.hermes/ASTRA_mcs_apres_maillage_20260915.json').write_text(json.dumps(out,indent=2))