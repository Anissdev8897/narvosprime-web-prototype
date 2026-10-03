-- ═══════════════════════════════════════════════════════════════════════════════
-- Shared/Logic/Frappes.lua — mains nues : poings latéralisés et coups de pied.
-- Câblage : Narvos.Frappes = Package.Require("Logic/Frappes.lua")
--
-- ── D'OÙ ÇA VIENT ─────────────────────────────────────────────────────────────
-- PORT de `WebPortal/src/rpg/combat/unarmedStrikes.ts`, pas une invention : même
-- pack (`FPP_combat_fists`, cuit et lié à SKEL_Mannequin), même partage
-- jab / crochet / uppercut × gauche / droite, même coup de pied unique.
--
-- Demande du 2026-09-13 (Hanibes) : clic gauche = poing, clic droit = poing de
-- l'autre côté, G et K = coups de pied, touches réassignables. Les ENTRÉES
-- ci-dessous sont ces quatre gestes ; la touche qui les déclenche vit dans
-- `Logic/Commandes.lua`, jamais ici.
--
-- ── CE QUI EST MESURÉ ─────────────────────────────────────────────────────────
-- `impact_ms` et `duree_ms` sont LUS dans les AnimSequence source de l'ADK
-- (pic de rotation de l'avant-bras ou de la cuisse qui frappe, 30 i/s) :
--   jab rapide 133 / 667 ms · crochet rapide 367 / 1 000 · uppercut rapide
--   433 / 1 000 · coup de pied 533 / 1 567 (cuisse DROITE, 145°).
-- Le TS portait 110 / 170 / 240 / 260 ms « au ressenti » ; un coup qui blesse
-- avant que le poing parte se voit tout de suite.
--
-- ── CE QUI NE L'EST PAS ───────────────────────────────────────────────────────
-- Portées, multiplicateurs et récupérations : lisibilité du combat (repris du
-- TS), pas un équilibrage.
--
-- ⚠ PUR. Ni entité, ni horloge, ni `Vector` : des nombres et des tables. Le
-- temps arrive en millisecondes d'un compteur tenu par le serveur, les positions
-- en { x, y, z }. C'est ce qui le laisse tourner sous wasmoon.
-- ═══════════════════════════════════════════════════════════════════════════════

---@class NarvosFrappes
local Frappes = {}

-- ── Les gestes du joueur ──────────────────────────────────────────────────────

--- Entrée → { famille, cote }. Les identifiants sont ceux que le client envoie ;
--- tout le reste est refusé.
Frappes.ENTREES = {
    principale  = { famille = "poing", cote = "d" },
    secondaire  = { famille = "poing", cote = "g" },
    pied_droit  = { famille = "pied",  cote = "d" },
    pied_gauche = { famille = "pied",  cote = "g" },
}

-- ── Le catalogue des coups ────────────────────────────────────────────────────
--
-- `clips` : candidats, du préféré au repli. Le premier présent dans le pack cuit
-- gagne (`Frappes.Clip`) — même stratégie que `clips` dans le TS.
-- `slot` : « haut » = UpperBody, les jambes gardent la locomotion ; « corps » =
-- FullBody, un coup de pied n'a pas de jambe libre à laisser marcher.
--
-- ⚠ LE PIED GAUCHE N'A PAS DE CLIP À LUI. Toute la bibliothèque n'a qu'un coup de
-- pied, DROIT (mesuré : cuisse droite 145°, gauche 103°). Le TS le fabrique en
-- miroir à la volée ; nanos ne sait pas miroiter une animation. Son premier
-- candidat est le miroir à IMPORTER (`attack_special_kick_L_Anim`) ; tant qu'il
-- n'est pas cuit, le repli rejoue le pied droit — le coup part, les dégâts aussi.
Frappes.COUPS = {
    jab_d = {
        nature = "jab", cote = "d", mult = 0.8, portee_cm = 180, demi_angle = 50,
        impact_ms = 133, duree_ms = 667, recup_ms = 420, slot = "haut",
        clips = { "attack_jab_fast_Rhand_01_Anim", "attack_jab_fast_Rhand_02_Anim", "attack_jab_Rhand_01_Anim" },
    },
    jab_g = {
        nature = "jab", cote = "g", mult = 0.8, portee_cm = 180, demi_angle = 50,
        impact_ms = 133, duree_ms = 667, recup_ms = 420, slot = "haut",
        clips = { "attack_jab_fast_Lhand_01_Anim", "attack_jab_fast_Lhand_02_Anim", "attack_jab_Lhand_01_Anim" },
    },
    crochet_d = {
        nature = "crochet", cote = "d", mult = 1.2, portee_cm = 160, demi_angle = 60,
        impact_ms = 367, duree_ms = 1000, recup_ms = 620, slot = "haut",
        clips = { "attack_hook_fast_Rhand_01_Anim", "attack_hook_fast_Rhand_02_Anim", "attack_hook_Rhand_01_Anim" },
    },
    crochet_g = {
        nature = "crochet", cote = "g", mult = 1.2, portee_cm = 160, demi_angle = 60,
        impact_ms = 367, duree_ms = 1000, recup_ms = 620, slot = "haut",
        clips = { "attack_hook_fast_Lhand_01_Anim", "attack_hook_fast_Lhand_02_Anim", "attack_hook_Lhand_01_Anim" },
    },
    uppercut_d = {
        nature = "uppercut", cote = "d", mult = 1.8, portee_cm = 150, demi_angle = 45,
        impact_ms = 433, duree_ms = 1000, recup_ms = 720, slot = "haut",
        clips = { "attack_uppercut_fast_Rhand_01_Anim", "attack_uppercut_Rhand_01_Anim" },
    },
    uppercut_g = {
        nature = "uppercut", cote = "g", mult = 1.8, portee_cm = 150, demi_angle = 45,
        impact_ms = 433, duree_ms = 1000, recup_ms = 720, slot = "haut",
        clips = { "attack_uppercut_fast_Lhand_01_Anim", "attack_uppercut_Lhand_01_Anim" },
    },
    pied_d = {
        nature = "pied", cote = "d", mult = 1.6, portee_cm = 230, demi_angle = 55,
        impact_ms = 533, duree_ms = 1567, recup_ms = 950, slot = "corps", cibles_max = 2,
        clips = { "attack_special_kick_Anim" },
    },
    pied_g = {
        nature = "pied", cote = "g", mult = 1.6, portee_cm = 230, demi_angle = 55,
        impact_ms = 533, duree_ms = 1567, recup_ms = 950, slot = "corps", cibles_max = 2,
        clips = { "attack_special_kick_L_Anim", "attack_special_kick_Anim" },
    },
}

--- La nature d'un coup de POING selon son rang dans l'enchaînement : deux jabs,
--- deux crochets, l'uppercut qui conclut. ⚠ SÉQUENCE : l'index EST le rang.
Frappes.NATURE_PAR_ETAPE = { "jab", "jab", "crochet", "crochet", "uppercut" }

--- Après la récupération d'un coup, fenêtre pendant laquelle le suivant ENCHAÎNE.
--- Au-delà, la série repart du premier jab.
Frappes.FENETRE_ENCHAINE_MS = 700

--- Le coup qui conclut une série double ses dégâts (`strikeDamage` du TS : le
--- finisher se compose au multiplicateur du coup, il ne le remplace pas).
Frappes.MULT_FINISHER = 2.0

--- Un coup de pied lancé en cours de série (au 3ᵉ coup ou plus) la conclut.
Frappes.ETAPE_PIED_FINISHER = 3

--- Tolérance verticale d'un coup, en cm : on ne frappe pas l'étage du dessus.
Frappes.HAUTEUR_CM = 150

--- Rayon ajouté à la portée : la distance se mesure de centre à centre, et un
--- poing touche la SURFACE de la cible, pas son axe.
Frappes.RAYON_CIBLE_CM = 40

-- ── Utilitaires ───────────────────────────────────────────────────────────────
-- ⚠ DÉCLARÉS EN TÊTE, ASSIGNÉS ENSUITE (piège `local function` après l'appelant).

local nombre

nombre = function(v, defaut)
    local n = tonumber(v)
    if (n == nil or n ~= n) then return defaut end
    return n
end

-- ── État ──────────────────────────────────────────────────────────────────────

--- ⚠ Des nombres, jamais `nil` : un champ à nil disparaît de la table.
function Frappes.NouvelEtat()
    return {
        etape = 0,            -- rang du dernier coup de poing de la série ; 0 = aucune
        pret_a = 0,           -- ms : avant, le coup précédent n'est pas récupéré
        enchaine_jusqu_a = 0, -- ms : après, la série repart de zéro
    }
end

--- L'identifiant du coup, depuis sa nature et son côté (« crochet », « g »).
---@return string
function Frappes.Identifiant(nature, cote)
    return tostring(nature) .. "_" .. tostring(cote)
end

-- ── Choisir le coup ───────────────────────────────────────────────────────────

--- Quel coup part pour cette entrée, à cet instant ? MUTE l'état (comme
--- `Combat.Frapper`) et rend le PLAN que le serveur met en scène.
---
--- Rend `false, raison` quand rien ne part : entrée inconnue, coup précédent
--- pas encore récupéré. Marteler la touche ne raccourcit donc rien.
---@param etat table
---@param maintenant any  ms
---@param entree any      clé de `Frappes.ENTREES`
---@return boolean ok
---@return string|nil raison
---@return table|nil plan
function Frappes.Choisir(etat, maintenant, entree)
    if (type(etat) ~= "table") then return false, "Etat absent", nil end
    local t = tonumber(maintenant)
    if (not t) then return false, "Instant invalide", nil end
    local geste = (type(entree) == "string") and Frappes.ENTREES[entree] or nil
    if (not geste) then return false, "Geste inconnu", nil end

    if (t < nombre(etat.pret_a, 0)) then return false, "Coup en cours", nil end

    local precedente = math.floor(nombre(etat.etape, 0))
    local enchaine = precedente >= 1 and t <= nombre(etat.enchaine_jusqu_a, 0)

    local nature, etape, finisher
    if (geste.famille == "poing") then
        etape = enchaine and (precedente % #Frappes.NATURE_PAR_ETAPE) + 1 or 1
        nature = Frappes.NATURE_PAR_ETAPE[etape]
        finisher = (etape == #Frappes.NATURE_PAR_ETAPE)
    else
        nature = "pied"
        etape = enchaine and precedente + 1 or 1
        finisher = enchaine and precedente + 1 >= Frappes.ETAPE_PIED_FINISHER
    end

    local id = Frappes.Identifiant(nature, geste.cote)
    local coup = Frappes.COUPS[id]
    if (not coup) then return false, "Coup absent du catalogue : " .. id, nil end

    etat.pret_a = t + coup.recup_ms
    etat.enchaine_jusqu_a = t + coup.recup_ms + Frappes.FENETRE_ENCHAINE_MS
    -- Un finisher CLÔT la série : le coup suivant repart du premier jab. Un coup
    -- de pied hors série aussi — il n'ouvre pas de combo de poings.
    if (finisher or geste.famille == "pied") then
        etat.etape = 0
    else
        etat.etape = etape
    end

    local clips = {}
    for i, c in ipairs(coup.clips) do clips[i] = c end

    return true, nil, {
        id = id,
        nature = nature,
        cote = geste.cote,
        entree = entree,
        etape = etape,
        finisher = finisher and true or false,
        mult = coup.mult * (finisher and Frappes.MULT_FINISHER or 1),
        portee_cm = coup.portee_cm,
        demi_angle = coup.demi_angle,
        impact_ms = coup.impact_ms,
        duree_ms = coup.duree_ms,
        slot = coup.slot,
        cibles_max = coup.cibles_max or 1,
        clips = clips,
        engage_a = t,
    }
end

-- ── Le clip ───────────────────────────────────────────────────────────────────

--- Ensemble { nom = true } depuis une liste de noms (le catalogue généré).
---@param liste any
---@return table
function Frappes.EnsembleNoms(liste)
    local ensemble = {}
    if (type(liste) ~= "table") then return ensemble end
    for _, nom in ipairs(liste) do
        if (type(nom) == "string") then ensemble[nom] = true end
    end
    return ensemble
end

--- Le premier clip du plan (ou du coup) présent dans le pack cuit, ou nil.
---@param plan any       plan de `Choisir` ou entrée de `COUPS`
---@param presents any   ensemble de `EnsembleNoms`
---@return string|nil
function Frappes.Clip(plan, presents)
    if (type(plan) ~= "table" or type(plan.clips) ~= "table") then return nil end
    if (type(presents) ~= "table") then return nil end
    for _, nom in ipairs(plan.clips) do
        if (presents[nom]) then return nom end
    end
    return nil
end

--- Les coups dont AUCUN clip n'est cuit, triés. À appeler au chargement : un coup
--- sans geste blesserait sans que le personnage bouge.
---@param presents table
---@return table
function Frappes.Verifier(presents)
    local manquants = {}
    for id, coup in pairs(Frappes.COUPS) do
        if (not Frappes.Clip(coup, presents)) then manquants[#manquants + 1] = id end
    end
    table.sort(manquants)
    return manquants
end

-- ── Les cibles ────────────────────────────────────────────────────────────────

--- Qui le coup atteint-il ? Pas de raycast (`Trace` est d'autorité CLIENT) : un
--- cône devant l'attaquant, une portée, une tolérance verticale.
---
--- ⚠ C'est aussi ce qui rend frappables les PNJ dont le PhysicsAsset est
--- dégénéré (Meshy, capsules de 0,005 cm mesurées le 2026-09-13) : la décision
--- ne passe pas par leur collision.
---
---@param origine table     { x, y, z } de l'attaquant
---@param avant table       { x, y } direction du coup (normée ou non)
---@param candidats table   liste de { cle, x, y, z }
---@param plan table        plan de `Choisir` (portee_cm, demi_angle, cibles_max)
---@return table            candidats retenus, du plus proche au plus lointain
function Frappes.Cibles(origine, avant, candidats, plan)
    local sortie = {}
    if (type(origine) ~= "table" or type(avant) ~= "table"
        or type(candidats) ~= "table" or type(plan) ~= "table") then
        return sortie
    end

    local ax, ay = nombre(avant.x, 0), nombre(avant.y, 0)
    local na = math.sqrt(ax * ax + ay * ay)
    if (na < 1e-6) then return sortie end
    ax, ay = ax / na, ay / na

    local ox, oy, oz = nombre(origine.x, 0), nombre(origine.y, 0), nombre(origine.z, 0)
    local portee = nombre(plan.portee_cm, 0) + Frappes.RAYON_CIBLE_CM
    local cos_mini = math.cos(math.rad(nombre(plan.demi_angle, 0)))
    local max = math.max(1, math.floor(nombre(plan.cibles_max, 1)))

    local retenus = {}
    for rang, c in ipairs(candidats) do
        if (type(c) == "table") then
            local dx = nombre(c.x, 0) - ox
            local dy = nombre(c.y, 0) - oy
            local dz = nombre(c.z, 0) - oz
            if (math.abs(dz) <= Frappes.HAUTEUR_CM) then
                local d = math.sqrt(dx * dx + dy * dy)
                if (d <= portee) then
                    -- Collé à l'attaquant, l'angle n'a plus de sens : il touche.
                    local dans_le_cone = d < 1 or ((dx * ax + dy * ay) / d) >= cos_mini
                    if (dans_le_cone) then
                        retenus[#retenus + 1] = { candidat = c, d = d, rang = rang }
                    end
                end
            end
        end
    end

    -- Tri STABLE : à distance égale, l'ordre d'arrivée départage. `table.sort`
    -- n'est pas stable, d'où le rang en second critère.
    table.sort(retenus, function(a, b)
        if (a.d ~= b.d) then return a.d < b.d end
        return a.rang < b.rang
    end)

    for i = 1, math.min(max, #retenus) do sortie[i] = retenus[i].candidat end
    return sortie
end

--- Le lacet (degrés) qui fait face à un point, depuis une origine. Rend nil si
--- les deux points se confondent : aucune direction à prendre.
---@return number|nil
function Frappes.LacetVers(origine, cible)
    if (type(origine) ~= "table" or type(cible) ~= "table") then return nil end
    local dx = nombre(cible.x, 0) - nombre(origine.x, 0)
    local dy = nombre(cible.y, 0) - nombre(origine.y, 0)
    if (math.abs(dx) < 1e-6 and math.abs(dy) < 1e-6) then return nil end
    return math.deg(math.atan(dy, dx))
end

return Frappes
