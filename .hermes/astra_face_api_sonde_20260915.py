import unreal,json
from pathlib import Path
report={n:getattr(unreal.SystemLibrary,n).__doc__ for n in dir(unreal.SystemLibrary) if 'property_by_name' in n}
Path('E:/narvosprime-web-prototype/.hermes/ASTRA_face_api_20260915.json').write_text(json.dumps(report,indent=2),encoding='utf-8')