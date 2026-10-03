// Supprime seulement deux declarations de types de sauvegarde de la demo.
// Des getters temporaires protegent toutes les autres variables de l'API
// RemoveUnusedVariables, y compris celles pilotees dynamiquement par Lua.
import fs from 'node:fs';
import {outil,outilJson} from '../scripts/lib/ue-mcp-client.mjs';
const face=process.argv.includes('--face');
const tag=face?'face':'body';
const path='/Game/Narvos/PontMetaHuman/ABP_NarvosPersonnalisation'+(face?'Visage':'Corps');
const ctx={asset_path:path,graph_name:'EventGraph'};
const info=await outilJson('get_blueprint_info',{asset_path:path});
const graph=await outilJson('get_node_pins',ctx);
const anim=await outilJson('get_node_pins',{...ctx,graph_name:'AnimGraph'});
const remove=['Main_Save_Slot','Save_Game_Data'];
if(info.variables.filter(v=>v.type==='object').map(v=>v.name).sort().join()!==remove.sort().join())throw Error('Types inattendus');
const used=new Set([...graph.nodes,...anim.nodes].filter(n=>['K2Node_VariableGet','K2Node_VariableSet'].includes(n.class)).flatMap(n=>n.pins.map(p=>p.name)));
if(remove.some(v=>used.has(v)))throw Error('Variable demo encore referencee');
const protect=info.variables.filter(v=>!remove.includes(v.name)&&!used.has(v.name));
const temp=[];
for(const v of protect){const n=await outilJson('add_variable_get_node',{...ctx,variable_name:v.name,node_x:10000,node_y:10000});temp.push(n.nodeId);}
const resultFile=`E:/narvosprime-web-prototype/.hermes/ASTRA_${tag}_types_python_20260915.json`;
const r=await outil('execute_python',{code:`import unreal,json\nfrom pathlib import Path\nb=unreal.load_asset('${path}')\nn=unreal.BlueprintEditorLibrary.remove_unused_variables(b)\nPath('${resultFile}').write_text(json.dumps({'removed':n}),encoding='utf-8')`});
if(r.erreur)throw Error(r.texte);
const after=await outilJson('get_blueprint_info',{asset_path:path});
const expected=info.variables.filter(v=>!remove.includes(v.name));
if(JSON.stringify(expected)!==JSON.stringify(after.variables))throw Error('Variables non conformes apres nettoyage');
for(const id of temp){const r=await outil('remove_node',{...ctx,node_id:id});if(r.erreur)throw Error(r.texte);}
const animAfter=await outilJson('get_node_pins',{...ctx,graph_name:'AnimGraph'});
if(JSON.stringify(anim)!==JSON.stringify(animAfter))throw Error('Pose differente');
const compile=await outil('compile_blueprint',{asset_path:path});
const ok=!compile.erreur&&/: Success\s*$/.test(compile.texte);
fs.writeFileSync(`.hermes/ASTRA_${tag}_types_resultat_20260915.json`,JSON.stringify({ok,removed:remove,preserved:expected.length,temporaryGetters:protect.map(v=>v.name),compile},null,2));
if(!ok)throw Error(compile.texte);
console.log('OK deux types demo retires,',expected.length,'variables conservees');