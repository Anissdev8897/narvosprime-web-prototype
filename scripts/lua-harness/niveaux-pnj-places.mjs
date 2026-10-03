import { RACINE_DEPOT } from "./_racine.mjs";
// niveaux-pnj-places.mjs — niveau manuel d'un PNJ, de l'interface au respawn.
//
// Prouve deux choses distinctes :
//   1. Peuplement conserve un niveau valide et le redonne a l'IA a la naissance ;
//   2. le niveau traverse tous les ponts UI -> client -> spawner -> export -> catalogue.

import fs from "node:fs";
import { LuaFactory } from "wasmoon";

const ROOT = RACINE_DEPOT + "/";
const read = (p) => fs.readFileSync(ROOT + p, "utf8");
const serverRoot = "WebPortal/Server/nanos_world/packages/narvos-map-proto/";
const narvosRoot = "WebPortal/Server/nanos_world/packages/narvos/";

let passed = 0;
let failed = 0;
const check = (condition, name) => {
  if (condition) passed++;
  else { failed++; console.error(`ECHEC ${name}`); }
};

const peuplementSource = read(serverRoot + "Server/Peuplement.lua");
const lua = await new LuaFactory().createEngine();
try {
  const result = await lua.doString(`
local passe
Timer = { SetInterval = function(fn) passe = fn end }
Console = { Log = function() end, Warn = function() end, Error = function() end }
CollisionType = { Auto = 1 }
Vector = function(x,y,z) return {X=x or 0,Y=y or 0,Z=z or 0} end
Rotator = function(p,y,r) return {Pitch=p or 0,Yaw=y or 0,Roll=r or 0} end

local options_recues = nil
local valeurs = {}
local entite = {
  IsValid=function() return true end,
  IsDead=function() return false end,
  SetValue=function(_,k,v) valeurs[k]=v end,
  SetScale=function() end,
  GetLocation=function() return Vector(0,0,0) end,
  Destroy=function() end,
}
Character = function() return entite end
CharacterSimple = function() return entite end
local joueur_corps = { GetLocation=function() return Vector(0,0,0) end }
local joueur = { GetControlledCharacter=function() return joueur_corps end }
Player = { GetAll=function() return {joueur} end }

Narvos = {
  Progression = { NiveauMax=function() return 50 end },
  Spawnables = {
    Trouver=function() return { role="ennemi", simple=false, echelle=1 } end,
    Asset=function() return "narvos::pnj" end,
  },
  SessionServeur = { EnJeu=function() return true end },
  CharacterBuilder = { PoserLocomotion=function() end },
  IaServeur = { Prendre=function(_,_,options) options_recues=options end },
}

local P=(function() ${peuplementSource} end)()
local retenus,ecartes=P.Charger({{id="p1",spawnable="soldat",x=0,y=0,z=0,niveau=37}})
passe()
local niveau_recu=options_recues and options_recues.niveau
local niveau_entite=valeurs.narvos_niveau
P.Vider()
local retenus_invalides,ecartes_invalides=P.Charger({{id="p2",spawnable="soldat",x=0,y=0,z=0,niveau=51}})
return {retenus,ecartes,niveau_recu,niveau_entite,retenus_invalides,ecartes_invalides,
  P.NiveauValide(1),P.NiveauValide(50),P.NiveauValide(1.5)}
`);
  check(result[0] === 1 && result[1] === 0, "un point niveau 37 est retenu");
  check(result[2] === 37, "le niveau 37 est transmis a l'IA");
  check(result[3] === 37, "le niveau 37 est synchronise sur l'entite");
  check(result[4] === 0 && result[5] === 1, "un niveau 51 est refuse");
  check(result[6] === true && result[7] === true && result[8] === false,
    "les bornes 1..50 exigent un entier");
} finally {
  lua.global.close();
}

const ui = read(serverRoot + "Client/UI/ateliers.js");
const client = read(serverRoot + "Client/Index.lua");
const spawner = read(serverRoot + "Server/Spawner.lua");
const exporter = read(serverRoot + "Server/Export.lua");
const serverIndex = read(serverRoot + "Server/Index.lua");
const sharedIndex = read(narvosRoot + "Shared/Index.lua");

check(/NarvosSpawn:Invoquer",\s*e\.id,\s*niveau/.test(ui), "la WebUI envoie le niveau choisi");
check(/NarvosSpawn:Enregistrer/.test(ui), "la WebUI peut enregistrer le peuplement");
check(/function\(id, niveau\)[\s\S]*Narvos:Invoquer[\s\S]*id, niveau/.test(client),
  "le client relaie le niveau");
check(/Narvos:EnregistrerPeuplement/.test(client), "le client relaie l'enregistrement");
check(/Spawner\.Invoquer\(player, id, niveau\)/.test(spawner), "le serveur recoit le niveau");
check(/IaServeur\.Prendre\(entite, entree, \{ niveau = niveau_pnj \}\)/.test(spawner),
  "le spawner impose ce niveau a l'IA");
check(/niveau = %d/.test(exporter) && /narvos_niveau/.test(exporter),
  "l'export ecrit le niveau de l'entite");
check(/PeuplementCatalogue = Package\.Require\("Catalogs\/Peuplement\.lua"\)/.test(sharedIndex),
  "le catalogue exporte est charge");
check(/Narvos\.PeuplementCatalogue/.test(serverIndex) && /niveau = e\.niveau/.test(serverIndex),
  "le demarrage fusionne les points et leur niveau");
check(/SubscribeRemote\("Narvos:EnregistrerPeuplement"/.test(serverIndex)
    && /Narvos\.Export\.Pnj\(player\)/.test(serverIndex),
  "le serveur protege et ecrit l'enregistrement demande par le menu");

console.log(`${passed} reussis, ${failed} echec(s)`);
if (failed) process.exitCode = 1;