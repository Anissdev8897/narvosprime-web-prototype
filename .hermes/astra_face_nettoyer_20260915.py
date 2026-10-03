import unreal, json
from pathlib import Path
root=Path('E:/narvosprime-web-prototype')
proof=json.loads((root/'.hermes/ASTRA_face_apercu_20260915.json').read_text())
sub=unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
removed=[]
for key in ('actor','light'):
    path='/Engine/Maps/Entry.Entry:PersistentLevel.'+proof[key]
    obj=unreal.find_object(None,path)
    if obj:
        assert obj.get_actor_label().startswith('ASTRA_APERCU_'), path
        assert sub.destroy_actor(obj), path
        removed.append(path)
dirty=[p.get_name() for p in unreal.EditorLoadingAndSavingUtils.get_dirty_map_packages()]
assert all(p=='/Engine/Maps/Entry' for p in dirty), dirty
assert not unreal.EditorLoadingAndSavingUtils.get_dirty_content_packages(), 'Contenu non sauvegardé'
assert unreal.EditorLoadingAndSavingUtils.load_map('/Game/NanosWorld/Maps/NanosWorldEntryMap'), 'Chargement entrée'
assert not unreal.EditorLoadingAndSavingUtils.get_dirty_map_packages()
(root/'.hermes/ASTRA_face_nettoyage_20260915.json').write_text(json.dumps({'ok':True,'removed':removed}),encoding='utf-8')
unreal.SystemLibrary.quit_editor()