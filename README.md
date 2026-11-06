📖 XELTHAR RP BEFORE THE FINAL PROPHET Bible narrative

site web : https://narvos.aprojectb.fr
Document de travail pour le scénariste.
Tout ce qui suit est extrait du code réellement jouable  factions, classes, quêtes, dialogues, PNJ, objets. Rien n'est inventé ici.
Les sections sont marquées :
CANON  implémenté, visible en jeu, coûteux à changer
IMPLICITE  le code le suppose sans jamais le dire
VIDE  rien n'existe, terrain libre
⚠️ À lire d'abord : l'univers a une structure solide et une histoire quasi inexistante. Il y a trois factions en guerre, dix éléments magiques, quatre classes, quatre lieux, une trentaine de PNJ nommés  et aucune explication de ce qu'est Narvos Prime, de pourquoi on s'y bat, ni de ce que veut l'ennemi. C'est une bonne nouvelle : la contrainte est nette, la page est blanche.
1. Les trois factions 
Faction	Nature	Couleur	Statut
Akar'lys	Humains	Bleu #0ea5e9	Faction du joueur
Mezalayis	Mercenaires	Orange #f59e0b	Hostiles
Zayan	Aliens	Vert #22c55e	Hostiles


Matrice de relations 
Akar'lys  ↔  Mezalayis   ENNEMIS
Akar'lys  ↔  Zayan       ENNEMIS
Mezalayis ↔  Zayan       NEUTRES   ← le détail le plus intéressant du lore
Les mercenaires ne combattent pas les aliens. Ce n'est pas un oubli, c'est écrit noir sur blanc dans le code. Les Akar'lys sont donc seuls contre deux adversaires qui, eux, se tolèrent.
Trois lectures possibles, toutes ouvertes :
les Mezalayis sont payés par les Zayan
ils ont conclu une trêve d'opportunité le temps d'écraser Akar'lys
ils sont infiltrés, et ne le savent pas tous
Le système est conçu pour que ces relations évoluent en cours de partie (setRelation émet un événement). Un retournement d'alliance est donc jouable mécaniquement, pas seulement narrativement.
Ce que dit Boris, le seul PNJ qui parle de politique 
« Moi ? Je suis un fidèle d'Akar'lys. On tient cette forge depuis des générations. Les Mezalayis voudraient la main dessus, et les Zayan  ces aliens  rôdent dans l'ombre. Toi aussi t'as une faction, non ? Montre-toi digne et t'auras notre confiance. »
C'est l'unique exposé de lore de tout le jeu. Tout le reste en découle.
On en tire : les Akar'lys tiennent la Forge depuis longtemps (ils y sont installés, pas conquérants) · les Mezalayis la convoitent (motif matériel) · les Zayan rôdent (motif inconnu  et c'est le trou le plus intéressant).
 Questions ouvertes pour toi
Que veulent les Zayan ? Ils ont un Prophète dans leurs rangs : mobile religieux ? La Forge est-elle un lieu saint pour eux avant d'être une usine ?
Que signifie Akar'lys ? Le nom sonne comme une lignée ou un serment, pas comme unenation. « Fidèle d'Akar'lys »  fidèle à quoi, à qui ?
Les Mezalayis sont des mercenaires : qui les paie ?
Le joueur choisit-il sa faction ? Boris dit « toi aussi t'as une faction, non ? », mais toutes les quêtes existantes sont akarlys. Ambiguïté à trancher.
2. Les lieux 
Forge World  le front
Zone industrielle enneigée, canyons de roche, structures massives. Contestée : les Akar'lys y tiennent une ligne qui recule (« on tient la ligne, mais on perd du terrain »  Boris).
On y extrait des Fragments de Vie et des Cristaux d'Énergie, qui alimentent les « relais akarlys ». Le mot relais implique un réseau  donc autre chose à alimenter, ailleurs. 
Les vagues d'hostiles déferlent par le nord. 
Orbital Hub  la station
Hub spatial, combat de vaisseaux, univers sans barrière physique. Une escadrille fantôme y a été repérée. Récompense de sa destruction : une clé de corvette  le joueur gagne un vaisseau en éliminant ceux qui le menaçaient.
Tower la verticale
On la tient, puis on la gravit jusqu'à un « poste avancé en surplomb ». Les assaillants y convergent : c'est un objectif, pas un passage.  Rien ne dit ce qu'elle contient ni qui l'a bâtie.
Donjon Furiste  l'instance
« Un portail instable pulse d'une énergie bestiale. »
Seul élément franchement surnaturel du jeu. Le mot bestiale dénote : ailleurs le vocabulaire est militaire et industriel. Le portail est instable  donc quelqu'un ou quelque chose l'a ouvert.
 Origine, contenu, lien avec les factions : rien.
3. Les quatre classes 
Toutes sont des « Guerriers ». Il n'y a ni mage, ni voleur, ni prêtre : tout le monde est soldat, y compris le soigneur (« médic de combat ») et le lanceur de sorts. C'est une armée, pas une compagnie d'aventuriers  un choix de ton fort, à respecter dans l'écriture.
Classe	Élément	Rôle	Arme	Identité
Guerrier Bruiser	Électrique	DPS mêlée	Claymore	"Frappe lourde, impacts dévastateurs"
Guerrier DPS	Feu	DPS distance	Fusil	"Tireur d'élite, burst critique"
Guerrier Tank	Terre	Tank	Épée + bouclier	"Forteresse vivante, protège l'escouade"
Guerrier Heal	Lumière	Support	Pistolet	"Médic, soigne et purifie sous le feu"


 Une claymore électrifiée et un fusil incendiaire cohabitent : la technologie et la magie ne sont pas séparées dans cet univers. Personne n'explique pourquoi. C'est peut-être le cœur du sujet.
4. Les dix éléments 
Feu · Eau · Glace · Électrique · Poison · Terre · Vent · Lumière · Ombre · Vide
Chacun porte un effet de statut et un triangle force/faiblesse. Les quatre classes n'en couvrent que quatre : feu, électrique, terre, lumière.
 Les six autres  Eau, Glace, Poison, Vent, Ombre, Vide  existent mécaniquement mais n'appartiennent à personne. Un scénariste peut :
les attribuer aux factions ennemies (les Zayan seraient-ils Vide ou Ombre ?)
en faire des classes futures
en faire des éléments perdus, ce qui expliquerait pourquoi les humains n'en maîtrisent que quatre
Le Vide est le seul dont le nom appelle une cosmologie.
5. Le peuplement 
Akar'lys  humains, hiérarchie militaire
Boris, Maître Forgeron  le donneur de quêtes de la Forge. Parle rude et direct : « Salut. La Forge a besoin de bras. » C'est la voix établie du jeu ; toute écriture doit s'y accorder ou justifier son écart.
Sous-Major, Général, Général (Mission)  la chaîne de commandement. Soldat Humain, Soldat Femme, Soldat Vert, Tank Humain  la troupe.
Mezalayis  mercenaires
Grand Chef, Kgnitig  marchands.  On commerce avec une faction officiellement ennemie. Contradiction féconde : la guerre n'empêche pas les affaires.
Tosus (Brunt)  piétaille hostile.
Zayan  aliens
Gronomi (Mineur, Ardent, Infanterie), Grongnoni Majeur, Mercenaire Alien, et le Prophète.
 Deux indices lourds : le nom Gronomi Mineur évoque une caste ou un stade de croissance, pas un grade. Et un Prophète implique une foi, donc un dieu, donc un motif qui n'est pas territorial.
Marchands itinérants 
Lyra · Forgemaître Kael · Brunha · Drog · Oracle Vesh · Marchand Errant · Garagiste Talen
 Oracle Vesh est le second indice mystique du jeu, côté allié cette fois. Un oracle et un prophète dans deux camps opposés : symétrie à exploiter.
Garagiste Talen vend des véhicules et des clés d'invocation de vaisseaux.
6. Progression narrative actuelle 
FORGE          Premier sang
                 ├── Ligne de front ──→ Purge de la Forge
                 └── Essences de la Forge

TOWER          Tenir la Tour ──→ Jusqu'au sommet

ORBITAL        Patrouille Spatiale ──→ L'Escadrille Fantôme  →  clé de corvette

INSTANCE       L'Appel du Donjon Furiste  →  portail
Objets nommés : Fragment de Vie · Cristal d'Énergie · Potion de Soin (majeure, suprême) · Potion de Mana majeure · Kit de réparation · Clé de corvette.
 La progression est purement militaire : tuer, atteindre, collecter. Aucune quête ne fait découvrir quelque chose. C'est le manque le plus criant, et sans doute le premier chantier : il n'y a aujourd'hui aucun moment où le joueur apprend quoi que ce soit sur le monde.
7. Ce que le titre promet, et que rien ne tient 
« Narvos Prime » n'apparaît nulle part dans le contenu. Ni dans une quête, ni dans un dialogue, ni dans un nom de lieu. Le seul écho est le message de bienvenue : « Bienvenue sur Narvos Prime, aventurier ! »
Donc : Narvos Prime est le nom du monde, et ce monde n'a pas d'histoire.
Prime suggère un système à plusieurs corps  une planète principale parmi d'autres. L'Orbital Hub va dans ce sens : on quitte la surface, il y a un au-dessus.
Trois axes possibles, aucun n'est engagé par le code :
Narvos Prime est une colonie humaine  les Akar'lys sont les descendants des premiers arrivants (« depuis des générations »), les Zayan les autochtones dépossédés. La Forge serait bâtie sur quelque chose qui leur appartenait.
Narvos Prime est un monde-machine  la Forge n'est pas une forge mais la Forge, une infrastructure planétaire. Les « relais » sont ses nerfs. Les dix éléments seraient ses fonctions, dont six ont été perdues.
Narvos Prime est un champ de bataille hérité  la vraie guerre est finie depuis longtemps, tout le monde se bat pour des raisons oubliées, et le Prophète est le seul à s'en souvenir.
8. Contraintes à respecter
Ce qui est coûteux à changer (câblé dans le code) :
Les trois noms de factions et leurs couleurs
Les quatre classes, leurs éléments et leurs rôles
Les dix éléments et leur triangle
Les noms de PNJ existants (Boris, Lyra, Kael, Brunha, Drog, Vesh, Talen…)
Les quatre lieux
Le registre de Boris : familier, militaire, direct
Ce qui est libre :
L'histoire, les origines, les motivations
Le sens du mot « Forge »
Ce que veulent les Zayan
L'identité de qui paie les Mezalayis
Ce que contient la Tour et qui l'a bâtie
L'origine du portail Furiste
Les six éléments orphelins
Absolument tout ce qui touche à Narvos Prime en tant que monde
9. Les cinq trous à combler en priorité
Le mobile Zayan. L'antagoniste n'a aucune motivation. C'est le manque le plus structurant : sans lui, la guerre n'a pas d'enjeu.
Ce qu'est la Forge. Un lieu de travail ? Une relique ? Une arme ? Le vocabulaire (relais, essences, cristaux) suggère bien plus qu'une usine.
La neutralité Mezalayis–Zayan. Elle est écrite dans le code et inexpliquée. C'est un cadeau : un mystère déjà mécaniquement présent.
Une quête qui apprend quelque chose. Aujourd'hui on tue, on atteint, on collecte. Jamais on ne comprend.
Le sens du titre. Le joueur est accueilli sur un monde dont on ne lui dira jamais rien.
10. Où trouver les sources

📖 Partie II  Lore canonique étendu
À partir d'ici, les sections suivantes fixent le lore officiel de Narvos Prime. Elles ne contredisent rien de ce qui précède : elles comblent les trous identifiés en respectant chaque nom, couleur, classe, rôle, arme, élément, lieu, PNJ et relation de faction déjà établis.
11. Vérité narrative centrale (nouveau canon)
Narvos Prime est un monde-machine ancien, partiellement terraformé. La Forge en est le cœur énergétique et biologique : elle transforme les Fragments de Vie et les Cristaux d'Énergie en puissance pour les relais planétaires disséminés à travers le monde.

Deux peuples se disputent, sans le savoir pleinement, les restes de cette infrastructure :
Les Akar'lys sont les descendants humains des premiers gardiens de la Forge. Leur nom vient d'une ancienne expression zayan signifiant « gardiens du premier feu », mais ils ont oublié cette origine depuis des générations. Ils croient défendre une forge industrielle ; ils protègent en réalité un organe vital de la planète.
Les Zayan sont les descendants extraterrestres des architectes originels de Narvos Prime. Ils ne cherchent pas simplement à conquérir un territoire : ils veulent réveiller le réseau planétaire et récupérer la mémoire de leur peuple  même si cela exige de couper les relais humains et de sacrifier la colonie Akar'lys. Leur Prophète reçoit des fragments de mémoire provenant directement du cœur de la planète : ses visions sont la source de toute la doctrine zayan.
Ce canon explique chaque indice déjà présent : le mot relais (un réseau, pas un simple poste), le vocabulaire de la Forge (« essences », « cristaux »), et le mélange de technologie et de magie observé dans les armes des Guerriers.
12. La neutralité Mezalayis–Zayan expliquée  (nouveau canon)
La matrice de relations ne change pas : Akar'lys est en guerre contre les deux autres, Mezalayis et Zayan restent neutres entre eux. Voici pourquoi, sans jamais le contredire.
Les Mezalayis sont liés aux Zayan par un ancien contrat de récupération. Ils sont payés pour extraire des noyaux, des cristaux et des accès de la Forge, mais une clause stricte leur interdit d'attaquer les Zayan. Leur commanditaire réel est un consortium marchand orbital anonyme  un mystère volontairement non résolu, exploitable plus tard.
Motivation	Détail
Mezalayis	Convoitent la Forge pour ses ressources et pour solder leur dette envers le consortium.
Zayan	Tolèrent les Mezalayis car ils ouvrent des zones interdites sans appartenir à l'ancienne guerre.


⚠️ Alliance fragile. Cette neutralité est une alliance provisoire d'opportunité, pas une paix durable. Elle peut basculer : si le consortium orbital change ses priorités, ou si les Zayan jugent les Mezalayis devenus une menace pour le Réveil, le setRelation peut faire basculer ce statut en hostilité  un retournement de scénario prêt à l'emploi.

13. Les lieux, développés (nouveau canon)
Forge World
C'est l'ancienne chambre industrielle du cœur de la planète. Les Akar'lys y exploitent, sans le savoir, un organe vital de Narvos Prime : chaque Fragment de Vie extrait affaiblit un peu plus le réseau que les Zayan tentent de réveiller. C'est le front militaire visible, mais aussi l'enjeu silencieux de toute la guerre.
Tower
La Tour est un relais vertical zayan, construit pour transmettre les signaux du cœur planétaire vers l'orbite. Son sommet, le « poste avancé en surplomb » que les assaillants convergent pour défendre, contient une antenne de réveil et des archives fragmentées  les premiers vestiges tangibles de l'histoire zayan que le joueur peut rencontrer.
Orbital Hub
Station humaine installée en orbite autour de Narvos Prime. L' escadrille fantôme n'est pas un simple raid hostile : c'est une ancienne flotte automatique qui protège la mémoire planétaire et répond à un signal du Vide. La clé de corvette gagnée après sa destruction est un fragment récupéré de cette technologie ancienne.
Donjon Furiste
C'est une poche dimensionnelle, ou biosphère de confinement, créée par la Forge elle-même pour contenir une forme de vie élémentaire devenue incontrôlable. Le portail « instable » n'est pas ouvert par magie gratuite : il s'ouvre à cause de la surcharge des relais, chaque bataille autour de la Forge affaiblissant un peu plus le confinement.
14. Le sens des dix éléments (nouveau canon)
La liste des dix éléments et leur triangle de forces restent inchangés. Voici le sens narratif donné à chacun, sans en faire de nouvelles classes jouables.

Élément	Sens narratif
"Feu, Électrique, Terre, Lumière"	"Fonctions stabilisées de la Forge, les seules que les Akar'lys savent encore canaliser à travers leurs armes."
Eau	"Fonction perdue liée au refroidissement originel des relais ; aujourd'hui associée aux castes Gronomi chargées de l'entretien."
Glace	"Fonction de mise en sommeil, utilisée par les Zayan pour figer des zones avant le Réveil."
Poison	"Fonction interdite, issue d'anciennes armes zayan de purge ; crainte et taboue même chez les Zayan."
Vent	"Fonction de transmission atmosphérique, liée aux signaux envoyés depuis la Tour vers l'orbite."
Ombre	Fonction associée au Mercenaire Alien et aux opérations discrètes zayan en territoire ennemi.
Vide	"Fonction la plus ancienne et la plus crainte : le signal auquel répond l'escadrille fantôme, et la source des visions du Prophète."

15. Chronologie de Narvos Prime  (nouveau canon)
La Construction. Les architectes zayan originels bâtissent Narvos Prime comme un monde-machine, avec la Forge pour cœur et les relais pour nerfs.
Le Grand Sommeil. Pour une raison encore non révélée, le réseau planétaire s'éteint. Les Zayan se dispersent ou s'endorment ; la mémoire du peuple se fragmente dans le cœur de la planète.
L'Arrivée humaine. Des colons humains découvrent la Forge endormie et s'y installent comme gardiens, sans comprendre sa vraie nature. Ils deviennent les Akar'lys, « gardiens du premier feu ».
L'Oubli. Au fil des générations, les Akar'lys oublient l'origine zayan de leur nom et de leur mission. La Forge devient une usine à leurs yeux.
Le Contrat Mezalayis. Un consortium marchand orbital anonyme engage les Mezalayis pour récupérer discrètement cristaux et accès, moyennant une clause de non-agression envers les Zayan.
Le Réveil du Prophète. Un individu zayan commence à recevoir des fragments de mémoire du cœur planétaire. Il devient le Prophète et rallie les siens à l'idée du Réveil.
La Guerre de la Forge. Les Zayan attaquent pour reprendre le contrôle des relais. Les Akar'lys, ignorant tout, défendent leur « usine » comme une question de survie.
Le Début du jeu. Le joueur arrive sur Narvos Prime au plus fort du conflit, sans connaître aucune de ces vérités  exactement comme Boris lui-même.
Vérités cachées et mensonges de chaque faction
Faction	Ce qu'elle croit / dit vs. la vérité
Akar'lys	"Croient défendre une forge industrielle ; en réalité, ils protègent  et épuisent  un organe vital planétaire dont ils ont oublié l'origine."
Mezalayis	"Disent travailler pour un « client » discret ; en réalité, un consortium orbital les exploite pour une dette qu'ils ne solderont peut-être jamais."
Zayan	"Affirment vouloir « réveiller » leur monde ; en réalité, ce Réveil impliquerait de couper les relais humains et de sacrifier la colonie Akar'lys."



Enjeu du joueur : découvrir, mission après mission, que la guerre qu'on lui a demandé de livrer repose sur un oubli collectif  et choisir, à terme, ce qu'il fait de cette vérité.
Révélation intermédiaire : dans la Tour, le joueur découvre les archives fragmentées prouvant que « Akar'lys » est un mot zayan  la première fissure dans le récit officiel de Boris.
Révélation finale : le Prophète révèle que le Réveil complet nécessite de sacrifier la Forge elle-même  donc tout ce que les Akar'lys ont bâti dessus. Le jeu se termine sur ce choix non résolu, ouvert à une suite.
16. Nouvelles quêtes narratives  (nouveau canon)
Ces cinq quêtes s'insèrent dans la progression existante et font enfin découvrir quelque chose au joueur.
1. Le Mot Oublié  (après Premier sang)
Objectif : récupérer une plaque gravée sur un Gronomi vaincu.
Découverte : Boris ne reconnaît pas l'inscription  elle ressemble étrangement au mot « Akar'lys ».
Conséquence : plante le doute sur l'origine du nom de la faction, sans encore le résoudre.
2. Essences Vivantes  (variante d'Essences de la Forge)
Objectif : escorter un Fragment de Vie fraîchement extrait jusqu'au relais.
Découverte : le fragment réagit comme un tissu vivant, pas comme un minerai  il « saigne » de lumière quand il est endommagé.
Conséquence : sème le malaise chez les soldats Akar'lys quant à la nature réelle de la Forge.
3. Les Archives de la Tour  (après Jusqu'au sommet)
Objectif : explorer les archives fragmentées au sommet de la Tour.
Découverte : une inscription zayan traduite partiellement confirme que « Akar'lys » signifiait « gardiens du premier feu ».
Conséquence : révélation intermédiaire officielle  le joueur sait désormais ce que Boris ignore encore.
4. Signal du Vide  (après L'Escadrille Fantôme)
Objectif : analyser l'épave de l'escadrille fantôme récupérée avec la clé de corvette.
Découverte : l'épave émettait un signal répété depuis des siècles, synchronisé avec les visions du Prophète zayan.
Conséquence : relie pour la première fois l'Orbital Hub, le Vide et le Prophète dans l'esprit du joueur.
5. Ce Que Contient Le Portail  (après L'Appel du Donjon Furiste)
Objectif : pénétrer la biosphère de confinement et affronter la forme de vie élémentaire.
Découverte : le portail n'est pas une faille magique mais une fuite de confinement causée par la surcharge des relais que le joueur lui-même alimente en combattant.
Conséquence : le joueur comprend que chaque victoire militaire a un coût caché sur l'équilibre de la Forge  graine de la révélation finale.
17. La langue zayan  le Zha'vori  (nouveau canon)
Logique sonore et grammaticale
Le Zha'vori privilégie les consonnes dures (zh, k, v, th) suivies de voyelles longues, et marque les concepts sacrés par une apostrophe interne (zha'vori, kor'esh). L'ordre des mots est objet-verbe-sujet, reflétant une pensée collective où l'action et son objet précèdent celui qui agit. Les noms liés au cœur planétaire ou à la mémoire prennent systématiquement le préfixe « zha- ». Les traductions françaises ci-dessous sont des équivalents de sens, pas des traductions mot à mot.
Lexique

Zha'vori	Prononciation	Traduction	Signification
Zha'voria	(ja-VOR-ya)	monde	"Désigne Narvos Prime comme un être vivant, pas un lieu."
Kor'esh	(kor-ÈCHE)	Forge	"Littéralement « l'organe qui brûle » ; jamais utilisé pour une forge ordinaire."
Zha'thuun	(ja-TOUNE)	cœur	"Le cœur planétaire, source de toute mémoire et de toute énergie."
Zha'mir	(ja-MIRE)	mémoire	"Toujours au pluriel implicite : la mémoire est collective, jamais individuelle."
Essara	(ès-SA-ra)	vie	"Racine du mot « essence », employé aussi pour les Fragments de Vie."
Vorthak	(vor-THAK)	énergie	Désigne aussi bien les Cristaux d'Énergie que la force vitale brute.
Nessil	(nè-SILE)	humain	"Neutre, sans mépris ni affection particulière."
Akar'lyth	(a-kar-LITH)	Akar'lys	"Forme originelle de « gardiens du premier feu », à l'origine du nom de la faction humaine."
Mezal'tho	(mè-zal-THO)	Mezalayis	"Littéralement « ceux qui portent sans jurer »  des mains neutres, sans serment."
Doreth	(do-RÈTH)	ennemi	"S'applique strictement à ceux qui empêchent le Réveil, jamais par simple hostilité militaire."
Sheva	(CHÉ-va)	allié	"Terme rare, réservé à ceux qui partagent le serment du Réveil."
Zha'nor	(ja-NOR)	prophète	Celui qui « porte les fragments » du cœur planétaire.
Nivash	(ni-VACHE)	vide	"Le silence d'avant le monde ; aussi le nom du signal que suit l'escadrille fantôme."
Threnish	(trè-NICHE)	ombre	Associée aux opérations discrètes et aux castes Mercenaire Alien.
Zha'vel	(ja-VÈLE)	portail	"Une ouverture de confinement, jamais un simple passage magique."
Esharion	(é-cha-ri-ON)	tour	Désigne spécifiquement un relais vertical de transmission.
Oryn'tha	(o-rin-THA)	ciel / orbite	"L'au-dessus, là où veille l'ancienne flotte."
Vash'tor	(vach-TOR)	serment	Un lien plus fort qu'une alliance : briser un vash'tor est le pire déshonneur zayan.
Fenori	(fè-NO-ri)	liberté	"Toujours associée à la libération de la mémoire, jamais à l'individu seul."
Dhorveth	(dor-VÈTH)	sacrifice	"Un don nécessaire, jamais une perte : terme central dans la doctrine du Prophète."
Zha'kirin	(ja-ki-RIN)	réveil	Le but ultime zayan : la renaissance du réseau planétaire.
Solenne	(so-LÈNE)	paix	"Rare dans le vocabulaire zayan, car perçue comme un état fragile et temporaire."
Zha'kor	(ja-KOR)	flamme-mère	Le premier feu dont les Akar'lys tirent leur nom oublié.
Vorith	(vo-RITH)	relais	"Chaque nœud du réseau planétaire, dont la Tour et la Forge font partie."
Essh'kalin	(èche-ka-LIN)	archive fragmentée	"Un souvenir incomplet du peuple zayan, comme ceux trouvés dans la Tour."
Zha'nessa	(ja-NÈ-sa)	colonie oubliée	"Terme zayan désignant les Akar'lys  avec une pointe de pitié, pas de haine."

Phrases en usage
Devise des Zayan : « Zha'kirin voreth, nivash doreth. »  « Le réveil est notre droit, le vide notre seul ennemi. »
Phrase du Prophète : « Zha'mir essaria, Zha'thuun kirin. »  « La mémoire vit encore, le cœur va se réveiller. »
Formule rituelle liée à la Forge : « Kor'esh vorthak, Zha'kor essaria. »  « Que la Forge garde sa flamme, que la flamme-mère vive. »
Phrase d'un PNJ zayan en jeu : « Nessil doreth, Mezal'tho sheva  pour l'instant. »  « L'humain est l'ennemi, le Mezalayis un allié  pour l'instant. »
Serment d'un jeune Zayan : « Vash'tor fenori, dhorveth solenne. »  « Mon serment est la liberté, mon sacrifice sera la paix. »
Avertissement d'un Gronomi Majeur : « Vorith kirin, Zha'nessa threnish. »  « Le relais s'éveille, la colonie oubliée tombera dans l'ombre. »
Salutation entre Zayan : « Zha'voria essaria sheva. »  « Que le monde reste vivant entre alliés. »
Dernières paroles d'un Zayan tombé : « Nivash zha'kirin, essh'kalin fenori. »  « Du vide naîtra le réveil, de l'archive naîtra la liberté. »
Rappel : ces traductions sont des équivalents de sens, destinés à préserver le ton rituel et collectif du Zha'vori plutôt qu'une exactitude mot à mot.
18. Guide de ton et d'écriture  (nouveau canon)

Voix	Registre à tenir
Boris / Akar'lys	"Familier, militaire, direct. Phrases courtes, ordres clairs, aucune emphase poétique."
Zayan	"Rituel, imagé, collectif. Le « nous » prime sur le « je » ; les métaphores renvoient au feu, à la mémoire et au réveil."
Mezalayis	"Professionnels cyniques qui négocient tout. Ton transactionnel, répliques brèves, jamais d'idéalisme."



Les descriptions de lieux et d'ambiances doivent mêler science-fiction militaire, mystère ancien, forge, neige, métal, braises, lumière élémentaire et ruines extraterrestres  jamais un seul registre isolé.
Résumé canonique
Narvos Prime est un monde-machine ancien dont la Forge est le cœur. Les Akar'lys, descendants de ses premiers gardiens, en ont oublié l'origine zayan. Les Zayan, héritiers des architectes originels, veulent réveiller le réseau planétaire  au prix de la colonie humaine. Les Mezalayis, liés aux Zayan par un contrat de récupération, restent neutres entre les deux camps tout en servant un commanditaire orbital resté secret. Le joueur, en progressant dans la Forge, la Tour, l'Orbital Hub et le Donjon Furiste, découvre peu à peu que la guerre qu'on lui a confiée repose sur une amnésie collective  jusqu'à un choix final qui engage l'avenir même de Narvos Prime.
Trois mystères conservés pour de futures extensions
L'identité exacte du consortium marchand orbital qui commandite les Mezalayis.
La raison véritable du Grand Sommeil qui a figé le réseau planétaire avant l'arrivée humaine.
La nature exacte de la forme de vie élémentaire confinée dans le Donjon Furiste, et son lien éventuel avec le Vide.
