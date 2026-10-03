import unreal,json,traceback
from pathlib import Path
root=Path('E:/narvosprime-web-prototype');out={'ok':False,'checks':[],'errors':[]}
data=json.loads((root/'WebPortal/Server/adk/_manifests/metacustom-materiaux.json').read_text())
opts=json.loads((root/'WebPortal/Server/adk/_manifests/metacustom-options.json').read_text())
sub=unreal.get_editor_subsystem(unreal.EditorActorSubsystem);actors=[]
def objet(path):return path if '.' in path else path+'.'+path.rsplit('/',1)[-1]
try:
 for sex in ['M','F']:
  bp=unreal.load_asset('/Game/Narvos/PontMetaHuman/BP_NarvosMH_'+sex)
  a=sub.spawn_actor_from_class(bp.generated_class(),unreal.Vector(),unreal.Rotator(),transient=True);actors.append(a)
  components={c.get_name():c for c in a.get_components_by_class(unreal.MeshComponent)}
  for ident in opts['identites']:
   if ident['genre']!=sex.lower():continue
   a.call_method('NarvosMaillage',('Face',objet(ident['visage'])))
   assert components['Face'].get_skinned_asset().get_path_name()==objet(ident['visage'])
   for slot in data['faces'][ident['id']]['materials']:
    a.call_method('NarvosMateriau',('Face',slot['index'],slot['material']))
    assert components['Face'].get_material(slot['index']).get_path_name()==slot['material']
    out['checks'].append({'sex':sex,'id':ident['id'],'slot':slot['index']})
  for groom in opts['grooms']:
   if groom.get('genre')!=sex.lower():continue
   comp=groom['composant']
   binding=unreal.load_asset(groom['liaison'])
   target=binding.get_editor_property('target_skeletal_mesh')
   assert target,groom['id']
   a.call_method('NarvosMaillage',('Face',target.get_path_name()))
   assert components['Face'].get_skinned_asset()==target
   a.call_method('NarvosGroom',(comp,objet(groom['groom']),objet(groom['liaison'])))
   assert components[comp].get_editor_property('groom_asset').get_path_name()==objet(groom['groom'])
   assert components[comp].get_editor_property('binding_asset')==binding
   for slot in data['grooms'][groom['id']]['materials']:
    a.call_method('NarvosMateriau',(comp,slot['index'],slot['material']))
    raw=components[comp].get_editor_property('override_materials')
    assert raw[slot['index']].get_path_name()==slot['material']
    effective=components[comp].get_material(slot['index'])
    assert effective and effective.get_path_name()==slot['material'],(groom['id'],slot['index'],str(effective))
    out['checks'].append({'sex':sex,'id':groom['id'],'slot':slot['index']})
 out['ok']=True
except Exception:out['errors'].append(traceback.format_exc())
finally:
 out['cleanup']=[bool(sub.destroy_actor(a)) for a in actors]
 (root/'.hermes/ASTRA_mcs_slots_pont_20260915.json').write_text(json.dumps(out,indent=2),encoding='utf-8')