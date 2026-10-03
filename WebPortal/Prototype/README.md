# Prototypes

Politique : `../docs/ARCHITECTURE_PROTOTYPES.md`.
Règle de dépendance : `Prototype/` → `src/`, **jamais l'inverse** (testé par
`src/prototypeBoundary.test.ts`).

## Lancer

```bash
npm run proto:combat       # Electron sur Proto_combat
npm run proto:charactere   # Electron sur Proto_charactere
npm run proto:editeur      # Electron sur Proto_editeur
npm run proto:serve        # Vite seul, port 3006 → /Prototype/<dossier>/
```

## État

| Prototype | Ce qu'il déverrouille | État | Reste à faire |
|---|---|---|---|
| `Proto_combat` | phases, fenêtre de combo, tampon, garde angulaire, réaction directionnelle, attaque chargée | logique testée (50 tests), panneau de réglage, banc jouable, 60 clips sur rig Wraith | ciblage (uAim) ; vraies réactions aux coups (aucun clip de hit dans la bibliothèque) |
| `Proto_charactere` | créateur modulaire hors Forge | importe `ForgePersonnages` tel quel | — |
| `Proto_editeur` | éditeur de map isolé | — | — |

## Contrôles

Les prototypes sont **dev seulement** : ils ne partent pas en production
(pas d'entrée `build.rollupOptions.input`).

- `npm test` — inclut `Prototype/**/*.test.ts` (depuis le 28/08/2026)
- `npm run typecheck:proto` — `tsconfig.prototypes.json`

Les deux doivent être verts avant toute promotion vers `src/`.

## Critère de promotion

`../docs/ARCHITECTURE_PROTOTYPES.md` §4.3. Le premier point porte tout le reste :
si la logique vit dans le composant R3F, la promotion est une réécriture ; si
elle est en TS pur, c'est un déplacement de fichier.
