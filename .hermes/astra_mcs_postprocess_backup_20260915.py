from pathlib import Path
import json,shutil,hashlib,os
root=Path('E:/narvosprime-web-prototype')
rows=json.loads((root/'.hermes/ASTRA_face_contrat_20260915.json').read_text())['meshes']
mapping={
 '/Game/Narvos/MetaCustom/Meta_Body_Tool/Animations/AnimBP_Body_Tool1.AnimBP_Body_Tool1_C':'/Game/Narvos/PontMetaHuman/ABP_NarvosPersonnalisationCorps',
 '/Game/Narvos/MetaCustom/Metahuman_Face_Customization/AnimBP_Face_Tool.AnimBP_Face_Tool_C':'/Game/Narvos/PontMetaHuman/ABP_NarvosPersonnalisationVisage'
}
plan=[dict(x,target=mapping[x['post_process']]) for x in rows if x['post_process'] in mapping]
assert len(plan)==9
backup=root/'.hermes/sauvegardes/mcs-postprocess-20260915'
assert not (root/'.hermes/ASTRA_mcs_postprocess_plan_20260915.json').exists(),'Plan deja termine'
backup.mkdir(parents=True,exist_ok=True)
def sha(p):
 with p.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
for x in plan:
 rel=x['mesh'].split('.')[0].removeprefix('/Game/')+'.uasset'
 file=root/'WebPortal/Server/adk/Content'/rel;dest=backup/rel
 dest.parent.mkdir(parents=True,exist_ok=True)
 if dest.exists():assert sha(file)==sha(dest),'Sauvegarde differente : '+str(file)
 else:shutil.copyfile(file,dest)
 # Rompre tout lien dur avant la prochaine sauvegarde editoriale.
 temp=file.with_suffix('.astra-copy')
 if temp.exists():assert sha(file)==sha(temp),'Copie temporaire differente'
 else:shutil.copyfile(file,temp)
 os.replace(temp,file)
 with file.open('rb') as f:x['sha256_before']=hashlib.file_digest(f,'sha256').hexdigest()
(root/'.hermes/ASTRA_mcs_postprocess_plan_20260915.json').write_text(json.dumps(plan,indent=2),encoding='utf-8')
print('BACKUP',len(plan))