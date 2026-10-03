import os, re, json
from pathlib import Path
from collections import Counter
root=Path('E:/narvosprime-web-prototype')
source=Path(chr(92)*2+'?'+chr(92)+str(root/'WebPortal/public/asset_game'))
packs={}
candidates=[]
all_files=0
model_ext={'.fbx','.obj','.glb','.gltf','.blend','.max','.stl'}
known=re.compile(r'CityTraffic|Drivable Cars|Ridable.?Motor|Hover Vehicles|Spaceship|20x Vehicles|Modern Tanks|Multiversal_Vehicle|echo_one_extrait|spaceship_engine_extrait',re.I)
# Ne pas assimiler une pièce à un véhicule : cette passe ne produit que des
# candidats, ensuite qualifiés dans Unreal et par le contrôleur nanos.
vehicle_name=re.compile(r'(?:^|[_ -])(ship|spaceship|fighter|vehicle|hovertank|car|truck|motorbike|shuttle|helicopter|jet|aircraft|tank)(?:[_ -]|$)',re.I)
for directory, dirs, files in os.walk(source):
    for name in files:
        all_files+=1
        f=Path(directory)/name; rel=f.relative_to(source)
        pack='/'.join(rel.parts[:2])
        ext=f.suffix.lower()
        in_pack=bool(known.search(str(rel)))
        is_model=ext in model_ext or (ext=='.uasset' and name.startswith(('SM_','SK_','SKM_','BP_')))
        if (in_pack and is_model) or (is_model and vehicle_name.search(f.stem)) or (in_pack and ext=='.unitypackage'):
            size=f.stat().st_size
            candidates.append({'pack':pack,'file':str(rel),'bytes':size,'extension':ext,'qualification':'à vérifier : assemblage, pièce ou décor'})
            item=packs.setdefault(pack,{'files':0,'bytes':0,'extensions':Counter()})
            item['files']+=1;item['bytes']+=size;item['extensions'][ext]+=1
data={'files_examined':all_files,'candidate_count':len(candidates),'packs':packs,'candidates':candidates,
      'limits':'Inventaire de fichiers candidats, pas un décompte de véhicules pilotables. FBX/OBJ et variantes peuvent décrire le même modèle. Les archives Unity non extraites et modèles nommés génériquement exigent une seconde passe.'}
(root/'.hermes/ASTRA_vehicules_inventaire_20260915.json').write_text(json.dumps(data,indent=2,ensure_ascii=False),encoding='utf-8')
print(json.dumps({'files_examined':all_files,'candidates':len(candidates),'packs':packs},indent=2,ensure_ascii=False))