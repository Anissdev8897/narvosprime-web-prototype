# Rapport complet — Monstres invisibles · Audio · Bugs WebGL/Electron · Générateur de cartes

**Date** : 2026-06-12 · Vérification finale : `tsc` 0 (src + electron) · **240 tests verts** (48 fichiers).

## 1. Monstres invisibles (« Torus » = Tosus)

### Cause A — packs d'animation à armature pivotée (7 monstres) ✅ CORRIGÉ
- « Torus » = **Tosus** (`folder: Grunt`, npcCatalog.ts). Son GLB est SAIN (mesh/matériau/textures OK).
- Vraie cause : les packs d'anim FBX→GLB (conversion du 05/06) portent une **Armature pivotée +90° X**
  avec les pistes du root (Hips) exprimées dans CE repère ; les rigs Meshy sont NON pivotés →
  le squelette s'effondre en un amas ~0,3 m **sous le sol** = corps invisible, nom qui flotte.
- Touchés : **Grunt (Tosus), golem_glace, mob_boss, mycelium_host_male/female,
  parasite_sower_male/female** + les réactions hit/bighit/stun de TOUS les PNJ (REACTIONS_PACK).
- **Fix** : `bakeArmatureRotation()` (mixamoRetarget.ts) — cuit la rotation de l'Armature du pack
  dans les pistes position+quaternion du root, détection générique depuis la scène du pack
  (useFbxAnimationPack). Validé numériquement (Grunt+Idle : y∈[0 ; 1,36 m], debout) + 3 tests.

### Cause B — Crabe Aquarys microscopique ✅ CORRIGÉ (correctif d'échelle)
- Export Meshy en **millimètres** (bbox 3,3 mm) — défaut PRÉSENT DANS LA SOURCE d'origine
  (le miroir dist/ a les mêmes bornes), pas un dégât de compression.
- Fix : `modelScaleMult: 400` au catalogue (échelle visuelle ≈1,3 m). Idéal long terme :
  ré-export Meshy à la bonne échelle.

### Défauts secondaires (dégradés, pas invisibles)
- `mob_boss.glb` : matériaux/textures perdus (rend BLANC). Source restaurable :
  `dist/models/pnj_monstre/mob_boss/Blood Juggernaut.fbx` + `Textures/` → reconversion
  Blender (tools/blender_convert_*.py) à planifier.
- `lizard.glb` : recompressé depuis l'original — mais l'original n'a JAMAIS eu de textures
  embarquées (textures à part dans `lizard 3d/textures`, jamais câblées). Défaut de source.
- **Miroir complet pré-compression dans `dist/models/`** (GLB originaux + FBX "supprimés").

## 2. Audio (musiques/ambiances « chargées mais inaudibles ») ✅ CORRIGÉ
- **Cause 1** : `App.stopAll()` sur CHAQUE changement de stage — y compris l'entrée en JEU.
  Ordre React enfant→parent : le `setMap("orbital")` du monde était toujours tué juste après
  → le hub n'avait JAMAIS musique ni ambiance. Fix : stopAll seulement HORS jeu.
- **Cause 2** : double-hydratation des volumes (2 clés DB en course, dernier gagnant aléatoire)
  pouvait imposer un volume musique **0 persisté** — l'ambiance étant asservie au volume
  musique, tout était silencieux malgré les logs « OK ». Fix : hydratation redondante retirée +
  warning console explicite si volume=0 + `pendingMapId` purgé dans stopAll.
- Hors de cause (vérifié) : conflits explore/combat/boss (tokens corrects), THREE.Cache,
  déverrouillage autoplay, événements de changement de zone.

## 3. Bugs
| Bug | Cause | Fix |
|---|---|---|
| `THREE.Color: Invalid hex color #d` | input texte de teinte persistait CHAQUE frappe → hex partiels en base/localStorage | `sanitizeHexColor` (validation stricte écriture + **auto-réparation lecture** cache ET base) sur appearance, bodyTintStore, création de perso, perso 3D — 5 tests |
| `ERR_CACHE_OPERATION_NOT_SUPPORTED` (mp4) | cache HTTP Chromium ≠ requêtes RANGE des vidéos du dev-server | `disable-http-cache` en DEV uniquement (prod file:// non affectée) |
| Electron Security Warning | aucune CSP | **CSP sans `unsafe-eval`** (`wasm-unsafe-eval` pour Draco/Basis, origines locales seulement) |
| `Context Lost` | traité aux sessions précédentes (dispose VRAM réel à l'éviction, chunks 256px, vaisseaux compressés, StrictMode retiré, purge THREE.Cache par chunk) | à re-vérifier sur ce build |

## 4. Générateur de cartes (F6) — v1 livré
Peuplement procédural **seedé** (déterministe, 6 tests) : biomes en 3 anneaux (niveau/meutes ↑
avec la distance), monstres (espacement/respawn/meutes), ressources 3 métiers, POI ; **aperçu
3D temps réel** avant application ; **validation automatique bloquante** (bornes, zone sûre,
espacement, plafonds 80/60) ; application dans les stores existants (`gen=true`, éditable
F9/F11, persisté, supprimable en bloc). Quêtes/donjons générés = v2 (spec :
docs/superpowers/specs/2026-06-12-map-generator-design.md).

## 5. Fichiers modifiés (cette passe)
`animation/mixamoRetarget.ts(+test)` · `animation/useFbxAnimationPack.ts` · `npc/npcCatalog.ts`
· `npc/Npc.tsx` · `utils/color.ts(+test)` · `persistence/appearance.ts` ·
`characters/bodyTintStore.ts` · `characters/HumanCharacter.tsx` ·
`components/character/CharacterCreateScreen.tsx` · `App.tsx` · `utils/AudioManager.ts` ·
`runtime/loading/hydrateAll.ts` · `electron/main.ts` · `mapgen/*` (4 nouveaux + tests) ·
`npcPlacementStore.ts` / `harvestNodeStore.ts` (flag gen) · `public/models/pnj_monstre/lizard`.

## 6. Vérifications finales
- **Code** : tsc 0 (src + electron) · 240/240 tests.
- **Rendu** (à confirmer en jeu) : Tosus/golem/mycelium/parasites debout et animés ; crabe ~1,3 m ;
  réactions hit/stun des PNJ correctes ; plus de warning couleur/CSP/cache.
- **Audio** (à confirmer) : musique + ambiance dès le hub orbital ; persiste après voyages.
- **Générateur** : F6 → générer → aperçu → valider → appliquer → farmer (respawn actif).
- **Perf** : aucune charge ajoutée par frame (cuisson des anims = 1× au chargement des packs ;
  générateur = hors gameplay ; minimap 10 Hz canvas 2D).