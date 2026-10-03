import unreal,json
from pathlib import Path
w=unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
actors=unreal.GameplayStatics.get_all_actors_of_class(w,unreal.Actor)
a=next(x for x in actors if x.get_actor_label()=='ASTRA_TEST_WORK_TRANSIENT')
p='/Game/Narvos/MetaCustom/Skeletal_Meshes/Metahuman_Tall_Medium_Female/'
for comp,name in [('Torso','SK_Set_3_Work_Top'),('Legs','SK_Set_3_Work_Skirt')]:
 a.call_method('NarvosMaillage',(comp,p+name+'.'+name))
 c=next(x for x in a.get_components_by_class(unreal.SkeletalMeshComponent) if x.get_name()==comp)
 assert c.get_skinned_asset() and c.get_skinned_asset().get_name()==name
next(x for x in actors if x.get_actor_label()=='ASTRA_TEST_LIGHT_TRANSIENT').point_light_component.set_intensity(80)
Path('E:/narvosprime-web-prototype/.hermes/ASTRA_work_preview_applique_20260915.json').write_text(json.dumps({'ok':True}))