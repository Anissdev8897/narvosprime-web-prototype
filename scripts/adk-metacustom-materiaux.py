"""Exporte les slots reels des grooms et visages MCS, sans modifier les assets.

A executer dans Unreal (PythonScript commandlet ou editeur), puis regenerer
narvos-metacustom-to-lua.mjs. Les indices proviennent des assets, pas des noms
de fichiers ni de l'ordre des materiaux du Blueprint Hana/Gavin.
"""
import json
from pathlib import Path
import unreal

ROOT = Path(__file__).resolve().parents[1]
MANIFESTS = ROOT / 'WebPortal/Server/adk/_manifests'
options = json.loads((MANIFESTS / 'metacustom-options.json').read_text(encoding='utf-8'))
result = {'version': 1, 'grooms': {}, 'faces': {}}

def slots(materials):
    values = []
    for index, (name, material) in enumerate(materials):
        if material is None:
            raise RuntimeError('Materiau absent au slot %s (%s)' % (index, name))
        values.append({'index': index, 'slot': str(name), 'material': material.get_path_name()})
    if not values:
        raise RuntimeError('Asset sans materiaux')
    return values

for option in options['grooms']:
    groom = unreal.load_asset(option['groom'])
    if not isinstance(groom, unreal.GroomAsset):
        raise RuntimeError('Groom invalide : ' + option['groom'])
    result['grooms'][option['id']] = {
        'asset': groom.get_path_name(),
        'materials': slots((m.get_editor_property('slot_name'), m.get_editor_property('material'))
                           for m in groom.get_editor_property('hair_groups_materials'))}
for option in options['identites']:
    mesh = unreal.load_asset(option['visage'])
    if not isinstance(mesh, unreal.SkeletalMesh):
        raise RuntimeError('Visage invalide : ' + option['visage'])
    result['faces'][option['id']] = {
        'asset': mesh.get_path_name(),
        'materials': slots((m.material_slot_name, m.material_interface) for m in mesh.materials)}

target = MANIFESTS / 'metacustom-materiaux.json'
temporary = target.with_suffix('.json.tmp')
temporary.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
temporary.replace(target)
print('MCS_MATERIAUX', len(result['grooms']), 'grooms', len(result['faces']), 'visages')