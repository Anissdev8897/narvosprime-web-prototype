from pathlib import Path
root=Path('E:/narvosprime-web-prototype')
exec((root/'.hermes/astra_city_shader_lot2_valider_20260915.py').read_text(encoding='utf-8'))
exec((root/'.hermes/astra_vehicules_qualifier_20260915.py').read_text(encoding='utf-8').replace('ASTRA_vehicules_qualification_unreal_20260915.json','ASTRA_vehicules_qualification_chaos_20260915.json'))