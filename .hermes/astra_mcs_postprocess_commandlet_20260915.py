from pathlib import Path
import json,unreal
root=Path('E:/narvosprime-web-prototype')
exec((root/'.hermes/astra_mcs_postprocess_appliquer_20260915.py').read_text(encoding='utf-8'))
assert json.loads((root/'.hermes/ASTRA_mcs_postprocess_resultat_20260915.json').read_text())['ok']
code=(root/'.hermes/astra_dependances_cibles_20260915.py').read_text(encoding='utf-8').replace('ASTRA_dependances_cibles_20260915.json','ASTRA_dependances_apres_adaptateurs_20260915.json')
exec(code)