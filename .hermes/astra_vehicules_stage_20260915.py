from pathlib import Path
import hashlib,json,shutil,os
root=Path('E:/narvosprime-web-prototype')
assets=root/'WebPortal/public/asset_game';content=root/'WebPortal/Server/adk/Content'
sources={
 'HoverVehicles':assets/'asset_futuriste/Sci-Fi Modular Hover Vehicles/Sci-Fi Modular Hover Vehicles/Content/HoverVehicles',
 'DD_Vehicles_Basic':assets/'asset_epoque_moderne/Drivable Cars - Basic Vehicle System - Unreal Engine/Drivable Cars - Basic Vehicle System - Unreal Engine/Content/DD_Vehicles_Basic'
}
def long(p):return Path(chr(92)*2+'?'+chr(92)+str(p.resolve()))
def sha(p):
 with p.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
plan=[]
for name,source in sources.items():
 assert not (content/name).exists(),'Destination deja presente : '+name
 source=long(source);files=[p for p in source.rglob('*') if p.is_file() and p.suffix.lower() in ['.uasset','.umap','.uexp','.ubulk']]
 assert files,name
 plan.append((name,source,files))
size=sum(p.stat().st_size for _,_,files in plan for p in files)
assert shutil.disk_usage(content).free>size*2+10*1024**3
config=root/'WebPortal/Server/adk/Config/DefaultGame.ini'
backup=root/'.hermes/sauvegardes/vehicules-stage-20260915';backup.mkdir(parents=True,exist_ok=True)
assert not (backup/config.name).exists()
shutil.copyfile(config,backup/config.name)
text=config.read_text(encoding='utf-8')
for name in sources:
 line='+DirectoriesToNeverCook=(Path="'+name+'")'
 if line not in text:text+='\n; Copie de qualification vehicules 15/09/2026, pas encore livrable.\n'+line+'\n'
config.write_text(text,encoding='utf-8')
report={'ok':False,'bytes':size,'packs':[]}
for name,source,files in plan:
 rows=[]
 for p in files:
  dest=long(content/name/p.relative_to(source));dest.parent.mkdir(parents=True,exist_ok=True)
  before=sha(p);shutil.copyfile(p,dest);assert sha(dest)==before
  rows.append({'relative':str(p.relative_to(source)),'sha256':before})
 report['packs'].append({'name':name,'source':str(source),'count':len(rows),'files':rows})
 print(name,len(rows),flush=True)
report['ok']=True
(root/'.hermes/ASTRA_vehicules_stage_20260915.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print('STAGE_OK',size)