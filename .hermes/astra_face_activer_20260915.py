import unreal,json,shutil,traceback
from pathlib import Path
root=Path('E:/narvosprime-web-prototype');out={'ok':False,'checks':[],'saved':[]};actors=[]
sub=unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
try:
 proof=json.loads((root/'.hermes/ASTRA_face_geometrie_realtime_20260915.json').read_text())
 assert proof['ok'] and proof['status']=='completed' and len(proof['meshes'])==6
 assert all(len(m['controls'])==15 and all(c['changed_bones']>0 for c in m['controls']) for m in proof['meshes'])
 backup=root/'.hermes/sauvegardes/face-activation-20260915'
 resume=backup.exists()
 if resume:
  previous=json.loads((root/'.hermes/ASTRA_face_activation_20260915.json').read_text())
  assert not previous['ok'] and not previous['checks'] and len(previous['saved'])==1
 else:backup.mkdir(parents=True)
 names=['ABP_NarvosPersonnalisationVisage','BP_NarvosMH_M','BP_NarvosMH_F']
 for name in names:
  file=root/'WebPortal/Server/adk/Content/Narvos/PontMetaHuman'/f'{name}.uasset'
  assert file.stat().st_nlink==1
  if not resume:shutil.copyfile(file,backup/file.name)
 controls=json.loads((root/'.hermes/ASTRA_face_candidats_20260915.json').read_text())['curseurs']
 abp=unreal.load_asset('/Game/Narvos/PontMetaHuman/'+names[0]);cdo=unreal.get_default_object(abp.generated_class())
 for c in controls:
  cdo.set_editor_property(c['variable'],c['defaut'])
  for v in c['activation']:cdo.set_editor_property(v,True)
 unreal.BlueprintEditorLibrary.compile_blueprint(abp)
 assert unreal.EditorAssetLibrary.save_loaded_asset(abp,False)
 out['saved'].append(abp.get_path_name())
 sds=unreal.get_engine_subsystem(unreal.SubobjectDataSubsystem);lib=unreal.SubobjectDataBlueprintFunctionLibrary
 for sex in ['M','F']:
  bp=unreal.load_asset('/Game/Narvos/PontMetaHuman/BP_NarvosMH_'+sex);found={}
  for h in sds.k2_gather_subobject_data_for_blueprint(bp):
   d=sds.k2_find_subobject_data_from_handle(h)
   if str(lib.get_variable_name(d))=='Face':
    component=lib.get_object(d);found[component.get_path_name()]=component
  assert len(found)==1
  next(iter(found.values())).set_editor_property('disable_post_process_blueprint',False)
  unreal.BlueprintEditorLibrary.compile_blueprint(bp)
  actor=sub.spawn_actor_from_class(bp.generated_class(),unreal.Vector(0,0,-50000),transient=True);actors.append(actor)
  face=next(c for c in actor.get_components_by_class(unreal.SkeletalMeshComponent) if c.get_name()=='Face')
  assert not face.get_editor_property('disable_post_process_blueprint')
  pp=face.get_post_process_instance();assert pp and pp.get_class()==abp.generated_class()
  for c in controls:
   assert abs(pp.get_editor_property(c['variable'])-c['defaut'])<0.0001,('Defaut non conserve',c['variable'])
   value=c['min']+(c['max']-c['min'])*0.6
   actor.call_method('NarvosAnimReel',('Face',c['variable'],value))
   assert abs(pp.get_editor_property(c['variable'])-value)<0.0001
   for v in c['activation']:
    actor.call_method('NarvosAnimBool',('Face',v,True));assert pp.get_editor_property(v)
   out['checks'].append({'sex':sex,'variable':c['variable'],'ok':True})
  assert unreal.EditorAssetLibrary.save_loaded_asset(bp,False);out['saved'].append(bp.get_path_name())
 out['ok']=True
except Exception:out['error']=traceback.format_exc()
finally:
 out['cleanup']=[bool(sub.destroy_actor(a)) for a in actors]
 (root/'.hermes/ASTRA_face_activation_20260915.json').write_text(json.dumps(out,indent=2),encoding='utf-8')
 print('FACE_ACTIVATION',out['ok'],out.get('error',''))