-- ═══════════════════════════════════════════════════════════════════════════════
-- Shared/Logic/Roulade.lua — roulade de réception après une chute.
--
-- Câblage : Narvos.Roulade = Package.Require("Logic/Roulade.lua")
--
-- ── POURQUOI, ET POURQUOI PUR ──────────────────────────────────────────────────
-- Les clips `M_Neutral_Jump_F_Land_Roll_*` sont cuits (Catalogues, deux pieds)
-- mais JAMAIS joués : 0 référence hors catalogue. La roulade manquait donc aux
-- chutes. Ce fichier DÉCIDE (quel clip, quelles constantes), sans moteur.
--
-- ── PASSIF, PAS UNE TOUCHE ─────────────────────────────────────────────────────
-- La roulade ACTIVE (esquive-roulade) demanderait une animation qui n'est pas
-- cuite dans le pack (elle existe côté Unreal : AS_Roll, Dodge_Small_Forward_Roll
-- — étape de cuisson à venir). Ici on câble ce qui est DÉJÀ cuit : la réception
-- en roulade après une chute, déclenchée par l'événement d'atterrissage.
-- ═══════════════════════════════════════════════════════════════════════════════

---@class NarvosRoulade
local Roulade = {}

-- ── Constantes ────────────────────────────────────────────────────────────────

--- Le clip de réception (pied gauche : choix déterministe, pas un tirage).
Roulade.CLIP = "M_Neutral_Jump_F_Land_Roll_Lfoot"

--- Recharge entre deux roulades (ms) : un rebond ne doit pas rejouer le geste.
Roulade.COOLDOWN_MS = 800

--- Fondus du geste, en secondes.
Roulade.FONDU_ENTREE = 0.05
Roulade.FONDU_SORTIE = 0.30

-- ── Vérification au chargement ────────────────────────────────────────────────

--- Le clip est-il cuit dans les ensembles groupés ?
---@param sets table  produit par Animations.Grouper
---@return boolean
function Roulade.Verifier(sets)
    if (not sets) then return false end
    local parMode = sets[Roulade.CLIP]
    return (parMode ~= nil) and (parMode["-"] or parMode.IP or parMode.RM) ~= nil
end

return Roulade
