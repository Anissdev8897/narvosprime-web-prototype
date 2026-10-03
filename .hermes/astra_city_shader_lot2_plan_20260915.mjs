import fs from 'node:fs';
import path from 'node:path';
import {lirePaquet} from '../scripts/lib/uasset-paquet.mjs';
const root='E:/narvosprime-web-prototype';
const source=root+'/WebPortal/public/asset_game/asset_futuriste/Metaverse Futuristic Sci-Fi City Complete Pack - Unreal Engine/Content/CITY_PACK';
const content=root+'/WebPortal/Server/adk/Content';
const log=fs.readFileSync(root+'/.hermes/ASTRA_cook_lot2_20260915.log','utf8');
const roots=[...new Set([...log.matchAll(/Content\\Narvos\\CITY_PACK\\([^\r\n]+?)\.uasset: Failed to compile Material/g)].map(m=>'/Game/CITY_PACK/'+m[1].replaceAll('\\','/')))];
if(!roots.length)throw Error('Aucun echec identifie');
const mapping=new Map(JSON.parse(fs.readFileSync(root+'/.hermes/ASTRA_city_dependances_preparation_20260915.json')).mapping.map(x=>[x.old,x.new]));
for(const x of JSON.parse(fs.readFileSync(root+'/.hermes/ASTRA_city_materiaux_sources_20260915.json')).assets)mapping.set(x.old,x.new);
const seen=new Set(),pending=[...roots],assets=[],missing=[];
while(pending.length){
 const old=pending.pop();if(seen.has(old))continue;seen.add(old);
 const original=source+'/'+old.replace('/Game/CITY_PACK/','')+'.uasset';
 if(!fs.existsSync(path.toNamespacedPath(original))){missing.push(old);continue;}
 const target=mapping.get(old)??old.replace('/Game/','/Game/Narvos/');mapping.set(old,target);
 const dest=content+'/'+target.replace('/Game/','')+'.uasset';
 const p=lirePaquet(path.toNamespacedPath(original));
 assets.push({old,new:target,original,dest,restore:roots.includes(old),new_file:!fs.existsSync(dest)});
 for(const im of p.imports)if(im.className==='Package'&&im.path.startsWith('/Game/CITY_PACK/'))pending.push(im.path);
}
fs.writeFileSync(root+'/.hermes/ASTRA_city_shader_lot2_plan_20260915.json',JSON.stringify({roots,assets,missing},null,2));
console.log('Racines',roots.length,'dependances',assets.length,'manquantes',missing.length,'a ajouter',assets.filter(x=>x.new_file).length);