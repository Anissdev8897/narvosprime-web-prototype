import fs from 'node:fs';
import {outil,outilJson} from '../scripts/lib/ue-mcp-client.mjs';
const root='E:/narvosprime-web-prototype';
const promotion=JSON.parse(fs.readFileSync(root+'/.hermes/ASTRA_spaceships_promotion_20260915.json','utf8'));
if(!promotion.ok)throw Error(promotion.error);
const result=[];
for(const path of promotion.roots) {
 const bp=path.replace('/Game/SpaceShips_Vol1','/Game/Narvos/SpaceShips_Vol1');
 const info=await outilJson('get_blueprint_info',{asset_path:bp});
 const compile=await outil('compile_blueprint',{asset_path:bp});
 result.push({bp,info,compile});
 console.log(bp,compile.texte);
}
fs.writeFileSync(root+'/.hermes/ASTRA_spaceships_blueprints_20260915.json',JSON.stringify(result,null,2));
if(result.some(r=>r.compile.erreur||!/: Success\s*$/.test(r.compile.texte)))process.exitCode=1;