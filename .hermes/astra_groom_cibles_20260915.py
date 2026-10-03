import unreal,json,traceback
from pathlib import Path
root=Path('E:/narvosprime-web-prototype')
options=json.loads((root/'WebPortal/Server/adk/_manifests/metacustom-options.json').read_text(encoding='utf-8'))
report={'ok':False,'grooms':[],'errors':[]}
for g in options['grooms']:
 row={'id':g['id'],'groom':g['groom'],'binding':g['liaison'],'genre':g.get('genre')};report['grooms'].append(row)
 try:
  binding=unreal.load_asset(g['liaison']);assert binding
  for prop in ['source_skeletal_mesh','target_skeletal_mesh','groom','num_interpolation_points','matching_section']:
   v=binding.get_editor_property(prop)
   row[prop]=v.get_path_name() if isinstance(v,unreal.Object) else v
 except Exception:row['error']=traceback.format_exc();report['errors'].append(g['id'])
report['ok']=not report['errors']
(root/'.hermes/ASTRA_groom_cibles_20260915.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print('GROOM_CIBLES',report['ok'],len(report['grooms']))