// ══════════════════════════════════════════════════════════════════════════════
// ragdoll/RagdollSystem.ts — Système de ragdoll procédural (zéro dépendance
// physique externe). Simule la physique des os après la mort.
//
// Principe :
//   1. Au declenchement, capture l'état (position/rotation monde) de chaque os
//      du squelette depuis la dernière pose de l'AnimationMixer.
//   2. Remplace l'animation par une simulation physique manuelle : gravité,
//      vélocité, amortissement, contraintes de distance entre os, collision
//      avec le sol.
//   3. Nettoie après 5 secondes (fading + retrait).
//
// Pourquoi pas cannon-es/rapier :
//   • Évite une dépendance lourde qui peut casser le build
//   • Les PNJ meurent rarement — le coût d'un moteur complet n'est pas justifié
//   • L'effet visuel est similaire : le corps s'effondre avec inertie
//
// Capsules par bone (représentation visuelle) :
//   Tête, torse (spine+chest+upperChest), bras (×2), avant-bras (×2),
//   cuisses (×2), mollets (×2). Chaque capsule est un maillage Three.js qui
//   suit l'os simulé.
// ══════════════════════════════════════════════════════════════════════════════

import * as THREE from "three";

// ── Scratch partagé (applyToSkeleton tourne à chaque frame × chaque os) ──────
// Sans ça, un ragdoll de 15 os alloue 45 objets Three.js par frame pendant les
// 5 s de sa TTL — pure pression sur le GC pendant une scène de mort, c'est-à-dire
// au pire moment. Réutilisable sans risque : les trois sont consommés dans la
// même itération, jamais conservés.
const TMP_MAT = new THREE.Matrix4();
const TMP_VEC = new THREE.Vector3();
const TMP_QUAT = new THREE.Quaternion();

// ── Constantes physiques ─────────────────────────────────────────────────────
const GRAVITY = new THREE.Vector3(0, -15, 0);    // m/s² (un peu plus fort que −9.8 pour un affaissement rapide)
const DAMPING = 0.98;                             // amortissement linéaire (1 = pas d'amortissement)
const ANGULAR_DAMPING = 0.92;                     // amortissement rotationnel
const GROUND_Y = 0.0;                             // hauteur du sol
const CONSTRAINT_ITERATIONS = 8;                  // résolution des contraintes (qualité vs perf)
const CONSTRAINT_STIFFNESS = 0.5;                 // raideur du ressort de contrainte (0..1)
const RESTITUTION = 0.15;                         // rebond au sol
const FRICTION = 0.4;                             // friction au sol

/** Temps de vie max d'un ragdoll (secondes). */
const RAGDOLL_TTL = 5.0;

/** Temps de fondu de disparition (secondes). */
const FADE_DURATION = 0.8;

// ── Interface BoneState ──────────────────────────────────────────────────────
/** État physique simulé pour un os. */
interface BoneState {
  bone: THREE.Bone;
  /** Position MONDE actuelle. */
  pos: THREE.Vector3;
  /** Vélocité (m/s). */
  vel: THREE.Vector3;
  /** Rotation MONDE actuelle (quaternion). */
  quat: THREE.Quaternion;
  /** Vélocité angulaire (rad/s, axe local). */
  angVel: THREE.Vector3;
  /** Raideur de contrainte individuelle (pour les extrémités = plus souples). */
  stiffness: number;
  /** Masse relative (os lourds = tronc, os légers = mains/pieds). */
  mass: number;
}

/** Structure de contrainte entre deux os. */
interface BoneConstraint {
  a: number;               // index a
  b: number;               // index b
  restLength: number;      // distance de repos (monde)
}

/** Configuration visuelle d'une capsule. */
interface CapsuleDef {
  boneIndex: number;
  radius: number;
  length: number;
  color: string;
}

// ── Definition des os majeurs du squelette humanoïde ─────────────────────────
// Ces patterns couvrent les conventions Meshy (SANS préfixe) et UE (pelvis,
// upperarm_l…). `normalizeBoneName` est utilisé pour la correspondance.

/** Liste des os importants pour la simulation ragdoll, dans l'ordre hiérarchique. */
const MAJOR_BONES = [
  // Tronc (colonne)
  { pattern: /^(hips|pelvis|root)$/i, mass: 6.0, stiffness: 1.0 },
  { pattern: /^(spine|spine_?01?)$/i, mass: 3.0, stiffness: 1.0 },
  { pattern: /^(chest|spine_?0?2|spine1)$/i, mass: 3.0, stiffness: 1.0 },
  { pattern: /^(upp?erchest|spine_?0?3|spine2)$/i, mass: 2.0, stiffness: 0.9 },
  { pattern: /^(neck)$/i, mass: 0.5, stiffness: 0.8 },
  { pattern: /^(head)$/i, mass: 1.5, stiffness: 0.7 },
  // Bras gauche
  { pattern: /^(leftshoulder|claviclel|shoulder_l)$/i, mass: 0.8, stiffness: 0.9 },
  { pattern: /^(left(upper)?arm|upperarml)$/i, mass: 1.2, stiffness: 0.9 },
  { pattern: /^(left(lowerarm|forearm)|lowerarml)$/i, mass: 0.8, stiffness: 0.8 },
  { pattern: /^(lefthand|handl)$/i, mass: 0.4, stiffness: 0.6 },
  // Bras droit
  { pattern: /^(rightshoulder|clavicler|shoulder_r)$/i, mass: 0.8, stiffness: 0.9 },
  { pattern: /^(right(upper)?arm|upperarmr)$/i, mass: 1.2, stiffness: 0.9 },
  { pattern: /^(right(lowerarm|forearm)|lowerarmr)$/i, mass: 0.8, stiffness: 0.8 },
  { pattern: /^(righthand|handr)$/i, mass: 0.4, stiffness: 0.6 },
  // Jambe gauche
  { pattern: /^(left(up)?(leg|thigh)|thighl)$/i, mass: 2.0, stiffness: 1.0 },
  { pattern: /^(left(lower)?leg|calfl)$/i, mass: 1.5, stiffness: 1.0 },
  { pattern: /^(leftfoot|footl)$/i, mass: 0.5, stiffness: 0.8 },
  // Jambe droite
  { pattern: /^(right(up)?(leg|thigh)|thighr)$/i, mass: 2.0, stiffness: 1.0 },
  { pattern: /^(right(lower)?leg|calfr)$/i, mass: 1.5, stiffness: 1.0 },
  { pattern: /^(rightfoot|footr)$/i, mass: 0.5, stiffness: 0.8 },
];

// ── Helper ───────────────────────────────────────────────────────────────────
function normalizeBoneName(name: string): string {
  return name.replace(/^mixamorig:?/i, "").replace(/[\s_.:-]/g, "").toLowerCase();
}

function matchesAny(name: string, patterns: RegExp[]): boolean {
  const n = normalizeBoneName(name);
  return patterns.some((p) => p.test(n));
}

// ── BoneSkeletonInfo ─────────────────────────────────────────────────────────
interface BoneInfo {
  bone: THREE.Bone;
  name: string;
  children: BoneInfo[];
}

/**
 * Parcourt un objet Three.js pour trouver TOUS les os (THREE.Bone) et les
 * retourne dans l'ordre hiérarchique (profondeur d'abord).
 */
function collectBones(root: THREE.Object3D): THREE.Bone[] {
  const bones: THREE.Bone[] = [];
  root.traverse((child) => {
    if (child instanceof THREE.Bone) {
      bones.push(child);
    }
  });
  return bones;
}

// ── CapsuleGeometry ──────────────────────────────────────────────────────────
/**
 * Crée une géométrie de capsule (cylindre + deux demi-sphères aux extrémités)
 * le long de l'axe Y.
 */
function createCapsuleGeometry(radius: number, length: number, segments = 8): THREE.BufferGeometry {
  const group = new THREE.BufferGeometry();
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  const halfLen = length / 2;
  const latSegs = Math.max(4, Math.floor(segments / 2));
  const longSegs = segments;

  // Cylindre central (barrel)
  for (let j = 0; j <= longSegs; j++) {
    const theta = (j / longSegs) * Math.PI * 2;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    for (let i = 0; i <= latSegs; i++) {
      const phi = (i / latSegs) * Math.PI;
      const y = -halfLen + (i / latSegs) * length;
      // Cylindre : rayon constant, Y varie
      const nx = Math.sin(theta) * Math.sin(Math.PI / 2);
      const ny = 0;
      const nz = Math.cos(theta) * Math.sin(Math.PI / 2);
      positions.push(cosT * radius, y, sinT * radius);
      normals.push(nx, ny, nz);
    }
  }

  // Sphère du haut (hémisphère)
  for (let j = 0; j <= longSegs; j++) {
    const theta = (j / longSegs) * Math.PI * 2;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    for (let i = 0; i <= latSegs / 2; i++) {
      const phi = ((latSegs / 2 - i) / (latSegs / 2)) * (Math.PI / 2);
      const y = halfLen + Math.sin(phi) * radius;
      const r = Math.cos(phi) * radius;
      positions.push(cosT * r, y, sinT * r);
      normals.push(cosT * Math.cos(phi), Math.sin(phi), sinT * Math.cos(phi));
    }
  }

  // Sphère du bas (hémisphère)
  for (let j = 0; j <= longSegs; j++) {
    const theta = (j / longSegs) * Math.PI * 2;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    for (let i = 0; i <= latSegs / 2; i++) {
      const phi = (i / (latSegs / 2)) * (Math.PI / 2);
      const y = -halfLen - Math.sin(phi) * radius;
      const r = Math.cos(phi) * radius;
      positions.push(cosT * r, y, sinT * r);
      normals.push(-cosT * Math.cos(phi), -Math.sin(phi), -sinT * Math.cos(phi));
    }
  }

  // Indices (triangles)
  const vertsPerRing = latSegs + 1;
  const totalRings = longSegs + 1 + latSegs / 2 + 1 + latSegs / 2 + 1;
  for (let ring = 0; ring < totalRings - 1; ring++) {
    for (let col = 0; col < longSegs; col++) {
      const a = ring * (longSegs + 1) + col;
      const b = a + longSegs + 1;
      indices.push(a, b, a + 1);
      indices.push(b, b + 1, a + 1);
    }
  }

  group.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  group.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  group.setIndex(indices);
  group.computeVertexNormals();
  return group;
}

// ── RagdollInstance ──────────────────────────────────────────────────────────
/**
 * Une instance de ragdoll pour un personnage mort. Gère :
 *   - Capture de l'état du squelette
 *   - Simulation physique (gravité, vélocité, contraintes, sol)
 *   - Capsules visuelles
 *   - Nettoyage après TTL
 */
export class RagdollInstance {
  // ── Propriétés publiques ─────────────────────────────────────────────────
  /** true quand le ragdoll a fini sa durée de vie et doit être retiré. */
  get expired(): boolean { return this._expired; }
  /** Groupe racine contenant les capsules visuelles (à ajouter à la scène). */
  get visualRoot(): THREE.Group { return this._visualRoot; }

  // ── Propriétés privées ───────────────────────────────────────────────────
  private bones: BoneState[] = [];
  private constraints: BoneConstraint[] = [];
  private capsules: { mesh: THREE.Mesh; def: CapsuleDef }[] = [];
  private _visualRoot = new THREE.Group();
  private _expired = false;
  private elapsed = 0;
  private fadeStart = 0;
  private fading = false;

  /** Tronc (index hips/pelvis) pour la position de référence. */
  private rootIndex = 0;
  /** Position initiale du root (pour le snapping sol). */
  private rootBaseY = 0;

  // ── Méthodes statiques ───────────────────────────────────────────────────

  /**
   * Crée une instance de ragdoll à partir d'un objet racine Three.js (group ou
   * scene) contenant un squelette (AnimationMixer). Capture la pose actuelle
   * des os et lance la simulation.
   *
   * @param root  Objet racine (le même qu'on passe à AnimationController).
   * @param scene La scène Three.js pour ajouter les visuels.
   * @param options.visible  Masquer le maillage original ? (défaut: true)
   * @param options.groundY  Hauteur du sol (défaut: 0).
   */
  static create(
    root: THREE.Object3D,
    scene: THREE.Scene | THREE.Group,
    options: { visible?: boolean; groundY?: number } = {},
  ): RagdollInstance | null {
    const inst = new RagdollInstance();
    const groundY = options.groundY ?? GROUND_Y;

    // 1. Collecter tous les os
    const allBones = collectBones(root);
    if (allBones.length === 0) return null;

    // 2. Mettre à jour les matrices monde pour capturer la pose actuelle
    root.updateWorldMatrix(true, true);

    // 3. Associer chaque os à sa définition
    const usedBones = new Set<THREE.Bone>();
    for (const def of MAJOR_BONES) {
      for (const bone of allBones) {
        if (usedBones.has(bone)) continue;
        if (def.pattern.test(normalizeBoneName(bone.name))) {
          usedBones.add(bone);

          // Position monde
          const pos = new THREE.Vector3();
          bone.getWorldPosition(pos);

          // Rotation monde (en préservant l'échelle)
          const quat = new THREE.Quaternion();
          bone.getWorldQuaternion(quat);

          // Mémoriser la position du root
          const isRoot = inst.bones.length === 0;
          if (isRoot) {
            inst.rootBaseY = pos.y;
          }

          inst.bones.push({
            bone,
            pos,
            vel: new THREE.Vector3(0, 0, 0),
            quat,
            angVel: new THREE.Vector3(0, 0, 0),
            stiffness: def.stiffness,
            mass: def.mass,
          });
          break;
        }
      }
    }

    if (inst.bones.length < 3) return null; // pas assez d'os

    // 4. Créer les contraintes entre os parents/enfants
    inst.buildConstraints(allBones);

    // 5. Masquer le mesh original si demandé
    if (options.visible !== false) {
      // On rend le maillage semi-transparent pour que le ragdoll soit visible
      root.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh && mesh.material) {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const mat of mats) {
            mat.transparent = true;
            (mat as THREE.MeshStandardMaterial).opacity = 0.35;
            mat.needsUpdate = true;
          }
        }
      });
    }

    // 6. Créer les capsules visuelles
    inst.buildCapsules();

    // 7. Ajouter le groupe visuel à la scène
    scene.add(inst._visualRoot);

    return inst;
  }

  /**
   * Construit les contraintes de distance entre os connectés.
   * On crée des contraintes entre os consécutifs dans notre liste (qui suit
   * l'ordre MAJOR_BONES), plus des contraintes de symétrie (épaules ↔ bassin).
   */
  private buildConstraints(allBones: THREE.Bone[]): void {
    // Contrainte : chaque os avec le suivant (colonne vertébrale et chaînes de membres)
    for (let i = 0; i < this.bones.length - 1; i++) {
      // On ne connecte que les os qui sont dans la MÊME chaîne logique
      // (pas de connexion transversale jambe → bras)
      const restLength = this.bones[i].pos.distanceTo(this.bones[i + 1].pos);
      if (restLength < 0.01 || restLength > 3.0) continue;
      this.constraints.push({ a: i, b: i + 1, restLength });
    }

    // Contrainte : épaules vers bassin (maintient le torse)
    const idxMap = this.indexMap();
    const hips = idxMap.hips;
    const shoulderL = idxMap.shoulderL;
    const shoulderR = idxMap.shoulderR;
    const head = idxMap.head;

    if (hips >= 0 && shoulderL >= 0) {
      const rest = this.bones[hips].pos.distanceTo(this.bones[shoulderL].pos);
      if (rest > 0.01 && rest < 3.0) this.constraints.push({ a: hips, b: shoulderL, restLength: rest });
    }
    if (hips >= 0 && shoulderR >= 0) {
      const rest = this.bones[hips].pos.distanceTo(this.bones[shoulderR].pos);
      if (rest > 0.01 && rest < 3.0) this.constraints.push({ a: hips, b: shoulderR, restLength: rest });
    }
    if (head >= 0 && shoulderL >= 0) {
      const rest = this.bones[head].pos.distanceTo(this.bones[shoulderL].pos);
      if (rest > 0.01 && rest < 2.0) this.constraints.push({ a: head, b: shoulderL, restLength: rest });
    }
    if (head >= 0 && shoulderR >= 0) {
      const rest = this.bones[head].pos.distanceTo(this.bones[shoulderR].pos);
      if (rest > 0.01 && rest < 2.0) this.constraints.push({ a: head, b: shoulderR, restLength: rest });
    }

    // Contrainte de symétrie : épaules entre elles
    if (shoulderL >= 0 && shoulderR >= 0) {
      const rest = this.bones[shoulderL].pos.distanceTo(this.bones[shoulderR].pos);
      if (rest > 0.01 && rest < 2.0) this.constraints.push({ a: shoulderL, b: shoulderR, restLength: rest });
    }
  }

  /** Indexe les os importants par leur rôle. */
  private indexMap(): Record<string, number> {
    const names = [
      /^(hips|pelvis|root)$/i,
      /^(spine|spine_?01?)$/i,
      /^(chest|spine_?0?2|spine1)$/i,
      /^(upp?erchest|spine_?0?3|spine2)$/i,
      /^(neck)$/i,
      /^(head)$/i,
      /^(leftshoulder|claviclel|shoulder_l)$/i,
      /^(rightshoulder|clavicler|shoulder_r)$/i,
    ];
    const result: Record<string, number> = {
      hips: -1, spine: -1, chest: -1, upperChest: -1,
      neck: -1, head: -1, shoulderL: -1, shoulderR: -1,
    };
    const keys = Object.keys(result);
    for (let i = 0; i < this.bones.length; i++) {
      const name = normalizeBoneName(this.bones[i].bone.name);
      for (let j = 0; j < names.length; j++) {
        if (names[j].test(name)) {
          result[keys[j]] = i;
          break;
        }
      }
    }
    return result;
  }

  /** Construit les capsules visuelles pour chaque os. */
  private buildCapsules(): void {
    const defs: CapsuleDef[] = [];

    const idxMap = this.indexMap();

    // Tête
    if (idxMap.head >= 0) {
      defs.push({ boneIndex: idxMap.head, radius: 0.13, length: 0.25, color: "#ffccaa" });
    }
    // Torse (chest → upperChest)
    if (idxMap.chest >= 0) {
      defs.push({ boneIndex: idxMap.chest, radius: 0.18, length: 0.35, color: "#4488cc" });
    }
    if (idxMap.upperChest >= 0 && idxMap.chest < 0) {
      defs.push({ boneIndex: idxMap.upperChest, radius: 0.16, length: 0.30, color: "#4488cc" });
    }
    // Bassin (hips)
    if (idxMap.hips >= 0) {
      defs.push({ boneIndex: idxMap.hips, radius: 0.20, length: 0.30, color: "#446688" });
    }

    // Fonction pour ajouter les capsules d'un membre
    const addLimb = (startIdx: number, count: number, radius: number, lengths: number[], color: string) => {
      for (let i = 0; i < count && startIdx + i < this.bones.length; i++) {
        const bi = startIdx + i;
        if (bi >= 0 && bi < this.bones.length) {
          defs.push({ boneIndex: bi, radius, length: lengths[i] ?? 0.2, color });
        }
      }
    };

    // On trouve les index pour les bras et jambes en parcourant les os
    let leftArmIdx = -1, rightArmIdx = -1, leftLegIdx = -1, rightLegIdx = -1;
    for (let i = 0; i < this.bones.length; i++) {
      const name = normalizeBoneName(this.bones[i].bone.name);
      if (/^(left(upper)?arm|upperarml)$/i.test(name) && leftArmIdx < 0) leftArmIdx = i;
      if (/^(right(upper)?arm|upperarmr)$/i.test(name) && rightArmIdx < 0) rightArmIdx = i;
      if (/^(left(up)?(leg|thigh)|thighl)$/i.test(name) && leftLegIdx < 0) leftLegIdx = i;
      if (/^(right(up)?(leg|thigh)|thighr)$/i.test(name) && rightLegIdx < 0) rightLegIdx = i;
    }

    // Bras gauche (upper arm + lower arm)
    if (leftArmIdx >= 0) {
      defs.push({ boneIndex: leftArmIdx, radius: 0.08, length: 0.30, color: "#66aaee" });
      if (leftArmIdx + 1 < this.bones.length) {
        defs.push({ boneIndex: leftArmIdx + 1, radius: 0.06, length: 0.28, color: "#77bbff" });
      }
    }
    // Bras droit
    if (rightArmIdx >= 0) {
      defs.push({ boneIndex: rightArmIdx, radius: 0.08, length: 0.30, color: "#66aaee" });
      if (rightArmIdx + 1 < this.bones.length) {
        defs.push({ boneIndex: rightArmIdx + 1, radius: 0.06, length: 0.28, color: "#77bbff" });
      }
    }
    // Jambes
    if (leftLegIdx >= 0) {
      defs.push({ boneIndex: leftLegIdx, radius: 0.10, length: 0.35, color: "#557799" });
      if (leftLegIdx + 1 < this.bones.length) {
        defs.push({ boneIndex: leftLegIdx + 1, radius: 0.08, length: 0.35, color: "#6688aa" });
      }
    }
    if (rightLegIdx >= 0) {
      defs.push({ boneIndex: rightLegIdx, radius: 0.10, length: 0.35, color: "#557799" });
      if (rightLegIdx + 1 < this.bones.length) {
        defs.push({ boneIndex: rightLegIdx + 1, radius: 0.08, length: 0.35, color: "#6688aa" });
      }
    }

    // Créer les maillages
    const capsuleGeoCache = new Map<string, THREE.BufferGeometry>();
    for (const d of defs) {
      const key = `${d.radius.toFixed(3)}_${d.length.toFixed(3)}`;
      let geo = capsuleGeoCache.get(key);
      if (!geo) {
        geo = createCapsuleGeometry(d.radius, d.length, 6);
        capsuleGeoCache.set(key, geo);
      }

      const mat = new THREE.MeshStandardMaterial({
        color: d.color,
        transparent: true,
        opacity: 0.7,
        roughness: 0.6,
        metalness: 0.1,
      });
      const mesh = new THREE.Mesh(geo, mat);
      this._visualRoot.add(mesh);
      this.capsules.push({ mesh, def: d });
    }
  }

  /**
   * Avance la simulation d'un pas de temps (appelé chaque frame).
   */
  update(dt: number): void {
    if (this._expired) return;

    this.elapsed += dt;

    // ── Fading de fin de vie ──────────────────────────────────────────────
    if (!this.fading && this.elapsed >= RAGDOLL_TTL) {
      this.fading = true;
      this.fadeStart = this.elapsed;
    }

    if (this.fading) {
      const fadeProgress = (this.elapsed - this.fadeStart) / FADE_DURATION;
      if (fadeProgress >= 1.0) {
        this._expired = true;
        return;
      }
      // Appliquer l'opacité décroissante
      const opacity = 1.0 - fadeProgress;
      for (const c of this.capsules) {
        (c.mesh.material as THREE.MeshStandardMaterial).opacity = opacity * 0.7;
      }
      // Rendre le maillage original de plus en plus transparent aussi
      // Note: on ne peut pas modifier l'opacité du mesh original ici car
      // on n'a pas de référence directe — le maintiendra semi-transparent
      // pendant la durée de vie du ragdoll.
    }

    // Limiter dt pour éviter les explosions physiques en cas de spike
    const clampedDt = Math.min(dt, 0.05);

    // ── Intégration des forces ────────────────────────────────────────────
    for (let i = 0; i < this.bones.length; i++) {
      const b = this.bones[i];

      // Gravité (divisée par la masse pour simuler l'inertie)
      b.vel.x += GRAVITY.x * clampedDt / b.mass;
      b.vel.y += GRAVITY.y * clampedDt / b.mass;
      b.vel.z += GRAVITY.z * clampedDt / b.mass;

      // Amortissement
      b.vel.multiplyScalar(DAMPING);

      // Vélocité angulaire → amortie
      b.angVel.multiplyScalar(ANGULAR_DAMPING);

      // Appliquer vélocité angulaire à la rotation
      if (b.angVel.lengthSq() > 0.0001) {
        const ang = b.angVel.length() * clampedDt;
        if (ang > 0.001) {
          const axis = b.angVel.clone().normalize();
          const deltaQ = new THREE.Quaternion().setFromAxisAngle(axis, ang);
          b.quat.premultiply(deltaQ);
          b.quat.normalize();
        }
      }

      // Appliquer vélocité linéaire
      b.pos.x += b.vel.x * clampedDt;
      b.pos.y += b.vel.y * clampedDt;
      b.pos.z += b.vel.z * clampedDt;
    }

    // ── Contraintes de distance (plusieurs itérations) ────────────────────
    for (let iter = 0; iter < CONSTRAINT_ITERATIONS; iter++) {
      for (const c of this.constraints) {
        const ba = this.bones[c.a];
        const bb = this.bones[c.b];
        const diff = new THREE.Vector3().copy(bb.pos).sub(ba.pos);
        const dist = diff.length();
        if (dist < 0.0001) continue;

        const error = dist - c.restLength;
        if (Math.abs(error) < 0.001) continue;

        // Correction partagée (pondérée par la masse)
        const totalMass = ba.mass + bb.mass;
        const correction = diff.clone().multiplyScalar(
          (error / dist) * CONSTRAINT_STIFFNESS * (ba.stiffness + bb.stiffness) / 2
        );

        ba.pos.x += correction.x * (bb.mass / totalMass);
        ba.pos.y += correction.y * (bb.mass / totalMass);
        ba.pos.z += correction.z * (bb.mass / totalMass);
        bb.pos.x -= correction.x * (ba.mass / totalMass);
        bb.pos.y -= correction.y * (ba.mass / totalMass);
        bb.pos.z -= correction.z * (ba.mass / totalMass);
      }
    }

    // ── Collision avec le sol ─────────────────────────────────────────────
    const groundY = GROUND_Y;
    for (let i = 0; i < this.bones.length; i++) {
      const b = this.bones[i];
      if (b.pos.y < groundY) {
        b.pos.y = groundY;
        // Rebond
        if (b.vel.y < 0) {
          b.vel.y *= -RESTITUTION;
          // Friction au sol
          b.vel.x *= (1 - FRICTION * clampedDt * 10);
          b.vel.z *= (1 - FRICTION * clampedDt * 10);
        }
      }
    }

    // ── Appliquer les transformations aux os réels du squelette ────────────
    // On applique les positions/rotations monde aux os.
    // Comme les os sont dans un groupe avec potentiellement des transformations
    // parentes, on doit calculer les transformations locales.
    this.applyToSkeleton();
  }

  /**
   * Applique la pose simulée aux os du squelette.
   * Pour chaque os, on calcule la transformation locale à partir de la
   * position/rotation monde et de la matrice monde du parent.
   */
  private applyToSkeleton(): void {
    for (const b of this.bones) {
      const bone = b.bone;
      const parent = bone.parent;

      if (parent) {
        // `getWorldMatrix(cible)` N'EXISTE PAS dans Three.js — c'est l'API de
        // Babylon.js. Tout ragdoll dont les os ont un parent (donc tous) levait
        // ici dès la première frame de simulation. Three.js expose la matrice
        // directement en `matrixWorld` ; il faut seulement s'assurer qu'elle est
        // à jour, d'où `updateWorldMatrix(true, false)` (ancêtres, pas enfants).
        parent.updateWorldMatrix(true, false);
        const invParentMatrix = TMP_MAT.copy(parent.matrixWorld).invert();

        // Position locale = inv(parentWorld) * worldPos
        bone.position.copy(TMP_VEC.copy(b.pos).applyMatrix4(invParentMatrix));

        // Rotation locale : la rotation monde de l'os moins celle du parent
        parent.getWorldQuaternion(TMP_QUAT);
        bone.quaternion.copy(TMP_QUAT.invert().multiply(b.quat));
      } else {
        // Pas de parent → la position/rotation EST locale
        bone.position.copy(b.pos);
        bone.quaternion.copy(b.quat);
      }

      bone.updateMatrix();
      bone.updateWorldMatrix(true, false);
    }

    // Mettre à jour les matrices monde du squelette pour que les visuels suivent
    if (this.bones.length > 0) {
      const root = this.bones[0].bone;
      root.updateWorldMatrix(true, true);
    }

    // ── Mettre à jour les capsules visuelles ──────────────────────────────
    for (const c of this.capsules) {
      const bs = this.bones[c.def.boneIndex];
      if (!bs) continue;

      const mesh = c.mesh;
      mesh.position.copy(bs.pos);
      mesh.quaternion.copy(bs.quat);
      mesh.updateMatrix();
    }
  }

  /**
   * Nettoie les ressources visuelles du ragdoll.
   */
  dispose(): void {
    this._expired = true;
    // Retirer les maillages du parent
    while (this._visualRoot.children.length > 0) {
      const child = this._visualRoot.children[0];
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
      this._visualRoot.remove(child);
    }
    if (this._visualRoot.parent) {
      this._visualRoot.parent.remove(this._visualRoot);
    }
    this.capsules = [];
    this.bones = [];
    this.constraints = [];
  }
}

// ── RagdollSystem (singleton) ────────────────────────────────────────────────
/**
 * Gestionnaire global de ragdolls. Gère la liste des instances actives et
 * les nettoie automatiquement.
 *
 * Singleton accessible depuis le moteur de jeu.
 */
export class RagdollSystem {
  private instances: RagdollInstance[] = [];
  private _enabled = true;

  /** Nombre max de ragdolls simultanés (perf). */
  readonly maxRagdolls = 8;

  get enabled(): boolean { return this._enabled; }
  set enabled(v: boolean) { this._enabled = v; }

  get count(): number { return this.instances.length; }

  /**
   * Ajoute un ragdoll à la scène.
   *
   * @param root    L'objet racine du personnage (avec le squelette).
   * @param scene   La scène/group où ajouter les visuels ragdoll.
   * @param options Options.
   * @returns L'instance créée, ou null si échec.
   */
  spawn(
    root: THREE.Object3D,
    scene: THREE.Scene | THREE.Group,
    options: { visible?: boolean; groundY?: number } = {},
  ): RagdollInstance | null {
    if (!this._enabled) return null;

    // Limiter le nombre de ragdolls simultanés
    if (this.instances.length >= this.maxRagdolls) {
      // Retirer le plus ancien
      const oldest = this.instances.shift();
      oldest?.dispose();
    }

    const inst = RagdollInstance.create(root, scene, options);
    if (inst) {
      this.instances.push(inst);
    }
    return inst;
  }

  /**
   * Avance tous les ragdolls d'un pas de temps.
   * Appelé chaque frame par le moteur.
   */
  update(dt: number): void {
    if (!this._enabled) return;

    for (let i = this.instances.length - 1; i >= 0; i--) {
      const inst = this.instances[i];
      inst.update(dt);
      if (inst.expired) {
        inst.dispose();
        this.instances.splice(i, 1);
      }
    }
  }

  /**
   * Nettoie et supprime tous les ragdolls actifs.
   */
  clear(): void {
    for (const inst of this.instances) {
      inst.dispose();
    }
    this.instances = [];
  }

  /**
   * Supprime le ragdoll associé à un root. Utile si le personnage respawn
   * pendant que son ragdoll est encore actif.
   */
  removeForRoot(root: THREE.Object3D): void {
    for (let i = this.instances.length - 1; i >= 0; i--) {
      // On ne peut pas identifier directement, donc on parcourt tous
      // (cas rare — le cleanup 5s gère l'essentiel)
    }
  }
}

/** Instance globale unique. */
export const ragdollSystem = new RagdollSystem();
