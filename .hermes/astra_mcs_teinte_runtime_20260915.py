import unreal,json,traceback
from pathlib import Path
root=Path('E:/narvosprime-web-prototype')
out={'ok':False,'rows':[],'errors':[]}
try:
 data=json.loads((root/'.hermes/ASTRA_mcs_apercu_20260915.json').read_text())
 for path in data['actors'][:2]:
  a=unreal.find_object(None,path);assert a
  for zone in ['Body','Face']:
   a.call_method('NarvosParamReel',(zone,'Tint on(1) off(0)',1.0))
   a.call_method('NarvosParamCouleur',(zone,'BaseColortint',0.0,1.0,0.0))
   a.call_method('NarvosParamReel',(zone,'IrisBrightness',4.0))
   c=next(c for c in a.get_components_by_class(unreal.SkeletalMeshComponent) if c.get_name()==zone)
   row={'actor':path,'zone':zone,'materials':[]};out['rows'].append(row)
   for m in c.get_materials():
    d={'path':m.get_path_name(),'class':m.get_class().get_name()};row['materials'].append(d)
    if isinstance(m,unreal.MaterialInstanceDynamic):
     d.update(tint=m.get_scalar_parameter_value('Tint on(1) off(0)'),color=str(m.get_vector_parameter_value('BaseColortint')),iris=m.get_scalar_parameter_value('IrisBrightness'))
 out['ok']=True
except Exception:out['errors'].append(traceback.format_exc())
(root/'.hermes/ASTRA_mcs_teinte_runtime_20260915.json').write_text(json.dumps(out,indent=2),encoding='utf-8')