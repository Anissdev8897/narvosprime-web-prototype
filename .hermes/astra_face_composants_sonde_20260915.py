import unreal,json
from pathlib import Path
sds=unreal.get_engine_subsystem(unreal.SubobjectDataSubsystem);lib=unreal.SubobjectDataBlueprintFunctionLibrary
out=[]
for sex in ['M','F']:
 bp=unreal.load_asset('/Game/Narvos/PontMetaHuman/BP_NarvosMH_'+sex)
 row={'sex':sex,'components':[]};out.append(row)
 for h in sds.k2_gather_subobject_data_for_blueprint(bp):
  d=sds.k2_find_subobject_data_from_handle(h);o=lib.get_object(d)
  row['components'].append({'variable':str(lib.get_variable_name(d)),'object':o.get_path_name() if o else None,'class':o.get_class().get_name() if o else None})
Path('E:/narvosprime-web-prototype/.hermes/ASTRA_face_composants_sonde_20260915.json').write_text(json.dumps(out,indent=2),encoding='utf-8')