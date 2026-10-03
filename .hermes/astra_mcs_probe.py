"""Sonde en lecture seule : aucune sauvegarde d'asset ni modification de composant."""
import json
import traceback
from pathlib import Path
import unreal

OUT = Path('E:/narvosprime-web-prototype/.hermes/ASTRA_mcs_composants_2026-09-14.json')
report = {'blueprints': [], 'errors': []}

def val(obj, name):
    try:
        v = obj.get_editor_property(name)
        if isinstance(v, unreal.Object):
            return v.get_path_name()
        if v is None or isinstance(v, (str, bool, int, float)):
            return v
        return str(v)
    except Exception as e:
        return {'unavailable': str(e)}

try:
    sds = unreal.get_engine_subsystem(unreal.SubobjectDataSubsystem)
    lib = unreal.SubobjectDataBlueprintFunctionLibrary
    for suffix in ('M', 'F'):
        path = '/Game/Narvos/PontMetaHuman/BP_NarvosMH_' + suffix
        bp = unreal.load_asset(path)
        row = {'path': path, 'components': []}
        report['blueprints'].append(row)
        if bp is None:
            row['error'] = 'Blueprint absent'
            continue
        for h in sds.k2_gather_subobject_data_for_blueprint(bp):
            d = sds.k2_find_subobject_data_from_handle(h)
            o = lib.get_object(d)
            if not isinstance(o, unreal.SkeletalMeshComponent):
                continue
            c = {'name': str(lib.get_variable_name(d)), 'object': o.get_path_name()}
            for p in ('skinned_asset', 'anim_class', 'animation_mode', 'disable_post_process_blueprint', 'leader_pose_component', 'override_materials'):
                c[p] = val(o, p)
            mesh = o.get_editor_property('skinned_asset')
            if mesh:
                c['mesh_post_process'] = val(mesh, 'post_process_anim_blueprint')
                c['mesh_skeleton'] = val(mesh, 'skeleton')
            row['components'].append(c)
except Exception:
    report['errors'].append(traceback.format_exc())
finally:
    OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print('ASTRA_MCS_PROBE_COMPLETE', str(OUT), len(report['errors']))