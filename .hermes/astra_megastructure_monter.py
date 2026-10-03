"""Monte la copie Alien et vérifie le sol avant de sauvegarder les deux maps."""
import unreal,json,traceback,shutil
from pathlib import Path
root=Path('E:/narvosprime-web-prototype')
dest='/Game/Narvos/Maps/Map_Megastructure'
r={'errors':[],'probes':[]}
def vec(v):return [v.x,v.y,v.z]
try:
 editor=unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem)
 world=editor.get_editor_world()
 assert world.get_path_name()=='/Game/Narvos/Maps/Map_Narvos.Map_Narvos'
 stream=unreal.GameplayStatics.get_streaming_level(world,dest)
 dirty=[p.get_name() for p in unreal.EditorLoadingAndSavingUtils.get_dirty_map_packages()]
 assert not dirty or (stream and dirty==['/Game/Narvos/Maps/Map_Narvos']),'Maps non sauvegardées : préserver la session'
 backup=root/'.hermes/sauvegardes/megastructure-montage-20260914'
 backup.mkdir(parents=True,exist_ok=True)
 for name in ('Map_Narvos','Map_Megastructure'):
  file=root/('WebPortal/Server/adk/Content/Narvos/Maps/'+name+'.umap')
  if stream:assert (backup/file.name).exists(),'Sauvegarde de reprise absente'
  else:
   assert not (backup/file.name).exists(),'Sauvegarde déjà existante'
   shutil.copy2(file,backup/file.name)
 if not stream:stream=unreal.EditorLevelUtils.add_level_to_world_with_transform(world,dest,unreal.LevelStreamingAlwaysLoaded,unreal.Transform())
 assert stream,'Montage échoué'
 actors=[a for a in unreal.GameplayStatics.get_all_actors_of_class(world,unreal.Actor) if a.get_outermost().get_name()==dest]
 # Le WorldSettings de la copie n'est pas énuméré comme acteur du monde persistant.
 assert len(actors)==598,len(actors)
 floor=next(a for a in actors if a.get_name()=='StaticMeshActor_1')
 assert (floor.get_actor_location()-unreal.Vector(400,10,0)).length()<1,'Déjà déplacé : ne pas appliquer deux fois'
 # Même convention que les mondes actifs : positions physiques, transform de niveau neutre.
 delta=unreal.Vector(-8513420,10385420,150000)
 before={a.get_path_name():a.get_actor_location() for a in actors}
 roots=[a for a in actors if not a.get_attach_parent_actor()]
 for a in roots:
  if a.get_editor_property('root_component'):a.set_actor_location(before[a.get_path_name()]+delta,False,True)
 misplaced=[]
 for a in actors:
  if not a.get_editor_property('root_component'):continue
  expected=before[a.get_path_name()]+delta
  if (a.get_actor_location()-expected).length()>1:misplaced.append(a.get_path_name())
 assert not misplaced,misplaced
 transform=stream.get_editor_property('level_transform')
 assert transform.translation.length()<0.01,'Double décalage'
 for dx,dy in ((0,0),(100,0),(-100,0),(0,100),(0,-100)):
  x=delta.x+1650+dx;y=delta.y+1260+dy
  hit=unreal.SystemLibrary.line_trace_single(world,unreal.Vector(x,y,delta.z+500),unreal.Vector(x,y,delta.z-500),unreal.TraceTypeQuery.TRACE_TYPE_QUERY1,False,[],unreal.DrawDebugTrace.NONE,True)
  assert hit,'Aucun sol au point de contrôle'
  values=hit.to_tuple();point=values[4]
  r['probes'].append({'xy':[x,y],'impact':vec(point),'hit':str(hit)})
 assert all(abs(p['impact'][2]-delta.z)<2 for p in r['probes']),'Sol inattendu'
 copy=unreal.load_asset(dest)
 r['saved_copy']=unreal.EditorLoadingAndSavingUtils.save_map(copy,dest)
 r['saved_persistent']=unreal.EditorLoadingAndSavingUtils.save_map(world,'/Game/Narvos/Maps/Map_Narvos')
 assert r['saved_copy'] and r['saved_persistent'],'Sauvegarde incomplète'
 r.update(actors=len(actors),offset=vec(delta),arrival=[delta.x+1650,delta.y+1260,delta.z+100],center=[delta.x+6721,delta.y+38593,delta.z],ok=True)
except Exception:r['errors'].append(traceback.format_exc());r['ok']=False
finally:(root/'.hermes/ASTRA_megastructure_montage.json').write_text(json.dumps(r,indent=2),encoding='utf-8')