-- ══════════════════════════════════════════════════════════════════════════════
-- modular-tests.lua — assertions sur Shared/Catalogs/Modular.lua.
-- Chargé par modular.mjs, qui fournit `Modular`.
--
-- Le catalogue est GÉNÉRÉ : ces tests ne vérifient donc pas son contenu pièce à
-- pièce (il changerait à chaque régénération) mais ses INVARIANTS — ceux qu'une
-- erreur de classement casserait sans rien lever.
-- ══════════════════════════════════════════════════════════════════════════════

local reussis, echecs = 0, 0

local function ok(condition, nom)
    if (condition) then
        reussis = reussis + 1
    else
        echecs = echecs + 1
        print("  ECHEC  " .. nom)
    end
end

local function egal(obtenu, attendu, nom)
    if (obtenu == attendu) then
        reussis = reussis + 1
    else
        echecs = echecs + 1
        print("  ECHEC  " .. nom .. "  obtenu=" .. tostring(obtenu) .. "  attendu=" .. tostring(attendu))
    end
end

local function section(nom) print("[" .. nom .. "]") end

-- ── Intégrité du catalogue ────────────────────────────────────────────────────

section("catalogue")

-- ⚠ PAS DE COMPTE FIGE. Le catalogue est GENERE : il grossit a chaque pack
-- importe, et une assertion sur « 40 pieces » casse a la premiere addition sans
-- rien apprendre. On verifie donc qu'il n'est pas VIDE, et le reste des tests
-- porte sur les invariants — asset prefixe, slot connu, genre valide, famille
-- coherente — qui, eux, doivent tenir quel que soit le nombre.
-- [ANCIENNE VERSION ↓ — bloc d'une version antérieure, non réaligné : ? ligne(s) attendue(s) ici, 206 connue(s)]
local total = 0
for _ in pairs(Modular.PIECES) do total = total + 1 end
ok(total > 0, "le catalogue n'est pas vide (" .. total .. " pieces)")

local slots_connus = {}
for _, s in ipairs(Modular.SLOTS) do slots_connus[s] = true end

-- Genre "*" : piece mixte, portee par les deux corps (vetements MetaHuman).
local genres = { M = 0, F = 0, ["*"] = 0 }
local sans_asset, mauvais_slot, mauvaise_famille = 0, 0, 0

local familles_connues = {}
for _, f in ipairs(Modular.FAMILLES) do familles_connues[f] = true end
for id, p in pairs(Modular.PIECES) do
    if (type(p.asset) ~= "string" or p.asset == "") then sans_asset = sans_asset + 1 end
    if (not slots_connus[p.slot]) then mauvais_slot = mauvais_slot + 1 end
    if (not familles_connues[p.famille]) then mauvaise_famille = mauvaise_famille + 1 end
    if (genres[p.genre]) then genres[p.genre] = genres[p.genre] + 1 end
    -- Le préfixe de pack est ce que nanos résout : sans lui, l'asset est
    -- introuvable au runtime et la pièce n'apparaît simplement pas.
    ok(p.asset:sub(1, 8) == "narvos::", "prefixe de pack sur " .. id)
end

egal(sans_asset, 0, "aucune piece sans asset")
egal(mauvais_slot, 0, "aucun slot hors de Modular.SLOTS")
egal(mauvaise_famille, 0, "aucune famille hors de Modular.FAMILLES")
egal(genres.M + genres.F + genres["*"], total, "toutes les pieces ont un genre M, F ou *")

-- ── ParSlot ───────────────────────────────────────────────────────────────────

section("ParSlot")

local torses_h = Modular.ParSlot("torse", "M", "stylized")
ok(#torses_h > 0, "des torses homme existent")

local tous_bons = true
for _, p in ipairs(torses_h) do
    if (Modular.PIECES[p.id].slot ~= "torse" or Modular.PIECES[p.id].genre ~= "M") then
        tous_bons = false
    end
end
ok(tous_bons, "ParSlot ne rend que le bon slot et le bon genre")

-- L'ordre doit être stable : `pairs` n'en garantit aucun en Lua, et une liste
-- qui change d'ordre à chaque appel ferait sauter la sélection de l'interface
-- d'un vêtement à l'autre entre deux rendus.
local encore = Modular.ParSlot("torse", "M")
local meme_ordre = #encore == #torses_h
for i = 1, #torses_h do
    if (encore[i].id ~= torses_h[i].id) then meme_ordre = false end
end
ok(meme_ordre, "ParSlot rend un ordre stable")

egal(#Modular.ParSlot("torse", "X"), 0, "genre inconnu rend une liste vide")

-- ── TenueDefaut ───────────────────────────────────────────────────────────────

section("TenueDefaut")

for _, genre in ipairs({ "M", "F" }) do
    local tenue = Modular.TenueDefaut(genre)
    ok(tenue.torse ~= nil, "tenue par defaut " .. genre .. " : un torse")
    ok(tenue.jambes ~= nil, "tenue par defaut " .. genre .. " : des jambes")
    ok(tenue.visage ~= nil, "tenue par defaut " .. genre .. " : un visage")

    -- Ce qui compte vraiment : la tenue par défaut doit passer sa propre
    -- validation. Sinon un personnage neuf naîtrait déjà invalide.
    local valide, raison = Modular.ValiderTenue(tenue, genre)
    ok(valide, "tenue par defaut " .. genre .. " valide (" .. tostring(raison) .. ")")
end


-- Le personnage neuf doit arriver HABILLE, pas nu. Les pieces de corps nu
-- restent choisissables ; elles ne sont simplement plus le defaut.
for _, genre in ipairs({ "M", "F" }) do
    local t = Modular.TenueDefaut(genre)
    local torse = Modular.PIECES[t.torse]
    egal(torse and torse.registre, "civil", "tenue par defaut " .. genre .. " : torse CIVIL, pas nu")

    local jambes = Modular.PIECES[t.jambes]
    egal(jambes and jambes.registre, "civil", "tenue par defaut " .. genre .. " : jambes CIVIL")

    -- Le visage n'a aucune piece civile : il doit retomber sur `base`, sinon le
    -- personnage naitrait sans tete.
    local visage = Modular.PIECES[t.visage]
    egal(visage and visage.registre, "base", "tenue par defaut " .. genre .. " : visage en repli sur base")

    -- Le slot tete porte DEUX choses : les coiffures (registre base) et les
    -- couvre-chefs (civil, uniforme, guerre). Un personnage neuf doit recevoir
    -- des cheveux, jamais un chapeau — un chapeau se choisit.
    --
    -- ⚠ CE TEST A CHANGE D'ENONCE, PAS D'INTENTION. Il exigeait `t.tete == nil`,
    -- ce qui etait juste tant que le slot ne contenait que des casques. Depuis
    -- l'arrivee des 8 coiffures et 5 chapeaux du pack Stylized (2026-09-04),
    -- « vide » n'est plus le bon resultat : c'est « rien qui s'achete ».
    local coiffe = Modular.PIECES[t.tete]
    if (t.tete ~= nil) then
        egal(coiffe and coiffe.registre, "base",
             "tenue par defaut " .. genre .. " : la tete recoit une coiffure, pas un chapeau")
    else
        -- Une famille sans coiffure laisse le slot vide, et c'est acceptable :
        -- les troopers n'ont que des casques.
        egal(t.tete, nil, "tenue par defaut " .. genre .. " : aucun couvre-chef impose")
    end
end

-- ── PorteurCachable ───────────────────────────────────────────────────────────

section("PorteurCachable")

-- ⚠ LE TEST QUI EVITE UN PERSONNAGE DECAPITE.
--
-- Cacher le mesh de base n'est acceptable que si la peau decoupee couvre la
-- TETE. La famille `mpfb` a recu quatre vetements — torse, jambes, mains,
-- pieds — qui suffisaient a la declarer cachable : le porteur disparaissait et
-- il ne restait plus de tete, aucune piece ne la remplacant.
--
-- La regle vaut pour toute famille future : quatre pieces de corps ne font pas
-- un personnage complet.
for cle in pairs(Modular.TENUE_BASE) do
    local famille, genre = cle:match("^(.+)|(.+)$")
    local nue = Modular.TENUE_BASE[cle]
    local aTete = (nue.visage ~= nil) or (nue.tete ~= nil)
    egal(Modular.PorteurCachable(famille, genre), aTete,
         cle .. " : cachable seulement si la tete est couverte")
end

-- Une famille inconnue n'est jamais cachable : sans peau de rechange, cacher
-- le porteur rendrait le joueur invisible.
egal(Modular.PorteurCachable("famille_inventee", "M"), false,
     "une famille inconnue n'est pas cachable")
egal(Modular.PorteurCachable(nil, nil), false, "nil n'est pas cachable")

-- ── ValiderTenue ──────────────────────────────────────────────────────────────

section("ValiderTenue")

egal(Modular.ValiderTenue(nil, "M", "stylized"), false, "tenue absente refusee")
egal(Modular.ValiderTenue({ torse = "piece_qui_nexiste_pas" }, "M", "stylized"), false, "piece inconnue refusee")

-- Une pièce rangée dans le mauvais slot : c'est exactement ce qu'une erreur de
-- classement du générateur produirait, et ça doit être refusé.
local un_torse
for id, p in pairs(Modular.PIECES) do
    if (p.slot == "torse" and p.genre == "M") then un_torse = id break end
end
egal(Modular.ValiderTenue({ jambes = un_torse }, "M", "stylized"), false, "torse pose en jambes refuse")

-- Genre croisé : une pièce femme sur un personnage homme ne se déforme pas
-- correctement et doit être refusée avant l'attachement.
-- ⚠ CONTRAINDRE LA FAMILLE dans la selection. Depuis SciFi_Trooper_Set, un
-- « torse feminin » peut appartenir a trooper_f : le valider contre stylized
-- echouerait pour une raison de FAMILLE, alors que le test porte sur le GENRE.
local un_torse_f
for id, p in pairs(Modular.PIECES) do
    if (p.slot == "torse" and p.genre == "F" and p.famille == "stylized") then
        un_torse_f = id break
    end
end
egal(Modular.ValiderTenue({ torse = un_torse_f }, "M", "stylized"), false, "piece femme sur homme refusee")
egal(Modular.ValiderTenue({ torse = un_torse_f }, "F", "stylized"), true, "piece femme sur femme acceptee")

-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
for _, c in pairs(Modular.CORPS) do familles_vues[c.famille] = true end
for _, f in ipairs(Modular.FAMILLES) do
    ok(familles_vues[f] == true, "la famille " .. f .. " a au moins un corps")
end

-- ⚠ CONDITIONNEL, et c'est voulu : il faut DEUX familles pour qu'un melange
-- soit possible. Le test dort quand il n'y en a qu'une, et reprend sa garde des
-- qu'une seconde entre au catalogue — le moment exact ou le defaut redevient
-- possible. Le supprimer laisserait ce moment sans surveillance.
--
-- ⚠ ON NE RETIENT QUE LES FAMILLES QUI ONT DES PIECES. Depuis le 2026-09-12,
-- `metahuman` est une famille SANS aucune piece : son corps est un Blueprint qui
-- s'habille lui-meme. La prendre pour famille_b faisait echouer « une piece de
-- torse existe » — un vrai echec, mais sur une regle que ce test ne juge pas.
local familles_avec_pieces = {}
for _, p in pairs(Modular.PIECES) do familles_avec_pieces[p.famille] = true end

local famille_a, famille_b
for _, f in ipairs(Modular.FAMILLES) do
    if (familles_avec_pieces[f]) then
        if (not famille_a) then famille_a = f elseif (not famille_b) then famille_b = f end
    end
end

if (famille_b) then
    local piece_b
    for id, p in pairs(Modular.PIECES) do
        if (p.famille == famille_b and p.slot == "torse") then piece_b = id break end
    end
    ok(piece_b ~= nil, "une piece de torse existe dans la famille " .. famille_b)

    if (piece_b) then
        -- ⚠ Le GENRE se lit sur la piece, il ne se suppose pas. Depuis
        -- SciFi_Trooper_Set les familles sont des MORPHOLOGIES (trooper_m,
        -- trooper_f, trooper_pf) : coder « M » en dur faisait echouer le test
        -- sur une famille feminine, pour une raison sans rapport avec le melange
        -- de familles qu'il est cense verifier.
        local g = Modular.PIECES[piece_b].genre
        egal(Modular.ValiderTenue({ torse = piece_b }, g, famille_a), false,
             "piece " .. famille_b .. " sur corps " .. famille_a .. " REFUSEE")
        egal(Modular.ValiderTenue({ torse = piece_b }, g, famille_b), true,
             "piece " .. famille_b .. " sur son propre corps acceptee")
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- Chaque corps doit avoir une tenue par defaut VALIDE dans sa propre famille.
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
    ok(v, "tenue par defaut valide pour le corps " .. id .. " (" .. tostring(r) .. ")")
-- [ANCIENNE VERSION ↑]
-- [FIN INCONNUE — la suite du fichier n'a jamais été lue dans sa dernière version]
-- [MODIFICATIONS NON REPLACÉES — 1 modification(s) faite(s) à ce fichier n'ont pas pu y être reportées (texte d'origine introuvable ou ambigu) : voir EDITS_NON_APPLIQUES]