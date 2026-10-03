import unreal,json,traceback
from pathlib import Path
root=Path('E:/narvosprime-web-prototype');out={'ok':False,'sliders':{},'cars':[]}
try:
 path='/Game/Narvos/MetaCustom/Meta_Face_Tool/Widgets/Widget_Customization'
 widget=unreal.load_asset(path)
 for slider in unreal.ObjectIterator(unreal.Slider):
  if slider.get_path_name().startswith(path+'.'):
   out['sliders'][slider.get_name()]={p:slider.get_editor_property(p) for p in ['min_value','max_value','value','step_size']}
 assert len(out['sliders'])==17
 for name in ['BP_Hatchback_Child','BP_Sedan_Child','BP_SUV_Child']:
  bp=unreal.load_asset('/Game/DD_Vehicles_Basic/Blueprints/Vehicles/'+name)
  cdo=unreal.get_default_object(bp.generated_class())
  movements=cdo.get_components_by_class(unreal.ChaosWheeledVehicleMovementComponent);assert len(movements)==1
  movement=movements[0]
  row={'name':name,'movement':{},'wheels':[]}
  for prop in ['engine_setup','transmission_setup','differential_setup','steering_setup','mass','drag_coefficient','downforce_coefficient','chassis_width','chassis_height','center_of_mass_override']:
   try:row['movement'][prop]=str(movement.get_editor_property(prop))
   except Exception as e:row['movement'][prop]={'error':str(e)}
  for wheel in movement.get_editor_property('wheel_setups'):
   wheel_class=wheel.get_editor_property('wheel_class')
   w=unreal.get_default_object(wheel_class)
   properties={}
   for prop in ['wheel_radius','wheel_width','max_steer_angle','affected_by_engine','affected_by_brake','affected_by_handbrake','suspension_max_raise','suspension_max_drop','suspension_damping_ratio','spring_rate','spring_preload','max_brake_torque','max_hand_brake_torque','wheel_load_ratio','friction_force_multiplier','axle_type']:
    try:properties[prop]=str(w.get_editor_property(prop))
    except Exception as e:properties[prop]={'error':str(e)}
   row['wheels'].append({'bone':str(wheel.get_editor_property('bone_name')),'offset':str(wheel.get_editor_property('additional_offset')),'class':wheel_class.get_path_name(),'properties':properties})
  comps=cdo.get_components_by_class(unreal.SkeletalMeshComponent)
  row['meshes']=[{'name':x.get_name(),'mesh':str(x.get_editor_property('skinned_asset'))} for x in comps]
  out['cars'].append(row)
 out['ok']=True
except Exception:out['error']=traceback.format_exc()
(root/'.hermes/ASTRA_widgets_voitures_20260915.json').write_text(json.dumps(out,indent=2),encoding='utf-8')
print('WIDGETS_VOITURES',out['ok'],out.get('error',''))