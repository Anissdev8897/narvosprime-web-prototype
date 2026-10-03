import unreal,json
from pathlib import Path
out={}
for name in ['GeometryScript_AssetUtils','GeometryScript_MeshQueries','MorphTarget','DynamicMesh']:
 c=getattr(unreal,name,None)
 if c:out[name]={n:getattr(c,n).__doc__ for n in dir(c) if any(k in n.lower() for k in ['skeletal','skinned','morph','vertex_position','bounds'])}
Path('E:/narvosprime-web-prototype/.hermes/ASTRA_morph_measure_api.json').write_text(json.dumps(out,indent=2),encoding='utf8')