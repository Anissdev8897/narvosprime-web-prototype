import unreal, re, json, traceback
from pathlib import Path
root=Path('E:/narvosprime-web-prototype')
text=(root/'WebPortal/Server/nanos_world/packages/narvos/Shared/Catalogs/MetaCustom.lua').read_text(encoding='utf-8')
options=re.findall(r'id = "([^"]+)", label = "[^"]*", genre = "([mf])", chemin = "([^"]+)"',text)
sub=unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
r={'checks':[],'errors':[]}; actors=[]
def mats(c): return [m.get_path_name() if m else None for m in c.get_materials()]
try:
 for sex in ('m','f'):
  bp=unreal.load_asset('/Game/Narvos/PontMetaHuman/BP_NarvosMH_'+sex.upper())
  a=sub.spawn_actor_from_class(bp.generated_class(),unreal.Vector(0,0,-50000),transient=True); actors.append(a)
  components={c.get_name():c for c in a.get_components_by_class(unreal.SkeletalMeshComponent)}
  for category,slot in [('haut','Torso'),('bas','Legs'),('chaussures','Feet')]:
   samples=[o for o in options if o[1]==sex and o[0].startswith(category+'_')][:2]
   for ident,genre,asset in samples:
    comp=components[slot]; before=mats(comp)
    a.call_method('NarvosMaillage',(slot,asset))
    mesh=comp.get_skinned_asset(); defaults=[]
    if mesh:
     defaults=[s.get_editor_property('material_interface') for s in mesh.get_editor_property('materials')]
    leader=comp.get_editor_property('leader_pose_component')
    r['checks'].append({'sex':sex,'id':ident,'slot':slot,'requested':asset,'mesh':mesh.get_path_name() if mesh else None,'before':before,'actual':mats(comp),'mesh_materials':[m.get_path_name() if m else None for m in defaults],'leader':leader.get_name() if leader else None})
except Exception:r['errors'].append(traceback.format_exc())
finally:
 r['cleanup']=[bool(sub.destroy_actor(a)) for a in actors]
 (root/'.hermes/ASTRA_mcs_vetements_probe.json').write_text(json.dumps(r,ensure_ascii=False,indent=2),encoding='utf-8')