-- ═══════════════════════════════════════════════════════════════════════════════
-- Shared/Logic/Animaux.lua — compagnons (port PUR de petStore.ts).
--
-- SOURCE : WebPortal/src/rpg/pets/petStore.ts. État immuable (transactions →
-- NOUVEL état), adoption/renommage/activation/XP/level-up. EXACTEMENT le schema TS
-- (xpForLevel = 80 + level*40 ; MAX_PET_LEVEL = 20) → parité TS chiffrable.
-- ═══════════════════════════════════════════════════════════════════════════════

local Animaux = {}

Animaux.NIVEAU_MAX = 20

function Animaux.XpPourNiveau(level) return 80 + level * 40 end

function Animaux.EtatVide()
    return { possedes = {}, compagnon_actif = nil }
end

local function cloner(etat)
    local e = { possedes = {}, compagnon_actif = etat.compagnon_actif }
    for _, p in ipairs(etat.possedes) do
        e.possedes[#e.possedes + 1] = { id = p.id, surnom = p.surnom, xp = p.xp, niveau = p.niveau }
    end
    return e
end

local function trouve(etat, id)
    for _, p in ipairs(etat.possedes) do if (p.id == id) then return p end end
    return nil
end

-- Adoption : ajoute si absent (déjà possédé → rien).
function Animaux.Adopter(etat, id, surnom)
    if (trouve(etat, id)) then return cloner(etat) end
    local e = cloner(etat)
    e.possedes[#e.possedes + 1] = { id = id, surnom = surnom or id, xp = 0, niveau = 1 }
    return e
end

-- Renomme un pet.
function Animaux.Renommer(etat, id, surnom)
    local e = cloner(etat)
    for _, p in ipairs(e.possedes) do if (p.id == id) then p.surnom = surnom end end
    return e
end

-- Active un compagnon (doit être possédé ; nil = désactive).
function Animaux.Activer(etat, id)
    if (id ~= nil and not trouve(etat, id)) then return cloner(etat) end
    local e = cloner(etat)
    e.compagnon_actif = id
    return e
end

-- Octroie de l'XP avec montée de niveau (même boucle que le TS).
function Animaux.OctroyerXp(etat, id, montant)
    local e = cloner(etat)
    for _, p in ipairs(e.possedes) do
        if (p.id == id and p.niveau < Animaux.NIVEAU_MAX) then
            local xp = p.xp + montant
            local niv = p.niveau
            while (niv < Animaux.NIVEAU_MAX and xp >= Animaux.XpPourNiveau(niv)) do
                xp = xp - Animaux.XpPourNiveau(niv)
                niv = niv + 1
            end
            p.xp = xp; p.niveau = niv
        end
    end
    return e
end

-- Accesseurs.
function Animaux.Obtenu(etat, id) return trouve(etat, id) end
function Animaux.CompagnonActif(etat)
    if (not etat.compagnon_actif) then return nil end
    return trouve(etat, etat.compagnon_actif)
end

return Animaux