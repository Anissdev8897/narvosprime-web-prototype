// ══════════════════════════════════════════════════════════════════════════════
// runtime/mapBoundsFit.ts — CALCULER la limite d'une map depuis sa géométrie.
//
// « Recalcule l'offset de ce mur invisible autour de la map GLB, car les PNJ et
// les animaux sont placés en dehors de cette zone. »
//
// Une limite posée à la main se règle à l'œil, et à l'œil on se trompe : la
// Forge porte un offset [181, -401, -47], son sol est à y ≈ -27,8, et ses PNJ
// sont placés en coordonnées monde réelles. Impossible de deviner l'emprise.
// On la MESURE donc sur ce qui est effectivement chargé.
//
// DEUX PIÈGES, LES DEUX DÉJÀ RENCONTRÉS SUR CE PROJET :
//
//  1. LES COQUES ENVELOPPANTES. La map orbitale contient un volume de
//     4702 × 2463 × 5724 unités pour 1719 triangles — une boîte de ciel. La
//     prendre dans le calcul donnerait une limite six fois trop large, donc
//     inutile. On réutilise `isEnvelopingShell`, déjà écrit pour la collision.
//
//  2. CE QUI EST PLACÉ HORS DU SOL. Les PNJ et les animaux ne vivent pas
//     forcément au-dessus d'un collider — c'est précisément la plainte à
//     l'origine de ce module. On ÉLARGIT donc la boîte pour les inclure, plutôt
//     que de s'en tenir à la géométrie. Une limite qui exclut le contenu de la
//     map n'est pas une limite, c'est un bug.
// ══════════════════════════════════════════════════════════════════════════════

import * as THREE from "three";
import { isEnvelopingShell } from "./envelopingShell";

export interface FitResult {
  center: [number, number, number];
  size: [number, number, number];
  /** Meshes réellement pris en compte — sert à vérifier qu'on n'a pas tout filtré. */
  meshCount: number;
  /** Coques écartées. Une valeur non nulle explique un résultat plus petit qu'attendu. */
  shellsSkipped: number;
}

/** Marge par défaut au-delà du contenu, en unités monde. */
export const FIT_MARGIN = 30;

/**
 * Emprise à cerner, calculée sur la géométrie ET sur les points fournis.
 *
 * Rend `null` si rien d'exploitable n'a été trouvé — mieux vaut ne pas poser de
 * mur qu'en poser un dégénéré, qui enfermerait le joueur dans un volume vide.
 */
export function fitMapExtent(
  root: THREE.Object3D | null,
  points: Array<[number, number, number]> = [],
  margin = FIT_MARGIN,
): FitResult | null {
  const box = new THREE.Box3();
  let meshCount = 0;
  let shellsSkipped = 0;

  if (root) {
    const tmp = new THREE.Box3();
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;
      if (isEnvelopingShell(mesh)) { shellsSkipped++; return; }
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      const bb = mesh.geometry.boundingBox;
      if (!bb) return;
      mesh.updateWorldMatrix(true, false);
      tmp.copy(bb).applyMatrix4(mesh.matrixWorld);
      box.union(tmp);
      meshCount++;
    });
  }

  // Les points élargissent la boîte sans jamais la rétrécir : un PNJ isolé
  // repousse la limite, il ne la redéfinit pas.
  for (const [x, y, z] of points) box.expandByPoint(new THREE.Vector3(x, y, z));

  if (box.isEmpty()) return null;

  const c = new THREE.Vector3();
  const s = new THREE.Vector3();
  box.getCenter(c);
  box.getSize(s);

  return {
    center: [round2(c.x), round2(c.y), round2(c.z)],
    // La marge s'ajoute des DEUX côtés — d'où le facteur 2 sur une dimension
    // pleine. L'oublier donnerait une limite qui frôle le bord de la map, et le
    // joueur se cognerait à un mur avant d'avoir atteint le décor visible.
    size: [round2(s.x + margin * 2), round2(s.y + margin * 2), round2(s.z + margin * 2)],
    meshCount,
    shellsSkipped,
  };
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
