import unreal,json,traceback
from pathlib import Path
root=Path('E:/narvosprime-web-prototype');out={'ok':False,'meshes':[]}
try:
 for label in ['body','face']:
  assert json.loads((root/f'.hermes/ASTRA_{label}_types_resultat_20260915.json').read_text())['ok']
 plan=json.loads((root/'.hermes/ASTRA_mcs_postprocess_plan_20260915.json').read_text())
 for x in plan:
  mesh=unreal.load_asset(x['mesh']);cls=unreal.load_asset(x['target']).generated_class()
  old=mesh.get_editor_property('post_process_anim_blueprint')
  assert old.get_path_name()==x['post_process'],x['mesh']
  mesh.set_editor_property('post_process_anim_blueprint',cls)
  assert mesh.get_editor_property('post_process_anim_blueprint')==cls
  assert unreal.EditorAssetLibrary.save_loaded_asset(mesh,False)
  out['meshes'].append({'mesh':x['mesh'],'post_process':cls.get_path_name()})
 out['ok']=True
except Exception:out['error']=traceback.format_exc()
(root/'.hermes/ASTRA_mcs_postprocess_resultat_20260915.json').write_text(json.dumps(out,indent=2),encoding='utf-8')
print('POSTPROCESS',out['ok'],len(out['meshes']))