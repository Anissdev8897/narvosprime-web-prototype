import json,traceback,unreal
from pathlib import Path
root=Path('E:/narvosprime-web-prototype')
data=json.loads((root/'WebPortal/Server/adk/_bornes-forge.json').read_text())
out={'ok':False,'meshes':[],'errors':[]}
try:
 for row in data['meshes']:
  mesh=unreal.load_asset(row['paquet']);assert mesh,row['paquet']
  body=mesh.get_editor_property('body_setup')
  agg=body.get_editor_property('agg_geom') if body else None
  out['meshes'].append({'path':row['paquet'],'complexity':str(body.get_editor_property('collision_trace_flag')) if body else None,
   'shapes':{key:len(agg.get_editor_property(key)) for key in ['box_elems','sphere_elems','sphyl_elems','convex_elems']} if agg else {}})
 out['ok']=True
except Exception:out['errors'].append(traceback.format_exc())
(root/'.hermes/ASTRA_forge_collisions_20260915.json').write_text(json.dumps(out,indent=2),encoding='utf-8')