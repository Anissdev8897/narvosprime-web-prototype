import unreal,json,traceback
from pathlib import Path
out={'ok':False,'noise':[],'rigs':[],'retargeters':[]}
try:
 mat=unreal.load_asset('/Game/Narvos/CITY_PACK/BIG_CITY/MATERIALS/M_Fake_Interior2');mel=unreal.MaterialEditingLibrary
 for n in unreal.ObjectIterator(unreal.MaterialExpressionVectorNoise):
  if not n.get_path_name().startswith(mat.get_path_name()+':'):continue
  inputs=mel.get_inputs_for_material_expression(mat,n)
  out['noise'].append({'node':n.get_name(),'input_names':list(mel.get_material_expression_input_names(n)),'input_types':list(mel.get_material_expression_input_types(n)),'inputs':[{'name':i.get_name(),'class':i.get_class().get_name(),'output_name':mel.get_input_node_output_name_for_material_expression(n,i)} if i else None for i in inputs]})
 for name in ['IK_NanosMannequin','IK_NarvosMetaHuman','IK_NarvosMetaHumanCorps']:
  rig=unreal.load_asset('/Game/Narvos/PontMetaHuman/'+name);c=unreal.IKRigController.get_controller(rig)
  out['rigs'].append({'name':name,'solvers':c.get_num_solvers(),'goals':[g.get_name() for g in c.get_all_goals()],'chains':[{'chain':str(x.chain_name),'goal':str(c.get_retarget_chain_goal(x.chain_name)),'start':str(c.get_retarget_chain_start_bone(x.chain_name)),'end':str(c.get_retarget_chain_end_bone(x.chain_name))} for x in c.get_retarget_chains()]})
 for name in ['RTG_NanosVersMetaHuman','RTG_NanosVersMetaHumanCorps']:
  rtg=unreal.load_asset('/Game/Narvos/PontMetaHuman/'+name);c=unreal.IKRetargeterController.get_controller(rtg);ops=[]
  for index in range(c.get_num_retarget_ops()):
   o=c.get_op_controller(index)
   row={'index':index,'enabled':c.get_retarget_op_enabled(index),'class':o.get_class().get_name(),'methods':[x for x in dir(o) if any(t in x for t in ['get_settings','get_chain','get_goal'])]}
   if hasattr(o,'get_settings'):row['settings']=str(o.get_settings())
   ops.append(row)
  out['retargeters'].append({'name':name,'ops':ops})
 out['ok']=True
except Exception:out['error']=traceback.format_exc()
Path('E:/narvosprime-web-prototype/.hermes/ASTRA_noise_et_rigs_sonde_20260915.json').write_text(json.dumps(out,indent=2),encoding='utf-8')
print('NOISE_RIGS_SONDE',out['ok'],out.get('error',''))