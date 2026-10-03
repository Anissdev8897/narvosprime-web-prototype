import runpy,json,hashlib,gzip,tempfile,shutil,tarfile
from pathlib import Path, PurePosixPath
root=Path('E:/narvosprime-web-prototype')
h=runpy.run_path(str(root/'scripts/unity-extraire-package.py'))
archives=json.loads((root/'.hermes/ASTRA_multiversal_archives_20260915.json').read_text())
results=[]
for row in archives:
    archive=Path(row['extracted'])
    assert hashlib.sha256(archive.read_bytes()).hexdigest()==row['sha256']
    name=Path(row['path']).stem
    out=root/'WebPortal/public/asset_game/moteur_unity/multiversal_vehicles_extrait'/name
    ref=root/'WebPortal/public/asset_game/moteur_unity/multiversal_references_unity'/name
    # Les références exigent des accès aléatoires. Décompresser une fois évite
    # de relire le gzip entier pour chaque paire asset/asset.meta.
    unpacked=tempfile.TemporaryFile()
    with gzip.open(archive,'rb') as compressed:shutil.copyfileobj(compressed,unpacked,1024*1024)
    unpacked.seek(0)
    tar=tarfile.open(fileobj=unpacked,mode='r:')
    record={'archive':str(archive),'checked':[],'references':[],'entries':[]}
    try:
        members=tar.getmembers(); lookup={m.name:m for m in members}
        for m in members:
            if not m.isfile() or not m.name.endswith('/pathname'):continue
            original=tar.extractfile(m).read().decode('utf-8').strip().split('\n')[0].replace('\\','/')
            path=PurePosixPath(original)
            assert not path.is_absolute() and '..' not in path.parts and ':' not in original
            guid=m.name.rsplit('/',1)[0]
            member=lookup.get(guid+'/asset')
            if not member:continue
            record['entries'].append({'guid':guid,'path':original,'bytes':member.size})
            if path.suffix.lower() in h['GARDER']:
                expected=hashlib.sha256(tar.extractfile(member).read()).hexdigest()
                dest=Path(h['chemin_long'](str(out/original)))
                assert hashlib.sha256(dest.read_bytes()).hexdigest()==expected,original
                record['checked'].append({'path':original,'sha256':expected})
            # Conserver les affectations auteur et les réglages d'import comme
            # références, sans prétendre que Unity et Unreal les exécutent pareil.
            for suffix, content in [('',member),('.meta',lookup.get(guid+'/asset.meta'))]:
                if content is None:continue
                if not suffix and path.suffix.lower() not in {'.mat','.prefab','.asset','.anim','.controller'}:continue
                dest=Path(h['chemin_long'](str(ref/(original+suffix))))
                payload=tar.extractfile(content).read(); sha=hashlib.sha256(payload).hexdigest()
                dest.parent.mkdir(parents=True,exist_ok=True)
                if dest.exists():assert hashlib.sha256(dest.read_bytes()).hexdigest()==sha
                else:dest.write_bytes(payload)
                record['references'].append({'path':original+suffix,'sha256':sha})
        record['ok']=True
        results.append(record)
        print(name,len(record['checked']),'vérifiés',len(record['references']),'références',flush=True)
    finally:tar.close();unpacked.close()
(root/'.hermes/ASTRA_multiversal_verified_20260915.json').write_text(json.dumps(results,indent=2),encoding='utf-8')