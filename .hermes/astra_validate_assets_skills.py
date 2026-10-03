import json,subprocess,sys,hashlib,re,runpy
from pathlib import Path
root=Path('E:/narvosprime-web-prototype')
skills=root/'WebPortal/.agents/skills'
validator=Path('C:/Users/aniss/.codex/skills/.system/skill-creator/scripts/quick_validate.py')
prior=json.loads((root/'.hermes/ASTRA_skills_revision_validation_2026-09-14.json').read_text())
archives=json.loads((root/'.hermes/sauvegardes/skills-revision-20260914-223239/archives-sha256.json').read_text(encoding='utf-8-sig'))
for row in prior:
 p=skills/row['skill'];check=subprocess.run([sys.executable,str(validator),str(p)],capture_output=True,text=True)
 row['validator']=check.returncode==0;row['output']=check.stdout.strip();row['broken_links']=[]
 for f in [p/'SKILL.md',*p.glob('references/*.md')]:
  if f.name=='claude-original.md':continue
  for target in re.findall(r'\]\(([^)]+)\)',f.read_text(encoding='utf-8')):
   if target.startswith(('http','#','/')):continue
   if not (f.parent/target.split('#')[0]).exists():row['broken_links'].append(str(f)+':'+target)
 row['original_references_unchanged']=all(hashlib.sha256(Path(x['Path']).read_bytes()).hexdigest().upper()==x['Hash'] for x in archives if '/'+row['skill']+'/' in x['Path'].replace(chr(92),'/'))
 assert row['validator'] and not row['broken_links'] and row['original_references_unchanged'],row
(root/'.hermes/ASTRA_skills_revision_validation_2026-09-14.json').write_text(json.dumps(prior,indent=2),encoding='utf-8')
print('12 Skills valides, références et archives vérifiées.',flush=True)
helpers=runpy.run_path(str(root/'scripts/unity-extraire-package.py'))
inventory=json.loads((root/'.hermes/ASTRA_unity_archives_inventory.json').read_text())
results=[]
for pack in inventory:
 if 'suko' in pack['archive'].lower():continue
 out=root/'WebPortal/public/asset_game/moteur_unity'/('echo_one_extrait' if 'Echo' in pack['archive'] else 'spaceship_engine_extrait')
 archive,cleanup=helpers['ouvrir_tar'](pack['archive'])
 entries={e['guid']:e for e in pack['entries'] if Path(e['path']).suffix.lower() in helpers['GARDER']}
 checked=[]
 with archive:
  for member in archive:
   bits=member.name.strip('/').split('/')
   if len(bits)!=2 or bits[1]!='asset' or bits[0] not in entries:continue
   e=entries[bits[0]];dest=Path(chr(92)*2+'?'+chr(92)+str(out/e['path']))
   expected=hashlib.sha256();actual=hashlib.sha256()
   with archive.extractfile(member) as f:
    for chunk in iter(lambda:f.read(1024*1024),b''):expected.update(chunk)
   with dest.open('rb') as f:
    for chunk in iter(lambda:f.read(1024*1024),b''):actual.update(chunk)
   assert expected.digest()==actual.digest(),e['path']
   checked.append({'path':e['path'],'bytes':e['bytes'],'sha256':actual.hexdigest()})
 cleanup()
 assert len(checked)==len(entries)
 results.append({'archive':pack['archive'],'destination':str(out),'checked':checked,'ok':True})
 print(out.name,len(checked),'fichiers identiques aux contenus de l’archive',flush=True)
(root/'.hermes/ASTRA_unity_extractions_verified.json').write_text(json.dumps(results,indent=2),encoding='utf-8')