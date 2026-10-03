import unreal, json, traceback
from pathlib import Path
root=Path('E:/narvosprime-web-prototype')
prefix='/Game/SpaceShips_Vol1'
dest='/Game/Narvos/SpaceShips_Vol1'
names=['BP_GB4_Fighter','BP_GB4_SuperCarrier','BP_GB5_NukeFrigate','BP_GB6_Dreadnought','BP_GB7_CommanderShip']
out={'ok':False,'roots':[prefix+'/Blueprints/'+n for n in names]}
try:
    assert not (root/'WebPortal/Server/adk/Content/Narvos/SpaceShips_Vol1').exists(), 'Déjà promu : inspecter avant de relancer'
    reg=unreal.AssetRegistryHelpers.get_asset_registry()
    opts=unreal.AssetRegistryDependencyOptions(include_soft_package_references=True,include_hard_package_references=True)
    pending=list(out['roots']); selected=set()
    while pending:
        p=pending.pop()
        if p in selected:continue
        assert p.startswith(prefix+'/'),p
        assert unreal.EditorAssetLibrary.does_asset_exist(p),p
        selected.add(p)
        for dep in reg.get_dependencies(p,opts) or []:
            dep=str(dep)
            if dep.startswith('/Game/'):
                assert dep.startswith(prefix+'/'),dep
                pending.append(dep)
    out['selected']=sorted(selected)
    assets=[unreal.load_asset(p) for p in out['selected']]
    assert all(assets)
    renames=[]
    for p,obj in zip(out['selected'],assets):
        to=p.replace(prefix,dest,1)
        renames.append(unreal.AssetRenameData(obj,to.rsplit('/',1)[0],to.rsplit('/',1)[1]))
    assert unreal.AssetToolsHelpers.get_asset_tools().rename_assets(renames),'Rename refusé'
    out['saved']=[]
    for obj in assets:
        assert obj.get_path_name().startswith(dest+'/'),obj.get_path_name()
        assert unreal.EditorAssetLibrary.save_loaded_asset(obj,only_if_is_dirty=False),obj.get_path_name()
        out['saved'].append(obj.get_path_name())
    out['ok']=True
except Exception:out['error']=traceback.format_exc()
finally:
    (root/'.hermes/ASTRA_spaceships_promotion_20260915.json').write_text(json.dumps(out,indent=2),encoding='utf-8')
    print(json.dumps(out))