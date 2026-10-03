import unreal,json
from pathlib import Path
r={'world':unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world().get_path_name(),'dirty_maps':[p.get_name() for p in unreal.EditorLoadingAndSavingUtils.get_dirty_map_packages()],'dirty_assets':[p.get_name() for p in unreal.EditorLoadingAndSavingUtils.get_dirty_content_packages()]}
Path('E:/narvosprime-web-prototype/.hermes/ASTRA_etat_reprise_20260915.json').write_text(json.dumps(r,indent=2),encoding='utf-8')