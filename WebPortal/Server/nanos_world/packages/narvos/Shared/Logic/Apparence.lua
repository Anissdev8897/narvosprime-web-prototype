-- ══════════════════════════════════════════════════════════════════════════════
-- Apparence.lua — silhouette et couleurs des corps NON morphables. PUR.
--
-- ── POURQUOI CE MODULE EXISTE À CÔTÉ DE Morphs.lua ────────────────────────────
-- `Morphs.lua` pilote des morph targets. Les deux corps du jeu — Opérateur et
-- Valkiria — n'en portent AUCUN, et il n'y a pas de chemin pour leur en donner :
-- `SetMorphTarget(name, value)` n'a pas d'`attachable_id` et ne touche que le
-- mesh de BASE, or ce mesh est caché et toute la peau visible vient de pièces
-- attachées.
--
-- Deux mécanismes restent, et ce sont ceux-ci :
--
--   SILHOUETTE  `SetScale` sur le Character. Grossier — il agit sur tout le
--               personnage, tête comprise — mais réel, immédiat, et sans asset
--               à produire.
--   COULEUR     `SetMaterialColorParameter(param, Color, index, attachable_id)`.
--               L'`attachable_id` est ce qui change tout : contrairement aux
--               morphs, les couleurs ATTEIGNENT les pièces attachées.
--
-- ── CE QU'ON NE PEUT PAS RECOLORER ────────────────────────────────────────────
-- La PEAU. Sondé le 2026-09-04 sur les 27 matériaux du pack : `MI_Body` et
-- `MI_Female_Body` n'exposent aucun paramètre vectoriel, leur teinte est cuite
-- dans la texture. Les vêtements (`Color 1/2/3`), les yeux et les cheveux
-- (`Hair Color`), eux, en ont.
--
-- Proposer un curseur de teint qui ne ferait rien serait pire que ne rien
-- proposer : le joueur croirait à une panne.
-- ══════════════════════════════════════════════════════════════════════════════

local Apparence = {}

-- ── Silhouette ────────────────────────────────────────────────────────────────

--- Curseurs de silhouette. 0,5 est le neutre : le personnage à sa taille de base.
---
--- ── TROIS AXES, PARCE QUE L'ÉCHELLE EST UN VECTEUR ───────────────────────────
--- `SetScale` prend un Vector : X, Y et Z se règlent SÉPARÉMENT. Unreal oriente
--- un personnage X vers l'avant, Y vers sa droite, Z vers le haut. On tient donc
--- trois silhouettes distinctes pour le prix d'une :
---
---     Z  la taille          petit / grand
---     Y  la carrure         épaules étroites / larges, vu de face
---     X  la corpulence      mince / épais, vu de profil
---
--- Les deux premiers existaient déjà mais partageaient un seul curseur, qui
--- posait la MÊME valeur sur X et Y : un personnage large de face l'était
--- forcément de profil. Les séparer ne coûte rien et double le vocabulaire.
---
--- ── POURQUOI LES BORNES SE SONT ÉLARGIES ─────────────────────────────────────
--- Elles étaient à ±12 % pour une seule raison, écrite ici même : « la capsule
--- de collision ne suit plus la silhouette ». C'est réparé — `Builder` appelle
--- désormais `SetCapsuleSize`, que l'API expose (autorité serveur), avec les
--- dimensions recalculées par `Apparence.Capsule`. La contrainte tombe donc.
---
--- ⚠ Ce qui NE tombe pas : la mise à l'échelle est UNIFORME sur tout le corps,
--- tête comprise. Au-delà d'environ ±20 % la tête part avec le reste et le
--- personnage cesse d'être crédible. Ce n'est pas un défaut de collision, c'est
--- la limite de la méthode — seul un vrai système modulaire (Mutable) déforme le
--- torse sans déformer le crâne.
Apparence.CURSEURS = {
    { id = "taille", label = "Taille", gauche = "Petit", droit = "Grand",
      defaut = 0.5, min = 0.85, max = 1.18, axe = "z" },
    { id = "carrure", label = "Carrure", gauche = "Etroite", droit = "Large",
      defaut = 0.5, min = 0.86, max = 1.18, axe = "y" },
    { id = "corpulence", label = "Corpulence", gauche = "Mince", droit = "Epaisse",
      defaut = 0.5, min = 0.86, max = 1.20, axe = "x" },
}

--- Prefixe des reglages d'apparence dans la table plate, comme les macros.
Apparence.PREFIXE = "#"

--- Écart maximal toléré entre la largeur (Y) et l'épaisseur (X).
---
--- Au-delà, le personnage cesse d'être un corps et devient une silhouette
--- découpée. 1,22 laisse une carrure nettement lisible sans atteindre ce point.
Apparence.RATIO_MAX = 1.22

local function borner(v, mini, maxi)
    local n = tonumber(v)
    if (not n) then return nil end
    if (n < mini) then return mini end
    if (n > maxi) then return maxi end
    return n
end

--- Facteur d'échelle d'un curseur, depuis sa position 0→1.
---
--- On interpole entre `min` et `max` en passant par 1 au milieu : sans ce point
--- fixe, le neutre du curseur ne rendrait pas le personnage à sa taille réelle.
local function facteur(curseur, position)
    local p = borner(position, 0, 1) or curseur.defaut
    if (p < 0.5) then
        return curseur.min + (1 - curseur.min) * (p / 0.5)
    end
    return 1 + (curseur.max - 1) * ((p - 0.5) / 0.5)
end

--- Échelle à appliquer au Character, depuis les réglages du joueur.
---
--- ⚠ LA HAUTEUR EST EN Z, LA LARGEUR EN X ET Y. Unreal est Z-up, contrairement
--- au glTF qui est Y-up. Intervertir ne lève rien : le personnage s'aplatit au
--- sol au lieu de grandir, ce qui se lit comme un bug de modèle.
---@param reglages table|nil  { ["#taille"] = 0..1, ["#carrure"] = 0..1 }
---@return table  { x, y, z }
function Apparence.Echelle(reglages)
    local sortie = { x = 1, y = 1, z = 1 }
    if (type(reglages) ~= "table") then return sortie end

    -- ⚠ L'AXE EST DANS LE CATALOGUE, PAS DANS CE `if`. Une chaîne de `elseif`
    -- comparant des identifiants est une COPIE de la liste des curseurs : ajouter
    -- un curseur sans toucher ici le rendrait inerte, sans erreur. C'est la même
    -- panne que `Roster.EncoderCouleurs`, qui itérait trois noms écrits en dur et
    -- renvoyait une chaîne vide. Itérer le catalogue, jamais une copie.
    for _, c in ipairs(Apparence.CURSEURS) do
        local p = reglages[Apparence.PREFIXE .. c.id]
        if (p ~= nil and sortie[c.axe] ~= nil) then
            sortie[c.axe] = facteur(c, p)
        end
    end

    -- ── LE RAPPORT X:Y EST BORNÉ ─────────────────────────────────────────────
    -- Séparer carrure et corpulence ouvre une combinaison que l'ancien curseur
    -- unique rendait impossible : large de face et mince de profil, c'est-à-dire
    -- un personnage en carton. C'est ce que gardait l'assertion « une carrure
    -- n'est pas un aplatissement », et elle avait raison.
    --
    -- On ne revient pas à X = Y pour autant : on borne leur RAPPORT. Les deux
    -- axes restent réglables, mais l'écart entre eux ne peut pas atteindre la
    -- caricature. L'axe extrême est ramené vers l'autre, jamais l'inverse — tirer
    -- le plus petit vers le haut ferait grossir un personnage qu'on amincissait.
    local grand = math.max(sortie.x, sortie.y)
    local petit = math.min(sortie.x, sortie.y)
    if (petit > 0 and grand / petit > Apparence.RATIO_MAX) then
        local plafond = petit * Apparence.RATIO_MAX
        if (sortie.x > sortie.y) then sortie.x = plafond else sortie.y = plafond end
    end

    return sortie
end

--- Dimensions de capsule à poser après une mise à l'échelle.
---
--- ── POURQUOI IL FAUT LA POSER À LA MAIN ───────────────────────────────────────
--- nanos dimensionne la capsule sur les bounds du mesh AU SPAWN. Un `SetScale`
--- postérieur change ce qu'on voit et pas ce qui entre en collision : un grand
--- personnage flotte, un petit s'enfonce, un large traverse les murs. Rien n'est
--- journalisé — ça se lit comme un bug de map.
---
--- `SetCapsuleSize(radius, half_height, crouched_half_height)` existe (autorité
--- serveur) et règle exactement ça.
---
--- ⚠ LE RAYON SUIT LE PLUS GRAND DES DEUX AXES HORIZONTAUX. Une capsule est
--- ronde : elle ne peut pas être large de face et mince de profil. Prendre le max
--- fait qu'un personnage épais ne rentre jamais DANS un mur ; prendre le min ou
--- la moyenne le laisserait passer au travers sous un certain angle.
---@param base table   { rayon, demi_hauteur, demi_hauteur_accroupi } lues par GetCapsuleSize
---@param echelle table  { x, y, z } rendu par Apparence.Echelle
---@return table  { rayon, demi_hauteur, demi_hauteur_accroupi }, en entiers
function Apparence.Capsule(base, echelle)
    if (type(base) ~= "table" or type(echelle) ~= "table") then return nil end

    local r = tonumber(base.rayon)
    local h = tonumber(base.demi_hauteur)
    local ha = tonumber(base.demi_hauteur_accroupi)
    if (not r or not h) then return nil end

    local horizontal = math.max(tonumber(echelle.x) or 1, tonumber(echelle.y) or 1)
    local vertical = tonumber(echelle.z) or 1

    -- `SetCapsuleSize` prend des ENTIERS. Un flottant passerait, mais Unreal le
    -- tronquerait sans le dire, et la capsule serait systématiquement plus petite
    -- que la silhouette — donc le personnage légèrement enfoncé dans le sol.
    local arrondir = function(v) return math.floor(v + 0.5) end

    return {
        rayon = arrondir(r * horizontal),
        demi_hauteur = arrondir(h * vertical),
        demi_hauteur_accroupi = ha and arrondir(ha * vertical) or nil,
    }
end

--- Vrai si cet identifiant est un réglage d'apparence.
---@param id any
---@return boolean
function Apparence.EstReglage(id)
    return type(id) == "string" and id:sub(1, 1) == Apparence.PREFIXE
end

-- ── Couleurs ──────────────────────────────────────────────────────────────────

--- Cibles recolorables. `param` est le nom EXACT du paramètre du matériau —
--- sondé, pas supposé : `SetMaterialColorParameter` sur un nom inconnu ne lève
--- rien et n'applique rien.
---
--- `slots` dit sur quelles pièces attachées appliquer la couleur. Une cible sans
--- slot vise le mesh de base.
Apparence.CIBLES = {
    -- ── LA PEAU, ENFIN TEINTABLE ─────────────────────────────────────────────
    --
    -- Elle ne l'était pas : sondés deux fois, `MI_Body` et `MI_Female_Body`
    -- n'exposent AUCUN paramètre vectoriel — leur teinte est cuite dans la
    -- texture. Sur les 27 matériaux du pack, 12 avaient des paramètres de
    -- couleur ; ni l'un ni l'autre.
    --
    -- `scripts/adk-creer-materiau-peau.py` a donc fabriqué `M_NarvosPeau` —
    -- texture x paramètre `Teinte` — et deux instances qui reprennent les
    -- textures d'origine (`T_Body_C`/`T_Body_N`, `T_Female_Body_C`/`_N`).
    --
    -- ⚠ LE NEUTRE EST LE BLANC. Multiplier par blanc laisse la texture
    -- inchangée : un joueur qui ne touche à rien voit exactement la peau des
    -- modèles de base. C'est la condition pour ajouter ce réglage sans modifier
    -- l'apparence d'Opérateur et de Valkiria.
    --
    -- ⚠ `materiau` DOIT être posé AVANT la teinte. La pièce porte `MI_Body`, qui
    -- n'a pas de `Teinte` : régler la couleur sans avoir échangé le matériau ne
    -- lève rien et ne peint rien. `%s` reçoit le genre.
    {
        id = "peau",
        label = "Peau",
        param = "Teinte",
        materiau = "narvos::MI_NarvosPeau_%s",
        slots = { "torse", "jambes", "mains", "visage", "pieds" },
        defaut = "#ffffff",
    },
    {
        id = "tenue",
        label = "Tenue",
        param = "Color 1",
        slots = { "torse", "jambes", "mains", "pieds", "epaules", "bras" },
        defaut = "#4a5568",
    },
    {
        id = "tenue2",
        label = "Tenue — détail",
        param = "Color 2",
        slots = { "torse", "jambes", "mains", "pieds", "epaules", "bras" },
        defaut = "#2d3748",
    },
    {
        id = "yeux",
        label = "Yeux",
        param = "Color 1",
        slots = { "visage" },
        defaut = "#3a5a6b",
    },
    {
        id = "cheveux",
        label = "Cheveux",
        param = "Hair Color",
        slots = { "tete" },
        defaut = "#3b2a1e",
    },
}

--- Palette proposée. Un nuancier fermé plutôt qu'un sélecteur libre : dans un
--- monde partagé, une teinte fluo choisie au hasard casse la cohérence de la
--- scène, et personne ne la retire ensuite.
Apparence.PALETTE = {
    "#1a1a1e", "#2d3748", "#4a5568", "#718096", "#a0aec0", "#e2e8f0",
    "#5c2e2e", "#8b4513", "#b8860b", "#4a5d23", "#2c5364", "#3a3a5c",
    "#6b2737", "#1f4e5f", "#7a5230", "#54426b",
}

--- Vrai si la chaîne est une couleur hexadécimale acceptable.
--- Le client peut envoyer n'importe quoi ; une valeur mal formée donnerait une
--- couleur noire silencieuse.
---@param hex any
---@return boolean
function Apparence.CouleurValide(hex)
    return type(hex) == "string" and hex:match("^#%x%x%x%x%x%x$") ~= nil
end

--- Couleurs normalisées depuis ce qu'envoie le client.
--- Toute valeur absente ou mal formée retombe sur son défaut.
---@param brut table|nil
---@return table  { [id_cible] = "#rrggbb" }
function Apparence.Couleurs(brut)
    local sortie = {}
    for _, c in ipairs(Apparence.CIBLES) do
        local v = type(brut) == "table" and brut[c.id] or nil
        sortie[c.id] = Apparence.CouleurValide(v) and v or c.defaut
    end
    return sortie
end

--- Une cible par son identifiant, ou nil.
---@param id string
---@return table|nil
function Apparence.Cible(id)
    if (type(id) ~= "string") then return nil end
    for _, c in ipairs(Apparence.CIBLES) do
        if (c.id == id) then return c end
    end
    return nil
end

--- Réglages de silhouette normalisés, pour l'écran et la persistance.
---@param brut table|nil
---@return table
function Apparence.Silhouette(brut)
    local sortie = {}
    for _, c in ipairs(Apparence.CURSEURS) do
        local v = type(brut) == "table" and brut[Apparence.PREFIXE .. c.id] or nil
        sortie[Apparence.PREFIXE .. c.id] = borner(v, 0, 1) or c.defaut
    end
    return sortie
end

return Apparence
