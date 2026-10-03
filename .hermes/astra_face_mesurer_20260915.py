import unreal,json,traceback,math
from pathlib import Path
def astra_face_mesurer():
 root=Path('E:/narvosprime-web-prototype')
 result={'ok':False,'status':'running','meshes':[],'scope':'Sculpture os en editeur, pas validation client nanos'}
 output=root/'.hermes/ASTRA_face_geometrie_realtime_20260915.json'
 controls=json.loads((root/'.hermes/ASTRA_face_candidats_20260915.json').read_text())['curseurs']
 meshes=[x['mesh'].split('.')[0] for x in json.loads((root/'.hermes/ASTRA_mcs_postprocess_resultat_20260915.json').read_text())['meshes'] if '/Face/' in x['mesh']]
 subsystem=unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
 unreal.get_editor_subsystem(unreal.LevelEditorSubsystem).editor_set_viewport_realtime(True)
 unreal.EditorLevelLibrary.set_level_viewport_camera_info(unreal.Vector(180,0,170),unreal.Rotator(0,180,0))
 state={'actor':None,'component':None,'mesh_index':0,'control_index':0,'phase':0,'elapsed':0,'baseline':None,'handle':None}
 def save():output.write_text(json.dumps(result,indent=2),encoding='utf-8')
 def cleanup():
  if state['actor']:subsystem.destroy_actor(state['actor']);state['actor']=None
 def setup():
  cleanup();mesh=unreal.load_asset(meshes[state['mesh_index']])
  sex='M' if '/MCS' in meshes[state['mesh_index']] else 'F'
  bp=unreal.load_asset('/Game/Narvos/PontMetaHuman/BP_NarvosMH_'+sex)
  actor=subsystem.spawn_actor_from_class(bp.generated_class(),unreal.Vector(0,0,0),transient=True)
  state['actor']=actor;actor.set_actor_label('ASTRA_TEST_VISAGE_TRANSITOIRE')
  actor.set_actor_location(unreal.Vector(0,0,0),False,False)
  actor.call_method('NarvosMaillage',('Face',mesh.get_path_name()))
  comp=next(c for c in actor.get_components_by_class(unreal.SkeletalMeshComponent) if c.get_name()=='Face');state['component']=comp
  # Les setters d'edition peuvent reconstruire l'acteur et invalider ce composant.
  # Employer ici le setter runtime, comme dans le jeu.
  comp.call_method('SetDisablePostProcessBlueprint',(False,))
  comp.set_forced_lod(1)
  comp.set_update_animation_in_editor(True)
  state['bones']=[str(comp.get_bone_name(i)) for i in range(comp.get_num_bones())]
  assert len(state['bones'])>100
  result['meshes'].append({'mesh':meshes[state['mesh_index']],'bones':len(state['bones']),'controls':[]})
 def apply(which):
  pp=state['component'].get_post_process_instance();assert pp,'Instance postprocess absente'
  for c in controls:
   state['actor'].call_method('NarvosAnimReel',('Face',c['variable'],c['defaut']))
   for v in c['activation']:state['actor'].call_method('NarvosAnimBool',('Face',v,True))
  current=controls[state['control_index']]
  # Les intensités modifient une forme sélectionnée, pas la pose par défaut.
  contexts={'Eye_Type_Intensity':'Eye_Type','Nose_Type_Intensity':'Nose_Type','Mouth_Type_Intensity':'Mouth_Type','Jaw_Type_Intensity':'Jaw_Type'}
  if current['variable'] in contexts:state['actor'].call_method('NarvosAnimReel',('Face',contexts[current['variable']],1.0))
  state['actor'].call_method('NarvosAnimReel',('Face',current['variable'],current[which]))
  assert abs(pp.get_editor_property(current['variable'])-current[which])<0.00001
 def snapshot():
  comp=state['component'];out={}
  for bone in state['bones']:
   t=comp.get_socket_transform(bone,unreal.RelativeTransformSpace.RTS_COMPONENT)
   p=t.translation;s=t.scale3d;q=t.rotation
   out[bone]=[p.x,p.y,p.z,s.x,s.y,s.z,q.x,q.y,q.z,q.w]
  return out
 def tick(dt):
  try:
   state['elapsed']+=dt
   if state['elapsed']<0.25:return
   state['elapsed']=0
   if state['phase']==0:apply('min');state['phase']=1;return
   if state['phase']==1:state['baseline']=snapshot();apply('max');state['phase']=2;return
   after=snapshot();before=state['baseline']
   differences={b:max(abs(x-y) for x,y in zip(before[b],after[b])) for b in before}
   changed={b:v for b,v in differences.items() if v>0.0001}
   control=controls[state['control_index']]
   result['meshes'][-1]['controls'].append({'variable':control['variable'],'changed_bones':len(changed),'max_delta':max(differences.values()),'examples':sorted(changed,key=changed.get,reverse=True)[:5]})
   state['control_index']+=1;state['phase']=0
   if state['control_index']==len(controls):
    state['control_index']=0;state['mesh_index']+=1;save()
    if state['mesh_index']==len(meshes):
     result['status']='completed';result['ok']=all(c['changed_bones']>0 for m in result['meshes'] for c in m['controls'])
     cleanup();unreal.unregister_slate_post_tick_callback(state['handle']);save();return
    setup()
  except Exception:
   result['error']=traceback.format_exc();result['status']='failed';cleanup()
   unreal.unregister_slate_post_tick_callback(state['handle']);save()
 try:
  setup();save();state['handle']=unreal.register_slate_post_tick_callback(tick)
 except Exception:
  result['error']=traceback.format_exc();result['status']='failed';cleanup();save()
astra_face_mesurer()