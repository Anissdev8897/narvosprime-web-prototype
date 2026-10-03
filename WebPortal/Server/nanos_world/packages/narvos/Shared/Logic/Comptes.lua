-- ═══════════════════════════════════════════════════════════════════════════════
-- Shared/Logic/Comptes.lua — comptes joueurs, stockés en base SQL.
--
-- Câblage : Narvos.Comptes = Package.Require("Logic/Comptes.lua")
--
-- ── POURQUOI UNE BASE ET PAS PersistentData ────────────────────────────────────
-- `Package.SetPersistentData` écrit un TOML dans le dossier du package : parfait
-- pour un roster de test, inutilisable pour des comptes. Une base SQL se
-- sauvegarde, se migre vers un VPS, et se requête sans tout charger en mémoire.
--
-- nanos accepte SQLite, MySQL 8.1 et PostgreSQL 17.5. Le passage au VPS ne
-- change QUE la ligne du constructeur : le reste du fichier est du SQL portable.
--
-- ── DEUX CHEMINS D'AUTHENTIFICATION ────────────────────────────────────────────
-- 1. STEAM — nanos donne déjà `steam_id` à la connexion. Aucun mot de passe
--    n'existe, donc rien à voler. C'est le chemin normal.
-- 2. IDENTIFIANT + MOT DE PASSE — repli pour les joueurs hors Steam et les
--    comptes de test. Le mot de passe n'est JAMAIS stocké : seul un PBKDF2 l'est,
--    avec son sel et son nombre d'itérations.
--
-- Une ligne de `comptes` porte l'un OU l'autre : `steam_id` et `identifiant` sont
-- tous deux nullables, et `CHECK` impose qu'au moins un soit présent.
--
-- ── ⚠ CE QUI RESTE FAIBLE, ET QU'IL FAUDRA CORRIGER AVANT L'OUVERTURE ─────────
-- · `math.random` n'est PAS un générateur cryptographique. Le sel qu'il produit
--   est prévisible pour qui connaît la graine. Acceptable en développement local ;
--   à remplacer par une source réelle (service HTTP, ou sel fourni par le VPS)
--   avant d'exposer le serveur.
-- · PBKDF2 n'est pas bcrypt : voir l'avertissement en tête de Logic/Crypto.lua.
-- · Aucune limitation de débit sur les tentatives. À ajouter avant l'ouverture,
--   sinon une attaque par dictionnaire est gratuite.
--
-- ── INJECTION SQL ──────────────────────────────────────────────────────────────
-- TOUTES les requêtes passent par les placeholders `:0`, `:1`… de nanos. Aucune
-- valeur venant du joueur n'est concaténée dans une chaîne SQL, jamais, même
-- « juste pour un nom ». C'est la seule règle non négociable de ce fichier.
-- ═══════════════════════════════════════════════════════════════════════════════

---@class NarvosComptes
local Comptes = {}

local Crypto = (Narvos and Narvos.Crypto) or Package.Require("Logic/Crypto.lua")

--- Coût du PBKDF2, enregistré PAR COMPTE pour pouvoir l'augmenter plus tard sans
--- invalider les comptes existants : la vérification relit la valeur stockée.
---
--- ⚠ 1000, ET PAS LES 120 000 RECOMMANDÉS POUR PBKDF2. Ce n'est pas un oubli.
--- MESURÉ le 2026-09-03 sous wasmoon (Lua 5.4, le même que nanos) :
--- **240 µs par itération** en Lua pur. Donc 120 000 itérations = **29 secondes**
--- de thread principal bloqué. À 30 Hz, ça gèle le serveur pour TOUS les joueurs
--- pendant une demi-minute à chaque connexion. Même 10 000 coûterait 2,4 s.
---
--- À 1000, une connexion coûte ~0,25 s ici, probablement moins dans le Lua natif
--- de nanos. C'est le plafond praticable — et il faut savoir ce qu'on y perd :
--- un attaquant qui vole la base teste ~1000 mots de passe/seconde/cœur en C,
--- contre ~5 avec bcrypt à coût 12. Soit environ 200 fois plus faible.
---
--- CE QUI CORRIGE VRAIMENT LE PROBLÈME, le jour du VPS : déporter la
--- vérification vers un service HTTP (nanos expose la classe `HTTP`, asynchrone)
--- qui fait du bcrypt ou de l'Argon2 en natif. Le coût disparaît du tick, et le
--- facteur de travail redevient sérieux. `Comptes.Hacher` est isolée exprès pour
--- que ce remplacement ne touche qu'elle.
---
--- En attendant : le chemin Steam ne fait AUCUN hachage. Le mot de passe reste
--- le repli, pour les comptes de test et les joueurs hors Steam.
Comptes.ITERATIONS = 1000

Comptes.IDENT_MIN = 3
Comptes.IDENT_MAX = 24
Comptes.MDP_MIN = 8

-- Fichier par défaut. Sur le VPS, seule cette valeur et le moteur changent.
Comptes.FICHIER = "narvos_comptes.db"

local db = nil

-- ── Connexion ─────────────────────────────────────────────────────────────────

--- Ouvre la base et crée le schéma s'il manque.
--- Rend `false` hors moteur (harnais de test) plutôt que de lever : le reste du
--- module doit rester chargeable sans nanos.
---@param chemin string|nil
---@return boolean
function Comptes.Ouvrir(chemin)
    if (Database == nil or DatabaseEngine == nil) then return false end

    -- `timeout` évite qu'une écriture concurrente rende une erreur immédiate :
    -- SQLite verrouille le fichier entier en écriture.
    db = Database(DatabaseEngine.SQLite, "db=" .. (chemin or Comptes.FICHIER) .. " timeout=5")

    -- La doc est explicite : en cas d'échec de connexion, le constructeur rend
    -- `nil` après avoir écrit dans la console. Ne pas tester ici ferait planter
    -- la première requête, loin de la cause.
    if (db == nil) then return false end

    db:Execute([[
        CREATE TABLE IF NOT EXISTS comptes (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            steam_id     TEXT    UNIQUE,
            identifiant  TEXT    UNIQUE,
            hash         TEXT,
            sel          TEXT,
            iterations   INTEGER,
            pseudo       TEXT    NOT NULL,
            cree_le      INTEGER NOT NULL,
            vu_le        INTEGER,
            CHECK (steam_id IS NOT NULL OR identifiant IS NOT NULL)
        )
    ]])

    -- Le roster vit dans la même base que les comptes : un personnage sans compte
    -- n'a aucun sens, et `ON DELETE CASCADE` garantit qu'il n'en reste jamais.
    db:Execute([[
        CREATE TABLE IF NOT EXISTS personnages (
            id         TEXT    PRIMARY KEY,
            compte_id  INTEGER NOT NULL,
            nom        TEXT    NOT NULL,
            class_id   TEXT    NOT NULL,
            genre      TEXT    NOT NULL,
            -- Classe de LORE choisie (PlayerClass). `class_id` reste la classe
            -- de jeu reellement validee ; les deux coexistent tant que les 12
            -- classes de lore n'ont pas leurs propres statistiques.
            lore_id    TEXT,
            -- Corps de base choisi (Modular.CORPS). Il fixe la morphologie, donc
            -- quelles pièces le personnage peut porter.
            corps      TEXT,
            niveau     INTEGER NOT NULL DEFAULT 1,
            -- XP DANS le niveau courant et rangs de talents `talent:rang|…`
            -- (2026-09-13, menu Compétences) : `Roster.EnregistrerProgression`.
            xp         INTEGER NOT NULL DEFAULT 0,
            talents    TEXT,
            -- `tenue` porte desormais l'APPARENCE choisie a la creation : visage
            -- et coiffure. Les vetements ont demenage dans `garde_robe`, parce
            -- qu'ils ne se choisissent plus a la creation mais s'achetent.
            tenue      TEXT,
            -- ── L'INVENTAIRE, AJOUTE LE 2026-09-06 ────────────────────────
            -- Il ne l'etait PAS. `Inventory.lua` fait 1 021 lignes et ne touchait
            -- aucune base : le sac d'un joueur etait vide a chaque deconnexion.
            -- Rien ne le signalait — l'inventaire se recreait, simplement vide.
            --
            -- ⚠ Consequence qui depasse le confort : sans cette colonne, le craft
            -- et la recolte n'ont aucun sens. Fabriquer un objet qui disparait a
            -- la deconnexion n'est pas un systeme, c'est une demonstration.
            inventaire TEXT,
            -- Compagnons possedes, leur surnom, leur XP, et lequel est actif.
            -- Encode par `Roster.EncoderAnimaux`. NULL = aucun compagnon, ce
            -- qui est un etat valide et non une absence de donnee.
            animaux    TEXT,
            -- Progression des METIERS (2026-09-12) : `metier:niveau:xp|...`,
            -- encodee par `Roster.EncoderMetiers`. NULL = aucun metier pratique,
            -- tous au niveau 1 — un etat valide, pas une absence de donnee.
            metiers    TEXT,
            -- Ce que le personnage POSSEDE et PORTE cote modulaire, encode par
            -- Vestiaire. Distinct de `tenue` : on doit pouvoir retirer un
            -- vetement sans perdre le fait qu'on l'a paye.
            garde_robe TEXT,
            -- Reglages de morphologie du corps morphable : `curseur:valeur|…`.
            -- Vide pour les corps qui n'ont pas de morph target, c'est-a-dire
            -- tous sauf `base_morphable`.
            morphs     TEXT,
            credits    INTEGER NOT NULL DEFAULT 200,
            couleurs   TEXT,
            -- Apparence du Meta Customization System (2026-09-13) : identite,
            -- vetements, grooms, curseurs, teinte, tatouage, yeux — une ligne
            -- `cle=valeur;...` encodee par `Logic/MetaCustom.lua`. NULL = apparence
            -- par defaut du genre, un etat valide.
            metacustom TEXT,
            -- Les 18 emplacements de sauvegarde du pack (Slots 1-18), separes par `|`.
            metacustom_emplacements TEXT,
            -- La CITÉ choisie à l'écran de départ (id de Catalogs/Mondes.lua,
            -- 2026-09-15) : présélectionnée à la connexion suivante, et point de
            -- retour après la mort (`/revive`). NULL = jamais choisie.
            cite       TEXT,
            -- Le dernier ZAAP activé (id de Catalogs/Zaaps.lua, 2026-09-15, D4) :
            -- point de réapparition prioritaire sur la cité. NULL = aucun ; un id
            -- de Zaap supprimé depuis se lit comme NULL (retour à la cité).
            zaap       TEXT,
            cree_le    INTEGER NOT NULL,
            FOREIGN KEY (compte_id) REFERENCES comptes(id) ON DELETE CASCADE
        )
    ]])

    -- ── Migration des bases anterieures ───────────────────────────────────────
    --
    -- `CREATE TABLE IF NOT EXISTS` ne touche PAS une table deja creee : sur une
    -- base d'avant la garde-robe, les deux colonnes manqueraient et chaque
    -- lecture de personnage echouerait.
    --
    -- `ADD COLUMN` leve quand la colonne existe deja. C'est le comportement
    -- attendu et non une erreur : on l'absorbe plutot que de lire d'abord le
    -- schema, ce qui demanderait un dialecte different selon SQLite ou MySQL.
    -- ── MIGRATION DES BASES ANTERIEURES ───────────────────────────────────────
    --
    -- ⚠ TOUTE colonne ajoutee au CREATE doit AUSSI figurer ici. Le
    -- `CREATE TABLE IF NOT EXISTS` ne touche PAS une table deja creee : sur une
    -- base d'hier, la colonne manquerait et chaque requete qui la nomme
    -- echouerait, sans autre message que « Enregistrement impossible ».
    -- `scripts/lua-harness/schema-check.mjs` compare les deux listes.
    --
    -- ⚠ ON LIT LE SCHEMA AVANT D'AJOUTER. Emettre un `ADD COLUMN` sur une
    -- colonne existante leve, et `pcall` attrape bien l'exception Lua — mais
    -- nanos a DEJA journalise l'echec SQL en ERROR avant de rendre la main.
    -- Neuf lignes rouges a chaque demarrage pour un fonctionnement normal,
    -- c'est ce qui fait qu'on cesse de lire les erreurs.

    --- Colonnes existantes d'une table. Rend nil si le dialecte ne repond pas.
    ---
    --- `PRAGMA table_info` est propre a SQLite. En MySQL il echoue, on rend nil,
    --- et l'appelant retombe sur les `ADD COLUMN` proteges — bruyants mais
    --- corrects. Mieux vaut un repli fonctionnel qu'un dialecte devine.
    local function ColonnesDe(table_nom)
        local ok, lignes = pcall(function()
            return db:Select("PRAGMA table_info(" .. table_nom .. ")")
        end)
        if (not ok or type(lignes) ~= "table" or #lignes == 0) then return nil end

        local colonnes = {}
        for _, l in ipairs(lignes) do
            if (l.name) then colonnes[tostring(l.name)] = true end
        end
        return colonnes
    end

    local connues = {
        personnages = ColonnesDe("personnages"),
        comptes = ColonnesDe("comptes"),
    }

    for _, m in ipairs({
        { "personnages", "lore_id", "TEXT" },
        { "personnages", "corps", "TEXT" },
        { "personnages", "tenue", "TEXT" },
        { "personnages", "couleurs", "TEXT" },
        { "personnages", "garde_robe", "TEXT" },
        { "personnages", "morphs", "TEXT" },
        { "personnages", "credits", "INTEGER NOT NULL DEFAULT 200" },
        -- ⚠ `CREATE TABLE IF NOT EXISTS` ne touche PAS une table deja creee : sans
        -- cet ALTER, la colonne n'existerait que dans les bases NEUVES, et toute
        -- sauvegarde echouerait sur celle d'un joueur qui jouait la veille.
        -- C'est exactement l'oubli qui avait donne « table personnages has no
        -- column named corps » le 2026-09-04.
        { "personnages", "inventaire", "TEXT" },
        -- Compagnons : etat pur de `Logic/Animaux.lua`, encode par
        -- `Roster.EncoderAnimaux`. Colonne ajoutee le 2026-09-10 — les
        -- personnages existants la recoivent NULL, que le decodeur lit comme
        -- « aucun compagnon », pas comme une erreur.
        { "personnages", "animaux", "TEXT" },
        -- Les metiers, portes depuis le prototype web le 2026-09-12. Sans cette
        -- ligne, une base d'hier n'aurait pas la colonne et chaque sauvegarde
        -- d'XP echouerait en « Personnage introuvable ».
        { "personnages", "metiers", "TEXT" },
        -- Apparence et emplacements du Meta Customization System (2026-09-13).
        { "personnages", "metacustom", "TEXT" },
        { "personnages", "metacustom_emplacements", "TEXT" },
        -- Progression du personnage (2026-09-13) : sans ces lignes, la premiere
        -- victoire d'un personnage d'hier echouerait en « Personnage introuvable ».
        { "personnages", "xp", "INTEGER NOT NULL DEFAULT 0" },
        { "personnages", "talents", "TEXT" },
        -- Cité de départ et de réapparition (2026-09-15).
        { "personnages", "cite", "TEXT" },
        -- Dernier Zaap activé, point de réapparition (2026-09-15, D4).
        { "personnages", "zaap", "TEXT" },

        -- `identifiant` et `steam_id` sont UNIQUE : SQLite refuse un
        -- ADD COLUMN UNIQUE, elles ne peuvent venir que du CREATE.
        { "comptes", "iterations", "INTEGER" },
        { "comptes", "vu_le", "INTEGER" },

        -- ── Droit d'administration (2026-09-10) ───────────────────────────────
        -- `Logic/Zones.lua` décide qui édite où, et sa première question est
        -- « est-ce un admin ». Il fallait donc que le compte porte la réponse.
        --
        -- ⚠ `DEFAULT 0` n'est pas une précaution de style : c'est ce qui garantit
        -- que les comptes DÉJÀ EN BASE — dont `narvos_comptes.db` qui existe
        -- depuis le 2026-09-08 — arrivent joueurs et non admins. Une colonne
        -- ajoutée sans défaut vaut NULL sur l'existant, et un `NULL == 1` faux en
        -- SQL se lirait ici comme « pas admin » par chance, pas par décision.
        -- On ne veut pas dépendre de la chance sur cette colonne-là.
        --
        -- Se promeut à la main, et c'est voulu : il n'existe aucune commande en
        -- jeu pour se donner ce droit.
        --   UPDATE comptes SET est_admin = 1 WHERE pseudo = '<le tien>';
        { "comptes", "est_admin", "INTEGER NOT NULL DEFAULT 0" },
    }) do
        local table_nom, colonne, type_sql = m[1], m[2], m[3]
        local schema = connues[table_nom]

        -- Schema illisible : on tente quand meme, sinon une base MySQL ne
        -- serait jamais migree.
        if (not schema or not schema[colonne]) then
            pcall(function()
                db:Execute("ALTER TABLE " .. table_nom .. " ADD COLUMN "
                    .. colonne .. " " .. type_sql)
            end)
        end
    end

    -- Un nom de personnage est unique sur TOUT le serveur, pas par compte : deux
    -- joueurs ne peuvent pas porter le même nom en jeu. L'index le fait respecter
    -- par la base, ce qu'une vérification en Lua ne garantirait pas en concurrence.
    -- Raccourcis clavier des animations. Clé primaire COMPOSITE (compte, touche) :
    -- c'est elle qui rend `INSERT OR REPLACE` atomique quand le joueur réassigne
    -- une touche déjà prise, sans passer par un DELETE qui laisserait une fenêtre
    -- où le raccourci n'existe plus.
    db:Execute([==[
        CREATE TABLE IF NOT EXISTS raccourcis (
            compte_id  INTEGER NOT NULL,
            touche     TEXT    NOT NULL,
            anim_id    TEXT    NOT NULL,
            PRIMARY KEY (compte_id, touche),
            FOREIGN KEY (compte_id) REFERENCES comptes(id) ON DELETE CASCADE
        )
    ]==])

    -- Touches des COMMANDES du jeu (Logic/Commandes.lua). Table SEPAREE des
    -- `raccourcis` d'animation : ici la cle est l'ACTION, la ou les raccourcis
    -- ont pour cle la TOUCHE. Les deux sens sont voulus.
    --
    -- Une action peut porter une touche VIDE : c'est l'etat d'une commande a qui
    -- une autre a repris sa touche. Supprimer la ligne ferait revenir son defaut,
    -- donc le meme conflit au prochain chargement.
    db:Execute([==[
        CREATE TABLE IF NOT EXISTS commandes (
            compte_id  INTEGER NOT NULL,
            action_id  TEXT    NOT NULL,
            touche     TEXT    NOT NULL,
            PRIMARY KEY (compte_id, action_id),
            FOREIGN KEY (compte_id) REFERENCES comptes(id) ON DELETE CASCADE
        )
    ]==])

    -- Réglages de jouabilité (Logic/Jouabilite.lua, 2026-09-19) : un paramètre
    -- par ligne, au même compte que les touches — un réglage est une habitude
    -- du JOUEUR, pas du personnage (même raison que `commandes`). `valeur` est
    -- TEXTE : le module encode chaque type (toggle "1"/"0", multi "a,b", choix
    -- tel quel) — une table séparée par type éclaterait la validation en
    -- autant d'endroits.
    db:Execute([==[
        CREATE TABLE IF NOT EXISTS jouabilite (
            compte_id    INTEGER NOT NULL,
            parametre_id TEXT    NOT NULL,
            valeur       TEXT    NOT NULL,
            PRIMARY KEY (compte_id, parametre_id),
            FOREIGN KEY (compte_id) REFERENCES comptes(id) ON DELETE CASCADE
        )
    ]==])

    -- Roue d'objets (Logic/Roue.lua) : cinq emplacements PAR PERSONNAGE, et non
    -- par compte comme les touches — le contenu de la roue dépend de ce que le
    -- personnage porte. `perso_id` est TEXT : `personnages.id` l'est (uuid), la
    -- recopier en INTEGER produirait une clé étrangère qui ne matche jamais.
    -- Même base, même connexion : voir Comptes.Base().
    db:Execute([==[
        CREATE TABLE IF NOT EXISTS roue (
            perso_id    TEXT    NOT NULL,
            emplacement INTEGER NOT NULL,
            item_id     TEXT    NOT NULL,
            PRIMARY KEY (perso_id, emplacement),
            FOREIGN KEY (perso_id) REFERENCES personnages(id) ON DELETE CASCADE
        )
    ]==])

    -- Parcelles agricoles (Logic/Agriculture.lua) : une ligne par plantation,
    -- PAR PERSONNAGE comme la roue. Cle composite (proprietaire, parcelle) :
    -- le `WHERE proprietaire_id` du module n'est jamais decoratif — sans lui,
    -- un client recolterait le champ d'un autre. `arrose_le` est NULL tant que
    -- la parcelle n'a jamais ete arrosee : la croissance attend l'eau (spec
    -- Hyper Inventory V2). Les instants sont REAL : l'horloge du serveur n'est
    -- pas garantie entiere.
    -- Table NEUVE (2026-09-10) : aucune base anterieure ne la porte, pas d'ALTER.
    db:Execute([==[
        CREATE TABLE IF NOT EXISTS parcelles (
            proprietaire_id TEXT NOT NULL,
            parcelle_id     TEXT NOT NULL,
            graine_id       TEXT NOT NULL,
            plantee_le      REAL NOT NULL,
            croissance      REAL NOT NULL DEFAULT 0,
            arrose_le       REAL,
            vu_le           REAL NOT NULL DEFAULT 0,
            PRIMARY KEY (proprietaire_id, parcelle_id),
            FOREIGN KEY (proprietaire_id) REFERENCES personnages(id) ON DELETE CASCADE
        )
    ]==])

    -- Assemblages en cours (Logic/Assemblage.lua) : UNE ligne par personnage
    -- (un seul assemblage a la fois). La pose CONSOMME la piece dans la
    -- grille : une session perdue serait des pieces mangees — c'est pourquoi
    -- chaque mutation reecrit la ligne. `donnees` porte le plan et les pieces
    -- posees, encodes par le module (format texte propre, pas de JSON pur) ;
    -- le `WHERE proprietaire_id` n'est jamais decoratif.
    -- Table NEUVE (2026-09-10) : aucune base anterieure ne la porte, pas d'ALTER.
    db:Execute([==[
        CREATE TABLE IF NOT EXISTS assemblages (
            proprietaire_id TEXT PRIMARY KEY,
            plan_id         TEXT NOT NULL,
            donnees         TEXT NOT NULL,
            FOREIGN KEY (proprietaire_id) REFERENCES personnages(id) ON DELETE CASCADE
        )
    ]==])

    -- Portes à code (Logic/Digicode.lua, exécutant Server/Digicode.lua). Une
    -- ligne par porte posée dans le monde. Le code n'y est JAMAIS : `empreinte`
    -- = SHA-256(sel .. code), `sel` propre à la porte. Coordonnées MONDE en
    -- centimètres (les mondes sont séparés par leurs positions, pas par la
    -- dimension). `compte_id` = qui l'a posée — la règle d'accès, elle, reste
    -- celle des zones (`Zones.PeutEditer` à l'emplacement), relue à chaque geste.
    -- `objet_consomme` = 0 quand un administrateur l'a posée SANS objet (dispense) :
    -- la retirer ne rend alors rien, sinon poser-retirer fabriquerait des digicodes.
    -- Table NEUVE (2026-09-13) : aucune base antérieure ne la porte, pas d'ALTER.
    db:Execute([==[
        CREATE TABLE IF NOT EXISTS digicodes (
            id         TEXT    PRIMARY KEY,
            x          REAL    NOT NULL,
            y          REAL    NOT NULL,
            z          REAL    NOT NULL,
            yaw        REAL    NOT NULL DEFAULT 0,
            sel        TEXT    NOT NULL,
            empreinte  TEXT    NOT NULL,
            compte_id  INTEGER NOT NULL,
            pose_le    INTEGER NOT NULL,
            objet_consomme INTEGER NOT NULL DEFAULT 1,
            FOREIGN KEY (compte_id) REFERENCES comptes(id) ON DELETE CASCADE
        )
    ]==])

    db:Execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_perso_nom ON personnages(nom COLLATE NOCASE)")
    db:Execute("CREATE INDEX IF NOT EXISTS idx_perso_compte ON personnages(compte_id)")

    return true
end

--- La base est-elle disponible ?
function Comptes.Prete()
    return db ~= nil
end

--- La connexion, pour que `Logic/Roster.lua` la partage.
---
--- Les deux modules doivent employer la MÊME connexion : SQLite verrouille le
--- fichier entier en écriture, et deux connexions concurrentes se bloqueraient
--- l'une l'autre sur le premier `INSERT`. `comptes` et `personnages` vivent dans
--- le même fichier pour cette raison, et la clé étrangère les lie.
---@return any
function Comptes.Base()
    return db
end

-- ── Validation (pure, testable hors moteur) ───────────────────────────────────

local function rogner(s)
    return (tostring(s or ""):gsub("^%s+", ""):gsub("%s+$", ""))
end

--- L'identifiant est-il acceptable ?
--- Rend (ok, raison) : un identifiant refusé est un cas normal, pas une exception.
---@param identifiant string
---@return boolean, string|nil
function Comptes.ValiderIdentifiant(identifiant)
    local v = rogner(identifiant)

    if (v == "") then return false, "Identifiant requis" end
    if (#v < Comptes.IDENT_MIN) then
        return false, "Identifiant trop court (" .. Comptes.IDENT_MIN .. " caracteres minimum)"
    end
    if (#v > Comptes.IDENT_MAX) then
        return false, "Identifiant trop long (" .. Comptes.IDENT_MAX .. " caracteres maximum)"
    end
    -- Jeu restreint volontairement : l'identifiant sert de clé et s'affiche.
    -- Tout autoriser inviterait les caractères de contrôle et les homoglyphes.
    if (v:match("[^%w_%-%.]")) then
        return false, "Caracteres autorises : lettres, chiffres, _ - ."
    end
    return true, nil
end

--- Le mot de passe est-il acceptable ?
--- On impose une longueur et rien d'autre : les règles de composition
--- (majuscule, chiffre, symbole) poussent surtout à choisir « Motdepasse1! »,
--- et le NIST les déconseille depuis 2017.
---@param motdepasse string
---@return boolean, string|nil
function Comptes.ValiderMotDePasse(motdepasse)
    if (type(motdepasse) ~= "string" or motdepasse == "") then
        return false, "Mot de passe requis"
    end
    if (#motdepasse < Comptes.MDP_MIN) then
        return false, "Mot de passe trop court (" .. Comptes.MDP_MIN .. " caracteres minimum)"
    end
    return true, nil
end

-- ── Limitation des tentatives ─────────────────────────────────────────────────
--
-- ── POURQUOI ÇA COMPTE PLUS QU'IL N'Y PARAÎT ─────────────────────────────────
-- PBKDF2 tourne ici à 1 000 itérations, soit ~200 fois moins que bcrypt à coût
-- 12. Un mot de passe faible tombe donc vite si l'attaquant peut essayer sans
-- fin. Le débit est la seule barrière qui reste tant que le hachage n'est pas
-- déporté vers un service dédié.
--
-- ── PURE, DONC TESTABLE ──────────────────────────────────────────────────────
-- Aucun appel d'horloge ici : l'instant est un PARAMÈTRE. Le serveur passe un
-- compteur monotone. Une horloge lue à l'intérieur rendrait chaque test
-- dépendant du moment où il tourne.

--- Échecs tolérés avant blocage.
Comptes.MAX_TENTATIVES = 5

--- Durée du blocage, en secondes.
Comptes.BLOCAGE_S = 60

--- État de limitation, un par joueur.
---@return table
function Comptes.NouvelleLimite()
    return { echecs = 0, bloque_jusqu_a = 0 }
end

--- Le joueur est-il bloqué ? Rend (bloque, secondes_restantes).
---@param limite table
---@param instant number
---@return boolean, number
function Comptes.Bloque(limite, instant)
    if (type(limite) ~= "table") then return false, 0 end
    local t = tonumber(instant) or 0
    local reste = (tonumber(limite.bloque_jusqu_a) or 0) - t
    if (reste <= 0) then return false, 0 end
    return true, reste
end

--- Enregistre un échec. Au-delà de `MAX_TENTATIVES`, arme le blocage.
---
--- ⚠ Le compteur n'est PAS remis à zéro à l'expiration du blocage : sinon
--- l'attaquant reprendrait cinq essais gratuits toutes les minutes. Il ne
--- retombe qu'à une connexion RÉUSSIE.
---@param limite table
---@param instant number
function Comptes.EnregistrerEchec(limite, instant)
    if (type(limite) ~= "table") then return end
    local t = tonumber(instant) or 0

    limite.echecs = (tonumber(limite.echecs) or 0) + 1
    if (limite.echecs >= Comptes.MAX_TENTATIVES) then
        limite.bloque_jusqu_a = t + Comptes.BLOCAGE_S
    end
end

--- Remet le compteur à zéro. À appeler sur une connexion réussie.
---@param limite table
function Comptes.EnregistrerSucces(limite)
    if (type(limite) ~= "table") then return end
    limite.echecs = 0
    limite.bloque_jusqu_a = 0
end

--- Compteur d'appels, pour qu'aucun sel ne puisse en répéter un autre dans la
--- même seconde d'horloge. Croît sans jamais être remis à zéro.
local sels_produits = 0

--- Fabrique un sel hexadécimal de 32 caractères (16 octets).
---
--- ── ⚠ CE N'EST TOUJOURS PAS UN GÉNÉRATEUR CRYPTOGRAPHIQUE ────────────────────
--- Lua n'expose aucune source d'entropie sûre, et nanos n'en fournit pas. Ce qui
--- suit RÉDUIT la prévisibilité, il ne l'élimine pas. La correction réelle reste
--- de faire produire le sel par un service HTTP le jour du VPS.
---
--- Ce qu'on gagne quand même, par rapport à seize `math.random(0,255)` bruts :
---
---   · plusieurs sources indépendantes entrent dans le mélange — l'horloge
---     murale, l'horloge processeur, un compteur, et l'ADRESSE d'une table
---     fraîchement allouée, que l'allocateur ne place pas deux fois au même
---     endroit ;
---   · le tout passe par SHA-256. Connaître la graine de `math.random` ne suffit
---     donc plus : il faut aussi deviner les trois autres sources ET inverser le
---     hachage. Seize octets bruts, eux, se rejouaient tels quels.
---
--- ⚠ NE PAS en conclure que le sel est sûr. Il ne l'est pas.
---@param rng function|nil  injectable, pour les tests
---@return string
function Comptes.NouveauSel(rng)
    local hasard = rng or math.random
    sels_produits = sels_produits + 1

    local morceaux = { tostring(os.time()), tostring(os.clock()),
                       tostring(sels_produits),
                       -- `tostring({})` rend « table: 0x… » : l'adresse d'une
                       -- allocation neuve, que rien ne rend rejouable.
                       tostring({}) }

    for _ = 1, 16 do
        morceaux[#morceaux + 1] = string.format("%02x", hasard(0, 255))
    end

    -- SHA-256 blanchit le mélange : la sortie reste 32 hex, et aucune des
    -- sources n'y est lisible.
    return Crypto.Sha256Hex(table.concat(morceaux, "|")):sub(1, 32)
end

--- Calcule le hachage d'un mot de passe. Pur : ne touche ni la base ni l'horloge.
---@param motdepasse string
---@param sel string
---@param iterations integer
---@return string  hexadécimal
function Comptes.Hacher(motdepasse, sel, iterations)
    return Crypto.Hex(Crypto.Pbkdf2(motdepasse, sel, iterations))
end

--- Le mot de passe correspond-il à la ligne de compte fournie ?
--- Séparé de la lecture en base pour être testable sans moteur.
---@param motdepasse string
---@param ligne table  { hash, sel, iterations }
---@return boolean
function Comptes.VerifierMotDePasse(motdepasse, ligne)
    if (type(ligne) ~= "table") then return false end
    if (type(ligne.hash) ~= "string" or type(ligne.sel) ~= "string") then return false end

    local iterations = tonumber(ligne.iterations) or 0
    if (iterations < 1) then return false end

    local calcule = Comptes.Hacher(motdepasse, ligne.sel, iterations)

    -- Comparaison à temps constant : `==` révélerait par sa durée combien
    -- d'octets de tête sont justes. Voir Crypto.EgalConstant.
    return Crypto.EgalConstant(calcule, ligne.hash)
end

-- ── Accès à la base ───────────────────────────────────────────────────────────

local function maintenant()
    return (os and os.time) and os.time() or 0
end

--- Compte lié à un Steam ID, ou nil.
---@param steam_id string
---@return table|nil
function Comptes.ParSteam(steam_id)
    if (not db or type(steam_id) ~= "string" or steam_id == "") then return nil end
    local lignes = db:Select("SELECT * FROM comptes WHERE steam_id = :0", steam_id)
    return lignes and lignes[1] or nil
end

--- Compte lié à un identifiant, ou nil.
---@param identifiant string
---@return table|nil
function Comptes.ParIdentifiant(identifiant)
    if (not db or type(identifiant) ~= "string" or identifiant == "") then return nil end
    -- COLLATE NOCASE : « Aniss » et « aniss » sont le même compte, sinon deux
    -- joueurs pourraient créer des identifiants visuellement identiques.
    local lignes = db:Select(
        "SELECT * FROM comptes WHERE identifiant = :0 COLLATE NOCASE", rogner(identifiant))
    return lignes and lignes[1] or nil
end

--- Connexion par Steam : trouve le compte, ou le crée au premier passage.
--- C'est le chemin normal — aucun mot de passe n'intervient.
---@param steam_id string
---@param pseudo string
---@return table|nil, string|nil
function Comptes.ConnexionSteam(steam_id, pseudo)
    if (not db) then return nil, "Base indisponible" end
    if (type(steam_id) ~= "string" or steam_id == "") then return nil, "Steam ID absent" end

    local compte = Comptes.ParSteam(steam_id)

    if (not compte) then
        db:Execute(
            "INSERT INTO comptes (steam_id, pseudo, cree_le, vu_le) VALUES (:0, :1, :2, :2)",
            steam_id, rogner(pseudo) ~= "" and rogner(pseudo) or ("Joueur" .. steam_id:sub(-4)),
            maintenant())
        compte = Comptes.ParSteam(steam_id)
        if (not compte) then return nil, "Creation du compte impossible" end
    else
        db:Execute("UPDATE comptes SET vu_le = :0 WHERE id = :1", maintenant(), compte.id)
    end

    return compte, nil
end

--- Inscription par identifiant/mot de passe.
---@param identifiant string
---@param motdepasse string
---@param rng function|nil
---@return table|nil, string|nil
function Comptes.Inscrire(identifiant, motdepasse, rng)
    if (not db) then return nil, "Base indisponible" end

    local ok, raison = Comptes.ValiderIdentifiant(identifiant)
    if (not ok) then return nil, raison end

    ok, raison = Comptes.ValiderMotDePasse(motdepasse)
    if (not ok) then return nil, raison end

    if (Comptes.ParIdentifiant(identifiant)) then
        -- ⚠ MESSAGE VOLONTAIREMENT VAGUE. Dire « cet identifiant est deja pris »
        -- permet de sonder les comptes existants un a un, ce qui annule le
        -- message constant soigneusement pose dans `Connexion`. On refuse sans
        -- confirmer l'existence. Trouve par audit le 2026-09-03.
        return nil, "Impossible de creer ce compte avec cet identifiant"
    end

    local v = rogner(identifiant)
    local sel = Comptes.NouveauSel(rng)
    local hash = Comptes.Hacher(motdepasse, sel, Comptes.ITERATIONS)

    db:Execute(
        "INSERT INTO comptes (identifiant, hash, sel, iterations, pseudo, cree_le, vu_le) " ..
        "VALUES (:0, :1, :2, :3, :4, :5, :5)",
        v, hash, sel, Comptes.ITERATIONS, v, maintenant())

    return Comptes.ParIdentifiant(v), nil
end

--- Connexion par identifiant/mot de passe.
---@param identifiant string
---@param motdepasse string
---@return table|nil, string|nil
function Comptes.Connexion(identifiant, motdepasse)
    if (not db) then return nil, "Base indisponible" end

    local compte = Comptes.ParIdentifiant(identifiant)

    -- ⚠ MÊME MESSAGE pour « compte inconnu » et « mot de passe faux ». Les
    -- distinguer permettrait d'énumérer les identifiants existants.
    local REFUS = "Identifiant ou mot de passe incorrect"

    if (not compte) then
        -- On hache quand même, sur un sel jetable : sans ça, un compte inexistant
        -- répondrait bien plus vite qu'un mot de passe faux, et le temps de
        -- réponse suffirait à savoir quels identifiants existent.
        Comptes.Hacher(tostring(motdepasse or ""), "00000000000000000000000000000000",
                       Comptes.ITERATIONS)
        return nil, REFUS
    end

    if (not Comptes.VerifierMotDePasse(motdepasse, compte)) then
        return nil, REFUS
    end

    db:Execute("UPDATE comptes SET vu_le = :0 WHERE id = :1", maintenant(), compte.id)
    return compte, nil
end

--- Ferme la connexion. À appeler à l'arrêt du package.
function Comptes.Fermer()
    db = nil
end

--- Injecte une base (tests d'intégration, ou moteur alternatif).
---@param instance any
function Comptes.UtiliserBase(instance)
    db = instance
end

return Comptes
