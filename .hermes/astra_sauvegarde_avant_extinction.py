import sqlite3,hashlib,json,datetime
from pathlib import Path
root=Path('E:/narvosprime-web-prototype')
stamp=datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
folder=root/'.hermes/sauvegardes'/('extinction-astra-'+stamp);folder.mkdir(parents=True)
source=Path('D:/steam/steamapps/common/nanos-world-playtest/Server/narvos_comptes.db')
with sqlite3.connect(source.as_uri()+'?mode=ro',uri=True) as live:
 with sqlite3.connect(folder/'narvos_comptes.db') as copy:
  live.backup(copy)
  result=copy.execute('PRAGMA quick_check').fetchall()
  assert result==[('ok',)],result
files=[root/'WebPortal/docs/narvos/AUDIT_NANOS_DEMANDES_ET_REPRISE_2026-09-14.md',root/'.hermes/REPRISE_APRES_EXTINCTION_ASTRA_2026-09-14.md',root/'scripts/adk-mcs-fonctions.mjs']
manifest={'time':stamp,'sqlite_backup':str(folder/'narvos_comptes.db'),'sqlite_quick_check':'ok','files':[]}
for f in files:
 data=f.read_bytes();(folder/f.name).write_bytes(data)
 manifest['files'].append({'path':str(f),'sha256':hashlib.sha256(data).hexdigest()})
(folder/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
(root/'.hermes/ASTRA_sauvegarde_extinction.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
print('Sauvegarde SQLite cohérente et documents copiés :',folder)