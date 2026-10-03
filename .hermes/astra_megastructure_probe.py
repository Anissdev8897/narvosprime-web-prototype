import unreal,json,traceback
from pathlib import Path
r={'levels':[],'errors':[]}
try:
 for name in ('L_assets','L_Showcase_level'):
  world=unreal.load_asset('/Game/Narvos/Megastructure_Scifi_World/Level/'+name)
  actors=unreal.GameplayStatics.get_all_actors_of_class(world,unreal.Actor)
  row={'name':name,'actors':[]};r['levels'].append(row)
  for a in actors:
   if not a:continue
   loc=a.get_actor_location()
   item={'name':a.get_name(),'class':a.get_class().get_path_name(),'position':[loc.x,loc.y,loc.z],'meshes':[]}
   for c in a.get_components_by_class(unreal.StaticMeshComponent):
    m=c.get_editor_property('static_mesh')
    if not m:continue
    item['meshes'].append({'path':m.get_path_name(),'collision':str(c.get_collision_enabled()),'materials':[v.get_path_name() if v else None for v in c.get_materials()]})
   row['actors'].append(item)
except Exception:r['errors'].append(traceback.format_exc())
Path('E:/narvosprime-web-prototype/.hermes/ASTRA_megastructure_levels_probe.json').write_text(json.dumps(r,ensure_ascii=False,indent=2),encoding='utf-8')