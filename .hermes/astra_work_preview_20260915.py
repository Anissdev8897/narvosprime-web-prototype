import unreal,json
from pathlib import Path
sub=unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
bp=unreal.load_asset('/Game/Narvos/PontMetaHuman/BP_NarvosMH_F')
actor=sub.spawn_actor_from_class(bp.generated_class(),unreal.Vector(0,0,0),transient=True)
actor.set_actor_label('ASTRA_TEST_WORK_TRANSIENT')
p='/Game/Narvos/MetaCustom/Skeletal_Meshes/Metahuman_Tall_Medium_Female/'
actor.call_method('NarvosMaillage',('Torso',p+'SK_Set_3_Work_Top'))
actor.call_method('NarvosMaillage',('Legs',p+'SK_Set_3_Work_Skirt'))
light=sub.spawn_actor_from_class(unreal.PointLight,unreal.Vector(160,-100,170),transient=True)
light.set_actor_label('ASTRA_TEST_LIGHT_TRANSIENT')
light.point_light_component.set_intensity(6000)
light.point_light_component.set_attenuation_radius(2000)
unreal.EditorLevelLibrary.set_level_viewport_camera_info(unreal.Vector(260,0,100),unreal.Rotator(0,180,0))
Path('E:/narvosprime-web-prototype/.hermes/ASTRA_work_preview_actors_20260915.json').write_text(json.dumps({'actors':[actor.get_name(),light.get_name()]}))