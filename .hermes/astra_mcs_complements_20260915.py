import unreal, json, traceback
from pathlib import Path
root=Path('E:/narvosprime-web-prototype')
out={'ok':False,'materials':[],'faces':[],'rigs':[]}
def pname(x): return x.get_path_name() if x else None
try:
 reg=unreal.AssetRegistryHelpers.get_asset_registry()
 for d in reg.get_assets_by_path('/Game/Narvos/MetaCustom/Material',recursive=True):
  m=d.get_asset(); row={'path':pname(m),'class':str(d.asset_class_path.asset_name)}
  if isinstance(m,unreal.MaterialInstanceConstant):
   row['parent']=pname(m.get_editor_property('parent'))
   row['textures']=[{'name':str(v.get_editor_property('parameter_info').get_editor_property('name')),'value':pname(v.get_editor_property('parameter_value'))} for v in m.get_editor_property('texture_parameter_values')]
  out['materials'].append(row)
 for path in ['/Game/Narvos/MetaCustom/Metahuman_Face_Customization/AnimBP_Face_Tool','/Game/Narvos/MetaCustom/Meta_Face_Tool/Animations/AnimBP_Face_Tool','/Game/Narvos/PontMetaHuman/ABP_NarvosVisage']:
  a=unreal.load_asset(path); row={'path':path,'loaded':bool(a)}
  if a:
   row['skeleton']=pname(a.get_editor_property('target_skeleton'))
   row['dependencies']=[str(x) for x in reg.get_dependencies(path,unreal.AssetRegistryDependencyOptions(True,True,False,False,False))]
   row['functions']=[v for v in dir(a) if 'graph' in v or 'node' in v]
  out['faces'].append(row)
 for name in ('Neck_CtrlRig','HeadMovementIK_Proc_CtrlRig'):
  a=unreal.load_asset('/Game/Narvos/MetaHumans/Common/Face/'+name)
  row={'name':name,'loaded':bool(a)}
  if a:
   row['methods']=[v for v in dir(a) if 'hierarchy' in v or 'controller' in v]
   try: row['keys']=[str(k) for k in a.hierarchy.get_keys()]
   except Exception as e: row['keys_error']=str(e)
  out['rigs'].append(row)
 out['ok']=True
except Exception: out['error']=traceback.format_exc()
(root/'.hermes/ASTRA_mcs_complements_20260915.json').write_text(json.dumps(out,indent=2),encoding='utf-8')
print('complements',out['ok'],out.get('error',''))