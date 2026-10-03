import unreal,json,traceback,hashlib
from pathlib import Path
root=Path('E:/narvosprime-web-prototype');out={'ok':False,'removed':[]}
try:
 p=json.loads((root/'.hermes/ASTRA_mcs_joues_apercu_20260915.json').read_text());sub=unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
 for path in p['actors']:
  a=unreal.find_object(None,path)
  if a:
   assert path.startswith('/Game/NanosWorld/Maps/NanosWorldEntryMap.NanosWorldEntryMap:PersistentLevel.')
   assert sub.destroy_actor(a);out['removed'].append(path)
 for sex in ['M','F']:
  path='/Game/Narvos/PontMetaHuman/BP_NarvosMH_'+sex;assert unreal.EditorAssetLibrary.save_asset(path,only_if_is_dirty=False)
  data=(root/('WebPortal/Server/adk/Content/Narvos/PontMetaHuman/BP_NarvosMH_'+sex+'.uasset')).read_bytes()
  assert b'EqualEqual_StriStri' in data and b'SetMorphTarget' in data
  out[sex]={'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data)}
 out['ok']=True
except Exception:out['error']=traceback.format_exc()
(root/'.hermes/ASTRA_mcs_lot6_source_20260915.json').write_text(json.dumps(out,indent=2),encoding='utf8')
if out['ok']:unreal.SystemLibrary.quit_editor()