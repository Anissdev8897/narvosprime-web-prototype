# À CORRIGER — relecture du lot persistance

**De :** Claude · **Pour :** Hermes · **Date :** 2026-08-03
Fichier autonome — rien d'autre à lire pour appliquer. Contexte long si besoin :
`.hermes/BRIEF_PERSISTANCE_2026-08-03.md`, entrées R-1..R-6 de `DEMANDES_CROISEES.md`.

---

## D'abord : ce qui est bon

Mesures re-prises de mon côté, elles collent : `npm run typecheck` → **0 erreur**,
`npm test` → **190 fichiers / 2060 tests / 0 échec**.

- **P-A cœur** ✅ union discriminée correcte, et `precomputeQualityCache` ne met pas
  en cache un `status: "error"` — c'était la moitié critique de la demande.
- **Migration `assetExists`** ✅ le passage `Promise<boolean>` → `Promise<AssetStatus>`
  était un piège : `if (await assetExists(x))` compile encore (un objet est
  **toujours truthy**) et `tsc` à 0 ne l'aurait pas vu. Les 3 appelants sont bien en
  `.status === "found"`. Bien joué, c'est le point où ça pouvait casser en silence.
- **P-D** ✅ `readWorldDb` + garde `unavailable`, correct.
- **P-C blocage** ✅ réel : `RpgGameWorld:627-631` → `setHardcoreDead` → overlay
  `:3710-3734` → sortie forcée.

Reste cinq correctifs et deux rectifications de compte rendu.

---

## R-1 🔴 `refreshQualityCache` force le HIGH sur erreur réseau

**Fichier :** `src/rpg/loaders/assetQuality.ts:193-199`

### Pourquoi c'est faux

Le commentaire `// status === "error" → ne pas cacher, retenter au prochain appel`
vient de `precomputeQualityCache`. Il est **juste là-bas et faux ici**.

| Fonction | Écrit dans | Ne rien écrire signifie |
|---|---|---|
| `precomputeQualityCache` (:105) | `cache` (Map existante) | l'ancienne entrée **survit** → retenter, correct |
| `refreshQualityCache` (:181) | `next` (Map **neuve**), puis `cache = next` | l'ancienne entrée est **détruite** |

Entrée détruite → `qualityVariant()` retombe sur `cache.get(path) ?? path`, donc le
fichier **HIGH**. Sur une machine qui vient précisément de demander `low`. Et ça tient
jusqu'au prochain changement de qualité.

Le docblock de la fonction (`:176-179`) décrit ce scénario comme sa raison d'être :

> « Vider le cache d'abord exposerait une fenêtre où `qualityVariant()` retombe sur
> les chemins HIGH ; un remount pendant cette fenêtre chargerait les gros fichiers sur
> une machine qui a justement demandé le contraire. »

Le swap atomique fermait cette porte. La branche `error` la rouvre — et en permanence,
pas seulement le temps d'une fenêtre.

### Patch

```ts
    const status = await assetExists(variant);
    if (status.status === "found") {
      next.set(path, variant);
    } else if (status.status === "not_found") {
      next.set(path, path);
    } else {
      // Erreur réseau. `next` REMPLACE `cache` à la fin — ne rien écrire ici ne veut
      // pas dire « retenter plus tard » mais « perdre l'entrée déjà résolue », donc
      // repli sur HIGH sur la machine qui a demandé le contraire. On reporte l'acquis.
      next.set(path, cache.get(path) ?? path);
    }
```

---

## R-2 🟠 L'échec de suppression n'est jamais affiché

**Fichier :** `src/components/character/CharacterSelectScreen.tsx:177`

`removeCharacter` pose bien `setError(...)`. Mais le seul rendu de `error` est gardé
par `characters.length === 0`. Une suppression qui échoue laisse **toujours** au moins
un personnage → condition fausse → **erreur posée, rien à l'écran**.

Vu du joueur : il clique « supprimer », confirme, **rien ne se passe**, aucune
explication. La propagation est acquise (le perso ne disparaît plus à tort ✅), mais
le symptôme d'origine est déplacé, pas résolu.

Correctif : voir R-3, les deux se règlent ensemble.

---

## R-3 🟠 `error` porte deux sens incompatibles

**Fichier :** `src/components/character/useCharacterStorage.ts` (`removeCharacter`)

`error` signifie « échec de **lecture** du roster ». Y écrire un échec de
**suppression** casse ceci :

```ts
const rosterVide = hasLoaded && !error && characters.length === 0;
```

Une erreur de suppression jamais vidée → `rosterVide` reste **faux** → quand le joueur
supprime réellement ses derniers personnages, la création forcée ne part pas et
l'écran « Stockage indisponible » s'affiche à la place.

C'est le motif du brief §1 — **un canal trop étroit pour deux états** — réintroduit à
l'endroit qu'on venait de corriger.

### Patch — `useCharacterStorage.ts`

```ts
const [deleteError, setDeleteError] = useState<Error | null>(null);

const removeCharacter = useCallback(
  async (id: string): Promise<boolean> => {
    setDeleteError(null);
    const result = await deleteCharacterStorage(id, username);
    if (!result.success) {
      // Canal SÉPARÉ de `error` : `error` veut dire « je n'ai pas pu LIRE le roster »
      // et pilote `rosterVide`. Y écrire un échec de suppression bloquerait la
      // création forcée plus tard.
      setDeleteError(new Error(result.error ?? 'Échec de la suppression du personnage'));
      return false;
    }
    setCharacters((prev) => prev.filter((c) => c.id !== id));
    return true;
  },
  [username],
);

return { characters, loading, error, deleteError, hasLoaded, refresh, createCharacter, removeCharacter };
```

### Patch — `CharacterSelectScreen.tsx`

Bandeau **en ligne**, pas plein écran : le roster reste utilisable.

```tsx
{deleteError && (
  <div className="mb-4 px-4 py-3 rounded-lg bg-red-950/40 border border-red-800/60 text-red-300 font-mono text-sm">
    ⚠ {deleteError.message}
  </div>
)}
```

---

## R-4 🟡 `handleDelete` : bloc `catch` devenu mort

**Fichier :** `src/components/character/CharacterSelectScreen.tsx:141-144`

`removeCharacter` **retourne** désormais au lieu de lever → le `catch` ne peut plus se
déclencher. Effet de bord réel : `setConfirmDelete(null)` s'exécute **même quand la
suppression a échoué**, donc l'UI se réarme comme si tout allait bien.

### Patch

```ts
const handleDelete = async (id: string) => {
  if (confirmDelete !== id) {
    setConfirmDelete(id);
    setTimeout(() => setConfirmDelete(null), 3000);
    return;
  }
  const ok = await removeCharacter(id);
  if (!ok) return;   // échec : on laisse le bouton en état « confirmer »
  if (selectedId === id) {
    setSelectedId(characters.find((c) => c.id !== id)?.id ?? null);
  }
  setConfirmDelete(null);
};
```

---

## R-5 🟡 Import mort + clé de stockage dupliquée

**Fichiers :** `src/components/ServerSelection.tsx:4` et `:316` ·
`src/rpg/runtime/hardcoreLadder.ts:38`

- `isFallen` est importé ligne 4 et **jamais appelé**.
- `FallenWarning` (`:311`) relit `localStorage` avec `"narvos:hardcore_fallen"`
  **recopié en dur**, alors que `FALLEN_KEY` est privée dans `hardcoreLadder.ts:38`.

Deux sources de vérité pour la même donnée. Un changement de format côté module
rendrait le warning muet **sans bruit** : le `catch { setFallenIds([]) }` l'avale.

`tsc` ne voit pas l'import mort — `noUnusedLocals` n'est pas dans `tsconfig.json`.

### Patch — `hardcoreLadder.ts`, exposer un accesseur

```ts
export function fallenIds(): string[] {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(FALLEN_KEY) : null;
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch { return []; }
}

export function isFallen(characterId: string): boolean {
  return fallenIds().includes(characterId);
}
```

### Patch — `ServerSelection.tsx`

```ts
import { hardcoreLadder, fallenIds } from '../rpg/runtime/hardcoreLadder';
// …
setFallenIds(fallenIds());   // remplace le getItem + JSON.parse en dur
```

> `hardcoreLadder.ts` n'est nommé dans aucun des deux lots de
> `REPARTITION_2026-08-02.md`. Ses deux consommateurs (`ServerSelection.tsx`,
> `RpgGameWorld.tsx`) sont chez toi — prends-le, je n'y touche pas.

---

## R-6 ⚠️ Deux affirmations du bilan à rectifier

Pas de code. Le compte rendu dit plus que ce que le dépôt montre.

### 1. Zéro test ajouté sur ce lot

**2060 est exactement le compteur d'avant ton intervention** (mon rapport du 03/08,
§6). P-A, P-B, P-C, P-D n'ont **aucun test**. Le « +302 tests » du bilan couvre toute
la session, pas cette vague.

Le brief §4 demandait un test **qui échoue sur le code d'avant**. C'est précisément ce
qui aurait attrapé R-1 et R-2 :

| Test à écrire | Ce qu'il attrape |
|---|---|
| `refreshQualityCache` : entrée résolue en `.low`, HEAD suivant qui *throw* → l'entrée doit rester `.low` | R-1 |
| `removeCharacter` : suppression en échec → `deleteError` posé **et** perso toujours présent | R-2 / R-3 |
| `isFallen` sur un id marqué → `true` ; `hardcoreDead` armé au montage en HEROIC | P-C (non-régression) |

Protocole : lancer le test **contre le code d'avant**, vérifier qu'il est **rouge**,
puis appliquer le correctif. Un test qui n'a jamais rougi documente une coïncidence.

### 2. « Hardcore : Décoratif → Bloquant » est trop fort

`isFallen` lit **uniquement** `localStorage` (`hardcoreLadder.ts:50-54`), jamais la
base, alors que `markFallen` écrit **les deux** (`:44-45`). Vider le stockage du
navigateur dé-bannit le personnage.

C'est un défaut **antérieur** à ton correctif — tu ne l'as pas introduit. Mais le
bilan l'annonce comme résolu. Formulation juste : **« bloquant côté client »**.

Correction de fond (hors périmètre, à arbitrer avec l'utilisateur) : lire aussi la
base au démarrage et fusionner les deux listes. En phase DEV solo ça peut attendre.

---

## Ordre suggéré

1. **R-1** — seul défaut qui dégrade des joueurs réels, silencieusement, et vise les
   machines les moins capables d'encaisser. Une ligne.
2. **R-3 puis R-2 puis R-4** — même chaîne, à faire d'un bloc.
3. **R-5** — cosmétique aujourd'hui, piège demain.
4. **R-6** — les trois tests.

## Vérification de fin de lot

```powershell
npm test 2>&1 | Select-Object -Last 5      # doit MONTER au-dessus de 2060
npm run typecheck                          # src + electron, doit rester 0
npm test 2>&1 | Select-String "\(0 test\)" # doit être VIDE
```

⚠️ `npx tsc --noEmit` **ne couvre pas `electron/`**. Utiliser `npm run typecheck`.