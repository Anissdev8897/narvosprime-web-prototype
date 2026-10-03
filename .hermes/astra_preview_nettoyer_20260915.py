import unreal,json
from pathlib import Path
w=unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
sub=unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
names={'ASTRA_TEST_WORK_TRANSIENT','ASTRA_TEST_LIGHT_TRANSIENT'}
found=[x for x in unreal.GameplayStatics.get_all_actors_of_class(w,unreal.Actor) if x.get_actor_label() in names]
out={'destroyed':[bool(sub.destroy_actor(x)) for x in found]}
out['remaining']=[x.get_actor_label() for x in unreal.GameplayStatics.get_all_actors_of_class(w,unreal.Actor) if x.get_actor_label() in names]
out['dirty_maps']=[x.get_name() for x in unreal.EditorLoadingAndSavingUtils.get_dirty_map_packages()]
out['dirty_assets']=[x.get_name() for x in unreal.EditorLoadingAndSavingUtils.get_dirty_content_packages()]
Path('E:/narvosprime-web-prototype/.hermes/ASTRA_preview_nettoyage_20260915.json').write_text(json.dumps(out,indent=2),encoding='utf-8')