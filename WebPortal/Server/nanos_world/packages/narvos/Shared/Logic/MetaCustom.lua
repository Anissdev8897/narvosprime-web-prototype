-- ═══════════════════════════════════════════════════════════════════════════════
-- Logic/MetaCustom.lua — l'APPARENCE d'un personnage du Meta Customization System,
-- en logique PURE : ce que le joueur peut choisir, ce que le serveur accepte, ce
-- qui part en base, et la liste exacte des appels à faire sur le Blueprint.
--
-- Câblage : Narvos.MetaCustomLogic = Package.Require("Logic/MetaCustom.lua"),
-- puis MetaCustomLogic.Configurer(Narvos.MetaCustom) (le CATALOGUE, généré).
-- ⚠ Deux noms, deux choses : `Narvos.MetaCustom` est le catalogue,
-- `Narvos.MetaCustomLogic` ce module. Les confondre rend nil sans erreur.
--
-- ── LE CONTRAT AVEC LE BLUEPRINT ───────────────────────────────────────────────
-- BP_NarvosMH_M / BP_NarvosMH_F exposent des fonctions génériques, appelées par le
-- CLIENT (`Blueprint:CallBlueprintEvent`) avec des chaînes et des nombres :
--   NarvosMaillage(Emplacement, Chemin)             Torso, Legs, Feet, Prop, Face
--   NarvosGroom(Emplacement, Groom, Liaison)        Hair, Eyebrows, Eyelashes, Fuzz…
--   NarvosMateriau(Emplacement, Index, Chemin)      Body, Face
--   NarvosParamReel(Emplacement, Nom, Valeur)       SetScalarParameterValueOnMaterials
--   NarvosParamCouleur(Emplacement, Nom, R, G, B)   SetVectorParameterValueOnMaterials
--   NarvosParamTexture(Emplacement, Index, Nom, Chemin)
--   NarvosAnimReel(Emplacement, Nom, Valeur)        variable de l'ABP de post-traitement
--   NarvosAnimBool(Emplacement, Nom, Valeur)
-- `MetaCustom.Operations` rend ces appels dans l'ORDRE qui compte : la peau avant
-- la teinte et le tatouage (poser un matériau efface les instances dynamiques).
--
-- ── REVALIDATION ───────────────────────────────────────────────────────────────
-- Le client propose, le serveur NORMALISE : identifiants inconnus, genre croisé,
-- option non cuite, nombre hors bornes ou NaN — tout est ramené au catalogue.
-- ═══════════════════════════════════════════════════════════════════════════════

local MetaCustom = {}

MetaCustom.VERSION = 1

local catalogue = nil

--- Branche le catalogue généré (Catalogs/MetaCustom.lua).
---@param cat table
---@return boolean
function MetaCustom.Configurer(cat)
    if (type(cat) ~= "table") then return false end
    catalogue = cat
    return true
end

local function Cat()
    return catalogue or (Narvos and Narvos.MetaCustom) or nil
end

local SORTES_VETEMENT = { "haut", "bas", "chaussures", "tenue", "accessoire" }
local SORTES_GROOM = { "cheveux", "sourcils", "cils", "duvet", "barbe", "moustache" }
MetaCustom.SORTES_VETEMENT = SORTES_VETEMENT
MetaCustom.SORTES_GROOM = SORTES_GROOM

-- ── Outils ────────────────────────────────────────────────────────────────────

local function Nombre(v)
    local n = tonumber(v)
    if (n == nil or n ~= n or n == math.huge or n == -math.huge) then return nil end
    return n
end

local function Borner(v, min, max)
    if (v < min) then return min end
    if (v > max) then return max end
    return v
end

local function GenreValide(g)
    if (g == "m" or g == "M") then return "m" end
    if (g == "f" or g == "F") then return "f" end
    return nil
end

local function PourGenre(option, genre)
    return option.genre == nil or option.genre == "mf" or option.genre == genre
end

local function ParId(liste, id)
    if (type(liste) ~= "table" or type(id) ~= "string") then return nil end
    for _, o in ipairs(liste) do
        if (o.id == id) then return o end
    end
    return nil
end

-- Une liaison est calculee pour un mesh de visage, pas pour un genre.
local function LiaisonGroom(o, identite, genre)
    if (not o or not o.cuit) then return nil end
    if (type(o.liaisons) == "table") then return o.liaisons[identite] end
    return PourGenre(o, genre) and o.liaison or nil
end

local function PremierGroom(liste, identite, genre)
    for _, o in ipairs(liste or {}) do
        if (PourGenre(o, genre) and LiaisonGroom(o, identite, genre)) then return o.id end
    end
    for _, o in ipairs(liste or {}) do
        if (LiaisonGroom(o, identite, genre)) then return o.id end
    end
end

--- HSV (h en degrés 0-360, s et v de 0 à 1) vers RGB 0-1 — la conversion de
--- `UKismetMathLibrary::HSVToRGB` que le pack emploie pour la teinte et les cheveux.
---@return number, number, number
function MetaCustom.HsvVersRgb(h, s, v)
    h = (Nombre(h) or 0) % 360
    s = Borner(Nombre(s) or 0, 0, 1)
    v = Borner(Nombre(v) or 0, 0, 1)
    local c = v * s
    local x = c * (1 - math.abs((h / 60) % 2 - 1))
    local m = v - c
    local r, g, b
    if (h < 60) then r, g, b = c, x, 0
    elseif (h < 120) then r, g, b = x, c, 0
    elseif (h < 180) then r, g, b = 0, c, x
    elseif (h < 240) then r, g, b = 0, x, c
    elseif (h < 300) then r, g, b = x, 0, c
    else r, g, b = c, 0, x end
    return r + m, g + m, b + m
end

-- ── Ce qui est proposé ────────────────────────────────────────────────────────

--- Les options d'un genre, COPIÉES, filtrées sur `cuit` : ce que l'écran affiche.
---@param genre any "m" ou "f"
---@return table|nil
function MetaCustom.Options(genre)
    local cat = Cat()
    local g = GenreValide(genre)
    if (not cat or not g) then return nil end
    local function filtrer(liste)
        local sortie = {}
        for _, o in ipairs(liste or {}) do
            if (o.cuit and PourGenre(o, g)) then sortie[#sortie + 1] = { id = o.id, label = o.label } end
        end
        return sortie
    end
    local options = {
        genre = g,
        identites = filtrer(cat.IDENTITES),
        vetements = {},
        grooms = {},
        tatouages = filtrer(cat.TATOUAGES),
        corps = {},
        visage = {},
        yeux = {},
        emplacements = cat.EMPLACEMENTS or 0,
        -- Les options M et F partent dans le même message réseau. Ne pas
        -- partager ces tables : nanos viderait la deuxième référence.
        defaut_teinte = cat.DEFAUT_TEINTE and {
            h = cat.DEFAUT_TEINTE.h, s = cat.DEFAUT_TEINTE.s, v = cat.DEFAUT_TEINTE.v,
        },
        defaut_cheveux = cat.DEFAUT_CHEVEUX and {
            h = cat.DEFAUT_CHEVEUX.h, v = cat.DEFAUT_CHEVEUX.v,
        },
    }
    for _, s in ipairs(SORTES_VETEMENT) do options.vetements[s] = filtrer((cat.VETEMENTS or {})[s]) end
    for _, s in ipairs(SORTES_GROOM) do
        options.grooms[s] = {}
        for _, o in ipairs((cat.GROOMS or {})[s] or {}) do
            local identites = {}
            for _, i in ipairs(cat.IDENTITES or {}) do
                if (i.cuit and PourGenre(i, g) and LiaisonGroom(o, i.id, g)) then identites[#identites + 1] = i.id end
            end
            if (#identites > 0) then
                options.grooms[s][#options.grooms[s] + 1] = { id = o.id, label = o.label, identites = identites }
            end
        end
    end
    for _, c in ipairs(cat.CORPS or {}) do
        options.corps[#options.corps + 1] = { id = c.id, label = c.label, min = c.min, max = c.max, defaut = c.defaut, pas = c.pas }
    end
    for _, c in ipairs(cat.VISAGE or {}) do
        options.visage[#options.visage + 1] = { id = c.id, label = c.label, min = c.min, max = c.max, defaut = c.defaut, pas = c.pas }
    end
    for _, y in ipairs(cat.YEUX or {}) do
        options.yeux[#options.yeux + 1] = { id = y.id, label = y.label, min = y.min, max = y.max, defaut = y.defaut }
    end
    return options
end

--- L'apparence de départ d'un genre : la première identité cuite, les grooms de
--- SON genre, AUCUN vêtement, curseurs et teinte au neutre.
---
--- ⚠ AUCUN VÊTEMENT D'OFFICE (2026-09-14). Ce défaut posait le premier haut, bas
--- et paire de chaussures cuits (Jacket / Pants / Boots sur l'homme) : l'aperçu
--- de création les montrait avant tout choix, et la création les ÉCRIVAIT en base.
--- Retour de jeu de Hanibes : « un vêtement apparaît sans que le joueur l'ait
--- sélectionné ». Le joueur habille ; le défaut n'habille pas.
---
--- Le defaut prefere les coiffures d'origine du corps lorsqu'une liaison existe
--- pour le visage choisi. Le joueur peut ensuite choisir toute coupe compatible,
--- y compris « aucun » ; la compatibilite depend du mesh cible du binding.
---@param genre any
---@return table|nil
function MetaCustom.Defaut(genre)
    local cat = Cat()
    local g = GenreValide(genre)
    if (not cat or not g) then return nil end
    local function premier(liste)
        for _, o in ipairs(liste or {}) do
            if (o.cuit and PourGenre(o, g)) then return o.id end
        end
        return nil
    end
    local identite = premier(cat.IDENTITES)
    local a = {
        v = MetaCustom.VERSION,
        genre = g,
        identite = identite,
        vetements = {},
        grooms = {
            cheveux = PremierGroom((cat.GROOMS or {}).cheveux, identite, g),
            sourcils = PremierGroom((cat.GROOMS or {}).sourcils, identite, g),
            cils = PremierGroom((cat.GROOMS or {}).cils, identite, g),
        },
        corps = {},
        corps_actif = true,
        visage = {},
        yeux = {},
        -- Saturation NULLE : `BaseColortint` blanc ne change rien. Le défaut du
        -- Styler (h 0, s 1) est un rouge pur — « Teinte active » cochée sans
        -- toucher la nuance donnait une peau rouge vif.
        teinte = { actif = false, h = (cat.DEFAUT_TEINTE or {}).h or 0, s = 0, v = (cat.DEFAUT_TEINTE or {}).v or 1 },
        cheveux_couleur = { actif = false, h = (cat.DEFAUT_CHEVEUX or {}).h or 0, v = (cat.DEFAUT_CHEVEUX or {}).v or 0.5 },
        tatouage = nil,
        physique = true,
        animation = true,
    }
    for _, c in ipairs(cat.CORPS or {}) do a.corps[c.id] = c.defaut end
    for _, c in ipairs(cat.VISAGE or {}) do a.visage[c.id] = c.defaut end
    for _, y in ipairs(cat.YEUX or {}) do a.yeux[y.id] = y.defaut end
    return a
end

-- ── Ce que le serveur accepte ─────────────────────────────────────────────────

local function OptionCuite(liste, id, genre)
    local o = ParId(liste, id)
    if (o and o.cuit and PourGenre(o, genre)) then return o.id end
    return nil
end

local function Curseurs(defs, valeurs)
    local sortie = {}
    for _, c in ipairs(defs or {}) do
        local v = Nombre(type(valeurs) == "table" and valeurs[c.id] or nil)
        sortie[c.id] = v and Borner(v, c.min, c.max) or c.defaut
    end
    return sortie
end

--- Ramène une apparence proposée au catalogue. Tout ce qui est inconnu, croisé
--- (genre), non cuit ou hors bornes est remplacé par le défaut — jamais refusé en
--- bloc : un détail faux ne doit pas effacer le reste du travail du joueur.
---@param proposee any
---@param genre any   le genre qui fait foi (celui du corps), prioritaire sur la proposition
---@return table|nil
function MetaCustom.Normaliser(proposee, genre)
    local g = GenreValide(genre) or GenreValide(type(proposee) == "table" and proposee.genre or nil)
    local base = MetaCustom.Defaut(g)
    if (not base) then return nil end
    if (type(proposee) ~= "table") then return base end
    local cat = Cat()

    local a = {
        v = MetaCustom.VERSION,
        genre = g,
        identite = OptionCuite(cat.IDENTITES, proposee.identite, g) or base.identite,
        vetements = {},
        grooms = {},
        corps = Curseurs(cat.CORPS, proposee.corps),
        corps_actif = proposee.corps_actif ~= false,
        visage = Curseurs(cat.VISAGE, proposee.visage),
        yeux = {},
        teinte = {},
        cheveux_couleur = {},
        tatouage = OptionCuite(cat.TATOUAGES, proposee.tatouage, g),
        physique = proposee.physique ~= false,
        animation = proposee.animation ~= false,
    }
    local vet = type(proposee.vetements) == "table" and proposee.vetements or {}
    for _, s in ipairs(SORTES_VETEMENT) do
        a.vetements[s] = OptionCuite((cat.VETEMENTS or {})[s], vet[s], g)
    end
    local gr = type(proposee.grooms) == "table" and proposee.grooms or {}
    for _, s in ipairs(SORTES_GROOM) do
        -- Un groom nomme mais incompatible retombe sur une coupe liee a cette
        -- identite. Un groom absent reste absent : c'est le choix « aucun ».
        local nomme = type(gr[s]) == "string" and gr[s] ~= ""
        local liste = (cat.GROOMS or {})[s]
        local choisi = ParId(liste, gr[s])
        a.grooms[s] = LiaisonGroom(choisi, a.identite, g) and choisi.id
            or (nomme and PremierGroom(liste, a.identite, g) or nil)
    end
    local yeux = type(proposee.yeux) == "table" and proposee.yeux or {}
    for _, y in ipairs(cat.YEUX or {}) do
        local v = Nombre(yeux[y.id])
        a.yeux[y.id] = v and Borner(v, y.min, y.max) or y.defaut
    end
    local t = type(proposee.teinte) == "table" and proposee.teinte or {}
    a.teinte.actif = t.actif == true
    a.teinte.h = Borner(Nombre(t.h) or base.teinte.h, 0, 360)
    a.teinte.s = Borner(Nombre(t.s) or base.teinte.s, 0, 1)
    a.teinte.v = Borner(Nombre(t.v) or base.teinte.v, 0, 1)
    local cc = type(proposee.cheveux_couleur) == "table" and proposee.cheveux_couleur or {}
    a.cheveux_couleur.actif = cc.actif == true
    a.cheveux_couleur.h = Borner(Nombre(cc.h) or base.cheveux_couleur.h, 0, 360)
    a.cheveux_couleur.v = Borner(Nombre(cc.v) or base.cheveux_couleur.v, 0, 1)
    return a
end

-- ── Ce qui part en base ───────────────────────────────────────────────────────
--
-- Une ligne `cle=valeur;…`, triée, sans JSON : le module doit se charger sous
-- wasmoon (harnais) où `JSON` n'existe pas, et une sortie triée se compare.

local function EcrireNombre(n)
    local s = string.format("%.4f", n)
    s = s:gsub("0+$", ""):gsub("%.$", "")
    return s
end

--- Encode une apparence NORMALISÉE.
---@param a table
---@return string
function MetaCustom.Encoder(a)
    if (type(a) ~= "table") then return "" end
    local paires = {}
    local function ajouter(cle, valeur)
        if (valeur == nil) then return end
        if (type(valeur) == "boolean") then valeur = valeur and "1" or "0"
        elseif (type(valeur) == "number") then valeur = EcrireNombre(valeur)
        else valeur = tostring(valeur):gsub("[;=]", "") end
        paires[#paires + 1] = cle .. "=" .. valeur
    end
    ajouter("v", a.v or MetaCustom.VERSION)
    ajouter("genre", a.genre)
    ajouter("identite", a.identite)
    for _, s in ipairs(SORTES_VETEMENT) do ajouter("vet." .. s, (a.vetements or {})[s]) end
    for _, s in ipairs(SORTES_GROOM) do ajouter("groom." .. s, (a.grooms or {})[s]) end
    for id, v in pairs(a.corps or {}) do ajouter("corps." .. id, v) end
    ajouter("corps_actif", a.corps_actif)
    for id, v in pairs(a.visage or {}) do ajouter("visage." .. id, v) end
    for id, v in pairs(a.yeux or {}) do ajouter("yeux." .. id, v) end
    ajouter("teinte.actif", (a.teinte or {}).actif)
    ajouter("teinte.h", (a.teinte or {}).h)
    ajouter("teinte.s", (a.teinte or {}).s)
    ajouter("teinte.v", (a.teinte or {}).v)
    ajouter("cheveux.actif", (a.cheveux_couleur or {}).actif)
    ajouter("cheveux.h", (a.cheveux_couleur or {}).h)
    ajouter("cheveux.v", (a.cheveux_couleur or {}).v)
    ajouter("tatouage", a.tatouage)
    ajouter("physique", a.physique)
    ajouter("animation", a.animation)
    table.sort(paires)
    return table.concat(paires, ";")
end

--- Décode une ligne de base en apparence BRUTE (à normaliser ensuite).
---@param texte any
---@return table|nil
function MetaCustom.Decoder(texte)
    if (type(texte) ~= "string" or texte == "") then return nil end
    local a = { vetements = {}, grooms = {}, corps = {}, visage = {}, yeux = {}, teinte = {}, cheveux_couleur = {} }
    local function bool(v) return v == "1" end
    for paire in texte:gmatch("[^;]+") do
        local cle, valeur = paire:match("^([%w_%.]+)=(.*)$")
        if (cle) then
            local groupe, sous = cle:match("^([%w_]+)%.([%w_]+)$")
            if (groupe == "vet") then a.vetements[sous] = valeur
            elseif (groupe == "groom") then a.grooms[sous] = valeur
            elseif (groupe == "corps") then a.corps[sous] = tonumber(valeur)
            elseif (groupe == "visage") then a.visage[sous] = tonumber(valeur)
            elseif (groupe == "yeux") then a.yeux[sous] = tonumber(valeur)
            elseif (groupe == "teinte") then a.teinte[sous] = (sous == "actif") and bool(valeur) or tonumber(valeur)
            elseif (groupe == "cheveux") then a.cheveux_couleur[sous] = (sous == "actif") and bool(valeur) or tonumber(valeur)
            elseif (cle == "corps_actif" or cle == "physique" or cle == "animation") then a[cle] = bool(valeur)
            elseif (cle == "v") then a.v = tonumber(valeur)
            else a[cle] = valeur end
        end
    end
    return a
end

--- Les emplacements (1-18) : une liste de lignes encodées, séparées par `|`.
---@param liste table { [n] = texte encodé | nil }
---@return string
function MetaCustom.EncoderEmplacements(liste)
    local cat = Cat()
    local max = (cat and cat.EMPLACEMENTS) or 18
    local morceaux = {}
    for i = 1, max do
        local t = type(liste) == "table" and liste[i] or nil
        morceaux[i] = (type(t) == "string") and t:gsub("|", "") or ""
    end
    return table.concat(morceaux, "|")
end

---@param texte any
---@return table { [n] = texte encodé } — les emplacements vides sont nil
function MetaCustom.DecoderEmplacements(texte)
    local sortie = {}
    if (type(texte) ~= "string") then return sortie end
    local i = 0
    for morceau in (texte .. "|"):gmatch("([^|]*)|") do
        i = i + 1
        if (morceau ~= "") then sortie[i] = morceau end
    end
    return sortie
end

-- ── Ce que le Blueprint doit faire ────────────────────────────────────────────

--- Les appels à faire, dans l'ordre, pour montrer une apparence NORMALISÉE.
--- Chaque entrée : { fonction, arg1, arg2, … }.
---@param a table
---@return table
function MetaCustom.Operations(a)
    local cat = Cat()
    local ops = {}
    if (not cat or type(a) ~= "table") then return ops end
    local function op(...) ops[#ops + 1] = { ... } end

    -- 1. Visage et peau de l'identité.
    local ident = ParId(cat.IDENTITES, a.identite)
    if (ident) then
        op("NarvosMaillage", "Face", ident.visage)
        op("NarvosMateriau", "Body", 0, ident.materiau_corps)
        -- Chaque LOD a son slot : remplacer seulement le slot 0 conservait les
        -- materiaux Hana/Gavin sur les autres identites (peau et cils compris).
        if (ident.materiaux_visage and #ident.materiaux_visage > 0) then
            for index, materiau in ipairs(ident.materiaux_visage) do
                op("NarvosMateriau", "Face", index - 1, materiau)
            end
        else
            op("NarvosMateriau", "Face", 0, ident.materiau_visage)
        end
    end

    -- 2. Vêtements. Une TENUE remplace haut et bas : le composant Legs est vidé,
    --    sinon un pantalon ressortirait sous une robe.
    local vet = a.vetements or {}
    local comp = cat.COMPOSANTS or {}
    local function chemin(sorte, id)
        local o = ParId((cat.VETEMENTS or {})[sorte], id)
        return o and o.chemin or ""
    end
    if (vet.tenue) then
        op("NarvosMaillage", comp.tenue or "Torso", chemin("tenue", vet.tenue))
        op("NarvosMaillage", comp.bas or "Legs", "")
    else
        op("NarvosMaillage", comp.haut or "Torso", chemin("haut", vet.haut))
        op("NarvosMaillage", comp.bas or "Legs", chemin("bas", vet.bas))
    end
    op("NarvosMaillage", comp.chaussures or "Feet", chemin("chaussures", vet.chaussures))
    op("NarvosMaillage", comp.accessoire or "Prop", chemin("accessoire", vet.accessoire))

    -- 3. Grooms : chaque sorte connue du catalogue est posée ou VIDÉE.
    for _, sorte in ipairs(SORTES_GROOM) do
        local liste = (cat.GROOMS or {})[sorte]
        if (liste and #liste > 0) then
            local o = ParId(liste, (a.grooms or {})[sorte])
            local liaison = LiaisonGroom(o, a.identite, a.genre)
            if (not liaison) then o = nil end
            op("NarvosGroom", liste[1].composant, o and o.groom or "", liaison or "")
            -- L'ordre Hair/Cards/Helmet varie entre coiffures. Le composant
            -- reutilise doit recevoir TOUS les slots du nouveau groom.
            for index, materiau in ipairs(o and o.materiaux or {}) do
                op("NarvosMateriau", liste[1].composant, index - 1, materiau)
            end
        end
    end

    -- 4. Teinte de peau (après la peau : poser un matériau efface l'instance dynamique).
    local p = cat.PARAMS or {}
    local t = a.teinte or {}
    local r, g, b = MetaCustom.HsvVersRgb(t.h, t.s, t.v)
    for _, zone in ipairs({ "Body", "Face" }) do
        op("NarvosParamReel", zone, p.teinte_actif, t.actif and 1 or 0)
        op("NarvosParamCouleur", zone, p.teinte_couleur, r, g, b)
    end

    -- 5. Tatouage : la zone choisie s'allume, l'autre s'éteint.
    local tat = ParId(cat.TATOUAGES, a.tatouage)
    for _, zone in ipairs({ "Body", "Face" }) do
        if (tat and tat.zone == zone) then
            op("NarvosParamTexture", zone, 0, p.tatouage_masque, tat.masque)
            if (tat.diffuse) then op("NarvosParamTexture", zone, 0, p.tatouage_diffuse, tat.diffuse) end
            op("NarvosParamReel", zone, p.tatouage_actif, 1)
        else
            op("NarvosParamReel", zone, p.tatouage_actif, 0)
        end
    end

    -- 6. Yeux.
    for _, y in ipairs(cat.YEUX or {}) do
        op("NarvosParamReel", "Face", y.param, (a.yeux or {})[y.id] or y.defaut)
    end

    -- 7. Couleur des cheveux : S = V / 1,2, comme le pack.
    local cc = a.cheveux_couleur or {}
    if (cc.actif) then
        local hr, hg, hb = MetaCustom.HsvVersRgb(cc.h, (cc.v or 0) / 1.2, cc.v)
        for _, zone in ipairs({ "Hair", "Eyebrows", "Eyelashes" }) do
            op("NarvosParamCouleur", zone, p.cheveux_teinture, hr, hg, hb)
        end
        op("NarvosParamReel", "Hair", p.cheveux_rugosite, p.rugosite or 0.29)
    end

    -- 8. Curseurs du corps et du visage, puis leurs activations.
    for _, c in ipairs(cat.CORPS or {}) do
        op("NarvosAnimReel", "Body", c.variable, (a.corps or {})[c.id] or c.defaut)
        for _, var in ipairs(c.activation or {}) do
            op("NarvosAnimBool", "Body", var, a.corps_actif ~= false)
        end
    end
    for _, c in ipairs(cat.VISAGE or {}) do
        op("NarvosAnimReel", "Face", c.variable, (a.visage or {})[c.id] or c.defaut)
        for _, var in ipairs(c.activation or {}) do
            op("NarvosAnimBool", "Face", var, true)
        end
    end
    op("NarvosAnimBool", "Body", "Enable_Physics", a.physique ~= false)
    op("NarvosAnimBool", "Body", "Animation", a.animation ~= false)
    return ops
end

return MetaCustom
