import unreal,json
from pathlib import Path
m=unreal.load_asset('/Game/Narvos/MetaCustom/Metahuman_Ref/Materials/MI_Hair')
r={str(n):unreal.MaterialEditingLibrary.get_material_instance_scalar_parameter_value(m,n) for n in unreal.MaterialEditingLibrary.get_scalar_parameter_names(m)}
Path('E:/narvosprime-web-prototype/.hermes/ASTRA_cheveux_scalaires_20260915.json').write_text(json.dumps(r,indent=2))
print(r)