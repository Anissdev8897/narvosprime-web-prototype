import {lireProprietes} from '../scripts/lib/uasset-proprietes.mjs';
const root='E:/narvosprime-web-prototype/WebPortal/Server';
for(const file of [root+'/adk/Content/Narvos/PontMetaHuman/BP_NarvosMH_M.uasset',root+'/adk/Saved/Ck7/Windows/NanosWorldADK/Content/Narvos/PontMetaHuman/BP_NarvosMH_M.uasset']){
 const p=lireProprietes(file);
 console.log(file,JSON.stringify(p.exports.filter(e=>e.classe==='Function'&&e.nom.startsWith('Narvos'))));
}