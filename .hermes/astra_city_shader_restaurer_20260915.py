import json,shutil,hashlib,os,subprocess
from pathlib import Path
root=Path('E:/narvosprime-web-prototype')
assert 'UnrealEditor' not in subprocess.check_output(['tasklist'],text=True,errors='replace'),'Unreal encore ouvert'
plan=json.loads((root/'.hermes/ASTRA_city_materiaux_sources_20260915.json').read_text(encoding='utf-8'))
assert plan['ok'] and not plan['missing']
backup=root/'.hermes/sauvegardes/city-shaders-20260915';assert not backup.exists()
backup.mkdir(parents=True)
config=root/'WebPortal/Server/adk/Config/DefaultEngine.ini';shutil.copy2(config,backup/'DefaultEngine.ini')
out={'restored':[],'redirects_added':[]}
for r in plan['assets']:
 if not r['restore'] and not r['new_file']:continue
 src=Path(r['original']);dst=Path(r['dest'])
 assert dst.resolve().is_relative_to((root/'WebPortal/Server/adk/Content/Narvos').resolve())
 assert src.resolve()!=dst.resolve() and dst.suffix=='.uasset'
 if dst.exists():shutil.copy2(dst,backup/dst.name)
 sha=hashlib.sha256(src.read_bytes()).hexdigest()
 tmp=dst.with_suffix('.astra-recovery-tmp');assert not tmp.exists()
 shutil.copy2(src,tmp);os.replace(tmp,dst) # rompre le lien dur sans ecrire dans l'original
 assert hashlib.sha256(src.read_bytes()).hexdigest()==sha==hashlib.sha256(dst.read_bytes()).hexdigest()
 out['restored'].append({'source':str(src),'target':str(dst),'sha256':sha})
text=config.read_text(encoding='utf-8')
extra=[]
for r in plan['mapping']:
 if 'OldName="'+r['old']+'"' not in text:
  extra.append('+PackageRedirects=(OldName="'+r['old']+'",NewName="'+r['new']+'")')
  out['redirects_added'].append(r)
if extra:config.write_text(text+'\n; Restauration des cinq materiaux source de ville et de leurs textures exactes.\n[CoreRedirects]\n'+'\n'.join(extra)+'\n',encoding='utf-8')
(root/'.hermes/ASTRA_city_shader_restauration_20260915.json').write_text(json.dumps(out,indent=2),encoding='utf-8')
print(len(out['restored']),'materiaux source restaures ;',len(extra),'redirections ajoutees')