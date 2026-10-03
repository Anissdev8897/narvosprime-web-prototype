"""Publie uniquement les commandes mesurées et dont l'adaptateur a été livré."""
import json, hashlib
from pathlib import Path
root=Path('E:/narvosprime-web-prototype')
server=root/'WebPortal/Server'
def lire(p): return json.loads(p.read_text(encoding='utf-8-sig'))
lot=server/'AssetBuilds/astra-20260915-lot4'
delivery=lire(lot/'livraison.json')
validation=lire(lot/'validation.json')
assert delivery['id']==validation['id']=='astra-20260915-lot4' and validation['ok']
required=set(validation['cook_process']['required_packages'])
for row in validation['packages']:
    if row['package'] in required:
        for file in row['files']:
            with (server/'Assets/narvos'/file['relative']).open('rb') as handle:
                assert hashlib.file_digest(handle,'sha256').hexdigest()==file['sha256']
        required.remove(row['package'])
assert not required
candidates=lire(root/'.hermes/ASTRA_face_candidats_20260915.json')['curseurs']
geometry=lire(root/'.hermes/ASTRA_face_geometrie_realtime_20260915.json')
activation=lire(root/'.hermes/ASTRA_face_activation_20260915.json')
assert geometry['ok'] and geometry['status']=='completed' and activation['ok']
assert len(geometry['meshes'])==6 and len(candidates)==15
variables={c['variable'] for c in candidates}
for mesh in geometry['meshes']:
    assert {c['variable'] for c in mesh['controls']}==variables
    assert all(c['changed_bones']>0 and c['max_delta']>0 for c in mesh['controls'])
assert len(activation['checks'])==30 and all(c['ok'] for c in activation['checks'])
out=server/'adk/_manifests/metacustom-curseurs-visage.json'
assert not out.exists(), 'Manifeste déjà présent : comparer avant remplacement'
out.write_text(json.dumps({'qualification':{'geometrie':True,'meshes':6,'lot':delivery['id'],
    'preuve':'.hermes/ASTRA_face_geometrie_realtime_20260915.json','client_nanos':False},
    'curseurs':candidates},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('15 commandes visage publiées ; validation visuelle nanos encore requise')