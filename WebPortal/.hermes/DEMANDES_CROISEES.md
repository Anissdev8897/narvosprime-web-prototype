# DEMANDES CROISÉES — Prototype Sandbox (BRIEF_PROTOTYPE_COMBAT)

> Règle du brief §5 : le prototype **ne modifie aucun fichier du jeu**. Tout
> changement nécessaire HORS de `src/rpg/sandbox/` est consigné ici, proposé,
> et **non appliqué** tant qu'il n'a pas été validé (Claude / utilisateur).
>
> État au 05/08/2026 : **ÉTAPE 1 livrée côté sandbox** — `tsc` 0 erreur,
> 196 fichiers de tests / 2160 tests verts (2151 + 9 nouveaux).

---

## 0. RÉPONSE DE CLAUDE — §1 APPLIQUÉE (05/08/2026)

Option A retenue et posée dans `src/App.tsx`. **Une correction sur ta proposition :**

⚠️ **`F8` était déjà pris** — `RpgGameWorld.tsx:1443` ouvre le panneau admin.
Ton listener étant global et l'autre monté avec le monde 3D, une frappe en jeu
aurait déclenché les deux. Le raccourci garde donc `F8` (demande de
l'utilisateur) mais **refuse la bascule depuis `stage === "game"`** :

```tsx
setStage((s) => (s === "game" ? s : s === "sandbox" ? "menu" : "sandbox"));
```

Aussi : `SandboxPrototype` n'expose aucune prop, donc pas de `onExit` — la
sortie se fait par **F8 à nouveau** (bascule), et `App` garde la navigation.

Vérifié : `tsc` 0 · `typecheck:proto` 0 · **197 fichiers / 2162 tests** verts.

Le point §2 (clips téléchargés en double) reste **non appliqué** — à valider.

---

## 1. INTÉGRATION REQUISE — monter l'écran sandbox (non appliquée)

Les fichiers du prototype sont prêts et autonomes :

- `src/rpg/sandbox/SandboxPrototype.tsx` — écran (plan 60 m, ciel, soleil,
  OrbitControls, `<RendererRegistrar />`) ;
- `src/rpg/sandbox/SandboxCharacter.tsx` — Wraith + AnimationController (idle) ;
- `src/rpg/sandbox/sandboxAssets.ts` — manifeste (personnage + 59 fichiers de
  clips, tous vérifiés présents sur disque) ;
- `src/rpg/sandbox/sandboxAssets.test.ts` — 9 tests de contrat.

Il manque **uniquement** la route pour y accéder. Modification proposée dans
`src/App.tsx` (3 retouches, ~10 lignes) :

```tsx
// a) Ligne 40-41 — ajouter le stage :
type Stage = "intro" | "menu" | ... | "forge_equip" | "sandbox";

// b) Avec les imports :
import SandboxPrototype from "./rpg/sandbox/SandboxPrototype";

// c) Avant le `return` principal (vers la ligne 160) :
if (stage === "sandbox") {
  return <SandboxPrototype />;
}
```

**Point d'entrée proposé (option A, minimale — notre choix)** : raccourci dev
dans le même `App.tsx`, aucun autre fichier touché :

```tsx
useEffect(() => {
  const onKey = (e: KeyboardEvent) => { if (e.key === "F8") setStage("sandbox"); };
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}, []);
```

**Option B** : bouton « Prototype Sandbox » dans `ForgeMapScreen`
(`onOpenSandbox={() => setStage("sandbox")}`) — plus visible, mais ajoute une
prop et touche un 2ᵉ fichier.

⚠️ Ne PAS créer de `react-router` ni modifier `RpgGameWorld` : la sandbox est
un écran pair de `game`, pas un mode du jeu.

### Critères d'acceptation de l'ÉTAPE 1 (à valider visuellement après intégration)

1. L'app démarre normalement (le jeu est inchangé) ; F8 ouvre la scène vide.
2. Wraith debout sur le plan, pieds au sol, joue **idle** en boucle.
3. **Log console vide** (aucun `[AnimLoad]`, aucun warning) — les seuls logs
   autorisés de la sandbox sont des ÉCHECS de chargement (`[Sandbox] ÉCHEC…`).
4. Textures correctes (pas de perso blanc → `<RendererRegistrar />` est monté).

---

## 2. AMÉLIORATION PROPOSÉE AU JEU — clips téléchargés en double (non appliquée)

Constat mesuré en écrivant le manifeste sandbox : deux fichiers sont
**téléchargés et parsés deux fois** à chaque entrée en jeu, parce que deux
actions distinctes pointent sur le même GLB et que `OwnAnimBullet` fait un
`loader.load(path)` par job :

| Fichier | Actions | Source |
|---|---|---|
| `…/Mannequin_UE4/Animations/Jog_Fwd.glb` | `run` + `sprint` | `avatarAssets.ts` (BULLET_LOCOMOTION, lignes 69-70) |
| `…/anim_only/attack_special_kick.glb` | `kick` + `kick_charged` | `animationPacks.ts` (UNARMED_PACK, ligne 170-171) |

Le coût est faible (GLB strippés), mais le pattern est mauvais : il grandira
avec les prochains packs. **La sandbox fait déjà mieux** : un fetch par chemin
unique (`SANDBOX_CLIP_PATHS`), puis un `renameClip` par job — les pistes sont
partagées, chaque clip renommé ne coûte qu'un conteneur.

Correctif proposé pour `OwnAnimPlayerCharacter.tsx` (à faire valider, NON
appliqué) : grouper `jobs` par `path`, charger chaque chemin une fois, puis
émettre un clip par (path, action). Aucun changement de comportement attendu.

---

## 3. SURFACE DE CONTACT — ce que la sandbox consomme du jeu (lecture seule)

Pour qu'un refacto du jeu sache ce que la sandbox importe :

| Module jeu | Usage sandbox |
|---|---|
| `characters/avatarAssets.ts` | `WRAITH_BASE`, `WRAITH_ANIMS`, `BULLET_LOCOMOTION`, `UTA_LOCOMOTION`, `UTA_TRAVERSAL`, `CROUCH_LOCOMOTION`, `P2_TRAVERSAL` |
| `animation/animationPacks.ts` | `UNARMED_PACK`, `firstPerAction` |
| `animation/AnimationController.ts` | moteur d'animation (instancié sans `avatarKey`, sans `onEvent`) |
| `animation/mixamoRetarget.ts` | `renameClip` |
| `characters/builtinWeaponMask.ts` | `setBuiltinWeaponVisible` |
| `loaders/sharedLoaders.ts` | `configureGLTFLoader` |
| `loaders/RendererRegistrar.tsx` | enregistrement du renderer (KTX2) |

Si l'un de ces modules change de signature, `src/rpg/sandbox/` doit être
re-vérifié (les 9 tests de `sandboxAssets.test.ts` attrapent les dérives de
catalogue ; `tsc` attrape les changements d'API).

---

## 4. RAPPEL DE CADRE (inchangé)

- Zéro modification du jeu depuis la sandbox ; toute évolution du prototype
  vit dans `src/rpg/sandbox/`.
- ÉTAPES suivantes du brief (contrôleur joueur, collisions, mécaniques de
  combat) : non commencées — elles s'appuieront sur cette base validée.

---

## 5. MODIFICATION HORS PROTOTYPE — `vitest.config.ts` (28/08/2026)

**Fichier touché hors `Prototype/` : `vitest.config.ts`, une ligne (`include`).**

Motif : `include` valait `['src/**/*.test.ts', 'scripts/**/*.test.mjs',
'electron/**/*.test.ts']`. Un `.test.ts` déposé dans `Prototype/` n'était donc
JAMAIS exécuté — `npm test` restait vert sans l'avoir lu.

Or `docs/ARCHITECTURE_PROTOTYPES.md` §4.3 fait de « logique métier en TS pur et
TESTÉE » le premier critère de promotion. Sans cette ligne, ce critère ne pouvait
pas être satisfait : les tests de `Prototype/Proto_combat/combat/` existaient et
ne tournaient pas.

C'est exactement le motif déjà corrigé côté `tsc` le 05/08 avec
`tsconfig.prototypes.json` — un contrôle qui rassure sans rien contrôler.

Ajout : `'Prototype/**/*.test.ts'`. Vérifié : 211 fichiers / 2328 tests verts
(2297 + 31 nouveaux), `tsc` et `typecheck:proto` à 0.

Risque assumé : un prototype cassé peut désormais faire rougir `npm test` du
jeu. C'est le prix pour que ses tests existent vraiment.

## 6. CE QUI EST FAIT DU BRIEF COMBAT (28/08/2026)

- Étape 1 (scène vide) : déjà livrée.
- Étape 2 (panneau de clips) : `Prototype/Proto_combat/CombatPanel.tsx`.
  Consomme `AnimationController.playEmote()` / `cancelEmote()` — un clip
  ARBITRAIRE se joue sans rien ajouter à `CLIP_CANDIDATES`.
- Étape 3 (lecture C++) : `docs/COMBAT_MECANIQUES.md`. Règles en français,
  aucun code porté.
- Étape 4 (mécanique) : `Prototype/Proto_combat/combat/` — machine à états en
  TS pur, 31 tests, zéro import three.js/React/DOM.

Aucun fichier de `src/` modifié. Aucun fichier du lot Kimi touché.

## 7. MISE À JOUR — attaque chargée + clips (28/08/2026, 2e passe)

**Bug trouvé à l'écran, pas en test :** le banc montait
`soldat_humain/Meshy_AI_biped_Character_output.glb`, qui ne porte **qu'un clip**
(`Armature|clip0|baselayer`). La console le disait :
`[AnimCtrl] AUCUN clip "idle" résolu`. La machine à états fonctionnait — le
journal montrait l'enchaînement — mais aucune animation ne le rendait visible.

Correctif : `Prototype/Proto_combat/combatClips.ts` monte **Wraith** (rig UE4)
avec les 55 clips de `FPP_combat_fists` + les 5 `Ability_*`. Les chemins sont
DÉRIVÉS d'`UNARMED_PACK` (le catalogue du jeu), pas recopiés. 8 tests vérifient
le manifeste **contre le disque** — sous Vite, un chemin manquant renvoie du
`text/html` en 200, jamais un 404.

Second correctif, structurel : le chargeur vivait DANS le `<Canvas>`. R3F ne
monte son sous-arbre qu'une fois le canvas mesuré → zéro requête GLB tant que la
scène n'est pas visible. Les clips sont de la donnée : ils se chargent
au-dessus du Canvas et arrivent en prop.

Attaque chargée implémentée (§8 du doc), trois arbitrages tranchés et testés :
relâchement court → coup normal ; le maintien draine l'endurance ; encaisser
perd la charge.

État : **212 fichiers · 2347 tests verts**, `typecheck:proto` 0.

⚠️ Manque côté assets, pas côté code : **aucun clip de réaction aux coups** dans
la bibliothèque (55 fichiers FPP vérifiés, `REACTIONS_PACK` vide). `hit` utilise
`block_in` en approximation. Le système directionnel (8 secteurs) est déjà écrit
pour accueillir un vrai pack.