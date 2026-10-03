import unreal
assert not unreal.EditorLoadingAndSavingUtils.get_dirty_map_packages(), 'Map non sauvegardee'
assert not unreal.EditorLoadingAndSavingUtils.get_dirty_content_packages(), 'Asset non sauvegarde'
unreal.SystemLibrary.quit_editor()