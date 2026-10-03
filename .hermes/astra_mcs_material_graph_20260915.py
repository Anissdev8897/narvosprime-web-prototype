import unreal,json,traceback
from pathlib import Path
root=Path('E:/narvosprime-web-prototype');out={'ok':False,'materials':[],'errors':[]}
try:
 opts=json.loads((root/'WebPortal/Server/adk/_manifests/metacustom-options.json').read_text())
 seen=set()
 for ident in opts['identites']:
  face=unreal.load_asset(ident['visage'])
  for slot in [0,3,9,11,12,13,14]:
   mi=face.materials[slot].material_interface;mat=mi.get_base_material();path=mat.get_path_name()
   if path in seen:continue
   seen.add(path);row={'material':path,'roots':[],'nodes':[]};out['materials'].append(row)
   queue=[]
   for prop in [unreal.MaterialProperty.MP_BASE_COLOR,unreal.MaterialProperty.MP_MATERIAL_ATTRIBUTES]:
    node=unreal.MaterialEditingLibrary.get_material_property_input_node(mat,prop)
    row['roots'].append({'property':str(prop),'node':node.get_path_name() if node else None})
    if node:queue.append(node)
   visited=set()
   while queue:
    node=queue.pop();key=node.get_path_name()
    if key in visited:continue
    visited.add(key);entry={'path':key,'class':node.get_class().get_name()};row['nodes'].append(entry)
    for name in ['parameter_name','material_function','default_value']:
     try:entry[name]=str(node.get_editor_property(name))
     except:pass
    inputs=unreal.MaterialEditingLibrary.get_inputs_for_material_expression(mat,node)
    entry['inputs']=[n.get_path_name() for n in inputs if n]
    queue.extend(n for n in inputs if n)
 out['ok']=True
except Exception:out['errors'].append(traceback.format_exc())
(root/'.hermes/ASTRA_mcs_material_graph_20260915.json').write_text(json.dumps(out,indent=2),encoding='utf-8')