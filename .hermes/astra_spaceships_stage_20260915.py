import pathlib, re, shutil, hashlib, json
root=pathlib.Path('E:/narvosprime-web-prototype')
source=root/'WebPortal/public/asset_game/asset_futuriste/Spaceship_Pack_1/Spaceship Pack 1'
target=root/'WebPortal/Server/adk/Content/SpaceShips_Vol1'
assert not target.exists(), 'Staging existe déjà : vérifier, ne pas écraser'
files=list(source.rglob('*'))
files=[f for f in files if f.is_file() and f.suffix.lower() in ('.uasset','.umap','.uexp','.ubulk')]
assert files
total=sum(f.stat().st_size for f in files)
assert shutil.disk_usage(target.parent).free > total*2 + 2*1024**3
rows=[]
for f in files:
    dest=target/f.relative_to(source)
    dest.parent.mkdir(parents=True,exist_ok=True)
    shutil.copyfile(f,dest)
    sha=hashlib.sha256(f.read_bytes()).hexdigest()
    assert sha==hashlib.sha256(dest.read_bytes()).hexdigest()
    rows.append({'source':str(f),'destination':str(dest),'sha256':sha})
(root/'.hermes/ASTRA_spaceships_stage_20260915.json').write_text(json.dumps({'files':rows,'bytes':total},indent=2),encoding='utf-8')
print(len(rows),total)