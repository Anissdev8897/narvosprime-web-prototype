import unreal,json,traceback
from pathlib import Path
r={'ok':False,'rigs':[],'meshes':[]}
try:
 sk=unreal.load_asset('/Game/Narvos/MetaCustom/Metahuman_Ref/Common/Face/Face_Archetype_Skeleton')
 bones={str(n) for n in sk.get_reference_pose().get_bone_names()}
 r['skeleton_bones']=len(bones)
 for name in ['Neck_CtrlRig','HeadMovementIK_Proc_CtrlRig']:
  rig=unreal.load_asset('/Game/Narvos/MetaHumans/Common/Face/'+name)
  keys=[str(k.name) for k in rig.hierarchy.get_all_keys() if k.type==unreal.RigElementType.BONE]
  cls=rig.generated_class()
  cdo=unreal.get_default_object(cls)
  props={}
  for p in ['neckCorrMultU','neckCorrMultM','neckCorrMultD']:
   try:props[p]=str(cdo.get_editor_property(p))
   except Exception as e:props[p]={'error':str(e)}
  r['rigs'].append({'name':name,'class':cls.get_path_name(),'bones':len(keys),'missing_bones':sorted(set(keys)-bones),'neck_properties':props})
 reg=unreal.AssetRegistryHelpers.get_asset_registry()
 for a in reg.get_assets_by_path('/Game/Narvos/MetaCustom',recursive=True):
  if str(a.asset_class_path.asset_name)!='SkeletalMesh':continue
  mesh=a.get_asset();pp=mesh.get_editor_property('post_process_anim_blueprint')
  if pp:r['meshes'].append({'mesh':mesh.get_path_name(),'post_process':pp.get_path_name()})
 r['ok']=True
except Exception:r['error']=traceback.format_exc()
Path('E:/narvosprime-web-prototype/.hermes/ASTRA_face_contrat_20260915.json').write_text(json.dumps(r,indent=2),encoding='utf-8')
print('FACE_CONTRAT',r['ok'],r.get('error',''))