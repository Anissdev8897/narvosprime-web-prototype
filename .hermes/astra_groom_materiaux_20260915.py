import unreal,json,traceback
from pathlib import Path
root=Path('E:/narvosprime-web-prototype')
options=json.loads((root/'WebPortal/Server/adk/_manifests/metacustom-options.json').read_text(encoding='utf-8'))
report={'ok':False,'grooms':[],'faces':[],'errors':[]}
for g in options['grooms']:
 row={'id':g['id'],'groom':g['groom']};report['grooms'].append(row)
 try:
  groom=unreal.load_asset(g['groom']);assert groom
  row['materials']=[{'slot':str(m.get_editor_property('slot_name')),'material':m.get_editor_property('material').get_path_name() if m.get_editor_property('material') else None} for m in groom.get_editor_property('hair_groups_materials')]
  row['cards']=[str(c) for c in groom.get_editor_property('hair_groups_cards')]
  row['physics']=[str(c) for c in groom.get_editor_property('hair_groups_physics')]
 except Exception:row['error']=traceback.format_exc();report['errors'].append(g['id'])
reg=unreal.AssetRegistryHelpers.get_asset_registry();reg.wait_for_completion()
for data in reg.get_assets_by_path('/Game/Narvos/MetaCustom/Metahuman_Ref',recursive=True):
 if not str(data.asset_name).endswith('_FaceMesh'):continue
 mesh=data.get_asset()
 if not isinstance(mesh,unreal.SkeletalMesh):continue
 report['faces'].append({'mesh':mesh.get_path_name(),'materials':[{'slot':str(m.material_slot_name),'material':m.material_interface.get_path_name() if m.material_interface else None} for m in mesh.materials]})
report['ok']=not report['errors']
(root/'.hermes/ASTRA_groom_materiaux_20260915.json').write_text(json.dumps(report,indent=2),encoding='utf-8')