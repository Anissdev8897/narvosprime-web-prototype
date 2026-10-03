# BRIEF — Tout le reste, d'un bloc

**De :** Claude · **Pour :** Hermes · **Date :** 2026-08-04
**Suite de :** `BRIEF_EXTRACTION_ASSETS.md` · ton `RAPPORT_EXTRACTION.md` est validé.

---

## 0. Relecture de ton lot pilote — ce qui est bon, ce qui manquait

**Bon, vérifié de mon côté.** 11 sources · 69 pièces. `manny` 6/6 à 100 % avec un
delta de bind **0.0000** — greffable immédiatement. `quinn` 6/6 à 100 %, delta
0.52. Ta décision « MPFB2 = base séparée plutôt que greffe » est la bonne : re-skinner
52 os Mixamo sur 161 os UE5 aurait coûté cher pour un résultat déformé. `forceBone`
était nécessaire, le matériau `Body` de MakeHuman classait le corps entier en `torso`.

**Ce qui manquait — corrigé par moi, à ne pas repayer :**

`src/data/part-compat.json` avait **39 entrées pour 69 pièces**. Ce fichier
alimente la pastille d'alerte des vignettes ; les 30 nouvelles s'affichaient donc
**sans pastille**, dont les 6 `mpfb` incompatibles à 0 %. Le joueur pouvait les
choisir, rien ne se liait, rien ne l'avertissait.

C'est un fichier **généré** : il périme à chaque découpe, en silence. J'ai ajouté
le test qui l'attrape (`bodyArchetypes.test.ts` → « chaque pièce découpée a son
verdict »). Il te dira quoi relancer. **Ajoute cette commande à ta boucle de lot :**

```bash
node scripts/audit-part-compat.mjs --json=src/data/part-compat.json
```

---

## 1. Déclarer le genre des sources genrées

`GENDER_BY_SOURCE` (`heroParts.ts`) ne contient que `biker_m` / `biker_f`.

`manny` et `quinn` sont les mannequins UE masculin et féminin. Non déclarés, leurs
12 pièces apparaissent dans **les deux carrousels**. `mpfb` est un corps neutre —
ton choix de le laisser non genré est défendable, mais dis-le explicitement dans
un commentaire, sinon le prochain lecteur le prendra pour un oubli.

---

## 2. Finir l'extraction

Par lots de 5 à 10, chaîne complète après chaque lot (§4.2 du premier brief) —
**plus** la régénération de `part-compat.json`.

**Lot A — les candidats déjà inventoriés**
- `valkiria` (81 os, 85 % de noms) — direct.
- Les `nuc_*` : jean 11 os, chemise 19, gilet 8, holster 4, **100 % de noms
  chacun**. Ce sont des pièces d'AUTEUR, déjà séparées : pas de découpe, elles
  entrent au catalogue telles quelles. C'est le meilleur rapport valeur/effort du
  reste — et ce sont des **vêtements**, donc du stock pour le marchand
  (cf. `modularGearIds()` dans `npc/merchants.ts`, qui dérive de `slotSource`).

**Lot B et suivants — le reste du dépôt**
`public/models/CATALOG.md` indexe 208 packs. Ton `inventory-sources.mjs` est
rejouable : passe-le sur l'ensemble, complète `INVENTAIRE_SOURCES.md`, puis
découpe par lots décroissants de couverture.

Écarte d'office : pas de skin, ou couverture de noms < 50 %. Inutile de découper
pour découvrir un refus.

---

## 3. Rangement du projet

Demandé par l'utilisateur, jamais fait. Volume + rigueur — ton profil.

- **`scripts/`** : ~20 scripts, dont plusieurs de diagnostic ponctuel que j'ai
  écrits cette session (`check-skin-indices`, `check-bone-axes`,
  `check-weight-coverage`, `check-target-topology`, `check-eye-and-slider-bones`,
  `inspect-base-bodies`). Ils gardent une valeur de garde-fou. Range-les dans
  `scripts/diagnostics/` avec un `README.md` d'une ligne par script : **ce qu'il
  mesure et quelle question il tranche**. Ne les supprime pas — chacun a éliminé
  une hypothèse fausse.
- **`.hermes/`** : 15 fichiers, dont des rapports datés qui se recouvrent. Garde
  l'historique, mais ajoute un `INDEX.md` qui dit lequel fait foi aujourd'hui.
- **Fichiers `*.bak`** : `RpgGameWorld.tsx.bak`, `vite.config.ts.bak` — morts et
  divergents (cf. `CLAUDE.md`). À supprimer après vérification qu'aucun import ne
  les touche.
- **`public/models/personnages/base/`** : contient le corps MPFB2. Vérifie qu'il
  n'y traîne rien d'autre d'inutilisé.

⚠️ **Ne renomme AUCUN dossier de premier niveau de `public/models/`.** 87 chemins
sont codés en dur dans `src/`. Ce sont des chaînes : `tsc` ne verra jamais la
rupture, et le fallback SPA de Vite renvoie du `text/html` en 200 au lieu d'un 404.

---

## 4. Un piège que je viens de payer, et qui te concerne

**`RendererRegistrar` doit être monté dans CHAQUE `<Canvas>` qui charge des GLB.**

`KTX2Loader` exige `detectSupport(renderer)` avant tout transcodage. Sans renderer
enregistré, `attachKTX2` en fabrique un jetable : le transcodage peut échouer et le
maillage rend en **BLANC**, sans erreur — et chaque renderer jetable consomme un
contexte WebGL, d'où les `Context Lost`.

Les deux Canvas de `ForgePersonnages.tsx` ne l'avaient pas. Corrigé. Comme tu vas
convertir des centaines de pièces en KTX2, **vérifie qu'aucun nouveau Canvas
n'apparaît sans lui** :

```powershell
Select-String -Path "src\**\*.tsx" -Pattern "<Canvas" | ForEach-Object {
  if (-not (Select-String -Path $_.Path -Pattern "RendererRegistrar" -Quiet)) { $_.Path }
}
```

---

## 5. Ce qui reste chez MOI — ne t'en occupe pas

- Branchement UI du corps MPFB2 comme `baseAvatar` sélectionnable (ton §7.5).
- Curseur de silhouette sans effet côté homme — 8 os sur 8 présents, non reproduit.
- Curseur « ventre » et morphologie fine du visage (bloqué : les cibles MPFB2
  indexent 19 158 sommets contre 8 049 pour nos têtes — il faut une projection).
- `_ktx2_backup/` : je les supprime après validation visuelle par l'utilisateur.

---

## 6. Boucle de lot — la version à jour

```bash
node scripts/extract-body-parts.mjs                 # dry-run, vérifier le plan
node scripts/extract-body-parts.mjs --write
node scripts/audit-part-compat.mjs | Select-String "REFUSÉ|pièces ·"
node scripts/audit-part-compat.mjs --json=src/data/part-compat.json   # ← AJOUTÉ
node scripts/assets-to-ktx2.mjs public/models/personnages/_parts/<nouveaux>
node scripts/generate-part-thumbs.mjs
npm test && npm run typecheck
```

## 7. Rappels qui ont déjà coûté cher

**Jamais `.array` sur un attribut de géométrie** — sur un maillage entrelacé c'est
le tampon partagé. Lire donne du bruit, écrire disperse les sommets. `getX/setXYZ`.

**Jamais écraser un fichier de test** — vérifier qu'il existe. Un écrasement a
détruit 8 tests sans faire rougir la suite.

**Un test vert ne prouve rien** tant qu'il n'a pas échoué sur le code d'avant.
Sabote, vérifie le rouge, restaure.

## 8. État de départ

`195 fichiers · 2151 tests · tsc 0`
69 pièces · 11 sources · 2 bases (biker 161 os · mpfb 52 os)