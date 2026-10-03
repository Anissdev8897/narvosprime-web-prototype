// ══════════════════════════════════════════════════════════════════════════════
// prototypeBoundary.test.ts — La règle de dépendance des prototypes, testée.
//
// ── LA RÈGLE ────────────────────────────────────────────────────────────────
//
//   Prototype/  ──dépend de──▶  src/
//   Prototype/  ◀──JAMAIS──     src/
//
// Un prototype CONSOMME le jeu ; il ne le modifie pas et n'est jamais importé
// par lui. Le jour où `src/` importe un prototype, la promesse « un prototype
// qui casse ne casse rien » est morte : une erreur dans un banc d'essai
// devient une erreur du jeu.
//
// ── POURQUOI UN TEST PLUTÔT QU'UNE CONSIGNE ─────────────────────────────────
//
// Une règle écrite dans un .md dépend de la discipline de celui qui code, et
// personne ne relit les docs en écrivant un import. Ici la barrière est
// mécanique : `npm test` échoue, avec le fichier et la ligne fautive.
//
// Ce test lit les fichiers sur disque plutôt que d'analyser le graphe de
// modules : un import DYNAMIQUE (`await import("../Prototype/…")`) est
// invisible au bundler comme à tsc, mais pas à une recherche de texte.
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const RACINE_SRC = join(__dirname);
const RACINE_PROJET = join(__dirname, "..");

/** Extensions parcourues : tout ce qui peut porter un `import`. */
const EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mts", ".cts"];

/** `Prototype` en position de segment de chemin, dans un import ou un require. */
const IMPORT_PROTOTYPE =
  /(?:from|import|require)\s*\(?\s*["'`][^"'`]*(?:^|\/)Prototype\//;

function fichiersSources(dossier: string, sortie: string[] = []): string[] {
  for (const entree of readdirSync(dossier)) {
    // `node_modules` ne devrait pas exister sous src/, mais un lien symbolique
    // ou un paquet local le ferait apparaître — et le parcours exploserait.
    if (entree === "node_modules" || entree === "_legacy_archive") continue;
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) {
      fichiersSources(chemin, sortie);
    } else if (EXTENSIONS.some((e) => entree.endsWith(e))) {
      sortie.push(chemin);
    }
  }
  return sortie;
}

describe("frontière src/ ↔ Prototype/", () => {
  it("aucun fichier de src/ n'importe un prototype", () => {
    const fautifs: string[] = [];

    for (const fichier of fichiersSources(RACINE_SRC)) {
      // Ce fichier de test PARLE de la règle : ses propres motifs ne doivent
      // pas la déclencher. On l'exclut explicitement plutôt que d'affaiblir
      // l'expression régulière — sinon un vrai import passerait aussi.
      if (fichier === __filename) continue;

      const lignes = readFileSync(fichier, "utf8").split("\n");
      lignes.forEach((ligne, i) => {
        if (IMPORT_PROTOTYPE.test(ligne)) {
          fautifs.push(`${relative(RACINE_PROJET, fichier)}:${i + 1} — ${ligne.trim()}`);
        }
      });
    }

    expect(fautifs, `src/ ne doit jamais importer Prototype/ :\n${fautifs.join("\n")}`).toEqual([]);
  });

  it("le parcours voit bien des fichiers (le test n'est pas vide)", () => {
    // Un test qui n'inspecte rien passe toujours. Ce garde-fou est la raison
    // pour laquelle l'assertion ci-dessus veut dire quelque chose.
    expect(fichiersSources(RACINE_SRC).length).toBeGreaterThan(100);
  });
});
