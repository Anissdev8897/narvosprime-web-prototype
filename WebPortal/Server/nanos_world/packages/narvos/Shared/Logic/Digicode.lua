-- ═══════════════════════════════════════════════════════════════════════════════
-- Logic/Digicode.lua — la porte à code : format, empreinte, essais, blocage.
--
-- Câblage : Narvos.Digicode = Package.Require("Logic/Digicode.lua") dans
-- Shared/Index.lua. Exécutant : `narvos-map-proto/Server/Digicode.lua` (pose,
-- persistance, clavier WebUI, ouverture de la porte).
--
-- ── LA RÈGLE, LIÉE AUX ZONES ──────────────────────────────────────────────────
-- Poser une porte à code, en changer le code, et passer SANS code : réservé à qui
-- a le droit d'ÉDITER à cet endroit (`Logic/Zones.PeutEditer` — le propriétaire
-- d'une zone `joueur`, tout joueur dans une zone `libre`, un admin partout). Les
-- autres tapent le code. Hors de toute zone, personne ne pose sauf un admin : la
-- règle des zones s'applique telle quelle, ce module ne la redéfinit pas.
--
-- ── CE QUI EST PROTÉGÉ ────────────────────────────────────────────────────────
--   · le code n'est JAMAIS gardé en clair : SHA-256(sel .. code), sel propre à
--     chaque porte — deux portes au même code n'ont pas la même empreinte ;
--   · la comparaison est à temps constant (`Crypto.EgalConstant`) ;
--   · ESSAIS_MAX mauvais codes bloquent le clavier BLOCAGE_S secondes, pour ce
--     joueur et cette porte : 10 000 codes à 4 chiffres ne se tapent pas à la main
--     en une soirée ;
--   · une faute de FORMAT ne consume pas d'essai (un doigt qui glisse ne doit
--     pas bloquer le propriétaire).
--
-- PUR : le hachage et la comparaison sont INJECTÉS (le serveur passe Crypto),
-- l'instant est fourni par l'appelant, en secondes.
-- ═══════════════════════════════════════════════════════════════════════════════

local Digicode = {}

--- L'objet de sac consommé à la pose (Items.ITEM_DB, ajouté le 2026-09-13).
Digicode.OBJET = "digicode"

Digicode.LONGUEUR_MIN = 4
Digicode.LONGUEUR_MAX = 8
Digicode.ESSAIS_MAX = 3
Digicode.BLOCAGE_S = 30
--- Durée d'ouverture d'une porte après un bon code, en secondes.
Digicode.OUVERTURE_S = 6

--- Le code est-il bien formé ? Une CHAÎNE de chiffres, jamais un nombre :
--- « 0012 » converti en nombre perdrait ses zéros de tête.
---@param code any
---@return boolean, string|nil
function Digicode.CodeValide(code)
    if (type(code) ~= "string") then return false, "code attendu" end
    if (not code:match("^%d+$")) then return false, "le code ne contient que des chiffres" end
    if (#code < Digicode.LONGUEUR_MIN or #code > Digicode.LONGUEUR_MAX) then
        return false, ("le code fait %d a %d chiffres"):format(Digicode.LONGUEUR_MIN, Digicode.LONGUEUR_MAX)
    end
    return true, nil
end

--- Une serrure neuve : { id, sel, empreinte } — sans le code.
---@param id any
---@param code string
---@param sel string   propre à la porte, non vide
---@param hacher function  (texte) -> hexadécimal
---@return table|nil, string|nil
function Digicode.NouvelleSerrure(id, code, sel, hacher)
    local valide, raison = Digicode.CodeValide(code)
    if (not valide) then return nil, raison end
    if (type(sel) ~= "string" or sel == "") then return nil, "sel absent" end
    if (type(hacher) ~= "function") then return nil, "fonction de hachage absente" end
    return { id = id, sel = sel, empreinte = hacher(sel .. code) }, nil
end

--- L'état d'essais d'un joueur sur une porte, neuf.
---@return table
function Digicode.NouveauxEssais()
    return { echecs = 0, bloque_jusqu_a = 0 }
end

--- Essaie un code. Rend (ouvre, raison, nouvel_etat_essais). L'état reçu n'est
--- jamais modifié.
---@param essais table
---@param serrure table
---@param code any
---@param maintenant any   secondes
---@param hacher function
---@param egal function    comparaison à temps constant
---@return boolean, string|nil, table
function Digicode.Essayer(essais, serrure, code, maintenant, hacher, egal)
    local e = {
        echecs = (type(essais) == "table" and tonumber(essais.echecs)) or 0,
        bloque_jusqu_a = (type(essais) == "table" and tonumber(essais.bloque_jusqu_a)) or 0,
    }
    local t = tonumber(maintenant)
    if (not t) then return false, "instant inconnu", e end
    if (type(serrure) ~= "table" or type(serrure.empreinte) ~= "string") then
        return false, "porte inconnue", e
    end
    if (t < e.bloque_jusqu_a) then
        return false, ("clavier bloque encore %d s"):format(math.ceil(e.bloque_jusqu_a - t)), e
    end

    local valide, raison = Digicode.CodeValide(code)
    if (not valide) then return false, raison, e end

    if (egal(hacher((serrure.sel or "") .. code), serrure.empreinte)) then
        e.echecs = 0
        return true, nil, e
    end

    e.echecs = e.echecs + 1
    if (e.echecs >= Digicode.ESSAIS_MAX) then
        e.echecs = 0
        e.bloque_jusqu_a = t + Digicode.BLOCAGE_S
        return false, ("code faux — clavier bloque %d s"):format(Digicode.BLOCAGE_S), e
    end
    return false, ("code faux (%d essai(s) restant(s))"):format(Digicode.ESSAIS_MAX - e.echecs), e
end

--- L'instant jusqu'auquel une porte qu'on vient d'ouvrir reste ouverte.
---@param maintenant number
---@return number
function Digicode.OuvertureJusqua(maintenant)
    return (tonumber(maintenant) or 0) + Digicode.OUVERTURE_S
end

--- La porte est-elle ouverte à cet instant ?
---@param ouverte_jusqu_a any
---@param maintenant any
---@return boolean
function Digicode.EstOuverte(ouverte_jusqu_a, maintenant)
    local fin, t = tonumber(ouverte_jusqu_a), tonumber(maintenant)
    if (not fin or not t) then return false end
    return t < fin
end

--- Passe-t-on sans code ? Oui si l'on a le droit d'éditer sur place
--- (`Zones.PeutEditer`). Tout autre valeur que `true` exige le code : garde
--- fermée par défaut.
---@param peut_editer any
---@return boolean
function Digicode.PasseDroit(peut_editer)
    return peut_editer == true
end

return Digicode
