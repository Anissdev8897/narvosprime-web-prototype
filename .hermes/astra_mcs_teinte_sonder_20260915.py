import unreal,json,traceback
from pathlib import Path
root=Path('E:/narvosprime-web-prototype')
out={'ok':False,'identities':[],'errors':[]}
try:
 opts=json.loads((root/'WebPortal/Server/adk/_manifests/metacustom-options.json').read_text())
 for ident in opts['identites']:
  row={'id':ident['id'],'materials':[]};out['identities'].append(row)
  face=unreal.load_asset(ident['visage'])
  mats=[('Body',unreal.load_asset(ident['materiau_corps']))]+[(str(s.material_slot_name),s.material_interface) for s in face.materials]
  for slot,mat in mats:
   entry={'slot':slot,'material':mat.get_path_name(),'scalar':[str(n) for n in unreal.MaterialEditingLibrary.get_scalar_parameter_names(mat)],'vector':[str(n) for n in unreal.MaterialEditingLibrary.get_vector_parameter_names(mat)]}
   row['materials'].append(entry)
 out['ok']=True
except Exception:out['errors'].append(traceback.format_exc())
(root/'.hermes/ASTRA_mcs_teinte_20260915.json').write_text(json.dumps(out,indent=2),encoding='utf-8')