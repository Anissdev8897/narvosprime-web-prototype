import unreal,json
from pathlib import Path
root=Path('E:/narvosprime-web-prototype')
data=json.loads((root/'.hermes/ASTRA_mcs_apercu_20260915.json').read_text())
sub=unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
for path in data['actors']:
 actor=unreal.find_object(None,path)
 if actor:assert sub.destroy_actor(actor),path
print('SONDES_MCS_RETIREES',len(data['actors']))