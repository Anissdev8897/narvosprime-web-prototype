import unreal,json
from pathlib import Path
r=json.loads(Path('E:/narvosprime-web-prototype/.hermes/ASTRA_mcs_joues_apercu_20260915.json').read_text())
for path in r['actors'][:2]:
 a=unreal.find_object(None,path);a.set_actor_rotation(unreal.Rotator(pitch=0,yaw=90,roll=0),False)
light=unreal.find_object(None,r['actors'][2]);light.point_light_component.set_intensity(50)
unreal.EditorLevelLibrary.set_level_viewport_camera_info(unreal.Vector(120,32,160),unreal.Rotator(pitch=0,yaw=180,roll=0))