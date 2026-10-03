import fs from 'node:fs';
import {lireProprietes} from '../scripts/lib/uasset-proprietes.mjs';
const root='E:/narvosprime-web-prototype';
const rows=[];
for(const report of ['ASTRA_pnj_live_20260915.json','ASTRA_monstres_live_20260915.json']) {
 const live=JSON.parse(fs.readFileSync(root+'/.hermes/'+report,'utf8'));
 for(const m of new Set(live.rows.flatMap(r=>r.slots.map(s=>s.base)).filter(Boolean))) {
  const relative=m.split('.')[0].replace('/Game/','');
  const row={material:m,versions:{}};
  for(const [label,folder] of [['adk','WebPortal/Server/adk/Content'],['cook','WebPortal/Server/adk/Saved/Cooked/Windows/NanosWorldADK/Content'],['livre','WebPortal/Server/Assets/narvos']]) {
   const file=root+'/'+folder+'/'+relative+'.uasset';
   try {
    const p=lireProprietes(file), e=p.exports.find(e=>e.classe==='Material');
    if(!e)throw Error('Material export absent');
    const props=p.proprietes(e);
    row.versions[label]={date:fs.statSync(file).mtime.toISOString(),blend:props.BlendMode??'default',two_sided:props.TwoSided??false,skin:props.bUsedWithSkeletalMesh??false};
   }catch(e){row.versions[label]={error:e.message};}
  }
  rows.push(row);
 }
}
fs.writeFileSync(root+'/.hermes/ASTRA_materiaux_livres_20260915.json',JSON.stringify(rows,null,2));
for(const r of rows)console.log(r.material,JSON.stringify(r.versions));