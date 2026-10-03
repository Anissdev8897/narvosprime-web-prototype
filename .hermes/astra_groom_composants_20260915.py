import unreal,json,traceback
from pathlib import Path
root=Path('E:/narvosprime-web-prototype')
report={'ok':False,'blueprints':[],'errors':[]}
def val(x):
 if isinstance(x,(bool,int,float,str)) or x is None:return x
 if isinstance(x,unreal.Object):return x.get_path_name()
 if isinstance(x,(unreal.Array,list,tuple)):return [val(a) for a in x]
 return str(x)
sub=unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
paths=['/Game/Narvos/PontMetaHuman/BP_NarvosMH_F','/Game/Narvos/MetaCustom/Metahuman_Ref/FCSBase/BP_Hana']
for path in paths:
 row={'path':path,'components':[]};report['blueprints'].append(row);actor=None
 try:
  bp=unreal.load_asset(path);assert bp,path
  actor=sub.spawn_actor_from_class(bp.generated_class(),unreal.Vector(),unreal.Rotator(),transient=True)
  for c in actor.get_components_by_class(unreal.SceneComponent):
   if not isinstance(c,(unreal.GroomComponent,unreal.SkeletalMeshComponent)):continue
   entry={'name':c.get_name(),'class':c.get_class().get_name(),'parent':val(c.get_attach_parent()),'socket':str(c.get_attach_socket_name()),'transform':str(c.get_relative_transform())};row['components'].append(entry)
   props=['override_materials']
   if isinstance(c,unreal.GroomComponent):props+=['groom_asset','binding_asset','use_cards','attachment_name','simulation_settings','groom_groups_desc']
   else:props+=['skinned_asset','anim_class','disable_post_process_blueprint','leader_pose_component']
   for p in props:
    try:entry[p]=val(c.get_editor_property(p))
    except Exception as e:entry[p]={'error':str(e)}
 except Exception:row['error']=traceback.format_exc();report['errors'].append(path)
 finally:
  if actor:sub.destroy_actor(actor)
report['ok']=not report['errors']
(root/'.hermes/ASTRA_groom_composants_20260915.json').write_text(json.dumps(report,indent=2),encoding='utf-8')