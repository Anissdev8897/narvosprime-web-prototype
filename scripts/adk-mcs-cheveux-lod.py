"""Repare les LOD sans geometrie de deux coiffures MCS uniquement.

Dans l'editeur via ue-remote.py. Conserve les brins et la decimation du pack;
ne force pas LOD0 et ne modifie ni visage, ni binding, ni materiaux.
"""
import unreal, json, hashlib, shutil
from pathlib import Path

ROOT = Path('E:/narvosprime-web-prototype')
ADK = ROOT / 'WebPortal/Server/adk'
IDS = {'cheveux_hair_s_boblayered', 'cheveux_hair_l_straight'}
backup = ROOT / '.hermes/sauvegardes/mcs-cheveux-lod-20260915'
backup.mkdir(parents=True, exist_ok=True)
options = json.loads((ADK / '_manifests/metacustom-options.json').read_text())
result = {'ok': False, 'grooms': []}

for item in options['grooms']:
    if item['id'] not in IDS:
        continue
    package = item['groom'].split('.')[0]
    source = ADK / 'Content' / (package.removeprefix('/Game/') + '.uasset')
    saved = backup / source.name
    if not saved.exists():
        shutil.copy2(source, saved)
        assert hashlib.sha256(saved.read_bytes()).digest() == hashlib.sha256(source.read_bytes()).digest()
    groom = unreal.load_asset(package)
    # Ces deux assets ne livrent aucune geometrie Cards/Meshes alternative.
    assert all(not c.get_editor_property('imported_mesh') for c in groom.get_editor_property('hair_groups_cards'))
    assert all(not c.get_editor_property('imported_mesh') for c in groom.get_editor_property('hair_groups_meshes'))
    groups = groom.get_editor_property('hair_groups_lod')
    before = [g.export_text() for g in groups]
    for group_index, group in enumerate(groups):
        lods = group.get_editor_property('lo_ds')
        for index, lod in enumerate(lods):
            lod.set_editor_property('screen_size', 0.5 ** index)
            if index >= 2:
                lod.set_editor_property('geometry_type', unreal.GroomGeometryType.STRANDS)
                lod.set_editor_property('visible', True)
                lod.set_editor_property('simulation', unreal.GroomOverrideType.DISABLE)
            lods[index] = lod
        group.set_editor_property('lo_ds', lods)
        groups[group_index] = group
    groom.set_editor_property('hair_groups_lod', groups)
    assert unreal.EditorAssetLibrary.save_loaded_asset(groom, False)
    reloaded, error = unreal.EditorLoadingAndSavingUtils.reload_packages(
        [groom.get_outermost()], unreal.ReloadPackagesInteractionMode.ASSUME_NEGATIVE)
    assert reloaded and not str(error), str(error)
    groom = unreal.load_asset(package)
    after = groom.get_editor_property('hair_groups_lod')
    for group in after:
        for lod in group.get_editor_property('lo_ds'):
            assert lod.get_editor_property('visible')
            assert lod.get_editor_property('geometry_type') == unreal.GroomGeometryType.STRANDS
    result['grooms'].append({'id': item['id'], 'package': package, 'before': before,
                            'after': [g.export_text() for g in after],
                            'sha256': hashlib.sha256(source.read_bytes()).hexdigest()})

assert {r['id'] for r in result['grooms']} == IDS
result['ok'] = True
(ROOT / '.hermes/ASTRA_mcs_cheveux_lod_20260915.json').write_text(json.dumps(result, indent=2))
print('ASTRA_CHEVEUX_LOD', result['ok'], len(result['grooms']))