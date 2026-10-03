# Réponse au lot 6

## 1. Ta question — où poser les deux fichiers

**Écris-les dans `docs/`, pas dans `.hermes/`.**

```
docs/INVENTAIRES_SIX.md
docs/PORTAGES_SOURCES.md
```

`docs/` existe déjà à la racine du dépôt et n'est protégé par rien. Ne force
pas `.hermes/` : le garde-fou qui te bloque n'est pas un refus de notre part,
c'est ton propre outillage qui traite ce dossier comme des instructions
d'agent. Contourner un garde-fou pour écrire un rapport serait un mauvais
échange.

Les trois `.md` déjà écrits dans `.hermes/` peuvent y rester.

---

## 2. Ce que j'ai vérifié de mon côté

**Tâche 1 — portage craft : confirmé.** J'ai relancé chez moi :

```
craft.mjs    46 reussis, 0 echec(s)
             parite TS/Lua : 214 reussis, 0 echec(s)
recolte.mjs  37 reussis, 0 echec(s)
```

Les 9 recettes et les 4 stations dont `refinery` sont là. C'est réglé.

---

## 3. Tes deux corrections de comptage

### « 20 modules / 5 citent » : tu mesures 22 / 6

**Tu as raison, et la cause est amusante :** il y en avait bien 20 quand j'ai
compté. **Tes propres `Recolte.lua` et `Craft.lua` du lot 4 ont fait passer le
dossier à 22.** J'ai recompté : 22.

### « 42 vs 39 ressources » : on avait tort tous les deux

Le vrai découpage des 42 identifiants de `professionCatalog.ts` :

| catégorie | nombre |
|---|---|
| métiers (`bucheron`, `mineur`, `forgeron`, `alchimiste`, `joaillier`, `recolteur`) | **6** |
| sorties de craft (préfixes `f_`, `j_`, `a_`) | **18** |
| **vraies ressources récoltables** | **18** |
| total | 42 |

Mon « 42 ressources » comptait tout ; ton « 39 » n'est pas non plus ce que je
mesure. **Le chiffre à retenir est 18.**

⚠ **Ça change la tâche 2.** Ce n'est pas « 26 objets contre 42 ressources »,
c'est **26 objets contre 18 ressources et 18 sorties de craft**. Les 18 sorties
(`f_epee_acier`, `j_couronne`, `a_panacee`…) sont des OBJETS FINIS — elles
appartiennent au même monde que les 26, pas au monde des matières.

**Reprends ta Fusion C avec ce découpage.** Ta recommandation — matières brutes
→ raffinage → objets finis — devient plus forte, pas plus faible : les 18
sorties de craft sont déjà le troisième étage de ta chaîne, elles ne sont
simplement pas dans `Items.lua`.

---

## 4. Réponses à ta rubrique « ce dont je ne suis pas sûr »

**3. Récolte « neuf » mais reconnecté en données.** Exact, et c'est le bon
état. `Recolte.lua` ne pouvait pas porter `professions/` — j'ai reconnu que mon
brief était contradictoire. Qu'il partage `fragment_vie`, `cristal_energie`,
`noyau_plasma` avec `Items.lua` est précisément ce qui le rend fusionnable.

**4. `Craft.lua` n'a pas d'en-tête de provenance.** Pose-le. Maintenant qu'il
est fidèle à `craftingSystem.ts` avec 214 assertions de parité, l'en-tête n'est
plus une déclaration d'intention, c'est un fait vérifié. Écris-y aussi le
numéro : « parité prouvée par `craft.mjs`, 214 assertions ».

**6. Les verdicts « porté » reposent sur la citation, pas sur un diff.**
Signale-le tel quel dans `PORTAGES_SOURCES.md`. Un verdict honnête avec sa
limite vaut mieux qu'un verdict ferme sans preuve — et c'est exactement
l'erreur que j'ai commise ce matin en annonçant « 0 animation de forge ».

**7. La source d'auth de `Comptes` sort de `src/rpg`.** Normal et légitime :
`services/authService.ts` et `utils/storage.ts` sont côté application, pas côté
runtime RPG. Élargis ton périmètre à `src/` pour ce module-là et dis-le.

⚠ **`Comptes` : PBKDF2 + sel contre SHA-256 nu, mot de passe en clair.** Cette
divergence-là n'est pas une note de bas de page. Mets-la en tête de ton
rapport, séparée des autres : c'est de la sécurité, pas de la cohérence.

---

## 5. Sur ta tâche 3 — un chiffre à confirmer

Tu annonces **34,3 Go de gain** et « Hyper Inventory V2 = 29,56 Go ». J'ai
compté **5 478 uasset** pour ce paquet, pas son poids. Redonne la commande qui
a produit les 29,56 Go — si c'est juste, c'est le plus gros gain d'espace
identifié depuis le début du projet, et ça mérite d'être inattaquable.

Ta recommandation — garder **Inventory System Pro** (UE 5.4, 81 écrans UMG) —
me paraît juste sur les critères que tu donnes. Confirme juste que `SlotBased`
et `Hyper_Slot_V3` sont bien le **même** paquet et pas deux versions.

---

## 6. Ce qui a changé pendant que tu travaillais

Quatre paquets sont maintenant promus sous `/Game/Narvos/` et seront dans le
prochain cook :

```
Sewer          501 assets    egouts et tunnels modulaires
FluidFlux      856 assets    vagues — 68 blueprints sur 69 compilent
MetaCustom     526 assets    modulaire : Body Tool, Face Tool, garde-robe, corps
Megastructure   82 assets    kit alien modulaire
```

Ça ne change rien à ton lot, mais `Assets.toml` bougera après le prochain cook :
ne te fie pas au compte d'animations que tu y as lu si tu y reviens.