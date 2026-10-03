import unreal,json,traceback
from pathlib import Path
root=Path('E:/narvosprime-web-prototype')
out={'ok':False,'actors':[],'errors':[]}
def objet(path):return path if '.' in path else path+'.'+path.rsplit('/',1)[-1]
try:
 sub=unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
 options=json.loads((root/'WebPortal/Server/adk/_manifests/metacustom-options.json').read_text())
 mats=json.loads((root/'WebPortal/Server/adk/_manifests/metacustom-materiaux.json').read_text())
 bp=unreal.load_asset('/Game/Narvos/PontMetaHuman/BP_NarvosMH_F')
 for index,ident_id in enumerate(['fcsbase','fcs0']):
  ident=next(i for i in options['identites'] if i['id']==ident_id)
  groom_id='cheveux_hair_s_cornrows' if index==0 else 'cheveux_hair_l_messyclumps'
  groom=next(g for g in options['grooms'] if g['id']==groom_id)
  a=sub.spawn_actor_from_class(bp.generated_class(),unreal.Vector(0,index*150,0),transient=True)
  a.set_actor_label('ASTRA_MCS_APERCU_'+ident_id);out['actors'].append(a.get_path_name())
  components={c.get_name():c for c in a.get_components_by_class(unreal.MeshComponent)}
  body=components['Body'];body.set_animation_mode(unreal.AnimationMode.ANIMATION_SINGLE_NODE)
  body.set_update_animation_in_editor(True)
  a.call_method('NarvosMaillage',('Face',objet(ident['visage'])))
  assert components['Face'].get_skinned_asset().get_path_name()==objet(ident['visage'])
  a.call_method('NarvosMateriau',('Body',0,ident['materiau_corps']))
  for slot in mats['faces'][ident_id]['materials']:
   a.call_method('NarvosMateriau',('Face',slot['index'],slot['material']))
  components['Face'].set_update_animation_in_editor(True)
  a.call_method('NarvosGroom',('Hair',objet(groom['groom']),objet(groom['liaison'])))
  assert components['Hair'].get_editor_property('groom_asset').get_path_name()==objet(groom['groom'])
  assert components['Hair'].get_editor_property('binding_asset').get_path_name()==objet(groom['liaison'])
  for slot in mats['grooms'][groom_id]['materials']:
   a.call_method('NarvosMateriau',('Hair',slot['index'],slot['material']))
  for comp in ['Torso','Legs','Feet','Prop']:a.call_method('NarvosMaillage',(comp,''))
 light=sub.spawn_actor_from_class(unreal.PointLight,unreal.Vector(180,60,190),transient=True)
 out['actors'].append(light.get_path_name());light.point_light_component.set_intensity(8000)
 unreal.get_editor_subsystem(unreal.LevelEditorSubsystem).editor_set_viewport_realtime(True)
 unreal.EditorLevelLibrary.set_level_viewport_camera_info(unreal.Vector(290,75,155),unreal.Rotator(pitch=0,yaw=180,roll=0))
 out['ok']=True
except Exception:out['errors'].append(traceback.format_exc())
(root/'.hermes/ASTRA_mcs_apercu_20260915.json').write_text(json.dumps(out,indent=2),encoding='utf-8')