import unreal, json, shutil, traceback
from pathlib import Path
root=Path('E:/narvosprime-web-prototype')
out={'ok':False,'rigs':[],'retargeters':[]}
try:
 backup=root/'.hermes/sauvegardes/ik-mains-20260915'
 backup.mkdir(parents=True,exist_ok=False)
 names=['IK_NarvosMetaHuman','IK_NarvosMetaHumanCorps','RTG_NanosVersMetaHuman','RTG_NanosVersMetaHumanCorps']
 for name in names:
  source=root/'WebPortal/Server/adk/Content/Narvos/PontMetaHuman'/f'{name}.uasset'
  assert source.stat().st_nlink==1, 'Rompre lien hors editeur avant modification'
  shutil.copyfile(source,backup/source.name)
 env={};exec((root/'scripts/adk-pont-metahuman.py').read_text(encoding='utf-8'),env)
 for name in names[:2]:
  rig=unreal.load_asset('/Game/Narvos/PontMetaHuman/'+name)
  result=env['_qualifier_ik_mains'](rig)
  assert unreal.EditorAssetLibrary.save_loaded_asset(rig,False)
  out['rigs'].append({'name':name,**result})
 for name in names[2:]:
  rtg=unreal.load_asset('/Game/Narvos/PontMetaHuman/'+name);c=unreal.IKRetargeterController.get_controller(rtg)
  rig=c.get_ik_rig(unreal.RetargetSourceOrTarget.TARGET)
  chains=unreal.IKRigController.get_controller(rig).get_retarget_chains()
  before={str(x.chain_name):str(c.get_source_chain(x.chain_name)) for x in chains}
  env['_ancrer_mains_source'](c)
  after={str(x.chain_name):str(c.get_source_chain(x.chain_name)) for x in chains}
  assert before==after
  arms=[]
  for i in range(c.get_num_retarget_ops()):
   op=c.get_op_controller(i)
   if not isinstance(op,unreal.IKRetargetIKChainsController):continue
   for ch in op.get_settings().chains_to_retarget:
    if str(ch.target_chain_name) not in ['LeftArm','RightArm']:continue
    assert ch.enable_ik and ch.blend_to_source==1 and ch.blend_to_source_translation==1 and ch.blend_to_source_rotation==0
    arms.append({'chain':str(ch.target_chain_name),'source_position':ch.blend_to_source,'source_rotation':ch.blend_to_source_rotation})
  assert len(arms)==2
  assert unreal.EditorAssetLibrary.save_loaded_asset(rtg,False)
  out['retargeters'].append({'name':name,'mapping':after,'arms':arms})
 out['ok']=True
except Exception:out['error']=traceback.format_exc()
(root/'.hermes/ASTRA_ik_mains_20260915.json').write_text(json.dumps(out,indent=2),encoding='utf-8')
print('IK_MAINS',out['ok'],out.get('error',''))