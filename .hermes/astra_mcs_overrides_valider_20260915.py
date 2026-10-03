import unreal, json, re, traceback
from pathlib import Path
root = Path('E:/narvosprime-web-prototype')
text = (root/'WebPortal/Server/nanos_world/packages/narvos/Shared/Catalogs/MetaCustom.lua').read_text(encoding='utf-8')
options = re.findall(r'id = "([^"]+)", label = "[^"]*", genre = "([mf])", chemin = "([^"]+)"', text)
sub = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
actors = []
result = {'ok':False, 'checks':[], 'saved':[]}
def paths(materials): return [m.get_path_name() if m else None for m in materials]
try:
    marker = unreal.load_asset('/Engine/EngineMaterials/DefaultMaterial')
    assert marker
    for sex in ('m','f'):
        bp = unreal.load_asset('/Game/Narvos/PontMetaHuman/BP_NarvosMH_'+sex.upper())
        actor = sub.spawn_actor_from_class(bp.generated_class(),unreal.Vector(0,0,-50000),transient=True)
        actors.append(actor)
        components = {c.get_name():c for c in actor.get_components_by_class(unreal.SkeletalMeshComponent)}
        for protected in ('Body','Face'):
            components[protected].set_material(0,marker)
        for category, name in [('haut','Torso'),('bas','Legs'),('chaussures','Feet')]:
            comp = components[name]
            samples = [o for o in options if o[1]==sex and o[0].startswith(category+'_')][:2]
            # Introduire aussi un override hors de la plage du mesh précédent.
            comp.set_material(12,marker)
            for item in samples + [None] + samples[::-1]:
                if comp.get_skinned_asset():
                    for index in range(len(comp.get_materials())): comp.set_material(index,marker)
                actor.call_method('NarvosMaillage',(name,item[2] if item else ''))
                mesh = comp.get_skinned_asset()
                if item:
                    assert mesh and mesh.get_path_name().split('.')[0] == item[2].split('.')[0]
                    expected = paths([s.get_editor_property('material_interface') for s in mesh.get_editor_property('materials')])
                    actual = paths(comp.get_materials())
                    assert actual == expected, (sex,name,item[0],actual,expected)
                    assert comp.get_editor_property('leader_pose_component') == components['Body']
                else:
                    assert mesh is None
                assert components['Body'].get_material(0) == marker
                assert components['Face'].get_material(0) == marker
                result['checks'].append({'sex':sex,'component':name,'id':item[0] if item else None,'ok':True})
        # Face passe également par NarvosMaillage pour le premier choix de tête.
        face = components['Face']; face_mesh = face.get_skinned_asset()
        assert face_mesh
        actor.call_method('NarvosMaillage',('Face',face_mesh.get_path_name()))
        assert face.get_material(0)==marker
        result['checks'].append({'sex':sex,'component':'Face','preserved':True})
    result['ok']=True
except Exception:
    result['error']=traceback.format_exc()
finally:
    result['cleanup']=[bool(sub.destroy_actor(a)) for a in actors]
    if result['ok'] and all(result['cleanup']):
        for sex in ('M','F'):
            bp=unreal.load_asset('/Game/Narvos/PontMetaHuman/BP_NarvosMH_'+sex)
            result['saved'].append({'path':bp.get_path_name(),'ok':unreal.EditorAssetLibrary.save_loaded_asset(bp,only_if_is_dirty=False)})
        result['ok']=all(x['ok'] for x in result['saved'])
    else: result['ok']=False
    (root/'.hermes/ASTRA_mcs_overrides_validation_20260915.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
    print(json.dumps(result))