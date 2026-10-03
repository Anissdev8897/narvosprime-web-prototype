import unreal,json,traceback
from pathlib import Path
root=Path('E:/narvosprime-web-prototype');out={'ok':False,'grooms':[]}
try:
 opts=json.loads((root/'WebPortal/Server/adk/_manifests/metacustom-options.json').read_text())
 for o in opts['grooms']:
  if o['sorte']!='cheveux':continue
  g=unreal.load_asset(o['groom']);r={'id':o['id']}
  for p in ['hair_groups_lod','hair_groups_cards','hair_groups_meshes','hair_groups_info','hair_groups_physics','enable_global_interpolation']:
   try:
    v=g.get_editor_property(p)
    r[p]=[x.export_text() for x in v] if isinstance(v,unreal.Array) else str(v)
   except Exception as e:r[p]=str(e)
  out['grooms'].append(r)
 out['ok']=True
except Exception:out['error']=traceback.format_exc()
(root/'.hermes/ASTRA_groom_lod_20260915.json').write_text(json.dumps(out,indent=2))