-- ══════════════════════════════════════════════════════════════════════════════
-- Morphs.lua — reglages de morphologie du corps morphable.
--
-- FICHIER GENERE par scripts/narvos-morphs-to-lua.mjs — ne pas editer a la main.
-- Il est reconstruit depuis les targetNames du GLB, ce qui garantit qu'aucun
-- curseur ne pilote un morph absent du mesh cuit.
--
-- 138 curseurs, 3 choix de forme, sur 11 zones.
--
-- ── COMMENT UN CURSEUR S'APPLIQUE ─────────────────────────────────────────────
-- Un curseur va de -1 a +1 et porte DEUX morphs opposes. Le signe choisit lequel
-- s'applique, et l'autre est remis a zero :
--
--     valeur < 0  ->  SetMorphTarget(negatif, -valeur) ; positif a 0
--     valeur > 0  ->  SetMorphTarget(positif,  valeur) ; negatif a 0
--
-- ⚠ REMETTRE L'AUTRE A ZERO N'EST PAS FACULTATIF. Les deux morphs tirent les
-- memes sommets en sens contraire : les laisser tous deux actifs les annule
-- partiellement, et le curseur semble ne rien faire passe un certain point.
--
-- ── COTES GAUCHE ET DROIT ─────────────────────────────────────────────────────
-- Les morphs prefixes `l-` et `r-` portent un champ `cote`. L'ecran peut les
-- lier (symetrie) ou les separer (asymetrie) ; le catalogue ne tranche pas.
-- ══════════════════════════════════════════════════════════════════════════════

local Morphs = {}

--- Mesh qui porte ces morphs. Un autre corps ne les a PAS : les appliquer
--- ailleurs ne leve rien et ne fait rien.
Morphs.MESH = "narvos::base_morphable"

--- Zones, dans l'ordre d'affichage.
Morphs.ZONES = {
    { id = "cheek", label = "Joues" },
    { id = "chin", label = "Menton" },
    { id = "ear", label = "Oreilles" },
    { id = "eye", label = "Yeux" },
    { id = "eyebrows", label = "Sourcils" },
    { id = "forehead", label = "Front" },
    { id = "head", label = "Tête" },
    { id = "measure", label = "Mensurations" },
    { id = "mouth", label = "Bouche" },
    { id = "neck", label = "Cou" },
    { id = "nose", label = "Nez" },
}

--- Curseurs bipolaires. `negatif` absent = curseur unipolaire (0 a 1).
Morphs.CURSEURS = {
    { id = "l-cheek-bones", zone = "cheek", cote = "gauche", negatif = "l-cheek-bones-decr", positif = "l-cheek-bones-incr" },
    { id = "l-cheek-inner", zone = "cheek", cote = "gauche", negatif = "l-cheek-inner-decr", positif = "l-cheek-inner-incr" },
    { id = "l-cheek-trans", zone = "cheek", cote = "gauche", negatif = "l-cheek-trans-down", positif = "l-cheek-trans-up" },
    { id = "l-cheek-volume", zone = "cheek", cote = "gauche", negatif = "l-cheek-volume-decr", positif = "l-cheek-volume-incr" },
    { id = "r-cheek-bones", zone = "cheek", cote = "droit", negatif = "r-cheek-bones-decr", positif = "r-cheek-bones-incr" },
    { id = "r-cheek-inner", zone = "cheek", cote = "droit", negatif = "r-cheek-inner-decr", positif = "r-cheek-inner-incr" },
    { id = "r-cheek-trans", zone = "cheek", cote = "droit", negatif = "r-cheek-trans-down", positif = "r-cheek-trans-up" },
    { id = "r-cheek-volume", zone = "cheek", cote = "droit", negatif = "r-cheek-volume-decr", positif = "r-cheek-volume-incr" },
    { id = "chin-bones", zone = "chin", negatif = "chin-bones-decr", positif = "chin-bones-incr" },
    { id = "chin-cleft", zone = "chin", negatif = "chin-cleft-decr", positif = "chin-cleft-incr" },
    { id = "chin-height", zone = "chin", negatif = "chin-height-decr", positif = "chin-height-incr" },
    { id = "chin-jaw-drop", zone = "chin", negatif = "chin-jaw-drop-decr", positif = "chin-jaw-drop-incr" },
    { id = "chin-prognathism", zone = "chin", negatif = "chin-prognathism-decr", positif = "chin-prognathism-incr" },
    { id = "chin-prominent", zone = "chin", negatif = "chin-prominent-decr", positif = "chin-prominent-incr" },
    { id = "chin-triangle", zone = "chin", positif = "chin-triangle" },
    { id = "chin-width", zone = "chin", negatif = "chin-width-decr", positif = "chin-width-incr" },
    { id = "l-ear-flap", zone = "ear", cote = "gauche", negatif = "l-ear-flap-decr", positif = "l-ear-flap-incr" },
    { id = "l-ear-lobe", zone = "ear", cote = "gauche", negatif = "l-ear-lobe-decr", positif = "l-ear-lobe-incr" },
    { id = "l-ear-rot", zone = "ear", cote = "gauche", negatif = "l-ear-rot-backward", positif = "l-ear-rot-forward" },
    { id = "l-ear-scale", zone = "ear", cote = "gauche", negatif = "l-ear-scale-decr", positif = "l-ear-scale-incr" },
    { id = "l-ear-scale-depth", zone = "ear", cote = "gauche", negatif = "l-ear-scale-depth-decr", positif = "l-ear-scale-depth-incr" },
    { id = "l-ear-scale-vert", zone = "ear", cote = "gauche", negatif = "l-ear-scale-vert-decr", positif = "l-ear-scale-vert-incr" },
    { id = "l-ear-trans-prof", zone = "ear", cote = "gauche", negatif = "l-ear-trans-backward", positif = "l-ear-trans-forward" },
    { id = "l-ear-trans-vert", zone = "ear", cote = "gauche", negatif = "l-ear-trans-down", positif = "l-ear-trans-up" },
    { id = "l-ear-wing", zone = "ear", cote = "gauche", negatif = "l-ear-wing-decr", positif = "l-ear-wing-incr" },
    { id = "r-ear-flap", zone = "ear", cote = "droit", negatif = "r-ear-flap-decr", positif = "r-ear-flap-incr" },
    { id = "r-ear-lobe", zone = "ear", cote = "droit", negatif = "r-ear-lobe-decr", positif = "r-ear-lobe-incr" },
    { id = "r-ear-rot", zone = "ear", cote = "droit", negatif = "r-ear-rot-backward", positif = "r-ear-rot-forward" },
    { id = "r-ear-scale", zone = "ear", cote = "droit", negatif = "r-ear-scale-decr", positif = "r-ear-scale-incr" },
    { id = "r-ear-scale-depth", zone = "ear", cote = "droit", negatif = "r-ear-scale-depth-decr", positif = "r-ear-scale-depth-incr" },
    { id = "r-ear-scale-vert", zone = "ear", cote = "droit", negatif = "r-ear-scale-vert-decr", positif = "r-ear-scale-vert-incr" },
    { id = "r-ear-trans-prof", zone = "ear", cote = "droit", negatif = "r-ear-trans-backward", positif = "r-ear-trans-forward" },
    { id = "r-ear-trans-vert", zone = "ear", cote = "droit", negatif = "r-ear-trans-down", positif = "r-ear-trans-up" },
    { id = "r-ear-wing", zone = "ear", cote = "droit", negatif = "r-ear-wing-decr", positif = "r-ear-wing-incr" },
    { id = "l-eye-bag", zone = "eye", cote = "gauche", negatif = "l-eye-bag-decr", positif = "l-eye-bag-incr" },
    { id = "l-eye-bag-height", zone = "eye", cote = "gauche", negatif = "l-eye-bag-height-decr", positif = "l-eye-bag-height-incr" },
    { id = "l-eye-bag-lat", zone = "eye", cote = "gauche", negatif = "l-eye-bag-in", positif = "l-eye-bag-out" },
    { id = "l-eye-corner1", zone = "eye", cote = "gauche", negatif = "l-eye-corner1-down", positif = "l-eye-corner1-up" },
    { id = "l-eye-corner2", zone = "eye", cote = "gauche", negatif = "l-eye-corner2-down", positif = "l-eye-corner2-up" },
    { id = "l-eye-epicanthus", zone = "eye", cote = "gauche", negatif = "l-eye-epicanthus-in", positif = "l-eye-epicanthus-out" },
    { id = "l-eye-eyefold-angle", zone = "eye", cote = "gauche", negatif = "l-eye-eyefold-angle-down", positif = "l-eye-eyefold-angle-up" },
    { id = "l-eye-eyefold-courbe", zone = "eye", cote = "gauche", negatif = "l-eye-eyefold-concave", positif = "l-eye-eyefold-convex" },
    { id = "l-eye-eyefold-vert", zone = "eye", cote = "gauche", negatif = "l-eye-eyefold-down", positif = "l-eye-eyefold-up" },
    { id = "l-eye-height1", zone = "eye", cote = "gauche", negatif = "l-eye-height1-decr", positif = "l-eye-height1-incr" },
    { id = "l-eye-height2", zone = "eye", cote = "gauche", negatif = "l-eye-height2-decr", positif = "l-eye-height2-incr" },
    { id = "l-eye-height3", zone = "eye", cote = "gauche", negatif = "l-eye-height3-decr", positif = "l-eye-height3-incr" },
    { id = "l-eye-push1", zone = "eye", cote = "gauche", negatif = "l-eye-push1-in", positif = "l-eye-push1-out" },
    { id = "l-eye-push2", zone = "eye", cote = "gauche", negatif = "l-eye-push2-in", positif = "l-eye-push2-out" },
    { id = "l-eye-scale", zone = "eye", cote = "gauche", negatif = "l-eye-scale-decr", positif = "l-eye-scale-incr" },
    { id = "l-eye-trans-lat", zone = "eye", cote = "gauche", negatif = "l-eye-trans-in", positif = "l-eye-trans-out" },
    { id = "l-eye-trans-vert", zone = "eye", cote = "gauche", negatif = "l-eye-trans-down", positif = "l-eye-trans-up" },
    { id = "r-eye-bag", zone = "eye", cote = "droit", negatif = "r-eye-bag-decr", positif = "r-eye-bag-incr" },
    { id = "r-eye-bag-height", zone = "eye", cote = "droit", negatif = "r-eye-bag-height-decr", positif = "r-eye-bag-height-incr" },
    { id = "r-eye-bag-lat", zone = "eye", cote = "droit", negatif = "r-eye-bag-in", positif = "r-eye-bag-out" },
    { id = "r-eye-corner1", zone = "eye", cote = "droit", negatif = "r-eye-corner1-down", positif = "r-eye-corner1-up" },
    { id = "r-eye-corner2", zone = "eye", cote = "droit", negatif = "r-eye-corner2-down", positif = "r-eye-corner2-up" },
    { id = "r-eye-epicanthus", zone = "eye", cote = "droit", negatif = "r-eye-epicanthus-in", positif = "r-eye-epicanthus-out" },
    { id = "r-eye-eyefold-angle", zone = "eye", cote = "droit", negatif = "r-eye-eyefold-angle-down", positif = "r-eye-eyefold-angle-up" },
    { id = "r-eye-eyefold-courbe", zone = "eye", cote = "droit", negatif = "r-eye-eyefold-concave", positif = "r-eye-eyefold-convex" },
    { id = "r-eye-eyefold-vert", zone = "eye", cote = "droit", negatif = "r-eye-eyefold-down", positif = "r-eye-eyefold-up" },
    { id = "r-eye-height1", zone = "eye", cote = "droit", negatif = "r-eye-height1-decr", positif = "r-eye-height1-incr" },
    { id = "r-eye-height2", zone = "eye", cote = "droit", negatif = "r-eye-height2-decr", positif = "r-eye-height2-incr" },
    { id = "r-eye-height3", zone = "eye", cote = "droit", negatif = "r-eye-height3-decr", positif = "r-eye-height3-incr" },
    { id = "r-eye-push1", zone = "eye", cote = "droit", negatif = "r-eye-push1-in", positif = "r-eye-push1-out" },
    { id = "r-eye-push2", zone = "eye", cote = "droit", negatif = "r-eye-push2-in", positif = "r-eye-push2-out" },
    { id = "r-eye-scale", zone = "eye", cote = "droit", negatif = "r-eye-scale-decr", positif = "r-eye-scale-incr" },
    { id = "r-eye-trans-lat", zone = "eye", cote = "droit", negatif = "r-eye-trans-in", positif = "r-eye-trans-out" },
    { id = "r-eye-trans-vert", zone = "eye", cote = "droit", negatif = "r-eye-trans-down", positif = "r-eye-trans-up" },
    { id = "eyebrows-angle", zone = "eyebrows", negatif = "eyebrows-angle-down", positif = "eyebrows-angle-up" },
    { id = "eyebrows-trans-prof", zone = "eyebrows", negatif = "eyebrows-trans-backward", positif = "eyebrows-trans-forward" },
    { id = "eyebrows-trans-vert", zone = "eyebrows", negatif = "eyebrows-trans-down", positif = "eyebrows-trans-up" },
    { id = "forehead-nubian", zone = "forehead", negatif = "forehead-nubian-decr", positif = "forehead-nubian-incr" },
    { id = "forehead-scale-vert", zone = "forehead", negatif = "forehead-scale-vert-decr", positif = "forehead-scale-vert-incr" },
    { id = "forehead-temple", zone = "forehead", negatif = "forehead-temple-decr", positif = "forehead-temple-incr" },
    { id = "forehead-trans", zone = "forehead", negatif = "forehead-trans-backward", positif = "forehead-trans-forward" },
    { id = "head-age", zone = "head", negatif = "head-age-decr", positif = "head-age-incr" },
    { id = "head-angle", zone = "head", negatif = "head-angle-in", positif = "head-angle-out" },
    { id = "head-back-scale-depth", zone = "head", negatif = "head-back-scale-depth-decr", positif = "head-back-scale-depth-incr" },
    { id = "head-fat", zone = "head", negatif = "head-fat-decr", positif = "head-fat-incr" },
    { id = "head-scale-depth", zone = "head", negatif = "head-scale-depth-decr", positif = "head-scale-depth-incr" },
    { id = "head-scale-horiz", zone = "head", negatif = "head-scale-horiz-decr", positif = "head-scale-horiz-incr" },
    { id = "head-scale-vert", zone = "head", negatif = "head-scale-vert-decr", positif = "head-scale-vert-incr" },
    { id = "head-trans-lat", zone = "head", negatif = "head-trans-in", positif = "head-trans-out" },
    { id = "head-trans-prof", zone = "head", negatif = "head-trans-backward", positif = "head-trans-forward" },
    { id = "head-trans-vert", zone = "head", negatif = "head-trans-down", positif = "head-trans-up" },
    { id = "measure-neck-circ", zone = "measure", negatif = "measure-neck-circ-decr", positif = "measure-neck-circ-incr" },
    { id = "measure-neck-height", zone = "measure", negatif = "measure-neck-height-decr", positif = "measure-neck-height-incr" },
    { id = "mouth-angles", zone = "mouth", negatif = "mouth-angles-down", positif = "mouth-angles-up" },
    { id = "mouth-cupidsbow", zone = "mouth", negatif = "mouth-cupidsbow-decr", positif = "mouth-cupidsbow-incr" },
    { id = "mouth-cupidsbow-width", zone = "mouth", negatif = "mouth-cupidsbow-width-decr", positif = "mouth-cupidsbow-width-incr" },
    { id = "mouth-dimples", zone = "mouth", negatif = "mouth-dimples-in", positif = "mouth-dimples-out" },
    { id = "mouth-laugh-lines", zone = "mouth", negatif = "mouth-laugh-lines-in", positif = "mouth-laugh-lines-out" },
    { id = "mouth-lowerlip-ext", zone = "mouth", negatif = "mouth-lowerlip-ext-down", positif = "mouth-lowerlip-ext-up" },
    { id = "mouth-lowerlip-height", zone = "mouth", negatif = "mouth-lowerlip-height-decr", positif = "mouth-lowerlip-height-incr" },
    { id = "mouth-lowerlip-middle", zone = "mouth", negatif = "mouth-lowerlip-middle-down", positif = "mouth-lowerlip-middle-up" },
    { id = "mouth-lowerlip-volume", zone = "mouth", negatif = "mouth-lowerlip-volume-decr", positif = "mouth-lowerlip-volume-incr" },
    { id = "mouth-lowerlip-width", zone = "mouth", negatif = "mouth-lowerlip-width-decr", positif = "mouth-lowerlip-width-incr" },
    { id = "mouth-philtrum-volume", zone = "mouth", negatif = "mouth-philtrum-volume-decr", positif = "mouth-philtrum-volume-incr" },
    { id = "mouth-scale-depth", zone = "mouth", negatif = "mouth-scale-depth-decr", positif = "mouth-scale-depth-incr" },
    { id = "mouth-scale-horiz", zone = "mouth", negatif = "mouth-scale-horiz-decr", positif = "mouth-scale-horiz-incr" },
    { id = "mouth-scale-vert", zone = "mouth", negatif = "mouth-scale-vert-decr", positif = "mouth-scale-vert-incr" },
    { id = "mouth-trans-lat", zone = "mouth", negatif = "mouth-trans-in", positif = "mouth-trans-out" },
    { id = "mouth-trans-prof", zone = "mouth", negatif = "mouth-trans-backward", positif = "mouth-trans-forward" },
    { id = "mouth-trans-vert", zone = "mouth", negatif = "mouth-trans-down", positif = "mouth-trans-up" },
    { id = "mouth-upperlip-ext", zone = "mouth", negatif = "mouth-upperlip-ext-down", positif = "mouth-upperlip-ext-up" },
    { id = "mouth-upperlip-height", zone = "mouth", negatif = "mouth-upperlip-height-decr", positif = "mouth-upperlip-height-incr" },
    { id = "mouth-upperlip-middle", zone = "mouth", negatif = "mouth-upperlip-middle-down", positif = "mouth-upperlip-middle-up" },
    { id = "mouth-upperlip-volume", zone = "mouth", negatif = "mouth-upperlip-volume-decr", positif = "mouth-upperlip-volume-incr" },
    { id = "mouth-upperlip-width", zone = "mouth", negatif = "mouth-upperlip-width-decr", positif = "mouth-upperlip-width-incr" },
    { id = "neck-back-scale-depth", zone = "neck", negatif = "neck-back-scale-depth-decr", positif = "neck-back-scale-depth-incr" },
    { id = "neck-double", zone = "neck", negatif = "neck-double-decr", positif = "neck-double-incr" },
    { id = "neck-scale-depth", zone = "neck", negatif = "neck-scale-depth-decr", positif = "neck-scale-depth-incr" },
    { id = "neck-scale-horiz", zone = "neck", negatif = "neck-scale-horiz-decr", positif = "neck-scale-horiz-incr" },
    { id = "neck-scale-vert", zone = "neck", negatif = "neck-scale-vert-decr", positif = "neck-scale-vert-incr" },
    { id = "neck-trans-lat", zone = "neck", negatif = "neck-trans-in", positif = "neck-trans-out" },
    { id = "neck-trans-prof", zone = "neck", negatif = "neck-trans-backward", positif = "neck-trans-forward" },
    { id = "neck-trans-vert", zone = "neck", negatif = "neck-trans-down", positif = "neck-trans-up" },
    { id = "nose-base", zone = "nose", negatif = "nose-base-down", positif = "nose-base-up" },
    { id = "nose-compression", zone = "nose", negatif = "nose-compression-compress", positif = "nose-compression-uncompress" },
    { id = "nose-curve", zone = "nose", negatif = "nose-curve-concave", positif = "nose-curve-convex" },
    { id = "nose-flaring", zone = "nose", negatif = "nose-flaring-decr", positif = "nose-flaring-incr" },
    { id = "nose-greek", zone = "nose", negatif = "nose-greek-decr", positif = "nose-greek-incr" },
    { id = "nose-hump", zone = "nose", negatif = "nose-hump-decr", positif = "nose-hump-incr" },
    { id = "nose-nostrils-angle", zone = "nose", negatif = "nose-nostrils-angle-down", positif = "nose-nostrils-angle-up" },
    { id = "nose-nostrils-width", zone = "nose", negatif = "nose-nostrils-width-decr", positif = "nose-nostrils-width-incr" },
    { id = "nose-point", zone = "nose", negatif = "nose-point-down", positif = "nose-point-up" },
    { id = "nose-point-width", zone = "nose", negatif = "nose-point-width-decr", positif = "nose-point-width-incr" },
    { id = "nose-scale-depth", zone = "nose", negatif = "nose-scale-depth-decr", positif = "nose-scale-depth-incr" },
    { id = "nose-scale-horiz", zone = "nose", negatif = "nose-scale-horiz-decr", positif = "nose-scale-horiz-incr" },
    { id = "nose-scale-vert", zone = "nose", negatif = "nose-scale-vert-decr", positif = "nose-scale-vert-incr" },
    { id = "nose-septumangle", zone = "nose", negatif = "nose-septumangle-decr", positif = "nose-septumangle-incr" },
    { id = "nose-trans-lat", zone = "nose", negatif = "nose-trans-in", positif = "nose-trans-out" },
    { id = "nose-trans-prof", zone = "nose", negatif = "nose-trans-backward", positif = "nose-trans-forward" },
    { id = "nose-trans-vert", zone = "nose", negatif = "nose-trans-down", positif = "nose-trans-up" },
    { id = "nose-volume", zone = "nose", negatif = "nose-volume-decr", positif = "nose-volume-incr" },
    { id = "nose-width1", zone = "nose", negatif = "nose-width1-decr", positif = "nose-width1-incr" },
    { id = "nose-width2", zone = "nose", negatif = "nose-width2-decr", positif = "nose-width2-incr" },
    { id = "nose-width3", zone = "nose", negatif = "nose-width3-decr", positif = "nose-width3-incr" },
}

--- Choix de forme : options exclusives, une seule active a la fois.
Morphs.CHOIX = {
    { id = "head", zone = "head", options = { { nom = "diamond", morph = "head-diamond" }, { nom = "invertedtriangular", morph = "head-invertedtriangular" }, { nom = "oval", morph = "head-oval" }, { nom = "rectangular", morph = "head-rectangular" }, { nom = "round", morph = "head-round" }, { nom = "square", morph = "head-square" }, { nom = "triangular", morph = "head-triangular" } } },
    { id = "l-ear-shape", zone = "l", options = { { nom = "pointed", morph = "l-ear-shape-pointed" }, { nom = "round", morph = "l-ear-shape-round" }, { nom = "square", morph = "l-ear-shape-square" }, { nom = "triangle", morph = "l-ear-shape-triangle" } } },
    { id = "r-ear-shape", zone = "r", options = { { nom = "pointed", morph = "r-ear-shape-pointed" }, { nom = "round", morph = "r-ear-shape-round" }, { nom = "square", morph = "r-ear-shape-square" }, { nom = "triangle", morph = "r-ear-shape-triangle" } } },
}

--- Curseurs d'une zone, ordre stable.
---@param zone string
---@return table[]
function Morphs.ParZone(zone)
    local sortie = {}
    for _, c in ipairs(Morphs.CURSEURS) do
        if (c.zone == zone) then sortie[#sortie + 1] = c end
    end
    return sortie
end

--- Un curseur par son identifiant, ou nil.
---@param id string
---@return table|nil
function Morphs.Curseur(id)
    if (type(id) ~= "string") then return nil end
    for _, c in ipairs(Morphs.CURSEURS) do
        if (c.id == id) then return c end
    end
    return nil
end

--- Un choix de forme par son identifiant, ou nil.
---@param id string
---@return table|nil
function Morphs.Choix(id)
    if (type(id) ~= "string") then return nil end
    for _, c in ipairs(Morphs.CHOIX) do
        if (c.id == id) then return c end
    end
    return nil
end

--- Borne une valeur de curseur.
--- Un curseur unipolaire ne descend pas sous zero : son morph negatif n'existe
--- pas, et une valeur negative ne ferait rien du tout — silencieusement.
---@param curseur table
---@param valeur any
---@return number
function Morphs.Borner(curseur, valeur)
    local v = tonumber(valeur) or 0
    local mini = (curseur and curseur.negatif) and -1 or 0
    if (v < mini) then return mini end
    if (v > 1) then return 1 end
    return v
end

--- Traduit un reglage en morphs a poser : { [nom_de_morph] = poids }.
---
--- Rend TOUJOURS les deux extremites d'un curseur, dont une a zero. C'est ce qui
--- annule le morph oppose quand le joueur traverse le milieu — sans quoi tirer
--- un curseur a droite puis a gauche laisserait les deux actifs.
---@param reglages table  { [id_curseur] = nombre, [id_choix] = "nom_option" }
---@return table
function Morphs.Resoudre(reglages)
    local sortie = {}
    if (type(reglages) ~= "table") then return sortie end

    for _, c in ipairs(Morphs.CURSEURS) do
        local v = Morphs.Borner(c, reglages[c.id])
        if (c.negatif) then
            sortie[c.negatif] = (v < 0) and -v or 0
            sortie[c.positif] = (v > 0) and v or 0
        else
            sortie[c.positif] = (v > 0) and v or 0
        end
    end

    for _, c in ipairs(Morphs.CHOIX) do
        local choisi = reglages[c.id]
        for _, o in ipairs(c.options) do
            sortie[o.morph] = (o.nom == choisi) and 1 or 0
        end
    end

    return sortie
end

return Morphs
