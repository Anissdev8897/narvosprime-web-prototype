"""Stage/livraison d'un cook cible, en conservant les cles du pack existant.

Le builder complet reste separe. Ici le lot remplace des paquets qualifies :
les assets sans modification sont conserves, sans regenerer leurs identifiants.
Un cook termine avec des erreurs de shaders est refuse meme avec exit_code=0.
"""
from pathlib import Path
import argparse,hashlib,json,os,re,shutil,stat,subprocess,tomllib

ROOT=Path('E:/narvosprime-web-prototype')
SERVER=ROOT/'WebPortal/Server'
LIVE=SERVER/'Assets/narvos'
SECTIONS={
 'World':'maps','StaticMesh':'static_meshes','SkeletalMesh':'skeletal_meshes',
 'AnimSequence':'animations','AnimMontage':'animations','BlendSpace':'animations',
 'BlendSpace1D':'animations','AimOffsetBlendSpace':'animations','AimOffsetBlendSpace1D':'animations',
 'Material':'materials','MaterialInstanceConstant':'materials','SoundWave':'sounds','SoundCue':'sounds',
 'NiagaraSystem':'particles','ParticleSystem':'particles','Blueprint':'blueprints','WidgetBlueprint':'blueprints'
}
BAD_LOG=re.compile(r':\s*(?:Error|Fatal):|Failed to compile Material|Default Material will be used|doesn.t have a valid ShaderMap|Unable to find package for cooking|Couldn.t find file for package',re.I)

def sha(p):
 with Path(p).open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()

def identifier(value):
 if not re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}',value):raise ValueError('Identifiant de lot invalide')
 return value

def check_cook(process,log):
 if process.get('status')!='exited' or process.get('exit_code')!=0:
  raise ValueError('Cook non termine avec code zero')
 errors=[line for line in log.splitlines() if BAD_LOG.search(line)]
 if errors:raise ValueError('Cook non livrable : '+str(len(errors))+' erreur(s) asset/shader, premiere : '+errors[0])
 if not re.search(r'Cooked packages\s+\d+\s+Packages Remain\s+0',log):raise ValueError('Fin du cook non attestee')

def check_scope(process,packages):
 required=process.get('required_packages')
 if not isinstance(required,list) or not required or any(not isinstance(p,str) or not p.startswith('/Game/Narvos/') for p in required):
  raise ValueError('Perimetre attendu du cook absent ou invalide')
 missing=set(required)-set(packages)
 if missing:raise ValueError('Paquets obligatoires non cuits : '+', '.join(sorted(missing)))

def extend_manifest(text,entries):
 """Ajout sans changer aucun couple cle/chemin existant ni ses sections."""
 old=tomllib.loads(text);assets=old['assets'];additions={};added=[]
 for entry in sorted(entries,key=lambda x:x['paquet']):
  section=SECTIONS.get(entry['classe'])
  if not section:continue
  package=entry['paquet']
  if not package.startswith('/Game/Narvos/'):raise ValueError('Paquet hors montage Narvos')
  value=package.removeprefix('/Game/')
  values=assets.setdefault(section,{})
  if value in values.values():continue
  name=entry['nom']
  if not re.fullmatch(r'[A-Za-z0-9_-]+',name):raise ValueError('Nom incompatible nanos : '+name)
  key=name;counter=2
  while key in values:key=name+'_'+str(counter);counter+=1
  values[key]=value;additions.setdefault(section,[]).append('        '+key+' = '+json.dumps(value))
  added.append({'section':section,'key':key,'path':value})
 lines=text.splitlines();out=[];seen=set();current=None
 def finish():
  if current in additions:out.extend(additions[current]);seen.add(current)
 for line in lines:
  if line.strip().startswith('['):
   finish();m=re.fullmatch(r'\s*\[assets\.([a-z_]+)\]\s*',line);current=m.group(1) if m else None
  out.append(line)
 finish()
 for section in sorted(set(additions)-seen):out.extend(['','    [assets.'+section+']']+additions[section])
 result='\n'.join(out)+'\n';new=tomllib.loads(result)
 # Relire l'original : assets ci-dessus a ete enrichi pendant la construction.
 original=tomllib.loads(text)
 for section,values in original['assets'].items():
  for key,value in values.items():
   if new['assets'][section].get(key)!=value:raise ValueError('Identite existante modifiee')
 return result,added

def no_links(folder):
 for parent in [folder,*folder.parents]:
  if parent.exists() and parent.lstat().st_file_attributes & stat.FILE_ATTRIBUTE_REPARSE_POINT:
   raise ValueError('Jonction/lien interdit : '+str(parent))

def stage(args):
 process=json.loads(Path(args.process).read_text(encoding='utf-8-sig'))
 check_cook(process,Path(args.log).read_text(encoding='utf-8',errors='replace'))
 cook=Path(process['output']).resolve()/'Windows/NanosWorldADK/Content/Narvos'
 if not cook.is_relative_to((SERVER/'adk/Saved').resolve()):raise ValueError('Sortie hors ADK/Saved')
 no_links(cook);no_links(LIVE)
 candidate=SERVER/'AssetBuilds'/identifier(args.id)/'narvos';no_links(candidate)
 intent_path=candidate.parent/'staging.json'
 if candidate.exists() and not args.resume:raise ValueError('Candidat deja present ; reprise explicite necessaire')
 if candidate.exists():
  intent=json.loads(intent_path.read_text(encoding='utf-8'))
  if intent.get('id')!=args.id or intent.get('base_manifest_sha256')!=sha(LIVE/'Assets.toml') or intent.get('process_sha256')!=sha(args.process):
   raise ValueError('Reprise sur une autre base ou un autre cook interdite')
  if (candidate.parent/'validation.json').exists():raise ValueError('Candidat deja valide')
 for directory,folders,files in os.walk(LIVE):
  for name in folders+files:
   p=Path(directory)/name
   if p.lstat().st_file_attributes & stat.FILE_ATTRIBUTE_REPARSE_POINT:raise ValueError('Lien interne au pack : '+str(p))
 headers=sorted(p for p in cook.rglob('*') if p.suffix in ['.uasset','.umap'])
 if not headers:raise ValueError('Lot vide')
 inventory=json.loads((SERVER/'adk/_assets-inventory.json').read_text(encoding='utf-8'))
 by_package={}
 for row in inventory['assets']:
  if row['paquet'] not in by_package or row['classe'] in SECTIONS:by_package[row['paquet']]=row
 entries=[]
 for h in headers:
  package='/Game/Narvos/'+h.relative_to(cook).with_suffix('').as_posix()
  if package not in by_package:raise ValueError('Inventaire perime : '+package)
  entries.append(by_package[package])
 check_scope(process,[row['paquet'] for row in entries])
 manifest_before=sha(LIVE/'Assets.toml');text=(LIVE/'Assets.toml').read_text(encoding='utf-8-sig')
 engine=json.loads(Path('D:/Epic Games/UE_5.7/Engine/Build/Build.version').read_text())
 version='.'.join(str(engine[k]) for k in ['MajorVersion','MinorVersion','PatchVersion'])
 if tomllib.loads(text)['unreal']['unreal_version']!=version:raise ValueError('Version de base differente du cook')
 manifest,added=extend_manifest(text,entries)
 base_size=sum(p.stat().st_size for p in LIVE.rglob('*') if p.is_file())
 delta_size=sum(p.stat().st_size for p in cook.rglob('*') if p.is_file())
 if shutil.disk_usage(SERVER).free<base_size+delta_size+5*1024**3:raise ValueError('Espace insuffisant pour copie independante')
 print('Copie independante du pack existant',base_size,'octets',flush=True)
 candidate.parent.mkdir(parents=True,exist_ok=True)
 intent_path.write_text(json.dumps({'id':args.id,'base_manifest_sha256':manifest_before,'process_sha256':sha(args.process)},indent=2),encoding='utf-8')
 # Robocopy gere les chemins Windows longs et les dizaines de milliers de petits
 # paquets en parallele. Aucun /MIR, /PURGE ou deplacement. /IS recopie aussi les
 # fichiers deja presents : une copie interrompue n'est jamais acceptee par taille.
 with (candidate.parent/'copie-base.log').open('w',encoding='utf-8') as log:
  code=subprocess.run(['robocopy',str(LIVE),str(candidate),'/E','/COPY:DAT','/DCOPY:DAT','/R:1','/W:1','/MT:16','/IS','/IT','/XJ','/NP','/NFL','/NDL'],stdout=log,stderr=subprocess.STDOUT).returncode
 if code>=8:raise ValueError('Copie de base en echec, robocopy='+str(code))
 report={'ok':False,'id':args.id,'candidate':str(candidate),'base_manifest_sha256':manifest_before,'cook_process':process,'added_keys':added,'packages':[]}
 for h in headers:
  relative=h.relative_to(cook);target=candidate/'Narvos'/relative;target.parent.mkdir(parents=True,exist_ok=True)
  extensions=['.uasset','.umap','.uexp','.ubulk','.uptnl']
  source_files=[p for suffix in extensions if (p:=h.with_suffix(suffix)).is_file()]
  # Nettoyer uniquement les compagnons de CE paquet dans la copie du pack.
  for suffix in extensions:
   old=target.with_suffix(suffix)
   if old.exists():
    if not old.resolve().is_relative_to(candidate.resolve()):raise ValueError('Compagnon hors candidat')
    old.unlink()
  row={'package':'/Game/Narvos/'+relative.with_suffix('').as_posix(),'files':[]}
  for source in source_files:
   dest=target.parent/source.name;shutil.copyfile(source,dest);digest=sha(source)
   if sha(dest)!=digest:raise ValueError('Copie differente : '+str(dest))
   row['files'].append({'relative':dest.relative_to(candidate).as_posix(),'sha256':digest})
  report['packages'].append(row)
 (candidate/'Assets.toml').write_text(manifest,encoding='utf-8')
 if sha(LIVE/'Assets.toml')!=manifest_before:raise ValueError('Pack actif modifie pendant staging')
 report['manifest_sha256']=sha(candidate/'Assets.toml');report['ok']=True
 (candidate.parent/'validation.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
 print('STAGING_VERIFIE',len(headers),'paquets,',len(added),'nouvelles cles ; aucune livraison',flush=True)

def deploy(args):
 taskid=identifier(args.id);build=SERVER/'AssetBuilds'/taskid;candidate=build/'narvos'
 report=json.loads((build/'validation.json').read_text(encoding='utf-8'))
 if not report.get('ok') or report.get('id')!=taskid:raise ValueError('Validation absente')
 no_links(candidate);no_links(LIVE)
 if 'nanos' in subprocess.check_output(['tasklist','/FO','CSV','/NH'],text=True,errors='replace').lower():
  raise ValueError('Fermer nanos et son serveur avant livraison')
 if sha(LIVE/'Assets.toml')!=report['base_manifest_sha256']:raise ValueError('Base modifiee depuis validation')
 if sha(candidate/'Assets.toml')!=report['manifest_sha256']:raise ValueError('Manifeste candidat modifie')
 for row in report['packages']:
  for f in row['files']:
   path=(candidate/f['relative']).resolve()
   if not path.is_relative_to(candidate.resolve()) or sha(path)!=f['sha256']:raise ValueError('Candidat non conforme')
 backup=SERVER/'AssetBackups'/taskid/'narvos';no_links(backup)
 if backup.exists():raise ValueError('Sauvegarde deja presente')
 backup.parent.mkdir(parents=True,exist_ok=True)
 if not LIVE.resolve().is_relative_to((SERVER/'Assets').resolve()):raise ValueError('Pack actif hors dossier prevu')
 os.rename(LIVE,backup)
 try:os.rename(candidate,LIVE)
 except Exception:
  os.rename(backup,LIVE)
  raise
 delivery={'id':taskid,'live':str(LIVE),'backup':str(backup),'manifest_sha256':sha(LIVE/'Assets.toml'),'verified_packages':len(report['packages'])}
 (build/'livraison.json').write_text(json.dumps(delivery,indent=2),encoding='utf-8')
 print('LIVRAISON_TERMINEE',json.dumps(delivery),flush=True)

if __name__=='__main__':
 parser=argparse.ArgumentParser();sub=parser.add_subparsers(dest='command',required=True)
 s=sub.add_parser('stage');s.add_argument('--id',required=True);s.add_argument('--process',required=True);s.add_argument('--log',required=True);s.add_argument('--resume',action='store_true')
 d=sub.add_parser('deploy');d.add_argument('--id',required=True)
 args=parser.parse_args()
 (stage if args.command=='stage' else deploy)(args)