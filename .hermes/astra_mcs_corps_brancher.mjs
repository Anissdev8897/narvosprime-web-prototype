// Branche l'adaptation compilée sur Body, après la construction existante.
// Ne touche ni Face, ni leader pose, ni retarget, ni fonctions Narvos* existantes.
import fs from 'node:fs';
import {outil,outilJson} from '../scripts/lib/ue-mcp-client.mjs';
const root='E:/narvosprime-web-prototype';
const dest='/Game/Narvos/PontMetaHuman/ABP_NarvosPersonnalisationCorps';
const backup=root+'/.hermes/sauvegardes/mcs-corps-20260914';
fs.mkdirSync(backup,{recursive:true});
async function call(name,args){const r=await outil(name,args);if(r.erreur)throw Error(r.texte);return r.texte;}
for(const sex of ['M','F']){
 const name='BP_NarvosMH_'+sex,bp='/Game/Narvos/PontMetaHuman/'+name;
 const ctx={asset_path:bp,graph_name:'UserConstructionScript'};
 const g=await outilJson('get_node_pins',ctx),entry=g.nodes.find(n=>n.class==='K2Node_FunctionEntry');
 const links=entry?.pins.find(p=>p.name==='then')?.connections;
 if(links?.length!==1||g.nodes.some(n=>/Set Override Post Process/.test(n.name)))throw Error('Construction inattendue ou déjà adaptée : '+bp);
 fs.copyFileSync(root+'/WebPortal/Server/adk/Content/Narvos/PontMetaHuman/'+name+'.uasset',backup+'/'+name+'.uasset',fs.constants.COPYFILE_EXCL);
 fs.writeFileSync(backup+'/'+name+'.graph.json',JSON.stringify(g,null,2));
 const add=(tool,args)=>outilJson(tool,{...ctx,...args});
 const seq=await add('add_sequence_node',{num_outputs:2,node_x:-1700,node_y:1900});
 const body=await add('add_variable_get_node',{variable_name:'Body',node_x:-1450,node_y:2200});
 const over=await add('add_function_call_node',{target:'SkeletalMeshComponent',function_name:'SetOverridePostProcessAnimBP',node_x:-1100,node_y:1900});
 const enable=await add('add_function_call_node',{target:'SkeletalMeshComponent',function_name:'SetDisablePostProcessBlueprint',node_x:-700,node_y:1900});
 const fresh=await outilJson('get_node_pins',ctx),byId=new Map(fresh.nodes.map(n=>[n.id,n]));
 const sq=byId.get(seq.nodeId),outs=sq.pins.filter(p=>p.type==='exec'&&p.direction==='Output'),inp=sq.pins.find(p=>p.type==='exec'&&p.direction==='Input');
 if(outs.length!==2||!inp)throw Error('Broches Sequence incorrectes');
 const connect=async(a,ap,b,bpin)=>{const text=await call('connect_pins',{...ctx,source_node_id:a,source_pin_name:ap,target_node_id:b,target_pin_name:bpin});if(!/^Connected/.test(text.trim()))throw Error(text);};
 for(const [id,pin,value] of [[over.nodeId,'InPostProcessAnimBlueprint',dest+'.ABP_NarvosPersonnalisationCorps_C'],[over.nodeId,'ReinitAnimInstances','true'],[enable.nodeId,'bInDisablePostProcess','false']]){
  await call('set_pin_default_value',{...ctx,node_id:id,pin_name:pin,default_value:value});
 }
 await connect(body.nodeId,'Body',over.nodeId,'self');
 await connect(body.nodeId,'Body',enable.nodeId,'self');
 await connect(over.nodeId,'then',enable.nodeId,'execute');
 await connect(seq.nodeId,outs[1].name,over.nodeId,'execute');
 await call('disconnect_pin',{...ctx,node_id:entry.id,pin_name:'then'});
 await connect(seq.nodeId,outs[0].name,links[0].nodeId,links[0].pinName);
 await connect(entry.id,'then',seq.nodeId,inp.name);
 const result=await call('compile_blueprint',{asset_path:bp});
 fs.writeFileSync(backup+'/'+name+'.after.json',JSON.stringify({compile:result,graph:await outilJson('get_node_pins',ctx)},null,2));
 console.log(name,result);
 if(!/: Success\s*$/.test(result))throw Error('Compilation non validée');
}