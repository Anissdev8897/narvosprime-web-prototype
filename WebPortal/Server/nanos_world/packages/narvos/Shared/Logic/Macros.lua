-- ══════════════════════════════════════════════════════════════════════════════
-- Macros.lua — six curseurs de corps vers 340 morphs. PUR.
--
-- Porté depuis `WebPortal/src/rpg/characters/modular/macroWeights.ts`, qui tient
-- ce rôle dans le prototype web. Aucun appel moteur ici : le module tourne en
-- Lua nu, donc sous les tests.
--
-- ── POURQUOI SIX CURSEURS ET NON TROIS CENT QUARANTE ──────────────────────────
-- MakeHuman n'a pas de « corps masculin » et de « corps féminin » : il a UN
-- maillage neutre et des morphs qui l'emmènent vers des extrêmes discrets. Les
-- 340 morphs `macrodetails` sont des ANCRES d'une grille à cinq dimensions —
-- `universal-male-young-maxmuscle-minweight`,
-- `height/female-old-averagemuscle-averageweight-maxheight`.
--
-- Aucune ne se règle seule. Une position de curseur ne tombe presque jamais sur
-- une ancre : on répartit son poids entre les deux qui l'encadrent, et on
-- multiplie les facteurs entre familles. « Homme à 70 %, jeune, musclé à 30 % »
-- active donc plusieurs morphs, chacun pour sa part.
--
-- C'est cette répartition qui rend la morphologie CONTINUE plutôt que catalogue.
--
-- ── BÉBÉ ET ENFANT SONT HORS PÉRIMÈTRE ───────────────────────────────────────
-- MakeHuman propose quatre âges (baby, child, young, old). NARVOS est un MMO
-- dont les personnages jouables sont adultes : on n'expose que `young` → `old`.
-- Cela divise par deux les morphs atteints, et surtout évite de produire des
-- corps d'enfants.
-- ══════════════════════════════════════════════════════════════════════════════

local Macros = {}

--- Âges exposés. `baby` et `child` existent dans le pack et restent hors jeu.
local AGES = { "young", "old" }

--- Niveaux de composition corporelle.
local NIVEAUX = { "min", "average", "max" }

--- Curseurs de haut niveau, dans l'ordre d'affichage.
---
--- `taille` est à part : son neutre est 0,5 et n'active AUCUN morph, la taille
--- de base étant celle du maillage. Les autres ont un neutre qui active bien
--- quelque chose.
Macros.CURSEURS = {
    { id = "gender", label = "Genre", gauche = "Féminin", droit = "Masculin", defaut = 0.5 },
    { id = "age", label = "Âge", gauche = "Jeune", droit = "Âgé", defaut = 0.25 },
    { id = "muscle", label = "Musculature", gauche = "Fine", droit = "Puissante", defaut = 0.5 },
    { id = "weight", label = "Corpulence", gauche = "Mince", droit = "Forte", defaut = 0.5 },
    { id = "height", label = "Taille", gauche = "Petit", droit = "Grand", defaut = 0.5 },
}

--- Ethnies. Elles se mélangent au lieu de s'exclure : un visage n'appartient pas
--- à une case, et forcer un choix unique appauvrirait la création.
Macros.ETHNIES = {
    { id = "african", label = "Africaine" },
    { id = "asian", label = "Asiatique" },
    { id = "caucasian", label = "Caucasienne" },
}

--- Réglage neutre : le point de départ du créateur.
---@return table
function Macros.Defaut()
    local sortie = {}
    for _, c in ipairs(Macros.CURSEURS) do sortie[c.id] = c.defaut end
    sortie.ethnicity = { african = 1 / 3, asian = 1 / 3, caucasian = 1 / 3 }
    return sortie
end

-- ── Répartition ───────────────────────────────────────────────────────────────

local function borner(v)
    local n = tonumber(v) or 0
    if (n < 0) then return 0 end
    if (n > 1) then return 1 end
    return n
end

--- Répartit un curseur 0→1 entre des ancres régulièrement espacées.
---
--- Rend uniquement les ancres de poids non nul : les produire toutes
--- alourdirait le produit cartésien plus bas pour rien — sur trois familles
--- croisées, l'économie est réelle.
---@param valeur number
---@param ancres string[]
---@return table  { { nom, poids }, … }
local function repartir(valeur, ancres)
    local v = borner(valeur)
    if (#ancres == 1) then return { { ancres[1], 1 } } end

    local pos = v * (#ancres - 1)
    local bas = math.floor(pos)
    if (bas > #ancres - 2) then bas = #ancres - 2 end
    local frac = pos - bas

    local sortie = {}
    -- Indices Lua : `bas` est un décalage depuis 0, les tables commencent à 1.
    if (frac < 1) then sortie[#sortie + 1] = { ancres[bas + 1], 1 - frac } end
    if (frac > 0) then sortie[#sortie + 1] = { ancres[bas + 2], frac } end
    return sortie
end

--- Ethnies normalisées. Une somme nulle retombe sur un mélange égal plutôt que
--- sur une division par zéro.
local function ethnies(e)
    if (type(e) ~= "table") then e = {} end
    local a = math.max(0, tonumber(e.african) or 0)
    local s = math.max(0, tonumber(e.asian) or 0)
    local c = math.max(0, tonumber(e.caucasian) or 0)
    local total = a + s + c

    if (total <= 0) then
        return { { "african", 1 / 3 }, { "asian", 1 / 3 }, { "caucasian", 1 / 3 } }
    end

    local sortie = {}
    if (a > 0) then sortie[#sortie + 1] = { "african", a / total } end
    if (s > 0) then sortie[#sortie + 1] = { "asian", s / total } end
    if (c > 0) then sortie[#sortie + 1] = { "caucasian", c / total } end
    return sortie
end

local function ajouter(sortie, nom, poids)
    if (poids <= 0) then return end
    sortie[nom] = (sortie[nom] or 0) + poids
end

-- ── Traduction ────────────────────────────────────────────────────────────────

--- Traduit les réglages de corps en poids de morphs `macrodetails`.
---
--- ⚠ LES NOMS PRODUITS DOIVENT CORRESPONDRE EXACTEMENT à ceux du pack. S'ils
--- divergeaient, `SetMorphTarget` ne lèverait pas : les morphs seraient
--- introuvables et le corps resterait neutre, sans le moindre signal. C'est ce
--- que verrouille `macros-tests.lua`, en confrontant chaque nom produit au
--- catalogue réel.
---@param m table|nil  { gender, age, muscle, weight, height, ethnicity }
---@return table  { [nom_de_morph] = poids }
function Macros.Resoudre(m)
    local sortie = {}
    if (type(m) ~= "table") then m = Macros.Defaut() end

    local genres = repartir(m.gender ~= nil and m.gender or 0.5, { "female", "male" })
    local ages = repartir(m.age ~= nil and m.age or 0.25, AGES)
    local muscles = repartir(m.muscle ~= nil and m.muscle or 0.5, NIVEAUX)
    local poids = repartir(m.weight ~= nil and m.weight or 0.5, NIVEAUX)
    local eths = ethnies(m.ethnicity)

    -- ── Famille 1 : ethnie × genre × âge ──────────────────────────────────────
    for _, e in ipairs(eths) do
        for _, g in ipairs(genres) do
            for _, a in ipairs(ages) do
                ajouter(sortie, e[1] .. "-" .. g[1] .. "-" .. a[1], e[2] * g[2] * a[2])
            end
        end
    end

    -- ── Famille 2 : composition corporelle ────────────────────────────────────
    --
    -- Les suffixes ne sont pas `min`/`max` seuls mais `minmuscle`, `maxweight`.
    -- Se tromper ici ne lève rien.
    for _, g in ipairs(genres) do
        for _, a in ipairs(ages) do
            for _, mu in ipairs(muscles) do
                for _, w in ipairs(poids) do
                    -- ⚠ `averagemuscle-averageweight` N'EXISTE PAS. Sur les neuf
                    -- combinaisons, MakeHuman n'en livre que huit : le point
                    -- moyen/moyen EST le maillage de base, il n'y a rien à
                    -- déplacer. Le poids n'est pas perdu pour autant — il reste
                    -- implicitement sur la base, ce qui est le résultat voulu.
                    --
                    -- La famille `height/` ne suit PAS cette règle et possède bien
                    -- son `averagemuscle-averageweight` : changer de taille
                    -- déplace des sommets même à corpulence moyenne. Deux familles
                    -- voisines, deux conventions.
                    if (not (mu[1] == "average" and w[1] == "average")) then
                        ajouter(sortie,
                            "universal-" .. g[1] .. "-" .. a[1] .. "-"
                                .. mu[1] .. "muscle-" .. w[1] .. "weight",
                            g[2] * a[2] * mu[2] * w[2])
                    end
                end
            end
        end
    end

    -- ── Famille 3 : taille ────────────────────────────────────────────────────
    --
    -- Deux extrêmes autour d'un neutre. À 0,5 le curseur n'active RIEN : la
    -- taille de base est celle du maillage, il n'existe pas de morph « moyen ».
    local hauteur = m.height ~= nil and borner(m.height) or 0.5
    local ecart = (hauteur - 0.5) * 2
    if (math.abs(ecart) > 1e-4) then
        local borne = (ecart > 0) and "max" or "min"
        local force = math.min(1, math.abs(ecart))
        for _, g in ipairs(genres) do
            for _, a in ipairs(ages) do
                for _, mu in ipairs(muscles) do
                    for _, w in ipairs(poids) do
                        ajouter(sortie,
                            "height/" .. g[1] .. "-" .. a[1] .. "-"
                                .. mu[1] .. "muscle-" .. w[1] .. "weight-" .. borne .. "height",
                            g[2] * a[2] * mu[2] * w[2] * force)
                    end
                end
            end
        end
    end

    return sortie
end

--- Réglages normalisés depuis ce qu'envoie le client.
--- Toute valeur manquante ou aberrante retombe sur son défaut : un curseur
--- absent ne doit pas produire un corps difforme.
---@param brut table|nil
---@return table
function Macros.Charger(brut)
    local sortie = Macros.Defaut()
    if (type(brut) ~= "table") then return sortie end

    for _, c in ipairs(Macros.CURSEURS) do
        local v = tonumber(brut[c.id])
        if (v) then sortie[c.id] = borner(v) end
    end

    if (type(brut.ethnicity) == "table") then
        local e = {}
        local total = 0
        for _, x in ipairs(Macros.ETHNIES) do
            local v = math.max(0, tonumber(brut.ethnicity[x.id]) or 0)
            e[x.id] = v
            total = total + v
        end
        -- Une somme nulle laisse le mélange par défaut : normaliser zéro
        -- diviserait par zéro, et forcer une ethnie serait un choix arbitraire.
        if (total > 0) then sortie.ethnicity = e end
    end

    return sortie
end

-- ── Cohabitation avec les curseurs de visage ─────────────────────────────────
--
-- Les reglages du joueur voyagent dans UNE table : curseurs de visage et
-- curseurs de corps s'y melangent. Un prefixe les separe sans ambiguite
-- possible — aucun identifiant MakeHuman ne commence par `@`.
--
-- Sans lui, il faudrait deux tables, deux colonnes en base et deux chemins de
-- validation pour la meme chose : des nombres bornes a poser sur un mesh.

--- Prefixe des reglages de corps dans la table plate des reglages.
Macros.PREFIXE = "@"

--- Extrait les reglages de corps d'une table plate.
--- Ce qui manque prend son defaut : un curseur absent ne doit pas produire un
--- corps difforme, mais le corps neutre.
---@param reglages table|nil
---@return table
function Macros.Depuis(reglages)
    if (type(reglages) ~= "table") then return Macros.Defaut() end

    local brut = { ethnicity = {} }
    for _, c in ipairs(Macros.CURSEURS) do
        brut[c.id] = reglages[Macros.PREFIXE .. c.id]
    end
    for _, e in ipairs(Macros.ETHNIES) do
        brut.ethnicity[e.id] = reglages[Macros.PREFIXE .. "eth-" .. e.id]
    end

    return Macros.Charger(brut)
end

--- Vrai si cet identifiant est un reglage de corps.
---@param id any
---@return boolean
function Macros.EstMacro(id)
    return type(id) == "string" and id:sub(1, 1) == Macros.PREFIXE
end

--- Identifiants attendus dans la table plate, pour l'ecran et les tests.
---@return string[]
function Macros.Identifiants()
    local sortie = {}
    for _, c in ipairs(Macros.CURSEURS) do
        sortie[#sortie + 1] = Macros.PREFIXE .. c.id
    end
    for _, e in ipairs(Macros.ETHNIES) do
        sortie[#sortie + 1] = Macros.PREFIXE .. "eth-" .. e.id
    end
    return sortie
end

return Macros
