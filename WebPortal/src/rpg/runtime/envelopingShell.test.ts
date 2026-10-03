import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { isEnvelopingShell, SHELL_THRESHOLDS } from "./envelopingShell";

/** Mesh de dimensions et densité choisies — pas une forme au hasard. */
function mesh(taille: [number, number, number], triangles: number, scale = 1): THREE.Mesh {
  const g = new THREE.BufferGeometry();
  // `triangles` positions × 3 sommets, réparties dans la boîte demandée.
  const n = Math.max(1, Math.round(triangles)) * 3;
  const p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    p[i * 3]     = (i % 2 ? 0.5 : -0.5) * taille[0];
    p[i * 3 + 1] = (i % 3 ? 0.5 : -0.5) * taille[1];
    p[i * 3 + 2] = (i % 5 ? 0.5 : -0.5) * taille[2];
  }
  g.setAttribute("position", new THREE.BufferAttribute(p, 3));
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial());
  m.scale.setScalar(scale);
  return m;
}

describe("isEnvelopingShell", () => {
  it("reconnaît la coque RÉELLE de la map orbitale", () => {
    // Mesuré : 4702 × 2463 × 5724 unités pour 1719 triangles. C'est le mesh qui
    // produisait « un mur invisible qui bloque et fait remonter le joueur ».
    expect(isEnvelopingShell(mesh([4702, 2463, 5724], 1719))).toBe(true);
  });

  it("ÉPARGNE du terrain praticable de même envergure", () => {
    // Le faux positif à éviter absolument : retirer du sol ferait tomber le
    // joueur à travers la carte, bien pire que le mur qu'on supprime. Un chunk
    // de la Forge fait ~250 000 triangles pour une emprise comparable.
    expect(isEnvelopingShell(mesh([4000, 2000, 5000], 250_000))).toBe(false);
  });

  it("épargne un objet peu dense mais PETIT", () => {
    // Un panneau, une passerelle : peu de triangles, mais il ne peut pas
    // envelopper une carte. Les DEUX conditions doivent tenir.
    expect(isEnvelopingShell(mesh([50, 3, 50], 12))).toBe(false);
  });

  it("mesure en espace MONDE, pas en local", () => {
    // Un mesh unitaire mis à l'échelle ×5000 par son nœud est une coque, même
    // si sa géométrie locale tient dans 1 unité.
    const petit = mesh([1, 1, 1], 12);
    expect(isEnvelopingShell(petit), "sans échelle").toBe(false);
    const mis = mesh([1, 1, 1], 12, 5000);
    expect(isEnvelopingShell(mis), "avec échelle ×5000").toBe(true);
  });

  it("un mesh vide n'est pas une coque", () => {
    const g = new THREE.BufferGeometry();
    expect(isEnvelopingShell(new THREE.Mesh(g, new THREE.MeshBasicMaterial()))).toBe(false);
  });

  it("les seuils sont bien séparés des cas réels", () => {
    // Documente la marge : la coque orbitale a ~7 800 u de diagonale (seuil
    // 4 000), 1 719 triangles (seuil 5 000) et 2 463 u sur son plus petit axe
    // (seuil 1 500). Aucun des trois n'est frôlé.
    expect(SHELL_THRESHOLDS.DIAGONALE_MIN).toBeLessThan(7800);
    expect(SHELL_THRESHOLDS.TRIANGLES_MAX).toBeGreaterThan(1719);
    expect(SHELL_THRESHOLDS.EPAISSEUR_MIN).toBeLessThan(2463);
  });
});

describe("isEnvelopingShell — plaques de terrain (régression mesurée)", () => {
  // Ces quatre meshes existent VRAIMENT dans `chunks_v3` et étaient tous classés
  // coques par l'ancien critère (diagonale seule) : leur collision était retirée,
  // donc le joueur traversait le sol de la Forge. Dimensions relevées au
  // gltf-transform sur les fichiers livrés, pas inventées.
  const PLAQUES: Array<[string, [number, number, number], number]> = [
    ["ground_with_grass (a)", [1737, 168, 1935], 2301],
    ["ground_with_grass (b)", [1307, 79, 1839], 1412],
    ["cliff_blend_005",       [1366, 41, 1677], 686],
    ["cliff_blend_2",         [1444, 47, 1700], 3570],
  ];

  for (const [nom, taille, tris] of PLAQUES) {
    it(`${nom} reste SOLIDE`, () => {
      expect(isEnvelopingShell(mesh(taille, tris))).toBe(false);
    });
  }

  it("un gros rocher massif reste solide lui aussi", () => {
    // `titanium_shard028` : 1910 × 1010 × 2745 pour 2250 triangles. Épais dans
    // les trois axes, mais loin d'envelopper une carte — le rendre traversable
    // serait aussi visible qu'un trou dans le sol.
    expect(isEnvelopingShell(mesh([1910, 1010, 2745], 2250))).toBe(false);
  });

  it("distingue une plaque d'une coque à diagonale ÉGALE", () => {
    // Le cœur du correctif : à diagonale et densité identiques, seule
    // l'épaisseur sépare les deux. Une coque enveloppe donc elle est grande
    // dans les trois directions ; un sol est plat.
    expect(isEnvelopingShell(mesh([4000, 100, 5000], 1500)), "plaque plate").toBe(false);
    expect(isEnvelopingShell(mesh([4000, 2500, 5000], 1500)), "coque épaisse").toBe(true);
  });
});
