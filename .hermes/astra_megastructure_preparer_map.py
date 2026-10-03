"""Crée une copie dédiée, sans ouvrir ni modifier la map de la session."""
import unreal,json,traceback,hashlib
from pathlib import Path
root=Path('E:/narvosprime-web-prototype')
source='/Game/Narvos/Megastructure_Scifi_World/Level/L_Showcase_level'
dest='/Game/Narvos/Maps/Map_Megastructure'
source_file=root/'WebPortal/Server/adk/Content/Narvos/Megastructure_Scifi_World/Level/L_Showcase_level.umap'
r={'source':source,'destination':dest,'removed_demo_environment':[],'errors':[]}
try:
 editor=unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem)
 current=editor.get_editor_world().get_path_name()
 assert current=='/Game/Narvos/Maps/Map_Narvos.Map_Narvos',current
 assert not unreal.EditorAssetLibrary.does_asset_exist(dest),'La copie existe déjà : examiner avant reprise'
 r['source_sha256_before']=hashlib.sha256(source_file.read_bytes()).hexdigest()
 world=unreal.load_asset(source)
 original=unreal.GameplayStatics.get_all_actors_of_class(world,unreal.Actor)
 r['source_actors']=len(original)
 assert len(original)==605,'Scène source différente de la qualification'
 copy=unreal.AssetToolsHelpers.get_asset_tools().duplicate_asset('Map_Megastructure','/Game/Narvos/Maps',world)
 assert isinstance(copy,unreal.World),'Duplication World échouée'
 actors=unreal.GameplayStatics.get_all_actors_of_class(copy,unreal.Actor)
 assert len(actors)==605,'Copie incomplète'
 # Le ciel est géré par Client/Ciel.lua ; les autres mondes sont toujours chargés.
 # Retirer uniquement ces acteurs de la NOUVELLE copie, jamais des sources.
 globals_classes={'DirectionalLight','SkyLight','SkyAtmosphere','ExponentialHeightFog','PostProcessVolume','BP_sky_C'}
 for a in actors:
  if a.get_class().get_name() in globals_classes:
   item={'name':a.get_name(),'class':a.get_class().get_name()}
   a.destroy_actor()
   r['removed_demo_environment'].append(item)
 after=unreal.GameplayStatics.get_all_actors_of_class(copy,unreal.Actor)
 assert len(after)==599,(len(after),r['removed_demo_environment'])
 assert all(a.get_class().get_name() not in globals_classes for a in after)
 assert editor.get_editor_world().get_path_name()==current,'Monde courant changé'
 r['saved']=unreal.EditorLoadingAndSavingUtils.save_map(copy,dest)
 assert r['saved'],'Sauvegarde de la copie échouée'
 r['source_sha256_after']=hashlib.sha256(source_file.read_bytes()).hexdigest()
 assert r['source_sha256_before']==r['source_sha256_after'],'Source modifiée'
 r['copy_actors']=len(after);r['current_world']=current;r['ok']=True
except Exception:r['errors'].append(traceback.format_exc());r['ok']=False
finally:(root/'.hermes/ASTRA_megastructure_map_preparation.json').write_text(json.dumps(r,indent=2),encoding='utf-8')