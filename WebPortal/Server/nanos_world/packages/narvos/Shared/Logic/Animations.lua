-- ═══════════════════════════════════════════════════════════════════════════════
-- Shared/Logic/Animations.lua — variantes multiples par action.
--
-- Câblage : Narvos.Animations = Package.Require("Logic/Animations.lua")
--
-- ── LE PROBLÈME ───────────────────────────────────────────────────────────────
-- Nos packs livrent plusieurs PRISES pour une même action :
--
--   ACB_Attack_01_A_IP   ACB_Attack_01_B_IP   ACB_Attack_01_C_IP
--   ACB_Attack_01_A_RM   ACB_Attack_01_B_RM   ACB_Attack_01_C_RM
--
-- Jouer toujours la première rend un combat mécanique : trois coups d'affilée,
-- trois fois exactement le même geste. Mesuré sur `public/models/armes` :
-- 355 animations distinctes, 288 actions, dont **13 à prises multiples** et
-- **26 déclinées en IP et RM**. C'est peu sur le total, mais ce sont justement
-- les attaques et les impacts — ce qu'on voit le plus souvent.
--
-- ── LES DEUX MODES, ET POURQUOI LE CHOIX N'EST PAS COSMÉTIQUE ─────────────────
--   IP  « in place »   : le personnage reste sur ses appuis, le déplacement est
--                        au code. À utiliser quand la position est CONTRAINTE —
--                        combat verrouillé sur une cible, sol étroit, réseau qui
--                        doit rester d'accord avec le serveur.
--   RM  « root motion » : l'animation DÉPLACE le personnage. Plus juste à l'œil
--                        (pas de glissement des pieds), mais elle impose sa
--                        trajectoire : lancée près d'un vide, elle peut y mener.
--
-- Se tromper de mode ne produit pas d'erreur — juste un personnage qui patine ou
-- qui part où il ne fallait pas. D'où `ModePour()`, qui rend la règle explicite.
--
-- ── PURETÉ ────────────────────────────────────────────────────────────────────
-- Tout est pur : ni Package, ni Character, ni horloge. L'état anti-répétition
-- est PASSÉ en paramètre au lieu d'être global — c'est ce qui rend le tirage
-- testable de façon déterministe, et ce qui permet à deux personnages d'avoir
-- chacun son historique.
-- ═══════════════════════════════════════════════════════════════════════════════

---@class NarvosAnimations
local Animations = {}

Animations.MODES = { "IP", "RM" }

-- ── Décomposition des noms ─────────────────────────────────────────────────────

--- Sépare un nom d'animation en (base, variante, mode).
---
--- Convention constatée sur nos packs, appliquée dans cet ordre :
---   1. suffixe de mode `_IP` / `_RM`, optionnel
---   2. suffixe de variante `_01` ou `_A`, optionnel
--- Ce qui reste est la BASE, c'est-à-dire l'action.
---
--- L'ordre compte : retirer la variante d'abord laisserait `_IP` collé à elle et
--- `ACB_Hurt_01_IP` se lirait comme la variante « 01_IP » d'une action `ACB_Hurt`.
---@param nom string
---@return string base
---@return string|nil variante
---@return string|nil mode
function Animations.Decomposer(nom)
    local reste = tostring(nom)
    local mode, variante

    -- ⚠ `_Anim` D'ABORD. Interchange suffixe ainsi tout AnimSequence importé :
    -- `ACB_Attack_03_B_RM` devient `ACB_Attack_03_B_RM_Anim`. Le mode n'est
    -- alors plus en fin de chaîne, et sans ce retrait préalable la détection
    -- échouait — mesuré au chargement : « 0 action en IP et RM » sur 657, alors
    -- que 26 le sont réellement. Aucune erreur : juste des modes jamais vus.
    local sansAnim = reste:match("^(.*)_Anim$")
    if (sansAnim) then reste = sansAnim end

    local sansMode, m = reste:match("^(.*)_(IP)$")
    if (not sansMode) then sansMode, m = reste:match("^(.*)_(RM)$") end
    if (sansMode) then reste = sansMode; mode = m end

    -- `%d%d?` avant `%u` : sur `ACB_Hurt_01`, une classe trop large prendrait
    -- « 1 » et laisserait `ACB_Hurt_0` comme base.
    local sansVar, v = reste:match("^(.*)_(%d%d?)$")
    if (not sansVar) then sansVar, v = reste:match("^(.*)_(%u)$") end
    if (sansVar) then reste = sansVar; variante = v end

    return reste, variante, mode
end

--- Regroupe une liste de noms en ensembles indexés par action puis par mode.
---
--- Les animations sans suffixe de mode vont sous la clé `"-"`. Les y ranger
--- plutôt que de les écarter permet à `Choisir` de traiter d'un seul geste les
--- actions qui n'ont qu'une forme (`Anim_Mann_PAS_SideReloading_01..05`).
---@param noms string[]
---@return table sets  base -> mode -> { noms complets }
function Animations.Grouper(noms)
    local sets = {}
    for _, nom in ipairs(noms) do
        local base, _, mode = Animations.Decomposer(nom)
        local cle = mode or "-"
        sets[base] = sets[base] or {}
        sets[base][cle] = sets[base][cle] or {}
        table.insert(sets[base][cle], nom)
    end

    -- Tri : `ipairs` doit donner le même ordre d'une exécution à l'autre, sinon
    -- deux serveurs tireraient des variantes différentes pour la même graine.
    for _, parMode in pairs(sets) do
        for _, liste in pairs(parMode) do table.sort(liste) end
    end
    return sets
end

-- ── Choix du mode ──────────────────────────────────────────────────────────────

--- Quel mode pour un contexte de jeu donné ?
---
--- La règle, en une phrase : **root motion quand l'animation a le droit de
--- déplacer le personnage, sur place quand c'est le code qui commande**.
---@param contexte table  { verrouille?: boolean, au_sol?: boolean, pilote_par_code?: boolean }
---@return string "IP" | "RM"
function Animations.ModePour(contexte)
    contexte = contexte or {}

    -- Une cible verrouillée impose la distance : une animation qui avance
    -- casserait la portée que le combat vient de calculer.
    if (contexte.verrouille) then return "IP" end

    -- Un déplacement déjà piloté par le contrôleur (dash, poussée, véhicule)
    -- entrerait en conflit avec celui de l'animation.
    if (contexte.pilote_par_code) then return "IP" end

    -- Hors du sol, le root motion pousse dans le vide.
    if (contexte.au_sol == false) then return "IP" end

    return "RM"
end

-- ── Tirage ─────────────────────────────────────────────────────────────────────

--- Choisit une variante pour une action.
---
--- Ne rejoue jamais la même deux fois de suite tant qu'une autre existe : c'est
--- tout l'intérêt d'avoir plusieurs prises. Un tirage purement aléatoire
--- redonnerait la même une fois sur trois avec trois prises, et l'effet de
--- répétition qu'on cherche à supprimer resterait bien visible.
---
--- Repli en cascade : mode demandé → l'autre mode → sans mode. Une action qui
--- n'existe qu'en IP doit se jouer même si l'appelant a demandé du RM.
---@param sets table         produit par Grouper
---@param action string
---@param mode? string       "IP" | "RM"
---@param etat? table        historique par action, muté ici (nil = pas d'historique)
---@param rng? fun():number
---@return string|nil nom
function Animations.Choisir(sets, action, mode, etat, rng)
    local parMode = sets and sets[action]
    if (not parMode) then return nil end

    local ordre = {}
    if (mode) then table.insert(ordre, mode) end
    for _, m in ipairs(Animations.MODES) do
        if (m ~= mode) then table.insert(ordre, m) end
    end
    table.insert(ordre, "-")

    local liste
    local cleRetenue
    for _, cle in ipairs(ordre) do
        local candidat = parMode[cle]
        if (candidat and #candidat > 0) then liste = candidat; cleRetenue = cle; break end
    end
    if (not liste) then return nil end
    if (#liste == 1) then return liste[1] end

    rng = rng or math.random

    -- L'historique est indexé par action ET mode : alterner entre IP et RM ne
    -- doit pas faire oublier ce qui vient d'être joué dans chacun.
    local cleEtat = action .. "|" .. cleRetenue
    local precedent = etat and etat[cleEtat]

    local choix = liste[math.floor(rng() * #liste) + 1]
    if (precedent and choix == precedent) then
        -- Un seul décalage suffit et garde une distribution uniforme sur les
        -- variantes restantes ; retirer au hasard jusqu'à changer pourrait
        -- boucler longtemps sur deux prises.
        local i = 1
        for k, v in ipairs(liste) do if (v == choix) then i = k break end end
        choix = liste[(i % #liste) + 1]
    end

    if (etat) then etat[cleEtat] = choix end
    return choix
end

--- Nom complet d'asset pour nanos, préfixé du pack.
--- Les animations vivent dans le pack cuit `narvos` ; sans préfixe, le moteur
--- les chercherait dans le pack de base et ne les trouverait pas.
---@param nom string
---@return string
function Animations.Asset(nom)
    return "narvos::" .. tostring(nom)
end

-- ── Diagnostic ─────────────────────────────────────────────────────────────────

--- Combien d'actions gagnent réellement au tirage, et lesquelles ?
--- À appeler au chargement : si ce compte tombe à zéro après un réimport, c'est
--- que les noms ont changé et que le regroupement ne mord plus.
---@param sets table
---@return table  { actions, a_variantes, a_deux_modes, exemples }
function Animations.Resume(sets)
    local actions, aVariantes, aDeuxModes = 0, 0, 0
    local exemples = {}

    for base, parMode in pairs(sets) do
        actions = actions + 1

        local total = 0
        for _, liste in pairs(parMode) do total = total + #liste end

        if (total > 1) then
            aVariantes = aVariantes + 1
            if (#exemples < 5) then table.insert(exemples, base) end
        end
        if (parMode.IP and parMode.RM) then aDeuxModes = aDeuxModes + 1 end
    end

    table.sort(exemples)
    return { actions = actions, a_variantes = aVariantes, a_deux_modes = aDeuxModes, exemples = exemples }
end

return Animations
