import unreal,json,traceback
from pathlib import Path
r={'planets':[],'errors':[]}
try:
 w=unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
 for a in unreal.GameplayStatics.get_all_actors_of_class(w,unreal.Actor):
  for c in a.get_components_by_class(unreal.StaticMeshComponent):
   m=c.get_editor_property('static_mesh')
   if not m or 'planet' not in m.get_name().lower():continue
   pos=a.get_actor_location();scale=a.get_actor_scale3d();b,e=a.get_actor_bounds(False)
   r['planets'].append({'actor':a.get_path_name(),'label':a.get_actor_label(),'mesh':m.get_path_name(),'materials':[x.get_path_name() if x else None for x in c.get_materials()],'location':[pos.x,pos.y,pos.z],'scale':[scale.x,scale.y,scale.z],'bounds_center':[b.x,b.y,b.z],'bounds_extent':[e.x,e.y,e.z]})
except Exception:r['errors'].append(traceback.format_exc())
finally:Path('E:/narvosprime-web-prototype/.hermes/ASTRA_planetes_probe.json').write_text(json.dumps(r,indent=2),encoding='utf-8')