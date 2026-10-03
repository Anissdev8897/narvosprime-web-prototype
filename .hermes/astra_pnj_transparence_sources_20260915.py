"""Compare les matériaux glTF source et ceux de l'export animé, sans les modifier."""
import json,struct,hashlib,io
from pathlib import Path
from PIL import Image
root=Path('E:/narvosprime-web-prototype');results=[]
def inspect(file):
 raw=file.read_bytes();assert raw[:4]==b'glTF'
 length,kind=struct.unpack_from('<II',raw,12);assert kind==0x4e4f534a
 gltf=json.loads(raw[20:20+length]);blob=raw[28+length:]
 images=[]
 for im in gltf.get('images',[]):
  row={'mime':im.get('mimeType')}
  if 'bufferView' in im:
   view=gltf['bufferViews'][im['bufferView']];offset=view.get('byteOffset',0);data=blob[offset:offset+view['byteLength']]
   try:
    pic=Image.open(io.BytesIO(data));row.update(mode=pic.mode,size=pic.size,alpha_extrema=pic.getchannel('A').getextrema() if 'A' in pic.getbands() else None)
   except Exception as error:row['unreadable']=str(error)
  images.append(row)
 return {'file':str(file),'sha256':hashlib.sha256(raw).hexdigest(),'materials':gltf.get('materials',[]),'images':images,'asset':gltf.get('asset')}
for folder in sorted((root/'WebPortal/public/models/pnj').iterdir()):
 if not folder.is_dir():continue
 merged=folder/'Meshy_AI_biped_Meshy_AI_Meshy_Merged_Animations.glb';source=folder/'Meshy_AI_biped_Character_output.glb'
 if not (merged.exists() and source.exists()):continue
 animated=inspect(merged)
 if not any(m.get('alphaMode','OPAQUE')=='BLEND' for m in animated['materials']):continue
 original=inspect(source)
 result={'id':folder.name,'animated':animated,'original':original}
 repaired=root/'WebPortal/public/models_repares/pnj'/folder.name/'Meshy_AI_biped_Character_output.glb'
 if repaired.exists():result['repaired']=inspect(repaired)
 results.append(result)
(root/'.hermes/ASTRA_pnj_transparence_sources_20260915.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
print('Exports animés BLEND comparés :',len(results))
print([(r['id'],[m.get('alphaMode','OPAQUE') for m in r['original']['materials']],[(i.get('mode'),i.get('alpha_extrema')) for i in r['animated']['images']]) for r in results])