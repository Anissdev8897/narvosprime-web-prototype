-- ═══════════════════════════════════════════════════════════════════════════════
-- Shared/Logic/Jouabilite.lua — les réglages de jouabilité, par compte.
--
-- Câblage : Narvos.Jouabilite = Package.Require("Logic/Jouabilite.lua")
--           puis `Narvos.Jouabilite.UtiliserBase(instance)` dans Server/Index.lua,
--           après Comptes.Ouvrir (même discipline que Commandes et Raccourcis).
--
-- ── POURQUOI UN REGISTRE, ET PAS DES CHAMPS EN DUR ─────────────────────────────
-- Chaque réglage est UNE LIGNE de `PARAMETRES` : identifiant, type, défaut,
-- valeurs possibles. Ajouter demain un paramètre (« caméra épaule », « afficher
-- les dégâts »…) n'exige AUCUNE retouche du serveur ni de l'écran : la vue est
-- calculée depuis le registre, et le client rend ce qu'il reçoit. C'est la
-- structure extensible demandée — pas une promesse, un mécanisme.
--
-- ── LES TYPES ──────────────────────────────────────────────────────────────────
--   toggle  → boolean. Le bouton bascule, la valeur en base est "1"/"0".
--   choix   → UNE valeur parmi `valeurs` (liste de { id, label }).
--   multi   → UN ENSEMBLE : table { [id] = true } pour les options cochées.
--   groupe  → n'est PAS une valeur : il porte `sous`, des paramètres imbriqués,
--             que l'écran rend sous un titre. La base reste plate.
--
-- ── VALIDATION EN LISTE BLANCHE ────────────────────────────────────────────────
-- Un client modifié peut envoyer n'importe quoi. Chaque type n'accepte que sa
-- forme : un toggle refuse un texte, un choix refuse une valeur absente de sa
-- liste, un multi refuse une clé inconnue. Rien n'entre en base sans être passé
-- par `Valider`.
-- ═══════════════════════════════════════════════════════════════════════════════

---@class NarvosJouabilite
local Jouabilite = {}

--- Ordre croissant des raretés : l'auto-loot avancé choisit un MINIMUM.
--- Aligné sur `ButinEnnemi.RARETES` (normal < common < rare < epic < legendary).
Jouabilite.RARETES = { "normal", "common", "rare", "epic", "legendary" }

---@type table  liste ordonnée des paramètres. LA SOURCE DE VÉRITÉ.
Jouabilite.PARAMETRES = {
    {
        id = "auto_loot",
        type = "toggle",
        defaut = false,
        categorie = "Butin",
        label = "Auto-loot",
        description = "Ramasser automatiquement le butin des ennemis vaincus, sans ouvrir le cadavre.",
    },
    {
        id = "auto_loot_avance",
        type = "groupe",
        categorie = "Butin",
        label = "Auto-loot avancé",
        description = "Choisir ce que l'auto-loot ramasse : les types d'objets et la rareté minimale.",
        sous = {
            {
                id = "auto_loot_types",
                type = "multi",
                defaut = { arme = true, equipement = true, consommable = true, ressource = true, autre = true },
                label = "Types d'objets",
                description = "Familles ramassées automatiquement.",
                valeurs = {
                    { id = "arme",        label = "Armes" },
                    { id = "equipement",  label = "Équipements et bijoux" },
                    { id = "consommable", label = "Consommables" },
                    { id = "ressource",   label = "Ressources et matériaux" },
                    { id = "autre",       label = "Autres" },
                },
            },
            {
                id = "auto_loot_rarete",
                type = "choix",
                defaut = "normal",
                label = "Rareté minimale",
                description = "Tout ce qui est en dessous reste sur le cadavre.",
                valeurs = {
                    { id = "normal",    label = "Tout ramasser" },
                    { id = "common",    label = "Commun et mieux" },
                    { id = "rare",      label = "Rare et mieux" },
                    { id = "epic",      label = "Épique et mieux" },
                    { id = "legendary", label = "Légendaire seulement" },
                },
            },
        },
    },
    {
        id = "auto_marche",
        type = "toggle",
        defaut = false,
        categorie = "Déplacement",
        label = "Auto-marche",
        description = "Après un départ en avant, continuer d'avancer sans tenir la touche. Une touche de déplacement arrête.",
    },
    -- ⚠ FUTURS PARAMÈTRES ICI. Une entrée suffit : serveur, base et écran suivent.
}

local db = nil

---@param instance table  la base ouverte par Comptes.Ouvrir.
function Jouabilite.UtiliserBase(instance)
    db = instance
end

---@return boolean
function Jouabilite.Prete()
    return db ~= nil
end

-- ── Catalogue ─────────────────────────────────────────────────────────────────

--- Aplatit le registre : les sous-paramètres des groupes y figurent aussi.
local function Aplatir()
    local sortie = {}
    for _, p in ipairs(Jouabilite.PARAMETRES) do
        if (p.type == "groupe") then
            for _, s in ipairs(p.sous or {}) do sortie[#sortie + 1] = s end
        else
            sortie[#sortie + 1] = p
        end
    end
    return sortie
end

---@param parametre_id string
---@return table|nil
function Jouabilite.Trouver(parametre_id)
    if (type(parametre_id) ~= "string") then return nil end
    -- Lecture DYNAMIQUE, pas un index figé au chargement : un paramètre ajouté
    -- au registre (même à chaud, par un pack ou un harnais) est trouvé aussitôt.
    -- Le registre tient en quelques entrées : le coût est nul.
    for _, p in ipairs(Jouabilite.PARAMETRES) do
        if (p.id == parametre_id) then return p end
        if (p.type == "groupe") then
            for _, s in ipairs(p.sous or {}) do
                if (s.id == parametre_id) then return s end
            end
        end
    end
    return nil
end

--- Catégories, dans l'ordre d'apparition du registre (calculées, jamais écrites).
Jouabilite.CATEGORIES = (function()
    local vues, sortie = {}, {}
    for _, p in ipairs(Jouabilite.PARAMETRES) do
        if (not vues[p.categorie]) then
            vues[p.categorie] = true
            sortie[#sortie + 1] = p.categorie
        end
    end
    return sortie
end)()

-- ── Encodage / décodage (base plate : une chaîne par paramètre) ──────────────

---@param valeur any
---@param def table
---@return string
function Jouabilite.Encoder(valeur, def)
    if (def.type == "toggle") then return valeur and "1" or "0" end
    if (def.type == "multi") then
        local coches = {}
        for _, o in ipairs(def.valeurs) do
            if (type(valeur) == "table" and valeur[o.id]) then coches[#coches + 1] = o.id end
        end
        return table.concat(coches, ",")
    end
    -- choix
    return tostring(valeur)
end

---@param texte string|nil
---@param def table
---@return any
function Jouabilite.Decoder(texte, def)
    if (def.type == "toggle") then return texte == "1" end
    if (def.type == "multi") then
        local sortie = {}
        if (type(texte) == "string" and texte ~= "") then
            for id in texte:gmatch("[^,]+") do sortie[id] = true end
        end
        return sortie
    end
    return texte or def.defaut
end

-- ── Validation (pure, testable hors moteur) ──────────────────────────────────

--- Une valeur est-elle recevable pour ce paramètre ?
---@param def table
---@param valeur any
---@return boolean, string|nil
function Jouabilite.Valider(def, valeur)
    if (type(def) ~= "table" or def.type == "groupe") then
        return false, "Paramètre inconnu ou non réglable"
    end

    if (def.type == "toggle") then
        if (type(valeur) ~= "boolean") then return false, "Attendu : vrai ou faux" end
        return true, nil
    end

    if (def.type == "choix") then
        if (type(valeur) ~= "string") then return false, "Attendu : un choix" end
        for _, o in ipairs(def.valeurs or {}) do
            if (o.id == valeur) then return true, nil end
        end
        return false, "Choix inconnu : " .. tostring(valeur)
    end

    -- multi : une table de drapeaux, et chaque clé doit exister dans la liste.
    if (type(valeur) ~= "table") then return false, "Attendu : une liste d'options" end
    for id, actif in pairs(valeur) do
        if (actif ~= nil and actif ~= false) then
            local connue = false
            for _, o in ipairs(def.valeurs or {}) do
                if (o.id == id) then connue = true break end
            end
            if (not connue) then return false, "Option inconnue : " .. tostring(id) end
        end
    end
    return true, nil
end

---@param parametre_id string
---@param valeur any
---@return boolean, string|nil
function Jouabilite.ValiderId(parametre_id, valeur)
    local def = Jouabilite.Trouver(parametre_id)
    if (not def) then return false, "Paramètre inconnu : " .. tostring(parametre_id) end
    return Jouabilite.Valider(def, valeur)
end

-- ── Lecture / écriture ────────────────────────────────────────────────────────

--- Valeurs par défaut de tout le registre : { parametre_id = valeur }.
---@return table
function Jouabilite.Defauts()
    local sortie = {}
    for _, p in ipairs(Aplatir()) do
        sortie[p.id] = p.defaut
    end
    return sortie
end

--- Réglages d'un compte : les défauts, écrasés par ce qui est en base.
--- Une ligne pointant vers un paramètre DISPARU du registre est ignorée.
---@param compte_id integer|nil
---@return table
function Jouabilite.ParCompte(compte_id)
    local sortie = Jouabilite.Defauts()
    if (not db or compte_id == nil) then return sortie end

    for _, l in ipairs(db:Select(
        "SELECT parametre_id, valeur FROM jouabilite WHERE compte_id = :0", compte_id) or {}) do
        local def = Jouabilite.Trouver(l.parametre_id)
        if (def) then sortie[l.parametre_id] = Jouabilite.Decoder(l.valeur, def) end
    end
    return sortie
end

--- Définit un paramètre. Valide AVANT d'écrire : rien n'entre sans être passé
--- par la liste blanche. Rend (ok, raison, valeur_finale).
---@param compte_id integer
---@param parametre_id string
---@param valeur any
---@return boolean, string|nil, any
function Jouabilite.Definir(compte_id, parametre_id, valeur)
    if (not db or compte_id == nil) then return false, "Base absente" end
    local def = Jouabilite.Trouver(parametre_id)
    if (not def) then return false, "Paramètre inconnu : " .. tostring(parametre_id) end

    local ok, raison = Jouabilite.Valider(def, valeur)
    if (not ok) then return false, raison end

    local texte = Jouabilite.Encoder(valeur, def)
    db:Execute(
        "INSERT OR REPLACE INTO jouabilite (compte_id, parametre_id, valeur) VALUES (:0, :1, :2)",
        compte_id, parametre_id, texte)
    return true, nil, valeur
end

--- Revient au défaut d'UN paramètre (supprime la ligne en base).
---@param compte_id integer
---@param parametre_id string
---@return boolean, string|nil
function Jouabilite.Reinitialiser(compte_id, parametre_id)
    if (not db or compte_id == nil) then return false, "Base absente" end
    db:Execute("DELETE FROM jouabilite WHERE compte_id = :0 AND parametre_id = :1",
        compte_id, parametre_id)
    return true, nil
end

--- Tout remet aux défauts.
---@param compte_id integer
---@return boolean, string|nil
function Jouabilite.ReinitialiserTout(compte_id)
    if (not db or compte_id == nil) then return false, "Base absente" end
    db:Execute("DELETE FROM jouabilite WHERE compte_id = :0", compte_id)
    return true, nil
end

-- ── Vue pour l'écran ──────────────────────────────────────────────────────────

--- La vue prête pour l'écran : registre + valeurs du compte, ordonnées.
--- Le client ne refait aucun tri : il rend ce qu'il reçoit.
---@param compte_id integer|nil
---@return table
function Jouabilite.Vue(compte_id)
    local valeurs = Jouabilite.ParCompte(compte_id)
    local sortie = {}

    for _, p in ipairs(Jouabilite.PARAMETRES) do
        local ligne = {
            id = p.id,
            type = p.type,
            label = p.label,
            description = p.description or "",
        }
        if (p.type == "groupe") then
            ligne.sous = {}
            for _, s in ipairs(p.sous or {}) do
                ligne.sous[#ligne.sous + 1] = {
                    id = s.id,
                    type = s.type,
                    label = s.label,
                    description = s.description or "",
                    valeurs = s.valeurs,
                    valeur = valeurs[s.id],
                }
            end
        else
            ligne.valeurs = p.valeurs
            ligne.valeur = valeurs[p.id]
        end
        sortie[#sortie + 1] = ligne
    end

    return sortie
end

return Jouabilite
