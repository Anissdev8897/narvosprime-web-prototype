"""Qualification en lecture seule de la scène Alien avant raccordement."""
import unreal, json, traceback
from pathlib import Path
root=Path('E:/narvosprime-web-prototype')
r={'materials':{},'meshes':{},'floors':[],'errors':[]}
def path(o): return o.get_path_name() if o else None
try:
 world=unreal.load_asset('/Game/Narvos/Megastructure_Scifi_World/Level/L_Showcase_level')
 r['current_world']=path(unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world())
 r['dirty_maps']=[path(p) for p in unreal.EditorLoadingAndSavingUtils.get_dirty_map_packages()]
 actors=unreal.GameplayStatics.get_all_actors_of_class(world,unreal.Actor)
 for a in actors:
  for c in a.get_components_by_class(unreal.StaticMeshComponent):
   mesh=c.get_editor_property('static_mesh')
   if not mesh: continue
   mp=path(mesh)
   if mp not in r['meshes']:
    body=mesh.get_editor_property('body_setup')
    r['meshes'][mp]={'body_setup':path(body),'collision_trace_flag':str(body.get_editor_property('collision_trace_flag')) if body else None,'collision_primitives':unreal.EditorStaticMeshLibrary.get_simple_collision_count(mesh)}
   for mat in c.get_materials():
    key=path(mat)
    if key in r['materials']:continue
    chain=[]; seen=set();current=mat; overrides=[]
    while current and path(current) not in seen:
     seen.add(path(current));chain.append(path(current))
     if isinstance(current,unreal.MaterialInstance):
      overrides.extend(path(t.get_editor_property('parameter_value')) for t in current.get_editor_property('texture_parameter_values'))
      current=current.get_editor_property('parent')
     else:break
    r['materials'][key]={'chain':chain,'base_material':path(current),'blend_mode':str(current.get_editor_property('blend_mode')) if isinstance(current,unreal.Material) else None,'base_textures':[path(t) for t in unreal.MaterialEditingLibrary.get_used_textures(current)] if isinstance(current,unreal.Material) else [],'override_textures':overrides}
   if 'SM_floor_module_01' in mp:
    p=c.get_world_location(); b,e=c.get_local_bounds()
    r['floors'].append({'actor':path(a),'location':[p.x,p.y,p.z],'local_bounds':[[b.x,b.y,b.z],[e.x,e.y,e.z]],'collision':str(c.get_collision_enabled())})
 r['ok']=True
except Exception:r['errors'].append(traceback.format_exc());r['ok']=False
finally:(root/'.hermes/ASTRA_megastructure_qualification.json').write_text(json.dumps(r,ensure_ascii=False,indent=2),encoding='utf-8')