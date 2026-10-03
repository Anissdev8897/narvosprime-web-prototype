import unreal,json,traceback
from pathlib import Path
root=Path('E:/narvosprime-web-prototype')
r={'candidates':[],'errors':[]}
try:
 w=unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
 assert w.get_path_name()=='/Game/Narvos/Maps/Map_Narvos.Map_Narvos'
 for lx,ly in ((2300,2000),(2200,900),(1000,2000),(4200,1600)):
  x=-8513420+lx;y=10385420+ly;points=[]
  for dx,dy in ((0,0),(100,0),(-100,0),(0,100),(0,-100)):
   hit=unreal.SystemLibrary.line_trace_single(w,unreal.Vector(x+dx,y+dy,151000),unreal.Vector(x+dx,y+dy,149500),unreal.TraceTypeQuery.TRACE_TYPE_QUERY1,False,[],unreal.DrawDebugTrace.NONE,True)
   if hit:
    v=hit.to_tuple();p=v[4];points.append({'xyz':[p.x,p.y,p.z],'normal':str(v[5]),'tuple':[str(z) for z in v]})
  r['candidates'].append({'xy':[x,y],'probes':points,'flat_floor':len(points)==5 and all(abs(p['xyz'][2]-150000)<2 for p in points)})
except Exception:r['errors'].append(traceback.format_exc())
finally:(root/'.hermes/ASTRA_megastructure_arrivee.json').write_text(json.dumps(r,indent=2),encoding='utf-8')