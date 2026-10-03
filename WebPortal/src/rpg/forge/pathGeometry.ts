// forge/pathGeometry.ts — génération de GÉOMÉTRIE DE ROUTE le long d'une spline (pur, testable).
//
// À partir de points de contrôle (CatmullRom), on échantillonne la courbe et on construit
// un RUBAN plat (route/chemin) de largeur donnée : à chaque échantillon, perpendiculaire
// horizontale (XZ) → bords gauche/droit. UV : u en travers (0..1), v le long (distance /
// tileLength) → texture répétée naturellement. Renvoie des tableaux bruts (positions/uvs/
// indices) → testable hors Three, géométrie montée par RoadMesh.
import * as THREE from "three";

export interface RoadBuffers { positions: Float32Array; uvs: Float32Array; indices: Uint32Array; samples: number; }

/** Construit le ruban. `samplesPerSpan` = densité d'échantillons par segment de contrôle. */
export function buildRoad(points: [number, number, number][], width: number, samplesPerSpan = 10, tileLength = 6): RoadBuffers {
  if (points.length < 2) return { positions: new Float32Array(), uvs: new Float32Array(), indices: new Uint32Array(), samples: 0 };
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
  const n = Math.max(2, (points.length - 1) * samplesPerSpan + 1);
  const pts = curve.getSpacedPoints(n - 1);            // n points équidistants
  const half = width / 2;

  const positions = new Float32Array(n * 2 * 3);
  const uvs = new Float32Array(n * 2 * 2);
  const up = new THREE.Vector3(0, 1, 0);
  const tan = new THREE.Vector3();
  const side = new THREE.Vector3();
  let dist = 0;

  for (let i = 0; i < n; i++) {
    const p = pts[i];
    // Tangente (différence avant/arrière) projetée à plat.
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    tan.set(b.x - a.x, 0, b.z - a.z).normalize();
    side.crossVectors(tan, up).normalize().multiplyScalar(half); // perpendiculaire horizontale
    if (i > 0) dist += p.distanceTo(pts[i - 1]);
    const v = dist / tileLength;
    const lift = 0.04; // léger au-dessus du sol (anti z-fight)
    // Bord gauche
    positions[i * 6 + 0] = p.x - side.x; positions[i * 6 + 1] = p.y + lift; positions[i * 6 + 2] = p.z - side.z;
    uvs[i * 4 + 0] = 0; uvs[i * 4 + 1] = v;
    // Bord droit
    positions[i * 6 + 3] = p.x + side.x; positions[i * 6 + 4] = p.y + lift; positions[i * 6 + 5] = p.z + side.z;
    uvs[i * 4 + 2] = 1; uvs[i * 4 + 3] = v;
  }

  // Triangles : 2 par segment (quad entre échantillons i et i+1).
  const indices = new Uint32Array((n - 1) * 6);
  for (let i = 0; i < n - 1; i++) {
    const l0 = i * 2, r0 = i * 2 + 1, l1 = (i + 1) * 2, r1 = (i + 1) * 2 + 1;
    indices.set([l0, r0, l1, r0, r1, l1], i * 6);
  }
  return { positions, uvs, indices, samples: n };
}
