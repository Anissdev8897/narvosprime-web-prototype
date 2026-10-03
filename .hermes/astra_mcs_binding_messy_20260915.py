import unreal,json,traceback
from pathlib import Path
root=Path('E:/narvosprime-web-prototype');out={'ok':False,'errors':[]}
try:
 opts=json.loads((root/'WebPortal/Server/adk/_manifests/metacustom-options.json').read_text())
 hair=next(g for g in opts['grooms'] if g['id']=='cheveux_hair_s_messy')
 ident=next(i for i in opts['identites'] if i['id']=='mcs2')
 groom=unreal.load_asset(hair['groom']);original=unreal.load_asset(hair['liaison']);source=original.target_skeletal_mesh;target=unreal.load_asset(ident['visage'])
 package='/Game/Narvos/MetaCustom/BindingsNarvos/GB_Messy_mcs2'
 assert not unreal.EditorAssetLibrary.does_asset_exist(package),'Already exists'
 binding=unreal.GroomLibrary.create_new_groom_binding_asset_with_path(package,groom,target,100,source,0)
 assert binding and binding.target_skeletal_mesh==target and binding.source_skeletal_mesh==source
 out.update(path=binding.get_path_name(),source=source.get_path_name(),target=target.get_path_name(),groups=[str(g) for g in binding.group_infos])
 assert len(binding.group_infos)>0,'No groups'
 assert unreal.EditorAssetLibrary.save_loaded_asset(binding,only_if_is_dirty=False)
 out['ok']=True
except Exception:out['errors'].append(traceback.format_exc())
(root/'.hermes/ASTRA_mcs_binding_messy_mcs2_20260915.json').write_text(json.dumps(out,indent=2),encoding='utf-8')