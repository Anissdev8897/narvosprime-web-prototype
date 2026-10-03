// Exécute le vrai script WebUI : ouverture avant réponse, filtres et intentions de spawn.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
class Element {
  children=[]; events={}; attrs={}; style={}; dataset={}; value=''; textContent='';
  append(...items){this.children.push(...items);}
  replaceChildren(...items){this.children=[...items];}
  setAttribute(k,v){this.attrs[k]=v;}
  addEventListener(k,fn){this.events[k]=fn;}
  click(){this.events.click?.({target:this});}
}
const ids=new Map();
const el=id=>{if(!ids.has(id))ids.set(id,new Element());return ids.get(id);};
const events={},calls=[];
const context={
  $:el, ETAT:{ouvert:'vehicules'}, RENDUS:{},
  document:{createElement:()=>new Element(),addEventListener:()=>{},getElementById:el},
  Events:{Subscribe:(id,fn)=>{events[id]=fn;},Call:(...args)=>calls.push(args)},
  console,setTimeout,clearTimeout,
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(new URL('../../WebPortal/Server/nanos_world/packages/narvos-map-proto/Client/UI/ateliers.js',import.meta.url),'utf8'),context);
calls.length=0; // Ne compter que les gestes du menu, après les demandes d'initialisation du HUD.
events.NarvosVehiculesFiltre('vaisseaux');
events.NarvosVehicules({test:true,vehicules:[{id:'car',label:'Voiture'}],vaisseaux:[{id:'ship',label:'Vaisseau',disponible:false,statut:'Pilotage indisponible'}]});
assert.equal(el('vehicules-filtre').value,'vaisseaux');
assert.equal(el('vehicules-liste').children.length,1);
assert.equal(el('vehicules-compteur').textContent,'1 modèles');
el('vehicules-liste').children[0].click();
assert.equal(calls.length,0,'Un modèle non prêt ne doit pas envoyer de spawn');
el('vehicules-filtre').events.change({target:{value:'route'}});
el('vehicules-liste').children[0].click();
assert.equal(JSON.stringify(calls),JSON.stringify([['NarvosVehicules:Spawner','car']]));
calls.length=0;
events.NarvosVehicules({test:false,vehicules:[{id:'car',label:'Voiture'}],vaisseaux:[]});
el('vehicules-liste').children[0].click();
assert.equal(calls.length,0,'Pas de bouton de spawn actif sans droit');
events.NarvosVehiculesFiltre('invalide');
assert.equal(el('vehicules-filtre').value,'tous');
console.log('7 reussis, 0 echec(s)');