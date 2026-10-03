import fs from 'node:fs';
import {outil,outilJson} from '../scripts/lib/ue-mcp-client.mjs';
import {brancherNettoyageMateriaux} from '../scripts/lib/mcs-nettoyer-materiaux.mjs';
const root='E:/narvosprime-web-prototype';
const backup=root+'/.hermes/sauvegardes/mcs-overrides-20260915';
fs.mkdirSync(backup,{recursive:true});
for(const sex of ['M','F']) {
 const name='BP_NarvosMH_'+sex,bp='/Game/Narvos/PontMetaHuman/'+name;
 const ctx={asset_path:bp,graph_name:'NarvosMaillage'};
 const g=await outilJson('get_node_pins',ctx);
 if(g.nodes.some(n=>/Get Materials/.test(n.name)))throw Error('Nettoyage déjà présent ou graphe inattendu : '+bp);
 const entree=g.nodes.find(n=>n.class==='K2Node_FunctionEntry');
 const pose=g.nodes.find(n=>/Enable Master Pose/.test(n.name));
 const setter=g.nodes.find(n=>/Set Skeletal Mesh Asset/.test(n.name)&&n.pins.find(p=>p.name==='NewMesh')?.isConnected);
 const target=setter?.pins.find(p=>p.name==='self')?.connections;
 const next=setter?.pins.find(p=>p.name==='then')?.connections;
 if(!entree||!pose||target?.length!==1||next?.length!==1||next[0].nodeId!==pose.id)throw Error('Graphe inattendu');
 fs.copyFileSync(root+'/WebPortal/Server/adk/Content/Narvos/PontMetaHuman/'+name+'.uasset',backup+'/'+name+'.uasset',fs.constants.COPYFILE_EXCL);
 fs.writeFileSync(backup+'/'+name+'.before.json',JSON.stringify(g,null,2));
 const r=await outil('disconnect_pin',{...ctx,node_id:setter.id,pin_name:'then'});
 if(r.erreur)throw Error(r.texte);
 await brancherNettoyageMateriaux({bp,entree:entree.id,composant:target[0].nodeId,sortieComposant:target[0].pinName,apres:setter.id,suite:pose.id});
 const compile=await outil('compile_blueprint',{asset_path:bp});
 if(compile.erreur||!/: Success\s*$/.test(compile.texte))throw Error(compile.texte);
 fs.writeFileSync(backup+'/'+name+'.after.json',JSON.stringify({compile:compile.texte,graph:await outilJson('get_node_pins',ctx)},null,2));
 console.log(name,compile.texte);
}