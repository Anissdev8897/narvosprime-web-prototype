// characters/bodyParts.ts — coloration PAR PARTIE du corps (option B, approximative).
//
// Le mesh Sorcier est un blob Tripo monolithique (1 matériau, couleurs en vertex-colors,
// aucun UV) → impossible de cibler une vraie partie. Approximation par BANDES DE HAUTEUR :
// on segmente le perso selon la position Y normalisée (0 = pieds, 1 = tête) et on multiplie
// les vertex-colors d'origine par la teinte de la bande. Limite assumée : deux parties à la
// MÊME hauteur (ceinture/pantalon, bras/torse) tombent dans la même bande.
import * as THREE from "three";

export type BodyPartId = "boots" | "pants" | "belt" | "robe" | "skin";

export const BODY_PARTS: { id: BodyPartId; label: string }[] = [
  { id: "boots", label: "Bottes" },
  { id: "pants", label: "Pantalon" },
  { id: "belt",  label: "Ceinture" },
  { id: "robe",  label: "Torse / Robe" },
  { id: "skin",  label: "Visage / Peau" },
];

/** Ordre des bandes du BAS vers le HAUT. */
export const PART_ORDER: BodyPartId[] = ["boots", "pants", "belt", "robe", "skin"];
/** Borne HAUTE (Y normalisé 0..1) de chaque bande, même ordre que PART_ORDER. */
export const BAND_MAX: number[] = [0.12, 0.42, 0.50, 0.82, 1.01];

export type PartTints = Partial<Record<BodyPartId, string>>;

/**
 * Re-teinte `COLOR_0` du mesh par bande de hauteur : couleur_finale = couleur_origine ×
 * teinte_de_bande. Idempotent (sauvegarde l'original une fois → pas de dérive cumulative).
 * Blanc (#ffffff) sur toutes les bandes = couleurs d'origine (neutre).
 */
export function applyBodyTint(mesh: THREE.Mesh, tints: PartTints): void {
  const geo = mesh.geometry as THREE.BufferGeometry;
  const pos = geo.getAttribute("position") as THREE.BufferAttribute | undefined;
  const col = geo.getAttribute("color") as THREE.BufferAttribute | undefined;
  if (!pos || !col) return; // pas de vertex-colors → rien à teinter
  const ud = geo.userData as { origColor?: Float32Array; bandIndex?: Uint8Array };
  // Early-out : aucune teinte ≠ blanc ET jamais teinté → la géométrie est déjà d'origine →
  // on évite 1,4 M itérations inutiles (cas neutre au mount). Si déjà teinté puis remis à
  // blanc (origColor existe), on laisse tourner pour RESTAURER les couleurs d'origine.
  const anyTint = PART_ORDER.some((p) => tints[p] && tints[p] !== "#ffffff");
  if (!anyTint && !ud.origColor) return;
  // Sauvegarde des couleurs d'ORIGINE (1×) sur la GÉOMÉTRIE (partagée entre clones
  // player/preview via SkeletonUtils.clone) → re-multiplication sans cumul, cohérente.
  if (!ud.origColor) ud.origColor = (col.array as Float32Array).slice();
  const orig = ud.origColor;

  const n = pos.count;
  const bands = PART_ORDER.map((p) => new THREE.Color(tints[p] ?? "#ffffff"));

  // CACHE de l'index de bande par sommet (calculé 1× sur la GÉOMÉTRIE partagée). Évite, à
  // CHAQUE re-teinte / re-mount, la bbox + ~7,25 M comparaisons (1,45M verts × 5 bandes) qui
  // saturaient le main thread au changement de perso. Calculé une seule fois ; ensuite on ne
  // fait plus que la multiplication couleur (le re-upload GPU reste, géré par le shader plus tard).
  if (!ud.bandIndex) {
    geo.computeBoundingBox();
    const bb = geo.boundingBox!;
    const ymin = bb.min.y;
    const yr = Math.max(1e-4, bb.max.y - bb.min.y);
    const idx = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const yn = (pos.getY(i) - ymin) / yr;
      let b = 0;
      for (let k = 0; k < BAND_MAX.length; k++) if (yn > BAND_MAX[k]) b = Math.min(k + 1, PART_ORDER.length - 1);
      idx[i] = b;
    }
    ud.bandIndex = idx;
  }
  const bandIndex = ud.bandIndex;

  const arr = col.array as Float32Array;
  const stride = col.itemSize; // 3 (rgb) ou 4 (rgba)
  for (let i = 0; i < n; i++) {
    const c = bands[bandIndex[i]];
    const o = i * stride;
    arr[o] = orig[o] * c.r;
    arr[o + 1] = orig[o + 1] * c.g;
    arr[o + 2] = orig[o + 2] * c.b;
    // alpha (o+3) inchangé
  }
  col.needsUpdate = true;
}
