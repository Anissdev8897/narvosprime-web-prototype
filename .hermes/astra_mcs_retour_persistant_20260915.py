import unreal, json, traceback
from pathlib import Path
root=Path('E:/narvosprime-web-prototype')
out={'ok':False,'checks':[]}; actors=[]
sub=unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
try:
 for sex in ['M','F']:
  path='/Game/Narvos/PontMetaHuman/BP_NarvosMH_'+sex
  bp=unreal.load_asset(path)
  assert unreal.EditorAssetLibrary.save_loaded_asset(bp,False)
  reload_result=unreal.EditorLoadingAndSavingUtils.reload_packages([bp.get_outermost()], unreal.ReloadPackagesInteractionMode.ASSUME_NEGATIVE)
  bp=unreal.load_asset(path)
  a=sub.spawn_actor_from_class(bp.generated_class(),unreal.Vector(321,456,789),transient=True);actors.append(a)
  values=a.call_method('NarvosDiagnosticMaillage',('Face','head','head_lod0_mesh__cheek_blow_left'))
  face=next(c for c in a.get_components_by_class(unreal.SkeletalMeshComponent) if c.get_name().lower()=='face')
  direct=face.get_socket_location('head')
  out['checks'].append({'sex':sex,'reload':str(reload_result),'diagnostic':str(values),'direct':str(direct)})
  assert (values[3]-direct).length()<0.01, 'Diagnostic different du composant reel'
  assert values[1], 'Instance postprocess absente de la sonde'
 out['ok']=True
except Exception:out['error']=traceback.format_exc()
finally:
 for a in actors:sub.destroy_actor(a)
 (root/'.hermes/ASTRA_mcs_retour_persistant_20260915.json').write_text(json.dumps(out,indent=2))
 print('ASTRA_RETOUR',json.dumps(out))