-- ═══════════════════════════════════════════════════════════════════════════════
-- depart-tests.lua — le choix du point d'apparition.
--
-- Ce que ces tests protègent, et pourquoi ça vaut un harnais : proposer un monde
-- absent du pack cuit fait TOMBER le joueur dans le vide, sans un message. C'est
-- déjà arrivé le 2026-09-09 — le portail « Akarlys » était posé et ouvert alors
-- que `BIG_CITY_NIGHT_1` n'apparaît pas une seule fois dans `Assets.toml`, parce
-- que mon garde était dans `Charger` et non dans `MondePraticable`, qui décide.
-- Un garde placé après la décision ne garde rien.
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

print("[Depart.Options]")

local options = Narvos.Depart.Options()
ok(#options > 0, "au moins un monde est proposable")

-- Chaque option porte ce dont l'interface a besoin. Un champ manquant ne lève
-- pas côté page : il affiche « undefined », et personne ne comprend pourquoi.
for _, o in ipairs(options) do
    ok(type(o.id) == "string" and o.id ~= "", "option a un id : " .. tostring(o.id))
    ok(type(o.label) == "string" and o.label ~= "", o.id .. " a un label")
    ok(type(o.description) == "string", o.id .. " a une description")
    ok(o.position ~= nil, o.id .. " a une position d'arrivee")
    ok(type(o.position.z) == "number", o.id .. " : z numerique")
end

-- ── Le drapeau `cuit` doit ÉCARTER, pas seulement refuser plus tard ──────────
print("[cuit = false ecarte des options]")

local ids = {}
for _, o in ipairs(options) do ids[o.id] = true end

for _, m in ipairs(Narvos.Mondes.MONDES) do
    if (m.cuit == false) then
        ok(not ids[m.id], m.id .. " (cuit=false) n'est PAS proposable")
        ok(not Narvos.Depart.Valide(m.id), m.id .. " est refuse par Valide")
        eq(Narvos.Depart.Point(m.id), nil, m.id .. " n'a pas de point")
    else
        ok(ids[m.id] ~= nil or m.niveau == nil or m.depart == false,
            m.id .. " propose, sans niveau, ou retire du depart (depart = false)")
    end
end

-- ── Un seul défaut, et il est praticable ─────────────────────────────────────
print("[le defaut]")

local defauts = 0
for _, o in ipairs(options) do if (o.defaut) then defauts = defauts + 1 end end
ok(defauts <= 1, "au plus UN monde marque par defaut (" .. defauts .. ")")
eq(Narvos.Depart.DEFAUT, "capitale", "le defaut est Akarlys (la Forge est retiree du depart, 15/09)")
ok(Narvos.Depart.Valide(Narvos.Depart.DEFAUT), "le defaut est lui-meme recevable")

-- ── Forge retiree temporairement : ni depart ni portail ──────────────────────
print("[depart = false]")
local forge = Narvos.Mondes.Trouver("forge")
eq(forge and forge.depart, false, "la Forge porte depart = false")
eq(forge and forge.ouvert, false, "la Forge porte ouvert = false")
ok(not ids["forge"], "la Forge n'est plus proposee au depart")
ok(not Narvos.Depart.Valide("forge"), "la Forge est refusee par Valide")
eq(Narvos.Depart.Point("forge"), nil, "la Forge n'a pas de point de depart")
ok(not Narvos.Voyage.MondePraticable("forge"), "ses portails sont egalement desactives")
local r_forge, repli_forge = Narvos.Depart.Retenu("forge")
eq(r_forge, "capitale", "choisir la Forge retombe sur le defaut")
eq(repli_forge, true, "et le repli est signale")
for _, m in ipairs(Narvos.Mondes.MONDES) do
    if (m.depart == false) then ok(not ids[m.id], m.id .. " (depart=false) absent des options") end
end

-- ── La cite enregistree est presélectionnee ──────────────────────────────────
print("[Options(prefere)]")
local function marque(liste)
    for _, o in ipairs(liste) do if (o.defaut) then return o.id end end
    return nil
end
eq(marque(Narvos.Depart.Options("foret")), "foret", "la cite enregistree est marquee par defaut")
eq(marque(Narvos.Depart.Options("forge")), "capitale", "une cite retiree du depart retombe sur le defaut")
eq(marque(Narvos.Depart.Options("monde_inexistant")), "capitale", "une cite inconnue retombe sur le defaut")
eq(marque(Narvos.Depart.Options(nil)), "capitale", "sans cite : le defaut")

-- ── Validation : ce qui doit être refusé ─────────────────────────────────────
print("[Valide refuse le n'importe quoi]")

for _, mauvais in ipairs({ "", "monde_inexistant", "FORGE" }) do
    ok(not Narvos.Depart.Valide(mauvais), "refuse la chaine « " .. mauvais .. " »")
end
ok(not Narvos.Depart.Valide(nil), "refuse nil")
ok(not Narvos.Depart.Valide(42), "refuse un nombre")
ok(not Narvos.Depart.Valide({}), "refuse une table")

-- ── `Retenu` ne laisse jamais le joueur sans monde ───────────────────────────
print("[Retenu, et son repli]")

local r, repli = Narvos.Depart.Retenu("capitale")
eq(r, "capitale", "un choix valide est retenu tel quel")
eq(repli, false, "et n'est pas signale comme repli")

r, repli = Narvos.Depart.Retenu("monde_inexistant")
ok(r ~= nil, "un choix invalide retombe sur un monde reel")
eq(repli, true, "et le repli est SIGNALE — pas silencieux")
ok(Narvos.Depart.Valide(r), "le monde de repli est lui-meme praticable")

r, repli = Narvos.Depart.Retenu(nil)
ok(r ~= nil, "nil retombe aussi sur un monde reel")
eq(repli, true, "et le signale")

-- ── Le point rendu est bien celui du catalogue ───────────────────────────────
print("[Point]")

local p = Narvos.Depart.Point("capitale")
ok(p ~= nil, "Akarlys a un point d'arrivee")
local _, a = Narvos.Voyage.Arrivee("capitale")  -- (dimension, position)
eq(p.Z, a.Z, "Point rend l'arrivee du catalogue, pas un calcul a part")

-- ── Via : la topologie, et le nom de champ qui la portait mal ────────────────
print("[Via]")
eq(Narvos.Depart.Via("orbital"), nil, "le hub n'est pas subordonne a une planete")
eq(Narvos.Depart.Via("megastructure"), "orbital", "planete Alien reliee au hub")
eq(Narvos.Depart.Via("foret"), "orbital", "Sylve presente sa route orbitale")

-- ⚠ CE BLOC N'EXISTAIT PAS, ET C'EST POUR CA QUE LE DEFAUT A TENU.
-- `Depart.Via` lisait `l.depuis` alors que les liaisons portent `l.de` : elle
-- rendait nil PARTOUT, en silence. Les 54 assertions d'alors etaient vertes —
-- aucune ne regardait `via`. Un champ que personne ne teste n'est pas un champ,
-- c'est un commentaire qui compile.
--
-- On n'ecrit pas la valeur attendue en dur : on affirme la RELATION avec le
-- catalogue. Un nom de champ invente ne peut pas la satisfaire.
local via_non_nuls = 0
for _, o in ipairs(Narvos.Depart.Options()) do
    if (o.via ~= nil) then
        via_non_nuls = via_non_nuls + 1
        ok(Narvos.Mondes.Trouver(o.via) ~= nil,
            "le `via` de " .. o.id .. " designe un monde reel : " .. tostring(o.via))
        ok(Narvos.Mondes.Liaison(o.via, o.id) ~= nil,
            "et la liaison " .. o.via .. " -> " .. o.id .. " existe vraiment")
    end
end
-- Orbital est le hub : au moins un monde doit s'atteindre depuis quelque part.
ok(via_non_nuls > 0, "au moins un monde declare par ou on l'atteint")

print("")
print(string.format("%d reussis, %d echoue(s)", reussis, echoues))
if (echoues > 0) then error("contrats non respectes") end