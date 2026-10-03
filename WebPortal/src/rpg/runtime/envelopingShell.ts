// ══════════════════════════════════════════════════════════════════════════════
// runtime/envelopingShell.ts — Détecte les COQUES ENVELOPPANTES d'une map.
//
// LE PROBLÈME, MESURÉ SUR LA MAP ORBITALE :
// Un mesh de 4702 × 2463 × 5724 unités pour seulement 1719 triangles. Ce n'est
// pas du décor : c'est une boîte de ciel / volume de limites, qui enveloppe la
// carte entière. Enregistré comme collider, il produisait exactement ce que le
// joueur décrivait — « un mur invisible bloque le passage et fait remonter le
// joueur » : on marche à l'intérieur d'une coque, on la heurte, et sa face
// inférieure repousse vers le haut.
//
// Effet secondaire tout aussi coûteux : les sphères de culling des chunks
// étaient calculées sur la géométrie réelle, coque comprise. Résultat, des
// rayons jusqu'à 30 837 unités pour des chunks dont les centres tiennent dans
// quelques milliers — le culling ne culle plus rien.
//
// LE CRITÈRE — densité, pas nom de mesh :
// On ne peut pas filtrer sur `-001` ou « skybox » : les noms varient d'un export
// à l'autre et un jour quelqu'un appellera son terrain « SkyPlatform ». Ce qui
// ne varie pas, c'est le RAPPORT taille/triangles. Une coque couvre des
// milliers d'unités avec une poignée de faces ; du décor praticable a besoin de
// bien plus de triangles pour la même étendue, ne serait-ce que pour avoir un
// relief sur lequel marcher.
//
// La coque est TOUJOURS RENDUE — elle fait partie du décor visible. Seule sa
// participation à la COLLISION est retirée.
// ══════════════════════════════════════════════════════════════════════════════

import * as THREE from "three";

/**
 * Diagonale minimale (unités monde) pour qu'un mesh soit seulement CANDIDAT.
 *
 * En dessous, aucune coque possible : un objet de 2 000 unités de diagonale
 * n'enveloppe pas une carte. Ce seuil écarte d'emblée tout le décor normal, y
 * compris les grandes pièces d'architecture.
 */
const DIAGONALE_MIN = 4000;

/**
 * Épaisseur minimale sur le PLUS PETIT axe.
 *
 * C'EST LE CRITÈRE QUI MANQUAIT, ET SON ABSENCE A COÛTÉ LE SOL DE LA FORGE.
 *
 * La diagonale seule ne distingue pas une coque d'une PLAQUE DE TERRAIN. Mesuré
 * sur `chunks_v3` : quatre meshes de sol étaient classés coques et retirés de la
 * collision, dont `ground_with_grass` (2301 tris, 1737 × 168 × 1935) et
 * `cliff_blend_005` (686 tris, 1366 × 41 × 1677). Le joueur traversait donc le
 * sol — « il n'arrive pas à marcher sur la terre ferme et passe à travers ».
 *
 * Une coque ENVELOPPE : elle est grande dans les TROIS directions, puisqu'on
 * marche à l'intérieur. Un sol est large et PLAT. L'écart mesuré est net :
 *   • coque orbitale         → 4702 × 2463 × 5724, plus petit axe 2463
 *   • gros rocher (shard)    → 1910 × 1010 × 2745, plus petit axe 1010
 *   • plaques de sol Forge   → plus petit axe entre 41 et 168
 * Le seuil se pose donc dans le vide entre 1010 et 2463, et il exclut au passage
 * les gros props solides — qu'il ne faut pas non plus rendre traversables.
 */
const EPAISSEUR_MIN = 1500;

/**
 * Triangles maximum pour qu'un candidat soit jugé creux.
 *
 * Relevé sur la coque orbitale : 1719 triangles pour ~7 800 unités de
 * diagonale. Une plateforme praticable de cette envergure en compte des
 * dizaines de milliers — les 8 chunks de la Forge totalisent 2 millions de
 * triangles sur une emprise comparable. La marge entre les deux ordres de
 * grandeur est telle qu'un seuil à 5 000 ne risque pas de confondre les deux.
 */
const TRIANGLES_MAX = 5000;

/** Nombre de triangles d'une géométrie, indexée ou non. */
function triangleCount(g: THREE.BufferGeometry): number {
  if (g.index) return g.index.count / 3;
  const pos = g.attributes.position;
  return pos ? pos.count / 3 : 0;
}

/**
 * Ce mesh est-il une coque enveloppante — à rendre, mais jamais à percuter ?
 *
 * Volontairement CONSERVATEUR : les deux conditions doivent tenir. Un faux
 * positif retirerait du sol praticable et ferait tomber le joueur à travers la
 * carte, ce qui est bien pire que le mur qu'on cherche à supprimer.
 */
export function isEnvelopingShell(mesh: THREE.Mesh): boolean {
  const g = mesh.geometry;
  if (!g) return false;

  const tris = triangleCount(g);
  if (tris === 0 || tris > TRIANGLES_MAX) return false;

  if (!g.boundingBox) g.computeBoundingBox();
  const bb = g.boundingBox;
  if (!bb) return false;

  // Diagonale en espace MONDE : un mesh peut être petit en local et mis à
  // l'échelle par son nœud parent. Mesurer en local raterait ces cas.
  mesh.updateWorldMatrix(true, false);
  const monde = bb.clone().applyMatrix4(mesh.matrixWorld);
  const taille = new THREE.Vector3();
  monde.getSize(taille);

  if (taille.length() < DIAGONALE_MIN) return false;

  // Grand dans les TROIS directions, sinon c'est une plaque, pas une coque.
  return Math.min(taille.x, taille.y, taille.z) >= EPAISSEUR_MIN;
}

/** Seuils exposés pour les tests — évite de les redéclarer et de les désynchroniser. */
export const SHELL_THRESHOLDS = { DIAGONALE_MIN, TRIANGLES_MAX, EPAISSEUR_MIN };
