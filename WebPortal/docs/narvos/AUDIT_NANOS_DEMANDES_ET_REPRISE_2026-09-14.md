# Reprise nanos : demandes, preuves et corrections

État du 14 septembre 2026. Priorité actuelle : réparer le jeu nanos et intégrer la destination Alien MEGASTRUCTURE. Le développement du lore temporel est une proposition séparée ; il ne déclenche pas ces travaux.

## Périmètre réellement inspecté

L'inventaire initial couvre 65 854 fichiers sous les 74 dossiers de packs de `asset_game`, dont 253 maps sources. La recherche documentaire a recensé 152 documents : 148 fichiers texte lus, représentant 64 contenus distincts, et quatre PDF de documentation fournisseur recensés. Le seul texte contenant les mots de suivi du projet (Narvos, Claude, Hanibes, TODO, FIXME) est `asset_game/README.md`. Les nombreuses copies de textes promotionnels ne sont pas des demandes du joueur. Les autres documents sources peuvent expliquer des assets, sans établir une tâche de Claude.

Les demandes détaillées sont surtout dans `.hermes/BACKLOG_2026-09-13_soir.md`, `CHANTIERS_2026-09-06.md`, `ARCHI_MONDE_2026-09-06.md`, les audits des systèmes/PNJ et la passation du 14 septembre. Les anciens bilans sont confrontés au code et à l'éditeur ; ils ne valent pas confirmation actuelle en jeu.

L'éditeur expose **71 assets World sous /Game/Narvos**. Leurs dépendances directes de projet ont été interrogées dans le registre. Douze maps présentent au moins une référence directe non retrouvée ; certaines sont des démos ou appartiennent à des dossiers exclus du cook. Cette recherche ne certifie ni les dépendances transitives, ni les shaders, ni le chargement client de toutes les maps.

Au début de l'audit, `Map_Narvos` était ouverte avec 15 671 acteurs et cinq sous-niveaux visibles/chargés : Map_Orbital, Map_Forge, Map_Tower, Map_Alien et ForestKitONE. La capitale est placée dans le niveau persistant. Les ajouts sauvegardés ensuite sont décrits plus bas ; le pack actuellement servi n'a pas été remplacé.

## Demande → présence → raccordement → résultat

| Demande et origine | Fichiers/assets et système existant | Raccordement ou défaut établi | État de reprise |
|---|---|---|---|
| Corps personnalisable — backlog A et retour actuel | MetaCustom, catalogue CORPS, mcs-editeur.js, NarvosAnimReel/Bool, BP_NarvosMH_M/F | Post-process Body désactivé sur les deux modèles. AnimBP du pack relit/crée une sauvegarde locale au lieu de laisser les valeurs nanos piloter chaque personnage. | **Corrigé dans l'ADK, pas encore livré** : adaptation du graphe existant et initialisation après construction. Les 16 curseurs sont écrits et relus via les fonctions Blueprint sur chacun des deux acteurs temporaires. |
| Visages modifiables — backlog A | AnimBP_Face_Tool, outils de visage, variables et identités MetaHuman | Catalogue facial absent ; post-process Face désactivé ; références Control Rig invalides dans le journal actuel. | **Partiel / défaillant**. Réparer le récepteur, puis extraire les bornes et raccordements des widgets. Ne pas afficher des curseurs sans effet. |
| Vêtements gris / mal animés — passation et retour actuel | MetaWardrobe déjà intégré au catalogue ; NarvosMaillage ; fonction EnableMasterPose existante | Essai de dix changements sur acteurs temporaires : meshes chargés, leader pose absent sur les dix ; matériaux des bottes H/F différents des matériaux de leurs meshes. | **Défauts reproduits dans l'éditeur**. Corriger le remplacement à chaud et les overrides de matériaux. Cela ne démontre pas que tous les gris ont la même cause. |
| Corps, peau, visage, cheveux, armure modulaires — demande actuelle | Normalisation serveur, apparence persistée, slots de vêtements/grooms et deux BP standards | Le système commun création/inventaire existe ; plusieurs récepteurs ne suivent pas entièrement. | **Réutiliser et compléter**, sans ajouter un second inventaire ou éditeur. Séparer variation de peau et remplacement de visage après vérification des identités/grooms compatibles. |
| Humains, trolls/créatures — demande actuelle | Catalogues Modular/Spawnables/Npc, packs Defender et J.Suko, monstres du projet | Présence de modèles ne prouve pas leur compatibilité comme joueur : animation, sockets, mains, capsule et caméra à qualifier par famille. | **À qualifier**. Conserver la base humaine opérationnelle ; proposer seulement les créatures ayant une chaîne complète adaptée. |
| Caméra — passation | Correctifs Lua caméra/HUD déjà rechargés ; tests antérieurs conservés | L'utilisateur la juge maintenant globalement correcte. | **À préserver**. Ne pas refaire la caméra pour résoudre l'arme. |
| Arme tenue et mains alignées — retour actuel | CharacterBuilder dans Logic/Character.lua, mannequin nanos masqué, retarget MetaHuman, système d'armes existant | La présence de sockets sur le porteur n'établit pas l'alignement des mains du corps retargeté. | **Défaut confirmé par le joueur ; cause exacte encore à mesurer**. Comparer porteur, main droite/gauche retargetée, poses et arme équipée avant tout offset. |
| PNJ transparents / textures — backlog B3/B4/B6 | RAPPORT_PNJ_2026-09-13.md, catalogues de PNJ, imports Merged_Animations et matériaux associés | L'audit antérieur identifie onze entrées translucides et plusieurs familles de références cassées. Le joueur confirme que le défaut persiste. | **À reprendre avec vérification actuelle par matériau**. Ne pas transformer indistinctement toutes les transparences en opaque ; conserver textures et usages réellement transparents. |
| J.Suko incomplet — demande actuelle | Archive Complete J.Suko Animals Pack, jsuko_extrait, générateur animaux, importeurs meshes/animations | Archive relue : 1 302 fichiers de contenu, dont 331 FBX, 322 PNG, sept OBJ, deux WAV et un MP3. Tous ces 663 fichiers importables existent aux tailles attendues dans l'extraction. Les 639 autres sont des ressources Unity/documentation. | **Extraction importable complète par noms et tailles**, pas comparaison de contenu octet par octet. Vérifier ensuite espèces filtrées, importées, cuites et réellement animées. |
| Véhicules spatiaux Unity — chantiers et demande actuelle | Echo One : un FBX et textures ; Spaceship Engine : douze FBX, textures, HDR et sons | Ressources désormais extraites dans deux dossiers distincts ; scripts et contrôleurs Unity ne constituent pas un pilote nanos. | **Récupéré, non intégré** : 16 + 91 fichiers. Préserver les références Unity pour reconstruire correctement matériaux et assemblages. |
| Voyage spatial et ciel étoilé — ARCHI_MONDE, demande actuelle | Mondes.lua, Server/Voyage.lua, Client/Ciel.lua, Map_Orbital, SpaceScenes | Mode Space et réglages nocturnes présents ; Ciel.Appliquer est appelé sur Narvos:Voyage. `/vaisseau` active un mode de vol du personnage : ce n'est pas un véritable véhicule spatial. | **Partiel**. Vérifier étoiles/éclairage dans le client, parcours entre planètes, transitions et retour sûr. Ne pas annoncer que le ciel ou le pilotage sont absents uniquement parce que le résultat est insuffisant. |
| Une destination jouable = une planète — demande actuelle | Quatre descentes orbitales et une liaison terrestre capitale–forêt | La Sylve n'a pas sa propre descente orbitale. Les noms de maps de démonstration ne sont pas tous des destinations de jeu. | **Adaptation requise** : représenter aussi la Sylve et la nouvelle destination MEGASTRUCTURE, sans casser les passages existants. |
| Planète Alien MEGASTRUCTURE — priorité utilisateur | 84 assets promus : 41 StaticMesh, 23 textures, neuf instances de matériau, six matériaux, deux BP, deux World, un BuiltData | L_assets contient 50 acteurs ; L_Showcase_level contient **605 acteurs**, dont 498 StaticMesh et vingt structures flottantes. Aucune de ces deux maps n'est un sous-niveau chargé ni une destination du catalogue actuel. | **Présent et assemblé, destination non branchée**. Réutiliser la scène existante après qualification plutôt que reconstruire tout le kit. |

## Alien : l'écart précis

`Mondes.lua` associe actuellement l'identifiant `alien` au nom **Azur**, à une île tropicale et à `Map_Alien`. Cette île n'est pas la scène MEGASTRUCTURE. Renommer Azur ne satisferait pas la demande.

Les notes du 6 septembre concluaient, à partir de la taille des fichiers, qu'il fallait construire la capitale Zayan. La lecture actuelle de `L_Showcase_level` montre une scène déjà assemblée de 605 acteurs. Cela fournit un point de départ concret ; cela ne prouve pas encore que son sol, ses limites et ses collisions conviennent au gameplay.

Le raccordement recommandé est une **nouvelle destination dédiée**, avec identifiant distinct d'`alien`, copie de travail de la scène MEGASTRUCTURE, planète visuelle et liens aller/retour. Les identifiants, arrivées et sauvegardes d'Azur restent valides.

Les deux maps MEGASTRUCTURE référencent encore en partie `/Game/Megastructure_Scifi_World/…` et en partie `/Game/Narvos/Megastructure_Scifi_World/…`. Aucune dépendance directe n'est absente du registre actuel, mais cela ne prouve pas qu'elles sont toutes livrées. Résoudre les cibles réellement chargées et les dépendances du pack avant cook.

## Planètes et niveaux actuels

| Destination | Niveau ou contenu effectif | Représentation actuelle | Suite |
|---|---|---|---|
| Forge | Map_Forge + décor issu de catalogue | Planète Verdant | Préserver et vérifier aller/retour |
| Tour | Map_Tower | Planète Ocre | Vérifier la référence Rock_SM signalée absente, puis son impact réel |
| Azur | Map_Alien, île tropicale | Planète Azur | Préserver ; distinguer de MEGASTRUCTURE |
| Akarlys | CITY_PACK dans Map_Narvos persistant | Planet_Half | Préserver les placements et sauvegardes |
| Sylve | ForestKitONE | Accès terrestre depuis Akarlys | Ajouter une représentation planétaire et une descente distincte selon la demande actuelle |
| Orbital | Map_Orbital | Hub et environnement spatial | Vérifier ciel étoilé, éclairage et perception des destinations |
| Alien MEGASTRUCTURE | L_Showcase_level comme base | Aucune destination dédiée retrouvée | Nouvelle planète, sous-niveau qualifié, arrivée sûre et retour |

L'inventaire machine des 71 maps permet de distinguer ces niveaux des scènes de démo, intérieurs, outils et autres réserves de contenu. Leur inclusion au registre n'est pas une décision de les transformer toutes en planètes ni une preuve qu'elles sont cuites.

## Autres demandes retrouvées, à conserver dans le suivi

Ces tâches proviennent du backlog du 13 septembre ; leur présence ici n'affirme pas qu'elles sont encore toutes absentes. Les derniers changements de Claude peuvent avoir satisfait une partie du besoin.

- HUD déplaçable avec positions persistées, réinitialisation et boussole.
- Carte H issue de vues aériennes des vraies maps, avec correspondance aux niveaux chargés.
- Radar : tailles/couleurs de PNJ modifiables dans `/editionpnj` et diagnostic de textures compréhensible.
- Menu véhicule et voitures réellement pilotables ; diagnostic moteur/roues déjà instrumenté.
- Menu vaisseau dédié.
- Réassignation effective des touches ; conserver les corrections récentes avant de refaire le système.
- Inventaire raccordé à la logique réelle, compétences et progression ; la demande d'intégrer un autre pack d'inventaire doit être confrontée au choix plus récent de la maquette Inventaire NARVOS déjà branchée.
- Téléphone F7 avec apparence de smartphone et animation d'ouverture.
- Validation des effets 3D, du peuplement, des métiers et de la progression dans le client.

## Ordre des interventions

1. **Alien prioritaire** : qualifier L_Showcase_level, ses matériaux, collisions et échelle ; préparer une destination distincte, son corps planétaire et son retour. Modifier seulement la copie de travail, le raccordement des niveaux et les catalogues/affichages concernés. Risques : références hors pack, éclairage global de la démo, doubles décalages et portail sans sol.
2. **Terminer les corrections de personnages déjà engagées** : corps, remplacement de vêtements, visage puis arme/mains. Réutiliser les fonctions et le retarget existants. Risques : écrasement des paramètres, matériaux hérités, silhouette déformée et régression des identités sauvegardées.
3. **PNJ visibles et cohérents** : diagnostiquer les familles réellement utilisées, corriger références et paramètres prouvés, comparer échelle au repos/en animation. Risques : supprimer une transparence utile, modifier un matériau partagé ou perdre les gains de performance.
4. **Espace et destinations** : étoiles visibles, Sylve représentée, navigation lisible et vérification des changements de ciel. Garder les portails fonctionnels. Risques : portails qui se recouvrent, arrivée dans le vide, volumes de lumière ou brouillard affectant d'autres niveaux.
5. **Vaisseaux récupérés** : importer un premier modèle complet avec ses textures et sockets ; adapter le pilotage à l'autorité serveur nanos, puis étendre. Un FBX disponible n'est pas un véhicule jouable. Risques : matériaux Unity non transposés, collisions, réplication et sortie du véhicule.
6. **Backlog restant** : confronter chaque ancienne demande à son parcours actuel avant toute réparation. Tester par scénario observable et consigner les limites.

## Corrections et ressources produites pendant cette reprise

**Skills :** huit entrées révisées sur douze, avec distinction des preuves, chemins explicites, périmètre nanos et conservation des sources. Les archives Claude restent inchangées. Les douze entrées et leurs liens ont été revalidés après les dernières précisions Unity/MCP ; les références archivées correspondent toujours à leurs empreintes de sauvegarde.

**Corps MetaHuman :** nouvel `ABP_NarvosPersonnalisationCorps`, issu de l'AnimBP existant. Les 275 nœuds du graphe de pose sont conservés ; la branche de 94 nœuds de sauvegarde locale n'est plus atteignable depuis la mise à jour d'animation. Deux initialisations de Body ajoutées après les constructions existantes de BP_NarvosMH_M/F. Les trois assets compilent et sont sauvegardés. Les 16 valeurs et activations sont écrites par NarvosAnimReel/Bool et relues sur chaque acteur temporaire. Les acteurs de test ont été détruits. **Pas encore cuit/livré ; pas encore validé visuellement dans nanos.**

**Unity :** extraction dans `asset_game/moteur_unity/echo_one_extrait` et `spaceship_engine_extrait`. Sources .unitypackage conservées. Les packages URP/Built-in inclus dans Spaceship Engine sont inventoriés ; leur contenu interne n'est pas encore comparé au contenu principal.

### État sauvegardé avant l'arrêt demandé par Aniss

L'audit ci-dessus décrit aussi des constats initiaux. Les évolutions suivantes les complètent ; elles ne signifient pas que le jeu livré a été mis à jour.

- **MEGASTRUCTURE :** deux instances (`MI_emissive_red`, `MI_emissive_white`) avaient leur parent à `None`. Les références des fichiers sources désignent précisément `Materials/Master/M_emissive`. Leur parent promu est restauré, les valeurs de couleur et d'émission conservées, les deux instances sauvegardées. Aucun remplacement approximatif.
- **Map dédiée :** `Map_Megastructure` créée à partir de `L_Showcase_level`. Six acteurs de ciel/éclairage global retirés de la copie seulement ; éclairages locaux et structures conservés. La source a la même empreinte SHA-256 avant/après. La copie est montée dans `Map_Narvos`, avec 598 acteurs énumérés dans le monde assemblé (le WorldSettings de la copie n'est pas compté dans cette énumération). Décalage physique `(-8513420, 10385420, 150000)`, transformation de streaming neutre. Les cinq sondes du point d'arrivée `(-8511120, 10387420, 150100)` touchent le sol de cette map, avec normale verticale. Sauvegardes indépendantes avant modification.
- **Planètes visuelles :** deux corps existants du pack SpaceScenes réutilisés, sans modifier leurs sources ni matériaux partagés. `Narvos_Planete_Alien_Megastructure` à `(3000000, 2200000, 600000)` ; `Narvos_Planete_Sylve` à `(-2600000, 2200000, 450000)`. Rangés dans `Map_Orbital`, rayon mesuré environ 41567 unités ; rayon de déclenchement envisagé 47800. La séparation des corps a été contrôlée ; le parcours visuel client reste à faire.
- **Accès spatial :** aucun nouveau portail Lua n'est ouvert. `Mondes.lua` reste à raccorder après livraison vérifiée des maps. Azur et ses identifiants sont conservés. Pour la Sylve, conserver aussi la route terrestre et placer un retour orbital distinct, avec sol mesuré, afin d'éviter le chevauchement des deux portails.
- **Vêtements/animation :** `EnableMasterPose` existe et fonctionne ; il est désormais appelé après `SetSkeletalMeshAsset` dans `NarvosMaillage` des BP M/F. Le générateur `scripts/adk-mcs-fonctions.mjs` reproduit ce raccordement. Les dix remplacements testés relisent `leader_pose_component = Body`, puis les acteurs temporaires sont détruits. Les deux BP compilent et sont sauvegardés. Cela ne prouve pas encore l'apparence en mouvement dans nanos.
- **Vêtements/matériaux :** audit des 23 SkeletalMesh sous `MetaCustom/Skeletal_Meshes`. Lecture des affectations originales par slot, avec correspondance structurelle unique du format `FSkeletalMaterial` et contrôle des slots déjà sains. **19 slots de huit meshes** ont une référence source connue mais leur Material Instance promue manque dans l'ADK. Cinq autres slots de `Rogue_Rig` sont déjà vides dans la source. Rien n'a été attribué au hasard. Les overrides de chaussures restent également à nettoyer lors du remplacement.
- **Unity :** les 107 fichiers nouvellement extraits ont été comparés par SHA-256 aux contenus de leurs archives : tous identiques. Les 13 FBX ne sont pas encore importés comme véhicules Unreal/nanos.
- **Vérifications :** syntaxe du générateur modifié valide ; les 14 réglages de rendu contrôlés correspondent entre ADK et client. Le dernier contrôle Unreal trouve zéro map et zéro asset non sauvegardé.

**Limite de livraison : aucun cook ni remplacement du pack nanos pendant cette reprise.** Corps, vêtements, matériaux émissifs, maps et planètes ci-dessus sont enregistrés dans l'ADK. Ne pas annoncer leur validation dans le jeu. Les tests visuels, armes/mains, PNJ transparents, visages, matériaux manquants, portails et pilotage restent ouverts.

Preuves additionnelles : `.hermes/ASTRA_megastructure_emissifs_reparation.json`, `ASTRA_megastructure_map_preparation.json`, `ASTRA_megastructure_montage_verifie.json`, `ASTRA_planetes_ajout.json`, `ASTRA_mcs_vetements_apres.json`, `ASTRA_mcs_material_imports.json`, `ASTRA_mcs_materials_plan.json`, `ASTRA_unity_extractions_verified.json`, `ASTRA_etat_avant_arret.json`. Les rapports de tentatives échouées restent conservés ; les fichiers de vérification finale indiqués ici font foi sur les corrections achevées.

## Preuves et références

Preuves locales sous `D:/mes_projet/narvosprime-web-prototype/.hermes/` : `ASTRA_asset_game_notes_scan.json`, `ASTRA_maps_loaded.json`, `ASTRA_maps_registry.json`, `ASTRA_maps_dependencies.json`, `ASTRA_megastructure_levels_probe.json`, `ASTRA_unity_archives_inventory.json`, `ASTRA_mcs_corps_verification.json`, `ASTRA_mcs_vetements_probe.json`. La sauvegarde des deux BP avant raccordement du corps est dans `sauvegardes/mcs-corps-20260914/`.

Le [Meta Customization System](https://www.fab.com/listings/c2446c03-6cc6-4342-8df2-1fd14491e8e3) décrit une personnalisation par animation Blueprint et indique que le pack n'est pas répliqué en réseau : la validation/persistance nanos existante doit donc rester responsable des personnages. [MetaWardrobe](https://www.fab.com/listings/75579f63-a7b9-4a04-8fc4-d3f9c28ef356) cible principalement les corps MetaHuman grands de corpulence normale ; ne pas présumer que toutes ses tenues conviennent aux trolls ou à toutes les proportions.

Référence principale du runtime : [documentation officielle nanos world](https://docs.nanos-world.com/fr/docs), notamment [plugins autorisés](https://docs.nanos-world.com/docs/assets-modding/whitelisted-ue-plugins). Les API internes d'Unreal sont vérifiées dans les sources locales UE 5.7 et la documentation Epic ; les anciennes notes de version ne valent pas contrat courant.