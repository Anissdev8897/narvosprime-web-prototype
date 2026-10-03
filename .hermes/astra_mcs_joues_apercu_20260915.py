import unreal,json,traceback
from pathlib import Path
root=Path('E:/narvosprime-web-prototype');out={'ok':False,'actors':[],'errors':[]}
def obj(p):return p if '.' in p else p+'.'+p.rsplit('/',1)[-1]
try:
 opts=json.loads((root/'WebPortal/Server/adk/_manifests/metacustom-options.json').read_text());mats=json.loads((root/'WebPortal/Server/adk/_manifests/metacustom-materiaux.json').read_text());bindings=json.loads((root/'WebPortal/Server/adk/_manifests/metacustom-liaisons.json').read_text())
 sub=unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
 ident=next(i for i in opts['identites'] if i['id']=='mcs2');groom=next(g for g in opts['grooms'] if g['id']=='cheveux_hair_s_cornrows')
 bp=unreal.load_asset('/Game/Narvos/PontMetaHuman/BP_NarvosMH_M')
 for index in range(2):
  a=sub.spawn_actor_from_class(bp.generated_class(),unreal.Vector(0,index*65,0),transient=True);out['actors'].append(a.get_path_name());a.set_actor_label('ASTRA_TEST_JOUES_'+str(index))
  a.call_method('NarvosMaillage',('face',obj(ident['visage'])))
  for slot in mats['faces'][ident['id']]['materials']:a.call_method('NarvosMateriau',('face',slot['index'],slot['material']))
  a.call_method('NarvosMateriau',('Body',0,obj(ident['materiau_corps'])))
  a.call_method('NarvosGroom',('Hair',obj(groom['groom']),bindings['grooms'][groom['id']][ident['id']]['liaison']))
  for slot in mats['grooms'][groom['id']]['materials']:a.call_method('NarvosMateriau',('Hair',slot['index'],slot['material']))
  for name in ['Eyebrows','Eyelashes','Fuzz']:a.call_method('NarvosGroom',(name,'',''))
  for name in ['Torso','Legs','Feet','Prop']:a.call_method('NarvosMaillage',(name,''))
  comps={c.get_name().lower():c for c in a.get_components_by_class(unreal.MeshComponent)}
  face=comps['face'];face.set_forced_lod(1);face.set_update_animation_in_editor(True)
  comps['body'].set_animation_mode(unreal.AnimationMode.ANIMATION_SINGLE_NODE);comps['body'].set_update_animation_in_editor(True)
  for suffix in ['left','right']:face.set_morph_target('head_lod0_mesh__cheek_blow_'+suffix,float(index))
  out.setdefault('checks',[]).append({'face':face.get_skinned_asset().get_path_name(),'binding':comps['hair'].get_editor_property('binding_asset').get_path_name(),'cheek':face.get_morph_target('head_lod0_mesh__cheek_blow_left')})
 light=sub.spawn_actor_from_class(unreal.PointLight,unreal.Vector(130,20,220),transient=True);out['actors'].append(light.get_path_name());light.point_light_component.set_intensity(22000)
 unreal.get_editor_subsystem(unreal.LevelEditorSubsystem).editor_set_viewport_realtime(True)
 unreal.EditorLevelLibrary.set_level_viewport_camera_info(unreal.Vector(150,32,162),unreal.Rotator(pitch=0,yaw=180,roll=0))
 out['ok']=True
except Exception:out['errors'].append(traceback.format_exc())
(root/'.hermes/ASTRA_mcs_joues_apercu_20260915.json').write_text(json.dumps(out,indent=2),encoding='utf8')