import fs from 'node:fs';
import { LuaFactory } from 'wasmoon';
const source=fs.readFileSync(new URL('../../WebPortal/Server/nanos_world/packages/narvos-map-proto/Server/Voyage.lua',import.meta.url),'utf8');
const lua=await new LuaFactory().createEngine();
try { await lua.doString(`
local calls,portals=0,0
function Vector() return {} end
Timer={SetInterval=function() end}
Player={Subscribe=function() end}
Events={SubscribeRemote=function() end}
Console={Log=function() end}
local worlds={
  forge={id='forge',label='Forge',niveau='Map_Forge',decor_glb=true,dimension=1,ouvert=false},
  tower={id='tower',label='Tower',niveau='Map_Tower',dimension=1},
  glb={id='glb',label='Decor GLB',catalogue='MapTest',decor_glb=true,dimension=1},
}
Narvos={Mondes={DECALAGES={},Trouver=function(id) return worlds[id] end},Voyage={
  CatalogueDe=function() return {MESHES={'sol'}} end,
  MondePraticable=function(id)
    local monde=worlds[id]
    if not monde then return false,'Monde inconnu' end
    if monde.ouvert==false then return false,'Monde temporairement ferme' end
    return true,nil
  end,
},MapLoader={Charger=function(cat,opts) calls=calls+1; opts.sur_fin(1,0); return true end}}
local server=(function() ${source} end)()
server.PoserPortails=function() portals=portals+1 end
server.DeclarerCharge('forge')
assert(calls==0 and portals==0,'La Forge fermee ne charge ni decor ni portail')
local ok,raison=server.Charger('forge')
assert(ok==false and raison~=nil,'Un chargement direct de Forge reste refuse')
server.DeclarerCharge('tower')
assert(calls==0 and portals==1,'Sous-niveau ouvert preserve')
server.DeclarerCharge('glb')
assert(calls==1 and portals==2,'Un decor GLB ouvert reste charge')
server.DeclarerCharge('glb'); server.Charger('glb')
assert(calls==1 and portals==2,'Pas de duplication du decor')
print('Voyage demarrage : 5 assertions OK')
`); } finally {lua.global.close();}