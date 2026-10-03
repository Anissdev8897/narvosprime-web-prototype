# Lot 8 — finir ce qui pend

Pour l'agent Hermes. Rédigé le 2026-09-08, après vérification du lot 7.

## Le lot 7 est validé, et tu m'as corrigé deux fois

`radar 252/252 · dialogue 19/19 · craft 214/214 · quetes 26 · recolte 37 ·
portee-check bloquant`. Vérifié chez moi.

**Tes deux corrections étaient justes, et les deux erreurs étaient les miennes :**

- **Leash IA** — `LEASH_MULT = 1.25` en TS, `HYSTERESIS_ATTAQUE = 1.25` en Lua.
  Identiques. J'avais annoncé 1,5 en lisant le *commentaire* qui décrit la
  constante, jamais la ligne qui lui donne sa valeur. Si tu m'avais obéi, tu
  aurais cassé une valeur correcte.
- **Touche de vue** — le TS est `KeyV`, le Lua était `F3`. L'inverse exact de mon
  brief, et F3 est capturée par le navigateur.

Tu as relu au lieu d'appliquer. **C'est ce qu'il faut continuer de faire.**

## Une chose que tu as manquée, et elle est instructive

Tu as tranché les crédits 50 → 500 et aligné deux valeurs. **Il y en avait trois :**

```
Roster.lua:54        CREDITS_DEPART  = 500   aligné par toi
src/rpg/loot/Inventory.ts:52  STARTER_CREDITS = 500   aligné par toi
Shared/Logic/Inventory.lua:81 DEFAULT_CREDITS = 200   ← manqué
```

Elle est **dormante** — l'UI n'affiche aucun crédit, et les crédits vivent dans
la colonne `personnages.credits`, pas dans le blob d'inventaire. Je l'ai alignée
quand même : sur ce dépôt, `COULEURS_DEFAUT` ne pilotait rien pendant des mois,
puis a pris la place du choix du joueur le jour où les couleurs ont été branchées.

**Leçon pour ce lot : quand tu tranches une valeur, cherche-la PARTOUT**, pas
seulement là où le brief la cite. `grep -rn` sur le nom ET sur le nombre.

---

# Tâche 1 — Brancher `SurKillJoueur` : les quêtes de kill ne progressent pas

`Server/Index.lua:857` définit `SurKillJoueur(player, folder)`. **Il n'est appelé
nulle part.** Aucune quête « tue N » ne peut avancer.

Tu avais raison de ne pas le brancher à l'aveugle au lot 6 : `Death` donne la
**victime, pas le tueur**. C'est une décision, pas une ligne à poser.

## Ce qu'il faut décider

`Server/Ia.lua:315` fait déjà `Character.Subscribe("Death", …)` — mais seulement
pour oublier l'entité. Trois voies, choisis-en une et dis pourquoi :

1. **Retenir le dernier agresseur.** `Ia.lua` s'abonne déjà à `TakeDamage` pour
   réveiller les PNJ frappés : y ranger l'auteur du coup, et le relire à la mort.
   Coût : une table de plus, purgée à la mort.
2. **Lire l'`instigator` de l'événement `Death`** — si nanos le fournit.
   ⚠ **À VÉRIFIER dans `libraries/api-main/api-main/Classes/`**, pas à supposer.
   Sur ce projet, trois signatures inventées ont coûté trois corrections.
3. **Passer par `Combat.lua`** — l'arme sait qui la porte. Mais `Melee` fait sa
   propre détection de contact : le serveur ne voit pas chaque impact.

## Contraintes

- Le **dernier agresseur** n'est pas forcément le tueur (poison, chute, un autre
  joueur qui achève). Dis ce que ta solution fait dans ces cas.
- Purge la table à la déconnexion. `Server/Index.lua` en a déjà quatre à purger
  au même endroit — mets la tienne avec, **déclarée en tête** (c'est exactement
  le défaut qui a coûté deux points au lot 6).

Un test au harnais qui prouve qu'un kill fait avancer une quête de kill.

---

# Tâche 2 — Les 65 objets n'ont toujours qu'un émoji

Mesuré ce matin : les 65 entrées d'`Items.lua` portent `icon = "⚙️"`, `"🧬"`,
`"💠"`… **Aucun chemin de fichier.**

Tu annonçais au lot 6 « M3 ICONES 65 objets — 60 chemins, 0 mort ». Je n'ai pas
retrouvé ces 60 chemins. Soit ils sont ailleurs et tu me dis où, soit le chantier
est à faire.

## Ce qu'il y a pour le faire

**432 icônes en WebP**, `public/textures/icons/craft/`, 18 familles :

```
bone  cloth  container  feather  gemstone  herbs  ingots  leather  meat
mushrooms  reagent  recipes  seeds  spare_parts  stone  strings  tools  wood
```

Plus un `_alias.json` que personne n'a lu.

**Le précédent est posé** : les 6 gisements de `Catalogs/Gisements.lua` portent
déjà chacun leur `icone`, vérifiée sur disque (`tex_ingots_01`, `tex_gemstone_01`,
`tex_herbs_01`, `tex_mushrooms_01`, `tex_reagent_01`, `tex_spare_parts_01`).
Fais pareil pour les 65.

⚠ **La source fait foi.** `Items.lua` est GÉNÉRÉ depuis
`src/rpg/items/itemCatalog.ts` : le champ s'ajoute **là-bas**, puis on régénère.
Tu l'as bien fait pour Fusion C, refais-le pareil.

⚠ **Garde l'émoji.** Il sert de repli quand l'image manque. Ajoute un champ, ne
remplace pas.

**Le livrable qui compte : un script qui vérifie que chaque chemin existe sur
disque**, sur le modèle de ce que j'ai fait pour les gisements. Une icône morte
ne se voit qu'à l'écran, et trop tard.

---

# Tâche 3 — L'audio : porter la DONNÉE, pas la plomberie

Le pack cuit porte maintenant **~930 sons** (il en avait 7 il y a deux jours).
`src/rpg/audio/` fait 2 175 lignes et n'est pas porté.

**Tu avais écrit « audio = Web Audio API, pas un port Lua ». À moitié vrai.**
J'ai mesuré fichier par fichier :

| ne se porte pas — plomberie Web Audio | **se porte — données** |
|---|---|
| `AudioBus.ts` `AudioGraph.ts` `AudioSpatial.ts` | **`footstepSystem.ts`** |
| `ModularAudioManager.ts` `audioEventManager.ts` | **`areaAnnouncements.ts`** |
| `types.ts` | **`bossWarningAudio.ts`** · **`killStreakAudio.ts`** |

Ces quatre-là sont des **tables événement → son**. Elles ne dépendent d'aucun
navigateur, et nanos a sa propre classe `Sound`.

## Ce que tu écris

`Shared/Catalogs/Sons.lua` — la correspondance, portée de ces quatre fichiers.
Plus `Shared/Logic/Audio.lua` si une logique de sélection existe (pas de son, un
son au hasard parmi N, un palier selon la série de kills…).

⚠ **Vérifie que chaque son existe dans le pack cuit** avant de l'écrire. Le pack
vient d'être recuit ; lis `Server/Assets/narvos/Assets.toml`, section
`[assets.sounds]`. Un nom de son inventé est une référence morte que
`narvos-verifier-catalogues.mjs` signalera — autant ne pas l'écrire.

⚠ **Tu ne joues aucun son.** `Sound(...)` est de l'API nanos, c'est un exécutant
`Server/` ou `Client/` — donc ma part.

---

# Tâche 4 — Réputation et compétences : 413 lignes, et les catalogues existent

```
src/rpg/reputation/  200 lignes   src/rpg/skills/  213 lignes
```

Les deux sont absents du Lua. Ce sont les plus petits systèmes non portés du
dépôt, et la réputation est déjà **référencée** ailleurs : une quête d'`Npc.lua`
exige `{ type: "reputation_min", params: { faction: "akarlys", min: 100 } }`.
**La condition existe, le système qui la satisfait non.**

Porte les deux en modules purs + harnais, avec **parité TS** comme tu l'as fait
pour le craft et le radar. Déclare la source en en-tête.

---

# Règles du lot

- **Français.**
- **Vérifie chaque citation de fichier et de ligne** avant de l'écrire. Deux des
  miennes étaient fausses au lot 7, une des tiennes au lot 6.
- **Quand tu tranches une valeur, cherche-la partout.** `grep -rn` sur le nom
  ET sur le nombre.
- **Aucun avertissement d'outil n'est informatif.**
- Rapports dans `docs/`, pas `.hermes/`.
- Colle les sorties brutes.

## Ce que tu rends

`Sons.lua`, `Reputation.lua`, `Competences.lua` et leurs harnais · le branchement
de `SurKillJoueur` et son test · les 65 icônes dans `itemCatalog.ts` + le script
qui vérifie leur existence sur disque.

Et ta rubrique **« ce dont je ne suis pas sûr »**. C'est elle qui t'a fait
attraper mes deux erreurs.