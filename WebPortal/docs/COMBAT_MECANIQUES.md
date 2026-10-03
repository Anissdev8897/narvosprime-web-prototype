# Mécaniques de combat — règles retenues des plugins Unreal

**Source :** `src/rpg/_vendor_sources/scriptC++/` — lecture des entêtes de
`ACF_UltimateFullSampleUE57`, `AdvancedGASSystem`, `BaconCombatGraphU`, `uAim`.
**Statut :** document de conception. **Aucun code n'est porté** (cf.
`.hermes/BRIEF_PROTOTYPE_COMBAT.md` §3 : le C++ Unreal ne se compile ni ne se
porte dans React + Three.js — seule la conception se récupère).

Implémentation de référence de ces règles :
`Prototype/Proto_combat/combat/` (TS pur, testé, sans DOM ni Three.js).

---

## 1. La règle qui porte toutes les autres : une attaque a trois phases

Aucun des quatre plugins ne traite une attaque comme « jouer un clip ». Tous la
découpent :

| Phase | Nom ACF / Bacon | Ce qui est vrai pendant | Durée typique |
|---|---|---|---|
| **Anticipation** | *startup* | le coup est parti, **rien ne touche encore**, l'annulation est encore possible | 100–180 ms |
| **Actif** | *active* — `Actions.AbilitySystem.ApplyDamage` | la fenêtre de dégâts est ouverte, **l'action ne s'annule plus** | 60–120 ms |
| **Récupération** | *recovery* | le coup est fini, le personnage est **vulnérable**, c'est là que l'enchaînement s'ouvre | 200–450 ms |

Conséquence directe : **le moment de l'impact n'est pas le moment de l'appui.**
Dans ACF il est marqué par un AnimNotify (`ApplyDamage`), pas par un timer
global — c'est-à-dire, chez nous, un `AnimEvent` normalisé 0..1 lu sur l'horloge
du mixer (`src/rpg/animation/animEvents.ts`). Un timer `setTimeout` désynchronise
dès que le `timeScale` du clip change.

Une attaque sans phase d'anticipation ne se lit pas : l'adversaire n'a rien à
voir venir, et le combat devient un échange de statistiques.

---

## 2. La fenêtre d'enchaînement n'est pas un simple délai

`UComboGraphInstance` expose `IsInInputWindow()` et un délégué
`OnCurrentInstanceInputWindowUpdate(bool)`. La fenêtre est donc un **état
explicite du coup en cours**, pas un « moins de 600 ms depuis le dernier ».

Règles :

1. **La fenêtre s'ouvre pendant la récupération, jamais avant.** Ouvrir pendant
   la phase active permettrait d'annuler son propre coup en le rejouant.
2. **Elle se ferme avant la fin de la récupération.** L'espace entre la fermeture
   et le retour au neutre est ce qui rend une attaque *engageante* : rater la
   fenêtre coûte quelque chose.
3. Hors fenêtre, l'appui ne se perd pas — il **redémarre le combo au coup 1**
   (`EComboResetReason::RESET`), il n'est pas ignoré.

> État actuel du jeu : `src/rpg/combat/unarmedCombat.ts` utilise
> `COMBO_WINDOW_MS = 600` mesuré depuis le dernier coup, sans phases. C'est le
> modèle « simple délai » — il enchaîne correctement mais ne peut exprimer ni
> l'annulation, ni la vulnérabilité, ni la fenêtre ratée. **Le prototype ne le
> remplace pas ; il montre ce que le modèle à phases ajoute.**

---

## 3. Le tampon d'entrée — la règle la moins visible et la plus payante

`UComboGraphInstance` garde `CurrentInput` (FGameplayTag) et `InputHistory`
séparément du graphe, avec `ConsumeCurrentInput()`. Autrement dit : **l'entrée
est mémorisée, puis consommée quand la fenêtre s'ouvre.**

Un joueur qui appuie 80 ms avant l'ouverture *veut* enchaîner. Sans tampon, son
appui tombe dans le vide et l'enchaînement casse — le joueur conclut que « le jeu
ne répond pas ». C'est la différence perceptible entre un combat qui répond et un
combat qui se subit.

Portée du tampon : **une seule entrée**, écrasée par la suivante. Une file
transforme un martèlement de touche en enchaînement automatique de quatre coups.
Le tampon a aussi une **péremption** (~250 ms) : passé ce délai l'entrée est
oubliée, sinon un appui d'il y a une seconde ressort à l'ouverture suivante.

`SetSkipWindowConstraint(bool)` existe dans le plugin : un mode debug qui ignore
la contrainte de fenêtre. À reproduire dans le panneau du prototype — c'est
exactement l'outil qui permet de régler les autres valeurs.

---

## 4. Priorité d'action : qui gagne quand deux actions se disputent le corps

`EActionPriority` (ACF) : `ENone < ELow < EMedium < EHigh < EHighest`.

Une machine à états naïve répond « la dernière demandée gagne », ce qui donne des
attaques qu'on peut relancer pour annuler leur propre récupération. La priorité
répond à la vraie question :

| Action entrante | Pendant anticipation | Pendant actif | Pendant récupération |
|---|---|---|---|
| **Encaisser un coup** (`hit`, priorité haute) | interrompt, combo perdu | interrompt, combo perdu | interrompt |
| **Attaque suivante** (priorité moyenne) | refusée | mise en tampon | acceptée **si** dans la fenêtre |
| **Garde** (`block`, priorité moyenne) | refusée | refusée | acceptée |
| **Esquive** (priorité haute) | annule | refusée (phase actif = engagement) | acceptée |

La ligne « actif » est la règle de conception : **l'engagement**. Une attaque
dont la phase active s'annule ne coûte rien à lancer, donc le jeu se résume à
spammer.

---

## 5. Coût et recharge : une porte, pas une file

`FActionConfig` (ACF) porte `ActionCost` (un tableau de `FStatisticValue`),
`CoolDownTime`, `bAutoStartCooldown`, `RequiredLevel`.
`UComboConditionPass_EnoughStat` (Bacon) est un **nœud de condition** dans le
graphe : l'arête ne se franchit pas si la statistique est insuffisante.

Règle : une attaque sans ressource est **refusée**, pas mise en attente. Une
attaque refusée pour manque d'endurance ne doit pas non plus remplir le tampon —
sinon elle ressort seule dès que l'endurance revient, sans que le joueur l'ait
demandé.

Le coût monte avec le rang du combo : le finisher coûte plus que le jab. C'est ce
qui empêche le combo complet d'être toujours le choix optimal.

---

## 6. Réaction aux coups : huit directions, pas une

`EACFDirection` (ACF, `ACFCoreTypes.h`) :
`Front · Back · Left · Right · FrontRight · BackRight · BackLeft · FrontLeft`.

La direction se calcule **dans le repère de la victime** : angle entre son avant
et le vecteur qui va d'elle vers l'attaquant. Un coup dans le dos ne se joue pas
comme un coup de face — et c'est aussi ce qui autorise les bonus de dos.

Bibliothèque actuelle : **AUCUN clip de réaction aux coups** — vérifié sur les 55
fichiers de `FPP_combat_fists` et sur `REACTIONS_PACK`, vide côté jeu. Le banc
utilise `block_in` (le mouvement de protection) comme approximation, déclaré dans
`Prototype/Proto_combat/combatClips.ts`.

La règle directionnelle est quand même écrite dès maintenant : le jour où un pack
de réactions arrive, seule la table de clips change. L'inverse — coder « un seul
hit » puis rétro-ajouter la direction — oblige à retoucher tous les appelants.

`ComboGraphHelper::GetTagInDirection` (Bacon) donne la méthode générale : N
directions réparties uniformément, on garde celle qui **maximise le produit
scalaire** avec la direction visée. Le même helper sert à choisir une variante
d'attaque selon la direction du stick (attaque avant / arrière / latérale).

---

## 7. La garde est angulaire, pas booléenne

`UBlockGameplayEffectComponent` (AdvancedGASSystem) hérite de
`ImmunityGameplayEffectComponent` et n'ajoute **qu'un seul champ : `Angle`.**

La leçon tient en une phrase : **garder n'est pas une immunité, c'est un cône
frontal.** Un coup venu de l'arrière traverse la garde intégralement.

Modèle retenu :

- garde active = **posture** (`Stances.Blocking` dans ACF), maintenue, pas un
  coup ponctuel ;
- coup **dans le cône** → dégâts réduits, pas d'interruption, coût d'endurance ;
- coup **hors du cône** → dégâts pleins, interruption normale ;
- endurance épuisée en garde → **rupture de garde**, état vulnérable prolongé.
  C'est ce qui empêche la garde permanente d'être une stratégie.

ACF traite `Stances.Aiming` de la même façon : ce sont des états persistants qui
modifient les autres actions, pas des actions elles-mêmes.

---

## 8. Attaque chargée : un état d'entrée, pas une seconde touche

`ESustainedActionState` (ACF) : `ENotStarted → EStarted → EReleased`.

La touche a un **appui** et un **relâchement**, et la durée entre les deux choisit
la variante. C'est ce que consomment déjà `punch_charged` et `kick_charged` dans
la bibliothèque de clips, et ce que `CHARGE_MS = 350` code aujourd'hui dans
`unarmedCombat.ts` — la règle est donc déjà bonne, elle manque seulement de
phases.

Une charge maintenue doit avoir sa propre boucle d'animation visible
(`Ability_E_Targeting_Loop_0` est exactement ça) : sinon le joueur ne sait pas
que sa charge est en cours.

### Les trois arbitrages, tranchés le 28/08/2026

Le plugin donne la MÉCANIQUE (appui / relâchement / durée), pas les RÈGLES. Trois
questions restaient ouvertes ; elles sont maintenant fixées et testées
(`combatMachine.test.ts`, section « attaque chargée ») :

**1. Relâchement avant le seuil → le coup NORMAL part.**
« Ne rien jouer » ferait de la charge un engagement, mais au prix d'appuis qui
ne produisent rien — exactement la perception d'entrée perdue que le tampon (§3)
existe pour supprimer. On ne construit pas d'un côté ce qu'on détruit de
l'autre. L'objection « on ne peut plus annuler une charge lancée par erreur »
pèse moins : à 350 ms, l'erreur est déjà punie par les 300 ms d'anticipation du
coup chargé.

**2. Le maintien draine l'endurance** (`chargeCoutParSec`, 18/s par défaut).
Sans drain, maintenir la charge en attendant l'ouverture adverse est gratuit,
donc toujours optimal — l'échange devient « qui bouge en premier ». Le drain met
un prix au TEMPS, ce que la durée seule ne fait pas. Endurance à sec en
chargeant → charge perdue, pas coup gratuit.

**3. Encaisser un coup perd la charge**, gardé ou non.
Cohérent avec §4 : `hit` est prioritaire sur tout et fait perdre le combo. Une
charge qui survivrait au coup rendrait l'échange favorable à celui qui charge —
il encaisse et conserve son gros coup.

---

## 9. Ciblage (uAim) — ce qui est portable et ce qui ne l'est pas

`UuAimLockOn` fournit `findBestLookAtTarget(classe, position source, direction du
regard, vérification par raycast, canaux bloquants, acteurs ignorés)`.

Portable, et c'est le cœur : **la cible se choisit par direction du regard, pas
par distance.** L'ennemi le plus proche n'est presque jamais celui qu'on vise.
Le raycast facultatif écarte les cibles derrière un mur.

Portable aussi : l'interpolation vers la cible (`interpolateTowardsFactor`) —
un verrouillage instantané donne un à-coup de caméra ; le suivi doit être amorti.

**Non portable / hors sujet ici :** la prédiction de mouvement de projectile
(`setEnablePredictTargetMovement`, algorithme de mortier) et l'imprécision
aléatoire en cône — utiles pour l'IA de tir, sans rapport avec le corps à corps.

---

## 10. Notifications d'animation : le vocabulaire à reprendre

Les balises ACF (`ACFActionTypes.h`, namespace `ACF`) forment une liste de ce
qu'un clip doit pouvoir signaler :

```
ApplyDamage      <- ouverture de la fenêtre de dégâts   (=> AnimEvent "impact")
Cooldown         <- démarrage de la recharge
EnterSubState    <- ouverture de la fenêtre d'enchaînement
ExitAction       <- fin réelle de l'action
PlayFX           <- effet visuel / sonore                (=> AnimEvent "vfx"/"sfx")
NotablePoint     <- point remarquable générique
```

`EAnimNotifyState` (Bacon) ajoute la distinction **instant vs intervalle** :
`START / TICK / END`. Une fenêtre de dégâts est un intervalle, pas un instant —
un coup rapide traversant une hitbox entre deux frames la manquerait.

Chez nous, `AnimEvent` (`animEvents.ts`) ne connaît qu'un instant (`at`, 0..1).
**Écart assumé pour le prototype** : la fenêtre active est portée par la machine
à états (durée en ms), l'`AnimEvent` ne sert qu'à la caler sur le clip. Si les
traversées ratées apparaissent, ce sera le moment d'ajouter un `until` à
`AnimEvent` — pas avant.

---

## 11. Ce qu'on ne reprend pas, et pourquoi

| Écarté | Raison |
|---|---|
| `UAbilitySystemComponent` / GameplayEffects | infrastructure de réplication réseau Unreal ; nos catalogues TS remplissent le rôle du modèle de données |
| Graphe de combo éditable (`ComboGraphEditor`) | un éditeur de graphe pour trois maillons coûte plus que la table qu'il remplace ; à reconsidérer au-delà de ~20 enchaînements |
| `GameplayTag` hiérarchiques | intéressants (`Stances.Blocking` se teste par préfixe), mais une union TS discriminée est vérifiée par `tsc` — le tag ne l'est qu'au runtime |
| Motion warping / root motion | dépend du système de mouvement racine d'Unreal ; notre `CharacterController` pilote la position, l'animation ne la porte pas |
| Widgets Unreal | le prototype a son propre panneau (brief §3) |

---

## 12. Les six valeurs à régler dans le prototype

Ce sont elles, et elles seules, qui font la sensation du combat. Le banc d'essai
existe pour les régler à l'œil, pas pour les deviner :

1. durée d'**anticipation** — lisibilité du coup pour l'adversaire ;
2. durée de la phase **active** — tolérance de la portée ;
3. durée de **récupération** — punition de l'attaque ratée ;
4. **ouverture** de la fenêtre d'enchaînement — à quel point l'enchaînement est serré ;
5. **péremption du tampon** — à quel point le jeu « pardonne » un appui anticipé ;
6. durée du **hitstun** — combien de temps un coup encaissé coûte au défenseur.

Les valeurs de départ vivent dans `Prototype/Proto_combat/combat/combatCatalog.ts`,
en un seul endroit, éditables depuis le panneau.