"""Inventorie les archives Unity sans extraire ni modifier les sources."""
import tarfile, json, collections, time, runpy
from pathlib import Path
root=Path('E:/narvosprime-web-prototype')
unity=root/'WebPortal/public/asset_game/moteur_unity'
results=[]
helpers=runpy.run_path(str(root/'scripts/unity-extraire-package.py'))
for pack in sorted(unity.rglob('*.unitypackage')):
    if not any(x in pack.name.lower() for x in ('suko','spaceship')): continue
    print('Lecture archive :',pack.name,flush=True)
    entries={}
    archive,cleanup=helpers['ouvrir_tar'](str(pack))
    with archive:
        for item in archive:
            if not item.isfile():continue
            parts=item.name.strip('/').split('/')
            if len(parts)!=2:continue
            guid,kind=parts
            row=entries.setdefault(guid,{'guid':guid})
            if kind=='pathname':row['path']=archive.extractfile(item).read().decode('utf-8-sig').strip().split('\n')[0]
            elif kind=='asset':row['bytes']=item.size
            elif kind=='asset.meta':row['meta_bytes']=item.size
    cleanup()
    rows=[r for r in entries.values() if 'path' in r and 'bytes' in r]
    counts=collections.Counter(Path(r['path']).suffix.lower() for r in rows)
    result={'archive':str(pack),'files':len(rows),'by_extension':dict(counts),'entries':rows}
    if 'suko' in pack.name.lower():
        extracted=unity/'jsuko_extrait'
        missing=[];different=[]
        for row in rows:
            p=extracted/row['path']
            # Windows peut nécessiter le préfixe long pour des chemins >260 caractères.
            long=Path(chr(92)*2+'?'+chr(92)+str(p.resolve()))
            if not long.is_file():missing.append(row['path'])
            elif long.stat().st_size!=row['bytes']:different.append(row['path'])
        result.update(missing=missing,different_size=different,missing_importable=[p for p in missing if Path(p).suffix.lower() in helpers['GARDER']])
    results.append(result)
    (root/'.hermes/ASTRA_unity_archives_inventory.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
    print(pack.name,'fichiers',len(rows),'manquants',len(result.get('missing',[])),'tailles différentes',len(result.get('different_size',[])),dict(counts),flush=True)