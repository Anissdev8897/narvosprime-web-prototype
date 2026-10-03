import unreal,json
from pathlib import Path
editor=unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
out={'editor_methods':[n for n in dir(editor) if 'realtime' in n]}
sub=unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
for a in sub.get_all_level_actors():
 if a.get_actor_label()!='ASTRA_TEST_VISAGE_TRANSITOIRE':continue
 c=next(c for c in a.get_components_by_class(unreal.SkeletalMeshComponent) if c.get_name()=='Face')
 pp=c.get_post_process_instance();out['component']={}
 for p in ['disable_post_process_blueprint','pause_anims','no_skeleton_update','enable_animation','visibility_based_anim_tick_option','forced_lod_model','predicted_lod_level','post_process_anim_bplod_threshold']:
  try:out['component'][p]=str(c.get_editor_property(p))
  except Exception as e:out['component'][p]=str(e)
 out['instance']={p:str(pp.get_editor_property(p)) for p in ['Eye_Position_V','Eye_Type','Eye_Type_Default','Eye_Type_1','Eye_Type_2','Eye_Type_3','Enable_Eye_Position_V']}
editor.editor_set_viewport_realtime(True)
Path('E:/narvosprime-web-prototype/.hermes/ASTRA_face_tick_sonde_20260915.json').write_text(json.dumps(out,indent=2),encoding='utf-8')