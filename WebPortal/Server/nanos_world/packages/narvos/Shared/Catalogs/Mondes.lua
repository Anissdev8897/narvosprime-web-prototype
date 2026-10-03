-- ═══════════════════════════════════════════════════════════════════════════════
-- Shared/Catalogs/Mondes.lua — les mondes de NARVOS et les passages entre eux.
--
-- ÉCRIT À LA MAIN, pas généré : une liaison entre deux maps est une décision de
-- level design (où se pose le portail, dans quel sens, à quelle condition), pas
-- une transposition d'un catalogue TS.
--
-- ── CE QUI A CHANGÉ LE 2026-09-06, ET POURQUOI ────────────────────────────────
-- Avant, nos mondes étaient des paquets de `StaticMesh` posés par `MapLoader`,
-- séparés par des DIMENSIONS. Ils sont désormais de vrais niveaux Unreal —
-- `Map_Forge`, `Map_Tower`, `Map_Alien`, `Map_Orbital` — montés en SOUS-NIVEAUX
-- du niveau persistant `Map_Narvos`.
--
-- Ce n'est pas un caprice : chacun porte un **Landscape**, et un Landscape ne se
-- copie pas d'un niveau à l'autre (LandscapeInfo, proxies, GUID). Le sous-niveau
-- est la seule forme qui le garde intact — et il porte sa propre transform, donc
-- décaler un monde ne touche à aucun asset.
--
-- ── POURQUOI PLUS DE DIMENSIONS ───────────────────────────────────────────────
-- Les dimensions séparaient des mondes qui occupaient tous l'origine. Ils sont
-- maintenant séparés DANS L'ESPACE, de 80 km. Deux raisons de s'en tenir là :
--
--   · la géométrie d'un sous-niveau n'est pas une entité nanos ; elle ne porte
--     donc pas de dimension. Mettre les joueurs en dimension 2 les rendrait
--     aveugles au décor, qui, lui, resterait en 1 ;
--   · la distance fait déjà le travail de la dimension pour la pertinence réseau.
--
-- Le champ `dimension` reste, à 1 partout, pour ne pas casser les appels qui le
-- lisent. C'est `Mondes.ParPosition` qui dit désormais où est un joueur.
--
-- ── LES COORDONNÉES CI-DESSOUS SONT MESURÉES ──────────────────────────────────
-- Les `arrivee` viennent d'un raycast vertical au centre de chaque Landscape,
-- dans le monde ASSEMBLÉ (scripts scratchpad `_univers_5.py`) — pas d'une
-- lecture du glTF, pas d'une estimation à l'œil. Le sol relevé le 2026-09-06 :
--
--     forge   z = 146375.4  (-ground_with_grass___ff_unearthed_zone_i__001)
--     tower   z =    244.5  (Landscape)
--     alien   z =   1485.8  (Landscape)
--
-- ⚠ RELEVÉ UNE SECONDE FOIS le 2026-09-06 au soir. Les trois Landscape avaient
-- été déplacés dans l'éditeur ; ceux d'Azur et de la Tour ont été remis, celui
-- de la Forge a été LAISSÉ là où il est — le décor GLB (12 989 meshes) y est
-- aligné. D'où une arrivée de Forge qui n'est plus au centre de son sous-niveau.
--
-- Les positions des planètes viennent du placement des trois systèmes solaires
-- (`_espace_v2.py`), qui les a posées puis relu leurs bornes.
-- ═══════════════════════════════════════════════════════════════════════════════

local Mondes = {}

--- Un mètre, en unités nanos. Les positions ci-dessous sont écrites en mètres
--- puis converties : `Vector(1200, 0, 100)` ne se relit pas, `12 * M` si.
local M = 100.0

-- ── Décalages des sous-niveaux ────────────────────────────────────────────────
--
-- Ils sont posés dans `Map_Narvos` (transform du LevelStreaming) ET répétés ici,
-- parce que le Lua doit savoir où atterrit un joueur sans pouvoir interroger la
-- transform d'un sous-niveau — nanos n'expose pas cette lecture.
--
-- ⚠ SI ON CHANGE UN DÉCALAGE DANS L'ÉDITEUR, IL FAUT LE CHANGER ICI. C'est la
-- seule duplication du système, et elle est muette : un joueur atterrirait dans
-- le vide, à côté de sa carte, sans la moindre erreur.
Mondes.DECALAGES = {
    orbital = Vector(0, 0, 0),
    forge   = Vector(-8000000, 0, 0),
    tower   = Vector(-8000000, 2000000, 0),
    alien   = Vector(-8000000, 4000000, 0),
}

--- Rayon d'appartenance d'un monde planétaire, autour de son CENTRE.
--- Le Landscape fait 2 016 m et le décor de la Forge 3 287 m ; 6 km englobent le
--- jouable sans mordre sur le monde voisin, qui est à 19 km au plus près.
Mondes.RAYON_MONDE = 600000.0

--- ── ⚠ LE CENTRE N'EST PAS LE DÉCALAGE ───────────────────────────────────────
--- Le décalage est celui du SOUS-NIVEAU ; le centre est là où le contenu jouable
--- se trouve VRAIMENT dedans. Les deux ont coïncidé jusqu'au 2026-09-06, puis le
--- Landscape de la Forge a été déplacé dans son niveau pour s'aligner sur les
--- 12 989 meshes du décor GLB — le monde jouable est désormais à 600 m de son
--- propre décalage.
---
--- Confondre les deux rendrait `ParPosition` faux : un joueur debout sur la Forge
--- serait déclaré « en orbite », et son ciel changerait sous ses pieds.
--- Mesuré le 2026-09-06 (bornes des 12 989 acteurs du dossier `forge_map`).
--- ══════════════════════════════════════════════════════════════════════════════
--- ⚠ ARRIVEES REMESUREES LE 2026-09-08 — LES QUATRE ETAIENT DANS LE VIDE.
---
--- Raycast vertical sur 8 km au point d'arrivee de chaque monde, dans l'editeur,
--- sur Map_Narvos :
---
---   forge    z=146 475   AUCUN SOL sur 8 km
---   tower    z=    345   AUCUN SOL sur 8 km
---   alien    z=  1 586   AUCUN SOL sur 8 km
---
--- On n'entrait donc dans AUCUNE planete : on arrivait 1,5 km sous elles, en
--- chute libre. C'est ce que le joueur decrivait par « je spawn au milieu de la
--- galaxie ».
---
--- Les vrais sols, mesures au centre de chaque Landscape :
---
---   MTL_MWAM_Landscape_DesertExample   (-8 513 420, 2 385 420, 151 834)  1 518 m
---   MTL_MWAM_Landscape_IslandExample   (-8 513 420, 4 385 420, 153 406)  1 534 m
---   hub Orbital, centre (-363 190, 85 940)             sol a z=246 429
---
--- L'appariement se fait sur la PROXIMITE mesuree, pas sur une intention :
---   `tower` visait Y=2 000 000, le Desert est a Y=2 385 420  -> le plus proche
---   `alien` visait Y=4 000 000, l'Island est a Y=4 385 420   -> le plus proche
---   et « Azur » est decrit comme une ile, ce que l'Island confirme.
---
--- ⚠ `forge` reste dans le vide, et ce n'est pas un oubli : son terrain a ete
--- SUPPRIME du niveau. Aucun raycast ne peut inventer un sol qui n'existe pas.
--- Son arrivee est laissee telle quelle, et le portail vers la Forge amenera
--- dans le vide tant que sa map n'est pas replacee.
--- ══════════════════════════════════════════════════════════════════════════════
Mondes.CENTRES = {
    forge = Vector(-8599410, 195426, 180134),
    tower = Vector(-8513420, 2385420, 151834),
    alien = Vector(-8513420, 4385420, 153406),
    -- La capitale suit l'espacement des autres : forge ~2 km, tower ~24,
    -- alien ~44, elle a ~64. Ce n'est pas un choix esthetique, c'est la suite
    -- de la serie — donc la position qu'un lecteur de ce catalogue attendra.
    -- Z mesure par raycast sur le sol de la ville, six sondes concordantes.
    capitale = Vector(-8513420, 6385420, 157859),
    -- La forêt suit l'espacement de 20 km. Son Z est NÉGATIF : le pack
    -- `ForestKitONE` est exporté autour de zéro, et on ne soulève pas un
    -- Landscape de 2 km de côté sur 151 km pour une symétrie que personne ne
    -- lit. Médiane de six raycasts, tous touchant.
    foret = Vector(-8513420, 8385420, -8062),
    -- Map_Megastructure : acteurs déplacés, streaming à l'identité.
    -- Sol et arrivée vérifiés par cinq sondes ; lot astra-20260915-lot3 livré.
    megastructure = Vector(-8513420, 10385420, 150000),
}

--- Les mondes, dans l'ordre de découverte du joueur.
---
--- `niveau` est le nom du sous-niveau tel que nanos le connaît
--- (`Level.LoadStreamLevel`, `Level.SetStreamLevelVisibility`) : le nom court de
--- l'asset, pas son chemin.
---
--- `catalogue` nomme le champ de `Narvos` qui porte une liste de meshes à poser
--- EN PLUS du niveau. Il ne sert plus qu'au décor GLB de la Forge, et il est
--- désactivé — voir `decor_glb` ci-dessous.
Mondes.MONDES = {
    {
        id = "forge",
        label = "La Forge",
        description = "Le monde d'atterrissage. Relief, forets, ateliers.",
        dimension = 1,
        niveau = "Map_Forge",
        -- ── LE DÉCOR REVIENT AU CATALOGUE, LE 2026-09-12 ──────────────────
        -- Le 06/09, ces champs avaient été RETIRÉS, et pour une bonne raison : les
        -- 12 989 acteurs du décor étaient placés DANS le niveau `Map_Forge`, et le
        -- catalogue posait les mêmes meshes une seconde fois par-dessus.
        --
        -- Mesuré le 2026-09-12 : `Map_Forge.umap` pese 481 ko, contre 225 Mo pour
        -- `Map_Tower`, et la sonde des terrains ne trouve AUCUN Landscape a la
        -- Forge. Le décor du niveau a disparu — ce que l en-tete de CENTRES disait
        -- deja (« son terrain a ete supprime »). Le portail menait donc dans le vide.
        --
        -- Le catalogue, lui, est intact : 623 meshes cuits et verifies (controle
        -- « Map forge_map » du verificateur). Leurs transforms sont cuites dans les
        -- sommets ; il ne manquait que le bon decalage.
        --
        -- ⚠ `decalage_decor` ET PAS `DECALAGES.forge`. Mesure des 623 bornes
        -- (adk/_bornes-forge.json) : le decor occupe 3,10 x 2,99 km autour du centre
        -- local (-126962, 132879, 46981). Avec le decalage de monde (-8000000, 0, 0)
        -- il tomberait 4,72 km a cote du centre, donc a cheval sur le bord des 6 km.
        -- Le vecteur ci-dessous pose son centre SOUS le point d arrivee, et laisse
        -- 1,45 km de marge de chaque cote — c est la demande de Hanibes : « place la
        -- map plus loin du bord ».
        --
        -- ⚠ Z REMESURÉ LE 2026-09-15 — ON MOURAIT À L'ARRIVÉE. L'ancien Z (133 153)
        -- alignait le centre de la BOÎTE ENGLOBANTE, tirée vers le haut par
        -- `titanium_shard028` : ce n'était pas un calage sur le sol. Tant que le
        -- décor n'avait qu'une enveloppe convexe de collision (sommet 159 384), le
        -- joueur tenait debout sur elle ; depuis la collision complexe du lot 5
        -- d'Astra (15/09 matin), il tombe jusqu'au vrai sol. Mesuré en jeu à 17:00 :
        -- joueur à z = 143 161 sur un sol à 143 102, arrivée à 146 475 — chute de
        -- 33 m, VIE 0/132, sur le monde PAR DÉFAUT. Tirs de rayons sur la géométrie
        -- source (enquête .hermes/ENQUETE_FORGE_DEFAUTS_2026-09-15.md §4) : sol
        -- `ground_with_grass_i__001` à 143 154 sous l'arrivée (143 018 à 143 289 dans
        -- un rayon de 20 m). +3 221 cm remet ce sol à `arrivee.Z - 1 m` (146 375) —
        -- la convention d'`ANCRE` (Server/Index.lua), dont dépendent le mobilier,
        -- les marchands et les pads. La collision de repli Nanite reste ~0,5 m sous
        -- le rendu à cet endroit : défaut du cook, pas du placement.
        catalogue = "MapForge",
        decor_glb = true,
        decalage_decor = Vector(-8472448, 62547, 136374),
        -- D5 (18/09/2026) : retrait TEMPORAIRE, sans supprimer les donnees ni
        -- les liaisons. `Voyage.MondePraticable` ferme ainsi les portails et
        -- `VoyageServeur.Charger` ne pose plus les 623 morceaux GLB. Remettre a
        -- true seulement apres la refonte visuelle et sa validation en jeu.
        ouvert = false,
        -- ⚠ RETIRÉE DU CHOIX DE DÉPART le 2026-09-15, à la demande de Hanibes :
        -- « pas encore suffisamment optimisée » (259 matériaux sans texture, UV
        -- écrasés, trous : .hermes/ENQUETE_FORGE_DEFAUTS_2026-09-15.md). Le monde
        -- reste praticable — ses portails mènent toujours à lui — mais on n'y
        -- APPARAÎT plus. Remettre `depart = nil` quand la map sera refaite.
        depart = false,
        arrivee = Vector(-8599410, 195426, 146475),
        -- Plein jour sur du relief boisé : ombres franches mais obliques.
        ciel = {
            mode = "VolumetricClouds",
            meteo = "PartlyCloudy",
            heure = { 14, 30 },
            nuages = 0.35,
            brume = 0.05,
            intensite_soleil = 1.0,
        },
    },
    {
        id = "tower",
        label = "La Tour",
        description = "Le desert. Dunes, plateaux, la tour a l'horizon.",
        dimension = 1,
        niveau = "Map_Tower",
        arrivee = Vector(-8513420, 2385420, 151935),   -- sol mesure 151834 + 1 m
        -- Un désert ne se lit pas sous un ciel couvert : c'est la lumière rasante
        -- qui donne le relief des dunes. Petit matin, peu de nuages, et le voile
        -- de sable en suspension — `SandDustCalm` est la météo du catalogue faite
        -- pour ça ; `ClearSkies` donnerait un ciel de montagne au-dessus du sable.
        ciel = {
            mode = "VolumetricClouds",
            meteo = "SandDustCalm",
            heure = { 7, 15 },
            nuages = 0.15,
            brume = 0.30,
            intensite_soleil = 1.15,
            transition = 3.0,
        },
    },
    {
        id = "alien",
        label = "Azur",
        description = "L'ile alien. Falaises, lagons, foret tropicale.",
        dimension = 1,
        niveau = "Map_Alien",
        arrivee = Vector(-8513420, 4385420, 153506),   -- sol mesure 153406 + 1 m
        -- Une île se joue sur l'eau et le ciel : milieu d'après-midi, nuages
        -- portants, très peu de brume pour que le lagon garde sa couleur.
        ciel = {
            mode = "VolumetricClouds",
            meteo = "PartlyCloudy",
            heure = { 15, 45 },
            nuages = 0.45,
            brume = 0.03,
            intensite_soleil = 1.05,
            transition = 3.0,
        },
    },
    {
        id = "orbital",
        label = "Hub Orbital",
        description = "Le carrefour. Trois systemes solaires en partent.",
        dimension = 1,
        niveau = "Map_Orbital",
        -- Le hub tient dans un rayon d'un kilomètre autour de l'origine : épaves,
        -- stations, vaisseau-mère. On arrive un peu au-dessus des épaves (z=6950).
        arrivee = Vector(-363190, 85940, 246529),      -- sol mesure 246429 + 1 m
        -- ── L'ORBITE N'A PAS DE CIEL, ELLE A DU VIDE ──────────────────────────
        -- `SkyMode.Space` est le mode d'Ultra Dynamic Sky que nanos expose tel
        -- quel : il retire l'atmosphère et découvre le champ d'étoiles. C'est la
        -- seule valeur qui donne le fond galactique ; les autres rendent un ciel,
        -- même de nuit, parce que la diffusion atmosphérique reste.
        --
        -- ⚠ `heure` compte quand même. En mode Space le soleil éclaire toujours ;
        -- à midi il lave les étoiles. Minuit les laisse voir, et `luminosite_nuit`
        -- remonte l'ambiance pour que les épaves ne soient pas des silhouettes.
        ciel = {
            mode = "Space",
            heure = { 0, 0 },
            nuages = 0.0,
            brume = 0.0,
            intensite_soleil = 0.35,
            luminosite_nuit = 3.0,
            echelle_lune = 8.0,
            transition = 3.0,
        },
        -- ── POURQUOI L'ORBITE A SES PROPRES RÉGLAGES DE DÉPLACEMENT ───────────
        -- Il y a 40 km entre le hub et la première étoile. À 9,5 m/s — la vitesse
        -- de sprint d'un personnage — cela fait 70 minutes. Le voyage doit donc
        -- se faire en vol, et vite.
        --
        -- nanos n'a AUCUNE classe de véhicule volant (vérifié : `VehicleWheeled`
        -- et `VehicleWater`, rien d'autre). Ce qui existe, c'est
        -- `Character:SetFlyingMode(bool)`, employé par le mode `deathmatch`
        -- officiel pour ses spectateurs, et `SetSpeedMultiplier` côté serveur.
        --
        -- ×40 met les 40 km à environ deux minutes. C'est le seul monde à en
        -- avoir : au sol, ces valeurs rendraient le jeu injouable.
        vol = true,
        vitesse = 40.0,
    },
    {
        -- ══════════════════════════════════════════════════════════════════════
        -- LA CAPITALE — posee le 2026-09-08 depuis CITY_PACK
        --
        -- 13 490 acteurs copies dans le niveau PERSISTANT : la ville
        -- `BIG_CITY_NIGHT_1` (3 182 acteurs, 7,54 x 4,05 km) et neuf de ses
        -- interieurs, alignes au nord — hopital, bibliotheque, terminal,
        -- laboratoire, appartement, centre d'armes, salle de generateur,
        -- hall de DJ.
        --
        -- ⚠ `niveau` EST VIDE, ET C'EST VOLONTAIRE. Les trois autres mondes
        -- nomment un sous-niveau que nanos charge en streaming
        -- (`Level.LoadStreamLevel`). Les acteurs de la capitale sont dans le
        -- niveau persistant : il n'y a rien a streamer. Mettre un nom ici
        -- ferait echouer un chargement en silence.
        --
        -- ⚠ ON N'A PAS BESOIN D'UN RAYON PROPRE. Mesure sur les 13 490 acteurs
        -- reellement poses : le plus eloigne est a 4,41 km du centre declare,
        -- et `RAYON_MONDE` vaut 6 km. La premiere estimation — « la ville fait
        -- 7,5 km, donc il faut plus que 6 » — confondait la LARGEUR avec le
        -- RAYON. 7,54 km de large font 3,77 km de demi-largeur.
        --
        -- ⚠ « Akarlys » est une HYPOTHESE de faction, pas une mesure. Le patron
        -- a demande deux capitales de faction ; celle-ci est la premiere.
        -- Une chaine a changer si c'est ZAYAN ou MEZALAYIS.
        -- ══════════════════════════════════════════════════════════════════════
        id = "capitale",
        label = "Akarlys",
        description = "La capitale. Ses tours se voient depuis l'orbite.",
        dimension = 1,
        niveau = nil,
        -- ⚠ NI SOUS-NIVEAU NI CATALOGUE : son décor est DÉJÀ dans le persistant.
        -- Les 13 490 acteurs de CITY_PACK ont été copiés dans `Map_Narvos`
        -- (les 18 maps du pack n'ont aucun Landscape, donc rien n'imposait un
        -- sous-niveau). Sans ce champ, `Voyage.MondePraticable` la déclarait
        -- « pas encore accessible » et son portail n'était PAS posé — constaté
        -- au démarrage du serveur le 2026-09-09.
        decor_persistant = true,
        -- ✅ CUIT le 2026-09-09. Garde retiré après vérification.
        --
        -- ⚠ ET LE TÉMOIN QUE J'AVAIS ÉCRIT ÉTAIT LE MAUVAIS. Je demandais de
        -- compter `BIG_CITY_NIGHT_1` dans `Assets.toml` — or ce n'est pas le
        -- décor de la capitale. Ses 13 490 acteurs ont été COPIÉS dans
        -- `Map_Narvos` ; la map source du pack CITY_PACK ne sert à rien ici.
        --
        -- Le bon témoin est la DATE du `Map_Narvos` cuit :
        --     Assets/narvos/Narvos/Maps/Map_Narvos.umap  2026-09-09 14:06:26
        -- postérieure à l'état de l'éditeur (13:41:15), donc il porte bien les
        -- acteurs. Un témoin qui mesure autre chose que ce qu'on veut savoir
        -- rassure sans rien prouver.
        arrivee = Vector(-8513420, 6385420, 157959),   -- sol mesure 157859 + 1 m
        -- Une ville de nuit : c'est ainsi que le pack est eclaire
        -- (`BIG_CITY_NIGHT_1`). Forcer le jour laverait ses enseignes et ses
        -- fenetres, qui portent tout son caractere.
        ciel = {
            -- ⚠ ICI IL Y AVAIT `mode = "Static"`, qui N'EXISTE PAS. Un nom
            -- d'énumération faux ne lève rien : `Ciel.Reglages` retombe EN
            -- SILENCE sur `VolumetricClouds` + `ClearSkies`, et la nuit
            -- soigneusement réglée ci-dessous partait avec. Attrapé par
            -- `ciel.mjs` (`Ciel.Verifier`), le seul endroit où ce défaut fait
            -- du bruit — et seulement parce qu'on a fini par lancer TOUTE la
            -- batterie. Le nom voulu n'était rien de particulier : le choix
            -- visuel de la capitale tient à l'HEURE (22:30), pas au mode.
            -- On prend donc le mode PROUVÉ, celui des trois autres mondes.
            -- (`StaticClouds` figure bien dans `Ciel.MODES`, mais aucune
            -- exécution ne l'a encore vu dans le `SkyMode` du client.)
            mode = "VolumetricClouds",
            -- Ciel dégagé : à 15 % de nuages et de nuit, ce sont les enseignes
            -- qui doivent porter l'image, pas la couverture nuageuse.
            meteo = "ClearSkies",
            heure = { 22, 30 },
            nuages = 0.15,
            brume = 0.25,
            intensite_soleil = 0.2,
            luminosite_nuit = 2.0,
            echelle_lune = 2.5,
            transition = 4.0,
        },
    },
    {
        -- ══════════════════════════════════════════════════════════════════════
        -- LA FORÊT — 6e monde, posé le 2026-09-09.
        --
        -- Contrairement aux quatre premiers, son décor n'est PAS une liste de
        -- meshes : `ForestKitONE` est monté en SOUS-NIVEAU de `Map_Narvos`
        -- (`LevelStreamingAlwaysLoaded`), parce qu'il porte un LANDSCAPE. Un
        -- Landscape ne se copie pas entre niveaux — c'est ce qui a imposé la
        -- copie d'acteurs pour CITY_PACK, qui n'en a aucun, et le sous-niveau
        -- ici.
        --
        -- ⚠ SON SOL EST À Z NÉGATIF, ET C'EST NORMAL.
        -- Les quatre autres mondes vivent vers Z ≈ 151 800 ; la forêt vers
        -- Z ≈ -9 200. Le pack l'a exportée autour de zéro et la SOULEVER de
        -- 151 km aurait voulu dire déplacer un Landscape de 2 km de côté sur
        -- l'axe vertical — un risque pris pour une symétrie que rien ne
        -- consomme, puisque `CENTRES` stocke un Z par monde.
        --
        -- Les mondes sont espacés de 20 km en Y : forge ≈ 2, tower ≈ 24,
        -- alien ≈ 44, capitale ≈ 64, forêt ≈ 84. Aucun risque de recouvrement.
        -- ══════════════════════════════════════════════════════════════════════
        id = "foret",
        label = "Sylve de Verdant",
        description = "Sous-bois dense, sol accidenté. Le seul monde couvert.",
        dimension = 1,
        niveau = "ForestKitONE",
        -- ✅ CUIT le 2026-09-09. Garde retiré après vérification :
        --     ForestKitONE = "Narvos/OpenWorlds/Levels/ForestKitONE"
        --     Assets/narvos/Narvos/OpenWorlds/Levels/ForestKitONE.uexp  15 Mo
        -- Ici le témoin était le bon : la forêt EST un sous-niveau, donc sa
        -- présence dans le pack est exactement ce qui décide.
        -- Sol exact mesuré dans nanos le 15/09 : -8761 à ce XY.
        -- L'ancienne médiane de points distincts plaçait l'arrivée sous terre.
        -- 20 m à l'est du retour vers Akarlys évitent son déclenchement immédiat.
        arrivee = Vector(-8511420, 8385420, -8661),
        -- Sous les arbres, la lumière directe ne descend pas. Un soleil bas et
        -- une brume marquée : c'est ce qui fait lire le couvert.
        ciel = {
            -- Même faute qu'à la capitale, même correction : voir là-bas.
            mode = "VolumetricClouds",
            -- `Foggy` est le seul préréglage qui pose le couvert. Il donne la
            -- base ; `brume` la règle ensuite — le client applique `SetFog`
            -- APRÈS `ChangeWeather` (Client/Ciel.lua §3 puis §4), donc la
            -- valeur fine gagne et le préréglage ne s'ajoute pas par-dessus.
            meteo = "Foggy",
            heure = { 9, 45 },
            nuages = 0.55,
            brume = 0.45,
            intensite_soleil = 0.7,
            luminosite_nuit = 1.0,
            echelle_lune = 1.0,
            transition = 4.0,
        },
    },
    {
        id = "megastructure",
        label = "Planète Alien — Mégastructure",
        description = "Le monde des mégastructures extraterrestres.",
        dimension = 1,
        niveau = "Map_Megastructure",
        arrivee = Vector(-8511120, 10387420, 150100),
        ciel = {
            mode = "VolumetricClouds", meteo = "ClearSkies",
            heure = { 18, 0 }, nuages = 0.15, brume = 0.05,
            intensite_soleil = 0.7, luminosite_nuit = 1.0, transition = 4.0,
        },
    },
}

--- Les passages, dans les deux sens.
---
--- ⚠ UN PASSAGE N'EST PAS SYMÉTRIQUE. Le portail de départ et celui d'arrivée
--- sont deux objets distincts, à deux endroits distincts. Les écrire séparément
--- permet de les déplacer indépendamment — et évite le portail fantôme qui
--- n'existe que dans un sens.
---
--- ⚠ NE PAS RECOPIER LEUR NOMBRE AILLEURS. Cet en-tête a annoncé « SIX
--- LIAISONS » jusqu'au 2026-09-09 ; il y en avait huit depuis la capitale, et
--- dix depuis la forêt. `voyage-tests.lua` portait le même 6 en dur et attendait
--- « six passages ouverts » : il a rougi en annonçant `obtenu=8 attendu=6`, ce
--- qui se lit comme deux passages EN TROP alors qu'il s'agissait de deux mondes
--- en plus. Les tests affirment désormais la relation (`ouverts ==
--- #Mondes.LIAISONS`), et cet en-tête ne compte plus rien.
---
--- ── LA TEINTE DIT LA DESTINATION, PAS LE DÉPART ────────────────────────────
--- Toutes les montées portent le bleu d'Orbital ; chaque descente porte la
--- couleur de son monde. Un joueur lit donc la couleur du portail comme « où il
--- mène ». Inverser cette règle pour un seul passage la détruirait pour tous.
---
--- `exige_vol` : le joueur doit voler pour partir. Monter dans l'espace à pied
--- n'a aucun sens ; en redescendre non plus, mais la gravité s'en charge — d'où
--- l'exigence uniquement vers le haut.
Mondes.LIAISONS = {
    {
        de = "megastructure", vers = "orbital",
        label = "Balise orbitale de la Mégastructure",
        position = Vector(-8511120, 10387420, 150100),
        rayon = 6.0 * M, exige_vol = true,
        teinte = Color(0.25, 0.75, 1.0),
    },
    {
        de = "foret", vers = "orbital",
        label = "Balise orbitale de Sylve",
        -- Balise aérienne à 200 m au-dessus de l'arrivée : le passage au sol
        -- vers la capitale reste distinct. Ce point ne prétend pas être un sol.
        position = Vector(-8511420, 8385420, 11339),
        rayon = 6.0 * M, exige_vol = true,
        teinte = Color(0.25, 0.75, 1.0),
    },
    {
        de = "orbital", vers = "megastructure",
        label = "Planète Alien — descente vers la Mégastructure",
        -- Planète préparée le 14/09, mesurée dans Map_Orbital et livrée lot3.
        position = Vector(3000000, 2200000, 600000),
        rayon = 47800.0, exige_vol = false,
        teinte = Color(0.70, 0.35, 0.95),
    },
    {
        de = "orbital", vers = "foret",
        label = "Sylve — descente vers la forêt",
        position = Vector(-2600000, 2200000, 450000),
        rayon = 47800.0, exige_vol = false,
        teinte = Color(0.20, 0.60, 0.30),
    },
    -- ── LES TROIS MONTÉES ─────────────────────────────────────────────────────
    -- Chaque portail est posé sur le point d'arrivée de son monde : le joueur
    -- qui descend voit tout de suite par où il repartira.
    {
        de = "forge", vers = "orbital",
        label = "Rampe orbitale de la Forge",
        position = Vector(-8599410, 195426, 146475),
        rayon = 6.0 * M,
        exige_vol = true,
        teinte = Color(0.25, 0.75, 1.0),
    },
    {
        de = "tower", vers = "orbital",
        label = "Plateforme de la Tour",
        -- Sur l'arrivée remesurée le 2026-09-08 (l'ancienne position,
        -- -8000000 / 2000000 / 345, était 1,5 km sous le désert).
        position = Vector(-8513420, 2385420, 151935),
        rayon = 6.0 * M,
        exige_vol = true,
        teinte = Color(0.25, 0.75, 1.0),
    },
    {
        de = "alien", vers = "orbital",
        label = "Balise d'Azur",
        -- Sur l'arrivée remesurée le 2026-09-08, comme la Tour.
        position = Vector(-8513420, 4385420, 153506),
        rayon = 6.0 * M,
        exige_vol = true,
        teinte = Color(0.25, 0.75, 1.0),
    },
    {
        de = "capitale", vers = "orbital",
        label = "Spatioport d'Akarlys",
        -- Sur le point d'arrivee, comme les trois autres : le joueur qui
        -- descend voit tout de suite par ou il repartira.
        position = Vector(-8513420, 6385420, 157959),
        rayon = 6.0 * M,
        exige_vol = true,
        teinte = Color(0.25, 0.75, 1.0),
    },

    -- ── LES TROIS DESCENTES SONT DES PLANÈTES ────────────────────────────────
    --
    -- On ne descend pas d'une station par une porte posée sur son pont : on vole
    -- vers un monde et on y entre. Chaque portail est donc CALÉ SUR UNE PLANÈTE
    -- de son système solaire, mesurée après placement.
    --
    -- ── POURQUOI CES RAYONS ───────────────────────────────────────────────────
    -- Chaque planète fait 415 m de rayon ; le portail en fait 478, soit 15 % de
    -- plus. Le joueur déclenche donc le voyage en APPROCHANT la surface, pas en
    -- la touchant — une sphère de collision de 415 m l'arrêterait avant, et il
    -- resterait planté contre un monde sans pouvoir y entrer.
    {
        de = "orbital", vers = "forge",
        label = "Verdant — descente vers la Forge",
        -- Système Verdant, à 40 km au nord du hub. Planète verte, monde boisé :
        -- ce que le joueur voit depuis l'orbite annonce ce qu'il trouvera en bas.
        position = Vector(0, 4400000, 200000),
        rayon = 47800.0,
        exige_vol = false,
        teinte = Color(0.35, 0.85, 0.45),
    },
    {
        de = "orbital", vers = "tower",
        label = "Ocre — descente vers la Tour",
        position = Vector(-3810512, -2200000, -300000),
        rayon = 47800.0,
        exige_vol = false,
        teinte = Color(0.9, 0.45, 0.2),
    },
    {
        de = "orbital", vers = "alien",
        label = "Azur — descente vers l'ile",
        position = Vector(3810512, -2200000, 400000),
        rayon = 47800.0,
        exige_vol = false,
        teinte = Color(0.25, 0.65, 0.95),
    },
    {
        de = "orbital", vers = "capitale",
        label = "Akarlys — descente vers la capitale",
        -- ══════════════════════════════════════════════════════════════════════
        -- CALE SUR `Planet_Half`, MESUREE — pas sur une position inventee.
        --
        -- Un portail sans corps sous lui envoie le joueur voler vers rien. Les
        -- 27 corps du systeme ont donc ete releves avant d'ecrire cette ligne :
        --
        --   SM_PlanetSphere    44,0 km  rayon  416 m  <- portail Verdant
        --   SM_PlanetSphere2   44,1 km  rayon  416 m  <- portail Ocre
        --   SM_PlanetSphere11  44,2 km  rayon  416 m  <- portail Azur
        --   Planet_Half        10,1 km  rayon 1542 m  <- LIBRE, la plus grosse
        --
        -- `Planet_Half` etait le seul grand corps qu'aucun portail n'employait.
        --
        -- ⚠ ELLE ROMPT LA SYMETRIE DES TROIS AUTRES, et il faut le savoir : les
        -- trois premieres forment un triangle a 44 km, espacees de 120°. Celle-ci
        -- est a 10 km et 3,7 fois plus large — donc environ SEIZE FOIS plus
        -- grande dans le ciel du hub. Ce n'est pas un defaut si la capitale doit
        -- dominer l'orbite ; c'en est un si on voulait quatre mondes egaux.
        --
        -- Le rayon suit la convention de l'auteur, verifiee : les planetes de
        -- 416 m portent un portail de 47 802, soit rayon + 15 %. On declenche
        -- donc le voyage en APPROCHANT la surface, pas en la touchant — une
        -- sphere de collision au rayon exact arreterait le joueur avant.
        -- ══════════════════════════════════════════════════════════════════════
        position = Vector(980816, 0, 234346),
        rayon = 177299.0,
        teinte = Color(0.85, 0.75, 0.35),
    },

    -- ── LE PASSAGE AU SOL : AKARLYS ↔ LA SYLVE ────────────────────────────────
    --
    -- Ni une montée ni une descente : les deux mondes sont posés sur le même
    -- plan, à 20 km l'un de l'autre (même X, ΔY = 2 000 000 u). C'est la
    -- géographie qui commande — on ne passe pas par l'orbite pour aller à la
    -- forêt d'à côté.
    --
    -- ⚠ POURQUOI PAS UNE DESCENTE ORBITALE COMME LES QUATRE AUTRES. Il n'y a
    -- plus de corps céleste libre sur un relèvement libre. Les trois seuls
    -- corps de taille utile qui restent — `SM_PlanetSphere27/28/29`, échelle
    -- 3.0, relevés dans `.hermes/diag_planetes.txt` — sont posés 4 km DEVANT
    -- Verdant, Ocre et Azur, sur les lignes exactes du hub vers la Forge, la
    -- Tour et l'Île. Un portail sur l'un d'eux happerait le joueur qui vole
    -- vers l'autre monde. C'est aussi pour ça que la capitale avait reçu
    -- `Planet_Half` : un relèvement à elle.
    --
    -- Historique : la Sylve se rejoignait seulement par Akarlys. Depuis le lot
    -- du 15/09, sa planète dédiée permet aussi l'accès orbital ; route conservée.
    {
        de = "capitale", vers = "foret",
        label = "Route de la Sylve",
        -- ⚠ PAS AU POINT D'ARRIVÉE : le spatioport y est déjà
        -- (-8513420, 6385420, 157959). Deux portails de 6 m au même endroit se
        -- déclencheraient tous les deux, et lequel gagne ne serait pas décidable.
        --
        -- On prend une SONDE MESURÉE, pas un décalage inventé — la ville compte
        -- 13 490 acteurs et un point choisi au hasard tombe dans un bâtiment.
        -- `.hermes/diag_capitale.txt`, sonde « +500 m Y » : sol z = 157 486 sur
        -- `NARVOS_VILLE_BIG_CITY_NIGHT_1_1`. Et +Y est justement la direction de
        -- la forêt : le portail est du bon côté de la ville.
        position = Vector(-8513420, 6435420, 157586),   -- sol 157486 + 1 m
        rayon = 6.0 * M,
        exige_vol = false,
        teinte = Color(0.20, 0.60, 0.30),   -- la Sylve : vert profond
    },
    {
        de = "foret", vers = "capitale",
        label = "Lisière d'Akarlys",
        -- Sol à ce point précis : -8062, mesuré dans nanos le 15/09.
        -- Le portail reste visible à 20 m de l'arrivée, sans l'englober.
        position = Vector(-8513420, 8385420, -7962),
        rayon = 6.0 * M,
        exige_vol = false,
        teinte = Color(0.85, 0.75, 0.35),   -- l'or d'Akarlys : la teinte dit où l'on va
    },
}

-- ── Accès ─────────────────────────────────────────────────────────────────────

local par_id = {}
for _, m in ipairs(Mondes.MONDES) do par_id[m.id] = m end

---@param id any
---@return table|nil
function Mondes.Trouver(id)
    if (type(id) ~= "string") then return nil end
    return par_id[id]
end

--- Monde occupant une dimension, ou nil.
---
--- ⚠ NE SERT PLUS À SITUER UN JOUEUR. Les quatre mondes partagent la dimension 1
--- depuis qu'ils sont séparés dans l'espace ; cette fonction rendrait donc le
--- premier de la liste pour n'importe qui. Employer `ParPosition`.
---@param dimension any
---@return table|nil
function Mondes.ParDimension(dimension)
    local d = tonumber(dimension)
    if (not d) then return nil end
    for _, m in ipairs(Mondes.MONDES) do
        if (m.dimension == d) then return m end
    end
    return nil
end

--- Où se trouve ce point ?
---
--- C'est la seule façon fiable de situer un joueur maintenant que les mondes se
--- partagent une dimension. Les trois mondes planétaires occupent chacun une
--- sphère de 6 km autour de leur décalage ; tout le reste est l'orbite, qui n'a
--- pas de bord.
---@param v any  un Vector, ou une table { X, Y, Z }
---@return table|nil
function Mondes.ParPosition(v)
    if (type(v) ~= "table" and type(v) ~= "userdata") then return nil end
    local x, y, z = v.X, v.Y, v.Z
    if (type(x) ~= "number" or type(y) ~= "number" or type(z) ~= "number") then return nil end

    local r2 = Mondes.RAYON_MONDE * Mondes.RAYON_MONDE
    for _, m in ipairs(Mondes.MONDES) do
        -- Le CENTRE d'abord : c'est là qu'est le contenu. Le décalage du
        -- sous-niveau ne sert de repli que pour un monde qui n'a pas encore été
        -- mesuré — auquel cas les deux coïncident encore.
        local d = Mondes.CENTRES[m.id] or Mondes.DECALAGES[m.id]
        if (d and m.id ~= "orbital") then
            local dx, dy, dz = x - d.X, y - d.Y, z - d.Z
            if ((dx * dx + dy * dy + dz * dz) <= r2) then return m end
        end
    end
    return par_id["orbital"]
end

--- Liaisons partant d'un monde.
---@param monde_id any
---@return table
function Mondes.LiaisonsDepuis(monde_id)
    local sortie = {}
    if (type(monde_id) ~= "string") then return sortie end
    for _, l in ipairs(Mondes.LIAISONS) do
        if (l.de == monde_id) then sortie[#sortie + 1] = l end
    end
    return sortie
end

--- Une liaison précise, ou nil.
---@param de any
---@param vers any
---@return table|nil
function Mondes.Liaison(de, vers)
    for _, l in ipairs(Mondes.LIAISONS) do
        if (l.de == de and l.vers == vers) then return l end
    end
    return nil
end

--- Les noms de sous-niveaux, pour le streaming côté client.
---@return table
function Mondes.Niveaux()
    local sortie = {}
    for _, m in ipairs(Mondes.MONDES) do
        if (type(m.niveau) == "string") then sortie[#sortie + 1] = m.niveau end
    end
    return sortie
end

return Mondes
