import unreal,json,traceback
from pathlib import Path
root=Path('E:/narvosprime-web-prototype');out={'ok':False,'checks':[]};actors=[]
sub=unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
try:
 opts=json.loads((root/'WebPortal/Server/adk/_manifests/metacustom-options.json').read_text())
 mats=json.loads((root/'WebPortal/Server/adk/_manifests/metacustom-materiaux.json').read_text())
 bindings=json.loads((root/'WebPortal/Server/adk/_manifests/metacustom-liaisons.json').read_text())
 bp=unreal.load_asset('/Game/Narvos/PontMetaHuman/BP_NarvosMH_M')
 for id in ['cheveux_hair_s_messy','cheveux_hair_l_straight','cheveux_hair_s_boblayered']:
  b=bindings['grooms'][id]['mcs2'];a=sub.spawn_actor_from_class(bp.generated_class(),unreal.Vector(),transient=True);actors.append(a)
  a.call_method('NarvosMaillage',('Face',b['cible']))
  a.call_method('NarvosGroom',('Hair',b['groom'],b['liaison']))
  for m in mats['grooms'][id]['materials']:a.call_method('NarvosMateriau',('Hair',m['index'],m['material']))
  hair=next(c for c in a.get_components_by_class(unreal.GroomComponent) if c.get_name().lower()=='hair')
  row={'id':id,'parent':str(hair.get_attach_parent()),'socket':str(hair.get_attach_socket_name()),'transform':str(hair.get_world_transform()),'props':{},'groom_props':{}}
  for p in ['groom_asset','binding_asset','use_cards','hair_groups_desc','simulation_settings','attachment_name','bounds_scale','use_attach_parent_bound','visible','hidden_in_game']:
   try:row['props'][p]=str(hair.get_editor_property(p))
   except Exception as e:row['props'][p]=str(e)
  groom=hair.get_editor_property('groom_asset')
  for p in ['hair_groups_info','hair_groups_rendering','hair_groups_interpolation','enable_global_interpolation','hair_groups_materials']:
   try:
    v=groom.get_editor_property(p);row['groom_props'][p]=[x.export_text() for x in v] if isinstance(v,unreal.Array) else str(v)
   except Exception as e:row['groom_props'][p]=str(e)
  row['materials']=[str(hair.get_material(i)) for i in range(hair.get_num_materials())]
  out['checks'].append(row)
 out['ok']=True
except Exception:out['error']=traceback.format_exc()
finally:
 for a in actors:sub.destroy_actor(a)
 (root/'.hermes/ASTRA_groom_composant_20260915.json').write_text(json.dumps(out,indent=2))
 print('ASTRA_GROOM_COMPOSANT',out['ok'])