"""Vérification sur acteurs temporaires ; seules les trois ressources corrigées sont sauvegardées si les contrôles réussissent."""
import json
import traceback
from pathlib import Path
import unreal

root=Path('E:/narvosprime-web-prototype')
dest='/Game/Narvos/PontMetaHuman/ABP_NarvosPersonnalisationCorps'
sub=unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
actors=[]
report={'actors':[], 'saved':[], 'errors':[]}
try:
    for sex in ('M','F'):
        path='/Game/Narvos/PontMetaHuman/BP_NarvosMH_'+sex
        bp=unreal.load_asset(path)
        actor=sub.spawn_actor_from_class(bp.generated_class(),unreal.Vector(0,0,-50000),transient=True)
        assert actor is not None
        actors.append(actor)
        body=next(c for c in actor.get_components_by_class(unreal.SkeletalMeshComponent) if c.get_name()=='Body')
        pp=body.get_post_process_instance()
        row={'path':path,'disabled':body.get_editor_property('disable_post_process_blueprint'),'post_process':pp.get_class().get_path_name() if pp else None}
        report['actors'].append(row)
        assert row['disabled'] is False, 'Body toujours désactivé'
        assert pp and row['post_process']==dest+'.ABP_NarvosPersonnalisationCorps_C', 'Mauvais récepteur'
        # Vérifier les noms réels et types exposés au pont ; pas un test visuel.
        manifest=json.loads((root/'WebPortal/Server/adk/_manifests/metacustom-curseurs-corps.json').read_text(encoding='utf-8'))
        row['controls']=[]
        for control in manifest['curseurs']:
            value=control['min']+(control['max']-control['min'])*0.6
            actor.call_method('NarvosAnimReel',('Body',control['variable'],value))
            assert abs(pp.get_editor_property(control['variable'])-value)<0.00001
            for activation in control['activation']:
                actor.call_method('NarvosAnimBool',('Body',activation,True))
                assert pp.get_editor_property(activation) is True
            row['controls'].append(control['id'])
    for path in [dest]+['/Game/Narvos/PontMetaHuman/BP_NarvosMH_'+s for s in ('M','F')]:
        asset=unreal.load_asset(path)
        assert unreal.EditorAssetLibrary.save_loaded_asset(asset,False), 'Sauvegarde refusée '+path
        report['saved'].append(path)
except Exception:
    report['errors'].append(traceback.format_exc())
finally:
    report['cleanup']=[bool(sub.destroy_actor(a)) for a in actors]
    report['ok']=not report['errors'] and len(report['saved'])==3 and all(report['cleanup'])
    (root/'.hermes/ASTRA_mcs_corps_verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print('ASTRA_MCS_CORPS_VERIFICATION',report['ok'])