import unreal, json, traceback
from pathlib import Path
root=Path('E:/narvosprime-web-prototype')
r={'ok':False,'assets':[],'missing':[]}
try:
    reg=unreal.AssetRegistryHelpers.get_asset_registry()
    reg.scan_paths_synchronous(['/Game/SpaceShips_Vol1'],True)
    options=unreal.AssetRegistryDependencyOptions(include_soft_package_references=True,include_hard_package_references=True)
    for d in reg.get_assets_by_path('/Game/SpaceShips_Vol1',recursive=True):
        cls=str(d.asset_class_path.asset_name)
        if cls not in ('StaticMesh','Material','MaterialInstanceConstant','Texture2D','Blueprint'):continue
        path=str(d.package_name)
        obj=d.get_asset()
        row={'path':path,'class':cls,'loaded':obj is not None}
        if obj and cls=='StaticMesh':
            row['slots']=[s.get_editor_property('material_interface').get_path_name() if s.get_editor_property('material_interface') else None for s in obj.get_editor_property('static_materials')]
            bounds=obj.get_bounding_box()
            row['bounds']={'min':str(bounds.min),'max':str(bounds.max)}
        if obj and cls=='MaterialInstanceConstant':
            parent=obj.get_editor_property('parent'); row['parent']=parent.get_path_name() if parent else None
        if obj and cls=='Blueprint':row['generated']=obj.generated_class().get_path_name() if obj.generated_class() else None
        for dep in reg.get_dependencies(d.package_name,options) or []:
            name=str(dep)
            if name.startswith('/Game/') and not unreal.EditorAssetLibrary.does_asset_exist(name):
                r['missing'].append({'asset':path,'dependency':name})
        r['assets'].append(row)
    r['ok']=bool(r['assets']) and all(a['loaded'] for a in r['assets']) and not r['missing']
except Exception:r['error']=traceback.format_exc()
finally:
    (root/'.hermes/ASTRA_spaceships_probe_20260915.json').write_text(json.dumps(r,indent=2),encoding='utf-8')
    print(json.dumps(r))