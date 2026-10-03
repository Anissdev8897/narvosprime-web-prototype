import unreal,json
from pathlib import Path
sub=unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
proof=json.loads(Path('E:/narvosprime-web-prototype/.hermes/ASTRA_face_apercu_20260915.json').read_text())
out={'camera':str(unreal.EditorLevelLibrary.get_level_viewport_camera_info()),'actors':[],'rotator_doc':unreal.Rotator.__doc__}
for name in [proof['actor'],proof['light']]:
 a=unreal.find_object(None,'/Engine/Maps/Entry.Entry:PersistentLevel.'+name)
 assert a,name
 row={'name':a.get_name(),'location':str(a.get_actor_location()),'bounds':str(a.get_actor_bounds(False)),'components':[]};out['actors'].append(row)
 for c in a.get_components_by_class(unreal.SkeletalMeshComponent):
  row['components'].append({'name':c.get_name(),'location':str(c.get_world_location()),'visible':c.is_visible(),'mesh':str(c.get_skinned_asset()),'head':str(c.get_socket_location('head'))})
unreal.EditorLevelLibrary.set_level_viewport_camera_info(unreal.Vector(130,0,165),unreal.Rotator(pitch=0,yaw=180,roll=0))
Path('E:/narvosprime-web-prototype/.hermes/ASTRA_face_apercu_sonde_20260915.json').write_text(json.dumps(out,indent=2),encoding='utf-8')