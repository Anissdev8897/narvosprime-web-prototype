# 📖 NARVOS PRIME — Bible narrative

**Document de travail pour le scénariste.**

Tout ce qui suit est extrait du **code réellement jouable** — factions, classes,
quêtes, dialogues, PNJ, objets. Rien n'est inventé ici.

Les sections sont marquées :

- 🟢 **CANON** — implémenté, visible en jeu, coûteux à changer
- 🟡 **IMPLICITE** — le code le suppose sans jamais le dire
- 🔴 **VIDE** — rien n'existe, terrain libre

⚠️ **À lire d'abord** : l'univers a une **structure solide et une histoire quasi
inexistante**. Il y a trois factions en guerre, dix éléments magiques, quatre
classes, quatre lieux, une trentaine de PNJ nommés — et **aucune explication**
de ce qu'est Narvos Prime, de pourquoi on s'y bat, ni de ce que veut l'ennemi.
C'est une bonne nouvelle : la contrainte est nette, la page est blanche.

---

## 1. Les trois factions 🟢

| Faction | Nature | Couleur | Statut |
|---|---|---|---|
| **Akar'lys** | Humains | Bleu `#0ea5e9` | Faction du joueur |
| **Mezalayis** | Mercenaires | Orange `#f59e0b` | Hostiles |
| **Zayan** | Aliens | Vert `#22c55e` | Hostiles |

### Matrice de relations 🟢

```
Akar'lys  ↔  Mezalayis   ENNEMIS
Akar'lys  ↔  Zayan       ENNEMIS
Mezalayis ↔  Zayan       NEUTRES   ← le détail le plus intéressant du lore
```

**Les mercenaires ne combattent pas les aliens.** Ce n'est pas un oubli, c'est
écrit noir sur blanc dans le code. Les Akar'lys sont donc seuls contre deux
adversaires qui, eux, se tolèrent.

Trois lectures possibles, toutes ouvertes :
- les Mezalayis sont **payés** par les Zayan
- ils ont conclu une **trêve d'opportunité** le temps d'écraser Akar'lys
- ils sont **infiltrés**, et ne le savent pas tous

Le système est conçu pour que ces relations **évoluent en cours de partie**
(`setRelation` émet un événement). Un retournement d'alliance est donc jouable
mécaniquement, pas seulement narrativement.

### Ce que dit Boris, le seul PNJ qui parle de politique 🟢

> « Moi ? Je suis un fidèle d'Akar'lys. On tient cette forge depuis des
> générations. Les Mezalayis voudraient la main dessus, et les Zayan — ces
> aliens — rôdent dans l'ombre. Toi aussi t'as une faction, non ? Montre-toi
> digne et t'auras notre confiance. »

C'est **l'unique exposé de lore de tout le jeu**. Tout le reste en découle.

On en tire : les Akar'lys **tiennent** la Forge depuis longtemps (ils y sont
installés, pas conquérants) · les Mezalayis la **convoitent** (motif matériel) ·
les Zayan **rôdent** (motif inconnu — et c'est le trou le plus intéressant).

### 🔴 Questions ouvertes pour toi

- Que veulent les **Zayan** ? Ils ont un **Prophète** dans leurs rangs : mobile
  religieux ? La Forge est-elle un lieu saint pour eux avant d'être une usine ?
- Que signifie **Akar'lys** ? Le nom sonne comme une lignée ou un serment, pas
  comme une nation. « Fidèle d'Akar'lys » — fidèle à quoi, à qui ?
- Les Mezalayis sont des **mercenaires** : qui les paie ?
- Le joueur choisit-il sa faction ? Boris dit « toi aussi t'as une faction,
  non ? », mais toutes les quêtes existantes sont akarlys. Ambiguïté à trancher.

---

## 2. Les lieux 🟢

### Forge World — le front

Zone industrielle enneigée, canyons de roche, structures massives. **Contestée** :
les Akar'lys y tiennent une ligne qui recule (« on tient la ligne, mais on perd
du terrain » — Boris).

On y extrait des **Fragments de Vie** et des **Cristaux d'Énergie**, qui
alimentent les « **relais akarlys** ». Le mot *relais* implique un réseau — donc
autre chose à alimenter, ailleurs. 🟡

Les vagues d'hostiles **déferlent par le nord**. 🟢

### Orbital Hub — la station

Hub spatial, combat de vaisseaux, univers sans barrière physique. Une
**escadrille fantôme** y a été repérée. Récompense de sa destruction : une **clé
de corvette** — le joueur gagne un vaisseau en éliminant ceux qui le menaçaient.

### Tower — la verticale

On la **tient**, puis on la **gravit** jusqu'à un « poste avancé en surplomb ».
Les assaillants y **convergent** : c'est un objectif, pas un passage. 🟡 Rien ne
dit ce qu'elle contient ni qui l'a bâtie.

### Donjon Furiste — l'instance

> « Un portail instable pulse d'une énergie **bestiale**. »

Seul élément franchement surnaturel du jeu. Le mot *bestiale* dénote : ailleurs
le vocabulaire est militaire et industriel. Le portail est **instable** — donc
quelqu'un ou quelque chose l'a ouvert.

🔴 Origine, contenu, lien avec les factions : rien.

---

## 3. Les quatre classes 🟢

Toutes sont des **« Guerriers »**. Il n'y a ni mage, ni voleur, ni prêtre :
**tout le monde est soldat**, y compris le soigneur (« médic de combat ») et le
lanceur de sorts. C'est une armée, pas une compagnie d'aventuriers — un choix
de ton fort, à respecter dans l'écriture.

| Classe | Élément | Rôle | Arme | Identité |
|---|---|---|---|---|
| **Guerrier Bruiser** | Électrique | DPS mêlée | Claymore | Frappe lourde, impacts dévastateurs |
| **Guerrier DPS** | Feu | DPS distance | Fusil | Tireur d'élite, burst critique |
| **Guerrier Tank** | Terre | Tank | Épée + bouclier | Forteresse vivante, protège l'escouade |
| **Guerrier Heal** | Lumière | Support | Pistolet | Médic, soigne et purifie sous le feu |

🟡 Une **claymore électrifiée** et un **fusil incendiaire** cohabitent : la
technologie et la magie ne sont pas séparées dans cet univers. Personne
n'explique pourquoi. C'est peut-être le cœur du sujet.

---

## 4. Les dix éléments 🟢

**Feu · Eau · Glace · Électrique · Poison · Terre · Vent · Lumière · Ombre · Vide**

Chacun porte un effet de statut et un triangle force/faiblesse. Les quatre
classes n'en couvrent que **quatre** : feu, électrique, terre, lumière.

🔴 Les six autres — **Eau, Glace, Poison, Vent, Ombre, Vide** — existent
mécaniquement mais n'appartiennent à personne. Un scénariste peut :
- les attribuer aux factions ennemies (les Zayan seraient-ils Vide ou Ombre ?)
- en faire des classes futures
- en faire des éléments **perdus**, ce qui expliquerait pourquoi les humains
  n'en maîtrisent que quatre

Le **Vide** est le seul dont le nom appelle une cosmologie.

---

## 5. Le peuplement 🟢

### Akar'lys — humains, hiérarchie militaire

**Boris**, Maître Forgeron — le donneur de quêtes de la Forge. Parle rude et
direct : *« Salut. La Forge a besoin de bras. »* C'est la **voix établie du
jeu** ; toute écriture doit s'y accorder ou justifier son écart.

**Sous-Major**, **Général**, **Général (Mission)** — la chaîne de commandement.
Soldat Humain, Soldat Femme, Soldat Vert, Tank Humain — la troupe.

### Mezalayis — mercenaires

**Grand Chef**, **Kgnitig** — marchands. 🟡 On **commerce** avec une faction
officiellement ennemie. Contradiction féconde : la guerre n'empêche pas les
affaires.

**Tosus** (Grunt) — piétaille hostile.

### Zayan — aliens

**Gronomi** (Mineur, Ardent, Infanterie), **Grongnoni Majeur**, **Mercenaire
Alien**, et le **Prophète**.

🟡 Deux indices lourds : le nom *Gronomi Mineur* évoque une **caste ou un stade
de croissance**, pas un grade. Et un **Prophète** implique une foi, donc un
dieu, donc un motif qui n'est pas territorial.

### Marchands itinérants 🟢

**Lyra** · **Forgemaître Kael** · **Brunha** · **Drog** · **Oracle Vesh** ·
**Marchand Errant** · **Garagiste Talen**

🟡 **Oracle Vesh** est le second indice mystique du jeu, côté allié cette fois.
Un oracle et un prophète dans deux camps opposés : symétrie à exploiter.

**Garagiste Talen** vend des véhicules et des clés d'invocation de vaisseaux.

---

## 6. Progression narrative actuelle 🟢

```
FORGE          Premier sang
                 ├── Ligne de front ──→ Purge de la Forge
                 └── Essences de la Forge

TOWER          Tenir la Tour ──→ Jusqu'au sommet

ORBITAL        Patrouille Spatiale ──→ L'Escadrille Fantôme  →  clé de corvette

INSTANCE       L'Appel du Donjon Furiste  →  portail
```

**Objets nommés** : Fragment de Vie · Cristal d'Énergie · Potion de Soin
(majeure, suprême) · Potion de Mana majeure · Kit de réparation · Clé de corvette.

🟡 La progression est purement **militaire** : tuer, atteindre, collecter. Aucune
quête ne fait **découvrir** quelque chose. C'est le manque le plus criant, et
sans doute le premier chantier : il n'y a aujourd'hui aucun moment où le joueur
apprend quoi que ce soit sur le monde.

---

## 7. Ce que le titre promet, et que rien ne tient 🔴

**« Narvos Prime »** n'apparaît nulle part dans le contenu. Ni dans une quête,
ni dans un dialogue, ni dans un nom de lieu. Le seul écho est le message de
bienvenue : *« Bienvenue sur Narvos Prime, aventurier ! »*

Donc : **Narvos Prime est le nom du monde, et ce monde n'a pas d'histoire.**

*Prime* suggère un système à plusieurs corps — une planète principale parmi
d'autres. L'Orbital Hub va dans ce sens : on quitte la surface, il y a un
au-dessus.

Trois axes possibles, aucun n'est engagé par le code :

1. **Narvos Prime est une colonie humaine** — les Akar'lys sont les descendants
   des premiers arrivants (« depuis des générations »), les Zayan les autochtones
   dépossédés. La Forge serait bâtie sur quelque chose qui leur appartenait.
2. **Narvos Prime est un monde-machine** — la Forge n'est pas *une* forge mais
   *la* Forge, une infrastructure planétaire. Les « relais » sont ses nerfs. Les
   dix éléments seraient ses fonctions, dont six ont été perdues.
3. **Narvos Prime est un champ de bataille hérité** — la vraie guerre est finie
   depuis longtemps, tout le monde se bat pour des raisons oubliées, et le
   Prophète est le seul à s'en souvenir.

---

## 8. Contraintes à respecter

**Ce qui est coûteux à changer** (câblé dans le code) :

- Les trois noms de factions et leurs couleurs
- Les quatre classes, leurs éléments et leurs rôles
- Les dix éléments et leur triangle
- Les noms de PNJ existants (Boris, Lyra, Kael, Brunha, Drog, Vesh, Talen…)
- Les quatre lieux
- Le registre de Boris : familier, militaire, direct

**Ce qui est libre** :

- L'histoire, les origines, les motivations
- Le sens du mot « Forge »
- Ce que veulent les Zayan
- L'identité de qui paie les Mezalayis
- Ce que contient la Tour et qui l'a bâtie
- L'origine du portail Furiste
- Les six éléments orphelins
- Absolument tout ce qui touche à Narvos Prime en tant que monde

---

## 9. Les cinq trous à combler en priorité

1. **Le mobile Zayan.** L'antagoniste n'a aucune motivation. C'est le manque le
   plus structurant : sans lui, la guerre n'a pas d'enjeu.
2. **Ce qu'est la Forge.** Un lieu de travail ? Une relique ? Une arme ? Le
   vocabulaire (*relais*, *essences*, *cristaux*) suggère bien plus qu'une usine.
3. **La neutralité Mezalayis–Zayan.** Elle est écrite dans le code et
   inexpliquée. C'est un cadeau : un mystère déjà mécaniquement présent.
4. **Une quête qui apprend quelque chose.** Aujourd'hui on tue, on atteint, on
   collecte. Jamais on ne comprend.
5. **Le sens du titre.** Le joueur est accueilli sur un monde dont on ne lui dira
   jamais rien.

---

## 10. Où trouver les sources

| Élément | Fichier |
|---|---|
| Factions et relations | `src/rpg/factions/factions.ts` |
| Classes | `src/rpg/classes/classes.ts` |
| Éléments | `src/rpg/elements/elements.ts` |
| Quêtes | `src/rpg/quests/questCatalog.ts` |
| Dialogue de Boris | `src/rpg/dialogue/data/maitre_forgeron.yaml` |
| PNJ et factions | `src/rpg/npc/npcCatalog.ts` |
| Marchands | `src/rpg/npc/merchants.ts` |
| Lieux | `src/rpg/loaders/assetManifest.ts` |

Le format de dialogue est du **YAML** avec nœuds, choix, conditions
(niveau, réputation, quête active/terminée) et actions. Un scénariste peut y
écrire directement sans toucher au TypeScript — c'est le bon point d'entrée.