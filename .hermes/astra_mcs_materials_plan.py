import unreal,json,traceback
from pathlib import Path
root=Path('E:/narvosprime-web-prototype');r={'materials':[],'repairs':[],'unresolved':[],'errors':[]}
def path(o):return o.get_path_name() if o else None
try:
 rows=json.loads((root/'.hermes/ASTRA_mcs_material_imports.json').read_text(encoding='utf-8'));seen=set()
 for row in rows:
  changes=[]
  for i,s in enumerate(row['slots']):
   if s['material'] is not None:continue
   if not s['source_material']:
    r['unresolved'].append({'mesh':row['mesh'],'slot':i,'reason':'Source également sans matériau'});continue
   p=s['source_material'].replace('/Game/Metahuman_Customization_System/','/Game/Narvos/MetaCustom/')
   mat=unreal.load_asset(p)
   if not mat:
    r['unresolved'].append({'mesh':row['mesh'],'slot':i,'reason':'Cible promue absente','target':p});continue
   if p not in seen:
    seen.add(p);chain=[];current=mat;visited=set()
    while current and path(current) not in visited:
     visited.add(path(current));chain.append(path(current))
     if isinstance(current,unreal.MaterialInstance):current=current.get_editor_property('parent')
     else:break
    r['materials'].append({'path':p,'chain':chain,'base_valid':isinstance(current,unreal.Material)})
   changes.append({'slot':i,'slot_name':s['slot'],'material':p})
  if changes:r['repairs'].append({'mesh':row['mesh'],'changes':changes})
except Exception:r['errors'].append(traceback.format_exc())
finally:(root/'.hermes/ASTRA_mcs_materials_plan.json').write_text(json.dumps(r,indent=2),encoding='utf-8')