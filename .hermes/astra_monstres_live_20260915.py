from pathlib import Path
root=Path('E:/narvosprime-web-prototype')
code=(root/'.hermes/astra_pnj_live_20260915.py').read_text(encoding='utf-8')
code=code.replace('ASTRA_pnj_transparence_sources_20260915.json','ASTRA_monstres_sources_20260915.json').replace("'/Game/Narvos/pnj/'","'/Game/Narvos/pnj_monstre/'").replace('ASTRA_pnj_live_20260915.json','ASTRA_monstres_live_20260915.json')
exec(code)