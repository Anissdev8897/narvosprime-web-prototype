import unreal,json,traceback
from pathlib import Path
root=Path('E:/narvosprime-web-prototype')
reg=unreal.AssetRegistryHelpers.get_asset_registry()
reg.scan_paths_synchronous(['/Game/HoverVehicles','/Game/DD_Vehicles_Basic'],force_rescan=True)
sds=unreal.get_engine_subsystem(unreal.SubobjectDataSubsystem)
lib=unreal.SubobjectDataBlueprintFunctionLibrary
report={'ok':False,'blueprints':[],'errors':[]}
def value(o,p):
 try:
  v=o.get_editor_property(p)
  return v.get_path_name() if isinstance(v,unreal.Object) else str(v)
 except Exception as e:return {'unavailable':str(e)}
try:
 for pack in ['HoverVehicles','DD_Vehicles_Basic']:
  for a in reg.get_assets_by_path('/Game/'+pack,recursive=True):
   if str(a.asset_class_path.asset_name)!='Blueprint':continue
   row={'path':str(a.package_name),'components':[]};report['blueprints'].append(row)
   try:
    bp=a.get_asset();row['parent']=str(a.get_tag_value('ParentClass'));cls=bp.generated_class()
    row['generated_class']=cls.get_path_name() if cls else None
    assert cls,'Classe generee absente : parent/plugin ou compilation a corriger'
    seen=set()
    objects=[]
    for h in sds.k2_gather_subobject_data_for_blueprint(bp):
     d=sds.k2_find_subobject_data_from_handle(h);o=lib.get_object(d)
     objects.append((str(lib.get_variable_name(d)),o))
    cdo=unreal.get_default_object(cls)
    if isinstance(cdo,unreal.Actor):objects.extend((o.get_name(),o) for o in cdo.get_components_by_class(unreal.ActorComponent))
    for name,o in objects:
     if not isinstance(o,unreal.ActorComponent) or o.get_path_name() in seen:continue
     seen.add(o.get_path_name())
     c={'name':name,'class':o.get_class().get_name()};row['components'].append(c)
     if isinstance(o,unreal.MeshComponent):
      c['materials']=[m.get_path_name() if m else None for m in o.get_materials()]
     if isinstance(o,unreal.StaticMeshComponent):
      c['mesh']=value(o,'static_mesh');c['body_instance']=value(o,'body_instance')
     if isinstance(o,unreal.SkeletalMeshComponent):
      c['mesh']=value(o,'skinned_asset');c['animation']=value(o,'anim_class')
    row['has_mesh']=any(c.get('mesh') not in [None,'None'] for c in row['components'])
    row['native_nanos_controller']=False
   except Exception:row['error']=traceback.format_exc();report['errors'].append(row['path'])
 report['ok']=not report['errors']
except Exception:report['error']=traceback.format_exc()
(root/'.hermes/ASTRA_vehicules_qualification_unreal_20260915.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print('VEHICULES_QUALIFICATION',report['ok'],len(report['blueprints']),len(report['errors']))