import fs from 'node:fs';
import path from 'node:path';
import {lirePaquet} from '../scripts/lib/uasset-paquet.mjs';
const root='E:/narvosprime-web-prototype';
const source=root+'/WebPortal/public/asset_game/asset_futuriste/Metaverse Futuristic Sci-Fi City Complete Pack - Unreal Engine/Content/CITY_PACK';
const content=root+'/WebPortal/Server/adk/Content';
const prior=JSON.parse(fs.readFileSync(root+'/.hermes/ASTRA_city_dependances_preparation_20260915.json','utf8'));
const mapping=new Map(prior.mapping.map(x=>[x.old,x.new]));
const roots=['M_BillboardBase_01a','M_Foliage_01a','M_Generic_01a','M_Grass_01a','M_STATUE'].map(n=>'/Game/CITY_PACK/BIG_CITY/MATERIALS/'+n);
const pending=[...roots],seen=new Set(),rows=[],missing=[];
while(pending.length){
 const old=pending.pop();if(seen.has(old))continue;seen.add(old);
 const rel=old.replace('/Game/CITY_PACK/','');
 const original=source+'/'+rel+'.uasset';
 if(!fs.existsSync(path.toNamespacedPath(original))){missing.push(old);continue;}
 const p=lirePaquet(path.toNamespacedPath(original));
 const target=mapping.get(old)??old.replace('/Game/','/Game/Narvos/');
 const dest=content+'/'+target.replace('/Game/','')+'.uasset';
 rows.push({old,new:target,original,dest,restore:roots.includes(old),new_file:!fs.existsSync(dest)});
 mapping.set(old,target);
 for(const im of p.imports){
  if(im.className==='Package'||!im.path.startsWith('/Game/CITY_PACK/'))continue;
  pending.push(im.path.split('.')[0]);
 }
}
const out={ok:missing.length===0,roots,assets:rows,missing,mapping:[...mapping].map(([old,newPath])=>({old,new:newPath}))};
fs.writeFileSync(root+'/.hermes/ASTRA_city_materiaux_sources_20260915.json',JSON.stringify(out,null,2));
console.log({assets:rows.length,restore:rows.filter(r=>r.restore).length,newFiles:rows.filter(r=>r.new_file).length,missing});