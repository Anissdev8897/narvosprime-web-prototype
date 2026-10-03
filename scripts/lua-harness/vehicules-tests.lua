-- ══════════════════════════════════════════════════════════════════════════════
-- vehicules-tests.lua — assertions sur Shared/Logic/Voitures.lua.
-- Chargé par vehicules.mjs, qui fournit les globaux `Voitures`, `OsVehicules`
-- et `Vehicles` (le catalogue GÉNÉRÉ, lu tel quel) — plus un stub `Vector`,
-- sans lequel `RouesPour` ne construit pas ses arguments.
--
-- Ce que le test PROUVE (mission « voiture roulante », 2026-09-10) :
--   · la table de noms MESURÉE dans les .uasset cuits est reconnue par
--     OsVehicules.Resoudre vers `city_traffic_pro`, 4 rôles, 0 manquant ;
--   · `RouesPour` rend 4 roues sur les os de la convention — indices 0..3
--     dans l'ordre du gabarit, braquage à l'avant, propulsion à l'arrière,
--     23 paramètres chacune (SetWheel en a 25, moins index et bone_name) ;
--   · les 12 modèles du catalogue généré sont complets (id, label, asset,
--     sons, plaque) et uniques ;
--   · la résolution refuse un squelette inconnu avec une raison — jamais de
--     repli muet ;
--   · `VerifierDonnees` est vert.
--
-- ⚠ AUCUN NOM D'OS RECOPIÉ EN DUR : les os attendus sont RELUS dans la
-- convention reconnue — le test reste vrai si la donnée change.
-- ══════════════════════════════════════════════════════════════════════════════

local reussis, echecs = 0, 0

local function ok(condition, nom)
    if (condition) then reussis = reussis + 1
    else echecs = echecs + 1 print("  ECHEC  " .. nom) end
end

local function egal(obtenu, attendu, nom)
    ok(obtenu == attendu, nom .. "  obtenu=" .. tostring(obtenu) .. "  attendu=" .. tostring(attendu))
end

local function section(nom) print("[" .. nom .. "]") end

-- ═════════════════════════════════════════════════════════════════════════════
section("résolution des os — la mesure contre la signature")

local resolution, raison = Voitures.ResoudreOs()
ok(resolution ~= nil, "ResoudreOs : la table de noms mesurée est reconnue (raison=" .. tostring(raison) .. ")")
if (resolution) then
    egal(resolution.convention, "city_traffic_pro", "la convention reconnue est city_traffic_pro")
    egal(#resolution.manquants, 0, "aucun rôle manquant")

    local conv = OsVehicules.Convention(resolution.convention)
    local compte_roles = 0
    for _ in pairs(resolution.roles) do compte_roles = compte_roles + 1 end
    local compte_attendus = 0
    for _ in pairs(conv.roles) do compte_attendus = compte_attendus + 1 end
    egal(compte_roles, compte_attendus, "tous les rôles de la convention sont résolus")

    -- Chaque rôle résolu vise l'os que la convention annonce — relu, pas recopié.
    local accord = true
    for role, os_cible in pairs(resolution.roles) do
        if (conv.roles[role] ~= os_cible) then accord = false end
    end
    ok(accord, "chaque rôle résolu vise l'os de la convention")
end

-- Un squelette qui n'est pas une voiture connue : refusé, raison nommée.
-- (Appel seul sur sa ligne : dans un `and`, Lua tronquerait le second retour.)
local inconnu, raison_inconnu = OsVehicules.Resoudre({ "os", "inconnus" })
egal(inconnu, nil, "squelette inconnu : refusé")
ok(type(raison_inconnu) == "string" and #raison_inconnu > 0, "la raison du refus est nommée")

-- ═════════════════════════════════════════════════════════════════════════════
section("roues — le plan de SetWheel")

local roues, raison_roues = Voitures.RouesPour()
ok(roues ~= nil, "RouesPour : 4 roues résolues (raison=" .. tostring(raison_roues) .. ")")
if (roues) then
    egal(#roues, 4, "4 roues")

    local conv = OsVehicules.Convention("city_traffic_pro")
    local roles_par_index = { [0] = "roue_av_g", [1] = "roue_av_d", [2] = "roue_ar_g", [3] = "roue_ar_d" }
    local ordre_ok, os_ok, braquage_ok, propulsion_ok, parametres_ok = true, true, true, true, true
    local os_vus = {}
    for _, r in ipairs(roues) do
        if (r.role ~= roles_par_index[r.index]) then ordre_ok = false end
        if (r.os ~= conv.roles[r.role]) then os_ok = false end
        if (os_vus[r.os]) then os_ok = false end
        os_vus[r.os] = true
        -- args : 1=rayon, 2=largeur, 3=braquage, 5=propulsee, 7=frein_a_main.
        local avant = (r.index < 2)
        if (avant and r.args[3] <= 0) then braquage_ok = false end
        if ((not avant) and r.args[3] ~= 0) then braquage_ok = false end
        if (avant and r.args[5] ~= false) then propulsion_ok = false end
        if ((not avant) and r.args[5] ~= true) then propulsion_ok = false end
        if (#r.args ~= 23) then parametres_ok = false end
    end
    ok(ordre_ok, "indices 0..3 = avant gauche, avant droit, arrière gauche, arrière droit (ordre du gabarit)")
    ok(os_ok, "chaque roue porte l'os de la convention, sans doublon")
    ok(braquage_ok, "braquage à l'avant, zéro à l'arrière")
    ok(propulsion_ok, "propulsion à l'arrière (provisoire, gabarit Sedan)")
    ok(parametres_ok, "23 paramètres par roue (SetWheel : 25, moins index et bone_name)")

    -- Le rayon est POSITIF partout : une roue de rayon nul ne touche pas le sol.
    local rayon_ok = true
    for _, r in ipairs(roues) do
        if (type(r.args[1]) ~= "number" or r.args[1] <= 0) then rayon_ok = false end
    end
    ok(rayon_ok, "rayon de roue positif sur les 4")
end

-- ═════════════════════════════════════════════════════════════════════════════
section("roues — le rayon MESURE du modele (retour de jeu 2026-09-13)")

-- Sans modèle : le réglage commun (repli).
local commun = Voitures.ReglageRoues(nil)
egal(commun.rayon, Voitures.REGLAGE_COMMUN.roues.rayon, "sans modele : rayon commun")

-- Avec la mesure : elle remplace le rayon, et SEULEMENT lui.
local suv = Voitures.ReglageRoues({ rayon_roue = 40 })
egal(suv.rayon, 40, "rayon_roue = 40 : rayon 40")
egal(suv.largeur, Voitures.REGLAGE_COMMUN.roues.largeur, "la largeur reste commune")
egal(Voitures.REGLAGE_COMMUN.roues.rayon, commun.rayon, "le reglage commun n'est pas mute (copie)")

-- Mesure hors bornes : refusée, repli commun.
egal(Voitures.ReglageRoues({ rayon_roue = 2 }).rayon, commun.rayon, "rayon trop petit : repli commun")
egal(Voitures.ReglageRoues({ rayon_roue = 500 }).rayon, commun.rayon, "rayon trop grand : repli commun")
egal(Voitures.ReglageRoues({ rayon_roue = "x" }).rayon, commun.rayon, "rayon non numerique : repli commun")

-- RouesPour(modele) porte le rayon mesuré dans args[1] des 4 roues.
local roues_suv = Voitures.RouesPour({ rayon_roue = 40 })
local tous40 = roues_suv ~= nil and #roues_suv == 4
for _, r in ipairs(roues_suv or {}) do
    if (r.args[1] ~= 40) then tous40 = false end
end
ok(tous40, "RouesPour(modele) : rayon mesure sur les 4 roues")

-- LE TEST QUI COMPTE : chaque voiture du catalogue GÉNÉRÉ porte une mesure, et
-- son rayon de suspension ATTEINT le sol (rayon + descente >= hauteur de roue,
-- la hauteur de roue étant la mesure elle-même). Un rayon commun de 30 laissait
-- trois voitures sans contact.
local toutes_mesurees = true
for _, m in ipairs(Voitures.Liste()) do
    local r = tonumber(m.rayon_roue)
    if (not r) then toutes_mesurees = false end
    local reg = Voitures.ReglageRoues(m)
    if (r and reg.rayon + reg.descente < r) then toutes_mesurees = false end
end
ok(toutes_mesurees, "chaque voiture porte rayon_roue et sa suspension atteint le sol")

-- ═════════════════════════════════════════════════════════════════════════════
section("catalogue — les 12 voitures cuites")

local liste = Voitures.Liste()
-- ⚠ Pas de compte en dur : le nombre exact de voitures est confronté à
-- l'inventaire d'Assets.toml côté vehicules.mjs (une RELATION, pas un nombre
-- recopié). Ici : la liste n'est pas vide — un catalogue vide est le mode
-- d'échec de la garde du générateur.
ok(#liste >= 1, "VOITURES_NANOS non vide (le compte exact est confronté à Assets.toml côté mjs)")

local vus = {}
local complets = true
for _, m in ipairs(liste) do
    if (vus[m.id]) then complets = false end
    vus[m.id] = true
    for _, champ in ipairs({ "label", "asset", "son_moteur", "son_klaxon", "plaque" }) do
        if (type(m[champ]) ~= "string" or m[champ] == "") then complets = false end
    end
end
ok(complets, "chaque modèle est complet et unique (id, label, asset, sons, plaque)")

-- Modele() retrouve chaque entrée par son id, et refuse l'inconnu.
local retrouves = true
for _, m in ipairs(liste) do
    if (Voitures.Modele(m.id) ~= m) then retrouves = false end
end
ok(retrouves, "Modele(id) retrouve les 12 entrées")
egal(Voitures.Modele("voiture_inexistante"), nil, "Modele : inconnu refusé")
egal(Voitures.Modele(nil), nil, "Modele : nil refusé")
egal(Voitures.Modele(42), nil, "Modele : non-chaîne refusée")

-- Tous les assets sont préfixés narvos:: — c'est ce préfixe que le
-- vérificateur de catalogues contrôle contre Assets.toml.
local prefixes = true
for _, m in ipairs(liste) do
    for _, champ in ipairs({ "asset", "son_moteur", "son_klaxon", "plaque" }) do
        if (m[champ]:sub(1, 8) ~= "narvos::") then prefixes = false end
    end
end
ok(prefixes, "tous les assets sont préfixés narvos::")

-- ═════════════════════════════════════════════════════════════════════════════
section("motos — SKL_Bike_base contre la convention digital_dive_moto")

-- La table de noms MESURÉE le 2026-09-13 sur SKL_Bike_base.uasset est reconnue
-- par la signature moto — et par elle seule (Front_Visible_Wheel réfute la
-- voiture Digital Dive).
local rm, raison_rm = Voitures.ResoudreOsMoto()
ok(rm ~= nil, "ResoudreOsMoto : la table mesurée est reconnue (raison=" .. tostring(raison_rm) .. ")")
if (rm) then
    egal(rm.convention, "digital_dive_moto", "la convention reconnue est digital_dive_moto")
    egal(#rm.manquants, 0, "aucun rôle de la convention moto ne manque")
end

local rmoto, raison_rmoto = Voitures.RouesMotoPour()
ok(rmoto ~= nil, "RouesMotoPour : 4 roues résolues (raison=" .. tostring(raison_rmoto) .. ")")
if (rmoto) then
    egal(#rmoto, 4, "une moto roule sur QUATRE roues physiques (deux par essieu, rapprochées)")
    local conv = OsVehicules.Convention("digital_dive_moto")
    local os_vus, os_ok, avant_ok, arriere_ok, n23 = {}, true, true, true, true
    for _, r in ipairs(rmoto) do
        if (r.os ~= conv.roles[r.role] or os_vus[r.os]) then os_ok = false end
        os_vus[r.os] = true
        local avant = (r.index < 2)
        if (avant and (r.args[3] <= 0 or r.args[5] ~= false)) then avant_ok = false end
        if ((not avant) and (r.args[3] ~= 0 or r.args[5] ~= true)) then arriere_ok = false end
        if (#r.args ~= 23) then n23 = false end
    end
    ok(os_ok, "chaque roue de moto porte l'os de sa convention, sans doublon")
    ok(avant_ok, "moto : braquage à l'avant, sans propulsion")
    ok(arriere_ok, "moto : propulsion à l'arrière, sans braquage")
    ok(n23, "moto : 23 paramètres par roue")
end

-- Une moto n'est pas une voiture étroite : ses roues le sont.
ok(Voitures.REGLAGE_MOTO.roues.largeur < Voitures.REGLAGE_COMMUN.roues.largeur,
   "les roues de moto sont plus étroites que celles d'une voiture")
ok(#Voitures.REGLAGE_MOTO.portes == 1, "une moto n'a qu'une place")

-- Le catalogue des motos peut être VIDE (corps pas encore cuits) : la relation
-- avec Assets.toml est contrôlée côté vehicules.mjs. Ce qui est vrai quel que
-- soit le cook : la liste complète réunit voitures et motos, sans doublon.
local motos = Voitures.Motos()
ok(type(motos) == "table", "Motos() rend une table, même vide")
local complete = Voitures.ListeComplete()
egal(#complete, #Voitures.Liste() + #motos, "ListeComplete = voitures + motos")
local ids = {}
local sans_doublon = true
for _, m in ipairs(complete) do
    if (ids[m.id]) then sans_doublon = false end
    ids[m.id] = true
end
ok(sans_doublon, "aucun identifiant partagé entre une voiture et une moto")
for _, m in ipairs(motos) do
    egal(Voitures.Modele(m.id), m, "Modele retrouve la moto " .. m.id)
    egal(Voitures.EstMoto(m.id), true, m.id .. " est une moto")
end
for _, m in ipairs(Voitures.Liste()) do
    egal(Voitures.EstMoto(m.id), false, m.id .. " n'est pas une moto")
end
egal(Voitures.EstMoto("inconnu"), false, "EstMoto : inconnu -> false")
egal(select(1, Voitures.VerifierMotos()), true, "VerifierMotos : cohérent")

-- ═════════════════════════════════════════════════════════════════════════════
section("garde-fou du module")

egal(select(1, Voitures.VerifierDonnees()), true, "VerifierDonnees : le module est cohérent")

-- ═════════════════════════════════════════════════════════════════════════════
section("bilan")

print("")
print(string.format("%d reussis, %d echec(s)", reussis, echecs))
REUSSIS, ECHECS = reussis, echecs
if (echecs > 0) then error(echecs .. " test(s) en echec") end
if (reussis < 1) then error("aucun test execute") end