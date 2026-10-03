import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Garde contre les hooks APPELÉS CONDITIONNELLEMENT via court-circuit.
 *
 * Motif interdit :
 *     if (!open || !useEditMode()) return null;
 *
 * `||` et `&&` court-circuitent : selon la valeur de gauche, le hook de droite
 * est appelé ou non. Le nombre de hooks change alors entre deux rendus et React
 * lève « Rendered more hooks than during the previous render ».
 *
 * POURQUOI CE TEST EXISTE — trois occurrences trouvées en production
 * (BodyTintAdmin, MapGenPanel, ArrowMutationAdmin). Ce n'était pas cosmétique :
 * GameErrorBoundary rattrapait l'erreur et DÉTRUISAIT tout le monde de jeu.
 * Mesuré en jeu — la map se rechargeait intégralement, les colliders passaient
 * de 91 à 990 sans être libérés, le compteur de textures GPU montait de 1748 à
 * 1927 en quelques minutes. Le symptôme visible ressemblait à « des morceaux de
 * map manquants », et a coûté plusieurs sessions de diagnostic à distance.
 *
 * Le projet n'a pas d'ESLint configuré (cf. CLAUDE.md : la barrière qualité est
 * `tsc`), et `tsc` ne voit pas ce défaut. D'où ce test.
 */

const SRC = path.resolve(__dirname, "../..");

/** Fichiers .tsx du runtime RPG, récursivement. */
function collectTsx(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) collectTsx(p, out);
    else if (entry.name.endsWith(".tsx")) out.push(p);
  }
  return out;
}

/**
 * Un appel de hook à DROITE d'un `||` ou `&&` est court-circuitable.
 *
 * On ignore ce qui suit `//` pour ne pas se déclencher sur les commentaires qui
 * documentent précisément ce piège.
 */
const SHORT_CIRCUIT_HOOK = /(\|\||&&)\s*!?\s*use[A-Z][A-Za-z0-9_]*\s*\(/;

describe("Rules of Hooks — pas de hook court-circuité", () => {
  const files = collectTsx(SRC);

  it("trouve des fichiers à analyser", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it("aucun hook appelé après || ou &&", () => {
    const offenders: string[] = [];

    for (const file of files) {
      const lines = fs.readFileSync(file, "utf8").split("\n");
      lines.forEach((raw, i) => {
        const code = raw.split("//")[0];        // hors commentaire
        if (!SHORT_CIRCUIT_HOOK.test(code)) return;
        offenders.push(`${path.relative(SRC, file)}:${i + 1}  ${raw.trim()}`);
      });
    }

    expect(
      offenders,
      "Hook appelé conditionnellement — le nombre de hooks changera entre deux " +
      "rendus et React lèvera « Rendered more hooks than during the previous " +
      "render », ce qui fait CRASHER tout le monde de jeu via GameErrorBoundary.\n" +
      "Correctif : appeler le hook AVANT le retour anticipé et tester la variable.\n" +
      "  const isEdit = useEditMode();\n" +
      "  if (!open || !isEdit) return null;\n\n" +
      offenders.join("\n"),
    ).toEqual([]);
  });
});
