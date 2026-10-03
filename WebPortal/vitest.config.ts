import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // `scripts/` est inclus parce que l'outillage d'assets N'ÉTAIT PAS testable :
    // le bug des dimensions non multiples de 4 (qui a bloqué le chargement de la
    // forge) vivait dans un .mjs hors couverture, et n'a été visible qu'en jeu.
    //
    // `electron/` est inclus pour la MÊME raison, constatée le 03/08/2026 : la
    // traduction MySQL→SQLite mutilait la clause `VALUES(...)` de l'INSERT dès
    // qu'elle était écrite sans espace — ce qui est le cas de la requête de
    // sauvegarde de personnage. Aucun test ne pouvait le voir, et `tsc` ne
    // couvre pas non plus ce dossier.
    //
    // `Prototype/` est inclus pour la MÊME raison, constatée le 28/08/2026 : la
    // politique prototype exige que la logique métier soit « en TS pur et
    // TESTÉE » avant promotion (docs/ARCHITECTURE_PROTOTYPES.md §4.3). Or un
    // `.test.ts` déposé dans `Prototype/` n'était jamais exécuté — `npm test`
    // restait vert sans l'avoir lu. C'est le motif déjà corrigé côté `tsc` avec
    // `tsconfig.prototypes.json` : un contrôle qui rassure sans rien contrôler.
    include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs', 'electron/**/*.test.ts', 'Prototype/**/*.test.ts'],
    environment: 'node',          // modules purs : pas besoin de DOM
    globals: false,
  },
});