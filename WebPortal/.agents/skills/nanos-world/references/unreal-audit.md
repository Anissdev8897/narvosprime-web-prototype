# Audit Unreal appliqué au parcours nanos

## Accès et preuves

Le projet possède `scripts/lib/ue-mcp-client.mjs` et `scripts/ue-mcp.mjs`, relatifs à la racine globale. Lire leur interface avant usage et interroger `tools/list` pour les outils et schémas réellement disponibles. L'installation d'un Skill ne prouve ni la connexion MCP ni la présence d'une capacité annoncée dans une archive.
Le schéma d'entrée ne garantit pas une sortie JSON : certains outils renvoient du texte suivi d'un tableau. Examiner le résultat avant de choisir outilJson. Une duplication de Blueprint peut aussi renouveler les GUID des nœuds : comparer la topologie et les valeurs après remappage, pas l'égalité brute des identifiants.

Un port HTTP ouvert ne prouve pas que l'éditeur a terminé son démarrage. En cas de délai dépassé, examiner processus, propriétaire du port et journal avant une nouvelle tentative ; un commandlet de cook peut utiliser le même plugin. Ne pas lancer plusieurs éditeurs ou cooks pour débloquer une requête.

Dans l'ADK actuel, UnrealMCPServer construit son index au démarrage en chargeant tous les Blueprints, même en commandlet (`UnrealMCPServerModule.cpp`, `MCPSearchIndex.cpp`). Pour un cook ou un commandlet Python autonome, utiliser `-DisablePlugins=UnrealMCPServer` : le paramètre est pris en charge par le PluginManager UE5.7 installé. Conserver le plugin dans l'éditeur interactif quand MCP est nécessaire. Cette option évite le chargement inutile des démos ; elle ne dispense pas de traiter les erreurs des dépendances réellement cuites.

Pour un lot ciblé, UE5.7 accepte `-PACKAGE=/Game/Chemin/Asset+...` (`CookCommandlet.cpp`, traitement MAP et PACKAGE). Choisir un nom de sortie court : un chemin de cook rallongé a empêché deux textures de sourcils de cuire à 260/262 caractères, puis produit des erreurs secondaires « NeverCook ». Lire le premier échec avant de modifier les exclusions. Après sauvegarde d'assets dans le même processus, rafraîchir leurs fichiers dans l'Asset Registry avant de conclure sur leurs nouvelles dépendances.

Le nom affiché d'un plugin, le nom de son module et celui du fichier `.uplugin` peuvent différer : Chaos Vehicles expose le module `ChaosVehicles`, mais le plugin installé est `ChaosVehiclesPlugin`. Lire le nom du `.uplugin` avant `-EnablePlugins` ou une modification du projet.

Inspecter un script avant exécution : un générateur de pont ou de fonctions Blueprint peut supprimer et recréer des graphes. Ce n'est pas une sonde en lecture seule. Pour un appel Python distant, vérifier la sortie métier et le journal Unreal ; un transport réussi peut masquer une exception du script.

## Personnalisation : suivre toute la chaîne

1. Identifier le parcours actif : catalogue et filtres UI → validation Lua → fonction du pont → composant ciblé → instance d'animation → sauvegarde/rechargement. Un choix listé ou un curseur affiché ne prouve pas son effet.
   Si une recherche de composant passe par GetObjectName, ne pas comparer sa chaîne avec casse : UE peut préserver `Face` dans l'éditeur et produire `face` dans le client shipping (WITH_CASE_PRESERVING_NAME dépend de WITH_EDITORONLY_DATA). Utiliser une identité FName ou une comparaison insensible à la casse, puis vérifier l'objet réellement modifié dans nanos. Un appel Blueprint sans exception peut n'avoir trouvé aucun composant.
   Dans les sondes du pont, reprendre la conversion de chemins du générateur Lua : le chargement dynamique peut exiger `/Game/Dossier/Asset.Asset`, alors que `unreal.load_asset` accepte aussi le chemin de package. Après un appel, vérifier le mesh/groom/binding réellement chargé avant les matériaux ; un override peut réussir sur un composant dont le mesh est nul et produire un faux diagnostic.
2. Pour un curseur, vérifier nom exact, type, bornes, valeur neutre, instance réceptrice et éventuelle écriture qui l'écrase. Un GetPostProcessInstance peut n'avoir aucun récepteur utilisable si le post-process est désactivé ou sa classe invalide.
3. Pour une erreur Control Rig, lire la classe référencée et ses dépendances, comparer avec la source intacte puis compiler le périmètre concerné. Ne pas substituer un rig homonyme sans vérifier son contrat.
4. Pour un vêtement, comparer avant/après remplacement du mesh : matériau par slot et overrides, squelette, leader pose et animation. Suivre aussi ConstructionScript, parent et initialisation ; l'absence de ces nœuds dans la fonction de remplacement ne prouve pas leur absence partout.
5. Distinguer Blueprint source, outil ou démo, pont actif et version livrée. Avant de conclure « inutilisé », croiser registre des références, chemins chargés dynamiquement, niveaux, manifeste et générateurs. « Usage non retrouvé dans ce périmètre » reste une conclusion valide.

Lors d'un remplacement de vêtement, contrôler les matériaux effectivement rendus après chaque changement, y compris grand mesh → petit mesh → emplacement vide → grand mesh. GetNumMaterials dépend du mesh courant ; il ne mesure pas tous les anciens overrides. En UE5.7, EmptyOverrideMaterials et GetNumOverrideMaterials ne sont pas BlueprintCallable et OverrideMaterials n'est pas BlueprintReadOnly. Vérifier l'en-tête installé avant d'inventer un nœud. Le pont NARVOS nettoie les slots du nouveau vêtement avec GetMaterials et SetMaterial(None), sans toucher à Face/Body ; son générateur partage cette opération avec l'intervention ciblée.

## Réparer et vérifier

Pour les coiffures, lire le `target_skeletal_mesh` réel du GroomBindingAsset : son nom de fichier et le genre supposé ne garantissent pas la compatibilité. Comparer avec le visage effectivement chargé. Les ordres de slots Hair/Cards/Helmet diffèrent entre grooms ; réaffecter les matériaux correspondants après remplacement. Un visage peut utiliser plusieurs matériaux de peau selon ses LODs : son slot 0 ne couvre pas tous les rendus. Distinguer les overrides bruts du résultat de `GroomComponent.GetMaterial`, qui peut substituer un matériau selon la géométrie et ses usages shader. Qualifier ensuite le rendu en jeu.

Relire les valeurs après un setter lorsque son retour est ambigu. Dans UE5.7 installé, `UMaterialEditingLibrary::SetMaterialInstanceTextureParameterValue` initialise son retour à false sans le changer, même après affectation (`MaterialEditingLibrary.cpp:1187`). Vérifier le paramètre avec le getter. Pour un tableau Unreal de structures, modifier une copie du slot puis la réaffecter à l'index avant de réécrire le tableau.

Le builder local `nanos-build-asset-pack.mjs --apply --staging <identifiant>` construit désormais sous `Server/AssetBuilds` et refuse une destination remplie. Il ne livre pas le pack actif. Ne pas assimiler `Packages Remain 0` à un cook sans erreur, ni un inventaire complet à une validation visuelle.

Avant une sauvegarde d'asset, identifier liens physiques et jonctions, conserver une copie indépendante des binaires affectés et le script source du pont. Corriger la plus petite partie défaillante du système existant ; ne pas reconstruire un menu fonctionnel pour contourner un défaut de son récepteur.

Relire le graphe et les propriétés obtenus, vérifier compilation et journal. Pour une livraison de binaires, distinguer sauvegarde ADK, cook achevé, pack effectivement livré puis observation dans le client nanos. Vérifier les personnages et pièces réellement affectés ainsi que leur persistance. Une compilation réussie ne prouve pas l'apparence ni la synchronisation en jeu.

Compiler un Blueprint ne garantit pas sa sauvegarde : sauvegarder explicitement l'asset puis relire ses imports sur disque. Pour élaguer une branche de démonstration déjà déconnectée dans un adaptateur, préserver le graphe actif, ses entrées de données et les variables adressées par nom depuis Lua. `RemoveUnusedVariables` seul pourrait supprimer ces dernières ; ne retirer que les déclarations de types dont l'absence d'usage a été vérifiée.

Une TextureSample dont la propriété Texture est nulle peut recevoir un TextureObject en entrée ou être déconnectée du résultat. Examiner le graphe et le shader compilé avant de la considérer cassée. Un cook peut sortir avec code zéro tout en remplaçant un matériau par celui de défaut : rechercher aussi les échecs de compilation de matériaux et ShaderMap invalides dans le journal.

La génération automatique des chaînes de retarget ne crée pas nécessairement les objectifs IK ni les solveurs. Vérifier les objectifs réels et la pile du rig cible, pas seulement les noms de goals inscrits dans les chaînes. Conserver les correspondances exactes et mesurer les poses après modification ; des positions de mains contraintes avant un post-traitement de proportions ne garantissent pas l'alignement final sur l'arme.

Pour mesurer un AnimBP dans l'éditeur, vérifier que l'aperçu avance réellement (viewport realtime et animation du composant). Un relevé constant sur tous les curseurs peut venir d'une sonde figée : vérifier un effet témoin avant de modifier le graphe. Comparer la géométrie avant/après, pas uniquement les variables ; qualifier séparément le résultat dans nanos.

En Python Unreal, nommer les axes de `Rotator(pitch=..., yaw=..., roll=...)` : l'ordre positionnel n'est pas celui du Rotator Lua nanos. Sur un composant instancié, `set_editor_property` peut relancer la construction et invalider les références détenues ; préférer le setter runtime existant pour une mesure et reprendre le composant après reconstruction. Dédupliquer les handles SubobjectData par chemin d'objet.

Les acteurs de sonde marqués transient peuvent être exclus de `get_all_level_actors`. Conserver leurs chemins exacts et leur propriété de tâche pour les retrouver et nettoyer sans supprimer d'acteurs utilisateur ; ne pas sauvegarder une map uniquement pour conserver une sonde.