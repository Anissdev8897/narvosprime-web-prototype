// Adapter le graphe existant du corps ; ne modifie ni les meshes ni le pack source.
// Sans --apply : lecture seule. La destination ne doit pas déjà exister.
import fs from 'node:fs';
import { outil, outilJson } from '../scripts/lib/ue-mcp-client.mjs';
const root = 'E:/narvosprime-web-prototype';
const source = '/Game/Narvos/MetaCustom/Meta_Body_Tool/Animations/AnimBP_Body_Tool1';
const dest = '/Game/Narvos/PontMetaHuman/ABP_NarvosPersonnalisationCorps';
const graph = (asset_path, graph_name) => outilJson('get_node_pins', {asset_path, graph_name});
const src = await graph(source, 'EventGraph');
const anim = await graph(source, 'AnimGraph');
function reachable(g, links) {
  const map = new Map(g.nodes.map(n=>[n.id,n])), seen=new Map(), q=links.map(c=>c.nodeId);
  while(q.length) {
    const id=q.shift(); if(seen.has(id))continue;
    const n=map.get(id); if(!n)throw Error('Nœud absent '+id); seen.set(id,n);
    for(const p of n.pins.filter(p=>p.type==='exec'&&p.direction==='Output'))q.push(...p.connections.map(c=>c.nodeId));
  }
  return [...seen.values()];
}
function branch(g) {
  const all=[];
  for(const n of g.nodes.filter(n=>n.class==='K2Node_ExecutionSequence')) {
    for(const p of n.pins.filter(p=>p.direction==='Output'&&p.type==='exec')) {
      const nodes=reachable(g,p.connections);
      if(nodes.some(n=>n.name==='Load Game from Slot'))all.push({n,p,nodes});
    }
  }
  if(all.length!==1)throw Error('Branche SaveGame ambiguë');
  const b=all[0];
  if(b.nodes.filter(n=>n.name==='Load Game from Slot').length!==2||b.nodes.filter(n=>n.name==='Save Game to Slot').length!==2)throw Error('Source différente : audit nécessaire');
  return b;
}
const b=branch(src);
console.log('Graphe de pose préservé :',anim.nodes.length,'nœuds. Branche locale à isoler :',b.nodes.length);
if(process.argv.includes('--apply')) {
  const proof=root+'/.hermes/ASTRA_mcs_corps_duplicate.json';
  if(!process.argv.includes('--resume')) await outil('execute_python',{code:`import unreal, json, traceback
from pathlib import Path
r={}
try:
    e=unreal.EditorAssetLibrary
    assert not e.does_asset_exist('${dest}'), 'Destination existante : refus écrasement'
    bp=e.duplicate_asset('${source}','${dest}')
    assert bp is not None
    r['ok']=True
except Exception:
    r['error']=traceback.format_exc()
Path('${proof}').write_text(json.dumps(r),encoding='utf-8')`});
  const r=JSON.parse(fs.readFileSync(proof,'utf8')); if(!r.ok)throw Error(JSON.stringify(r));
  const cp=await graph(dest,'EventGraph');
  const seq=cp.nodes[src.nodes.findIndex(n=>n.id===b.n.id)];
  if(seq?.class!=='K2Node_ExecutionSequence'||!seq.pins.some(p=>p.name===b.p.name))throw Error('Copie différente');
  const cut=await outil('disconnect_pin',{asset_path:dest,graph_name:'EventGraph',node_id:seq.id,pin_name:b.p.name});
  if(cut.erreur)throw Error(cut.texte);
  const after=await graph(dest,'EventGraph'), afterAnim=await graph(dest,'AnimGraph');
  const shape=g=>{
    const ids=new Map(g.nodes.map((n,i)=>[n.id,i]));
    return JSON.stringify(g.nodes.map(n=>({name:n.name,class:n.class,pins:n.pins.map(p=>({name:p.name,value:p.defaultValue,connections:p.connections.map(c=>({node:ids.get(c.nodeId),pin:c.pinName}))}))})));
  };
  if(shape(anim)!==shape(afterAnim))throw Error('Graphe de pose différent');
  const starts=after.nodes.filter(n=>n.class==='K2Node_Event').flatMap(n=>n.pins.filter(p=>p.type==='exec'&&p.direction==='Output').flatMap(p=>p.connections));
  const active=reachable(after,starts);
  if(active.some(n=>/Save Game|SaveGame/.test(n.name)))throw Error('Sauvegarde locale encore atteignable');
  const compiled=await outil('compile_blueprint',{asset_path:dest});
  fs.writeFileSync(root+'/.hermes/ASTRA_mcs_corps_adapter.json',JSON.stringify({source,dest,cut,compiled,active:active.map(n=>n.name),poseIdentical:true},null,2));
  console.log(compiled);
}