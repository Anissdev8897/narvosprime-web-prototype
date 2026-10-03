import unreal,json,traceback,hashlib
from pathlib import Path
root=Path('E:/narvosprime-web-prototype')
promotion=json.loads((root/'.hermes/ASTRA_spaceships_promotion_20260915.json').read_text())
sub=unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
actors=[];out={'ok':False,'assemblages':[]}
try:
    assert promotion['ok']
    for origin in promotion['roots']:
        bp=unreal.load_asset(origin.replace('/Game/SpaceShips_Vol1','/Game/Narvos/SpaceShips_Vol1'))
        actor=sub.spawn_actor_from_class(bp.generated_class(),unreal.Vector(0,0,-50000),transient=True)
        assert actor
        actors.append(actor)
        components=[]
        for c in actor.get_components_by_class(unreal.StaticMeshComponent):
            mesh=c.get_editor_property('static_mesh')
            materials=c.get_materials()
            components.append({'component':c.get_name(),'mesh':mesh.get_path_name() if mesh else None,'materials':[m.get_path_name() if m else None for m in materials]})
            if mesh:assert materials and all(materials),(bp.get_path_name(),c.get_name())
        assert any(c['mesh'] for c in components)
        out['assemblages'].append({'bp':bp.get_path_name(),'components':components})
    out['ok']=True
except Exception:out['error']=traceback.format_exc()
finally:
    out['cleanup']=[bool(sub.destroy_actor(a)) for a in actors]
    if out['ok'] and all(out['cleanup']):
        out['saved']=[]
        for path in promotion['saved']:
            obj=unreal.load_asset(path)
            assert unreal.EditorAssetLibrary.save_loaded_asset(obj,only_if_is_dirty=False),path
            out['saved'].append(path)
        source=json.loads((root/'.hermes/ASTRA_spaceships_stage_20260915.json').read_text())
        out['sources_intactes']=all(hashlib.sha256(Path(x['source']).read_bytes()).hexdigest()==x['sha256'] for x in source['files'])
        out['ok']=out['sources_intactes']
    else:out['ok']=False
    (root/'.hermes/ASTRA_spaceships_assemblages_20260915.json').write_text(json.dumps(out,indent=2),encoding='utf-8')
    print(json.dumps(out))