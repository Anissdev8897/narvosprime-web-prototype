import fs from 'node:fs';
import {lireProprietes} from '../scripts/lib/uasset-proprietes.mjs';
const root='E:/narvosprime-web-prototype';
const opts=JSON.parse(fs.readFileSync(root+'/WebPortal/Server/adk/_manifests/metacustom-options.json','utf8'));
for(const o of opts.grooms.filter(x=>x.sorte==='cheveux')){
 const file=root+'/WebPortal/Server/adk/Content/'+o.liaison.split('.')[0].replace('/Game/','')+'.uasset';
 const p=lireProprietes(file);
 console.log(JSON.stringify({id:o.id,props:p.exports.filter(e=>e.classe==='GroomBindingAsset').map(e=>p.proprietes(e))}));
}