import {rpc,outilJson} from '../scripts/lib/ue-mcp-client.mjs';
import fs from 'node:fs';
const meta=await rpc('tools/list');
console.log(JSON.stringify(meta.tools.filter(t=>['add_function_call_node','connect_pins','disconnect_pin','remove_node','compile_blueprint','execute_python'].includes(t.name))));
const r=await outilJson('get_node_pins',{asset_path:'/Game/Narvos/PontMetaHuman/BP_NarvosMH_M',graph_name:'NarvosMaillage'});
fs.writeFileSync('.hermes/ASTRA_mcs_casse_graphe_avant_20260915.json',JSON.stringify(r,null,2));
console.log(JSON.stringify(r.nodes.filter(n=>n.name.includes('Equal'))));