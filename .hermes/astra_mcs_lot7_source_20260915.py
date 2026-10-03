import unreal,json,traceback,hashlib
from pathlib import Path
root=Path('E:/narvosprime-web-prototype');out={'ok':False,'checks':[]};sub=unreal.get_editor_subsystem(unreal.EditorActorSubsystem);actors=[]
try:
 for sex in ['M','F']:
  bp=unreal.load_asset('/Game/Narvos/PontMetaHuman/BP_NarvosMH_'+sex)
  a=sub.spawn_actor_from_class(bp.generated_class(),unreal.Vector(),transient=True);actors.append(a)
  result=a.call_method('NarvosDiagnosticMaillage',('Face','FACIAL_C_NoseTip','head_lod0_mesh__cheek_blow_left'))
  sync=next(c for c in a.get_components_by_class(unreal.ActorComponent) if c.get_name().lower()=='lodsync')
  a.call_method('NarvosDetailSynchronise',('LODSync',0));assert sync.get_editor_property('forced_lod')==0
  a.call_method('NarvosDetailSynchronise',('LODSync',-1));assert sync.get_editor_property('forced_lod')==-1
  assert unreal.EditorAssetLibrary.save_loaded_asset(bp,False)
  path=root/'WebPortal/Server/adk/Content/Narvos/PontMetaHuman'/('BP_NarvosMH_'+sex+'.uasset')
  out['checks'].append({'sex':sex,'diagnostic':str(result),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'bytes':path.stat().st_size})
 out['ok']=True
except Exception:out['error']=traceback.format_exc()
finally:
 for a in actors:sub.destroy_actor(a)
 (root/'.hermes/ASTRA_mcs_lot7_source_20260915.json').write_text(json.dumps(out,indent=2))