import { RACINE_DEPOT } from "./_racine.mjs";
// metacustom.mjs — harnais de Logic/MetaCustom.lua (apparence du Meta Customization
// System) contre le catalogue GÉNÉRÉ Catalogs/MetaCustom.lua.
//
//   node scripts/lua-harness/metacustom.mjs
//
// Prouve : options filtrées (cuit, genre), normalisation (inconnu, croisé, NaN,
// bornes), aller-retour de l'encodage, emplacements, et l'ORDRE des appels au
// Blueprint (peau avant teinte, tenue qui vide les jambes). Le rendu, lui, ne se
// voit qu'en jeu.
import { LuaFactory } from "wasmoon";
import fs from "node:fs";

const SHARED = RACINE_DEPOT + "/WebPortal/Server/nanos_world/packages/narvos/Shared";
const logique = fs.readFileSync(`${SHARED}/Logic/MetaCustom.lua`, "utf8");
const catalogue = fs.readFileSync(`${SHARED}/Catalogs/MetaCustom.lua`, "utf8");

const factory = new LuaFactory();
const lua = await factory.createEngine();
let reussis = 0;
let echecs = 0;
lua.global.set("verifier", (cond, msg) => {
  if (cond) reussis += 1;
  else { echecs += 1; console.error("ECHEC :", msg); }
});
lua.global.set("LOGIQUE", logique);
lua.global.set("CATALOGUE", catalogue);

await lua.doString(`
local cat = load(CATALOGUE)()
local L = load(LOGIQUE)()

-- Sans catalogue : rien, sans erreur.
verifier(L.Options("m") == nil and L.Defaut("f") == nil, "sans catalogue : nil")
verifier(L.Configurer(cat) == true and L.Configurer(nil) == false, "configurer")

-- ── Catalogue généré : cohérent ──
local function ids(liste) local s = {} for _, o in ipairs(liste or {}) do s[o.id] = (s[o.id] or 0) + 1 end return s end
for nom, liste in pairs({ identites = cat.IDENTITES, tatouages = cat.TATOUAGES, corps = cat.CORPS }) do
  for id, n in pairs(ids(liste)) do verifier(n == 1, "id unique dans " .. nom .. " : " .. id) end
end
for sorte, liste in pairs(cat.VETEMENTS) do
  for id, n in pairs(ids(liste)) do verifier(n == 1, "id unique vetement " .. sorte .. " : " .. id) end
  for _, o in ipairs(liste) do
    verifier(type(o.chemin) == "string" and o.chemin:find("^/Game/Narvos/") ~= nil and o.chemin:find("%.") ~= nil, "chemin d'objet sous Narvos : " .. o.id)
  end
end
for _, c in ipairs(cat.CORPS) do
  verifier(c.min < c.max and c.defaut >= c.min and c.defaut <= c.max, "curseur borne : " .. c.id)
  verifier(type(c.variable) == "string" and #c.activation >= 1, "curseur relie a l'ABP : " .. c.id)
end
verifier(#cat.CORPS == 16, "16 curseurs de corps (le widget du pack)")
verifier(cat.EMPLACEMENTS == 18, "18 emplacements")

-- ── Options : cuit et genre ──
local om, of = L.Options("m"), L.Options("F")
-- Le sérialiseur réseau nanos refuse aussi les alias entre branches M/F.
local vus = {}
local function sans_alias(t)
  verifier(not vus[t], "options reseau sans table partagee")
  vus[t] = true
  for _, v in pairs(t) do if type(v) == "table" then sans_alias(v) end end
end
sans_alias({ M = om, F = of })
verifier(om.genre == "m" and of.genre == "f", "genre normalise")
for _, o in ipairs(om.identites) do
  local src; for _, i in ipairs(cat.IDENTITES) do if i.id == o.id then src = i end end
  verifier(src.cuit and src.genre == "m", "identite masculine cuite : " .. o.id)
end
for _, o in ipairs(of.vetements.haut) do
  local src; for _, v in ipairs(cat.VETEMENTS.haut) do if v.id == o.id then src = v end end
  verifier(src.cuit and (src.genre == "f" or src.genre == "mf"), "haut feminin cuit : " .. o.id)
end
verifier(L.Options("x") == nil, "genre inconnu refuse")

-- ── Défaut ──
local dm = L.Defaut("m")
verifier(dm.genre == "m" and dm.corps_actif == true and dm.physique == true, "defaut : champs de base")
for _, c in ipairs(cat.CORPS) do verifier(dm.corps[c.id] == c.defaut, "defaut curseur : " .. c.id) end
-- Aucun vetement d'office (retour de jeu du 2026-09-14) : ni homme ni femme.
for _, genre in ipairs({ "m", "f" }) do
  local d = L.Defaut(genre)
  for _, sorte in ipairs(L.SORTES_VETEMENT) do
    verifier(d.vetements[sorte] == nil, "defaut " .. genre .. " : aucun vetement " .. sorte)
  end
  verifier(next(d.vetements) == nil, "defaut " .. genre .. " : table de vetements vide")
  verifier(d.teinte.actif == false and d.teinte.s == 0, "defaut " .. genre .. " : teinte neutre (saturation nulle)")
  -- Les grooms du defaut sont ceux du genre (genre de liaison au catalogue).
  for _, sorte in ipairs(L.SORTES_GROOM) do
    local id = d.grooms[sorte]
    if (id) then
      local src; for _, o in ipairs(cat.GROOMS[sorte] or {}) do if o.id == id then src = o end end
      verifier(src and (src.genre == genre or src.genre == "mf"), "defaut " .. genre .. " : groom " .. sorte .. " du bon genre")
    end
  end
end
-- Les operations du defaut VIDENT les composants de vetement.
local ops_defaut = L.Operations(L.Defaut("m"))
for _, comp in ipairs({ "Torso", "Legs", "Feet", "Prop" }) do
  local vide = false
  for _, op in ipairs(ops_defaut) do if op[1] == "NarvosMaillage" and op[2] == comp and op[3] == "" then vide = true end end
  verifier(vide, "defaut : composant " .. comp .. " vide")
end
-- Groom croise nomme -> groom du genre ; groom absent -> aucun.
local feminin, masculin
for _, o in ipairs(cat.GROOMS.cheveux or {}) do
  if o.cuit and o.genre == "f" and not feminin then feminin = o.id end
  if o.cuit and o.genre == "m" and not masculin then masculin = o.id end
end
if feminin and masculin then
  local croise = L.Normaliser({ grooms = { cheveux = feminin } }, "m")
  local src
  for _, o in ipairs(cat.GROOMS.cheveux) do if o.id == feminin then src = o end end
  local compatible = src.liaisons and src.liaisons[croise.identite]
  verifier(croise.grooms.cheveux == (compatible and feminin or L.Defaut("m").grooms.cheveux), "coupe d'un autre genre acceptee seulement avec liaison adaptee")
  local aucun = L.Normaliser({ grooms = {} }, "m")
  verifier(aucun.grooms.cheveux == nil, "cheveux absents -> aucun (choix respecte)")
end

-- ── Normaliser : inconnu, croisé, non cuit, bornes, NaN ──
local femme_haut
for _, v in ipairs(cat.VETEMENTS.haut) do if v.cuit and v.genre == "f" then femme_haut = v.id break end end
local non_cuit
for _, v in ipairs(cat.VETEMENTS.haut) do if not v.cuit then non_cuit = v.id break end end
local n = L.Normaliser({
  identite = "inconnue",
  vetements = { haut = femme_haut, bas = "rien", chaussures = 42 },
  corps = { headsize = 99, height = 0 / 0, inconnu = 3 },
  yeux = { eclat = -5 },
  teinte = { actif = true, h = 720, s = 2, v = "x" },
  tatouage = "nope",
}, "M")
verifier(n.genre == "m" and n.identite == dm.identite, "identite inconnue -> defaut")
verifier(n.vetements.haut == nil, "haut feminin refuse sur un homme")
verifier(n.vetements.bas == nil and n.vetements.chaussures == nil, "vetements inconnus -> vides")
verifier(n.corps.headsize == 1.5, "curseur borne au max du pack")
verifier(n.corps.height == 0.49, "NaN -> defaut")
verifier(n.corps.inconnu == nil, "curseur inconnu ignore")
verifier(n.yeux.eclat == 0, "eclat borne au min")
verifier(n.teinte.actif == true and n.teinte.h == 360 and n.teinte.s == 1, "teinte bornee")
verifier(n.tatouage == nil, "tatouage inconnu -> aucun")
if non_cuit then
  local nc = L.Normaliser({ vetements = { haut = non_cuit } }, "f")
  verifier(nc.vetements.haut == nil, "option non cuite refusee : " .. non_cuit)
end
verifier(L.Normaliser("pas une table", "f").genre == "f", "proposition invalide -> defaut")

-- ── Encodage : aller-retour stable ──
local a = L.Normaliser({
  vetements = { haut = femme_haut }, corps = { headsize = 1.234 }, teinte = { actif = true, h = 30, s = 0.5, v = 0.8 },
  cheveux_couleur = { actif = true, h = 200, v = 0.3 }, physique = false,
}, "f")
local texte = L.Encoder(a)
verifier(type(texte) == "string" and #texte > 0 and texte:find(";") ~= nil, "encoder : une ligne")
local b = L.Normaliser(L.Decoder(texte), "f")
verifier(L.Encoder(b) == texte, "aller-retour identique")
verifier(b.corps.headsize == 1.234 and b.teinte.h == 30 and b.physique == false and b.cheveux_couleur.actif == true, "aller-retour : valeurs")
verifier(L.Decoder("") == nil and L.Decoder(nil) == nil, "decoder vide -> nil")
verifier(L.Encoder({ identite = "a;b=c" }):find("identite=abc") ~= nil, "separateurs retires des valeurs")

-- ── Emplacements ──
local e = L.EncoderEmplacements({ [1] = texte, [3] = "v=1|genre=m" })
local d = L.DecoderEmplacements(e)
verifier(d[1] == texte and d[2] == nil and d[3] == "v=1genre=m" and #e:gsub("[^|]", "") == 17, "emplacements : 18 cases, separateur retire")

-- ── Opérations : ordre et contenu ──
local ops = L.Operations(a)
local function index(pred) for i, op in ipairs(ops) do if pred(op) then return i end end end
local iPeau = index(function(op) return op[1] == "NarvosMateriau" and op[2] == "Body" end)
local iTeinte = index(function(op) return op[1] == "NarvosParamCouleur" and op[2] == "Body" end)
verifier(iPeau and iTeinte and iPeau < iTeinte, "la peau est posee AVANT la teinte")
verifier(index(function(op) return op[1] == "NarvosAnimReel" and op[3] == "Head_Size" and math.abs(op[4] - 1.234) < 1e-9 end) ~= nil, "curseur tete -> Head_Size")
verifier(index(function(op) return op[1] == "NarvosAnimBool" and op[3] == "Enable_Physics" and op[4] == false end) ~= nil, "physique coupee")
local tenue
for _, v in ipairs(cat.VETEMENTS.tenue) do if v.cuit and (v.genre == "f" or v.genre == "mf") then tenue = v break end end
if tenue then
  local t = L.Operations(L.Normaliser({ vetements = { tenue = tenue.id, bas = nil } }, "f"))
  local vide
  for _, op in ipairs(t) do if op[1] == "NarvosMaillage" and op[2] == "Legs" and op[3] == "" then vide = true end end
  verifier(vide, "une tenue vide le composant Legs")
end
for _, op in ipairs(ops) do
  verifier(op[1]:find("^Narvos") ~= nil, "appel prefixe Narvos : " .. op[1])
end

-- ── HSV ──
-- Les commandes faciales livrées doivent traverser sauvegarde et pont Face.
verifier(#cat.VISAGE == 15, "quinze commandes faciales qualifiées")
for _, c in ipairs(cat.VISAGE) do
  for _, genre in ipairs({ "m", "f" }) do
    local visage = { [c.id] = c.max + 100 }
    local borne = L.Normaliser({ visage = visage }, genre)
    verifier(borne.visage[c.id] == c.max, "borne visage : " .. c.id .. genre)
    local relu = L.Normaliser(L.Decoder(L.Encoder(borne)), genre)
    verifier(math.abs(relu.visage[c.id] - c.max) < 0.0001, "persistance visage : " .. c.id .. genre)
    local reel, active = false, {}
    for _, op in ipairs(L.Operations(relu)) do
      if op[1] == "NarvosAnimReel" and op[2] == "Face" and op[3] == c.variable then
        reel = math.abs(op[4] - c.max) < 0.0001
      end
      if op[1] == "NarvosAnimBool" and op[2] == "Face" and op[4] == true then active[op[3]] = true end
    end
    verifier(reel, "commande vers le pont Face : " .. c.id .. genre)
    for _, activation in ipairs(c.activation) do verifier(active[activation], "activation faciale : " .. activation) end
  end
end

-- Rejouer les choix sur un composant qui conserve ses overrides, comme Unreal.
-- Les transitions 3 -> 2 -> 3 slots et les quinze slots faciaux doivent tous
-- reprendre l'asset choisi, avant les parametres de coloration.
local rendus = {}
local function jouer(a)
  local peau_parametree = false
  for _, op in ipairs(L.Operations(a)) do
    if op[1] == "NarvosMateriau" then
      verifier(not peau_parametree, "materiau pose avant coloration")
      rendus[op[2]] = rendus[op[2]] or {}
      rendus[op[2]][op[3] + 1] = op[4]
    elseif op[1] == "NarvosParamReel" then peau_parametree = true end
  end
end
for tour = 1, 2 do
  for _, ident in ipairs(cat.IDENTITES) do
    local a = L.Defaut(ident.genre)
    a.identite = ident.id
    jouer(a)
    verifier(#ident.materiaux_visage == 15, "15 slots du visage " .. ident.id)
    for slot, mat in ipairs(ident.materiaux_visage) do
      verifier(rendus.Face[slot] == mat, "visage et LOD de l'identite " .. ident.id .. "/" .. slot)
    end
  end
  for sorte, liste in pairs(cat.GROOMS) do
    for _, groom in ipairs(liste) do
      local a = L.Defaut(groom.genre)
      a.grooms[sorte] = groom.id
      jouer(a)
      for slot, mat in ipairs(groom.materiaux) do
        verifier(rendus[groom.composant][slot] == mat, "slots du groom " .. groom.id .. "/" .. slot)
      end
    end
  end
end

local r, g, bb = L.HsvVersRgb(0, 1, 1)
verifier(r == 1 and g == 0 and bb == 0, "HSV rouge")
r, g, bb = L.HsvVersRgb(120, 1, 0.5)
verifier(r == 0 and math.abs(g - 0.5) < 1e-9 and bb == 0, "HSV vert a mi-valeur")

-- Deux tetes du meme genre exigent deux bindings distincts. L'absence de
-- liaison doit etre refusee, sans effacer les autres choix ni inventer un chemin.
local fixture = {
 IDENTITES = {{id="a",genre="m",cuit=true},{id="b",genre="m",cuit=true}},
 GROOMS = {cheveux={
  {id="court",label="Court",genre="m",cuit=true,composant="Hair",groom="/Court.Court",liaisons={a="/A.A",b="/B.B"}},
  {id="long",label="Long",genre="f",cuit=true,composant="Hair",groom="/Long.Long",liaisons={b="/LB.LB"}},
  {id="absent",label="Absent",genre="m",cuit=false,liaisons={b="/X.X"}},
 }}, VETEMENTS={}, CORPS={}, VISAGE={}, YEUX={}, TATOUAGES={}, PARAMS={}
}
L.Configurer(fixture)
local choix=L.Options("m").grooms.cheveux
verifier(#choix==2 and #choix[2].identites==1 and choix[2].identites[1]=="b", "options par visage, sans restriction de coupe par genre")
local a=L.Normaliser({identite="b",grooms={cheveux="long"}},"m")
verifier(a.grooms.cheveux=="long", "coupe conservee si liaison adaptee au visage")
local liaison
for _,op in ipairs(L.Operations(a)) do if op[1]=="NarvosGroom" then liaison=op[4] end end
verifier(liaison=="/LB.LB", "operation utilise la liaison de la tete choisie")
a.identite="a"
local renormalisee=L.Normaliser(a,"m")
verifier(renormalisee.grooms.cheveux=="court", "changement de tete incompatible utilise un choix compatible")
for _,op in ipairs(L.Operations(a)) do if op[1]=="NarvosGroom" then verifier(op[3]=="" and op[4]=="", "operations brutes refusent une liaison pour une autre tete") end end
verifier(L.Normaliser({identite="b",grooms={}},"m").grooms.cheveux==nil, "aucun reste aucun avec matrice")
verifier(L.Normaliser(L.Decoder(L.Encoder(renormalisee)),"m").grooms.cheveux=="court", "liaison resolue apres sauvegarde et relecture")
L.Configurer(cat)
`);

lua.global.set("CLIENT_MCS", fs.readFileSync(`${SHARED}/../../narvos-map-proto/Client/MetaCustom.lua`, "utf8"));
await lua.doString(`
-- Incident d'execution : une exception du pont ne doit pas empoisonner le cache.
local appels, erreurs = {}, {}
Events = { Subscribe = function() end }
Blueprint = { Subscribe = function() end }
Console = { Error = function(e) erreurs[#erreurs+1]=e end }
local largeur = 1
Narvos = { MetaCustomLogic = { Operations = function() return {
 {"NarvosMaillage","Face","/Face.Face"},
 {"NarvosAnimReel","Face","Mouth_Width",largeur},
} end } }
local echouer = true
local bp = { IsValid=function() return true end, GetValue=function() return {} end }
function bp:CallBlueprintEvent(n,composant,variable,valeur)
 appels[#appels+1]={n,variable,valeur}
 if n=="NarvosAnimReel" and echouer then echouer=false; error("indisponible") end
end
local client=load(CLIENT_MCS)()
verifier(client.Appliquer(bp)==1 and #erreurs==1,"echec du pont signale et exclu des envois reussis")
verifier(client.Appliquer(bp)==1 and #appels==3,"l'appel refuse est retente sans recharger le visage")
verifier(client.Appliquer(bp)==0 and #appels==3,"les appels deja envoyes restent en cache")
largeur=1.2
verifier(client.Appliquer(bp)==1 and appels[4][3]==1.2,"seul le reglage modifie est rejoue")
`);

console.log(`metacustom.mjs :: ${reussis} assertion(s) reussie(s), ${echecs} echec(s)`);
process.exit(echecs ? 1 : 0);