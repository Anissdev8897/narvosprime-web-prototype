from pathlib import Path
import json
root=Path('E:/narvosprime-web-prototype')
# Réutiliser le lecteur de GLB, sans relancer sa collecte PNJ ni écraser son rapport.
code=(root/'.hermes/astra_pnj_transparence_sources_20260915.py').read_text(encoding='utf-8')
exec(code.split('for folder in sorted(')[0])
rows=[]
for folder in sorted((root/'WebPortal/public/models/pnj_monstre').iterdir()):
    if not folder.is_dir():continue
    rows.append({'id':folder.name,'files':[inspect(f) for f in folder.rglob('*.glb')]})
(root/'.hermes/ASTRA_monstres_sources_20260915.json').write_text(json.dumps(rows,indent=2),encoding='utf-8')
for r in rows:
    print(r['id'],[(Path(f['file']).name,[(m.get('name'),m.get('alphaMode','OPAQUE'),m.get('pbrMetallicRoughness',{}).get('baseColorFactor',[1,1,1,1])[3]) for m in f['materials']],[im.get('alpha_extrema') for im in f['images']]) for f in r['files']])