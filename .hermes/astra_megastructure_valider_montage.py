"""Valide le déplacement déjà réalisé et sauvegarde uniquement ces deux maps."""
import unreal,json,traceback,hashlib
from pathlib import Path
root=Path('E:/narvosprime-web-prototype');dest='/Game/Narvos/Maps/Map_Megastructure'
r={'errors':[]}
try:
 w=unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
 assert w.get_path_name()=='/Game/Narvos/Maps/Map_Narvos.Map_Narvos'
 stream=unreal.GameplayStatics.get_streaming_level(w,dest)
 assert stream and stream.get_editor_property('level_transform').translation.length()<0.01
 source=unreal.load_asset('/Game/Narvos/Megastructure_Scifi_World/Level/L_Showcase_level')
 originals={a.get_name():a for a in unreal.GameplayStatics.get_all_actors_of_class(source,unreal.Actor)}
 actors=[a for a in unreal.GameplayStatics.get_all_actors_of_class(w,unreal.Actor) if a.get_outermost().get_name()==dest]
 assert len(actors)==598
 delta=unreal.Vector(-8513420,10385420,150000)
 for a in actors:
  if a.get_editor_property('root_component'):
   assert (a.get_actor_location()-originals[a.get_name()].get_actor_location()-delta).length()<1,a.get_name()
 x,y=-8511120,10387420
 probes=[]
 for dx,dy in ((0,0),(100,0),(-100,0),(0,100),(0,-100)):
  hit=unreal.SystemLibrary.line_trace_single(w,unreal.Vector(x+dx,y+dy,151000),unreal.Vector(x+dx,y+dy,149500),unreal.TraceTypeQuery.TRACE_TYPE_QUERY1,False,[],unreal.DrawDebugTrace.NONE,True)
  assert hit
  values=hit.to_tuple();p=values[5];normal=values[7];actor=values[9]
  assert values[0] and abs(p.z-150000)<2 and normal.z>0.99
  assert actor.get_outermost().get_name()==dest
  probes.append({'impact':[p.x,p.y,p.z],'normal':[normal.x,normal.y,normal.z],'actor':actor.get_path_name()})
 copy=unreal.load_asset(dest)
 assert unreal.EditorLoadingAndSavingUtils.save_map(copy,dest)
 assert unreal.EditorLoadingAndSavingUtils.save_map(w,'/Game/Narvos/Maps/Map_Narvos')
 assert not unreal.EditorLoadingAndSavingUtils.get_dirty_map_packages()
 prep=json.loads((root/'.hermes/ASTRA_megastructure_map_preparation.json').read_text())
 source_file=root/'WebPortal/Server/adk/Content/Narvos/Megastructure_Scifi_World/Level/L_Showcase_level.umap'
 assert hashlib.sha256(source_file.read_bytes()).hexdigest()==prep['source_sha256_before']
 r.update(ok=True,actors=598,source_unchanged=True,offset=[delta.x,delta.y,delta.z],arrival=[x,y,150100],probes=probes,saved_copy=True,saved_persistent=True,delivered=False)
except Exception:r['ok']=False;r['errors'].append(traceback.format_exc())
finally:(root/'.hermes/ASTRA_megastructure_montage_verifie.json').write_text(json.dumps(r,indent=2),encoding='utf-8')