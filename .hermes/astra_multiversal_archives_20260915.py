import runpy,json,hashlib,shutil
from pathlib import Path
root=Path('E:/narvosprime-web-prototype')
h=runpy.run_path(str(root/'scripts/unity-extraire-package.py'))
folder=Path(h['chemin_long'](str(root/'WebPortal/public/asset_game/moteur_unity/Multiversal_Vehicle_Controller__Pro_-_Car_Physics_Controller_____Unity')))
archive=next(folder.rglob('*.unitypackage'))
destination=root/'WebPortal/public/asset_game/moteur_unity/multiversal_archives_extrait'
tar,cleanup=h['ouvrir_tar'](str(archive)); rows=[]
try:
    members=tar.getmembers(); byname={m.name:m for m in members}
    for m in members:
        if not m.isfile() or not m.name.endswith('/pathname'):continue
        path=tar.extractfile(m).read().decode('utf-8').strip().split('\n')[0]
        if not path.lower().endswith('.unitypackage'):continue
        asset=byname[m.name.rsplit('/',1)[0]+'/asset']
        dest=Path(h['chemin_long'](h['sur'](str(destination),path)))
        dest.parent.mkdir(parents=True,exist_ok=True)
        payload=tar.extractfile(asset).read();sha=hashlib.sha256(payload).hexdigest()
        if dest.exists():assert hashlib.sha256(dest.read_bytes()).hexdigest()==sha
        else:dest.write_bytes(payload)
        rows.append({'path':path,'extracted':str(dest),'sha256':sha,'bytes':len(payload)})
finally:tar.close();cleanup()
(root/'.hermes/ASTRA_multiversal_archives_20260915.json').write_text(json.dumps(rows,indent=2),encoding='utf-8')
print(json.dumps(rows,indent=2))