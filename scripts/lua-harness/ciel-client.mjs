import { LuaFactory } from 'wasmoon';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../../WebPortal/Server/nanos_world/packages/narvos-map-proto/Client/Ciel.lua', import.meta.url), 'utf8');
const lua = await new LuaFactory().createEngine();
try {
  await lua.doString(`
local n = 0
local function check(value, why) n=n+1; assert(value, why) end
local calls, failing, exists = {}, nil, true
Console = { Warn=function() end, Log=function() end }
SkyMode = { Space=1, Dynamic=2 }
WeatherType = { ClearSkies=1 }
Narvos = { Ciel={ Reglages=function(id)
 return { mode=id=='orbital' and 'Space' or 'Dynamic', heures=12, minutes=0,
 transition=0, sans_meteo=id=='orbital', meteo='ClearSkies', nuages=0, brume=0,
 intensite_soleil=1, luminosite_nuit=1, intensite_globale=1, echelle_lune=1 }
end } }
Sky={}
for _, name in ipairs({'Spawn','IsSpawned','SetSkyMode','Reconstruct','SetTimeOfDay',
 'ChangeWeather','SetCloudCoverage','SetFog','SetSunLightIntensity','SetNightBrightness',
 'SetOverallIntensity','SetMoonScale'}) do
 Sky[name]=function(...)
  calls[#calls+1]=name
  if failing==name then error('indisponible') end
  if name=='Spawn' then return false end -- Creation neuve documentee, pas echec.
  if name=='IsSpawned' then check(select(1,...)==true,'verifier aussi la meteo'); return exists end
 end
end
local function count(name) local r=0; for _,v in ipairs(calls) do if v==name then r=r+1 end end; return r end
local function fresh() calls={}; failing=nil; exists=true; return (function() ${source} end)() end
local c=fresh()
check(c.Appliquer('orbital')==true,'Spawn false accepte si acteur present')
check(calls[3]=='SetSkyMode' and calls[4]=='Reconstruct','reconstruction avant reglages')
check(count('ChangeWeather')==0,'pas de meteo spatiale')
local previous=#calls; c.Appliquer('orbital'); check(#calls==previous,'monde reussi memorise')
c.Appliquer('forge'); check(count('Reconstruct')==2 and count('Spawn')==1,'changer monde sans dupliquer ciel')
check(count('ChangeWeather')==1,'meteo restauree au sol')
c.Oublier(); c.Appliquer('forge'); check(count('Spawn')==2,'reacquisition apres oubli')
for _,failure in ipairs({'Spawn','SetSkyMode','Reconstruct','SetFog'}) do
 c=fresh(); failing=failure
 check(c.Appliquer('orbital')==false,'echec remonte: '..failure)
 failing=nil
 check(c.Appliquer('orbital')==true,'echec non memorise: '..failure)
end
c=fresh(); exists=false
check(c.Appliquer('orbital')==false,'acteur absent refuse')
check(count('SetSkyMode')==0,'aucun reglage sans acteur')
exists=true; check(c.Appliquer('orbital')==true and count('Spawn')==2,'creation reessayee')
print('Ciel client : '..n..' assertions OK')
`);
} finally { lua.global.close(); }