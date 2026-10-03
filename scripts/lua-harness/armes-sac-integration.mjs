import fs from 'node:fs';
import {LuaFactory} from 'wasmoon';
const root='E:/narvosprime-web-prototype/WebPortal/Server/nanos_world/packages/';
const read=p=>fs.readFileSync(root+p,'utf8');
const lua=await new LuaFactory().createEngine();
try { await lua.doString(`
Narvos={}; Console={Log=function()end}; Package={Require=function(p) error(p) end}
local count=0
local function check(ok,msg) count=count+1; assert(ok,msg) end
Narvos.Items=(function() ${read('narvos/Shared/Catalogs/Items.lua')} end)()
Narvos.Weapons=(function() ${read('narvos/Shared/Logic/Weapons.lua')} end)()
Narvos.ArmesBase=(function() ${read('narvos/Shared/Catalogs/ArmesBase.lua')} end)()
Narvos.Weapons.Configurer(Narvos.ArmesBase)
Narvos.ArmesInventaire=(function() ${read('narvos/Shared/Logic/ArmesInventaire.lua')} end)()
Narvos.ArmesInventaire.Integrer()
Narvos.Roue={ARME_PAR_ITEM={}}
Narvos.ArmesInventaire.IntegrerCatalogue(Narvos.Weapons,Narvos.Items.ITEM_DB,Narvos.Roue)
for _,id in ipairs(Narvos.Weapons.ORDRE) do
 local def=Narvos.ArmesInventaire.ItemPourArme(id,Narvos.Items.ITEM_DB)
 check(def~=nil,'objet pour '..id)
 check(Narvos.Roue.ARME_PAR_ITEM[def.id].arme_id==id,'aller-retour '..id)
end
check(Narvos.Items.ITEM_DB.ak47 and not Narvos.Items.ITEM_DB.base_ak47,'id sauvegarde conserve sans doublon')
Narvos.Ramassage=(function() ${read('narvos/Shared/Logic/Ramassage.lua')} end)()
local hooks={}; local entities={}; local timers={}; local grid={}; local failSave=false; local full=false
Weapon={GetAll=function()return entities end,Subscribe=function(e,f)hooks[e]=f end}
Melee={GetAll=function()return{}end,Subscribe=function()end}; Grenade=Melee
Prop={GetAll=function()return{}end}; Character={Subscribe=function()end}
Timer={SetTimeout=function(f)table.insert(timers,f)end}; Chat={SendMessage=function()end}
local p={}; local c={GetLocation=function()return{X=0,Y=0,Z=100}end,GetDimension=function()return 0 end,IsValid=function()return true end,GetPlayer=function()return p end}
p.GetControlledCharacter=function()return c end
Narvos.SessionServeur={EnJeu=function()return true end}
Narvos.Inventory={AddItemToGrid=function(_,def,n)if full then return nil end return {id=def.id,quantity=n}end}
local server=(function() ${read('narvos-map-proto/Server/Ramassage.lua')} end)()
server.Configurer({grille=function()return grid end,ecrire=function(_,g)if failSave then return false end grid=g;return true end})
local function make(z,held,dim)
 local values={narvos_arme='base_ak47'}
 local e={valid=true,GetLocation=function()return{X=5,Y=0,Z=z or 100}end,GetDimension=function()return dim or 0 end,GetHandler=function()return held end}
 function e:IsValid()return self.valid end
 function e:GetValue(k,d)local v=values[k];if v==nil then return d end return v end
 function e:SetValue(k,v)values[k]=v end
 function e:Destroy()self.valid=false end
 entities={e};return e
end
local e=make();full=true
check(hooks.Interact(e,c)==false,'interaction annulee sac plein')
check(e.valid and not grid.id,'sac plein conserve objet')
full=false;failSave=true
check(server.Ramasser(p)==false and e.valid,'sauvegarde refusee conserve objet')
failSave=false
check(hooks.Interact(e,c)==false,'interaction convertie au sac sans PickUp')
check(grid.id=='ak47' and grid.quantity==1,'identifiant canonique dans sac')
check(server.Ramasser(p)==false,'double interaction refusee avant destruction')
for _,f in ipairs(timers) do f() end
check(not e.valid,'objet monde retire apres ajout')
make(100,c);check(server.Ramasser(p)==false,'arme tenue exclue')
make(1000);check(server.Ramasser(p)==false,'autre etage exclu')
make(100,nil,1);check(server.Ramasser(p)==false,'autre dimension exclue')
e=make();e:SetValue('narvos_projection_sac',true)
check(server.Ramasser(p)==false,'projection exclue')
print(count..' reussis, 0 echec(s)')
`); } catch(e){console.error(e.message);process.exitCode=1}finally{lua.global.close()}