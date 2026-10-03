import unreal,json
from pathlib import Path
m=unreal.load_asset('/Game/Narvos/Megastructure_Scifi_World/Materials/MI_emissive_red')
out={'previous_before':globals().get('before'), 'current':{k:[str(v) for v in m.get_editor_property(k)] for k in ('scalar_parameter_values','vector_parameter_values','texture_parameter_values')}}
Path('E:/narvosprime-web-prototype/.hermes/ASTRA_emissif_parameters_compare.json').write_text(json.dumps(out,indent=2),encoding='utf-8')