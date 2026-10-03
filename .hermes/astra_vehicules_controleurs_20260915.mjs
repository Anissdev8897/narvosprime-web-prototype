import fs from 'node:fs';
import path from 'node:path';
import {lireProprietes} from '../scripts/lib/uasset-proprietes.mjs';
const root='E:/narvosprime-web-prototype';
const inv=JSON.parse(fs.readFileSync(root+'/.hermes/ASTRA_vehicules_inventaire_20260915.json','utf8'));
const rows=[];
for(const c of inv.candidates){
 if(c.extension!=='.uasset'||!path.basename(c.file).startsWith('BP_')||!/(Hover Vehicles|Drivable Cars|CityTraffic|Ridable)/.test(c.pack))continue;
 const row={source:c.file,pack:c.pack};
 try{
  const p=lireProprietes(path.toNamespacedPath(root+'/WebPortal/public/asset_game/'+c.file));
  const bp=p.exports.find(e=>e.classe==='Blueprint');
  if(!bp)continue;
  row.parent=p.proprietes(bp).ParentClass??null;
  row.components=p.exports.filter(e=>/Component$/.test(e.classe)).map(e=>{
   const props=p.proprietes(e);
   return {name:e.nom,class:e.classe,mesh:props.SkeletalMesh??props.StaticMesh??null,animation:props.AnimClass??null};
  });
  row.movement_imports=p.imports.filter(x=>/Movement|Vehicle|InputAction/.test(x.nom)).map(x=>x.chemin);
  row.native_nanos_controller=false;
  row.status=row.components.some(x=>/Movement/.test(x.class))||/Pawn|Vehicle/.test(row.parent??'')?'Controleur Unreal a adapter et tester dans nanos':'Assemblage ou outil Unreal, pilotage non demontre';
 }catch(e){row.error=e.message;row.status='Format source a qualifier dans Unreal';}
 rows.push(row);
}
fs.writeFileSync(root+'/.hermes/ASTRA_vehicules_controleurs_20260915.json',JSON.stringify(rows,null,2));
console.log(rows.length,'Blueprints inspectes');
for(const r of rows)console.log(path.basename(r.source),r.parent??r.error,r.components?.filter(x=>/Movement/.test(x.class)).map(x=>x.class));