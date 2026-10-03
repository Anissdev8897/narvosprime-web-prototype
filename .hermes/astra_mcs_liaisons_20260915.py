import unreal,json,traceback,time
from pathlib import Path
root=Path('E:/narvosprime-web-prototype');manifest=root/'WebPortal/Server/adk/_manifests/metacustom-liaisons.json';out={'version':1,'ok':False,'grooms':{},'errors':[],'start':time.time()}
try:
 opts=json.loads((root/'WebPortal/Server/adk/_manifests/metacustom-options.json').read_text())
 for hair in opts['grooms']:
  groom=unreal.load_asset(hair['groom']);original=unreal.load_asset(hair['liaison']);source=original.target_skeletal_mesh
  assert groom and source
  entries={};out['grooms'][hair['id']]=entries
  for ident in opts['identites']:
   target=unreal.load_asset(ident['visage']);assert target
   if target==source:
    binding=original;created=False
   else:
    package='/Game/Narvos/MetaCustom/BindingsNarvos/GB_'+hair['id']+'_'+ident['id']
    if hair['id']=='cheveux_hair_s_messy' and ident['id']=='mcs2':package='/Game/Narvos/MetaCustom/BindingsNarvos/GB_Messy_mcs2'
    binding=unreal.load_asset(package) if unreal.EditorAssetLibrary.does_asset_exist(package) else None
    created=binding is None
    if not binding:binding=unreal.GroomLibrary.create_new_groom_binding_asset_with_path(package,groom,target,100,source,0)
    assert binding and binding.target_skeletal_mesh==target and binding.source_skeletal_mesh==source
    assert unreal.EditorAssetLibrary.save_loaded_asset(binding,only_if_is_dirty=False)
   groups=[{k:g.get_editor_property(k) for k in ['ren_lod_count','ren_root_count','sim_lod_count','sim_root_count']} for g in binding.group_infos]
   assert groups and all(g['sim_root_count']>0 and g['ren_root_count']>0 for g in groups),(hair['id'],ident['id'],groups)
   entries[ident['id']]={'liaison':binding.get_path_name(),'groom':groom.get_path_name(),'cible':target.get_path_name(),'source':source.get_path_name(),'groupes':groups,'cree':created}
   manifest.write_text(json.dumps(out,indent=2),encoding='utf8')
 out['ok']=True
except Exception:out['errors'].append(traceback.format_exc())
out['end']=time.time();manifest.write_text(json.dumps(out,indent=2),encoding='utf8')