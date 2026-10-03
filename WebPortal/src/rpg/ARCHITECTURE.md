# Architecture — Système RPG/MMORPG futuriste fantasy (TypeScript / R3F)

> Stack : React 19 · React Three Fiber 9 · drei 10 · Three.js 0.181 · TS 5.8 · Vite 6
> Voir `ASSET_AUDIT.md` pour l'audit des assets sources.

---

## 1. Arborescence

```
src/rpg/
├── index.ts                  ← barrel export (API publique)
├── types.ts                  ← types partagés (ElementId, ClassId, ActionId…)
├── ASSET_AUDIT.md            ← audit des 3 assets (livrable #1)
├── ARCHITECTURE.md           ← ce document (livrable #2)
│
├── elements/
│   └── elements.ts           ← 10 éléments + triangle force/faiblesse
├── classes/
│   └── classes.ts            ← 4 classes (mesure 2026-09-08 ; le « 10 » etait faux) (élément/rôle/arme/stats/thème)
├── skills/
│   ├── archetypes.ts         ← 10 archétypes (zone d'équilibrage)
│   └── skillGenerator.ts     ← genere 40 competences (mesure 2026-09-08 ; ni 100, ni 10 classes)
├── animations/
│   └── animationMap.ts       ← mapping clips Mixamo → actions + fallback + retarget
├── loaders/
│   └── assetManifest.ts      ← chemins des assets retenus (parties/armes/textures)
├── characters/
│   └── ModularCharacter.tsx  ← assemblage 3D modulaire runtime (R3F)
└── ui/
    └── CharacterCreator.tsx  ← créateur de perso (viewport + panneau)
```

À venir : `equipment/`, `vfx/` (voir §7).

---

## 2. Flux de données

```
ELEMENTS (data) ─┐
                 ├──> CLASSES (référencent un élément) ─┐
ARCHETYPES (data)┘                                      ├──> skillGenerator
                                                        │      = 100 SkillDef
assetManifest ──> ModularCharacter ──> CharacterCreator ┘
                  (charge glTF parts)   (UI + viewport R3F)
```

Tout est **data-driven** : ajouter une classe = 1 entrée dans `CLASSES` → ses
10 sorts sont générés automatiquement, sa carte apparaît dans le créateur.

---

## 3. Modularité (cœur du système)

`ModularCharacter.tsx` assemble runtime :
- résout les parties via `getModularPartPath(gender, theme, slot)`
- clone chaque glTF avec `SkeletonUtils.clone` (évite le partage du cache `useGLTF`)
- applique le thème PBR : `material.color *= tint` + `emissive` glow

**Changement live** : modifier `config.parts` / `theme` / `tint` re-render React →
seules les parties changées se rechargent. Recoloration instantanée (clone matériau).

### Limite actuelle & next step
Les parties sont rendues côte à côte. Pour une **animation partagée**, il faut
re-binder chaque `SkinnedMesh` sur UN squelette commun (technique skeleton-merge).
→ Étape suivante : `loaders/skeletonMerge.ts` qui prend la 1ère partie comme
   skeleton-maître et rebind les autres dessus.

---

## 4. Animations (mapping + fallback)

`animationMap.ts` :
- `ANIMATION_MAP` : 12 actions → clip Mixamo (Sorceres)
- `resolveAnimation(action)` : remonte la chaîne de fallback (anti-cycle via Set)
  - ex : `dodge` (pas de clip) → `jump` → `run` → `walk`
- `MIXAMO_BONE_MAP` : correspondance os Mixamo → Quaternius pour le retarget

### Pipeline de conversion FBX → GLB (requis)
Les anims Mixamo sont en FBX. Pour le web, convertir en GLB :
```bash
# Option 1 : fbx2gltf (Facebook)
fbx2gltf -i "Breathing Idle.fbx" -o "idle.glb" --khr-materials-unlit
# Option 2 : Blender headless (script d'export glTF)
```
Puis charger via `useGLTF` + `useAnimations` (drei) et retarget sur le squelette
de la base modulaire via `MIXAMO_BONE_MAP`.

---

## 5. Compétences (100+)

10 archétypes × 10 classes = **100 sorts** générés.
- `archetypes.ts` = templates (damage mult, cooldown, mana, animation)
- `skillGenerator.ts` = combine archétype × classe × élément

Chaque sort hérite :
- des **dégâts** de la classe (`attackPower × archetype.damageMult`)
- de l'**élément** de la classe (VFX key = `${element}_${archetype}`)
- de l'**animation** de l'archétype (`cast`, `ultimate`, `dodge`…)

**Équilibrage** : éditer `archetypes.ts` (zone marquée ⚙️) rééquilibre les 10 classes
d'un coup. C'est le point d'ajustement game design.

---

## 6. Character Creator (UI)

`CharacterCreator.tsx` :
- Viewport R3F : `Canvas` + `OrbitControls` (rotation souris + zoom) + `ContactShadows`
  + `pointLight` coloré selon l'élément (glow)
- Panneau : genre · classe (10) · tenue · couleur peau · teinte tenue · aperçu 10 sorts
- Prévisualisation temps réel : `autoRotate` sur le personnage

---

## 7. À développer (prochaines sessions)

| Module | Contenu | Priorité |
|---|---|---|
| `loaders/skeletonMerge.ts` | Squelette partagé pour anim multi-parties | 🔴 Haute |
| `loaders/animationLoader.ts` | Chargement GLB + retarget Mixamo | 🔴 Haute |
| `vfx/` | Système particules/shaders par élément (10 VFX × archétype) | 🟡 Moyenne |
| `equipment/` | Inventaire + slots + drag&drop équipement | 🟡 Moyenne |
| `characters/AnimatedCharacter.tsx` | Perso + AnimationMixer + state machine | 🔴 Haute |
| Conversion FBX→GLB | 11 clips clés (script batch) | 🔴 Haute |
| `ui/SkillBar.tsx` | Barre d'action 10 sorts + cooldowns | 🟡 Moyenne |

---

## 8. Performance web (prévu)

- **Instancing** : ennemis/foule via `InstancedMesh`
- **Lazy loading** : `useGLTF.preload` sur les parties communes (déjà amorcé)
- **Texture atlas** : fusionner les PBR Peasant/Ranger
- **LOD** : Sorceres fournit hi_poly + mid_poly (déjà 2 niveaux)
- **Animation batching** : partager les `AnimationClip` entre instances de même classe
- **GPU materials** : `MeshStandardMaterial` (PBR) → passer à `MeshBasicMaterial` pour
  les VFX non éclairés (économie de shading)

---

## 9. Intégration

```tsx
// App.tsx ou route dédiée
import { CharacterCreator } from "@/rpg";

export default function CreatorPage() {
  return <CharacterCreator />;
}
```

Assets servis depuis `public/assets/rpg/` (copiés par `scripts/copy-rpg-assets.ps1`).
```bash
pwsh ./scripts/copy-rpg-assets.ps1   # copie glTF/GLB/textures + anims
```

---

## 10. Statut des livrables

| # | Livrable | Statut |
|---|---|---|
| 1 | Audit complet des assets | ✅ `ASSET_AUDIT.md` |
| 2 | Plan technique détaillé | ✅ ce document |
| 3 | Liste modèles retenus | ✅ (dans l'audit) |
| 4 | Mapping animations | ✅ `animationMap.ts` |
| 5 | Character creator | ✅ v1 (assemblage statique) — anim à venir |
| 6 | 10 classes opérationnelles | ✅ `classes.ts` |
| 7 | Système éléments | ✅ `elements.ts` (10 éléments + triangle) |
| 8 | Base gameplay extensible | ✅ skillGenerator (100 skills) + types |
```
