import unreal,json
from pathlib import Path
p='/Game/Narvos/MetaCustom/Material/Inst_Set_3_Work_Suit'
m=unreal.load_asset(p)
out={'exists':unreal.EditorAssetLibrary.does_asset_exist(p),'loaded':bool(m)}
if m:
 out['parent']=str(m.get_editor_property('parent'))
 out['textures']=[str(x) for x in m.get_editor_property('texture_parameter_values')]
 out['set_doc']=unreal.MaterialEditingLibrary.set_material_instance_texture_parameter_value.__doc__
 out['parent_names']=[str(x) for x in unreal.MaterialEditingLibrary.get_texture_parameter_names(m.get_editor_property('parent'))]
Path('E:/narvosprime-web-prototype/.hermes/ASTRA_work_probe_20260915.json').write_text(json.dumps(out,indent=2),encoding='utf-8')