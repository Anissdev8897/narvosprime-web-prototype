# Architecture des prototypes

Politique fixée le 2026-08-04 : **toute fonctionnalité importante passe par un
prototype fonctionnel avant d'entrer dans le projet principal.**

---

## 1. Pourquoi

Le coût d'un essai. Régler une fenêtre de combo, une pose de bind ou une teinte
demande des dizaines d'itérations. Dans le jeu complet, chaque essai coûte un
chargement de map, un streaming de chunks, et se lit à travers soixante systèmes
qui parlent en même temps dans le log.

Isolé, l'essai coûte une seconde. C'est le seul argument, et il suffit.

Second bénéfice, moins visible : **un prototype qui casse ne casse rien.** La
branche principale garde ses `2151 tests · tsc 0`.

---

## 2. Ce qui existe — et le trou à boucher d'abord

`Prototype/Proto_combat/` (Hermes, 04/08) : entrée autonome, sans `App.tsx` ni
routeur, avec `installKtx2Everywhere()` et `<RendererRegistrar />`. Conforme.

**Mais mesuré :**

```
fichiers de Prototype/ vus par tsc : 0
vite.config.ts : aucune entrée multi-pages
```

`tsconfig.json` n'inclut que `src/**/*`. **`npm run typecheck` annonce donc 0
erreur sans jamais avoir regardé le dossier.** Un prototype peut être truffé
d'erreurs de type, la barrière qualité du projet reste verte.

C'est exactement le motif qu'on traque depuis le début : un contrôle qui rassure
sans rien contrôler. **À corriger avant d'ajouter un seul prototype de plus.**

### ✅ CORRIGÉ le 05/08/2026

`tsconfig.prototypes.json` (`include: ["Prototype/**/*", "src/vite-env.d.ts"]`)
+ script `typecheck:proto`, chaîné dans `typecheck`.

Preuve que le contrôle n'est pas vide : au premier passage il a sorti **2
erreurs** (`ImportMeta.env` manquant, faute de charger `vite-env.d.ts`). Une
fois la déclaration incluse : 0. Un `tsc` qui n'a jamais échoué ne prouve rien.

La règle de dépendance est elle aussi testée : `src/prototypeBoundary.test.ts`
échoue si un fichier de `src/` importe `Prototype/` — vérifié rouge sur un
import saboté, vert après retrait.

### ✅ LE MÊME TROU CÔTÉ TESTS — corrigé le 28/08/2026

`tsc` regardait enfin `Prototype/`. **`vitest`, non.** `vitest.config.ts`
n'incluait que `src/`, `scripts/` et `electron/` : un `.test.ts` déposé dans
`Prototype/` n'était jamais exécuté, et `npm test` restait vert sans l'avoir lu.

C'est bloquant pour §4.3 : « logique métier en TS pur et **testée** » est le
premier critère de promotion, et il ne pouvait pas être satisfait.

`'Prototype/**/*.test.ts'` ajouté à l'`include`. Contrepartie assumée : un
prototype cassé peut désormais faire rougir `npm test` du jeu — c'est le prix
pour que ses tests existent vraiment.

Preuve que le contrôle n'est pas vide : les 31 tests de
`Prototype/Proto_combat/combat/` ont été **vérifiés rouges** sur une machine
sabotée (tampon d'entrée neutralisé → 3 échecs), verts après retrait du
sabotage. Un test qui n'a jamais échoué ne prouve rien.

---

## 3. Architecture proposée

```
Prototype/
  _shared/                  ← socle commun, écrit UNE fois
    ProtoScene.tsx            plan + ciel + lumière + RendererRegistrar + OrbitControls
    ProtoPanel.tsx            panneau de debug (repliable, à droite)
    bootstrap.ts              Draco + KTX2 + cache three — le préambule de main.tsx
  proto-combat/
    index.html · main.tsx · Sandbox.tsx
  proto-personnage/         ← le créateur, déplacé depuis la Forge
    index.html · main.tsx · Sandbox.tsx
  README.md                 ← liste des prototypes, état, critère de sortie
```

**`_shared/` est le vrai gain.** Aujourd'hui `Proto_combat/main.tsx` recopie le
préambule de `src/main.tsx` — Draco, KTX2, cache, silence des warnings. Au
troisième prototype, cette copie aura divergé et un seul aura le correctif KTX2.
Un `bootstrap.ts` partagé supprime le problème.

### Règle de dépendance — non négociable

```
Prototype/  ──dépend de──▶  src/
Prototype/  ◀──JAMAIS──     src/
```

Un prototype **consomme** le jeu, ne le modifie pas et n'est jamais importé par
lui. Le jour où `src/` importe un prototype, la promesse « un prototype qui casse
ne casse rien » est morte.

Cette règle se teste : un test qui parcourt `src/` et échoue si un import contient
`Prototype/`. Trente lignes, et la règle cesse de dépendre de la discipline.

---

## 4. Les trois corrections à appliquer

### 4.1 Typer les prototypes

`tsconfig.prototypes.json` qui étend le principal avec
`include: ["Prototype/**/*"]`, puis :

```json
"typecheck": "tsc --noEmit && npm run typecheck:electron && npm run typecheck:proto"
```

Un tsconfig séparé plutôt qu'élargir l'`include` principal : une erreur de type
dans un prototype ne doit pas bloquer un build du jeu, mais elle doit être
**visible**. Deux commandes, deux verdicts.

### 4.2 Décider du build

Deux options, à choisir explicitement :

- **Dev seulement** (recommandé) — les prototypes ne partent pas en production.
  À écrire dans le README, sinon quelqu'un cherchera pourquoi son prototype est
  absent du build.
- **Multi-pages** — `build.rollupOptions.input` avec une entrée par prototype.
  Utile seulement s'il faut les montrer à quelqu'un sans dev server.

Aujourd'hui c'est « dev seulement » **par accident**, pas par décision. La
différence compte.

### 4.3 Le critère de promotion

Un prototype rejoint `src/` quand, et seulement quand :

- [ ] la logique métier est en **TS pur et testée** — pas dans le composant R3F ;
- [ ] `npm test` et `npm run typecheck` (les trois) sont verts ;
- [ ] la fonctionnalité a été **vue à l'écran** par l'utilisateur ;
- [ ] chaque test ajouté a **échoué sur le code d'avant** — sinon il documente une
      coïncidence ;
- [ ] le prototype **reste** après promotion : c'est le banc d'essai des
      correctifs futurs, pas un échafaudage.

Le premier point porte tout le reste. Si la logique vit dans le composant, la
promotion est une réécriture ; si elle est en TS pur, c'est un déplacement de
fichier et un branchement.

---

## 5. Déplacer le créateur de personnage

Aujourd'hui : `ForgePersonnages.tsx`, dans l'éditeur de map. Rien ne l'y rattache
— il y est par accident d'histoire, et il traîne avec lui le décor de la Forge.

Cible : `Prototype/proto-personnage/`, avec `ProtoScene` (plan + ciel) au lieu du
`<Stage>` de la Forge.

**Ordre — le seul qui évite de tout casser :**

1. Créer le prototype qui **importe** `ModularCreatorScreen` tel quel. Aucun
   déplacement de code. À ce stade, deux points d'entrée coexistent.
2. Vérifier que le prototype fait tout ce que fait la version Forge.
3. **Alors seulement** retirer l'entrée côté Forge.

Déplacer d'abord et réparer ensuite, c'est se retrouver sans aucune version qui
marche. `ModularCreatorScreen` est déjà découplé — il ne monte aucun `<Canvas>`,
la scène arrive par la prop `preview`. Le déplacement est donc surtout un
changement d'appelant.

⚠️ `ForgePersonnages.tsx` porte aussi la persistance (`customCharacterStore`), la
bascule de genre et les proportions. Le prototype doit les consommer, pas les
dupliquer — sinon deux créateurs divergeront.

### ✅ FAIT le 05/08/2026 — et ce que la mesure a changé

`Prototype/Proto_charactere/` existe (`index.html` · `main.tsx` ·
`CharacterPrototypeSandbox.tsx`) et **importe `ForgePersonnages` tel quel**.
Côté jeu, le stage `forge_chars` est retiré : le créateur n'est plus dans le
graphe de modules de l'application.

**Mais `characters/modular/` NE DÉMÉNAGE PAS.** Mesuré : cinq modules vivants en
dépendent — `loot/modularItems`, `loot/LootRegistry`, `npc/merchants` (marchand
Vasska), `runtime/InventoryPanel`, `characters/customCharacterStore`. Déplacer
ce dossier inverserait la règle de dépendance et casserait l'équipement. En
prime, `vitest.include = ['src/**/*.test.ts']` : les dix fichiers de test du
créateur sortiraient **silencieusement** de `npm test`.

La leçon générale : ce qui se découpe, c'est le **point d'entrée**, pas les
catalogues. Le jeu continue de lire les données ; seul l'écran inachevé sort du
parcours joueur.

---

## 6. Prototypes qui valent le coup ensuite

| Prototype | Ce qu'il déverrouille |
|---|---|
| `proto-personnage` | itérer sur le créateur sans charger la Forge |
| `proto-combat` | combo, fenêtres, réactions aux coups (en cours) |
| `proto-anim` | visualiser les 61 clips, régler les fondus |
| `proto-greffe` | monter une pièce sur un corps, lire la couverture — c'est le banc qui aurait montré les éclats noirs en une seconde |

Le dernier mérite attention : quatre tours de diagnostic sur `weightedCoverage`
auraient été un aller-retour avec ce banc.

---

## 7. Ce qu'un prototype ne fait JAMAIS

- charger une map, `PuzzleMap`, `StreamingPuzzleMap`, des chunks ;
- monter le HUD, l'inventaire, les quêtes, les PNJ, l'IA ;
- écrire dans `src/`, dans les catalogues, dans les manifestes ;
- dépendre d'un autre prototype.

Le premier point est celui qu'on enfreint sans y penser : réutiliser un composant
du jeu paraît économe, et ramène tout ce qu'on cherchait à fuir.