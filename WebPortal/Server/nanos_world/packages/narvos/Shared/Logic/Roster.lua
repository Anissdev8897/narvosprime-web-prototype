-- ═══════════════════════════════════════════════════════════════════════════════
-- Shared/Logic/Roster.lua — personnages d'un compte, stockés en base SQL.
--
-- Câblage : Narvos.Roster = Package.Require("Logic/Roster.lua")
--
-- ── RÉPARTITION DES RÔLES ──────────────────────────────────────────────────────
-- `Logic/CharacterCreation.lua` DÉCIDE : il valide un nom, une classe, une tenue,
-- et fabrique la fiche. Il est pur et ne stocke rien.
-- Ce fichier-ci STOCKE : il écrit et relit ces fiches dans la base ouverte par
-- `Logic/Comptes.lua`.
--
-- Cette séparation est délibérée. `CharacterCreation` garde son chemin
-- PersistentData (utile hors base, et couvert par 68 tests) ; Roster est le
-- chemin normal dès qu'une base est disponible. Refondre l'un dans l'autre
-- aurait mêlé décision et persistance dans le même fichier.
--
-- ── SÉRIALISATION DE LA TENUE ──────────────────────────────────────────────────
-- Une tenue est une table { slot = id_de_piece }. Lua n'a pas de JSON natif et
-- nanos n'en expose pas : plutôt que d'embarquer une bibliothèque pour cinq
-- couples, on écrit `slot:piece|slot:piece`. C'est lisible à l'œil dans la base,
-- ça se `grep`, et le format ne peut pas dériver.
--
-- Les identifiants de pièce et de slot sont contraints par le catalogue
-- (`[a-z0-9_]`), donc ni `:` ni `|` ne peuvent y apparaître — aucune échappement
-- n'est nécessaire. `Modular.ValiderTenue` le vérifie à la relecture de toute
-- façon : une tenue corrompue est refusée, pas devinée.
-- ═══════════════════════════════════════════════════════════════════════════════

---@class NarvosRoster
local Roster = {}

local function requis(nom, fichier)
    return (Narvos and Narvos[nom]) or Package.Require(fichier)
end

local Creation = requis("Creation", "Logic/CharacterCreation.lua")
local Modular = requis("Modular", "Catalogs/Modular.lua")

--- Vestiaire, résolu PARESSEUSEMENT.
---
--- Contrairement à Creation et Modular ci-dessus, il ne peut pas être capturé au
--- chargement : Vestiaire lit lui-même le catalogue par `Narvos.Modular`, et
--- rien ne garantit l'ordre des deux `Package.Require` dans Shared/Index.lua.
--- Le résoudre à l'appel supprime la question.
local function Vestiaire()
    return requis("Vestiaire", "Logic/Vestiaire.lua")
end

--- Plafond par compte. Sans lui, un client bavard remplirait la base.
Roster.MAX_PAR_COMPTE = 5

--- Bourse d'un personnage neuf. Règle de Hanibes (2026-10-03) : aucune tenue
--- offerte, 1 500 pièces pour acheter celle qu'on veut à un PNJ.
--- Fait foi ; `Inventory.DEFAULT_CREDITS` et `STARTER_CREDITS`
--- (src/rpg/loot/Inventory.ts) doivent suivre (`constantes-check.mjs`).
Roster.CREDITS_DEPART = 1500

local db = nil

--- Injecte la base. Appelé par Server/Index.lua après Comptes.Ouvrir.
---@param instance any
function Roster.UtiliserBase(instance)
    db = instance
end

function Roster.Prete()
    return db ~= nil
end

-- ── Sérialisation ─────────────────────────────────────────────────────────────

--- Table de tenue → chaîne `slot:piece|slot:piece`.
--- On itère la LISTE des slots et non `pairs(tenue)` : en Lua, `pairs` n'a aucun
--- ordre garanti, et deux enregistrements de la même tenue donneraient deux
--- chaînes différentes — invisible, mais insupportable pour comparer ou déboguer.
---@param tenue table
---@return string
function Roster.EncoderTenue(tenue)
    if (type(tenue) ~= "table") then return "" end

    local morceaux = {}
    for _, slot in ipairs(Modular.SLOTS) do
        local id = tenue[slot]
        if (type(id) == "string" and id ~= "") then
            morceaux[#morceaux + 1] = slot .. ":" .. id
        end
    end
    return table.concat(morceaux, "|")
end

--- Table de COULEURS → chaîne. Même format, mais des clés différentes.
---
--- ⚠ NE PAS réutiliser `EncoderTenue` pour les couleurs. Elle itère
--- `Modular.SLOTS` (visage/torse/jambes/mains/tete) alors qu'une table de
--- couleurs est indexée par CIBLE : aucune clé ne correspond, la fonction rend
--- une chaîne VIDE, et les couleurs partaient en base effacées sans le moindre
--- signal. Trouvé par audit le 2026-09-03.
---
--- ⚠ ET LA MÊME PANNE EST REVENUE UN CRAN PLUS HAUT. Cette fonction itérait une
--- liste écrite en dur — `skin`/`hair`/`jacket`, héritée de la base Dofus, où
--- ces couleurs ne pilotaient rien. Les cibles réelles s'appellent `tenue`,
--- `tenue2`, `yeux`, `cheveux` : aucune ne correspondait, et le résultat était
--- exactement celui que le commentaire ci-dessus met en garde de produire.
--- Corrigé le 2026-09-04 en itérant le CATALOGUE, seul endroit qui sache quelles
--- cibles existent — une liste recopiée finit toujours par diverger de sa source.
---@param couleurs table
---@return string
function Roster.EncoderCouleurs(couleurs)
    if (type(couleurs) ~= "table") then return "" end

    local Apparence = requis("Apparence", "Logic/Apparence.lua")
    if (not Apparence) then return "" end

    -- Ordre figé : celui du catalogue. `pairs` n'en garantit aucun, et deux
    -- enregistrements de la même palette donneraient deux chaînes différentes.
    --
    -- On écrit la palette NORMALISÉE : c'est le dernier point avant la base, et
    -- une valeur mal formée venue du client y deviendrait une teinte noire au
    -- rechargement, sans que rien ne l'ait signalée.
    local palette = Apparence.Couleurs(couleurs)
    local morceaux = {}
    for _, cible in ipairs(Apparence.CIBLES) do
        local v = palette[cible.id]
        if (type(v) == "string" and v ~= "") then
            morceaux[#morceaux + 1] = cible.id .. ":" .. v
        end
    end
    return table.concat(morceaux, "|")
end

-- ── L'INVENTAIRE ──────────────────────────────────────────────────────────────
--
-- ⚠ SON PROPRE ENCODEUR, ET SURTOUT PAS `EncoderTenue`. Une tenue est
-- `{ slot = piece }` ; une grille d'inventaire est une LISTE de piles portant
-- sept champs chacune. Réutiliser l'encodeur de tenue rendrait une chaîne vide
-- et l'inventaire partirait effacé en base — c'est mot pour mot ce qui est
-- arrivé aux couleurs, et c'est pour ça que l'avertissement ci-dessus existe.
--
-- ── LE FORMAT ─────────────────────────────────────────────────────────────────
--     cols,rows ; itemId:qty:x:y:w:h:uid | ... ; slot=uid , slot=uid
--     └─ grille ─┘ └────── les piles ──────┘ └──── l'équipement ────┘
--
-- Trois séparateurs distincts, choisis pour ne jamais apparaître dans un
-- identifiant d'objet (`arch_sword`, `void_saber`…) ni dans un uid.
--
-- ⚠ L'ÉQUIPEMENT RÉFÉRENCE UNE PILE PAR SON `uid`, il ne la recopie pas. Une
-- pile écrite deux fois se dédoublerait au rechargement : le joueur récupérerait
-- son épée dans la grille ET dans sa main.
--
-- ⚠ ORDRE DÉTERMINISTE. On itère la LISTE des instances et la LISTE des slots,
-- jamais `pairs` : son ordre n'est pas garanti et diffère d'une VM à l'autre,
-- donc deux enregistrements du même sac donneraient deux chaînes différentes —
-- et toute comparaison « a-t-il changé ? » serait fausse.

local function propre(v)
    -- Un identifiant qui contiendrait un séparateur casserait le décodage en
    -- silence. On le refuse plutôt que de tronquer.
    v = tostring(v or "")
    if (v:find("[;|:,=]")) then return nil end
    return v
end

--- État d'inventaire → chaîne.
---@param etat table|nil  { grid = { cols, rows, instances }, equipment = { slot = pile } }
---@return string
function Roster.EncoderInventaire(etat)
    if (type(etat) ~= "table") then return "" end
    local grille = (type(etat.grid) == "table") and etat.grid or {}
    local cols = math.floor(tonumber(grille.cols) or 8)
    local rows = math.floor(tonumber(grille.rows) or 10)

    local piles, vus = {}, {}
    for _, i in ipairs(grille.instances or {}) do
        local id, uid = propre(i.itemId), propre(i.uid)
        local q = math.floor(tonumber(i.quantity) or 0)
        -- Une pile sans identifiant, sans uid ou à quantité nulle n'est pas une
        -- pile : l'écrire produirait une entrée que le décodeur devrait deviner.
        if (id and uid and id ~= "" and uid ~= "" and q > 0 and not vus[uid]) then
            vus[uid] = true
            piles[#piles + 1] = ("%s:%d:%d:%d:%d:%d:%s"):format(
                id, q,
                math.floor(tonumber(i.gridX) or 0), math.floor(tonumber(i.gridY) or 0),
                math.floor(tonumber(i.gridW) or 1), math.floor(tonumber(i.gridH) or 1),
                uid)
        end
    end

    -- ⚠ ON NE LIT PAS `Narvos.Inventory.EQUIP_SLOTS`. Une premiere version le
    -- faisait, et le defaut est celui qui a deja coute les couleurs ici : si le
    -- module n'est pas charge, la liste est VIDE, l'equipement part efface en
    -- base, et rien ne le signale. Une liste de cles recopiee — ou empruntee —
    -- diverge toujours de sa source.
    --
    -- On lit donc les slots REELLEMENT presents dans l'etat, et on les trie :
    -- `pairs` n'a pas d'ordre garanti, mais `table.sort` en donne un, sans
    -- dependre de quoi que ce soit d'exterieur.
    local noms = {}
    if (type(etat.equipment) == "table") then
        for slot in pairs(etat.equipment) do
            if (type(slot) == "string") then noms[#noms + 1] = slot end
        end
        table.sort(noms)
    end

    -- ⚠ UNE PILE PORTÉE N'EST PLUS DANS LA GRILLE (2026-09-15). Depuis
    -- `Inventory.EquiperDepuisGrille`, équiper RETIRE la pile de la grille. Cet
    -- encodeur n'écrivait que `slot=uid`, et le décodeur ignore un uid absent de la
    -- grille : tout objet équipé DISPARAISSAIT à la reconnexion (rapport du 15/09).
    -- Une pile encore dans la grille garde la référence (`slot=uid`, ancien modèle,
    -- jamais dédoublée) ; une pile hors grille s'écrit ENTIÈRE (`slot=id:q:x:y:w:h:uid`).
    local equipe = {}
    for _, slot in ipairs(noms) do
        local pile = etat.equipment[slot]
        local uid = (type(pile) == "table") and propre(pile.uid) or nil
        local nom = propre(slot)
        if (nom and uid and uid ~= "") then
            local id = propre(pile.itemId)
            local q = math.floor(tonumber(pile.quantity) or 0)
            if (vus[uid]) then
                equipe[#equipe + 1] = nom .. "=" .. uid
            elseif (id and id ~= "" and q > 0) then
                equipe[#equipe + 1] = ("%s=%s:%d:%d:%d:%d:%d:%s"):format(
                    nom, id, q,
                    math.floor(tonumber(pile.gridX) or 0), math.floor(tonumber(pile.gridY) or 0),
                    math.floor(tonumber(pile.gridW) or 1), math.floor(tonumber(pile.gridH) or 1),
                    uid)
            end
        end
    end

    return ("%d,%d;%s;%s"):format(cols, rows, table.concat(piles, "|"),
                                  table.concat(equipe, ","))
end

--- Chaîne → état d'inventaire.
---
--- ⚠ TOLÉRANTE, MAIS PAS DEVINEUSE. Une entrée mal formée est ÉCARTÉE, jamais
--- réparée : un sac à moitié deviné vaut moins qu'un sac amputé qu'on voit.
---@param chaine any
---@return table  { grid = { cols, rows, instances }, equipment = { slot = pile } }
function Roster.DecoderInventaire(chaine)
    local vide = { grid = { cols = 8, rows = 10, instances = {} }, equipment = {} }
    if (type(chaine) ~= "string" or chaine == "") then return vide end

    local tete, corps, equip = chaine:match("^([^;]*);([^;]*);?(.*)$")
    if (not tete) then return vide end

    local cols, rows = tete:match("^(%d+),(%d+)$")
    local grille = {
        cols = tonumber(cols) or 8,
        rows = tonumber(rows) or 10,
        instances = {},
    }

    local par_uid = {}
    for morceau in tostring(corps):gmatch("[^|]+") do
        local id, q, x, y, w, h, uid =
            morceau:match("^([^:]+):(%d+):(%d+):(%d+):(%d+):(%d+):([^:]+)$")
        if (id and uid and not par_uid[uid]) then
            local pile = {
                itemId = id, quantity = tonumber(q) or 1,
                gridX = tonumber(x) or 0, gridY = tonumber(y) or 0,
                gridW = tonumber(w) or 1, gridH = tonumber(h) or 1,
                uid = uid,
            }
            if (pile.quantity > 0) then
                par_uid[uid] = pile
                grille.instances[#grille.instances + 1] = pile
            end
        end
    end

    -- Deux formes (voir l'encodeur) : `slot=uid` pointe une pile de la grille
    -- (ancien modèle) ; `slot=id:q:x:y:w:h:uid` est une pile PORTÉE, hors grille.
    -- Un slot qui référence un uid absent est ignoré : sac corrompu, pas une raison
    -- de lever. Une pile portée dont l'uid est déjà dans la grille est écartée :
    -- elle se dédoublerait.
    local equipement = {}
    for morceau in tostring(equip or ""):gmatch("[^,]+") do
        local slot, valeur = morceau:match("^([%a_]+)=(.+)$")
        if (slot and valeur) then
            local id, q, x, y, w, h, uid =
                valeur:match("^([^:]+):(%d+):(%d+):(%d+):(%d+):(%d+):([^:]+)$")
            if (id and uid) then
                local quantite = tonumber(q) or 1
                if (quantite > 0 and not par_uid[uid]) then
                    local pile = {
                        itemId = id, quantity = quantite,
                        gridX = tonumber(x) or 0, gridY = tonumber(y) or 0,
                        gridW = tonumber(w) or 1, gridH = tonumber(h) or 1,
                        uid = uid,
                    }
                    par_uid[uid] = pile
                    equipement[slot] = pile
                end
            elseif (par_uid[valeur]) then
                equipement[slot] = par_uid[valeur]
            end
        end
    end

    return { grid = grille, equipment = equipement }
end

--- Enregistre le sac d'un personnage.
---
--- ⚠ APPELÉE PAR LE SERVEUR, aux moments qu'IL choisit — déconnexion, changement
--- de map, coffre fermé. Pas à chaque mutation : un joueur qui déplace une pile
--- dans sa grille produirait une écriture par pixel de glissement.
---
--- ⚠ Le `WHERE ... AND compte_id` n'est pas décoratif : sans lui, un identifiant
--- de personnage deviné écrirait dans le sac d'un autre compte.
---@param compte_id any
---@param id any
---@param etat table  { grid, equipment }
---@return boolean, string|nil
function Roster.EnregistrerInventaire(compte_id, id, etat)
    -- La base est l upvalue db (Roster.UtiliserBase). Roster.Base n a jamais
    -- existe : cette ligne rendait "Base indisponible" a CHAQUE appel (2026-09-14).
    if (not db) then return false, "Base indisponible" end
    if (type(id) ~= "string" or id == "") then return false, "Personnage inconnu" end

    local touchees = db:Execute(
        "UPDATE personnages SET inventaire = :0 WHERE id = :1 AND compte_id = :2",
        Roster.EncoderInventaire(etat), id, compte_id)

    -- Vérifier le nombre de lignes touchées, comme partout ailleurs ici : un
    -- UPDATE qui ne touche rien rend 0 et non une erreur. Sans ce test, on
    -- rapporterait un succès sur un personnage supprimé entre-temps.
    if ((tonumber(touchees) or 0) < 1) then
        return false, "Personnage introuvable"
    end
    return true, nil
end

--- Chaîne → table de couleurs.
---
--- Séparée de `DecoderTenue` bien que le format soit identique. Le partage était
--- volontaire et documenté ; il est devenu faux le jour où l'écriture s'est mise
--- à valider et la lecture non. Une couleur corrompue en base ressortait telle
--- quelle et partait vers `HexToColor`, qui rend `nil` — la teinte disparaissait
--- au lieu de retomber sur son défaut.
---@param chaine string|nil
---@return table
function Roster.DecoderCouleurs(chaine)
    local Apparence = requis("Apparence", "Logic/Apparence.lua")
    local brut = Roster.DecoderTenue(chaine)
    return Apparence and Apparence.Couleurs(brut) or brut
end

--- Chaîne → table de tenue. Ne valide pas : c'est le rôle de
--- `Modular.ValiderTenue`, appelé par l'appelant qui sait de quel genre il parle.
---@param chaine string
---@return table
function Roster.DecoderTenue(chaine)
    local tenue = {}
    if (type(chaine) ~= "string" or chaine == "") then return tenue end

    for morceau in chaine:gmatch("[^|]+") do
        local slot, id = morceau:match("^([^:]+):(.+)$")
        if (slot and id) then tenue[slot] = id end
    end
    return tenue
end

-- ── Garde-robe ────────────────────────────────────────────────────────────────
--
-- Encodée dans UN champ texte plutôt que dans une table liée. Une table
-- `personnage_pieces` serait plus orthodoxe, mais elle imposerait une jointure à
-- chaque connexion pour une donnée qu'on lit et qu'on réécrit toujours en bloc.
--
-- Format : `P=slot:piece,slot:piece;O=piece,piece`
--   · `P` — ce qui est PORTÉ, un slot ne pouvant recevoir qu'une pièce
--   · `O` — ce qui est POSSÉDÉ, la liste des achats
--
-- Deux séparateurs différents (`;` entre les sections, `,` dans une section)
-- plutôt que le `|` de `EncoderTenue` : réutiliser le même format inviterait à
-- réutiliser le même décodeur, qui rendrait une table plate là où il en faut
-- deux. La confusion s'est déjà produite entre tenue et couleurs, cf. plus haut.

--- Garde-robe → chaîne.
--- Ordre figé, comme pour la tenue : deux enregistrements du même état doivent
--- produire la même chaîne, sinon rien n'est comparable ni débogable.
---@param garde_robe table|nil
---@return string
function Roster.EncoderGardeRobe(garde_robe)
    if (type(garde_robe) ~= "table") then return "" end

    local portes = {}
    for _, slot in ipairs(Modular.SLOTS) do
        local id = (garde_robe.porte or {})[slot]
        if (type(id) == "string" and id ~= "") then
            portes[#portes + 1] = slot .. ":" .. id
        end
    end

    local possedes = {}
    for id, valeur in pairs(garde_robe.possede or {}) do
        if (valeur == true and type(id) == "string" and id ~= "") then
            possedes[#possedes + 1] = id
        end
    end
    -- `pairs` n'a aucun ordre : sans ce tri la chaîne changerait à chaque
    -- écriture, pour un état identique.
    table.sort(possedes)

    return "P=" .. table.concat(portes, ",") .. ";O=" .. table.concat(possedes, ",")
end

--- Chaîne → garde-robe. Ne valide pas les identifiants : c'est le rôle de
--- `Vestiaire.Porter`, qui seul connaît la morphologie du personnage.
---@param chaine string|nil
---@return table
function Roster.DecoderGardeRobe(chaine)
    local sortie = { possede = {}, porte = {} }
    if (type(chaine) ~= "string" or chaine == "") then return sortie end

    for section in chaine:gmatch("[^;]+") do
        local cle, corps = section:match("^(%a)=(.*)$")
        if (cle == "P") then
            for morceau in corps:gmatch("[^,]+") do
                local slot, id = morceau:match("^([^:]+):(.+)$")
                if (slot and id) then sortie.porte[slot] = id end
            end
        elseif (cle == "O") then
            for id in corps:gmatch("[^,]+") do sortie.possede[id] = true end
        end
    end

    return sortie
end

-- ── Morphologie ───────────────────────────────────────────────────────────────
--
-- Format `curseur:valeur|curseur:valeur`, le même que la tenue. Les valeurs sont
-- des nombres à virgule, arrondis à trois décimales : un curseur d'écran n'a pas
-- une précision supérieure, et écrire `0.60000000000001` en base rendrait deux
-- enregistrements du même réglage différents à l'octet près.
--
-- ⚠ ON N'ÉCRIT QUE CE QUI BOUGE. Sur 138 curseurs, un joueur en touche une
-- poignée : sérialiser les 138 produirait 3 ko par personnage, dont 97 % de
-- zéros. Un curseur absent vaut zéro à la relecture, ce qui est exactement son
-- état au repos.

--- Réglages de morphologie → chaîne.
---@param morphs table|nil
---@return string
function Roster.EncoderMorphs(morphs)
    if (type(morphs) ~= "table") then return "" end

    -- ⚠ LE ZÉRO EST ÉCARTÉ, SAUF POUR LES RÉGLAGES D'APPARENCE. Ne pas écrire
    -- les neutres évite de stocker 138 zéros pour un visage par défaut. Mais un
    -- curseur de silhouette (`#taille`, `#carrure`) est neutre à 0,5 et vaut 0 à
    -- son EXTRÉMITÉ : le rejeter effaçait « le plus petit possible », qui
    -- revenait à la taille moyenne au rechargement. Ils sont deux, les garder
    -- tous ne coûte rien.
    local Apparence = requis("Apparence", "Logic/Apparence.lua")
    local function garder(id, v)
        if (type(id) ~= "string" or type(v) ~= "number") then return false end
        if (Apparence and Apparence.EstReglage(id)) then return true end
        return v ~= 0
    end

    -- Ordre figé : `pairs` n'en garantit aucun, et deux enregistrements du même
    -- visage donneraient deux chaînes différentes — incomparables au débogage.
    local ids = {}
    for id, v in pairs(morphs) do
        if (garder(id, v)) then ids[#ids + 1] = id end
    end
    table.sort(ids)

    local morceaux = {}
    for _, id in ipairs(ids) do
        -- `%.3g` donnerait `0.6` mais aussi `1e-04` pour les petites valeurs, que
        -- `tonumber` relit correctement mais qui se lit mal dans la base.
        morceaux[#morceaux + 1] = id .. ":" .. string.format("%.3f", morphs[id])
    end
    return table.concat(morceaux, "|")
end

--- Chaîne → réglages de morphologie.
--- Ne valide pas les identifiants : c'est le rôle de `Morphs.Resoudre`, qui seul
--- connaît le catalogue et ignore ce qu'il ne reconnaît pas.
---@param chaine string|nil
---@return table
function Roster.DecoderMorphs(chaine)
    local sortie = {}
    if (type(chaine) ~= "string" or chaine == "") then return sortie end

    for morceau in chaine:gmatch("[^|]+") do
        local id, valeur = morceau:match("^([^:]+):(.+)$")
        local n = tonumber(valeur)
        if (id and n) then sortie[id] = n end
    end
    return sortie
end

-- ── Lecture ───────────────────────────────────────────────────────────────────

--- Convertit une ligne de base en fiche personnage.
local function depuisLigne(l)
    if (type(l) ~= "table") then return nil end
    return {
        id      = l.id,
        name    = l.nom,
        classId = l.class_id,
        gender  = l.genre,
        corps   = l.corps,
        loreId  = l.lore_id,
        level   = tonumber(l.niveau) or 1,
        -- XP DANS le niveau courant et rangs de talents (2026-09-13, menu
        -- Compétences). Absents en base (personnage d'avant) = 0 XP, aucun
        -- talent : un état valide. `Logic/Progression.lua` les borne.
        xp      = math.max(0, math.floor(tonumber(l.xp) or 0)),
        talents = Roster.DecoderTalents(l.talents),
        -- `tenue` porte l'APPARENCE figée à la création : visage, coiffure. Le
        -- nom de colonne est resté pour ne pas migrer les bases existantes ;
        -- l'alias `apparence` est celui qu'emploie le reste du code.
        tenue   = Roster.DecoderTenue(l.tenue),
        apparence = Roster.DecoderTenue(l.tenue),
        -- Vêtements : possédés et portés. Séparés de l'apparence parce qu'on
        -- doit pouvoir retirer une pièce sans perdre le fait qu'on l'a payée.
        gardeRobe = Roster.DecoderGardeRobe(l.garde_robe),
        -- Reglages de morphologie. Vides pour tout corps sans morph target,
        -- c'est-a-dire tous sauf `base_morphable`.
        morphs = Roster.DecoderMorphs(l.morphs),
        credits = tonumber(l.credits) or 0,
        -- Le sac. Absent en base (personnage d'avant le 2026-09-06) = sac vide,
        -- pas une erreur : `DecoderInventaire` rend une grille neuve.
        inventaire = Roster.DecoderInventaire(l.inventaire),
        -- La progression des metiers. Absente en base (personnage d'avant le
        -- 2026-09-12) = aucun metier pratique : table VIDE, que le serveur
        -- complete au niveau 1. `SELECT *` la ramene sans toucher aux requetes.
        metiers = Roster.DecoderMetiers(l.metiers),
        colors  = Roster.DecoderCouleurs(l.couleurs),
        -- Apparence du Meta Customization System : la LIGNE encodee, telle quelle.
        -- Le decodage et la normalisation vivent dans Logic/MetaCustom.lua, qui
        -- connait le catalogue ; le roster ne fait que transporter.
        metacustom = type(l.metacustom) == "string" and l.metacustom or "",
        metacustomEmplacements = type(l.metacustom_emplacements) == "string" and l.metacustom_emplacements or "",
        -- La cité choisie au départ (id de monde), nil si jamais choisie. Le
        -- roster TRANSPORTE : c'est Logic/Depart.lua qui dit si elle est recevable.
        cite    = Roster.CiteValide(l.cite),
        zaap    = Roster.ZaapValide(l.zaap),
        compte  = l.compte_id,
        createdAt = tonumber(l.cree_le) or 0,
    }
end

--- Personnages d'un compte, du plus ancien au plus récent.
---@param compte_id integer
---@return table[]
function Roster.ParCompte(compte_id)
    if (not db or compte_id == nil) then return {} end

    local lignes = db:Select(
        "SELECT * FROM personnages WHERE compte_id = :0 ORDER BY cree_le ASC", compte_id)

    local sortie = {}
    for _, l in ipairs(lignes or {}) do
        sortie[#sortie + 1] = depuisLigne(l)
    end
    return sortie
end

--- Un personnage par son identifiant.
---@param id string
---@return table|nil
function Roster.Trouver(id)
    if (not db or type(id) ~= "string" or id == "") then return nil end
    local lignes = db:Select("SELECT * FROM personnages WHERE id = :0", id)
    return depuisLigne(lignes and lignes[1])
end

--- Le nom est-il déjà porté, tous comptes confondus ?
--- L'index `idx_perso_nom` l'impose aussi côté base : cette fonction sert à
--- répondre proprement au joueur, pas à garantir l'unicité.
---@param nom string
---@return boolean
function Roster.NomPris(nom)
    if (not db or type(nom) ~= "string") then return false end
    local lignes = db:Select(
        "SELECT id FROM personnages WHERE nom = :0 COLLATE NOCASE", (nom:gsub("^%s+", ""):gsub("%s+$", "")))
    return (lignes ~= nil) and (#lignes > 0)
end

--- Combien de personnages ce compte possède-t-il ?
---@param compte_id integer
---@return integer
function Roster.Compter(compte_id)
    return #Roster.ParCompte(compte_id)
end

-- ── Écriture ──────────────────────────────────────────────────────────────────

--- Crée et enregistre un personnage pour un compte.
---
--- `params` est celui de `Creation.Construire` : nom, class_id, genre, tenue.
--- Toute la validation vient de là — ce fichier n'en réimplémente aucune, sinon
--- les deux chemins divergeraient à la première évolution des règles.
---@param compte_id integer
---@param params table
---@return table|nil perso
---@return string|nil raison
function Roster.Creer(compte_id, params)
    if (not db) then return nil, "Base indisponible" end
    if (compte_id == nil) then return nil, "Compte inconnu" end

    if (Roster.Compter(compte_id) >= Roster.MAX_PAR_COMPTE) then
        return nil, "Maximum de " .. Roster.MAX_PAR_COMPTE .. " personnages atteint"
    end

    local perso, raison = Creation.Construire(params)
    if (not perso) then return nil, raison end
    -- Apparence du Meta Customization System : DEJA normalisee et encodee par la
    -- session (qui a le catalogue). `Construire` ne la connait pas.
    perso.metacustom = type(params.metacustom) == "string" and params.metacustom or ""

    -- ⚠ Vérifier le nom APRÈS la construction : `Construire` rogne le nom, et
    -- tester la chaîne brute laisserait passer « Aniss » face à un « aniss  »
    -- déjà enregistré.
    if (Roster.NomPris(perso.name)) then
        return nil, "Ce nom est deja pris"
    end

    -- AUCUNE tenue offerte (règle de Hanibes, 2026-10-03) : la garde-robe naît
    -- vide, la bourse de départ sert à acheter sa tenue à un PNJ. Le corps
    -- reste visible : il vient de `perso.tenue` (l'apparence), pas d'ici.
    perso.gardeRobe = Vestiaire().Nouvelle()
    perso.credits = Roster.CREDITS_DEPART

    local touchees = db:Execute(
        "INSERT INTO personnages (id, compte_id, nom, class_id, genre, lore_id, corps, niveau, tenue, garde_robe, morphs, credits, couleurs, inventaire, cree_le, metacustom) " ..
        "VALUES (:0, :1, :2, :3, :4, :5, :6, :7, :8, :9, :10, :11, :12, :13, :14, :15)",
        perso.id, compte_id, perso.name, perso.classId, perso.gender, perso.loreId, perso.corps,
        perso.level, Roster.EncoderTenue(perso.tenue),
        Roster.EncoderGardeRobe(perso.gardeRobe), Roster.EncoderMorphs(perso.morphs),
        perso.credits,
        Roster.EncoderCouleurs(perso.colors),
        -- Un personnage neuf a un sac vide, pas nil : `DecoderInventaire("")`
        -- rend une grille aux dimensions par defaut, ce qui evite au reste du
        -- code d'avoir a distinguer « jamais sauvegarde » de « vide ».
        Roster.EncoderInventaire(perso.inventaire),
        perso.createdAt,
        -- Deja NORMALISEE et encodee par l'appelant (Session) : le roster ne
        -- connait pas le catalogue du Meta Customization System.
        type(perso.metacustom) == "string" and perso.metacustom or "")

    -- ⚠ VÉRIFIER que la ligne est bien écrite. `db:Execute` rend le nombre de
    -- lignes touchées : l'ignorer rapportait un succès sur un INSERT refusé
    -- (nom déjà pris gagné par une écriture concurrente, contrainte violée,
    -- base pleine). Le joueur voyait son personnage créé, puis disparu au
    -- rechargement. Trouvé par audit le 2026-09-03.
    if ((tonumber(touchees) or 0) < 1) then
        return nil, "Enregistrement impossible"
    end

    perso.compte = compte_id
    return perso, nil
end

--- Supprime un personnage.
---
--- ⚠ LE `compte_id` DANS LE `WHERE` N'EST PAS DÉCORATIF. L'identifiant du
--- personnage vient du client : sans cette condition, n'importe quel joueur
--- effacerait le personnage d'un autre en envoyant son id. La base refuse
--- l'opération plutôt que de faire confiance à l'appelant.
---@param compte_id integer
---@param id string
---@return boolean, string|nil
function Roster.Supprimer(compte_id, id)
    if (not db) then return false, "Base indisponible" end
    if (compte_id == nil or type(id) ~= "string" or id == "") then
        return false, "Personnage inconnu"
    end

    local touchees = db:Execute(
        "DELETE FROM personnages WHERE id = :0 AND compte_id = :1", id, compte_id)

    if ((tonumber(touchees) or 0) < 1) then
        -- Même message que « inexistant » : distinguer « pas à vous » de « n'existe
        -- pas » dirait à un curieux quels identifiants sont valides.
        return false, "Personnage introuvable"
    end
    return true, nil
end

--- Ce personnage appartient-il bien à ce compte ?
--- À appeler avant TOUTE action déclenchée par le client sur un personnage —
--- entrée en jeu comprise.
---@param compte_id integer
---@param id string
---@return boolean
function Roster.Appartient(compte_id, id)
    local perso = Roster.Trouver(id)
    return perso ~= nil and perso.compte == compte_id
end

--- Enregistre les réglages de morphologie d'un personnage.
---
--- ⚠ LE `compte_id` DANS LE `WHERE` N'EST PAS DÉCORATIF. L'identifiant du
--- personnage vient du client : sans cette condition, n'importe quel joueur
--- referait le visage de n'importe qui d'autre.
---@param compte_id integer
---@param id string
---@param morphs table
---@return boolean, string|nil
function Roster.MajMorphs(compte_id, id, morphs)
    if (not db) then return false, "Base indisponible" end
    if (compte_id == nil or type(id) ~= "string" or id == "") then
        return false, "Personnage inconnu"
    end
    if (type(morphs) ~= "table") then return false, "Morphologie invalide" end

    local touchees = db:Execute(
        "UPDATE personnages SET morphs = :0 WHERE id = :1 AND compte_id = :2",
        Roster.EncoderMorphs(morphs), id, compte_id)

    if ((tonumber(touchees) or 0) < 1) then
        return false, "Personnage introuvable"
    end
    return true, nil
end

--- Enregistre l'apparence du Meta Customization System, et optionnellement ses
--- 18 emplacements. Les deux lignes arrivent DEJA encodees (Logic/MetaCustom.lua).
---
--- ⚠ Même garde que `MajMorphs` : le `compte_id` dans le `WHERE` empêche un joueur
--- de réécrire l'apparence du personnage d'un autre.
---@param compte_id integer
---@param id string
---@param ligne string
---@param emplacements string|nil
---@return boolean, string|nil
function Roster.MajMetaCustom(compte_id, id, ligne, emplacements)
    if (not db) then return false, "Base indisponible" end
    if (compte_id == nil or type(id) ~= "string" or id == "") then
        return false, "Personnage inconnu"
    end
    if (type(ligne) ~= "string") then return false, "Apparence invalide" end
    local touchees
    if (type(emplacements) == "string") then
        touchees = db:Execute(
            "UPDATE personnages SET metacustom = :0, metacustom_emplacements = :1 WHERE id = :2 AND compte_id = :3",
            ligne, emplacements, id, compte_id)
    else
        touchees = db:Execute(
            "UPDATE personnages SET metacustom = :0 WHERE id = :1 AND compte_id = :2",
            ligne, id, compte_id)
    end
    if ((tonumber(touchees) or 0) < 1) then
        return false, "Personnage introuvable"
    end
    return true, nil
end

--- Enregistre la garde-robe ET les crédits d'un personnage.
---
--- ⚠ LE `compte_id` DANS LE `WHERE` N'EST PAS DÉCORATIF. L'identifiant du
--- personnage vient du client : sans cette condition, n'importe quel joueur
--- rhabillerait — ou ruinerait — le personnage d'un autre en envoyant son id.
---
--- Les deux valeurs partent dans le MÊME UPDATE. Séparées, un achat pourrait
--- débiter les crédits sans livrer la pièce, ou l'inverse, si la seconde requête
--- échouait.
---@param compte_id integer
---@param id string
---@param garde_robe table
---@param credits integer
---@return boolean, string|nil
function Roster.MajGardeRobe(compte_id, id, garde_robe, credits)
    if (not db) then return false, "Base indisponible" end
    if (compte_id == nil or type(id) ~= "string" or id == "") then
        return false, "Personnage inconnu"
    end
    if (type(garde_robe) ~= "table") then return false, "Garde-robe invalide" end

    -- Un solde négatif signalerait un calcul faux en amont. On refuse plutôt que
    -- d'écrire : une base cohérente vaut mieux qu'un joueur endetté.
    local solde = tonumber(credits)
    if (not solde or solde < 0) then return false, "Credits invalides" end

    local touchees = db:Execute(
        "UPDATE personnages SET garde_robe = :0, credits = :1 WHERE id = :2 AND compte_id = :3",
        Roster.EncoderGardeRobe(garde_robe), math.floor(solde), id, compte_id)

    if ((tonumber(touchees) or 0) < 1) then
        return false, "Personnage introuvable"
    end
    return true, nil
end

--- Met à jour le solde de crédits d'un personnage, seul.
---
--- Ajoutée pour la boutique des marchands (tâche « les marchands », 2026-09-08) :
--- un achat débite la bourse sans toucher la garde-robe, et `MajGardeRobe`
--- exige les deux. Même garde que là-bas : un solde négatif signale un calcul
--- faux en amont, on refuse plutôt que d'écrire.
---@param compte_id integer
---@param id string
---@param credits integer
---@return boolean, string|nil
function Roster.MajCredits(compte_id, id, credits)
    if (not db) then return false, "Base indisponible" end
    if (compte_id == nil or type(id) ~= "string" or id == "") then
        return false, "Personnage inconnu"
    end

    local solde = tonumber(credits)
    if (not solde or solde < 0) then return false, "Credits invalides" end

    local touchees = db:Execute(
        "UPDATE personnages SET credits = :0 WHERE id = :1 AND compte_id = :2",
        math.floor(solde), id, compte_id)

    if ((tonumber(touchees) or 0) < 1) then
        return false, "Personnage introuvable"
    end
    return true, nil
end

--- Met à jour la tenue d'un personnage.
---@param compte_id integer
---@param id string
---@param tenue table
---@return boolean, string|nil
function Roster.MajTenue(compte_id, id, tenue)
    if (not db) then return false, "Base indisponible" end

    local perso = Roster.Trouver(id)
    if (not perso or perso.compte ~= compte_id) then
        return false, "Personnage introuvable"
    end

    -- La famille vient du CORPS du personnage, pas d'un argument : c'est ce qui
    -- empêche un client de faire accepter un vêtement d'une autre morphologie
    -- en mentant sur la famille.
    local corps = Modular.Corps(perso.corps)
    local ok, raison = Modular.ValiderTenue(tenue, perso.gender, corps and corps.famille or nil)
    if (not ok) then return false, raison end

    db:Execute("UPDATE personnages SET tenue = :0 WHERE id = :1 AND compte_id = :2",
               Roster.EncoderTenue(tenue), id, compte_id)
    return true, nil
end

-- ══════════════════════════════════════════════════════════════════════════════
-- COMPAGNONS — l'état de `Logic/Animaux.lua`, encodé pour la colonne `animaux`.
--
-- Format : `especeId:surnom:xp:niveau|…;actif`
--
-- ⚠ LE SURNOM EST DU TEXTE ÉCRIT PAR LE JOUEUR. Contrairement à un identifiant
-- de catalogue, on ne peut pas le REFUSER quand il porte un séparateur : ce
-- serait refuser « Rex:2 » sans que le joueur comprenne pourquoi. On le NETTOIE,
-- et on borne sa longueur — un surnom de 4 000 caractères ferait une ligne de
-- base illisible et une infobulle qui déborde l'écran.
-- ══════════════════════════════════════════════════════════════════════════════

Roster.SURNOM_MAX = 24

--- Nettoie un surnom : séparateurs retirés, espaces réduits, longueur bornée.
--- Rend toujours une chaîne — jamais nil : un compagnon sans nom s'appelle par
--- son espèce, ce que l'appelant décide.
function Roster.NettoyerSurnom(v)
    local t = tostring(v or "")
    t = t:gsub("[;|:,=]", " ")          -- les séparateurs du format
    t = t:gsub("%c", " ")                -- retours ligne, tabulations
    t = t:gsub("%s+", " "):gsub("^%s*(.-)%s*$", "%1")
    if (#t > Roster.SURNOM_MAX) then t = t:sub(1, Roster.SURNOM_MAX) end
    return t
end

--- État de compagnons → chaîne.
function Roster.EncoderAnimaux(etat)
    if (type(etat) ~= "table") then return "" end
    local morceaux, vus = {}, {}
    for _, p in ipairs(etat.possedes or {}) do
        local id = propre(p.id)
        -- Un compagnon sans espèce, ou vu deux fois, n'est pas un compagnon :
        -- l'écrire produirait une entrée que le décodeur devrait deviner.
        if (id and id ~= "" and not vus[id]) then
            vus[id] = true
            morceaux[#morceaux + 1] = ("%s:%s:%d:%d"):format(
                id,
                Roster.NettoyerSurnom(p.surnom),
                math.max(0, math.floor(tonumber(p.xp) or 0)),
                math.max(1, math.floor(tonumber(p.niveau) or 1)))
        end
    end
    -- ⚠ Un compagnon actif qui n'est pas possédé ne s'écrit PAS. Sans ce test,
    -- une désynchronisation en mémoire deviendrait durable en base, et le
    -- chargement rendrait un `compagnon_actif` introuvable — le genre d'état
    -- qui fait planter un exécutant six semaines plus tard.
    local actif = propre(etat.compagnon_actif)
    if (not actif or not vus[actif]) then actif = "" end
    return table.concat(morceaux, "|") .. ";" .. actif
end

--- Chaîne → état de compagnons. Une chaîne vide, nil, ou illisible rend l'état
--- VIDE : un personnage sans compagnon est un cas normal, pas une erreur.
function Roster.DecoderAnimaux(chaine)
    local vide = { possedes = {}, compagnon_actif = nil }
    if (type(chaine) ~= "string" or chaine == "") then return vide end

    local corps, actif = chaine:match("^([^;]*);?(.*)$")
    if (not corps) then return vide end

    local etat = { possedes = {}, compagnon_actif = nil }
    local vus = {}
    for morceau in corps:gmatch("[^|]+") do
        local id, surnom, xp, niveau = morceau:match("^([^:]*):([^:]*):(%d+):(%d+)$")
        if (id and id ~= "" and not vus[id]) then
            vus[id] = true
            etat.possedes[#etat.possedes + 1] = {
                id = id,
                surnom = surnom,
                xp = tonumber(xp) or 0,
                niveau = math.max(1, tonumber(niveau) or 1),
            }
        end
    end

    -- Le même test qu'à l'écriture, côté lecture : une base éditée à la main
    -- ou écrite par une version antérieure ne doit pas produire un actif
    -- fantôme.
    if (actif and actif ~= "" and vus[actif]) then etat.compagnon_actif = actif end
    return etat
end

--- Forme d'un identifiant de cité : une clé de catalogue (`capitale`, `foret`),
--- jamais du texte libre. Rend la clé, ou nil.
---@param cite any
---@return string|nil
function Roster.CiteValide(cite)
    if (type(cite) ~= "string" or #cite == 0 or #cite > 40) then return nil end
    if (not cite:match("^[%w_]+$")) then return nil end
    return cite
end

--- Persiste la cité de départ d'un personnage (2026-09-15).
---
--- ⚠ L'APPELANT A DÉJÀ VALIDÉ LE MONDE (`Depart.Retenu`) : ici on ne vérifie que
--- la FORME, pour qu'aucune chaîne venue du client n'atteigne la base telle quelle.
---@param compte_id integer
---@param id string
---@param cite string
---@return boolean, string|nil
function Roster.EnregistrerCite(compte_id, id, cite)
    if (not db) then return false, "Base indisponible" end
    if (type(id) ~= "string" or id == "") then return false, "Personnage inconnu" end
    local propre = Roster.CiteValide(cite)
    if (not propre) then return false, "Cite invalide" end

    local touchees = db:Execute(
        "UPDATE personnages SET cite = :0 WHERE id = :1 AND compte_id = :2",
        propre, id, compte_id)
    if ((tonumber(touchees) or 0) < 1) then
        return false, "Personnage introuvable"
    end
    return true, nil
end

--- Forme d'un identifiant de Zaap : même forme qu'une cité (clé de catalogue,
--- `Logic/Zaaps.lua` borne ses identifiants à la même longueur). Rend la clé, ou nil.
---@param zaap any
---@return string|nil
function Roster.ZaapValide(zaap)
    return Roster.CiteValide(zaap)
end

--- Persiste le dernier Zaap activé d'un personnage (2026-09-15, D4).
---
--- ⚠ L'APPELANT A DÉJÀ VÉRIFIÉ QUE LE ZAAP EXISTE ET QUE LE JOUEUR EST À CÔTÉ
--- (Server/Zaaps.lua) : ici on ne vérifie que la FORME, pour qu'aucune chaîne
--- venue du client n'atteigne la base telle quelle.
---@param compte_id integer
---@param id string
---@param zaap string
---@return boolean, string|nil
function Roster.EnregistrerZaap(compte_id, id, zaap)
    if (not db) then return false, "Base indisponible" end
    if (type(id) ~= "string" or id == "") then return false, "Personnage inconnu" end
    local propre = Roster.ZaapValide(zaap)
    if (not propre) then return false, "Zaap invalide" end

    local touchees = db:Execute(
        "UPDATE personnages SET zaap = :0 WHERE id = :1 AND compte_id = :2",
        propre, id, compte_id)
    if ((tonumber(touchees) or 0) < 1) then
        return false, "Personnage introuvable"
    end
    return true, nil
end

--- Persiste les compagnons d'un personnage.
function Roster.EnregistrerAnimaux(compte_id, id, etat)
    -- La base est l upvalue db (Roster.UtiliserBase). Roster.Base n a jamais
    -- existe : cette ligne rendait "Base indisponible" a CHAQUE appel (2026-09-14).
    if (not db) then return false, "Base indisponible" end
    if (type(id) ~= "string" or id == "") then return false, "Personnage inconnu" end

    local touchees = db:Execute(
        "UPDATE personnages SET animaux = :0 WHERE id = :1 AND compte_id = :2",
        Roster.EncoderAnimaux(etat), id, compte_id)

    -- Un UPDATE qui ne touche rien rend 0, pas une erreur : sans ce test on
    -- rapporterait un succès sur un personnage supprimé entre-temps.
    if ((tonumber(touchees) or 0) < 1) then
        return false, "Personnage introuvable"
    end
    return true, nil
end

-- ══════════════════════════════════════════════════════════════════════════════
-- MÉTIERS — l'état de `Logic/Metiers.lua`, encodé pour la colonne `metiers`.
--
-- Format : `metier:niveau:xp|…`
--
-- Même patron que les compagnons, une différence de nature : l'identifiant de
-- métier est une CLÉ DE CATALOGUE, pas du texte écrit par le joueur. Une clé qui
-- porte un séparateur n'est donc pas « nettoyée » mais REFUSÉE — la nettoyer
-- fabriquerait un métier qui n'existe pas.
-- ══════════════════════════════════════════════════════════════════════════════

--- État de métiers → chaîne. Ordre stable (tri par identifiant) : deux
--- sauvegardes du même état doivent produire la même ligne, sinon chaque écriture
--- ressemble à une modification.
function Roster.EncoderMetiers(etat)
    if (type(etat) ~= "table") then return "" end
    local ids = {}
    for id, p in pairs(etat) do
        if (type(id) == "string" and id ~= "" and not id:find("[:|;]") and type(p) == "table") then
            ids[#ids + 1] = id
        end
    end
    table.sort(ids)

    local morceaux = {}
    for _, id in ipairs(ids) do
        local p = etat[id]
        morceaux[#morceaux + 1] = ("%s:%d:%d"):format(
            id,
            math.max(1, math.floor(tonumber(p.niveau) or 1)),
            math.max(0, math.floor(tonumber(p.xp) or 0)))
    end
    return table.concat(morceaux, "|")
end

--- Chaîne → état de métiers. Vide, nil ou illisible rend un état VIDE : un
--- personnage qui n'a jamais pratiqué est un cas normal. L'appelant complète avec
--- `MetiersLogique.EtatNeuf` pour les métiers absents.
function Roster.DecoderMetiers(chaine)
    local etat = {}
    if (type(chaine) ~= "string" or chaine == "") then return etat end
    for morceau in chaine:gmatch("[^|]+") do
        local id, niveau, xp = morceau:match("^([^:]+):(%d+):(%d+)$")
        -- Un doublon garde la PREMIÈRE occurrence : une base éditée à la main ne
        -- doit pas faire gagner des niveaux en répétant une ligne.
        if (id and etat[id] == nil) then
            etat[id] = {
                niveau = math.max(1, tonumber(niveau) or 1),
                xp = math.max(0, tonumber(xp) or 0),
            }
        end
    end
    return etat
end

-- ══════════════════════════════════════════════════════════════════════════════
-- PROGRESSION DU PERSONNAGE — niveau, XP, talents (2026-09-13).
--
-- Colonnes `niveau` (existante), `xp` et `talents`. Format des talents :
-- `talent:rang|…`, trié. Même règle que les métiers : un identifiant est une CLÉ
-- DE CATALOGUE, un séparateur le fait REFUSER plutôt que nettoyer. Le rang
-- maximal et l'existence du talent ne sont PAS jugés ici : c'est
-- `Progression.TalentsValides`, qui connaît l'arbre.
-- ══════════════════════════════════════════════════════════════════════════════

--- Rangs de talents → chaîne. Rang nul ou négatif omis : un talent sans rang
--- n'est pas investi, l'écrire ferait deux lignes différentes du même état.
function Roster.EncoderTalents(talents)
    if (type(talents) ~= "table") then return "" end
    local ids = {}
    for id, rang in pairs(talents) do
        if (type(id) == "string" and id ~= "" and not id:find("[:|;]")
            and math.floor(tonumber(rang) or 0) > 0) then
            ids[#ids + 1] = id
        end
    end
    table.sort(ids)
    local morceaux = {}
    for _, id in ipairs(ids) do
        morceaux[#morceaux + 1] = ("%s:%d"):format(id, math.floor(tonumber(talents[id])))
    end
    return table.concat(morceaux, "|")
end

--- Chaîne → rangs de talents. Illisible ou vide rend une table VIDE ; un
--- doublon garde la PREMIÈRE occurrence (répéter une ligne ne donne pas de rang).
function Roster.DecoderTalents(chaine)
    local talents = {}
    if (type(chaine) ~= "string" or chaine == "") then return talents end
    for morceau in chaine:gmatch("[^|]+") do
        local id, rang = morceau:match("^([^:]+):(%d+)$")
        local n = tonumber(rang)
        if (id and n and n > 0 and talents[id] == nil) then talents[id] = n end
    end
    return talents
end

--- Persiste niveau, XP et talents d'un personnage, en UNE requête : un niveau
--- écrit sans son XP (ou l'inverse) laisserait en base un état que le jeu n'a
--- jamais eu.
function Roster.EnregistrerProgression(compte_id, id, niveau, xp, talents)
    -- La base est l upvalue db (Roster.UtiliserBase). Roster.Base n a jamais
    -- existe : cette ligne rendait "Base indisponible" a CHAQUE appel (2026-09-14).
    if (not db) then return false, "Base indisponible" end
    if (type(id) ~= "string" or id == "") then return false, "Personnage inconnu" end

    local touchees = db:Execute(
        "UPDATE personnages SET niveau = :0, xp = :1, talents = :2 WHERE id = :3 AND compte_id = :4",
        math.max(1, math.floor(tonumber(niveau) or 1)),
        math.max(0, math.floor(tonumber(xp) or 0)),
        Roster.EncoderTalents(talents), id, compte_id)

    if ((tonumber(touchees) or 0) < 1) then
        return false, "Personnage introuvable"
    end
    return true, nil
end

--- Persiste les métiers d'un personnage.
function Roster.EnregistrerMetiers(compte_id, id, etat)
    -- La base est l upvalue db (Roster.UtiliserBase). Roster.Base n a jamais
    -- existe : cette ligne rendait "Base indisponible" a CHAQUE appel (2026-09-14).
    if (not db) then return false, "Base indisponible" end
    if (type(id) ~= "string" or id == "") then return false, "Personnage inconnu" end

    local touchees = db:Execute(
        "UPDATE personnages SET metiers = :0 WHERE id = :1 AND compte_id = :2",
        Roster.EncoderMetiers(etat), id, compte_id)

    -- Un UPDATE qui ne touche rien rend 0, pas une erreur : sans ce test on
    -- rapporterait un succès sur un personnage supprimé entre-temps.
    if ((tonumber(touchees) or 0) < 1) then
        return false, "Personnage introuvable"
    end
    return true, nil
end

return Roster
