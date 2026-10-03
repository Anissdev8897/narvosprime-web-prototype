# SP-A — Combat à mains nues — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vrai combat à mains nues (combo 3 coups à dégâts réels, réaction d'impact, esquive i-frames, K.O. ennemi sur finisher) à partir du répertoire `animation_punch`, relié au système de combat existant.

**Architecture:** Modules purs testables (machine de combo + dégâts) + nouveau `kind:"stun"` dans `statusEffects` + un canal one-shot générique (`oneShotToken/oneShotAction`) dans `PlayerState` que `HumanCharacter` joue. Le répertoire `animation_punch` est déclaré comme packs GLB (`UNARMED_PACK` joueur, `REACTIONS_PACK` PNJ). Combat armé/sorts inchangés.

**Tech Stack:** React 19, R3F, Three.js, TypeScript, Vitest. Spec : `docs/superpowers/specs/2026-06-08-sp-a-combat-mains-nues-design.md`.

**NB dépôt :** le projet n'est PAS sous git (aucun repo) → les steps "Commit" sont remplacés par un checkpoint `npx tsc --noEmit && npx vitest run`. La cwd du shell se réinitialise → utiliser des chemins absolus (`cd "D:/mes_projet/narvosprime-web-prototype/WebPortal" && …`).

---

## File Structure

- Create `src/rpg/combat/unarmedCombat.ts` — machine de combo + calcul de dégâts (pur, testable).
- Modify `src/rpg/combat/statusEffects.ts` — +`kind:"stun"`, `applyStun`/`isStunned`, tick.
- Modify `src/rpg/types.ts` — +ActionId `punch1/punch2/punch3/kick/stun`.
- Modify `src/rpg/animation/AnimationController.ts` — +entrées `CLIP_CANDIDATES` + ces actions dans `ONE_SHOT`.
- Modify `src/rpg/animation/animationPacks.ts` — +`UNARMED_PACK`, +`REACTIONS_PACK` (déclare le répertoire).
- Modify `src/rpg/runtime/movement/playerState.ts` — +`oneShotToken`, +`oneShotAction`, +`hitToken`.
- Modify `src/rpg/characters/HumanCharacter.tsx` — merge clips unarmed + joue `oneShotAction`.
- Modify `src/rpg/runtime/RpgGameWorld.tsx` — branche clic-gauche mains nues, i-frames esquive (LShift), `hitToken` impact, finisher→stun.
- Modify `src/rpg/npc/Npc.tsx` — lecture stun (gel IA + clip Stunned), merge REACTIONS_PACK.
- Tests : `src/rpg/combat/unarmedCombat.test.ts`, ajouts dans `src/rpg/combat/statusEffects.test.ts`.

---

### Task 1: Assets — convertir le répertoire `animation_punch` + déclarer les packs

**Files:**
- Convert: `public/models/assets_character/Sorceres_hi_poly/animation_punch/*.fbx` → `*.glb`
- Modify: `src/rpg/animation/animationPacks.ts`

- [ ] **Step 1: Convertir les 10 FBX → GLB anim-only**

Tester Blender d'abord :
```bash
cd "D:/mes_projet/narvosprime-web-prototype/WebPortal"
which blender || ls "/c/Program Files/Blender Foundation"/*/blender.exe 2>/dev/null || echo "BLENDER ABSENT"
```
Si présent, convertir chaque FBX (script existant `tools/blender_anim_only.py`) :
```bash
DIR="public/models/assets_character/Sorceres_hi_poly/animation_punch"
for f in "$DIR"/*.fbx; do
  out="${f%.fbx}.glb"
  blender -b -P tools/blender_anim_only.py -- "$f" "$out"
done
ls "$DIR"/*.glb
```
**Fallback si Blender ABSENT** : utiliser le serveur MCP Blender (`mcp__blender__execute_blender_code`) pour exécuter le même import/strip/export, OU charger les FBX directement au runtime (les specs de pack pointeront `.fbx` ; `useGltfAnimationPack` doit alors router FBXLoader — vérifier le support dans `useFbxAnimationPack.ts`). Préférer GLB.

Expected : 10 `.glb` présents dans `animation_punch/`.

- [ ] **Step 2: Déclarer le répertoire comme packs**

Dans `src/rpg/animation/animationPacks.ts`, à la fin du fichier, ajouter :
```ts
// ── Répertoire animation_punch (combat à MAINS NUES) ────────────────────────────
// Déclaration STATIQUE du dossier (pas d'UI d'ajout dynamique — choix projet).
// Rig Sorcier (Mixamo natif) → chargé SANS strip (garde "mixamorig:") côté joueur.
const PUNCH_DIR = "Sorceres_hi_poly/animation_punch";

/** Pack JOUEUR : combo (punch1/2/3 + kick), réaction d'impact. */
export const UNARMED_PACK: FbxAnimSpec[] = buildPack(PUNCH_DIR, {
  punch1: "Punching.glb",
  punch2: "Cross Punch.glb",
  punch3: "Uppercut.glb",
  kick:   "Roundhouse Kick.glb",
  hit:    "Hit Reaction.glb",
});

/** Pack RÉACTIONS PNJ : K.O. (joué quand l'ennemi est étourdi par le finisher). */
export const REACTIONS_PACK: FbxAnimSpec[] = buildPack(PUNCH_DIR, {
  stun: "Stunned.glb",
});
```

- [ ] **Step 3: Checkpoint**

```bash
cd "D:/mes_projet/narvosprime-web-prototype/WebPortal" && npx tsc --noEmit
```
Expected : exit 0. (tsc échouera si `punch1/punch2/punch3/kick/stun` ne sont pas encore des `ActionId` → faire Task 2 AVANT ce checkpoint, ou accepter l'échec temporaire et enchaîner Task 2.)

---

### Task 2: ActionId + CLIP_CANDIDATES

**Files:**
- Modify: `src/rpg/types.ts:38-50`
- Modify: `src/rpg/animation/AnimationController.ts:20-39`

- [ ] **Step 1: Étendre l'union ActionId**

`src/rpg/types.ts`, remplacer le bloc `export type ActionId =` (lignes 38-50) par :
```ts
export type ActionId =
  | "idle"
  | "walk"
  | "run"
  | "sprint"
  | "jump"
  | "attack"
  | "cast"
  | "channeling"
  | "hit"
  | "death"
  | "dodge"
  | "ultimate"
  | "punch1"
  | "punch2"
  | "punch3"
  | "kick"
  | "stun";
```

- [ ] **Step 2: Mapper les candidats de clips + marquer one-shots**

`src/rpg/animation/AnimationController.ts`, dans `CLIP_CANDIDATES` (objet lignes 20-36), ajouter ces entrées (avant la `}` fermante) et enrichir `hit` :
```ts
  punch1:     ["punch1", "Punching"],
  punch2:     ["punch2", "Cross Punch"],
  punch3:     ["punch3", "Uppercut"],
  kick:       ["kick", "Roundhouse Kick", "Martelo"],
  stun:       ["stun", "Stunned"],
```
Et remplacer la ligne `hit:` existante par (ajoute les réactions du répertoire) :
```ts
  hit:        ["hit", "Hit Reaction", "Big Hit To Head", "Standing React Small From Front", "React", "Hit"],
```
Puis étendre `ONE_SHOT` (ligne 39) pour que les coups reviennent à l'idle après :
```ts
const ONE_SHOT: Set<ActionId> = new Set(["attack", "cast", "hit", "jump", "dodge", "ultimate", "punch1", "punch2", "punch3", "kick"]);
```
(`stun` n'est PAS one-shot : il est maintenu tant que le statut dure, géré côté PNJ.)

- [ ] **Step 3: Checkpoint**

```bash
cd "D:/mes_projet/narvosprime-web-prototype/WebPortal" && npx tsc --noEmit
```
Expected : exit 0.

---

### Task 3: `unarmedCombat.ts` — combo + dégâts (pur, testable)

**Files:**
- Create: `src/rpg/combat/unarmedCombat.ts`
- Test: `src/rpg/combat/unarmedCombat.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/rpg/combat/unarmedCombat.test.ts
import { describe, it, expect } from "vitest";
import { createCombo, advanceCombo, unarmedDamage, COMBO_WINDOW_MS } from "./unarmedCombat";

describe("unarmedCombat — combo", () => {
  it("3 clics dans la fenêtre → punch1, punch2, punch3 (finisher)", () => {
    const c = createCombo();
    const a = advanceCombo(c, 0, () => 0);
    const b = advanceCombo(c, 100, () => 0);
    const d = advanceCombo(c, 200, () => 0);
    expect(a).toEqual({ action: "punch1", isFinisher: false });
    expect(b).toEqual({ action: "punch2", isFinisher: false });
    expect(d).toEqual({ action: "punch3", isFinisher: true });
  });
  it("clic hors fenêtre → reset à punch1", () => {
    const c = createCombo();
    advanceCombo(c, 0, () => 0);
    const late = advanceCombo(c, COMBO_WINDOW_MS + 50, () => 0);
    expect(late.action).toBe("punch1");
  });
  it("finisher peut être un kick selon le rng", () => {
    const c = createCombo();
    advanceCombo(c, 0, () => 0.9); advanceCombo(c, 50, () => 0.9);
    expect(advanceCombo(c, 100, () => 0.9)).toEqual({ action: "kick", isFinisher: true });
  });
});

describe("unarmedCombat — dégâts", () => {
  it("dégât de base = round(5 + puissance*0.4)", () => {
    expect(unarmedDamage(10, false)).toBe(9);
  });
  it("finisher = ×2", () => {
    expect(unarmedDamage(10, true)).toBe(18);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "D:/mes_projet/narvosprime-web-prototype/WebPortal" && npx vitest run src/rpg/combat/unarmedCombat.test.ts`
Expected : FAIL — `Cannot find module './unarmedCombat'`.

- [ ] **Step 3: Implement**

```ts
// src/rpg/combat/unarmedCombat.ts — machine d'état du combo mains nues + dégâts (pur).
import type { ActionId } from "../types";

export const COMBO_WINDOW_MS = 600; // fenêtre pour enchaîner le coup suivant

export interface ComboState { step: number; lastHitAt: number; }
export function createCombo(): ComboState { return { step: 0, lastHitAt: -Infinity }; }

/** Avance le combo. `nowMs` = horloge (performance.now()). `rng` injectable (testable).
 *  Mute `state` en place et renvoie l'action à jouer + si c'est le finisher. */
export function advanceCombo(
  state: ComboState, nowMs: number, rng: () => number = Math.random,
): { action: ActionId; isFinisher: boolean } {
  const within = nowMs - state.lastHitAt <= COMBO_WINDOW_MS;
  state.step = within && state.step < 3 ? state.step + 1 : 1;
  state.lastHitAt = nowMs;
  if (state.step === 1) return { action: "punch1", isFinisher: false };
  if (state.step === 2) return { action: "punch2", isFinisher: false };
  return { action: rng() < 0.5 ? "punch3" : "kick", isFinisher: true };
}

/** Dégât d'un coup mains nues. Faible ; finisher ×2. Échelle avec la puissance. */
export function unarmedDamage(puissance: number, isFinisher: boolean): number {
  const base = Math.round(5 + puissance * 0.4);
  return isFinisher ? base * 2 : base;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "D:/mes_projet/narvosprime-web-prototype/WebPortal" && npx vitest run src/rpg/combat/unarmedCombat.test.ts`
Expected : PASS (5 tests).

---

### Task 4: `statusEffects` — K.O. (stun)

**Files:**
- Modify: `src/rpg/combat/statusEffects.ts`
- Test: `src/rpg/combat/statusEffects.test.ts` (existant — ajouter un describe)

- [ ] **Step 1: Write the failing test (ajout)**

Ajouter à `src/rpg/combat/statusEffects.test.ts` :
```ts
import { statusEffects } from "./statusEffects";
// (si le fichier a déjà des imports, ne pas dupliquer)

describe("statusEffects — stun (K.O.)", () => {
  it("applyStun → isStunned true, puis false après expiration", () => {
    statusEffects.reset();
    statusEffects.applyStun("e1", 1.0);
    expect(statusEffects.isStunned("e1")).toBe(true);
    statusEffects.tick(0.5);
    expect(statusEffects.isStunned("e1")).toBe(true);
    statusEffects.tick(0.6); // total 1.1 > 1.0
    expect(statusEffects.isStunned("e1")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "D:/mes_projet/narvosprime-web-prototype/WebPortal" && npx vitest run src/rpg/combat/statusEffects.test.ts`
Expected : FAIL — `applyStun`/`isStunned` n'existent pas.

- [ ] **Step 3: Implement**

Dans `src/rpg/combat/statusEffects.ts` :
- Ajouter le type (après `BurnFx`, ligne 19) :
```ts
interface StunFx { kind: "stun"; remaining: number; }
```
- Étendre l'union (ligne 20) :
```ts
type NpcFx = RootFx | BurnFx | StunFx;
```
- Ajouter l'application (après `applyRoot`, ~ligne 33) :
```ts
  /** Étourdit un PNJ (K.O.) : ne peut ni bouger ni attaquer pendant `duration` s. */
  applyStun(npcId: string, duration: number): void {
    if (duration <= 0) return;
    this.add(npcId, { kind: "stun", remaining: duration });
  }
```
- Ajouter la lecture (après `isRooted`, ~ligne 49) :
```ts
  isStunned(npcId: string): boolean {
    const list = this.npc.get(npcId);
    return !!list && list.some((e) => e.kind === "stun" && e.remaining > 0);
  }
```
Le `tick()` existant décrémente déjà `e.remaining` pour tous les `NpcFx` et purge les expirés → aucune modif de `tick` nécessaire.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "D:/mes_projet/narvosprime-web-prototype/WebPortal" && npx vitest run src/rpg/combat/statusEffects.test.ts`
Expected : PASS.

---

### Task 5: `PlayerState` — canal one-shot + impact

**Files:**
- Modify: `src/rpg/runtime/movement/playerState.ts`

- [ ] **Step 1: Ajouter les champs**

Dans `interface PlayerState` (après `reloadToken`, ligne 32), ajouter :
```ts
  /** Canal générique "jouer ce one-shot maintenant" (punch/kick/hit/dodge). */
  oneShotToken: number;
  oneShotAction: ActionId;
  /** Incrémenté quand le joueur ENCAISSE un coup → réaction d'impact. */
  hitToken: number;
```
Ajouter l'import en haut du fichier :
```ts
import type { ActionId } from "../../types";
```
Dans `createPlayerState()` (objet retourné), ajouter :
```ts
    oneShotToken: 0,
    oneShotAction: "punch1",
    hitToken: 0,
```

- [ ] **Step 2: Checkpoint**

```bash
cd "D:/mes_projet/narvosprime-web-prototype/WebPortal" && npx tsc --noEmit
```
Expected : exit 0.

---

### Task 6: `HumanCharacter` — clips unarmed + jouer les one-shots

**Files:**
- Modify: `src/rpg/characters/HumanCharacter.tsx`

- [ ] **Step 1: Importer le pack + le loader**

En haut de `HumanCharacter.tsx`, ajouter aux imports (à côté de `useGltfAnimationPack`) :
```ts
import { UNARMED_PACK } from "../animation/animationPacks";
```
(`useGltfAnimationPack` est déjà importé — cf. usage ligne 353.)

- [ ] **Step 2: Charger + merger les clips unarmed**

Dans `HumanCore`, juste avant le `const clips = useMemo(...)` (ligne 147), ajouter :
```ts
  // Clips de combat mains nues (rig Sorcier Mixamo → SANS strip, garde "mixamorig:").
  const unarmedClips = useGltfAnimationPack(UNARMED_PACK, false);
```
Puis, dans le `useMemo` des clips (ligne 162), inclure les clips unarmed (root motion retiré) et les ajouter aux deps :
```ts
    return [...extraClips.map(stripRootMotion), ...unarmedClips.map(stripRootMotion), ...out];
  }, [idleAnimG, walkG, runG, castG, deathG, extraClips, unarmedClips]);
```

- [ ] **Step 3: Jouer le one-shot + l'impact**

Ajouter un ref de suivi à côté des autres (après `lastReloadToken`, ligne 191) :
```ts
  const lastOneShot = useRef(0);
```
Dans le `useFrame`, dans le bloc `if (animCtrl.current) { … }` (lignes 251-291), juste APRÈS le bloc `death` (après la ligne 257 `}`) et AVANT `const sp = s.horizontalSpeed;`, insérer :
```ts
      // One-shot générique (punch/kick/hit/dodge) — prioritaire sur la locomotion,
      // cède à la mort. Joue l'action signalée puis retour auto à l'idle (ONE_SHOT).
      if (s.oneShotToken !== lastOneShot.current) {
        lastOneShot.current = s.oneShotToken;
        animCtrl.current.play(s.oneShotAction);
      }
```

- [ ] **Step 4: Checkpoint**

```bash
cd "D:/mes_projet/narvosprime-web-prototype/WebPortal" && npx tsc --noEmit
```
Expected : exit 0.

---

### Task 7: `RpgGameWorld` — clic-gauche mains nues, impact, esquive, finisher→stun

**Files:**
- Modify: `src/rpg/runtime/RpgGameWorld.tsx`

- [ ] **Step 1: Imports + refs d'état**

Ajouter en haut (avec les autres imports rpg) :
```ts
import { createCombo, advanceCombo, unarmedDamage } from "../combat/unarmedCombat";
import { statusEffects } from "../combat/statusEffects";
```
(`statusEffects` est peut-être déjà importé — ne pas dupliquer.)
Près des autres refs du composant (ex : à côté de `autoAttackRef`), ajouter :
```ts
  const comboRef = useRef(createCombo());
  const dodgeUntilRef = useRef(0);                 // i-frames esquive (timestamp ms de fin)
  const unarmedPunchRef = useRef<() => void>(() => {});
```

- [ ] **Step 2: Fonction de coup mains nues (combo + dégâts + anim)**

Juste après la définition de `autoAttackRef.current = () => {...}` (après ligne 1679), ajouter :
```ts
  // Coup mains nues (pas d'arme dégainée) : avance le combo, joue l'anim via le canal
  // one-shot, inflige les dégâts au plus proche dans ~2.5 m. Finisher → K.O. (stun) la cible.
  unarmedPunchRef.current = () => {
    const now = performance.now();
    const { action, isFinisher } = advanceCombo(comboRef.current, now);
    camState.current.oneShotAction = action;
    camState.current.oneShotToken += 1; // déclenche l'anim côté perso
    const dmg = unarmedDamage(effRef.current.puissance, isFinisher);
    let best: NpcHandle | null = null;
    let bestD = Infinity;
    for (const e of npcRegistry.queryEnemiesInRadius(playerPos.current, 2.5)) {
      const d = e.getPosition().distanceToSquared(playerPos.current);
      if (d < bestD) { bestD = d; best = e; }
    }
    if (best) {
      best.applyDamage(dmg);
      if (isFinisher) {
        const id = (best as { id?: string }).id;
        if (id) statusEffects.applyStun(id, 2.0); // K.O. ennemi ~2 s
      }
      screenShake.add(isFinisher ? 0.12 : 0.05);
    }
  };
```
> NB : `NpcHandle` a un champ `id` (`npcRegistry.ts`) → on l'utilise pour `applyStun`. Si `NpcHandle` est déjà importé dans le fichier (utilisé par `autoAttack`), pas de nouvel import.

- [ ] **Step 3: Brancher le clic gauche (arme rangée → mains nues)**

Remplacer le `onMouseDown` (lignes 1188-1194) par :
```ts
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (!document.pointerLockElement) return;     // menu ouvert / pas en jeu
      if (!npcRegistry.playerAlive) return;
      if (camState.current.weaponDrawn) {
        autoAttackRef.current();                     // arme dégainée → attaque d'arme
      } else {
        unarmedPunchRef.current();                   // pas d'arme → combo mains nues
      }
      // (SP-D : pour l'archétype "guerrier", clic gauche deviendra la GARDE.)
    };
```

- [ ] **Step 4: Impact reçu + i-frames esquive dans le chokepoint**

Dans `handleNpcHitPlayer` (ligne 1526), insérer EN TÊTE (juste après `const handleNpcHitPlayer = useCallback((dmg, element?) => {`) :
```ts
    // Esquive (i-frames) : annule entièrement le coup.
    if (performance.now() < dodgeUntilRef.current) return;
```
Puis, juste avant `setStats((s) => ...)` (ligne 1545), déclencher la réaction d'impact :
```ts
    camState.current.oneShotAction = "hit";
    camState.current.oneShotToken += 1; // réaction d'impact (brève)
```

- [ ] **Step 5: Esquive sur LShift**

Dans le handler clavier `onKey` (là où sont gérées les touches de jeu), ajouter une branche (avant les sorts/raccourcis) :
```ts
      if (e.code === "ShiftLeft" && document.pointerLockElement && npcRegistry.playerAlive) {
        const now = performance.now();
        if (now >= dodgeUntilRef.current) {            // pas déjà en esquive
          dodgeUntilRef.current = now + 400;           // i-frames 0.4 s
          camState.current.oneShotAction = "dodge";
          camState.current.oneShotToken += 1;
        }
        return;
      }
```
> NB : ShiftLeft sert peut-être au sprint dans `InputManager`. Vérifier : si conflit, l'esquive peut coexister (sprint = maintien, esquive = appui ponctuel) ou changer pour `KeyQ`. Choisir `KeyQ` si ShiftLeft est déjà le sprint :
```ts
      if (e.code === "KeyQ" && document.pointerLockElement && npcRegistry.playerAlive) { /* idem */ }
```

- [ ] **Step 6: Checkpoint**

```bash
cd "D:/mes_projet/narvosprime-web-prototype/WebPortal" && npx tsc --noEmit && npx vitest run
```
Expected : tsc 0 ; suite verte.

---

### Task 8: `Npc` — K.O. (gel IA + clip Stunned)

**Files:**
- Modify: `src/rpg/npc/Npc.tsx`
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->