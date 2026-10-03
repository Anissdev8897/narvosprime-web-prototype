import unreal,json,traceback
from pathlib import Path
root=Path('E:/narvosprime-web-prototype');out={'ok':False,'meshes':[]}
try:
 opts=json.loads((root/'WebPortal/Server/adk/_manifests/metacustom-options.json').read_text())
 paths=[i['visage'] for i in opts['identites']]
 paths+=['/Game/Narvos/MetaCustom/Metahuman_Ref/MCSGavin/Male/Tall/NormalWeight/Body/m_tal_nrw_body','/Game/Narvos/MetaCustom/Metahuman_Ref/FCSBase/Female/Tall/NormalWeight/Body/f_tal_nrw_body']
 for p in paths:
  mesh=unreal.load_asset(p);assert mesh,p
  out['meshes'].append({'path':p,'morphs':[m.get_name() for m in mesh.get_editor_property('morph_targets')],'skeleton':mesh.skeleton.get_path_name()})
 out['ok']=True
except Exception:out['error']=traceback.format_exc()
(root/'.hermes/ASTRA_mcs_morphs_volumes_20260915.json').write_text(json.dumps(out,indent=2),encoding='utf8')