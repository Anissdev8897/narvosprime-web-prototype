import unreal,json,traceback
from pathlib import Path
root=Path('E:/narvosprime-web-prototype')
cases=json.loads((root/'.hermes/ASTRA_mcs_vetements_probe.json').read_text())['checks']
r={'checks':[],'errors':[]};actors=[]
sub=unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
def path(o):return o.get_path_name() if o else None
try:
 level=unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
 assert level.set_current_level_by_name('Map_Narvos')
 for sex in ('m','f'):
  bp=unreal.load_asset('/Game/Narvos/PontMetaHuman/BP_NarvosMH_'+sex.upper())
  a=sub.spawn_actor_from_class(bp.generated_class(),unreal.Vector(0,0,-50000),transient=True);actors.append(a)
  comps={c.get_name():c for c in a.get_components_by_class(unreal.SkeletalMeshComponent)}
  for entry in cases:
   if entry['sex']!=sex:continue
   c=comps[entry['slot']];a.call_method('NarvosMaillage',(entry['slot'],entry['requested']))
   mesh=c.get_skinned_asset()
   before=path(c.get_editor_property('leader_pose_component'))
   a.call_method('EnableMasterPose',(c,))
   r['checks'].append({'id':entry['id'],'mesh':path(mesh),'slots':[{'slot':str(s.get_editor_property('material_slot_name')),'imported_slot':str(s.get_editor_property('imported_material_slot_name')),'material':path(s.get_editor_property('material_interface'))} for s in mesh.get_editor_property('materials')],'leader_before':before,'leader_after':path(c.get_editor_property('leader_pose_component')),'anim_class':path(c.get_editor_property('anim_class')),'mesh_post_process':path(mesh.get_editor_property('post_process_anim_blueprint'))})
except Exception:r['errors'].append(traceback.format_exc())
finally:
 r['cleanup']=[bool(sub.destroy_actor(a)) for a in actors]
 (root/'.hermes/ASTRA_mcs_vetements_diagnostic.json').write_text(json.dumps(r,indent=2),encoding='utf-8')