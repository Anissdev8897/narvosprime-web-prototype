import unreal, json, traceback
from pathlib import Path
root=Path('E:/narvosprime-web-prototype')
out={'ok':False,'lod':[],'eyes':[]}
actors=[]
try:
 sub=unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
 for sex in ['M','F']:
  bp=unreal.load_asset('/Game/Narvos/PontMetaHuman/BP_NarvosMH_'+sex)
  a=sub.spawn_actor_from_class(bp.generated_class(),unreal.Vector(),transient=True);actors.append(a)
  for c in a.get_components_by_class(unreal.LODSyncComponent):
   r={'sex':sex,'name':c.get_name()}
   for p in ['forced_lod','min_lod','num_lo_ds','components_to_sync','custom_lod_mapping']:
    try:r[p]=str(c.get_editor_property(p))
    except Exception as e:r[p]=str(e)
   out['lod'].append(r)
 for side in ['L','R']:
  mat=unreal.load_asset('/Game/Narvos/MetaCustom/Metahuman_Ref/MCS2/Face/Materials/MI_EyeRefractive_Inst_'+side)
  r={'side':side,'chain':[]};out['eyes'].append(r)
  while mat:
   entry={'path':mat.get_path_name(),'class':mat.get_class().get_name()};r['chain'].append(entry)
   if isinstance(mat,unreal.MaterialInstanceConstant):
    entry['scalars']={str(n):unreal.MaterialEditingLibrary.get_material_instance_scalar_parameter_value(mat,n) for n in unreal.MaterialEditingLibrary.get_scalar_parameter_names(mat) if any(k in str(n) for k in ['Iris','Color','Texture'])}
    entry['textures']={str(n):str(unreal.MaterialEditingLibrary.get_material_instance_texture_parameter_value(mat,n)) for n in unreal.MaterialEditingLibrary.get_texture_parameter_names(mat)}
    entry['switches']={str(n):unreal.MaterialEditingLibrary.get_material_instance_static_switch_parameter_value(mat,n) for n in unreal.MaterialEditingLibrary.get_static_switch_parameter_names(mat)}
    mat=mat.get_editor_property('parent')
   else:break
 out['ok']=True
except Exception:out['error']=traceback.format_exc()
finally:
 for a in actors:sub.destroy_actor(a)
 (root/'.hermes/ASTRA_mcs_yeux_lod_20260915.json').write_text(json.dumps(out,indent=2))