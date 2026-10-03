import fs from 'node:fs';
import {outilJson} from '../scripts/lib/ue-mcp-client.mjs';
const root='E:/narvosprime-web-prototype/.hermes';
for (const [name,tool,args] of [
 ['face_widget_pins','get_node_pins',{asset_path:'/Game/Narvos/MetaCustom/Meta_Face_Tool/Widgets/Widget_Customization',graph_name:'EventGraph'}],
 ['face_widget_arbre','get_widget_tree',{asset_path:'/Game/Narvos/MetaCustom/Meta_Face_Tool/Widgets/Widget_Customization',include_properties:true}],
 ['hover_base_info','get_blueprint_info',{asset_path:'/Game/HoverVehicles/Blueprints/HoverTank_Prefabs/BP_Hover_Base_Simple'}],
 ['hover_a_pins','get_node_pins',{asset_path:'/Game/HoverVehicles/Blueprints/HoverTank_Prefabs/BP_Hover_Tank_PILOTABLE_A',graph_name:'EventGraph'}],
 ['hover_base_pins','get_node_pins',{asset_path:'/Game/HoverVehicles/Blueprints/HoverTank_Prefabs/BP_Hover_Base_Simple',graph_name:'EventGraph'}],
]) {
 const result=await outilJson(tool,args);
 fs.writeFileSync(`${root}/ASTRA_${name}_20260915.json`,JSON.stringify(result,null,2));
 console.log(name,'lu');
}