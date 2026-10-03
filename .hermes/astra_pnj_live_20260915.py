import unreal, json, traceback
from pathlib import Path
ROOT = Path('E:/narvosprime-web-prototype')
out = {'ok': False, 'rows': []}
try:
    source = json.loads((ROOT / '.hermes/ASTRA_pnj_transparence_sources_20260915.json').read_text(encoding='utf-8'))
    registry = unreal.AssetRegistryHelpers.get_asset_registry()
    for case in source:
        folder = '/Game/Narvos/pnj/' + case['id']
        for data in registry.get_assets_by_path(folder, recursive=True):
            if str(data.asset_class_path.asset_name) != 'SkeletalMesh':
                continue
            mesh = data.get_asset()
            row = {'id': case['id'], 'mesh': mesh.get_path_name(), 'slots': []}
            for slot in mesh.get_editor_property('materials'):
                mat = slot.get_editor_property('material_interface')
                s = {'name': str(slot.get_editor_property('material_slot_name')), 'material': mat.get_path_name() if mat else None}
                parents = []
                while isinstance(mat, unreal.MaterialInstanceConstant):
                    parents.append(mat.get_path_name())
                    mat = mat.get_editor_property('parent')
                s['parents'] = parents
                if isinstance(mat, unreal.Material):
                    s['base'] = mat.get_path_name()
                    s['blend'] = str(mat.get_editor_property('blend_mode'))
                    s['textures'] = [t.get_path_name() for t in unreal.MaterialEditingLibrary.get_used_textures(mat)]
                    node = unreal.MaterialEditingLibrary.get_material_property_input_node(mat, unreal.MaterialProperty.MP_OPACITY)
                    s['opacity_node'] = node.get_path_name() if node else None
                row['slots'].append(s)
            out['rows'].append(row)
    out['ok'] = True
except Exception:
    out['error'] = traceback.format_exc()
finally:
    (ROOT / '.hermes/ASTRA_pnj_live_20260915.json').write_text(json.dumps(out, indent=2), encoding='utf-8')
    print(json.dumps(out))