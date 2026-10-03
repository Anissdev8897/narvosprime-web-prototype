import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { NPC_CATALOG } from "./npcCatalog";
import { getNpcModelPath } from "../loaders/assetManifest";

/**
 * Chaque PNJ du catalogue a-t-il son GLB sur le disque ?
 *
 * POURQUOI CE TEST EXISTE : le fallback SPA de Vite renvoie du `text/html` en
 * 200 pour un fichier absent, pas un 404 (cf. CLAUDE.md). Un chemin faux ne lève
 * donc AUCUNE erreur — le GLTFLoader reçoit du HTML, échoue en silence, et
 * l'entité reste dans le monde avec sa logique de combat intacte mais SANS
 * mesh. Symptôme exact : « les monstres sont invisibles mais ils attaquent ».
 *
 * C'est le seul endroit où l'on peut attraper ça avant le joueur : ni `tsc` ni
 * le runtime ne le signalent.
 *
 * NOTE DE MÉTHODE : un premier audit par expression régulière sur le fichier
 * source a rendu 39 faux positifs — il ne captait que les chaînes littérales et
 * ratait `assetRoot: MONSTRES_ROOT` (un identifiant), faisant retomber tous les
 * monstres sur la racine par défaut. D'où ce test, qui IMPORTE le catalogue et
 * appelle la vraie fonction de résolution.
 */
const PUBLIC = path.resolve(__dirname, "../../../public");

describe("intégrité des assets PNJ", () => {
  const resolus = NPC_CATALOG.map((def) => ({
    folder: def.folder,
    label: def.label,
    role: def.role,
    url: def.modelPath ?? getNpcModelPath(def.folder, def.assetRoot, def.modelFile),
  }));

  it("le catalogue n'est pas vide", () => {
    expect(resolus.length).toBeGreaterThan(20);
  });

  it("chaque PNJ a son GLB sur le disque", () => {
    const manquants = resolus
      .filter((r) => !fs.existsSync(path.join(PUBLIC, r.url.replace(/^\//, ""))))
      .map((r) => `${r.folder} [${r.role}] → ${r.url}`);

    expect(
      manquants,
      `PNJ sans modèle — ils seront INVISIBLES en jeu tout en restant\n` +
      `attaquables (le loader reçoit du text/html et échoue en silence) :\n` +
      manquants.join("\n"),
    ).toEqual([]);
  });
});
