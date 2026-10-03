# Rapport d'Audit — Système de Combat Narvos Prime

**Équipe AUDIT COMBAT (5 agents)** — Juillet 2026
**Périmètre**: 23 fichiers analysés (combat, armes, archétypes, classes, talents, sorts)

---

## Résumé Executif

```
BUGS CRITIQUES:   2  (dégâts strikés ignorés, double-count munitions)
BUGS MAJEURS:     3  (cooldowns non-ultime non gérés, setTimeout dans tick, type 'sword' invalide)
INCOHÉRENCES:     7  (4 formules de dégâts, 3 multiplicateurs crit, 2 distributions finisher, ranges ignorés)
PROBLÈMES DESIGN: 5  (11 sorts annoncés 13, archétypes sous-équipés, ultimes guerrier×2, etc.)
TALENTS:          12 ✓ (complets, cohérents, bien chaînés)
```

---

## 1. BUGS CRITIQUES

### B1. Les multiplicateurs de frappe (strikeDamageMult) ne sont JAMAIS appliqués

**Fichier**: `AutoAttackSystem.tsx:148-152` (createUnarmedStrikeHandler)
**Description**: Le handler de frappe mains nues calcule les dégâts via `unarmedDamage(p, isFinisher)` qui utilise la formule basique `round(5 + p*0.4)`. Il IGNORE complètement `strikeDamage(strike.id, p, isFinisher)` d'`unarmedStrikes.ts` qui applique les multiplicateurs de type de frappe (jab=0.8, hook=1.2, uppercut=1.8, kick=1.6).
**Impact**: Toutes les frappes mains nues font les MÊMES dégâts (modulo finisher). Un jab fait autant de dégâts qu'un uppercut. La latéralité et les 8 types de frappe sont purement cosmétiques — le gameplay n'est pas impacté.
**Fix**: Remplacer `unarmedDamage(p, r.isFinisher)` par `strikeDamage(r.strike, p, r.isFinisher)` dans le handler combo.

### B2. Auto-rechargement d'arme à feu sans vérification des munitions

**Fichier**: `AutoAttackSystem.tsx:90-101`
**Description**: Quand le chargeur est vide (`magazineStore.canFire()` = false), le code appelle `magazineStore.reload()` qui REMPLIT le chargeur au max sans jamais vérifier `ammoStore.consume("cells")`. Le toast "Rechargement auto…" s'affiche mais si la réserve de cellules est vide, le joueur ne pourra pas tirer au clic suivant car `ammoStore.consume("cells")` échouera. Le chargeur reste plein et le clic d'après retente de tirer (cycle infini de rechargements inutiles).
**Impact**: Expérience frustrante — le joueur voit un rechargement qui semble fonctionner mais les tirs sont bloqués.
**Fix**: Consommer les cellules AVANT de remplir le chargeur, ou au moins vérifier la disponibilité.

---

## 2. BUGS MAJEURS

### M1. Pas de gestion de cooldown pour les sorts non-ultimes

**Fichier**: `castArchetypeSpell.ts:57,140`
**Description**: Le gate de cooldown et le déclenchement du cooldown ne s'appliquent QU'aux sorts `isUltimate=true`. Les sorts non-ultimes (Mage Trait Arcanique CD=2.5s, Trait Éclat du Vide CD=2s, Archer Tir Chargé CD=1s, Ninja Assaut CD=2s, Ninja Éclipse CD=30s) n'ont AUCUNE vérification de cooldown dans le code. Leurs valeurs `baseCooldown` sont décoratives.
**Impact**: Le Ninja peut spammer Assaut de l'Ombre chaque frame sans attendre 2s. L'Éclipse (30s annoncée) est utilisable indéfiniment sans attendre.
**Fix**: Appliquer le gate cooldown à TOUS les sorts, pas seulement les ultimes. Un `cooldownStore` pour tous.

### M2. magazineStore.reload() utilise setTimeout — incohérent avec le tick central

**Fichier**: `magazineStore.ts:60-64`
**Description**: Le rechargement utilise `setTimeout` alors que `cooldownStore` et `statusEffects` utilisent un `tick(dt)` central. `setTimeout` n'est pas affecté par les pauses, le ralentissement du temps, ou les désyncs de frame.
**Impact**: Si le jeu est mis en pause, le rechargement continue de tourner. Si la performance chute, le rechargement reste en temps réel.
**Fix**: Remplacer par un timer frame-driven compatible avec le système existant.

### M3. `arch_sword` type invalide `"sword"`

**Fichier**: `weaponProfiles.json:4`
**Description**: Le profil `arch_sword` a `"type": "sword"` mais le type `WeaponType` ne contient que `"sword_1h"` et `"sword_2h"`. Pas de `"sword"`. Le cast dans `buildRegistry` évite l'erreur TS mais le type est inutilisable pour la classification.
**Impact**: Toute fonction qui lit `weaponTypeMeta` sur cette arme reçoit un `undefined`.
**Fix**: Remplacer par `"sword_1h"`.

---

## 3. INCOHÉRENCES MAJEURES

### I1. Quatre (4) formules de dégâts différentes dans le codebase

| Système | Fichier | Formule |
|---------|---------|---------|
| Auto-attack (armes) | `AutoAttackSystem.tsx:61` | `rollDamage(8 + p*0.6, crit)` |
| Mains nues (combo) | `unarmedCombat.ts:45` | `round(5 + p*0.4)` [×2 finisher] |
| Sorts d'archétype | `spellDamage.ts:28-35` | `pct * HP_max * (1+atk/100) * 100/(100+def)` |
| Sorts de classe | `SpellDef.ts:44-46` | `damage_base * (1 + p/100)` [×1.5 crit] |

**Problème**: 3 échelles différentes. L'auto-attack et les mains nues utilisent des flat scaling (base + p*coeff, avec 0.6 vs 0.4), tandis que les sorts archétypes sont basés sur %PV du joueur, et les sorts classes sur flat × scaling pourcentage.

**Impact**: L'équilibrage est impossible à raisonner globalement. Les mains nues font `5 + 0.4p` → à puissance 50 = 25 dégâts. L'auto-attaque fait `8 + 0.6p` → à p=50 = 38 dégâts. Les sorts d'archétype font `15% × 200PV × (1+0.5) × 100/125 = 36 dégâts`. Les sorts de classe font `40 × (1+0.5) = 60 dégâts`. Même pour un joueur de niveau modeste, les échelles divergent déjà.

**Recommandation**: Unifier en UN système de dégâts. Proposer : `base + p * coeff` pour le physique, `%PV` pour les sorts d'archétype.

### I2. Trois (3) multiplicateurs de coup critique différents

| Système | Multiplicateur | Fichier |
|---------|---------------|---------|
| Auto-attack / Unarmed | ×1.75 | `rollDamage.ts:3` |
| Sorts d'archétype | ×1.50 | `spellDamage.ts:35` |
| Sorts de classe (PNJ) | ×1.50 | `SpellDef.ts:46` |

**Problème**: Les attaques physiques critiquent à ×1.75, les sorts à ×1.50. Si c'est intentionnel (les sorts critiquent moins fort), c'est bien mais il faut le documenter et le justifier.

### I3. Deux distributions de finisher différentes

| Fonction | Distribution | Fichier |
|----------|-------------|---------|
| `advanceCombo` (utilisé effectivement) | 40% punch3, 35% kick, 25% punch_charged | `unarmedCombat.ts:27` |
| `strikeForStep` (jamais appelé pour finisher) | 50% kick, 50% uppercut | `unarmedStrikes.ts:105-107` |

**Problème**: `advanceCombo` a sa propre logique de finisher (lignes 26-39) au lieu d'appeler `strikeForStep(3, true, rng)`. Les deux divergeront inévitablement. De plus, la notion de `punch_charged` comme finisher est absente de `strikeForStep`.

**Fix**: `advanceCombo` devrait appeler `strikeForStep(3, true, rng)` pour le choix du finisher, et déduire `action` de `strike` plutôt que l'inverse.

### I4. Les portées de frappe unarmedStrikes sont ignorées par AutoAttackSystem

**Fichiers**: `unarmedStrikes.ts:46` (range par strike) vs `AutoAttackSystem.tsx:146` (range fixe 2.8)
**Description**: `createUnarmedStrikeHandler` utilise une range fixe par type (`2.8` combo, `3.2` kick, `3.4` kick_charged) au lieu de lire `STRIKES[strike].range`.
**Impact**: Un uppercut (range 1.5m dans unarmedStrikes) touche à 2.8m. Un kick (range 2.3m) touche à 3.2m. La portée du kick est 39% plus grande que prévu dans le design.

### I5. Le système de munitions double (ammoStore + magazineStore) sans lien logique

**Fichier**: `AutoAttackSystem.tsx:89-102`, `magazineStore.ts`, `ammoStore.ts`
**Description**: Le Guerrier Spatial doit gérer DEUX réserves : `ammoStore.consume("cells")` ET `magazineStore.fire()`. Les cellules sont consommées à chaque tir, ET le chargeur se vide. Mais au rechargement, seules les cellules sont vérifiées. Si un joueur a 0 cellules mais entre en rechargement, le chargeur est rempli sans consommer.
**Impact**: Architecture fragile — 2 stores dont les interactions ne sont pas formalisées.

### I6. Les 4 classes "guerrier futuriste" (classes.ts) sont déconnectées des 5 archétypes

**Fichiers**: `classes.ts` vs `archetypeCatalog.ts`
**Description**: Les 5 archétypes (Mage, Archer, Guerrier, Guerrier Spatial, Ninja) et les 4 classes PNJ (Bruiser, DPS, Tank, Heal) sont des systèmes parallèles qui ne communiquent pas. Les classes ont des stats détaillées (hp, mana, defense, attackPower, critChance, moveSpeed) tandis que les archétypes n'ont que weaponType et des sorts. Aucun mapping entre les deux.
**Impact**: Le joueur choisit un archétype mais n'hérite d'aucune stat de base. Les classes servent uniquement aux PNJ. Les stats du joueur viennent d'ailleurs (effectiveStats, PlayerStats). Risque de dérive d'équilibrage entre joueurs et PNJ.

### I7. La formule de dégâts auto-attack Archer est incohérente

**Fichier**: `AutoAttackSystem.tsx:60-63, 79-82`
**Description**: L'arc tire `n` flèches (multishot) et CHAQUE flèche applique `dmg` = `rollDamage(8 + puissance*0.6, crit)` sur spawn. Mais les dégâts sont pré-calculés AU SPAWN, pas à l'impact. Les mutations (multishot ×3) triplent les dégâts théoriques, rendant le burst Archer potentiellement ×3 celui du Guerrier Spatial.
**Impact**: Archer multishot ×3 = 3× 38 dégâts = 114 dégâts par clic. Le Guerrier Spatial fait un tir unique = 38 dégâts. Déséquilibre majeur si les munitions ne limitent pas.

---

## 4. PROBLÈMES D'ÉQUILIBRAGE

### E1. Compte de sorts annoncé (13) vs réel (11)

```
Annoncé dans le cahier des charges: 13 sorts signatures
Trouvé dans archetypeCatalog.ts:    11 sorts (Mage 3, Archer 2, Guerrier 2, Spatial 2, Ninja 2)
```

**Manquent**: 2 sorts. Probablement prévus pour l'Archer (n'a qu'un sort non-ultime) et le Ninja (n'a qu'un sort non-ultime).

**Recommandation**: Ajouter un second sort non-ultime à l'Archer (ex: flèche de glace) et au Ninja (ex: lancer de shuriken).

### E2. Guerrier : 2 ultimes, Guerrier Spatial: 2 ultimes — burst trop fort

**Fichier**: `archetypeCatalog.ts:78-97`
**Description**: Le Guerrier a Frappe Dévastatrice (AoE 20%PV + root 3s) + Voile d'Ombre (invisibilité 10s), TOUS DEUX marqués ultimes. Même chose pour le Guerrier Spatial (Tir Brûlant + Téléport). Un joueur peut utiliser les DEUX en séquence sans attendre.
**Impact**: Le Guerrier peut burst (20%PV AoE) + disparaître pendant 10s. Le Guerrier Spatial peut infliger 25%PV DoT + se téléporter. Cela donne un avantage énorme en burst par rapport au Mage (1 ultime) ou à l'Archer (1 ultime).
**Recommandation**: Rendre un des deux sorts non-ultime (ex: Voile d'Ombre CD 30s non-ultime, Saut Quantique CD 45s non-ultime), ou partager un même cooldown entre les deux.

### E3. Mage vs Archer : ultimes identiques (aoe_dodge, 15%PV, radius 5)

**Fichiers**: `archetypeCatalog.ts:61, 75`
**Description**: `mage_meteore` et `archer_pluie` ont exactement le même effet (`aoe_dodge`), même pourcentage (15%), même rayon (5m). Seuls les noms changent.
**Impact**: Pas de différenciation gameplay entre les ultimes du Mage et de l'Archer.
**Recommandation**: Donner à l'Archer un effet différent (ex: tir穿透 + root, ou barrage de flèches sur la durée plutôt qu'une zone unique).

### E4. Ninja sans aucun ultime — déséquilibré

**Fichier**: `archetypeCatalog.ts:99-107`
**Description**: Le Ninja a 2 sorts, tous deux non-ultimes (CD 2s et 30s). Il n'a PAS de cooldown gate pour ses sorts. L'Assaut de l'Ombre (10%PV en dégâts, CD 2s annoncé) est spamable sans cooldown réel.
**Impact**: Le Ninja a un DPS potentiellement supérieur aux autres classes grâce au spam sans contrainte. Éclipse CD 30s annoncé mais jamais appliqué.
**Recommandation**: Soit faire d'Assaut de l'Ombre un ultime, soit ajouter un vrai cooldown store pour les non-ultimes.

### E5. Multiplicateurs de dégâts des frappes non exploités

**Fichier**: `unarmedStrikes.ts:59-78`
```
jab:      0.8×  (faible)
hook:     1.2×  (moyen)
uppercut: 1.8×  (fort)
kick:     1.6×  (moyen-fort)
```
Ces multiplicateurs sont BIEN DÉFINIS mais JAMAIS APPLIQUÉS (cf. B1). L'équilibrage est lettre morte.

### E6. Auto-attack : 20m de portée pour tous les distants

**Fichier**: `AutoAttackSystem.tsx:105`
**Description**: La portée des armes distance est fixe à 20m pour arc, gun ET staff. L'archerie (arc) devrait avoir plus de portée qu'un pistolet. Un même rayon pour tous nivelle les identités.
**Recommandation**: bow=30m, gun=20m, staff=18m.

---

## 5. PROBLÈMES D'ARCHITECTURE

### A1. `advanceCombo` mélange logique de combo ET de choix de strike

**Fichiers**: `unarmedCombat.ts:13-41` vs `unarmedStrikes.ts:94-108`
**Description**: `advanceCombo` contient sa propre logique de finisher (lignes 26-39) qui est une duplication partielle de `strikeForStep`. Les strikes ne sont utilisés QUE dans le retour de advanceCombo (pour le clip), pas pour les dégâts. La latéralité est recalculée dans advanceCombo au lieu d'être déléguée à un module spécialisé.
**Recommandation**: Extraire la logique de finisher de advanceCombo vers strikeForStep, et faire en sorte que le handler de combat utilise le strike pour TOUT (dégâts, range, clip).

### A2. Cône de frappe non configurable

**Fichier**: `AutoAttackSystem.tsx:172`
**Description**: Le cône avant pour les frappes mains nues est fixe : `(dx*fx + dz*fz) / len < 0.25` (~75.5° de demi-angle). Cette valeur n'est ni extraite en constante ni paramétrable par type de frappe (un uppercut devrait avoir un cône plus étroit qu'un hook).

### A3. Pas de notion de "shield" dans le système d'effets d'archétype

**Fichier**: `statusEffects.ts:24`
**Description**: `shield_regen` est défini dans `PlayerFxKind` mais n'est jamais utilisé par les sorts d'archétype (SpellEffect n'a pas de variante "shield"). Les sorts de classe PNJ (tank_iron_wall, heal_barrier) l'utilisent mais aucun sort d'archétype jouable ne le fait.

---

## 6. ANALYSE DES TALENTS (12/12 ✓)

### 6.1 Répartition

| Branche | Talents | Rangs max | Points max | Effets |
|---------|---------|-----------|------------|--------|
| Dégâts | Frappe aiguisée → Précision → Surcharge | 3+3+2=8 | 8 | +dégâts, +crit, +dégâts massifs |
| Survie | Vitalité → Carapace → Endurance | 3+3+2=8 | 8 | +PV, +défense, +PV |
| Mobilité | Célérité → Foulée ample → Réflexes | 3+2+2=7 | 7 | +vitesse, +vitesse, +crit |
| Mana | Affinité magique → Économie → Flux arcanique | 3+3+2=8 | 8 | +mana, -coût, +régén |

**Total points max**: 31 points. **Disponibles à L50**: 10. Soit seulement 32% des rangs max possibles.

### 6.2 Problème de progression

À L50, avec 10 points, le joueur peut remplir UNE branche (8 pts) et commencer une seconde (2 pts). Ou remplir partiellement 2-3 branches. C'est un choix stratégique intéressant MAIS:

- Les nœuds de tiers 3 demandent 5-6 points investis dans la branche avant d'y accéder (3+3 pour dmg_precise, puis surcharge; ou 3+3+2 pour la mana)
- Avec 10 points, on peut atteindre le tiers 3 dans UNE branche (8 pts) et prendre 2 points ailleurs
- Les talents de tiers 3 (Surcharge +10%/rang, Endurance +7%/rang) sont 3× plus efficaces par point que les tiers 1

**Conclusion**: Le système est cohérent. Les prérequis sont bien chaînés. Mais l'économie est serrée — 10 points pour 31 rangs possibles. Le joueur moyen n'atteindra jamais L50.

### 6.3 Incohérence légère

Le talent `mob_reflex` (Réflexes, tier 3 Mobilité) donne du `critFlat` alors qu'il est dans la branche Mobilité. C'est un bonus transversal qui pourrait surprendre. Fonctionnellement correct mais thématiquement ambigu.

---

## 7. ANALYSE DES ARCHÉTYPES × ARMES

### 7.1 Matrice d'équipement

| Archétype | Arme déclarée | Armes autorisées | Notes |
|-----------|---------------|------------------|-------|
| Mage | staff | staff | ✓ Cohérent |
| Archer | bow | bow | ✓ Cohérent |
| Guerrier | sword_1h | sword_1h, sword_2h, dagger, axe, blunt, spear, shield | ✓ Large choix |
| Guerrier Spatial | gun | gun | ✓ Cohérent |
| Ninja | dagger | dagger, sword_1h | ✓ Cohérent |

### 7.2 Problème de l'arme du Guerrier

Le Guerrier part avec `sword_1h` mais peut équiper toutes les armes de mêlée + bouclier. Son pack d'animation (`animation_sword_and_shield`) ne supporte que l'épée 1 main + bouclier. Une hache, une masse, une lance n'auront pas d'animations adaptées → l'animation d'épée sera rejouée sur ces armes. C'est acceptable en v1 mais limité.

---

## 8. RECOMMANDATIONS PRIORITAIRES

### 🔴 Immédiat (bloquant pour la jouabilité)
1. **Appliquer les multiplicateurs de frappe** — remplacer `unarmedDamage` par `strikeDamage` dans `createUnarmedStrikeHandler`
2. **Corriger le rechargement d'arme à feu** — vérifier les cellules avant le rechargement
3. **Appliquer les cooldowns à tous les sorts** — étendre le gate cooldown aux non-ultimes

### 🟡 Court terme (équilibrage)
4. **Unifier les formules de dégâts** — choisir un modèle unique (proposition: physique = flat scaling, sorts = %HP)
5. **Unifier les multiplicateurs crit** — choisir ×1.5 (sorts) ou ×1.75 (physique), pas les deux
6. **Supprimer la duplication finisher** — faire appeler `strikeForStep(3,true,rng)` par `advanceCombo`
7. **Utiliser les ranges de frappe** — remplacer les ranges fixes par `STRIKES[id].range`

### 🟢 Moyen terme (contenu)
8. **Ajouter 2 sorts manquants** — second sort non-ultime pour Archer et Ninja (pour arriver à 13)
9. **Différencier Mage et Archer** — changer l'effet de l'ultime Archer (ex: tir穿透 ou barrage)
10. **Limiter le burst Guerrier/Guerrier Spatial** — un seul ultime par archétype, ou CD partagé
11. **Corriger arch_sword type** — `"sword_1h"` au lieu de `"sword"`
12. **Migrer magazineStore vers tick central** — remplacer setTimeout par frame-driven

---

## 9. FICHIERS VERIFIÉS (23)

```
src/rpg/combat/unarmedCombat.ts          ✓  (47 lignes)
src/rpg/combat/unarmedStrikes.ts         ✓  (127 lignes)
src/rpg/combat/ammoStore.ts              ✓  (48 lignes)
src/rpg/combat/statusEffects.ts          ✓  (181 lignes)
src/rpg/combat/AutoAttackSystem.tsx      ✓  (188 lignes, déplacé)
src/rpg/combat/spellDamage.ts            ✓  (36 lignes)
src/rpg/combat/cooldownStore.ts          ✓  (55 lignes)
src/rpg/combat/rollDamage.ts             ✓  (11 lignes)
src/rpg/combat/damageEvents.ts           ✓  (39 lignes)
src/rpg/combat/npcHitReact.ts            ✓  (19 lignes)
src/rpg/weapons/weaponAnimClips.ts       ✓  (252 lignes, 132 clips)
src/rpg/weapons/weaponAnimationBinder.ts ✓  (34 lignes)
src/rpg/weapons/weaponRegistry.ts        ✓  (37 lignes)
src/rpg/weapons/weaponShop.ts            ✓  (90 lignes)
src/rpg/weapons/weaponClassRules.ts      ✓  (42 lignes)
src/rpg/weapons/weaponClassifier.ts      ✓  (112 lignes)
src/rpg/weapons/weaponCatalog.ts         ✓  (169 lignes)
src/rpg/weapons/magazineStore.ts         ✓  (79 lignes)
src/rpg/weapons/weaponProfiles.json      ✓  (44 lignes)
src/rpg/archetypes/archetypeCatalog.ts   ✓  (115 lignes)
src/rpg/archetypes/castArchetypeSpell.ts ✓  (142 lignes)
src/rpg/archetypes/archetypeStore.ts     ✓  (59 lignes)
src/rpg/archetypes/archetypeWeapon.ts    ✓  (16 lignes)
src/rpg/classes/classes.ts              ✓  (61 lignes)
src/rpg/talents/talentCatalog.ts         ✓  (111 lignes, 12 talents)
src/rpg/talents/talentEffects.ts         ✓  (110 lignes)
src/rpg/talents/talentRuntime.ts         ✓  (24 lignes)
src/rpg/spells/spellCatalog.ts           ✓  (89 lignes, 12 sorts)
src/rpg/spells/SpellDef.ts              ✓  (47 lignes)
docs/superpowers/specs/*.md              ✓  (2 specs)
```

---

*Rapport généré par Équipe AUDIT COMBAT (5 agents). Analyse statique complète. Aucun test d'exécution réalisé.*