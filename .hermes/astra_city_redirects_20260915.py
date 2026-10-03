import json,shutil,hashlib
from pathlib import Path
root=Path('E:/narvosprime-web-prototype')
prep=json.loads((root/'.hermes/ASTRA_city_dependances_preparation_20260915.json').read_text(encoding='utf-8'))
assert prep['ok'] and len(prep['mapping'])==109
report=json.loads((root/'.hermes/ASTRA_dependances_cibles_20260915.json').read_text(encoding='utf-8'))[0]
config=root/'WebPortal/Server/adk/Config/DefaultEngine.ini'
backup=root/'.hermes/sauvegardes/city-refs-20260915'
backup.mkdir(parents=True,exist_ok=True)
assert not (backup/'DefaultEngine.ini').exists(),'Redirects deja prepares'
shutil.copy2(config,backup/'DefaultEngine.ini')
paths={x['source'] for x in report['missing']+report['outside'] if x['source'].startswith('/Game/Narvos/')}
paths.update(x['new'] for x in prep['mapping'])
rows=[]
for p in sorted(paths):
 rel=p.replace('/Game/','')
 file=root/'WebPortal/Server/adk/Content'/(rel+'.uasset')
 if not file.exists():file=file.with_suffix('.umap')
 assert file.exists(),file
 saved=backup/file.relative_to(root/'WebPortal/Server/adk/Content')
 saved.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(file,saved)
 rows.append({'package':p,'backup':str(saved),'sha256':hashlib.sha256(file.read_bytes()).hexdigest()})
text=config.read_text(encoding='utf-8')
text+='\n; 15/09/2026 : references exactes de la ville. Copies qualifiees, aucune map dupliquee.\n[CoreRedirects]\n'
for row in prep['mapping']:
 text+='+PackageRedirects=(OldName="'+row['old']+'",NewName="'+row['new']+'")\n'
config.write_text(text,encoding='utf-8')
(root/'.hermes/ASTRA_city_resave_plan_20260915.json').write_text(json.dumps({'assets':rows,'mapping':prep['mapping']},indent=2),encoding='utf-8')
print(len(rows),'assets sauvegardes ; 109 redirects exacts')