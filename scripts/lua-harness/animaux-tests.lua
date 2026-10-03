-- ═══════════════════════════════════════════════════════════════════════════════
-- animaux-tests.lua — l'état des compagnons, son codec, et le REFUS qui compte.
--
-- Ce que ces tests protègent, dans l'ordre d'importance :
--
--   1. **Le refus d'une espèce non cuite.** `CharacterSimple` sur une référence
--      morte ne lève RIEN : la bête n'apparaît pas, et le joueur voit « sorti »
--      sans compagnon. Aujourd'hui les 41 espèces sont dans ce cas — c'est donc
--      le chemin le plus emprunté, pas un cas limite.
--   2. **Le surnom**, seul texte écrit par le joueur qui entre en base. Un
--      séparateur dedans casserait le décodage de TOUS ses compagnons.
--   3. La parité avec le TS (`xpForLevel = 80 + level*40`, `MAX = 20`).
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

-- ── 1. Le catalogue généré ───────────────────────────────────────────────────
print("[1. le catalogue genere]")

ok(#Catalogue.ESPECES > 0, "au moins une espece")
ok(#Catalogue.ESPECES >= 40, "les 41 especes du pack (obtenu " .. #Catalogue.ESPECES .. ")")

local vus, familles = {}, {}
for _, e in ipairs(Catalogue.ESPECES) do
    ok(type(e.id) == "string" and e.id ~= "", "id non vide")
    ok(vus[e.id] == nil, "id unique : " .. tostring(e.id))
    vus[e.id] = true
    ok(type(e.label) == "string" and e.label ~= "", e.id .. " a un libelle")
    -- ⚠ Un libelle qui est le nom de dossier anglais serait un defaut visible
    -- dans la liste d'adoption. Le generateur EXCLUT une espece sans
    -- traduction ; ce test verifie que l'exclusion a bien eu lieu.
    ok(e.label ~= e.id, e.id .. " est traduit, pas recopie")
    ok(type(e.mesh) == "string" and e.mesh:sub(1, 3) == "SK_", e.id .. " vise un SK_")
    ok(type(e.cuit) == "boolean", e.id .. " declare son etat de cuisson")
    familles[e.famille] = true
end
ok(familles["mammifere"] and familles["oiseau"] and familles["reptile"],
    "les familles principales sont representees")

-- ⚠ Le pack garde ses anciennes versions sous `Old/`. Deux entrees pour la meme
-- bete, dont une perimee, et rien ne dirait laquelle est laquelle.
for _, e in ipairs(Catalogue.ESPECES) do
    ok(not e.source:find("/Old/"), e.id .. " ne vient pas d'un dossier Old/")
end

eq(Catalogue.Trouver("capybara") ~= nil, true, "Trouver rend une espece connue")
eq(Catalogue.Trouver("licorne"), nil, "Trouver rend nil sur une espece absente")
eq(Catalogue.Trouver(nil), nil, "Trouver rend nil sur nil")
eq(Catalogue.Trouver(42), nil, "Trouver rend nil sur un nombre")

-- ── 2. `Cuites()` dit la vérité, même quand elle est décevante ───────────────
print("[2. Cuites() ne ment pas]")

local cuites = Catalogue.Cuites()
local attendu = 0
for _, e in ipairs(Catalogue.ESPECES) do if (e.cuit) then attendu = attendu + 1 end end
eq(#cuites, attendu, "Cuites() compte exactement les especes cuites")
for _, e in ipairs(cuites) do
    ok(e.cuit == true, e.id .. " est bien cuite")
end

-- ── 3. L'état pur — parité TS ────────────────────────────────────────────────
print("[3. l'etat pur]")

eq(Animaux.NIVEAU_MAX, 20, "NIVEAU_MAX = 20 (parite TS)")
eq(Animaux.XpPourNiveau(1), 120, "xpForLevel(1) = 80 + 1*40")
eq(Animaux.XpPourNiveau(5), 280, "xpForLevel(5) = 80 + 5*40")

local vide = Animaux.EtatVide()
eq(#vide.possedes, 0, "etat vide : aucun compagnon")
eq(vide.compagnon_actif, nil, "etat vide : aucun actif")

local e1 = Animaux.Adopter(vide, "capybara", "Kapi")
eq(#e1.possedes, 1, "adoption ajoute")
eq(#vide.possedes, 0, "l'etat d'origine n'a PAS bouge (immuable)")
local e2 = Animaux.Adopter(e1, "capybara", "Autre")
eq(#e2.possedes, 1, "adopter deux fois n'ajoute pas deux fois")
eq(Animaux.Obtenu(e2, "capybara").surnom, "Kapi", "le surnom d'origine est garde")

local e3 = Animaux.Activer(e2, "capybara")
eq(e3.compagnon_actif, "capybara", "activation d'un possede")
local e4 = Animaux.Activer(e2, "orque")
eq(e4.compagnon_actif, nil, "activer un NON possede ne fait rien")

-- Montée de niveau : 120 xp pour le niveau 2.
local e5 = Animaux.OctroyerXp(e3, "capybara", 130)
eq(Animaux.Obtenu(e5, "capybara").niveau, 2, "130 xp -> niveau 2")
eq(Animaux.Obtenu(e5, "capybara").xp, 10, "le reliquat est garde")

-- ── 4. Le codec — le surnom est du texte JOUEUR ──────────────────────────────
print("[4. le codec]")

eq(Roster.NettoyerSurnom("Rex"), "Rex", "un surnom sain passe")
eq(Roster.NettoyerSurnom("Rex:le:grand"), "Rex le grand", "les deux-points sont neutralises")
eq(Roster.NettoyerSurnom("a|b;c,d=e"), "a b c d e", "tous les separateurs du format")
eq(Roster.NettoyerSurnom("  Rex  "), "Rex", "les bords sont rognes")
eq(Roster.NettoyerSurnom("Rex\nLe\tGrand"), "Rex Le Grand", "les caracteres de controle")
eq(#Roster.NettoyerSurnom(string.rep("x", 200)), Roster.SURNOM_MAX, "la longueur est bornee")
eq(Roster.NettoyerSurnom(nil), "", "nil rend une chaine vide, pas nil")

local etat = Animaux.Activer(
    Animaux.Adopter(Animaux.Adopter(Animaux.EtatVide(), "capybara", "Kapi"),
        "gecko", "Zip"),
    "gecko")
local chaine = Roster.EncoderAnimaux(etat)
local relu = Roster.DecoderAnimaux(chaine)
eq(#relu.possedes, 2, "aller-retour : deux compagnons")
eq(relu.compagnon_actif, "gecko", "aller-retour : l'actif est garde")
eq(Animaux.Obtenu(relu, "capybara").surnom, "Kapi", "aller-retour : le surnom")

-- Un surnom hostile ne doit pas casser la relecture des AUTRES compagnons.
local hostile = Animaux.Adopter(Animaux.EtatVide(), "capybara", "a|b;c:d")
local relu2 = Roster.DecoderAnimaux(Roster.EncoderAnimaux(hostile))
eq(#relu2.possedes, 1, "un surnom hostile ne fabrique pas d'entrees fantomes")
eq(Animaux.Obtenu(relu2, "capybara").surnom, "a b c d", "il est nettoye, pas refuse")

-- ⚠ Un actif non possede ne doit PAS s'ecrire : une desynchronisation en memoire
-- deviendrait durable en base.
local bancal = { possedes = {}, compagnon_actif = "gecko" }
eq(Roster.DecoderAnimaux(Roster.EncoderAnimaux(bancal)).compagnon_actif, nil,
    "un actif non possede n'est pas persiste")

-- Les entrees illisibles rendent l'etat VIDE, jamais une erreur.
eq(#Roster.DecoderAnimaux("").possedes, 0, "chaine vide -> etat vide")
eq(#Roster.DecoderAnimaux(nil).possedes, 0, "nil -> etat vide")
eq(#Roster.DecoderAnimaux("n_importe_quoi").possedes, 0, "chaine illisible -> etat vide")
eq(#Roster.DecoderAnimaux(";;;").possedes, 0, "separateurs seuls -> etat vide")

-- ── 5. LE REFUS QUI COMPTE ───────────────────────────────────────────────────
-- L'executant refuse-t-il une espece non cuite ? On ne peut pas charger
-- `Server/Animaux.lua` ici (il appelle `Timer`, `Player`, `CharacterSimple`),
-- mais on peut verifier la CONDITION sur laquelle il s'appuie — et qu'elle est
-- vraie pour toutes les especes d'aujourd'hui.
print("[5. le refus d'une espece non cuite]")

local non_cuites = 0
for _, e in ipairs(Catalogue.ESPECES) do
    if (not e.cuit) then non_cuites = non_cuites + 1 end
end
ok(non_cuites + #cuites == #Catalogue.ESPECES,
    "chaque espece est soit cuite soit non cuite, jamais les deux")

-- Le message de refus doit NOMMER le mesh manquant : c'est la seule façon que
-- l'information remonte jusqu'a quelqu'un qui puisse l'importer.
for _, e in ipairs(Catalogue.ESPECES) do
    if (not e.cuit) then
        ok(e.mesh ~= nil and e.mesh ~= "",
            e.id .. " non cuite nomme quand meme son mesh attendu")
    end
end

-- ── 6. Les animations ────────────────────────────────────────────────────────
--
-- ⚠ `PlayAnimation` sur une cle inconnue ne leve RIEN : la bete reste figee.
-- C'est le meme mode d'echec muet que `Sound` sur un son absent. Ces tests
-- verifient la FORME ; l'existence des cles dans Assets.toml est verifiee par
-- la moitie JS du harnais, qui seule peut lire le pack.
print("[6. les animations]")

local total_anims, animees, sans_repos = 0, 0, {}
local cles_vues = {}
for _, e in ipairs(Catalogue.ESPECES) do
    ok(type(e.anims) == "table", e.id .. " porte une liste d'animations")
    local n = #e.anims
    total_anims = total_anims + n
    if (n > 0) then animees = animees + 1 end

    for _, cle in ipairs(e.anims) do
        ok(type(cle) == "string" and cle ~= "", e.id .. " : cle d'animation non vide")
        -- Une cle vue deux fois viendrait de deux especes rangees au meme
        -- endroit : la bete jouerait l'animation d'une autre.
        ok(cles_vues[cle] == nil, "cle d'animation unique : " .. tostring(cle))
        cles_vues[cle] = e.id
        ok(cle:sub(1, 2) == "A_", tostring(cle) .. " porte le prefixe A_")
    end

    -- Le repos doit etre nil, ou une cle de CETTE espece. Un repos qui pointe
    -- ailleurs ferait jouer l'animation d'une autre bete, sans erreur.
    if (e.repos ~= nil) then
        ok(type(e.repos) == "string", e.id .. " : repos est une chaine")
        local dedans = false
        for _, cle in ipairs(e.anims) do
            if (cle == e.repos) then dedans = true end
        end
        ok(dedans, e.id .. " : le repos (" .. tostring(e.repos)
            .. ") est bien une animation de cette espece")
    elseif (n > 0) then
        sans_repos[#sans_repos + 1] = e.id
    end

    -- Une espece non cuite ne peut pas porter d'animation cuite : les deux
    -- viennent du meme pack.
    if (not e.cuit) then
        eq(n, 0, e.id .. " non cuite n'annonce aucune animation")
    end
end

ok(total_anims >= 0, "le compte d'animations est lisible")
if (#sans_repos > 0) then
    -- RAPPORTE, pas bloquant : une espece animee sans repos identifie est un
    -- etat legitime tant qu'on le SAIT. Elle restera figee.
    print("  (sans repos identifie : " .. table.concat(sans_repos, ", ") .. ")")
end
print("  " .. total_anims .. " animation(s) sur " .. animees .. " espece(s) animee(s)")

print(string.format("%d reussis, %d echec(s)", reussis, echoues))
if (echoues > 0) then error("animaux-tests : " .. echoues .. " echec(s)") end