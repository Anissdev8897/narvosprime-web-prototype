import fs from 'node:fs';
import path from 'node:path';
import {lireProprietes} from '../scripts/lib/uasset-proprietes.mjs';
const root='E:/narvosprime-web-prototype';
const source=root+'/WebPortal/public/asset_game/mixte_epoques/Meta Customization System - Unreal Engine';
const input=process.argv[2]??'ASTRA_mcs_vetements_diagnostic.json';
const rows=JSON.parse(fs.readFileSync(root+'/.hermes/'+input,'utf8')).checks;
const result=[];
for(const row of rows){
 const relative=row.mesh.split('.')[0].replace('/Game/Narvos/MetaCustom/','');
 const file=path.join(source,relative+'.uasset');
 if(!fs.existsSync(file)){result.push({id:row.id,error:'Source absente',file});continue;}
 const data=lireProprietes(file);
 const binary=fs.readFileSync(file),exp=data.exports.find(e=>e.classe==='SkeletalMesh');
 // FSkeletalMaterial::operator<< : référence, FName du slot, bool editor,
 // FName importé. Match unique dans l'export mesh ; aucune écriture binaire.
 const decoded=row.slots.map(slot=>{
  const hits=[];
  const fname=(offset)=>{const index=binary.readInt32LE(offset),number=binary.readInt32LE(offset+4);return index>=0&&index<data.names.length&&number>=0&&number<100000?data.names[index]+(number?'_'+(number-1):''):null;};
  for(let i=Number(exp.offset)+4;i+20<Number(exp.offset)+Number(exp.taille);i++){
   if(binary.readInt32LE(i+8)!==1||fname(i)!==slot.slot||fname(i+12)!==slot.imported_slot)continue;
   const ref=binary.readInt32LE(i-4),im=ref<0?data.imports[-ref-1]:null;
   if(ref===0||im&&['Material','MaterialInstanceConstant'].includes(im.classe))hits.push({offset:i-4,reference:ref,material:im?.chemin??null});
  }
  if(hits.length!==1)throw Error(row.id+': slot '+slot.slot+' correspondances='+hits.length);
  return {...slot,source_material:hits[0].material,serialized_offset:hits[0].offset};
 });
 result.push({id:row.id,mesh:row.mesh,file,slots:decoded,materials:data.imports.filter(i=>['Material','MaterialInstanceConstant'].includes(i.classe))});
}
fs.writeFileSync(root+'/.hermes/ASTRA_mcs_material_imports.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result.map(r=>({id:r.id,error:r.error,slots:r.slots})),null,2));