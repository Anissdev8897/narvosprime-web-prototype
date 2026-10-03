import unreal,json
from pathlib import Path
p='/Game/Narvos/Maps/Map_Megastructure'
w=unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
a=[x for x in unreal.GameplayStatics.get_all_actors_of_class(w,unreal.Actor) if x.get_outermost().get_name()==p]
source=unreal.load_asset('/Game/Narvos/Megastructure_Scifi_World/Level/L_Showcase_level')
s=unreal.GameplayStatics.get_all_actors_of_class(source,unreal.Actor)
r={'count':len(a),'missing_names':sorted(set(x.get_name() for x in s)-set(x.get_name() for x in a)),'extra_names':sorted(set(x.get_name() for x in a)-set(x.get_name() for x in s)),'dirty_maps':[str(x) for x in unreal.EditorLoadingAndSavingUtils.get_dirty_map_packages()]}
Path('E:/narvosprime-web-prototype/.hermes/ASTRA_megastructure_stream_probe.json').write_text(json.dumps(r,indent=2))