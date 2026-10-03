import json,shutil,hashlib,os,subprocess
from pathlib import Path
root=Path('E:/narvosprime-web-prototype')
assert 'UnrealEditor' not in subprocess.check_output(['tasklist'],text=True,errors='replace'),'Unreal encore ouvert'
plan=json.loads((root/'.hermes/ASTRA_city_shader_lot2_plan_20260915.json').read_text())
assert len(plan['roots'])==18
backup=root/'.hermes/sauvegardes/city-shaders-lot2-20260915';assert not backup.exists();backup.mkdir(parents=True)
config=root/'WebPortal/Server/adk/Config/DefaultEngine.ini';shutil.copyfile(config,backup/'DefaultEngine.ini')
out={'restored':[],'redirects_added':[],'source_missing':plan['missing']}
for row in plan['assets']:
 if not row['restore']:continue
 src=Path(row['original']);dst=Path(row['dest']);rel=dst.relative_to(root/'WebPortal/Server/adk/Content')
 assert dst.resolve().is_relative_to((root/'WebPortal/Server/adk/Content/Narvos').resolve())
 saved=backup/rel;saved.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(dst,saved)
 digest=hashlib.sha256(src.read_bytes()).hexdigest()
 temp=dst.with_suffix('.astra-recovery-tmp');assert not temp.exists();shutil.copyfile(src,temp);os.replace(temp,dst)
 assert hashlib.sha256(src.read_bytes()).hexdigest()==digest==hashlib.sha256(dst.read_bytes()).hexdigest()
 out['restored'].append({'source':str(src),'target':str(dst),'sha256':digest})
text=config.read_text(encoding='utf-8');extra=[]
for row in plan['assets']:
 if 'OldName="'+row['old']+'"' not in text:
  extra.append('+PackageRedirects=(OldName="'+row['old']+'",NewName="'+row['new']+'")');out['redirects_added'].append({'old':row['old'],'new':row['new']})
if extra:config.write_text(text+'\n; 15/09 : restauration des references des materiaux en echec du deuxieme cook.\n[CoreRedirects]\n'+'\n'.join(extra)+'\n',encoding='utf-8')
(root/'.hermes/ASTRA_city_shader_lot2_restauration_20260915.json').write_text(json.dumps(out,indent=2),encoding='utf-8')
print('RESTORED',len(out['restored']),'REDIRECTS',len(extra),'SOURCE_MISSING',len(plan['missing']))