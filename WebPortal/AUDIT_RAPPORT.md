# AUDIT DATA — Rapport Complet
**Projet:** Narvos Prime WebPortal  
**Date:** 2026-07-29  
**Équipe:** AUDIT DATA (10 agents)

---

## Résumé Exécutif

| Fichier | Lignes | Problèmes |
|---|---|---|
| playerConfig.ts | 103 | 2 |
| npcStatPresets.ts | 14 | 0 |
| npcLeveling.ts | 110 | 1 |
| weaponProfiles.json | 44 | 4 |
| weaponScale.ts | 43 | 0 |
| weaponAnimClips.ts | 252 | 0 |
| weaponClassRules.ts | 42 | 0 |
| rigProfiles.ts | 26 | 0 |
| types.ts | 204 | 1 |
| assets-manifest.json | 30 | 1 |
| **Cross-file** | — | **5** |
| **Total** | | **14** |

---

## 1. CRITIQUES (Sévérité Haute)

### 🔴 H1 — `weaponProfiles.json`: grip incohérent pour arch_gun (ligne 34)
```json
"arch_gun": { "grip": "one_hand", ... }
```
**weaponClassifier.ts** définit le gun comme `grip: "two_hand"` (avec `supportSocket: "LeftHand"`).  
**Impact :** si weaponProfiles.json est utilisé DIRECTEMENT (contournant le classifier), l'arme à feu sera tenue à une main au lieu de deux — perte de la main de support et problème visuel/IK.

### 🔴 H2 — `weaponProfiles.json`: type "sword" ne correspond à aucun WeaponType
```json
"arch_sword": { "type": "sword", ... }
```
`WeaponType` (weaponClassifier.ts) n'a que `sword_1h` et `sword_2h`, pas "sword".  
**Impact :** `weaponScale.ts` reçoit un type inconnu → `WEAPON_TARGET_SIZE["sword"]` = `undefined` → fallback à `0.6`. L'épée risque d'être sous-dimensionnée.  
**Note :** l'interface `WeaponProfile.type` est `string` (libre jusqu'à SP-4), donc permis architecturale-ment mais cassant en pratique.

### 🔴 H3 — `assets-manifest.json`: désert de données
Tous les tableaux sont vides (`heroes: []`, `monsters: []`, etc.), tous les compteurs à zéro.  
**Timestamp :** 2026-07-29T16:56:15 → récent, mais aucun asset enregistré.  
**Impact :** impossible de valider les chemins GLB des armes, NPC, ou maps. Les clés ZONE_LEVEL_RANGES ("forge", "orbital", "tower") ne peuvent pas être vérifiées contre `assetManifest.MAPS`.

### 🔴 H4 — `playerConfig.ts` vs `characterScale.ts`: décalage commentaire/réalité
**characterScale.ts** (lignes 9-12) :  
> "Modifier le scale en jeu ne réévalue PAS ces fichiers → un reload est requis"

**playerConfig.ts** (lignes 70-76) :
```ts
get radius() { return NATIVE.radius * characterScaleStore.get(); }
```
Les getters appellent `characterScaleStore.get()` à CHAQUE accès → RÉÉVALUATION dynamique.  
**Impact :** la capsule de collision et la caméra FPS suivent LIVEMENT le slider scale, contrairement à ce que dit la doc. Le "reload required" annoncé est factice.

---

## 2. PROBLÈMES CROSS-FILE (Sévérité Moyenne)

### 🟡 M1 — Typos: "meelee" au lieu de "melee" (consistent dans tout le code)
- `weaponProfiles.json` ligne 41 : `"animationProfile": "meelee"`
- `weaponClassifier.ts` : `animPackFolder: "animation_meelee"` (x4 occurrences)
- `weaponAnimationBinder.ts` : `"animation_meelee": WEAPON_MELEE_PACK`

C'est une faute d'orthographe cohérente à 100% — ça marche, mais c'est incorrect en anglais et en français ("mêlée").

### 🟡 M2 — `weaponClassRules.ts` vs `weaponProfiles.json` : types manquants
Les règles de classe (weaponClassRules.ts) n'autorisent que 6 WeaponType :
- `mage` → staff
- `archer` → bow
- `guerrier` → sword_1h, sword_2h, dagger, axe, blunt, spear, shield
- `guerrier_spatial` → gun
- `ninja` → dagger, sword_1h

Les `weaponProfiles.json` ne couvrent que : sword, shield, bow, ammo, staff, gun, dagger — PAS de profiles pour : sword_2h, axe, blunt, spear (pourtant permis par les règles de classe). Ce sont les seules armes du catalogue auto-généré qui rempliront ces slots.

### 🟡 M3 — `FactionId` absente de `types.ts`
La tâche mentionnait FactionId dans types.ts. Elle est en fait définie dans `worldTypes.ts` :
```ts
export type FactionId = 'akarlys' | 'mezalayis' | 'zayan';
```
Utilisée par 10 fichiers. Pas une erreur, mais un écart par rapport à l'architecture attendue.

### 🟡 M4 — `animationProfile` dans weaponProfiles.json : métadonnée SP-4 ignorée
Le champ `animationProfile` existe dans les 7 profiles mais `weaponTypes.ts` précise "indice SP-4 (ignoré en SP-1)".  
**Impact :** ces 7 valeurs (sword_and_shield, archer, magie, shooter, meelee) sont inactives — le binding réel passe par le classifyWeapon(). Si SP-4 active ce champ sans vérification, tout décalage entre les deux sources créera des bugs silencieux.

---

## 3. PROBLÈMES MINEURS

### 🔵 m1 — `npcStatPresets.ts`: valeurs françaises dans enum
```ts
type Difficulty = "facile" | "difficile" | "expert";
```
Le reste du code utilise l'anglais (`"guerrier"` est un nom de classe, pas un adjectif). Mix de langues possiblement déroutant.

### 🔵 m2 — Tous les offsets dans weaponProfiles.json sont zéro
Position [0,0,0], rotation [0,0,0] pour les 7 profiles.  
Aucun ajustement manuel n'a été fait — toutes les armes apparaissent à l'origine exacte du socket.

### 🔵 m3 — `zones level ranges`: clés non vérifiables
```ts
ZONE_LEVEL_RANGES = { forge: [1,20], orbital: [10,30], tower: [30,50] }
```
Ces clés ne peuvent pas être croisées avec le manifeste des maps (vide). **forge** semble faire référence à "Forge World", **orbital** aux maps spatiales, **tower** au mode Tower. Cohérent entre elles, mais pas vérifiable.

### 🔵 m4 — `npcLeveling`: HP_GROWTH > DMG_GROWTH
HP_GROWTH_PER_LEVEL = 0.12 vs DMG_GROWTH_PER_LEVEL = 0.10.  
Les ennemis gagnent +12% PV/niveau mais +10% dégâts/niveau. Intentionnel (rendre les ennemis plus tanky que dangereux), mais pas documenté dans le fichier.

### 🔵 m5 — `playerConfig`: groundSnap (0.08) non scalé
Tous les paramètres de collision (radius, height, stepHeight, eyeHeight) sont des getters scalés par characterScale.  
`groundSnap: 0.08` est fixe. Pourrait causer des problèmes à très petite ou très grande échelle.

### 🔵 m6 — ClientSidePrediction absente
Aucune configuration de prédiction client (lag compensation, interpolation) n'est présente dans playerConfig malgré le tag "FPS moderne". Probablement pour plus tard.

### 🔵 m7 — `npcStatPresets`: BOSS_STATS.resistMult (0.2) entre "difficile" (0.15) et "expert" (0.30)
Pas une incohérence, mais le boss est moins résistant qu'un mob expert standard. Vérifier l'intention design.

---

## 4. VÉRIFICATIONS PASSÉES (Aucun problème)

| Vérification | Statut |
|---|---|
| Toutes les constantes de `playerConfig` sont utilisées par au moins un getter ou une export | ✅ |
| `NATIVE` (playerConfig) entièrement référencé par les getters dynamiques | ✅ |
| `DEFAULT_RANGE` (npcLeveling) utilisé par `zoneLevelRange()` | ✅ |
| `Difficulty` → `DIFFICULTY_PRESETS` exhaustif (3/3 valeurs couvertes) | ✅ |
| `BOSS_STATS` / `MOB_STATS` ont les 3 champs (scaleMult, hpMult, resistMult) | ✅ |
| `clampResist` borne bien 0..0.9, tous les resistMult sont dans cette plage | ✅ |
| `SERVER_CONFIG` complet (name, xpRate, enemyStatMult) | ✅ |
| `WeaponType` (14 valeurs) couvert exhaustivement par `WEAPON_TARGET_SIZE` | ✅ |
| `WEAPON_ANIM_CLIPS` : 5 familles, 9 actions, ~132 chemins — pas de doublon | ✅ |
| `RIG_PROFILES` : 3 familles × 4 sockets = 12 entrées, toutes présentes | ✅ |
| `WeaponAnimAction` vs actions utilisées : draw/fire/holster/idle/inspect/locomotion/pin/reload/throw — tous couverts | ✅ |
| `ArchetypeId` (5) couvert exhaustivement par `ALLOWED` dans weaponClassRules | ✅ |
| `GripKind`, `SocketName`, `RigFamily` complets et cohérents | ✅ |
| Clips regex `FAMILLE_RE` ordonnés du plus spécifique au plus générique | ✅ |
| Pas de constantes orphelines dans les fichiers audités | ✅ |

---

## 5. STATISTIQUES

| Métrique | Valeur |
|---|---|
| Fichiers audités | 13 (10 listés + weaponClassifier, weaponTypes, weaponAnimationBinder) |
| Lignes de config/données | ~1 200 |
| Problèmes H (critique) | 4 |
| Problèmes M (moyen) | 4 |
| Problèmes m (mineur) | 7 |
| **Total** | **14** |
| Constants inutilisées | 0 |
| Doublons dans les données | 0 |
| Fichiers sans aucun problème | 5 (weaponScale, weaponAnimClips, weaponClassRules, rigProfiles, weaponAnimationBinder) |

---

## 6. ACTIONS RECOMMANDÉES

1. **Corriger H1** — uniformiser le grip de `arch_gun` : passer à `"two_hand"` (ou documenter pourquoi one_hand dans le profile manuel)
2. **Corriger H2** — renommer `"type": "sword"` → `"type": "sword_1h"` dans weaponProfiles.json
3. **Corriger H4** — soit figer les getters de playerConfig avec `CHARACTER_SCALE_AT_BOOT`, soit corriger le commentaire dans characterScale.ts
4. **Populer H3** — lancer le script de génération du assets-manifest ou documenter pourquoi il est vide
5. **Documenter M4** — ajouter un commentaire dans weaponProfiles.json que `animationProfile` est SP-4 dormant
6. **Cosmétique M1** — renommer "meelee" → "melee"/"mêlée" dans tous les fichiers (rechercher `meelee` dans tout le projet)