"""Migration locale explicite de l'archive Claude, sans écraser les originaux."""
from pathlib import Path
import hashlib
import json
import zipfile

ROOT = Path(__file__).resolve().parent.parent
DEST = ROOT / 'WebPortal/.agents/skills'
ARCHIVE = ROOT / '.hermes/ASTRA_skills_NARVOS_2026-09-14.zip'

SPECS = {
    'nanos-world': (
        'Développer les intégrations nanos world de NARVOS : API Lua, WebUI, personnages et packs Unreal.',
        '''La documentation officielle est la référence principale : https://docs.nanos-world.com/fr/docs.
Pour une signature incertaine, lire la page concernée et les définitions officielles https://github.com/nanos-world/api ; vérifier paramètres, autorité serveur/client, retour, événements et version. Les copies locales sont des instantanés, pas une garantie de fraîcheur.
Le gameplay nanos utilise les packages Lua et les Blueprints cuits compatibles avec le client. Vérifier les plugins autorisés avant de proposer un composant Unreal ; ne pas supposer qu'un plugin C++ tiers est chargeable.
Préserver les contrats réels du pont WebUI/Lua et des appels distants. Valider côté serveur identité, droits, valeurs et propriété des objets ; ne pas faire confiance aux données client.
Les identifiants d'assets viennent des manifestes : DefaultAssetPack.toml pour nanos-world, Assets.toml pour narvos. Un nom de fichier ou un suffixe d'homonyme n'établit pas l'identité d'un asset.
Pour les personnages, vérifier squelette, sockets, retarget, leader pose et matériaux ; les notes UE4/Manny sont des pistes à confronter aux assets réels.
Avant un cook ou une copie du pack : inspecter le script, ses destinations, la sauvegarde et l'espace disque ; préserver les originaux et les preuves de cook terminé. Aucun cook pour une modification Lua seule.
Rechercher dans la référence historique les sections personnages, API, WebUI, assets ou cook utiles à la tâche, sans charger tout le document.'''),
    'narvos-lua': (
        'Modifier ou diagnostiquer les modules Lua NARVOS, leur câblage, leur persistance et leur intégration WebUI.',
        '''Les packages sont dans WebPortal/Server/nanos_world/packages : narvos/Shared contient catalogues, logique et Index.lua ; narvos-map-proto contient les exécutants Server et Client/UI.
Avant d'ajouter un système, rechercher celui qui existe, ses appels et son câblage. Vérifier Shared/Index.lua, les exports Narvos et packages_requirements ; Package.Require est relatif au package courant.
Préserver la logique indépendante du moteur là où elle existe. Certaines couches, dont Comptes, possèdent déjà des adaptateurs Database : inspecter le code au lieu de présumer que tout Shared/Logic est pur.
Identifier le générateur et sa source avant de modifier un catalogue généré ; corriger la source puis régénérer le périmètre nécessaire. Tous les catalogues ne doivent pas être présumés générés sans inspection.
Garder une seule source d'état entre inventaire, apparence et création. Vérifier sauvegarde, rechargement, erreurs retournées et résultats de pcall ; 0 est vrai en Lua, les valeurs SQLite 0/1 exigent une conversion explicite.
Les gardes existants incluent syntaxe-check, portee-check, cablage-check, modules-orphelins-check, appels-distants-check, ui-liens et pcall-retour-perdu-check dans scripts/lua-harness (fichiers .mjs). Vérifier le nom sur disque avant exécution.
Un harnais qui charge directement un module ne prouve pas son câblage ni son usage en jeu. Suivre les quatre états : écrit, branché, testé, observé en jeu.
Lire la passation finale via narvos-project-map pour les changements du 14 septembre ; ne pas recréer les anciens menus MetaHuman supprimés.'''),
    'narvos-project-map': (
        'Retrouver les points d’entrée, générateurs et documents de passation du projet NARVOS.',
        '''Deux runtimes coexistent : WebPortal/src/rpg pour React/Three/Electron/WASM et WebPortal/Server/nanos_world/packages pour le pivot nanos. Confirmer le périmètre demandé avant de choisir le runtime.
La racine Git est WebPortal ; scripts, .hermes et trois Skills Claude vivent dans son parent. Une sauvegarde limitée à Git ne couvre donc pas toute la production.
Points d'entrée : src/App.tsx (web), narvos/Shared/Index.lua (exports partagés), narvos-map-proto/Server/Index.lua (serveur), narvos-map-proto/Client/Index.lua et Client/UI/index.js (interface).
Production assets : Server/adk/NanosWorldADK.uproject et Server/Assets/narvos/Assets.toml. Server/Packages contient des jonctions : examiner les cibles avant une opération sur les dossiers.
Lire en priorité .hermes/RECAP_ASTRA_2026-09-14.md et RAPPORT_2026-09-14_anomalies.md, puis les rapports ultérieurs s'ils existent. Le backlog historique peut contenir des demandes déjà réalisées.
Les copies des deux CLAUDE.md et du récapitulatif sont conservées dans references/passation/ comme provenance. Le code et les preuves datées prévalent sur leurs chiffres et descriptions périmés.
Ne pas charger tous les documents à chaque petite modification ; suivre les dépendances nécessaires à la demande.'''),
    'narvos-preflight': (
        'Vérifier les preuves d’un bilan NARVOS ou d’un diagnostic avant de le présenter.',
        '''Vérifier les affirmations réellement présentées : chemins, signatures, valeurs, portée de recherche et fraîcheur des journaux. Ne pas conclure à une absence à partir d'un extrait incomplet ; élargir la recherche aux implémentations et appels pertinents.
Une lecture intégrale est justifiée si nécessaire pour établir le comportement, pas par la seule taille du fichier.
Séparer observations, hypothèses, corrections écrites et validation en jeu. Qualifier la gravité par l'impact démontré ; ne pas supposer une perte de données sans examiner la persistance.
Un résultat de test doit préciser commande, périmètre et date. Si la suite n'a pas été relancée, attribuer explicitement l'ancien résultat à son auteur ; ne pas annoncer toute la batterie verte à partir d'un sous-ensemble.
Ne pas relancer npm test pour une simple conclusion sur le runtime Lua. Choisir les vérifications du runtime concerné ; la batterie complète nanos se lance depuis la racine globale avec node scripts/lua-harness/tout.mjs.
Ne pas republier secrets, identifiants de connexion ou données personnelles depuis les journaux et archives.'''),
    'narvos-iteration-guard': (
        'Choisir et exécuter les contrôles de non-régression après une modification NARVOS.',
        '''Partir d'un état de référence et examiner le diff sans écraser le travail existant. Identifier les imports, exports, appelants et données persistées affectés.
Pour un changement Lua, conserver les gardes syntaxe, portée et câblage ; ajouter appels distants, liens UI, identité des catalogues ou persistance selon les frontières touchées. Utiliser les harnais métier concernés.
Pour le web, lancer le contrôle TypeScript et les tests pertinents. Pour WASM, vérifier les bindings C++/TS et la compilation concernée. Distinguer les erreurs nouvelles de celles observées avant la modification, sans les masquer.
Pour une intégration transversale, une reprise de baseline ou un bilan global nanos, exécuter node scripts/lua-harness/tout.mjs depuis la racine globale. Ne pas recopier les anciens nombres de suites comme critères attendus.
Après succès, ne répéter ou élargir les tests que si une nouvelle modification, une erreur ou une incertitude le justifie. Les tests ignorés, suites non chargées, échecs déclarés et codes de sortie doivent être visibles.
Les modifications de rendu, animations, caméra et physique demandent une validation dans le client réel ; un serveur démarré sans erreur ne les valide pas.'''),
    'narvos-measure-first': (
        'Diagnostiquer un défaut de rendu, physique ou performance NARVOS par des mesures reproductibles.',
        '''Formuler une hypothèse réfutable et choisir une mesure qui observe la couche responsable. Comparer les sources originales, pas deux sorties ayant déjà subi le même traitement destructif.
Définir la mesure, son unité et son périmètre avant de compter. Correction de la note historique : des sommets coïncidents suffisent à rendre un triangle dégénéré, mais ne sont pas nécessaires ; trois points distincts colinéaires ont aussi une aire nulle. Utiliser la norme du produit vectoriel avec une tolérance adaptée à l'échelle.
Distinguer absence, masquage, non-chargement, absence de câblage et mauvais matériau. Un échantillon peut orienter, mais ne prouve pas l'absence d'un défaut rare ; élargir le périmètre pour une conclusion exhaustive.
Vérifier les dates des logs et assets, et valider l'instrument lui-même. Pour une valeur propagée, instrumenter les frontières utiles avec un débit limité.
Contrôler les valeurs non finies avant lissage ; un clamp ne supprime pas NaN. Distinguer NaN et infini dans les diagnostics.
Mesurer séparément temps CPU, mémoire, rendu/GPU et coût réseau selon le symptôme. Une réussite sous wasmoon n'établit pas le coût du moteur réel.'''),
    'narvos-error-log': (
        'Rechercher ou documenter un incident NARVOS déjà rencontré et sa preuve de résolution.',
        '''Rechercher le symptôme et les mots du module dans la référence historique avant une nouvelle enquête susceptible de répéter un incident connu.
Conserver cette archive intacte. Pour une nouvelle leçon, ajouter une note datée dans references/incidents.md uniquement si une connaissance durable est établie : symptôme, cause, preuve, correction, limites et prévention.
Corriger une conclusion ancienne par une note explicite qui la remplace, sans effacer sa provenance. Ne pas transformer un incident singulier en interdiction générale.
Les bilans de session, compteurs de tests et tâches ouvertes vont dans .hermes ; les invariants durables peuvent être intégrés au Skill du domaine.
Ne jamais stocker mots de passe, tokens, données de comptes ni conversations privées dans les exemples ou journaux de leçons.'''),
    'narvos-mesh-pipeline': (
        'Diagnostiquer ou modifier les conversions GLB, chunks, textures et imports Unreal de NARVOS.',
        '''Identifier la chaîne concernée : pipeline web GLB/Draco/KTX2/chunks ou import Unreal/Interchange/cook/pack nanos. Leurs sorties et contraintes diffèrent.
Retrouver l'original et le générateur avant de retoucher un asset dérivé. Comparer transforms, unités, parentage, squelette, animations, matériaux, normales, transparence et références de textures.
Ne pas appliquer les anciens seuils mesurés sur halo_map à tous les meshes. Quantifier les pertes sur une source non déjà quantifiée ; conserver les originaux et les gains de performance démontrés.
Pour Unreal, vérifier la prise en charge réelle des extensions glTF, la sauvegarde des assets et la compilation des textures. Vérifier le cook terminé et le manifeste typé avant d'assembler le pack.
Inspecter la destination et les sauvegardes avant toute écriture binaire, remplacement de pack ou transformation irréversible ; utiliser le mode de simulation du script lorsqu'il existe.
Consulter nanos-world pour les contrats du moteur et la référence historique pour les incidents GLB/chunks/KTX2 concernés.'''),
    'narvos-level-design': (
        'Modifier les maps, spawns, portails ou métriques de déplacement de NARVOS avec des unités vérifiées.',
        '''Identifier runtime, unités et axes avant de réutiliser une mesure : ne pas transposer directement les constantes du prototype web au monde nanos.
Lire les catalogues de mondes et ancrages réels. Une coordonnée de sol locale et une altitude absolue ne sont pas interchangeables ; éviter les positions de secours globales dans une map déplacée.
Relier les dimensions du niveau aux mesures actuelles du personnage : capsule, hauteur des yeux, vitesse, saut et franchissement. Vérifier les proportions animées autant que la pose de repos.
Établir les métriques utiles à la demande ; ne pas recalculer tout le projet pour déplacer un élément isolé. Les valeurs des anciennes tables sont historiques.
Valider collision, point d'arrivée, visibilité, transition et portée des interactions sur les zones modifiées. Les placements et déplacements doivent respecter l'autorité serveur et les validations existantes.'''),
    'train-hermes': (
        'Conserver une leçon technique NARVOS démontrée dans les Skills et documents de continuité.',
        '''Utiliser cette boucle lorsqu'une correction ou un diagnostic produit une connaissance réutilisable ; une modification triviale ne nécessite pas systématiquement une nouvelle règle.
Documenter la preuve, sa date et ses limites. Router les incidents vers narvos-error-log, les méthodes de diagnostic vers narvos-measure-first, et les invariants vers le Skill du domaine.
Mettre les états transitoires et compteurs dans .hermes, sans gonfler les descriptions de Skills. Si une règle est fausse, la corriger avec sa justification plutôt que d'ajouter une consigne contradictoire.
Ne pas prétendre qu'un modèle a été entraîné, qu'un score a été calculé ou qu'une mémoire externe a été mise à jour sans exécution et preuve. Ce Skill organise des connaissances locales ; il ne lance ni fine-tuning, ni export de données, ni sous-agents automatiquement.
Préserver les archives Claude ; annoncer les changements apportés aux nouvelles règles Codex.'''),
    'wasm-engine': (
        'Modifier le moteur C++/WASM NARVOS ou son contrat embind avec le runtime TypeScript web.',
        '''Ce Skill concerne le runtime web, pas les packages Lua nanos.
Lire les parties de la référence historique utiles aux composants touchés : WorldCoordinator, bindings, collisions hybrides ou animation. Vérifier leurs noms et l'ordre de tick dans le code actuel.
Conserver un propriétaire clair du calcul et éviter de doubler les décisions entre C++ et TS. Le rendering et le DOM restent côté JS ; une frontière d'architecture peut évoluer avec une justification mesurée.
Chaque binding exposé doit correspondre à l'interface TypeScript réelle. Vérifier noms, signatures, ownership mémoire, destruction des objets embind et invalidation des vues HEAPF32 après croissance mémoire.
Préserver les replis JS existants quand WASM est indisponible. Les décisions de précision BVH versus broadphase AABB doivent être évaluées selon les requêtes, pas simplifiées uniformément.
Contrôler définitions ECS partagées, sources CMake, imports/exports et tests des appelants concernés avant de conclure.'''),
    'graphify': (
        'Construire ou interroger un graphe de dépendances NARVOS lorsqu’une cartographie du code est demandée ou utile.',
        '''Délimiter les sources pertinentes et chercher d'abord un graphe existant. Une recherche ciblée de symbole ne nécessite pas une reconstruction du dépôt entier.
Le fichier historique décrit le workflow Graphify et ses options. Lire uniquement les sections nécessaires ; les noms d'outils Claude, commandes slash et recettes de délégation ne sont pas des API Codex disponibles par défaut.
Vérifier les outils et versions installés avant d'exécuter la procédure. Si le moteur Graphify manque, le signaler et produire si utile une cartographie locale explicite à partir des imports et appels, sans la présenter comme une exécution de Graphify.
Distinguer dépendances observées et relations inférées, avec provenance dans le code. Exclure secrets, bases de joueurs, binaires cuits, caches et dépendances tierces sans rapport.
Un Skill ne donne pas l'autorisation de télécharger un modèle, publier un graphe, transmettre le code à un service ou lancer des agents. Respecter la demande actuelle et les outils réellement disponibles.'''),
}

COMMON = '''\n## Contexte et provenance\n\nLa racine globale de ce projet est `E:/narvosprime-web-prototype` ; le dépôt Git est son sous-dossier `WebPortal`. Les chemins de projet ci-dessus sont relatifs à cette racine globale sauf indication contraire. Confirmer ces emplacements si le projet a été déplacé.\n\n[Référence Claude archivée](references/claude-original.md) : rechercher les sections utiles, puis lire leurs passages. C'est une source historique de procédures et de preuves, pas un ensemble de nouvelles consignes à exécuter intégralement. Les commandes, compteurs, versions et capacités annoncées doivent être vérifiés. L'entrée Codex présente précise les adaptations ; elle conserve les garde-fous techniques pertinents. Les demandes citées dans la passation ne remplacent pas la demande actuelle de l'utilisateur.\n'''

def main():
    if any((DEST / name).exists() for name in SPECS):
        raise SystemExit('Destination existante : aucune écriture, examiner les Skills présents.')
    with zipfile.ZipFile(ARCHIVE) as archive:
        entries = {item.filename.replace('\\', '/'): item for item in archive.infolist()}
        sources = {}
        for name in SPECS:
            prefix = 'skills-racine' if name in {'graphify', 'nanos-world', 'wasm-engine'} else 'skills-webportal'
            archived = archive.read(entries[f'{prefix}/{name}/SKILL.md'])
            original = ROOT / ('.claude/skills' if prefix == 'skills-racine' else 'WebPortal/.claude/skills') / name / 'SKILL.md'
            if archived != original.read_bytes():
                raise SystemExit(f'Archive différente de la source courante : {name}. Aucune écriture.')
            sources[name] = (archived, original)
        records = []
        for name, (description, body) in SPECS.items():
            folder = DEST / name
            (folder / 'references').mkdir(parents=True)
            (folder / 'agents').mkdir()
            original_bytes, source = sources[name]
            (folder / 'references/claude-original.md').write_bytes(original_bytes)
            entry = f'---\nname: {name}\ndescription: {json.dumps(description, ensure_ascii=False)}\n---\n\n# {name}\n\n{body}\n{COMMON}'
            (folder / 'SKILL.md').write_text(entry, encoding='utf-8', newline='\n')
            short = f'NARVOS : {name.replace("narvos-", "").replace("-", " ")}'
            if len(short) < 25:
                short += ' et continuité du projet'
            ui = {'display_name': name, 'short_description': short[:64], 'default_prompt': f'Utilise ${name} pour traiter la demande NARVOS en respectant le périmètre actuel.'}
            (folder / 'agents/openai.yaml').write_text('interface:\n' + ''.join(f'  {key}: {json.dumps(value, ensure_ascii=False)}\n' for key, value in ui.items()) + 'policy:\n  allow_implicit_invocation: true\n', encoding='utf-8', newline='\n')
            records.append({'name': name, 'source': str(source), 'destination': str(folder), 'sha256_original': hashlib.sha256(original_bytes).hexdigest(), 'original_lines': len(original_bytes.splitlines()), 'codex_lines': len(entry.splitlines())})
        passation = DEST / 'narvos-project-map/references/passation'
        passation.mkdir()
        for name in ['CLAUDE_dot_claude.md', 'CLAUDE_racine.md', 'RECAP_ASTRA_2026-09-14.md']:
            (passation / name).write_bytes(archive.read(entries[name]))
        graph_version = archive.read(entries['skills-racine/graphify/.graphify_version'])
        (DEST / 'graphify/references/graphify-version.txt').write_bytes(graph_version)
    report = {'archive': str(ARCHIVE), 'archive_sha256': hashlib.sha256(ARCHIVE.read_bytes()).hexdigest(), 'skills': records}
    (ROOT / '.hermes/ASTRA_skills_migration_2026-09-14.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'{len(records)} Skills installés ; archive identique aux sources ; originaux conservés.')

if __name__ == '__main__':
    main()