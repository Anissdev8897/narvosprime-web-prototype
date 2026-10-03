import unreal,json,traceback
from pathlib import Path
root=Path('E:/narvosprime-web-prototype')
out={'ok':False,'actors':[]}
sub=unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
try:
 mats=json.loads((root/'WebPortal/Server/adk/_manifests/metacustom-materiaux.json').read_text())
 bindings=json.loads((root/'WebPortal/Server/adk/_manifests/metacustom-liaisons.json').read_text())
 bp=unreal.load_asset('/Game/Narvos/PontMetaHuman/BP_NarvosMH_M')
 for i,id in enumerate(['cheveux_hair_s_messy','cheveux_hair_l_straight','cheveux_hair_s_boblayered']):
  b=bindings['grooms'][id]['mcs2']
  a=sub.spawn_actor_from_class(bp.generated_class(),unreal.Vector(0,(i-1)*90,0),transient=True)
  a.set_actor_label('ASTRA_CHEVEUX_'+id)
  a.call_method('NarvosMaillage',('Face',b['cible']))
  a.call_method('NarvosGroom',('Hair',b['groom'],b['liaison']))
  for m in mats['grooms'][id]['materials']:a.call_method('NarvosMateriau',('Hair',m['index'],m['material']))
  for c in a.get_components_by_class(unreal.SkeletalMeshComponent):
   c.set_update_animation_in_editor(True)
   c.set_forced_lod(1)
  a.call_method('NarvosSimulationGroom',('Hair',False))
  out['actors'].append({'id':id,'path':a.get_path_name()})
 light=sub.spawn_actor_from_class(unreal.PointLight,unreal.Vector(180,0,240),transient=True)
 light.set_actor_label('ASTRA_CHEVEUX_LUMIERE')
 light.point_light_component.set_intensity(40000)
 light.point_light_component.set_attenuation_radius(1000)
 out['light']=light.get_path_name()
 unreal.get_editor_subsystem(unreal.LevelEditorSubsystem).editor_set_viewport_realtime(True)
 unreal.EditorLevelLibrary.set_level_viewport_camera_info(unreal.Vector(240,0,150),unreal.Rotator(pitch=0,yaw=180,roll=0))
 out['ok']=True
except Exception:out['error']=traceback.format_exc()
(root/'.hermes/ASTRA_cheveux_comparaison_20260915.json').write_text(json.dumps(out,indent=2))
print(json.dumps(out))