# Agent 6/6 — Rapport de vérification finale FPS

**Projet :** Narvos Prime — WebPortal  
**Date :** 2026-07-30  
**Build :** tsc — 0 erreur FPS (8 pre‑existantes ignorées) · 96 fichiers test, **761 tests OK**

---

## 1. Architecture vérifiée

### 1.1 Chaîne d'affichage FPS

```
PlayerRig (useFrame)
  ↓ camState.view = "fps"
  ↓ cameraViewStore.set("fps")
    ↓ useSyncExternalStore → re-render RpgGameWorld
      ↓ cameraView === "fps" && !gatheringBucheron
        ↓ weaponDrawn && wp ? FpsWeaponViewmodel : FpsUnarmedViewmodel
```

### 1.2 Composants FPS

| Composant | Rôle | Props reçues |
|---|---|---|
| `FpsWeaponViewmodel` | Arme 3D en overlay 1ʳᵉ personne | `weaponPath`, `fireToken`, `onFireImpact`, `externalIdleGlb`, `externalFireGlb` |
| `FpsUnarmedViewmodel` | Bras nus FPS (SK_Mannequin_Arms) | `fireToken`, `onFireImpact` |
| `BucheronAxeViewmodel` | Hache bûcheron FPS (forcée pendant coupe) | `swingToken`, `onImpact` |

### 1.3 Stores

| Store | Rôle | Source de vérité |
|---|---|---|
| `cameraViewStore` | Miroir React de `camState.view` | Module‑level listeners, notification au changement seulement |
| `equippedWeaponStore` | Armes équipées + slot actif | Module‑level listeners, notification au changement seulement |
| `weaponRegistry` | Résolution path/type par weaponId | Singleton statique |

---

## 2. TPS ↔ FPS Transitions — VÉRIFIÉ OK

### 2.1 Bascule volontaire (V / F1 / F3)

- `InputManager.onKeyDown` détecte `viewFps` / `viewTps` → pose `viewRequest`
- `PlayerRig.useFrame` consomme `viewRequest` → `camState.current.view = vr` + `cameraViewStore.set(vr)`
- `useCameraView()` (= `useSyncExternalStore`) notifie React → re‑render
- `RpgGameWorld` conditionne l'affichage à `cameraView === "fps"`

**Chaîne complète validée :**  
`KeyV` → InputManager → PlayerRig → camState.view + store → React → Viewmodel monté/démonté

### 2.2 Vue forcée bûcheron

- `gatheringBucheron = true` force `camState.current.view = "fps"` + `cameraViewStore.set("fps")`
- L'`useEffect` sauvegarde `prevViewRef.current` et restaure la vue au cleanup
- Le bûcheron désactive les autres viewmodels FPS (`!gatheringBucheron`)

**Propre, pas de fuite de vue.**

### 2.3 Bascule automatique par changement d'arme

- `weaponDrawn` toggle (F) commute l'affichage entre `FpsWeaponViewmodel` (arme) et `FpsUnarmedViewmodel` (bras)
- La transition est instantanée car le re‑render React se produit déjà via `setWeaponDrawn()`

---

## 3. Impact du toggle Ctrl (Crouch) — VÉRIFIÉ

### 3.1 Binding

- `crouch: ["ControlLeft", "ControlRight"]` → `InputManager.crouchHeld`
- `flyDown: ["ControlRight"]` → `InputManager.flyDown` (noclip uniquement)

### 3.2 Effet sur la vue FPS

- `CharacterController` traite `crouchHeld` en mode toggle : `crouchToggle = !crouchToggle`
- `state.crouching = grounded && crouchToggle && !sliding`
- La capsule de physique rétrécit (`crouchHeightMult = 0.55`)
- `playerPosition` (= centre de capsule) descend → `FpsCamera.applyFps()` positionne la caméra plus bas
- Le viewmodel FPS suit la caméra (copie `camera.position` et `camera.quaternion`)

**Aucune interférence avec l'affichage FPS — la caméra descend, le viewmodel suit.**

### 3.3 Conflit Ctrl potentiel

`ControlRight` est lié à la fois à `crouch` et `flyDown`. En noclip (`state.noclip`),:
- `CharacterController` ignore `crouchHeld` si `!grounded` et `noclip` → pas de conflit
- `flyDown` gère la descente libre séparément

**Résolution : pas de conflit runtime.**

---

## 4. BUGS DÉTECTÉS — 4 restants

### 🔴 B1 — Double dégâts armes (FpsWeaponViewmodel)

**Fichier :** `RpgGameWorld.tsx` lignes 1675 + 3200  
**Description :**  
Le clic gauche appelle `autoAttackRef.current()` directement (ligne 1675).  
Le viewmodel FPS appelle le MÊME callback via `onFireImpact` à 40% de l'anim (ligne 3200).

→ **Les dégâts sont appliqués DEUX FOIS par clic :** une fois immédiatement, une fois à l'impact visuel.

**Correction :**  
Remplacer `onFireImpact={autoAttackRef.current ?? undefined}` par `undefined` dans `FpsWeaponViewmodel`. La source de vérité des dégâts doit être le clic, pas l'impact animé. Ou, alternativement, ne PAS appeler `autoAttackRef.current()` dans `onMouseDown` et laisser le viewmodel gérer l'impact.

```diff
// Ligne 3197-3204
 <FpsWeaponViewmodel
   weaponPath={wp.path}
   fireToken={camState.current.attackToken}
-  onFireImpact={autoAttackRef.current ?? undefined}
+  // onFireImpact retiré : les dégâts sont appliqués au clic (onMouseDown)
   externalIdleGlb={shotgun?.weapon.idleHip}
   externalFireGlb={shotgun?.weapon.hipFire}
 />
```

---

### 🔴 B2 — Double dégâts corps-à-corps (FpsUnarmedViewmodel)

**Fichier :** `RpgGameWorld.tsx` lignes 1696 + 3210  
**Description :**  
Le relâché du clic en mode mains nues appelle `unarmedStrikeRef.current(...)` (ligne 1697).  
Le viewmodel FPS appelle `autoAttackRef.current` via `onFireImpact` (ligne 3210).

→ **Les dégâts unarmed sont doublés :** le vrai coup (`unarmedStrikeRef`) + le melee fallback de `autoAttackRef`.

**Correction :**  
```diff
 // Ligne 3208-3211
 <FpsUnarmedViewmodel
   fireToken={camState.current.attackToken}
-  onFireImpact={autoAttackRef.current ?? undefined}
+  // onFireImpact retiré : les dégâts sont gérés par unarmedStrikeRef
 />
```

---

### 🟡 B3 — Animation de frappe non déclenchée en FPS (FpsUnarmedViewmodel)

**Fichier :** `RpgGameWorld.tsx` ligne 3209  
**Description :**  
`FpsUnarmedViewmodel` reçoit `fireToken={camState.current.attackToken}`.  

Mais les frappes mains nues (`createUnarmedStrikeHandler`) incrémentent **`oneShotToken`**, pas `attackToken`.  
→ Quand le joueur frappe en FPS, `fireToken` ne change PAS → l'anim de punch ne joue jamais sur les bras.

**Correction — deux options :**

**Option A (simple) :** Incrémenter `attackToken` en même temps que `oneShotToken` dans `createUnarmedStrikeHandler` :
```typescript
// AutoAttackSystem.tsx ligne 167
camState.current.oneShotAction = action;
camState.current.oneShotToken += 1;
camState.current.attackToken += 1;  // déclenche l'anim FPS
```

**Option B (propre) :** Passer `camState.current.oneShotToken` en prop supplémentaire au viewmodel, ou fusionner les deux tokens en un seul canal d'attaque. Option A suffit pour la P4.

---

### 🟡 B4 — `autoAttackRef` utilisé par les deux viewmodels (incohérence sémantique)

**Fichier :** `RpgGameWorld.tsx` lignes 3200, 3210  
**Description :**  
Le même `autoAttackRef.current` est passé en `onFireImpact` aux deux viewmodels, mais :
- `FpsWeaponViewmodel` est monté quand une arme est équipée ET dégainée → autoAttack est pertinent
- `FpsUnarmedViewmodel` est monté quand AUCUNE arme n'est équipée → autoAttack n'est pas pertinent (et ses dégâts melee entrent en conflit avec le vrai système unarmed)

Même après correction des bugs B1/B2, le passage de `autoAttackRef` à `FpsUnarmedViewmodel` n'a aucun sens métier.

**Correction :** déjà incluse dans les diffs B1+B2 (retrait de `onFireImpact` pour les deux viewmodels, ou remplacement par le bon handler pour les armes seulement).

---

## 5. VÉRIFICATIONS AUTOMATISÉES

| Vérification | Statut |
|---|---|
| `tsc --noEmit` (fichiers FPS) | ✅ 0 erreur |
| `tsc --noEmit` (tout projet) | ⚠️ 8 erreurs pré-existantes (KTX2Loader, mouseUp) — aucune dans les fichiers FPS |
| `vitest run` (96 fichiers, 761 tests) | ✅ 761/761 pass |
| Tests `cameraViewStore.test.ts` (5) | ✅ 5/5 pass |
| Tests `equippedWeaponStore.test.ts` (2) | ✅ 2/2 pass |

---

## 6. RÉSUMÉ EXÉCUTIF

### Ce qui fonctionne correctement

- TPS → FPS → TPS transitions : mécanisme store/miroir propre, pas de fuite de re‑render
- Vue forcée bûcheron : sauvegarde/restaure la vue, pas de conflit avec les viewmodels d'arme
- Toggle arme (F) : commute instantanément `FpsWeaponViewmodel` ↔ `FpsUnarmedViewmodel`
- Crouch (Ctrl) : la caméra descend, le viewmodel suit — pas d'interférence
- ADS (clic droit maintenu) : blend hip → centré avec sway réduit
- `cameraViewStore` : le NO‑OP sur valeur identique évite 60 re‑render/s

### Ce qu'il reste à corriger (priorité P4 → P1)

| ID | Priorité | Bug | Fichier |
|---|---|---|---|
| B1 | **P0** (dégâts ×2) | Double dégâts armes | `RpgGameWorld.tsx:1675+3200` |
| B2 | **P0** (dégâts ×2) | Double dégâts unarmed | `RpgGameWorld.tsx:1696+3210` |
| B3 | **P2** (anim absente) | Animation de punch non jouée en FPS | `RpgGameWorld.tsx:3209` + `AutoAttackSystem.tsx:167` |
| B4 | **P3** (qualité) | `autoAttackRef` passé aux deux viewmodels | `RpgGameWorld.tsx:3200+3210` |

### Re‑test après correction

Commande à exécuter :
```bash
npx tsc --noEmit
npx vitest run
```
Aucune régression attendue — les corrections suppriment des appels redondants et ajoutent une ligne `attackToken += 1`.