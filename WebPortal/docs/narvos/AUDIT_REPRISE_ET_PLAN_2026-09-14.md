# Narvos Prime — audit de reprise et plan de transformation

14 septembre 2026 — audit initial d'Astra. Les propositions de ce document ne sont pas des modifications du canon ou du jeu.

## 1. Périmètre et preuves

La bible fournie est [LORE_NARVOS_PRIME.md.pdf](C:/Users/aniss/Downloads/LORE_NARVOS_PRIME.md.pdf), dans Téléchargements. Ses **sept pages ont été lues intégralement**, texte et rendu visuel. La dernière page s'arrête au titre « Où trouver les sources », sans liste de sources : les références ci-dessous ont donc été retrouvées dans le projet.

L'audit couvre la structure des deux runtimes, les catalogues et raccordements concernés par le lore, l'inventaire des packs sources, les journaux d'un démarrage actuel d'Unreal, et une inspection ciblée des Blueprints de personnalisation via le plugin UnrealMCPServer. **Ce n'est pas une certification de chaque texture, matériau ou Blueprint.** Les assets sans anomalie relevée ne sont pas pour autant déclarés fonctionnels.

L'inventaire sous `asset_game`, par dossiers de packs de deuxième niveau, compte **74 dossiers, 65 854 fichiers, 60 294 .uasset, 253 .umap et 5 .uplugin**. Des doublons, démos et versions différentes existent ; ces compteurs ne représentent ni des systèmes indépendants ni des maps prêtes à jouer. [Inventaire détaillé](D:/mes_projet/narvosprime-web-prototype/.hermes/ASTRA_assets_inventaire_2026-09-14.json).

Avant cette demande d'audit, les corrections Lua caméra/HUD ont passé **93 harnais, 10 647 assertions, zéro échec**, par `node scripts/lua-harness/tout.mjs` depuis la racine globale. [Journal](D:/mes_projet/narvosprime-web-prototype/.hermes/ASTRA_camera_hud_tests_2026-09-14.log). Elles ont été rechargées après accord de l'utilisateur et sauvegarde SQLite ; leur validation visuelle complète reste à terminer. Aucun cook et aucune modification d'asset Unreal n'ont été effectués dans cet audit.

## 2. Architecture à préserver

| Couche | Emplacement réel | Responsabilité et précaution |
|---|---|---|
| Sources d'assets | [asset_game](D:/mes_projet/narvosprime-web-prototype/WebPortal/public/asset_game) | Packs Unreal, Unity et sources DCC. Ne pas les traiter comme le code du jeu ; préserver leurs originaux. |
| Production Unreal | [NanosWorldADK.uproject](D:/mes_projet/narvosprime-web-prototype/WebPortal/Server/adk/NanosWorldADK.uproject) | Maps, meshes, matériaux, animations et ponts Blueprint. UE 5.7 ; plugin UnrealMCPServer activé, connexion vérifiée avec 304 outils. |
| Livraison nanos | [Assets.toml](D:/mes_projet/narvosprime-web-prototype/WebPortal/Server/Assets/narvos/Assets.toml) | Assets préparés pour le client. Un fichier source présent ne prouve pas son inclusion ni ses dépendances à l'exécution. |
| Catalogue et logique | [Shared/Index.lua](D:/mes_projet/narvosprime-web-prototype/WebPortal/Server/nanos_world/packages/narvos/Shared/Index.lua) | Raccordement explicite des catalogues, inventaire, quêtes, progression, combat, voyage et apparence. Certains catalogues sont générés depuis TypeScript. |
| Serveur du jeu | [Server/Index.lua](D:/mes_projet/narvosprime-web-prototype/WebPortal/Server/nanos_world/packages/narvos-map-proto/Server/Index.lua) | Entités, sessions, autorité des actions et persistance. Préserver les validations et la sauvegarde existantes. |
| Client du jeu | [Client/Index.lua](D:/mes_projet/narvosprime-web-prototype/WebPortal/Server/nanos_world/packages/narvos-map-proto/Client/Index.lua) | Caméra, entrées, pages WebUI, affichage des résultats serveur. |
| Prototype web | [src/rpg](D:/mes_projet/narvosprime-web-prototype/WebPortal/src/rpg) | Runtime distinct et source de plusieurs catalogues portés en Lua. Une fonction présente ici n'est pas automatiquement opérationnelle dans nanos. |

La racine Git est `WebPortal`. Les scripts de production et une partie des passations sont dans son parent ; une sauvegarde Git seule ne suffit pas. Les jonctions Steam et les éventuels liens physiques d'assets doivent être identifiés avant toute écriture, duplication ou reconstruction.

## 3. CANON / déjà implémenté

Le statut narratif et le statut technique sont deux axes distincts. « Canon dans le PDF », « présent dans un catalogue », « raccordé » et « observé en jeu » ne sont pas interchangeables.

| Élément | À préserver | Confrontation actuelle |
|---|---|---|
| Akar'lys, Mezalayis, Zayan | Noms, natures et conflit initial du PDF | Les trois factions sont aussi proposées par le menu nanos. Ne pas supprimer ce choix pour revenir au seul joueur Akar'lys du document. |
| Neutralité Mezalayis–Zayan | Fait narratif et matrice du runtime web | Confirmée dans `src/rpg/factions/factions.ts`. Le portage de toute la diplomatie dynamique dans nanos n'est pas démontré : l'IA Lua examinée exclut notamment les cibles de même faction, ce qui ne suffit pas à représenter une matrice de neutralité. |
| Quatre Guerriers | Bruiser/Électrique, DPS/Feu, Tank/Terre, Heal/Lumière ; armes et rôles | Base de combat actuelle. Les douze identités de faction du menu correspondent à ces quatre classes : ce ne sont pas douze kits de combat distincts. |
| Dix éléments | Identifiants, effets, forces/faiblesses existants | Catalogue TS porté en Lua. Une description de combo dans un catalogue ne prouve pas sa réalisation visuelle ou complète dans tous les runtimes. |
| Forge, Tower, Orbital, Furiste | Noms, fonctions narratives et quêtes existantes | Les quêtes sont retrouvées. Le catalogue de mondes nanos expose aussi Azur, Akarlys et Sylve de Verdant. Furiste est présent dans les catalogues de contenu ; son parcours complet d'instance nanos reste à vérifier. |
| Boris et les PNJ nommés | Identité, registre direct et militaire ; relais, essences et cristaux | Les quêtes de collecte, de front, de Tour et d'escadrille sont retrouvées dans le catalogue. Ajouter les révélations autour de ces objectifs. |
| Inventaire, équipement, progression | Identifiants, acquis et sauvegardes | Conserver les contrats existants. Le voyage temporel ne doit pas réinitialiser un personnage ou dupliquer ses objets. |
| Apparence | Un seul éditeur réutilisé par création et inventaire | Garder `mcs-editeur.js` et le pont `BP_NarvosMH_M/F` ; réparer leurs fonctions, sans réintroduire un second système de création. |

Sources principales : [factions web](D:/mes_projet/narvosprime-web-prototype/WebPortal/src/rpg/factions/factions.ts), [correspondances nanos](D:/mes_projet/narvosprime-web-prototype/WebPortal/Server/nanos_world/packages/narvos/Shared/Catalogs/Factions.lua), [éléments](D:/mes_projet/narvosprime-web-prototype/WebPortal/Server/nanos_world/packages/narvos/Shared/Catalogs/Elements.lua), [quêtes sources](D:/mes_projet/narvosprime-web-prototype/WebPortal/src/rpg/quests/questCatalog.ts), [mondes](D:/mes_projet/narvosprime-web-prototype/WebPortal/Server/nanos_world/packages/narvos/Shared/Catalogs/Mondes.lua).

### Écarts de continuité à décider, sans correction automatique

- **Couleurs :** le PDF et les factions web emploient bleu/orange/vert ; le menu de création nanos emploie bleu/jaune/violet. Ce sont deux conventions existantes. Garder les palettes actuelles pendant l'audit ; décider ensuite si les accents de menu et les couleurs de faction sont volontairement distincts.
- **Allégeance :** le PDF décrit un joueur Akar'lys ; la création actuelle permet trois factions. Les anciennes missions sont majoritairement akarlys. Il faut définir les raisons d'accès des autres personnages, sans changer leur faction enregistrée.
- **Géographie :** le PDF décrit une Forge industrielle enneigée ; le catalogue nanos actuel parle aussi de relief boisé et possède plusieurs destinations supplémentaires. Ne pas repeindre les maps pour effacer cet écart. Vérifier visuellement les lieux avant de fixer une description géographique définitive.
- **Voyage :** le code gère des passages entre lieux, pas un voyage historique démontré. `epoch` dans WorldSim est un compteur de simulation, pas la preuve d'un système d'époques.
- **Documentation :** des en-têtes décrivent encore des dimensions séparées alors que les mondes actuels du catalogue sont en dimension 1 et séparés spatialement. Le code et les placements réels doivent primer sur ces commentaires historiques.

## 4. IMPLICITE

- Les relais alimentés par les essences supposent un réseau plus large que l'atelier de Boris.
- Une Forge défendue depuis des générations permet une histoire de transmission, de savoir perdu et de devoir militaire.
- Un objectif vertical convoité permet une fonction d'observation ou de contrôle pour la Tower.
- L'Oracle et le Prophète offrent deux lectures concurrentes d'un même phénomène, sans qu'il soit nécessaire de renommer l'un ou l'autre.
- Marchander avec des individus Mezalayis malgré l'hostilité permet contrats, sauf-conduits et intérêts contradictoires. Cela n'implique pas que toute leur faction soit alliée.
- La coexistence d'armes, d'éléments et de technologies permet une origine physique commune à leurs usages. Le lore n'impose pas de supprimer les armes modernes.

## 5. LIBRE

Le PDF laisse ouverts : la nature de Narvos Prime, les origines de la Forge/Tower/Furiste, le but du Prophète, le sens d'Akar'lys, les financeurs des mercenaires, l'origine des pouvoirs, l'accès aux six éléments moins représentés, les règles du voyage temporel et l'issue d'un échec. La [proposition narrative séparée](D:/mes_projet/narvosprime-web-prototype/WebPortal/docs/narvos/LORE_TEMPOREL_PROPOSITION_2026-09-14.md) remplit ces espaces. Elle n'est pas encore du canon accepté.

## 6. PROBLÈMES TECHNIQUES

| Réf. / priorité | Preuve actuelle | Impact et limite du diagnostic | Suite recommandée |
|---|---|---|---|
| T1 — élevée | Générateur MetaCustom : 148/148 options cuites, 16 curseurs corps, **0 visage**. L'UI affiche que le visage est en cours de branchement. | Choix faciaux absents confirmés. Les 148 options n'incluent pas un jeu complet de curseurs faciaux. | Lire widget → sauvegarde → AnimBP ; produire le manifeste facial manquant seulement après vérification du récepteur. |
| T2 — élevée | Le journal Unreal actuel contient `Control Rig has no valid instance class to spawn` dans `Narvos/MetaCustom/Metahuman_Face_Customization/AnimBP_Face_Tool`. | Dépendances invalides confirmées à la compilation de cet asset. Cela ne démontre pas que tous les BP MetaHuman sont cassés. | Comparer les références avec les sources intactes, réparer dans des copies de travail et compiler les BP concernés. |
| T3 — élevée | `NarvosAnimReel` lit `Get Post Process Instance`. Le script de construction historique désactive les post-process Body/Face dans sa première passe. | Risque de curseurs sans effet malgré des appels Lua corrects. Valeurs effectives des composants et instances à sonder avant activation. | Vérifier le post-process réel, la classe, les types des variables et les écritures par frame qui pourraient écraser les réglages. |
| T4 — élevée | Inspection en direct : `NarvosMaillage` charge et remplace le SkeletalMesh ; aucun nœud de réapplication de matériau ou de leader pose dans cette fonction. Le ConstructionScript contient déjà des appels `EnableMasterPose`. | Risque documenté lors d'un remplacement à chaud ; **absence de leader pose dans cette fonction ne prouve pas absence partout**. Vêtement gris ou T-pose à reproduire précisément. | Tester une pièce, relever ses matériaux/animation avant-après, compléter la fonction existante uniquement là où l'état se perd. |
| T5 — moyenne | Erreurs de compilation dans `BP_Meta_Styler` : cible non reliée, tableau sans entrée et propriété `On Character Menu` absente. | Le Styler source intégré est incomplet ; son usage direct par le parcours nanos courant n'est pas établi. | Rechercher les références entrantes, différencier outil/démo/pont actif ; conserver tant que son absence d'usage n'est pas démontrée. |
| T6 — moyenne | Des erreurs de structures et des références manquantes concernent aussi `BP_DemoRoom` et des packs de démonstration. | Dette d'import détectée, pas preuve d'un défaut dans toutes les maps jouables. | Classer les erreurs par dépendance aux maps réellement chargées ; pas de suppression globale des démos. |
| T7 — élevée avant le temporel | Mondes, sous-niveaux, décor persistant et décor GLB coexistent ; certaines transformations sont répétées entre Unreal et Lua. | Risque d'arrivées dans le vide, doublons de décor et collision incohérente lors d'une variante. | Raycasts, repères d'arrivée et test de retour par destination ; préserver la chaîne actuelle de placement. |
| T8 — moyenne | Les signatures souris erronées ont été corrigées, le HUD masqué pendant la création ; tests automatisés verts. | Validation visuelle après rechargement encore incomplète. | Reprendre caméra, défilement de liste, rotation et HUD dans le client ; pas de cook pour ces seuls changements Lua. |

Preuves conservées : [journal Unreal](D:/mes_projet/narvosprime-web-prototype/WebPortal/Server/adk/Saved/Logs/NanosWorldADK.log), [graphes NarvosMaillage](D:/mes_projet/narvosprime-web-prototype/.hermes/ASTRA_mcs_NarvosMaillage_2026-09-14.json), [NarvosAnimReel](D:/mes_projet/narvosprime-web-prototype/.hermes/ASTRA_mcs_NarvosAnimReel_2026-09-14.json), [ConstructionScript](D:/mes_projet/narvosprime-web-prototype/.hermes/ASTRA_mcs_UserConstructionScript_2026-09-14.json), [informations AnimBP facial](D:/mes_projet/narvosprime-web-prototype/.hermes/ASTRA_mcs_face-metahuman_2026-09-14.json).

### Textures, matériaux et BP inutilisés : protocole de preuve

Les erreurs Unreal pertinentes et le démarrage du plugin sont également conservés dans un [extrait figé du diagnostic](D:/mes_projet/narvosprime-web-prototype/.hermes/ASTRA_unreal_diagnostic_2026-09-14.log), car le journal courant sera remplacé lors d'un prochain lancement.

Pour chaque défaut visuel : noter map, acteur, mesh, slot et matériau effectif ; inspecter parent, textures, paramètres, UV, normales/tangentes et dépendances livrées ; comparer éditeur et client au même endroit. Distinguer un matériau manquant d'une mauvaise exposition, d'un shader en cours de compilation ou d'une UV incorrecte. Aucun lot de textures n'est déclaré réparé par ce rapport.

Pour qualifier un BP d'inutilisé : rechercher références du registre, références souples, chargements par chemin Lua et générateurs, niveau persistant/sous-niveaux et manifeste du pack. Le classer « usage non retrouvé » tant que ces sources ne convergent pas. Un fichier absent d'une recherche textuelle seule n'est pas un candidat à supprimer.

## 7. PROPOSITION : réutilisation des packs

| Besoin | Ressources déjà recensées dans asset_game | Usage envisagé et limite |
|---|---|---|
| Forge avant/après une rupture | Crystals and Crafting Environment, Survival Crafting Stations, Farming And Mining Pack, animations de forgeron | Garder les mêmes repères et ateliers ; varier conduites, cristaux, usure et accès. Ne pas remplacer le système de craft. |
| District de civilisation avancée | Metaverse Futuristic Sci-Fi City, MEGASTRUCTURE, Mars Sanctuary, Sci-Fi Props | Enrichir une portion ciblée et cohérente ; ne pas importer toutes les démos ni juxtaposer les styles sans direction artistique. |
| Époque de reconstruction | The Dungeons, packs médiévaux, Village Life, équipements MetaWardrobe | Matériaux et techniques plus rudimentaires, mêmes fonctions militaires ; aucun nouveau framework de combat obligatoire. |
| Ruine / réalité altérée | Meshes existants + variations de matériaux ; nature Open Worlds/Spring Landscape | Réemploi de modules avec transformations et végétation. Les noms de packs ne prouvent pas la disponibilité de chaque effet souhaité. |
| Orbital et passages | Space Scenes, Spaceship Pack, modules sci-fi | Conserver le hub ; compléter le décor. Pilotage, collision et réseau des vaisseaux doivent être vérifiés séparément. |
| Personnages des différentes époques | Meta Customization System + MetaWardrobe | Même identité persistée, tenues et accessoires adaptés après réparation du pont. |

Les packs Unity/DCC sont des réserves de ressources, pas des systèmes exécutables dans nanos. Les frameworks de combat et d'inventaire concurrents peuvent fournir animations, meshes et idées ; ils ne justifient pas le remplacement des modules déjà raccordés. Vérifier versions et plugins permis par la [documentation officielle nanos](https://docs.nanos-world.com/docs/assets-modding/whitelisted-ue-plugins) avant d'intégrer leurs dépendances.

## 8. Architecture proposée pour le voyage temporel

**Ajouter une progression temporelle au voyage existant.** Garder les identifiants des mondes et des quêtes actuels. Pour le premier prototype, deux petites variantes physiques d'un quartier de Forge, avec les mêmes repères locaux et des positions d'arrivée mesurées. Ne pas dupliquer immédiatement Map_Narvos et ses dépendances.

État proposé côté serveur : `monde_id`, `epoque_id`, `instance_id`, progression de découverte et conséquences autorisées. La dimension réseau ne doit pas être confondue avec une époque ni supposée isoler toute la géométrie Unreal. Les mondes actuels partagent la dimension 1 ; commencer avec des espaces séparés et tester la collision, l'IA et l'audio entre variantes.

Transition proposée : demande d'utilisation d'une ancre → validation serveur de proximité, accès, état et délai → préparation du décor client → confirmation de chargement → vérification de la destination → déplacement validé et sauvegarde. En cas de délai dépassé ou d'échec de chargement, garder/replacer le personnage à l'ancre sûre. Le client ne choisit ni une coordonnée arbitraire ni les récompenses.

La classe [Level de nanos](https://docs.nanos-world.com/docs/scripting-reference/static-classes/level) expose le chargement et la visibilité des sous-niveaux **côté client**. Cela aide à l'affichage mais ne fournit pas, à lui seul, la cohérence multijoueur : les règles, l'instance, les interactions et les conséquences restent à concevoir côté serveur. Aucune API imaginaire de « rewind global » n'est supposée.

Pour le prototype, une escouade partage une expédition et son état. Les acquisitions restent persistantes ; une conséquence temporelle est un choix enregistré et limité, pas une réécriture générale de la base. Identifiant unique de récompense par personnage/expédition pour empêcher les doublons. Les autres joueurs continuent leur partie ; un joueur ne décharge jamais le sol des autres.

## 9. Plan par étapes

Les chemins proposés ci-dessous sont nouveaux lorsqu'ils portent la mention **à créer**. Aucun de ces changements n'est déjà réalisé.

| Étape | Fichiers / assets / BP | Pourquoi et apport | Risques et critère de passage |
|---|---|---|---|
| 0. Figer les preuves | Passation, inventaire, PDF source, sauvegarde SQLite et assets avant intervention | Pouvoir comparer et restaurer ; conserver acquis et canon | Liens physiques/jonctions, fichiers hors Git. Ne continuer aux mutations qu'avec destinations et sauvegardes vérifiées. |
| 1. Réparer la personnalisation | `scripts/adk-mcs-fonctions.mjs`, `adk-pont-metahuman.py`, `narvos-metacustom-curseurs.mjs`, `narvos-metacustom-to-lua.mjs` ; `BP_NarvosMH_M/F`, AnimBP facial et dépendances ; `Client/UI/mcs-editeur.js` | Rendre fiables les choix du personnage, futur support des identités d'époque | Risque retarget, grooms, matériaux et anciennes apparences. Exiger compilations ciblées, un homme/une femme, changement de pièce/visage, sauvegarde-reconnexion et observation client. |
| 2. Qualifier les maps actives | `Map_Narvos`, `Map_Forge`, `Map_Tower`, `Map_Orbital`, catalogue Mondes, Server/Voyage, matériaux réellement référencés | Corriger les défauts qui touchent la partie ; cartographier les liens utiles | Déplacement de Landscape, double décor, échelles. Exiger trajet aller-retour, collision et comparaison visuelle avant/après. |
| 3. Ajouter une première révélation | `src/rpg/quests/questCatalog.ts`, dialogues existants, générateurs correspondants, catalogues Quetes/Dialogues Lua | Donner un sens aux relais après « Essences de la Forge », sans modifier ses objectifs/récompenses | Événements de quête non raccordés dans nanos. Vérifier découverte et récompense uniques sur deux personnages distincts. |
| 4. Prototype temporel local | **À créer :** `Shared/Logic/Chronologie.lua`, catalogue d'ancres, `Server/Chronologie.lua`, client de transition ; variantes limitées sous `/Game/Narvos/Chronologie/` ; raccordements Shared/Index et voyage existant | Voir un même lieu à deux dates, obtenir une information passée utile au présent | Desynchronisation, chute, duplication et coût de chargement. Exiger deux clients, arrivée sûre, retour, mort/déconnexion et absence de fuite entre instances. |
| 5. Conséquence jouable | Un relais, un passage et une récompense d'expédition ; état versionné du personnage/groupe | Le passé ouvre un accès ou change une rencontre ; le temps devient une décision | Paradoxes de quêtes/sauvegardes. Exiger comportement déterministe et rejouabilité sans récompenses dupliquées ; aucun reset du monde global. |
| 6. Déployer l'arc Oracle–Prophète | Nouvelles quêtes et dialogues adjacents aux chaînes Tower/Orbital/Furiste ; arènes et PNJ existants | Enquête, preuve contradictoire, boss et choix final fondés sur le lore proposé | Réécriture des missions existantes, accès faction incohérent. Les chaînes originales et identifiants restent valides ; nouvelles branches testées séparément. |
| 7. Étendre les époques et éléments | Variantes de maps qualifiées, modules de pouvoir, interactions environnementales, profils IA | Développer six éléments sans détruire les quatre rôles actuels | Inflation du contenu et déséquilibre. Mesurer CPU/GPU, mémoire, nombre d'entités, chargement et trafic sur le matériel cible avant d'ajouter une époque. |

### Décisions artistiques proposées, non imposées

Retenir une causalité limitée à des ancres et des expéditions, plutôt qu'une réécriture arbitraire du passé. Préserver les quatre classes de combat ; différencier d'abord l'équipement, l'origine et les usages environnementaux. Résoudre l'accès aux missions akarlys par des contrats locaux pour les autres factions, puis tester la cohérence de l'IA ; ne pas transformer silencieusement tous les mercenaires et Zayan en alliés.

## 10. Prochaine intervention concrète

La première correction à préparer concerne **les options du visage et leurs récepteurs Unreal**, avant une nouvelle mécanique temporelle. Les données d'AnimBP montrent déjà des variables de nez, mâchoire, bouche, oreilles et yeux. Il faut maintenant vérifier les bornes, les graphes de connexion, les Control Rigs et les instances de post-process. Afficher leurs noms dans le menu avant cette vérification créerait des contrôles sans effet.

Le développement narratif proposé est livré à part pour pouvoir l'examiner sans altérer le document source ni les données du jeu.

## 11. Skills et effort de raisonnement

Les **12 Skills issus de la passation Claude sont installés** dans `WebPortal/.agents/skills` et disponibles dans cette session. Les entrées sont adaptées à Codex, les références Claude conservées. [Rapport de migration et limitations corrigées](D:/mes_projet/narvosprime-web-prototype/.hermes/ASTRA_REPRISE_2026-09-14.md). L'installation d'un Skill n'installe pas à elle seule ses outils ; la connexion Unreal a ici été vérifiée séparément.

Pour l'équilibre qualité, rapidité et consommation, recommandation propre à ce projet :

| Niveau | Quand l'utiliser |
|---|---|
| Faible | Retrouver un fichier, lire un journal court, corriger un libellé, appliquer une modification locale déjà précisément définie. |
| Moyen — défaut conseillé | Travail courant Lua/WebUI, quêtes simples, tests ciblés, rédaction ou enrichissement local du lore. |
| Élevé | Diagnostic Blueprint/retarget/matériaux, panne difficile, modifications serveur-client-persistance, audit de cohérence du lore temporel. Adapté à la reprise actuelle. |
| Maximal — exceptionnel | Problème transversal resté sans solution après mesures, choix de causalité multijoueur avec effets de sauvegarde, revue finale d'une migration risquée. Redescendre après résolution. |

La [fiche officielle d'Astra](https://developers.openai.com/api/docs/models/gpt-6-astra) confirme plusieurs niveaux d'effort. Le tableau est une recommandation de travail, pas une promesse de coût ou de vitesse : le volume de contexte, les outils et la durée des compilations comptent aussi. Aucun multiplicateur de consommation propre à ton abonnement n'a été établi. Monter le raisonnement ne fait pas compiler Unreal plus vite ; les Skills ciblés et la réutilisation des preuves évitent du travail répétitif.