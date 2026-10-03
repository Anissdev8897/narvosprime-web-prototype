// Adapter le graphe de sculpture existant. Les deux ControlRig sans classe
// sont contournes dans la copie uniquement ; aucun rig incompatible substitue.
// Le postprocess du joueur reste desactive tant que cette copie n'est pas qualifiee.
import fs from 'node:fs';
import {outil,outilJson} from '../scripts/lib/ue-mcp-client.mjs';
const source='/Game/Narvos/MetaCustom/Metahuman_Face_Customization/AnimBP_Face_Tool';
const dest='/Game/Narvos/PontMetaHuman/ABP_NarvosPersonnalisationVisage';
const ctx={asset_path:dest,graph_name:'EventGraph'};
async function call(t,args){const r=await outil(t,args);if(r.erreur)throw Error(r.texte);return r.texte;}
await call('execute_python',{code:`import unreal\ne=unreal.EditorAssetLibrary\nassert not e.does_asset_exist('${dest}'), 'Copie deja presente'\na=e.duplicate_asset('${source}','${dest}')\nassert a is not None\nassert e.save_loaded_asset(a,False)`});
const before=await outilJson('get_node_pins',ctx);
const animctx={...ctx,graph_name:'AnimGraph'};
const anim=await outilJson('get_node_pins',animctx);
if(before.nodes.length!==432||anim.nodes.length!==516)throw Error('Source inattendue');
fs.writeFileSync('.hermes/ASTRA_face_adapter_before_20260915.json',JSON.stringify({event:before,anim},null,2));
// Dans ce graphe, then_0 met a jour les choix de forme ; then_2 accede aux slots de demo.
const ev=before.nodes.find(n=>n.class==='K2Node_Event');
const seqid=ev.pins.find(p=>p.name==='then').connections[0].nodeId;
const seq=before.nodes.find(n=>n.id===seqid);
if(seq.class!=='K2Node_ExecutionSequence'||seq.pins.find(p=>p.name==='then_2').connections.length!==1)throw Error('Entree inattendue');
await call('disconnect_pin',{...ctx,node_id:seq.id,pin_name:'then_2'});
const cut=await outilJson('get_node_pins',ctx),map=new Map(cut.nodes.map(n=>[n.id,n])),keep=new Set(),q=[ev.id];
while(q.length){const id=q.pop();if(keep.has(id))continue;keep.add(id);const n=map.get(id);for(const p of n.pins){if(p.type==='exec'&&p.direction==='Output'||p.type!=='exec'&&p.direction==='Input')q.push(...p.connections.map(c=>c.nodeId));}}
if([...keep].some(id=>/Load Game|Save Game|Save_Game_Data/.test(map.get(id).name)))throw Error('Sauvegarde encore active');
const drop=cut.nodes.filter(n=>!keep.has(n.id)&&n.class!=='EdGraphNode_Comment');
for(const [i,n] of drop.entries()){
 await call('remove_node',{...ctx,node_id:n.id});
 if(i%40===0)console.log('Visage demo retiree',i+1,'/',drop.length);
}
const rigs=anim.nodes.filter(n=>n.class==='AnimGraphNode_ControlRig');
if(rigs.length!==2)throw Error('Rigs inattendus');
for(const n of rigs){
 const input=n.pins.find(p=>p.name==='Source'),output=n.pins.find(p=>p.name==='Pose');
 if(input.connections.length!==1||output.connections.length!==1)throw Error('Rig a branchement inattendu');
 const a=input.connections[0],b=output.connections[0];
 const r=await call('connect_pins',{...animctx,source_node_id:a.nodeId,source_pin_name:a.pinName,target_node_id:b.nodeId,target_pin_name:b.pinName});
 if(!/^Connected/.test(r.trim()))throw Error(r);
 await call('remove_node',{...animctx,node_id:n.id});
}
const after=await outilJson('get_node_pins',animctx);
if(after.nodes.filter(n=>n.class==='AnimGraphNode_ModifyBone').length!==48)throw Error('Sculpture modifiee');
const compiled=await call('compile_blueprint',{asset_path:dest});
const ok=/: Success\s*$/.test(compiled);
fs.writeFileSync('.hermes/ASTRA_face_adapter_resultat_20260915.json',JSON.stringify({ok,dest,removed_demo_nodes:drop.length,active_event_nodes:keep.size,bypassed_missing_rigs:2,sculpt_nodes:48,compiled,not_enabled_on_player:true},null,2));
if(!ok)throw Error(compiled);
console.log('Visage adapte compile ; qualification avant activation');