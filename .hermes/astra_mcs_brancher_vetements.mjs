// Modification ciblée du graphe existant ; les autres fonctions restent intactes.
import fs from 'node:fs';
import {outil,outilJson} from '../scripts/lib/ue-mcp-client.mjs';
const root='E:/narvosprime-web-prototype';
const backup=root+'/.hermes/sauvegardes/mcs-vetements-20260914';
fs.mkdirSync(backup,{recursive:true});
for(const sex of ['M','F']){
 const name='BP_NarvosMH_'+sex,bp='/Game/Narvos/PontMetaHuman/'+name;
 const ctx={asset_path:bp,graph_name:'NarvosMaillage'};
 const g=await outilJson('get_node_pins',ctx);
 if(g.nodes.some(n=>/Enable Master Pose/.test(n.name)))throw Error('Déjà raccordé : '+bp);
 const setter=g.nodes.find(n=>/Set Skeletal Mesh Asset/.test(n.name)&&n.pins.find(p=>p.name==='NewMesh')?.isConnected);
 const target=setter?.pins.find(p=>p.name==='self')?.connections;
 if(!setter||target?.length!==1||setter.pins.find(p=>p.name==='then')?.connections?.length)throw Error('Graphe inattendu');
 fs.copyFileSync(root+'/WebPortal/Server/adk/Content/Narvos/PontMetaHuman/'+name+'.uasset',backup+'/'+name+'.uasset',fs.constants.COPYFILE_EXCL);
 fs.writeFileSync(backup+'/'+name+'.before.json',JSON.stringify(g,null,2));
 const node=await outilJson('add_function_call_node',{...ctx,target:'Self',function_name:'EnableMasterPose',node_x:setter.posX+340,node_y:setter.posY});
 for(const [from,pin,to,toPin] of [[setter.id,'then',node.nodeId,'execute'],[target[0].nodeId,target[0].pinName,node.nodeId,'SkeletalMeshComponent']]){
  const r=await outil('connect_pins',{...ctx,source_node_id:from,source_pin_name:pin,target_node_id:to,target_pin_name:toPin});
  if(r.erreur||!/^Connected/.test(r.texte.trim()))throw Error(r.texte);
 }
 const compile=await outil('compile_blueprint',{asset_path:bp});
 if(compile.erreur||!/: Success\s*$/.test(compile.texte))throw Error(compile.texte);
 fs.writeFileSync(backup+'/'+name+'.after.json',JSON.stringify({compile:compile.texte,graph:await outilJson('get_node_pins',ctx)},null,2));
 console.log(name,compile.texte);
}