import unreal,json
from pathlib import Path
out={}
for cls in [unreal.SkeletalMeshEditorSubsystem,unreal.MorphTarget,unreal.SkeletalMesh,unreal.SkinnedMeshComponent,unreal.LevelEditorSubsystem]:
 out[cls.__name__]={n:getattr(cls,n).__doc__ for n in dir(cls) if any(k in n.lower() for k in ['morph','vertex','lod','viewport','redraw'])}
Path('E:/narvosprime-web-prototype/.hermes/ASTRA_morph_more_api.json').write_text(json.dumps(out,indent=2),encoding='utf8')