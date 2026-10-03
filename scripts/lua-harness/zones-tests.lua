-- ═══════════════════════════════════════════════════════════════════════════════
-- zones-tests.lua — qui a le droit d'éditer où.
--
-- Ce que ces tests protègent : un joueur qui déplacerait le décor de la map
-- générale. C'est le genre de défaut qu'on ne découvre pas en jouant seul, et
-- qui coûte un monde entier quand on le découvre à cinquante.
--
-- La règle est une LISTE DE PERMISSIONS, pas une liste d'interdits : hors zone,
-- refus. Les tests l'attaquent donc surtout par ce bord-là — c'est le cas qui se
-- troue quand quelqu'un ajoutera une map.
-- ═══════════════════════════════════════════════════════════════════════════════

local reussis, echoues = 0, 0

local function ok(condition, quoi)
    if (condition) then
        reussis = reussis + 1
    else
        echoues = echoues + 1
        print("  ECHEC : " .. quoi)
    end
end

local function eq(a, b, quoi)
    if (a == b) then
        reussis = reussis + 1
    else
        echoues = echoues + 1
        print(string.format("  ECHEC : %s  (obtenu %s, attendu %s)",
            quoi, tostring(a), tostring(b)))
    end
end

-- ── Le jeu de zones ───────────────────────────────────────────────────────────
-- Volontairement imbriquées : la maison de Bob est DANS la zone administrative
-- du spatioport. C'est le cas que `Trouver` doit départager.

local MAISON_BOB = {
    id = "maison_bob", monde = "capitale", type = "joueur", proprietaire = 7,
    forme = "sphere", x = 100, y = 0, z = 0, rayon = 50,
}
local SPATIOPORT = {
    id = "spatioport", monde = "capitale", type = "admin",
    forme = "sphere", x = 100, y = 0, z = 0, rayon = 5000,
}
local BAC_A_SABLE = {
    id = "bac", monde = "foret", type = "libre",
    forme = "boite", x = 0, y = 0, z = 0, dx = 200, dy = 200, dz = 100,
}
local ZONES = { SPATIOPORT, MAISON_BOB, BAC_A_SABLE }

local BOB   = { compte_id = 7,  est_admin = false }
local ALICE = { compte_id = 9,  est_admin = false }
local ADMIN = { compte_id = 1,  est_admin = true }

print("[Contient]")
ok(Zones.Contient(MAISON_BOB, "capitale", 100, 0, 0), "le centre est dedans")
ok(Zones.Contient(MAISON_BOB, "capitale", 149, 0, 0), "juste sous le rayon")
ok(not Zones.Contient(MAISON_BOB, "capitale", 151, 0, 0), "juste au-dela du rayon")
ok(not Zones.Contient(MAISON_BOB, "foret", 100, 0, 0), "meme point, autre monde")
ok(Zones.Contient(BAC_A_SABLE, "foret", 199, -199, 99), "coin de la boite")
ok(not Zones.Contient(BAC_A_SABLE, "foret", 201, 0, 0), "hors boite en X")
ok(not Zones.Contient(BAC_A_SABLE, "foret", 0, 0, 101), "hors boite en Z")

print("[Contient — donnees abimees]")
-- Ces lignes viennent de la base : une colonne peut manquer ou etre du mauvais
-- type. Aucune ne doit LEVER, toutes doivent refuser.
ok(not Zones.Contient(nil, "capitale", 0, 0, 0), "zone nil")
ok(not Zones.Contient({}, "capitale", 0, 0, 0), "zone vide")
ok(not Zones.Contient({ monde = "capitale", x = 0, y = 0, z = 0 }, "capitale", 0, 0, 0),
   "sphere sans rayon ne contient RIEN (et surtout pas tout)")
ok(not Zones.Contient({ monde = "capitale", forme = "boite", x = 0, y = 0, z = 0 },
   "capitale", 0, 0, 0), "boite sans dimensions")
ok(not Zones.Contient({ monde = "capitale", x = "cent", y = 0, z = 0, rayon = 10 },
   "capitale", 0, 0, 0), "coordonnee en chaine")
ok(not Zones.Contient(MAISON_BOB, "capitale", nil, 0, 0), "point incomplet")
ok(not Zones.Contient({ monde = "capitale", x = 0, y = 0, z = 0, rayon = 0 / 0 },
   "capitale", 0, 0, 0), "rayon NaN")
ok(not Zones.Contient({ monde = "capitale", x = 0, y = 0, z = 0, rayon = -5 },
   "capitale", 0, 0, 0), "rayon negatif")

print("[Trouver — la plus petite gagne]")
local t = Zones.Trouver(ZONES, "capitale", 100, 0, 0)
eq(t and t.id, "maison_bob", "la maison l'emporte sur le spatioport qui la contient")
local t2 = Zones.Trouver(ZONES, "capitale", 1000, 0, 0)
eq(t2 and t2.id, "spatioport", "hors maison, le spatioport reste")
eq(Zones.Trouver(ZONES, "capitale", 99999, 0, 0), nil, "hors de tout")
eq(Zones.Trouver(ZONES, "orbital", 100, 0, 0), nil, "monde sans zone")
eq(Zones.Trouver(nil, "capitale", 0, 0, 0), nil, "liste nil")

print("[PeutEditer — l admin]")
ok(Zones.PeutEditer(ZONES, "capitale", 99999, 0, 0, ADMIN), "admin hors zone")
ok(Zones.PeutEditer(ZONES, "capitale", 1000, 0, 0, ADMIN), "admin en zone admin")
ok(Zones.PeutEditer({}, "capitale", 0, 0, 0, ADMIN), "admin sans aucune zone declaree")

print("[PeutEditer — le joueur]")
ok(Zones.PeutEditer(ZONES, "capitale", 100, 0, 0, BOB), "Bob chez lui")
local peut, raison = Zones.PeutEditer(ZONES, "capitale", 100, 0, 0, ALICE)
ok(not peut, "Alice chez Bob : refuse")
ok(type(raison) == "string" and #raison > 0, "le refus porte une raison")

peut, raison = Zones.PeutEditer(ZONES, "capitale", 1000, 0, 0, BOB)
ok(not peut, "Bob dans le spatioport : refuse")

-- ⚠ LE TEST QUI COMPTE. Hors de toute zone, c'est la map generale.
peut, raison = Zones.PeutEditer(ZONES, "capitale", 99999, 0, 0, BOB)
ok(not peut, "Bob hors de toute zone : REFUSE (map generale)")
peut = Zones.PeutEditer({}, "capitale", 0, 0, 0, BOB)
ok(not peut, "aucune zone declaree : le joueur n edite RIEN")

ok(Zones.PeutEditer(ZONES, "foret", 0, 0, 0, ALICE), "zone libre : ouverte a tous")

print("[PeutEditer — les pieges de type]")
-- Le compte_id vient tantot d'SQLite (INTEGER), tantot du reseau (string).
-- `1 == "1"` est FAUX en Lua : sans comparaison en chaine, Bob perdrait sa maison.
ok(Zones.PeutEditer(ZONES, "capitale", 100, 0, 0, { compte_id = "7" }),
   "compte_id en chaine reconnait le proprietaire numerique")

local ZONE_SANS_PROPRIO = { id = "orpheline", monde = "capitale", type = "joueur",
                            forme = "sphere", x = 0, y = 0, z = 0, rayon = 10 }
peut = Zones.PeutEditer({ ZONE_SANS_PROPRIO }, "capitale", 0, 0, 0, BOB)
ok(not peut, "zone joueur sans proprietaire : refuse")

local ZONE_TYPE_INCONNU = { id = "?", monde = "capitale", type = "chantier",
                            forme = "sphere", x = 0, y = 0, z = 0, rayon = 10 }
peut = Zones.PeutEditer({ ZONE_TYPE_INCONNU }, "capitale", 0, 0, 0, BOB)
ok(not peut, "type inconnu : refuse par prudence, pas traite comme libre")

-- Une zone `admin` qui porterait un proprietaire (donnee heritee, import rate)
-- ne doit PAS devenir editable par lui.
local ADMIN_AVEC_PROPRIO = { id = "piege", monde = "capitale", type = "admin",
                             proprietaire = 7, forme = "sphere",
                             x = 0, y = 0, z = 0, rayon = 10 }
peut = Zones.PeutEditer({ ADMIN_AVEC_PROPRIO }, "capitale", 0, 0, 0, BOB)
ok(not peut, "zone admin portant un proprietaire reste admin")

ok(Zones.PeutEditer(ZONES, "capitale", 100, 0, 0, nil) == false,
   "contexte nil : refuse, ne leve pas")

print("[Siennes]")
eq(#Zones.Siennes(ZONES, BOB), 2, "Bob voit sa maison et le bac libre")
eq(#Zones.Siennes(ZONES, ALICE), 1, "Alice ne voit que le bac libre")
eq(#Zones.Siennes(ZONES, ADMIN), #ZONES, "l admin voit tout")
eq(#Zones.Siennes(nil, BOB), 0, "liste nil rend une liste vide")

print("[TypeValide]")
ok(Zones.TypeValide("joueur"), "joueur")
ok(Zones.TypeValide("admin"), "admin")
ok(Zones.TypeValide("libre"), "libre")
ok(not Zones.TypeValide("Joueur"), "la casse compte")
ok(not Zones.TypeValide(nil), "nil")
ok(not Zones.TypeValide(3), "nombre")


-- ═══════════════════════════════════════════════════════════════════════════════
-- LE CATALOGUE — et la copie sous surveillance
--
-- `Catalogs/Zones.lua` recopie le point d'arrivee de la Forge pour rester sans
-- dependance. Ce depot a paye QUATRE fois « une liste de cles recopiee diverge
-- toujours de sa source ». La copie est assumee ; ces trois assertions sont ce
-- qui l'empeche de deriver en silence le jour ou la Forge bougera.
-- ═══════════════════════════════════════════════════════════════════════════════

print("[Catalogue]")
local bac = ZonesCatalogue.Par("bac_forge")
ok(bac ~= nil, "le bac a sable de la Forge existe")

local forge = Mondes.Trouver("forge")
ok(forge ~= nil and forge.arrivee ~= nil, "la Forge a un point d arrivee")

if (bac and forge and forge.arrivee) then
    eq(bac.x, forge.arrivee.X, "bac.x suit Mondes.forge.arrivee.X")
    eq(bac.y, forge.arrivee.Y, "bac.y suit Mondes.forge.arrivee.Y")
    eq(bac.z, forge.arrivee.Z, "bac.z suit Mondes.forge.arrivee.Z")
end

-- Toute zone du catalogue doit etre exploitable par le modele : un type inconnu
-- ou une forme sans dimension serait ignoree EN SILENCE par `Contient`, et la
-- zone n'existerait que sur le papier.
print("[Catalogue — chaque zone est utilisable]")
for _, z in ipairs(ZonesCatalogue.Toutes()) do
    ok(type(z.id) == "string" and z.id ~= "", "zone a un id")
    ok(Zones.TypeValide(z.type), "zone '" .. tostring(z.id) .. "' a un type connu")
    ok(type(z.monde) == "string" and z.monde ~= "", "zone '" .. tostring(z.id) .. "' nomme un monde")
    -- Son propre centre doit etre dedans. Une zone qui ne se contient pas
    -- elle-meme est mal formee, quelle que soit la raison.
    ok(Zones.Contient(z, z.monde, z.x, z.y, z.z),
       "zone '" .. tostring(z.id) .. "' contient son propre centre")
    -- Et le monde qu'elle nomme doit exister.
    ok(Mondes.Trouver(z.monde) ~= nil,
       "le monde '" .. tostring(z.monde) .. "' de la zone existe")
end

print("")
print(string.format("%d reussis, %d echec(s)", reussis, echoues))
if (echoues > 0) then os.exit(1) end