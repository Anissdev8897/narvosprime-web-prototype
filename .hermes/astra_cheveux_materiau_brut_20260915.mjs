import {lireProprietes} from '../scripts/lib/uasset-proprietes.mjs';
const base='E:/narvosprime-web-prototype/WebPortal/Server/adk/Content/Narvos/MetaCustom/Metahuman_Ref/Materials/';
for(const name of ['MI_Hair','M_Hair']){
 try {const p=lireProprietes(base+name+'.uasset');console.log(JSON.stringify({name,props:p.exports.filter(e=>e.classe==='MaterialInstanceConstant').map(e=>p.proprietes(e)),noms:p.noms?.filter(x=>/mask|scalp|root|opacity|fade/i.test(x))}));}catch(e){console.log(name,e.message)}
}