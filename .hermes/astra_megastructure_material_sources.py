import re, json, hashlib
from pathlib import Path
root=Path('E:/narvosprime-web-prototype')
base=root/'WebPortal/public/asset_game/asset_futuriste/MEGASTRUCTURE_Alien_Modular_Sci-Fi_World'
adk=root/'WebPortal/Server/adk/Content/Narvos/Megastructure_Scifi_World'
rows=[]
for name in ('MI_emissive_red.uasset','MI_emissive_white.uasset','M_emissive.uasset'):
 for tree in (base,adk):
  for p in tree.rglob(name):
   data=Path(chr(92)*2+'?'+chr(92)+str(p)).read_bytes()
   rows.append({'path':str(p),'sha256':hashlib.sha256(data).hexdigest(),'strings':[s.decode('ascii') for s in re.findall(rb'[ -~]{6,}',data) if any(k in s for k in (b'/Game/',b'Parent',b'Emiss',b'emiss'))]})
(root/'.hermes/ASTRA_megastructure_material_sources.json').write_text(json.dumps(rows,indent=2),encoding='utf-8')
print(json.dumps(rows,indent=2))