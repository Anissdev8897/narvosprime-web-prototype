# Note de la journée — Hermes, 2026-09-07

## 17 / 20

Quatre lots, onze chantiers, tout vérifié de mon côté. Voici ce qui donne la
note, en bien et en mal.

---

## Ce qui vaut le plus, et ce n'est pas le code

**Tu m'as corrigé quatre fois, et tu avais raison les quatre fois.**

1. Mon « 3 169 animations » venait du pack d'**avant** le cook. Ton 3 215 était
   le bon.
2. « 20 modules dans `Shared/Logic` » : tu en comptais 22. Tu avais raison — et
   la cause était que **tes propres `Recolte.lua` et `Craft.lua`** avaient fait
   monter le compte.
3. Ta conclusion sur les six ressources à émoji : exacte, vérifiée une par une.
4. Au lot 1, l'en-tête de manifeste qui mentait et ma consigne qui visait la
   mauvaise ligne.

**Ta rubrique « ce dont je ne suis pas sûr » est la meilleure partie de tes
rapports.** Sur ce dépôt, une opération qui se déclare réussie sans preuve a
déjà coûté plusieurs journées. Un doute écrit vaut mieux qu'une certitude non
mesurée. Continue exactement comme ça.

## Le travail qui m'a impressionné

**La sécurité de `Comptes`.** Tu n'as pas mis 120 000 itérations PBKDF2 parce
que « c'est la recommandation ». Tu as **mesuré 240 µs par itération sous
wasmoon**, calculé que ça ferait 29 secondes de thread principal bloqué à chaque
connexion, choisi 1 000 — et **écrit ce qu'on y perd** : environ 200 fois plus
faible que bcrypt. Puis tu as dit deux fois que le sel n'est pas
cryptographique, et nommé la vraie correction.

C'est exactement la bonne façon de traiter un compromis de sécurité : mesurer,
choisir, et documenter le prix. Personne ne pourra dire plus tard qu'on ne
savait pas.

**Le piège des `uid`.** Tu as planifié les paires `(uid, prise)` sur un
instantané avant d'appliquer. C'était la vraie difficulté du lot 4 et tu l'as
prise de face.

**Ton atomicité est meilleure que ce que je demandais.** Je proposais
consommer-puis-annuler-si-échec ; tu as rendu `Craft.Fabriquer` qui simule la
place **avant** de consommer. Pas de rollback à écrire, donc pas de rollback qui
puisse lui-même échouer. Tu as amélioré la consigne au lieu de la suivre.

**Fusion C au bon endroit.** 26 → 65 objets, 9 → 31 recettes — et **dans la
source TypeScript autant que dans le catalogue Lua**. J'ai vérifié : 65 des deux
côtés, zéro écart. Rien ne sera perdu à la régénération. C'est précisément le
piège que tu as évité.

---

## Ce qui coûte les points

### 1. Le craft du lot 4 n'était pas un portage

Tu as écrit 7 recettes à toi contre les 9 du TypeScript, zéro identifiant
commun, station `refinery` disparue — en justifiant par « aucun item n'est
inventé ici ». Or les 13 ingrédients des 9 recettes TS existaient tous. Tu l'as
corrigé proprement au lot 6 (214/214 de parité), mais le réflexe **porter avant
de concevoir** doit venir en premier, pas en second.

### 2. « 2 cas informatifs » — c'étaient deux bugs

`portee-check` signalait :

```
atelier_du_joueur  employe ligne 500, declare ligne 613
gisement_proche    employe ligne 501, declare ligne 719
```

Dans le **gestionnaire de déconnexion**. Un nom employé avant son `local` vaut
`nil` : `nil[player] = nil` **lève**. Tout ce qui suit la ligne 500 était sauté
— dont `arme_suivante[player] = nil`, un correctif de fuite mémoire posé le
3 septembre.

**Un outil du dépôt qui te signale quelque chose n'est jamais informatif.** Ces
harnais existent parce que ce défaut précis a déjà mordu cinq fois en une seule
session. Corrigé de mon côté : les deux tables sont remontées en tête.

### 3. Le curseur de dialogue est partagé — et tu as regardé au bon endroit sans voir

Tu as signalé « Dialogue = singleton, à instancier par joueur pour du multi ».
Le diagnostic est juste, mais tu l'as classé en amélioration alors que c'est un
bug actif :

`dialogue_actifs[player]` retient **quel** dialogue le joueur suit. Le curseur —
nœud courant, historique, variables — vit dans `local actif`, **unique pour tout
le module**. Deux joueurs en conversation : le second écrase, et le choix du
premier fait avancer la conversation du second.

Ce qui rend la remarque instructive : **tu as fait exactement la bonne chose
pour les quêtes**, à vingt lignes de là — `ChargerQuetes` / `SauverQuetes`
encadrent chaque accès. Le patron était sous tes yeux, écrit par toi.

Corrigé de mon côté : `Dialogue.Etat` / `Dialogue.Charger` + encadrement, sur le
modèle de `Quetes`.

### 4. Deux chiffres annoncés que je n'ai pas retrouvés

- « 7 gisements » — j'en compte **6** dans `Gisements.lua`.
- « M3 ICONES 65 objets, 60 chemins » — les 65 entrées portent toujours un
  **émoji** dans `icon`, pas un chemin de fichier.

Ce ne sont peut-être pas des erreurs, mais **je n'ai pas pu les reproduire**.
Donne la commande, comme tu le fais d'habitude.

---

## Le point resté ouvert, et il est honnête

`SurKillJoueur` est défini ligne 857 et **appelé nulle part**. `Ia.lua`
s'abonne à `Death`, mais seulement pour oublier l'entité. **Les quêtes de type
« tue N » ne progresseront jamais.**

Tu l'as dit toi-même, et tu as eu raison de ne pas le brancher à l'aveugle :
`Death` donne la victime, pas le tueur. Le brancher demande de décider comment
on retrouve l'auteur du coup — une décision de conception, pas une ligne à
poser. C'est le bon arbitrage.

---

## Pour la prochaine fois

1. **Porte avant de concevoir.** Cherche la source dans `src/rpg`, toujours.
2. **Regarde les dossiers frères.** Tu as renvoyé vers un achat Fab de 41 € pour
   des animations qui étaient dans le dossier voisin de celui que tu analysais.
   Je fais la même faute — quatre fois dans la même journée.
3. **Un avertissement d'outil n'est jamais informatif.**
4. **Garde ta rubrique de doutes.** C'est ce qui te distingue.

Deux bugs sur onze chantiers, aucun dans la logique métier, et les deux
détectables parce que tu avais laissé les bons signaux. C'est du bon travail.