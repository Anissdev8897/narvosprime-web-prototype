import unreal,json,traceback
from pathlib import Path
root=Path('E:/narvosprime-web-prototype')
report={'ok':False,'cars':[],'errors':[]}
def val(x):
 if isinstance(x,(bool,int,float,str)) or x is None:return x
 if isinstance(x,unreal.Object):return x.get_path_name()
 if isinstance(x,unreal.Vector):return [x.x,x.y,x.z]
 if isinstance(x,(unreal.Array,list,tuple)):return [val(a) for a in x]
 return str(x)
def props(obj,names):
 out={}
 for p in names:
  try:out[p]=val(obj.get_editor_property(p))
  except Exception as e:out[p]={'error':str(e)}
 return out
reg=unreal.AssetRegistryHelpers.get_asset_registry()
reg.scan_paths_synchronous(['/Game/DD_Vehicles_Basic'],force_rescan=True)
sub=unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
for data in reg.get_assets_by_path('/Game/DD_Vehicles_Basic',recursive=True):
 if str(data.asset_name) not in ['BP_Hatchback_Child','BP_Sedan_Child','BP_SUV_Child']:continue
 row={'path':str(data.package_name)};report['cars'].append(row);actor=None
 try:
  bp=data.get_asset();actor=sub.spawn_actor_from_class(bp.generated_class(),unreal.Vector(),unreal.Rotator(),transient=True)
  movement=actor.get_component_by_class(unreal.ChaosWheeledVehicleMovementComponent)
  row['engine']=props(movement.get_editor_property('engine_setup'),['max_torque','max_rpm','engine_idle_rpm','engine_brake_effect','engine_rev_up_moi','engine_rev_down_rate','torque_curve'])
  row['transmission']=props(movement.get_editor_property('transmission_setup'),['use_automatic_gears','use_auto_reverse','final_ratio','forward_gear_ratios','reverse_gear_ratios','change_up_rpm','change_down_rpm','gear_change_time','transmission_efficiency'])
  row['differential']=props(movement.get_editor_property('differential_setup'),['differential_type','front_rear_split'])
  row['steering']=props(movement.get_editor_property('steering_setup'),['steering_type','angle_ratio','steering_curve'])
  row['components']=[]
  for comp in actor.get_components_by_class(unreal.SceneComponent):
   c={'name':comp.get_name(),'class':comp.get_class().get_name(),'relative_location':val(comp.get_editor_property('relative_location'))}
   if isinstance(comp,unreal.SkeletalMeshComponent):
    c['mesh']=val(comp.get_skinned_asset());c['bones']={}
    for i in range(comp.get_num_bones()):
     name=comp.get_bone_name(i);t=comp.get_socket_transform(name,unreal.RelativeTransformSpace.RTS_COMPONENT)
     c['bones'][str(name)]={'translation':val(t.translation),'rotation':str(t.rotation)}
    c['materials']=[val(m) for m in comp.get_materials()]
   row['components'].append(c)
 except Exception:row['error']=traceback.format_exc();report['errors'].append(row['path'])
 finally:
  if actor:sub.destroy_actor(actor)
report['ok']=len(report['cars'])==3 and not report['errors']
(root/'.hermes/ASTRA_dd_mecanique_20260915.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print('DD_MECANIQUE',report['ok'],len(report['cars']))