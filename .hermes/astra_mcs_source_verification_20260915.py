import unreal,json,traceback,hashlib
from pathlib import Path
root=Path('E:/narvosprime-web-prototype');out={'ok':False,'assets':[],'errors':[]}
try:
 for name in ['BP_NarvosMH_M','BP_NarvosMH_F']:
  p='/Game/Narvos/PontMetaHuman/'+name
  assert unreal.EditorAssetLibrary.save_asset(p,only_if_is_dirty=False)
  file=root/('WebPortal/Server/adk/Content/Narvos/PontMetaHuman/'+name+'.uasset')
  data=file.read_bytes();assert b'EqualEqual_StriStri' in data
  out['assets'].append({'path':p,'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data)})
 b=unreal.load_asset('/Game/Narvos/MetaCustom/BindingsNarvos/GB_Messy_mcs2')
 out['binding']={'path':b.get_path_name(),'groups':[{k:g.get_editor_property(k) for k in ['ren_lod_count','ren_root_count','sim_lod_count','sim_root_count']} for g in b.group_infos]}
 assert all(g['sim_root_count']>0 and g['ren_root_count']>0 for g in out['binding']['groups'])
 out['ok']=True
except Exception:out['errors'].append(traceback.format_exc())
(root/'.hermes/ASTRA_mcs_source_verification_20260915.json').write_text(json.dumps(out,indent=2),encoding='utf8')