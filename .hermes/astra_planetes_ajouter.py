"""Réutilise deux corps planétaires existants sur des routes orbitales distinctes."""
import unreal,json,traceback,shutil,math
from pathlib import Path
root=Path('E:/narvosprime-web-prototype');r={'planets':[],'errors':[]}
try:
 w=unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
 assert w.get_path_name()=='/Game/Narvos/Maps/Map_Narvos.Map_Narvos'
 assert not unreal.EditorLoadingAndSavingUtils.get_dirty_map_packages()
 actors=unreal.GameplayStatics.get_all_actors_of_class(w,unreal.Actor)
 by_label={a.get_actor_label():a for a in actors}
 specs=[('Narvos_Planete_Alien_Megastructure','SM_PlanetSphere11',(3000000,2200000,600000)),('Narvos_Planete_Sylve','SM_PlanetSphere',(-2600000,2200000,450000))]
 assert all(label not in by_label for label,_,_ in specs),'Planète déjà créée'
 backup=root/'.hermes/sauvegardes/planetes-alien-sylve-20260914';backup.mkdir(parents=True,exist_ok=True)
 for name in ('Map_Narvos','Map_Orbital'):
  file=root/('WebPortal/Server/adk/Content/Narvos/Maps/'+name+'.umap')
  assert not (backup/file.name).exists(),'Sauvegarde déjà présente'
  shutil.copy2(file,backup/file.name)
 sub=unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
 planets=json.loads((root/'.hermes/ASTRA_planetes_probe.json').read_text(encoding='utf-8'))['planets']
 for label,origin,xyz in specs:
  pos=unreal.Vector(*xyz)
  for p in planets:
   if '/Scenery/Planets/' not in p['mesh']:continue
   distance=math.dist(xyz,p['bounds_center'])
   assert distance>47800+max(p['bounds_extent'])+10000,'Chevauchement avec '+p['label']
  source=by_label[origin]
  actor=sub.duplicate_actor(source,w,pos-source.get_actor_location())
  assert actor,'Duplication échouée'
  actor.set_actor_label(label)
  actor.set_actor_location(pos,False,True)
  assert (actor.get_actor_location()-pos).length()<1
  center,extent=actor.get_actor_bounds(False)
  radius=max(extent.x,extent.y,extent.z)
  assert 40000<radius<42000,'Échelle différente du corps qualifié'
  r['planets'].append({'label':label,'actor':actor.get_path_name(),'level':actor.get_outermost().get_name(),'position':list(xyz),'radius':radius,'portal_radius':47800,'source':source.get_path_name()})
 dirty=unreal.EditorLoadingAndSavingUtils.get_dirty_map_packages()
 assert all(p.get_name() in ('/Game/Narvos/Maps/Map_Narvos','/Game/Narvos/Maps/Map_Orbital') for p in dirty)
 for p in dirty:
  world=unreal.load_asset(p.get_name())
  assert unreal.EditorLoadingAndSavingUtils.save_map(world,p.get_name())
 assert not unreal.EditorLoadingAndSavingUtils.get_dirty_map_packages()
 r['ok']=True;r['delivered']=False
except Exception:r['ok']=False;r['errors'].append(traceback.format_exc())
finally:(root/'.hermes/ASTRA_planetes_ajout.json').write_text(json.dumps(r,indent=2),encoding='utf-8')