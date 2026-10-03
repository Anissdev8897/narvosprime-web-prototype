import unreal,json
from pathlib import Path
sub=unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
for a in sub.get_all_level_actors():
 if a.get_actor_label() in ['ASTRA_TEST_VISAGE_TRANSITOIRE','ASTRA_APERCU_VISAGE','ASTRA_APERCU_LUMIERE']:sub.destroy_actor(a)
bp=unreal.load_asset('/Game/Narvos/PontMetaHuman/BP_NarvosMH_F')
a=sub.spawn_actor_from_class(bp.generated_class(),unreal.Vector(0,0,0),transient=True)
a.set_actor_label('ASTRA_APERCU_VISAGE');a.set_actor_location(unreal.Vector(0,0,0),False,False)
face=next(c for c in a.get_components_by_class(unreal.SkeletalMeshComponent) if c.get_name()=='Face')
face.set_forced_lod(1);face.set_update_animation_in_editor(True)
light=sub.spawn_actor_from_class(unreal.PointLight,unreal.Vector(180,-80,230),transient=True)
light.set_actor_label('ASTRA_APERCU_LUMIERE');light.point_light_component.set_intensity(16000);light.point_light_component.set_attenuation_radius(1000)
unreal.get_editor_subsystem(unreal.LevelEditorSubsystem).editor_set_viewport_realtime(True)
unreal.EditorLevelLibrary.set_level_viewport_camera_info(unreal.Vector(130,0,165),unreal.Rotator(0,180,0))
Path('E:/narvosprime-web-prototype/.hermes/ASTRA_face_apercu_20260915.json').write_text(json.dumps({'actor':a.get_name(),'light':light.get_name(),'mesh':face.get_skinned_asset().get_path_name(),'pp_enabled':not face.get_editor_property('disable_post_process_blueprint')}),encoding='utf-8')