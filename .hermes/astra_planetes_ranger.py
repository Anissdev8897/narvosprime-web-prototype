import unreal,json,traceback
from pathlib import Path
root=Path('E:/narvosprime-web-prototype')
r=json.loads((root/'.hermes/ASTRA_planetes_ajout.json').read_text());r['previous_errors']=r['errors'];r['errors']=[]
try:
 w=unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
 labels={p['label'] for p in r['planets']}
 selected=[a for a in unreal.GameplayStatics.get_all_actors_of_class(w,unreal.Actor) if a.get_actor_label() in labels]
 assert len(selected)==2
 orbital=unreal.GameplayStatics.get_streaming_level(w,'/Game/Narvos/Maps/Map_Orbital')
 assert orbital
 assert unreal.EditorLevelUtils.move_actors_to_level(selected,orbital,False,False)==2
 selected=[a for a in unreal.GameplayStatics.get_all_actors_of_class(w,unreal.Actor) if a.get_actor_label() in labels]
 assert len(selected)==2
 for a in selected:
  assert a.get_outermost().get_name()=='/Game/Narvos/Maps/Map_Orbital'
  row=next(p for p in r['planets'] if p['label']==a.get_actor_label())
  assert (a.get_actor_location()-unreal.Vector(*row['position'])).length()<1
  row.update(actor=a.get_path_name(),level=a.get_outermost().get_name())
 for p in unreal.EditorLoadingAndSavingUtils.get_dirty_map_packages():
  assert p.get_name() in ('/Game/Narvos/Maps/Map_Megastructure','/Game/Narvos/Maps/Map_Orbital')
  assert unreal.EditorLoadingAndSavingUtils.save_map(unreal.load_asset(p.get_name()),p.get_name())
 assert not unreal.EditorLoadingAndSavingUtils.get_dirty_map_packages()
 r['ok']=True;r['delivered']=False
except Exception:r['ok']=False;r['errors'].append(traceback.format_exc())
finally:(root/'.hermes/ASTRA_planetes_ajout.json').write_text(json.dumps(r,indent=2),encoding='utf-8')