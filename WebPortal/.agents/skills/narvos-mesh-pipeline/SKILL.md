<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
Identifier la chaîne concernée : pipeline web GLB/Draco/KTX2/chunks ou import Unreal/Interchange/cook/pack nanos. Leurs sorties et contraintes diffèrent.
Pour un .unitypackage, réutiliser scripts/unity-extraire-package.py : ouvrir avec sa fonction ouvrir_tar (mode seekable), lire seulement la première ligne de pathname et gérer les chemins Windows longs. Comparer l'archive à l'extraction avant de conclure à des fichiers manquants. FBX et images sont réutilisables ; matériaux/prefabs Unity servent de références de conversion, pas de composants Unreal directement exécutables.
Retrouver l'original et le générateur avant de retoucher un asset dérivé. Comparer transforms, unités, parentage, squelette, animations, matériaux, normales, transparence et références de textures.
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
Inspecter la destination et les sauvegardes avant toute écriture binaire, remplacement de pack ou transformation irréversible ; utiliser le mode de simulation du script lorsqu'il existe.
Vérifier les jonctions et liens physiques : une copie de travail peut partager le fichier d'un pack source. Une sauvegarde destinée à restaurer un binaire doit être indépendante. Distinguer source asset_game, contenu ADK et livraison cuite.
Pour une texture ou un vêtement incorrect, relever acteur, mesh, slot, matériau effectif, parent, textures et UV avant de modifier. Distinguer référence absente, override conservé après changement de mesh, compilation inachevée et éclairage. Traiter d'abord les dépendances du parcours nanos actif ; un défaut de démo ne justifie pas la reconstruction de tout le pack.
Consulter nanos-world pour les contrats du moteur et la référence historique pour les incidents GLB/chunks/KTX2 concernés.
<!-- [FIN INCONNUE — la suite du fichier n'a jamais été lue dans sa dernière version] -->