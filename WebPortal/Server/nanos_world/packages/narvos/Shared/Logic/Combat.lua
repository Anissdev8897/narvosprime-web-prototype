-- ═══════════════════════════════════════════════════════════════════════════════
-- Shared/Logic/Combat.lua — mêlée : enchaînement, fenêtre de contre, dégâts.
-- Câblage : Narvos.Combat = Package.Require("Logic/Combat.lua")
--
-- Il DÉCIDE — ce coup enchaîne-t-il, ce contre tombe-t-il dans la fenêtre,
-- combien de points de vie partent — et rend un PLAN. Il ne joue aucun montage
-- et ne touche à aucune entité nanos : même partage que `Logic/Sorts.lua`, la
-- décision ici, la mise en scène dans `Server/`. D'où son exécution sous
-- wasmoon, sans moteur.
--
-- ⚠ LE TEMPS EST UN PARAMÈTRE, EN MILLISECONDES. `Sorts` compte en secondes
-- parce qu'une recharge se compte en secondes ; une fenêtre de 300 ms s'y
-- écrirait 0,3 et se comparerait à la marge d'erreur du flottant. Aucune
-- fonction ne lit d'horloge : `maintenant` est un compteur monotone tenu côté
-- serveur — sinon chaque test dépendrait du moment où il tourne.
--
-- ⚠ LE SERVEUR DÉCIDE, LE CLIENT REÇOIT. Le jet de critique est une décision
-- d'état de jeu et chaque VM a son propre `math.randomseed` : tiré des deux
-- côtés il donnerait deux résultats, et l'écart ne se verrait qu'en jeu. D'où
-- l'aléa INJECTÉ (`alea`), déterministe en prime sous test.
-- ═══════════════════════════════════════════════════════════════════════════════

---@class NarvosCombat
local Combat = {}

local Classes = (Narvos and Narvos.Classes) or Package.Require("Catalogs/Classes.lua")
local Items = (Narvos and Narvos.Items) or Package.Require("Catalogs/Items.lua")

-- ── Directions ────────────────────────────────────────────────────────────────

--- Les quatre directions du pack `FreeflowCombatSystem`, dont les 119 montages
--- sont nommés par direction (Counter Front / Back / Left / Right).
--- ⚠ SÉQUENCE, pas un ensemble : `pairs` n'a pas d'ordre garanti et il diffère
--- d'une VM à l'autre — serveur et client ne verraient pas la même chose.
Combat.DIRECTIONS = { "Front", "Right", "Back", "Left" }

--- 90° par direction, dans l'ordre de `DIRECTIONS` en tournant vers la droite.
--- Quatre secteurs égaux : l'index se calcule, il ne se cherche pas.
Combat.SECTEUR_DEG = 90

-- ── Enchaînement ──────────────────────────────────────────────────────────────

--- `action` est un nom d'ACTION au sens de `Logic/Animations.lua` : la base,
--- sans prise (`_A`), mode (`_IP`/`_RM`) ni le `_Anim` d'Interchange. Choisir la
--- prise revient à `Animations.Choisir`, seul à connaître la convention ;
--- `Combat.Verifier` contrôle que ces bases existent, au lieu de le supposer.
--- ⚠ `duree_ms` et `fenetre_ms` sont du RESSENTI, pas des mesures : les montages
--- Freeflow ne sont pas cuits. C'est ici qu'on reportera les vraies durées.
Combat.CHAINE = {
    -- Projection réservée au dernier coup : sur chacun, elle enverrait la cible
    -- hors de portée. Sa fenêtre nulle paie son multiplicateur.
    { action = "ACB_Attack_01", multiplicateur = 1.00,
      duree_ms = 420, fenetre_ms = 320, reaction = "ACB_Hurt" },
    { action = "ACB_Attack_02", multiplicateur = 1.15,
      duree_ms = 460, fenetre_ms = 300, reaction = "ACB_Hurt" },
    { action = "ACB_Attack_03", multiplicateur = 1.45,
      duree_ms = 620, fenetre_ms = 0, reaction = "ACB_Hurt_Knockback" },
}

-- ── Contre ────────────────────────────────────────────────────────────────────

--- Fenêtre de contre, depuis l'engagement de l'attaquant : assez courte pour
--- rester une lecture, assez large pour survivre à un aller-retour réseau.
Combat.FENETRE_CONTRE_MS = 320

--- Un contre réussi riposte : sans dégâts il ne serait qu'une esquive, et
--- reculer serait toujours préférable.
Combat.MULT_CONTRE = 1.6

-- ── Dégâts ────────────────────────────────────────────────────────────────────
-- Pas un nouveau modèle : celui du runtime web, pour que le même personnage
-- frappe pareil des deux côtés.
--   `calcDamage`  (spells/SpellDef.ts)  : base * (1 + puissance/100), ×1,5 en crit
--   `isCrit`      (stats/PlayerStats.ts): random()*100 < critique  (crit en POINTS)
--   `applyDamage` (stats/PlayerStats.ts): max(1, brut * (1 - def/(def+80)))

Combat.MULT_CRITIQUE = 1.5
Combat.PUISSANCE_DIVISEUR = 100
Combat.DEFENSE_K = 80

--- Un personnage désarmé doit pouvoir frapper : sinon la touche ne répond pas
--- et rien ne dit pourquoi.
Combat.POINGS = { id = "poings", degats = 6, allonge = 110, cadence = 1.0 }

--- Repli pour ce qui n'a PAS de classe NARVOS — monstre, PNJ. Les rendre
--- inoffensifs ou invulnérables serait pire qu'approximatif.
Combat.BASE_INCONNUE = { attackPower = 10, defense = 0, critChance = 0 }

--- +8 % par niveau, repris de `createStats`.
Combat.BONUS_NIVEAU = 0.08

-- ── Utilitaires ───────────────────────────────────────────────────────────────
-- ⚠ DÉCLARÉS EN TÊTE, ASSIGNÉS ENSUITE. `local function F` ne crée le nom qu'À
-- PARTIR DE SA LIGNE : plus haut, `F` se résout en GLOBALE nil, sans message.

local arrondir
local nombre_positif

--- ⚠ `%.0f` et `%d` font de l'arrondi bancaire (0,5 → 0 mais 1,5 → 2) : deux
--- coups identiques rendraient deux nombres différents.
arrondir = function(x) return math.floor(x + 0.5) end

--- `tonumber` PUIS borne basse, dans cet ordre.
--- ⚠ `nil < 0` lève : toute valeur externe passe par ici avant d'être comparée.
nombre_positif = function(v, defaut)
    local n = tonumber(v)
    if (not n or n < 0) then return defaut end
    return n
end

-- ── Aléa ──────────────────────────────────────────────────────────────────────

--- Générateur reproductible (Lehmer / Park-Miller), en closure, dans ]0,1[.
--- Pas `math.random` : `math.randomseed` est global à la VM, et tout autre
--- package qui tire un nombre décalerait la suite. Une closure porte son état —
--- rejouer une graine rejoue exactement le même combat.
function Combat.Generateur(graine)
    local etat = math.floor(nombre_positif(graine, 1)) % 2147483647
    -- ⚠ 0 est un point fixe de la suite : il rendrait toujours la même valeur.
    if (etat <= 0) then etat = 1 end
    return function()
        etat = (etat * 16807) % 2147483647
        return etat / 2147483647
    end
end

-- ── Direction de l'attaque ────────────────────────────────────────────────────

--- D'où vient l'attaque, depuis un angle relatif : 0 de face, 90 à droite, 180
--- dans le dos, -90 à gauche. L'angle vient de l'appelant, seul à avoir les
--- positions ; le calculer ici imposerait `Vector`, absent sous wasmoon.
--- ⚠ Rend `nil` sur un angle non numérique, sans repli sur "Front" : un repli
--- silencieux jouerait un montage de face pour un coup reçu dans le dos.
---@return string|nil
function Combat.Direction(angle_deg)
    local a = tonumber(angle_deg)
    if (not a) then return nil end
    -- Le décalage d'un demi-secteur met la frontière ENTRE deux directions et
    -- non sur l'axe de l'une d'elles.
    local d = (a + Combat.SECTEUR_DEG / 2) % 360
    if (d < 0) then d = d + 360 end
    return Combat.DIRECTIONS[math.floor(d / Combat.SECTEUR_DEG) + 1]
end

--- ⚠ Garde à passer avant toute indexation : `t[nil] = v` lève.
---@return boolean
function Combat.DirectionValide(direction)
    if (type(direction) ~= "string") then return false end
    for _, d in ipairs(Combat.DIRECTIONS) do
        if (d == direction) then return true end
    end
    return false
end

-- ── Statistiques et arme ──────────────────────────────────────────────────────

--- Portées de `createStats` + `effectiveStats` (stats/PlayerStats.ts) :
--- `puissance` et `defense` majorées du niveau, `critique` = critChance × 100 EN
--- POINTS et SANS bonus de niveau (le TS non plus).
--- ⚠ `bonus` vient de `Inventory.GetEquippedStats`. On y lit les trois clés que
--- lit `effectiveStats`, pas une de plus : le catalogue d'items porte AUSSI
--- `attackPower`, et l'ajouter compterait deux fois l'épée qui déclare les deux.
--- Quelle clé alimente `puissance` appartient à la couche équipement.
---@return table  { puissance, defense, critique }
function Combat.Statistiques(class_id, niveau, bonus)
    local classe = (type(class_id) == "string") and (Classes.CLASSES or {})[class_id] or nil
    local base = (classe and classe.baseStats) or Combat.BASE_INCONNUE
    bonus = (type(bonus) == "table") and bonus or {}
    local n = math.floor(nombre_positif(niveau, 1))
    if (n < 1) then n = 1 end
    local facteur = 1 + (n - 1) * Combat.BONUS_NIVEAU
    return {
        puissance = arrondir(nombre_positif(base.attackPower, 0) * facteur)
            + nombre_positif(bonus.puissance, 0),
        defense = arrondir(nombre_positif(base.defense, 0) * facteur)
            + nombre_positif(bonus.defense, 0),
        critique = arrondir(nombre_positif(base.critChance, 0) * 100)
            + nombre_positif(bonus.critique, 0),
    }
end

--- Arme de mêlée `{ id, degats, allonge, cadence }`, depuis `Items`.
--- ⚠ PAS de catalogue des cinq armes Freeflow (`SM_Weapon_Crowbar`, `Pipe`,
--- `Sledgehammer`, `Baseball_01/02`) : vérifié le 2026-09-06, aucune n'est dans
--- `Server/Assets/narvos/Assets.toml`. Les nommer livrerait un catalogue que le
--- moteur ne résout pas — et un nom d'asset faux n'échoue pas, il est ignoré.
--- Elles entreront par `Items.lua`, généré depuis le TS, une fois le pack cuit.
---@return table|nil
function Combat.ArmeDepuisItem(item_id)
    if (type(item_id) ~= "string") then return nil end
    local def = (Items.ITEM_DB or {})[item_id]
    if (not def or def.type ~= "weapon") then return nil end
    return {
        id = def.id,
        degats = nombre_positif((def.stats or {}).attackPower, 0) + Combat.POINGS.degats,
        -- Allonge et cadence ne sont pas dans le catalogue : l'arme hérite des
        -- valeurs neutres tant que le TS ne les produit pas. Point d'extension.
        allonge = Combat.POINGS.allonge,
        cadence = 1.0,
    }
end

--- Dégâts d'un coup : attaquant `{ puissance, critique }`, arme `{ degats }`
--- (POINGS si absente), cible `{ defense }`. Rend un compte rendu et non un
--- nombre — le client affiche « CRITIQUE » sans re-tirer.
---@return table  { degats, brut, mitige, critique }
function Combat.Degats(attaquant, arme, multiplicateur, cible, alea)
    attaquant = (type(attaquant) == "table") and attaquant or {}
    arme = (type(arme) == "table") and arme or Combat.POINGS
    cible = (type(cible) == "table") and cible or {}
    alea = alea or math.random
    local socle = nombre_positif(arme.degats, 0) * nombre_positif(multiplicateur, 1)
    local brut = socle * (1 + nombre_positif(attaquant.puissance, 0) / Combat.PUISSANCE_DIVISEUR)
    -- `critique` est en POINTS (0..100), comme dans le TS.
    local critique = (alea() * 100) < nombre_positif(attaquant.critique, 0)
    if (critique) then brut = brut * Combat.MULT_CRITIQUE end
    local defense = nombre_positif(cible.defense, 0)
    local mitige = brut * (1 - defense / (defense + Combat.DEFENSE_K))
    -- Plancher à 1 (le `Math.max(1, …)` d'`applyDamage`) : un 0 affiché se lit
    -- comme un coup qui n'a pas touché.
    local degats = arrondir(mitige)
    if (degats < 1) then degats = 1 end
    return { degats = degats, brut = brut, mitige = mitige, critique = critique }
end

-- ── État de combat ────────────────────────────────────────────────────────────

--- ⚠ `contre_direction` vaut `false` et jamais `nil` quand rien n'est annoncé :
--- un champ à `nil` DISPARAÎT de la table, et « vidé » deviendrait « absent ».
function Combat.NouvelEtat()
    return {
        etape = 0,             -- dernier coup porté ; 0 = chaîne à zéro
        enchaine_de = 0,       -- ms : avant, le coup précédent n'est pas fini
        enchaine_jusqu_a = 0,  -- ms : après, la chaîne repart de zéro
        contre_direction = false,
        contre_jusqu_a = 0,
    }
end

-- ── Gestes des PNJ, réactions des cibles ───────────────────────────────────────
--
-- Mesure du 2026-09-13 : `Server/Ia.lua` appliquait les dégâts d'un PNJ SANS
-- animation, et le champ `reaction` que `Combat.Frapper` rend pour chaque coup
-- n'était joué sur aucune cible. Les animations sont cuites (Freeflow :
-- ACB_Attack_0x, ACB_Hurt, ACB_Hurt_Knockback). Ce qui manquait est ceci.

--- Récupération minimale entre deux réactions d'une même cible, en ms.
--- Trois coups rapprochés rejoueraient la réaction depuis son début trois fois :
--- la cible tremblerait sur place au lieu d'encaisser.
Combat.REACTION_RECUP_MS = 450

--- Le coup suivant d'un PNJ, qui enchaîne sans fenêtre : il frappe à sa propre
--- cadence (`IaServeur.CADENCE_COUP_MS`), toujours plus lente que la fenêtre du
--- joueur — `EtapeSuivante` le ramènerait au premier coup à chaque fois.
---@param etape any  l'étape précédente
---@return integer
function Combat.EtapeCyclique(etape)
    local e = tonumber(etape)
    if (not e or e < 1 or e >= #Combat.CHAINE) then return 1 end
    return math.floor(e) + 1
end

--- L'action de réaction qu'encaisse la cible d'un coup de cette étape.
--- Une étape inconnue rend la réaction du premier coup, jamais nil : un coup
--- reçu doit toujours se voir.
---@param etape any
---@return string
function Combat.ReactionPour(etape)
    local e = tonumber(etape)
    local def = e and Combat.CHAINE[math.floor(e)] or nil
    return (def or Combat.CHAINE[1]).reaction
end

--- De quel côté vient un coup, vu de la victime ? « avant » | « arriere » |
--- « gauche » | « droite » — les clés de `Catalogs/Gestes.lua` (reactions).
---
--- `avant` et `droite` sont les vecteurs unitaires de la victime (dans le plan du
--- sol) ; `vers_attaquant` va de la victime vers l'attaquant. Le plus grand des deux
--- produits scalaires l'emporte : un coup de trois quarts avant se lit « avant ».
--- PUR : des tables { x, y }, pas de Vector.
---@param avant table
---@param droite table
---@param vers_attaquant table
---@return string
function Combat.CoteDuCoup(avant, droite, vers_attaquant)
    local a, d, v = avant or {}, droite or {}, vers_attaquant or {}
    local f = (tonumber(a.x) or 0) * (tonumber(v.x) or 0) + (tonumber(a.y) or 0) * (tonumber(v.y) or 0)
    local r = (tonumber(d.x) or 0) * (tonumber(v.x) or 0) + (tonumber(d.y) or 0) * (tonumber(v.y) or 0)
    if (math.abs(f) >= math.abs(r)) then return (f >= 0) and "avant" or "arriere" end
    return (r >= 0) and "droite" or "gauche"
end

--- La cible peut-elle jouer une nouvelle réaction ?
---@param dernier_ms any     instant de sa dernière réaction, ou nil
---@param maintenant_ms any
---@return boolean
function Combat.PeutReagir(dernier_ms, maintenant_ms)
    local t = tonumber(maintenant_ms)
    if (not t) then return false end
    local d = tonumber(dernier_ms)
    if (not d) then return true end
    return (t - d) >= Combat.REACTION_RECUP_MS
end

--- Quel coup partirait à `maintenant` (ms) ? Ne mute rien : le HUD interroge à
--- chaque frame sans rien engager.
---@return integer|nil etape
---@return string|nil raison
function Combat.EtapeSuivante(etat, maintenant)
    if (type(etat) ~= "table") then return nil, "Etat de combat absent" end
    local t = tonumber(maintenant)
    if (not t) then return nil, "Instant invalide" end
    -- Coup en cours : ni enchaînement, ni relance.
    if (t < nombre_positif(etat.enchaine_de, 0)) then return nil, "Coup en cours" end
    local etape = math.floor(nombre_positif(etat.etape, 0))
    if (etape >= 1 and etape < #Combat.CHAINE
        and t <= nombre_positif(etat.enchaine_jusqu_a, 0)) then
        return etape + 1, nil
    end
    -- Hors fenêtre, ou chaîne terminée : on repart du premier coup.
    return 1, nil
end

--- Porte un coup et rend le plan que `Server/` mettra en scène. L'état est
--- MUTÉ, comme `Sorts.Lancer` : le recopier ferait une allocation par coup.
---@return boolean ok
---@return string|nil raison
---@return table|nil coup
function Combat.Frapper(etat, maintenant, arme)
    local etape, raison = Combat.EtapeSuivante(etat, maintenant)
    if (not etape) then return false, raison, nil end
    local def = Combat.CHAINE[etape]
    local t = tonumber(maintenant)
    -- La cadence étire la récupération ET la fenêtre : n'étirer que la première
    -- ferait de l'arme lourde la seule incapable d'enchaîner.
    local cadence = nombre_positif(arme and arme.cadence, 1)
    if (cadence <= 0) then cadence = 1 end
    local duree = def.duree_ms * cadence
    local fenetre = def.fenetre_ms * cadence
    etat.etape = etape
    etat.enchaine_de = t + duree
    etat.enchaine_jusqu_a = t + duree + fenetre
    return true, nil, {
        etape = etape,
        action = def.action,
        reaction = def.reaction,
        multiplicateur = def.multiplicateur,
        duree_ms = duree,
        fenetre_ms = fenetre,
        -- ENGAGEMENT, pas impact : c'est de lui que la cible date sa fenêtre de
        -- contre, et contrer après l'impact n'a pas de sens.
        engage_a = t,
        dernier = (etape >= #Combat.CHAINE),
    }
end

-- ── Fenêtre de contre ─────────────────────────────────────────────────────────

--- Annonce à la cible qu'un coup arrive, et d'où. Ouvre sa fenêtre de contre.
--- ⚠ Deux assaillants annoncent deux coups : on garde celui dont la fenêtre se
--- FERME LE PLUS TÔT. Garder le plus récent ferait parer un coup pas encore
--- parti tout en encaissant celui qui arrive.
---@return boolean ok
---@return string|nil raison
function Combat.Telegraphier(etat, direction, maintenant)
    if (type(etat) ~= "table") then return false, "Etat de combat absent" end
    if (not Combat.DirectionValide(direction)) then return false, "Direction inconnue" end
    local t = tonumber(maintenant)
    if (not t) then return false, "Instant invalide" end
    local fin = t + Combat.FENETRE_CONTRE_MS
    local en_cours = etat.contre_direction and (t <= nombre_positif(etat.contre_jusqu_a, 0))
    if (en_cours and nombre_positif(etat.contre_jusqu_a, 0) <= fin) then
        return true, nil
    end
    etat.contre_direction = direction
    etat.contre_jusqu_a = fin
    return true, nil
end

--- `direction_visee` est OPTIONNELLE. Sans elle le contre est non directionnel
--- (le joueur appuie, la direction choisit seulement le montage — c'est le
--- fonctionnement de Freeflow) ; avec elle, la parade doit désigner le bon côté.
--- Les deux formes coexistent parce que trancher est une décision de game design
--- qui n'est pas prise, et que ce module ne prendra pas seul.
---@return boolean
---@return string|nil raison
function Combat.PeutContrer(etat, maintenant, direction_visee)
    if (type(etat) ~= "table") then return false, "Etat de combat absent" end
    local t = tonumber(maintenant)
    if (not t) then return false, "Instant invalide" end
    local direction = etat.contre_direction
    if (not direction) then return false, "Aucune attaque a contrer" end
    if (t > nombre_positif(etat.contre_jusqu_a, 0)) then return false, "Fenetre de contre passee" end
    if (direction_visee ~= nil and direction_visee ~= direction) then return false, "Mauvais cote" end
    return true, nil
end

--- Ferme la fenêtre et rend le plan de riposte. Fermée MÊME sur un échec de
--- direction : un contre raté est un engagement, pas un essai gratuit — sinon
--- marteler la touche finirait toujours par tomber juste.
---@return boolean ok
---@return string|nil raison
---@return table|nil plan
function Combat.Contrer(etat, maintenant, direction_visee)
    local ok, raison = Combat.PeutContrer(etat, maintenant, direction_visee)
    -- La direction du plan vient de l'ANNONCE, pas de la visée : c'est le coup
    -- reçu qui décide du montage. Relevée AVANT la fermeture.
    local direction = (type(etat) == "table") and etat.contre_direction or false
    -- ⚠ On teste l'ÉTAT, jamais le libellé de la raison : une chaîne recopiée
    -- diverge de sa source, et la fenêtre cesserait de se fermer en silence.
    local t = tonumber(maintenant)
    if (direction and t and (t <= nombre_positif(etat.contre_jusqu_a, 0))) then
        etat.contre_direction = false
        etat.contre_jusqu_a = 0
    end
    if (not ok) then return false, raison, nil end
    -- ⚠ `action` est une CLÉ, pas un chemin d'asset : aucun montage Freeflow
    -- n'est déclaré dans `Assets.toml`, et « narvos::AM_Counter_Front » serait un
    -- nom que le moteur ne résout pas, sans erreur. `MontageContre` résout, à
    -- partir de la liste réelle que l'appelant lui donne.
    return true, nil, {
        direction = direction,
        action = "Counter_" .. direction,
        multiplicateur = Combat.MULT_CONTRE,
    }
end

-- ── Résolution des montages ───────────────────────────────────────────────────

--- Montages d'une direction, parmi une liste de noms fournie par l'appelant.
--- ⚠ La direction est encadrée de `_` : sans cela `Back` attraperait `Backhand`.
--- Le nom est bordé des deux côtés pour qu'une direction en tête ou en fin
--- compte aussi. Liste TRIÉE : `Animations.Choisir` tire la prise ensuite, et
--- deux serveurs doivent partir de la même séquence pour la même graine.
---@return table  noms retenus, triés
function Combat.MontageContre(noms, direction)
    local sortie = {}
    if (type(noms) ~= "table") then return sortie end
    if (not Combat.DirectionValide(direction)) then return sortie end
    local motif = "_" .. direction .. "_"
    for _, nom in ipairs(noms) do
        if (type(nom) == "string" and ("_" .. nom .. "_"):find(motif, 1, true)) then
            sortie[#sortie + 1] = nom
        end
    end
    table.sort(sortie)
    return sortie
end

--- Chaque action de la chaîne est-elle dans les `sets` d'`Animations.Grouper` ?
--- À appeler au chargement serveur : une action renommée à l'import ne lève
--- rien, le montage n'est jamais joué et le coup part sans geste.
---@return table  manquants
function Combat.Verifier(sets)
    local manquants = {}
    if (type(sets) ~= "table") then return manquants end
    for _, def in ipairs(Combat.CHAINE) do
        if (not sets[def.action]) then manquants[#manquants + 1] = def.action end
        if (not sets[def.reaction]) then manquants[#manquants + 1] = def.reaction end
    end
    return manquants
end

return Combat
