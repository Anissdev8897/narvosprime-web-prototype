// ══════════════════════════════════════════════════════════════════════════════
// runtime/CollisionWorld.ts — Collision hybride WASM + Three.js
//
// Singleton. Quand WASM est chargé et activé :
//   • isBlocked         → WASM SegmentBlocked (AABB broadphase, 10× pour l'IA)
//   • registerScene/add → dual-register Three.js BVH + WASM AABBs
//   • clear             → nettoie les deux systèmes
//
// Quand WASM n'est pas chargé → fallback pur Three.js (identique à l'ancien).
// getGroundY / resolveCameraPosition / raycastPoint → TOUJOURS Three.js BVH
// (précision triangulaire + filtrage par normale indispensables).
// ══════════════════════════════════════════════════════════════════════════════

import * as THREE from "three";
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from "three-mesh-bvh";
import { getEngine, isEngineLoaded } from "../wasm/WasmBridge";
import { batchRegisterSceneColliders, registerMeshCollider } from "../wasm/PhysicsSync";

// ── Accélération BVH globale des raycasts (anti micro-freeze) ────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(THREE.BufferGeometry.prototype as any).computeBoundsTree = computeBoundsTree;
(THREE.BufferGeometry.prototype as any).disposeBoundsTree = disposeBoundsTree;
(THREE.Mesh.prototype as any).raycast = acceleratedRaycast;

const TMP_NORMAL = new THREE.Vector3();

/**
 * Distance verticale de recherche du sol, en unités monde.
 *
 * Doit dépasser la plus grande chute plausible d'une map. La Forge s'étend sur
 * plusieurs centaines d'unités sous son point d'apparition ; 1000 couvre ça
 * largement sans jamais devenir un plafond implicite.
 */
const GROUND_SEARCH_DEPTH = 1000;

/**
 * Portée d'un pick depuis la caméra (éditeurs, gizmos de placement).
 *
 * Même valeur que `GROUND_SEARCH_DEPTH`, mais ce n'est PAS la même grandeur : ici
 * on part de la caméra le long du rayon de la souris, pas du ciel vers le bas. Les
 * séparer évite qu'un réglage de l'un déplace l'autre par accident — l'éditeur
 * Forge cadre parfois de très loin, la recherche de sol jamais.
 */
const PICK_MAX_DISTANCE = 1000;

/**
 * Distance minimale absolue entre la tête et la caméra TPS, en unités monde.
 *
 * Dernier rempart quand la géométrie est TRÈS proche (dos au mur, plafond bas) :
 * la caméra se rapproche jusqu'ici, puis s'arrête. À cette distance la vue est
 * quasi subjective — c'est laid, mais on voit la scène. Traverser le mur, non.
 */
const CAMERA_MIN_CLEARANCE = 0.15;

/**
 * Résultat d'un `pickSurface`. Voir la méthode pour le détail des trois états.
 *
 *   hit   → une surface a été touchée ; `normal` est en espace monde (ou `null`
 *           si l'intersection ne porte pas de face).
 *   miss  → le monde est peuplé, mais le rayon ne rencontre rien.
 *   empty → aucun collider enregistré : on ne sait RIEN. Ne pas traiter comme
 *           un `miss` — c'est ce raccourci qui produit le bug M1.
 */
export type SurfacePick =
  | { status: "hit"; point: THREE.Vector3; normal: THREE.Vector3 | null; object: THREE.Object3D }
  | { status: "miss" }
  | { status: "empty" };

function ensureBoundsTree(mesh: THREE.Mesh): void {
  const geo = mesh.geometry as THREE.BufferGeometry & { boundsTree?: unknown };
  if (geo && !geo.boundsTree && geo.attributes?.position) {
    geo.computeBoundsTree();
  }
}

class CollisionWorld {
  private colliders: THREE.Object3D[] = [];
  // Jeu miroir pour O(1) lookup (évite Array.includes/indexOf O(n)).
  private colliderSet: Set<THREE.Object3D> = new Set();
  private raycaster = new THREE.Raycaster();
  private downVec = new THREE.Vector3(0, -1, 0);
  private tmpDir = new THREE.Vector3();
  private _wasmEnabled = false;
  private _wasmColliderSeq = 90000;

  enableWasm(): void { this._wasmEnabled = true; }
  disableWasm(): void { this._wasmEnabled = false; }
  get wasmActive(): boolean { return this._wasmEnabled && isEngineLoaded(); }

  registerScene(root: THREE.Object3D, opts?: { filter?: (o: THREE.Object3D) => boolean }) {
    // ── Nettoie l'ancien monde de collision avant de peupler le nouveau ──
    this.clear();
    this.colliders = [];
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (obj.userData?.noCollide) return;
      if (opts?.filter && !opts.filter(obj)) return;
      ensureBoundsTree(mesh);
      this.colliders.push(obj);
      this.colliderSet.add(obj);
    });

    if (this.wasmActive) {
      const engine = getEngine();
      if (engine) {
        engine.clearColliders();
        this._wasmColliderSeq = 90000;
        batchRegisterSceneColliders(root, opts?.filter);
        this._wasmColliderSeq += this.colliders.length;
      }
    }
  }

  clear() {
    // Libère les BVH avant de vider le tableau
    for (const c of this.colliders) {
      const m = c as THREE.Mesh;
      if (m.isMesh && m.geometry) {
        const geo = m.geometry as THREE.BufferGeometry & { boundsTree?: { dispose?: () => void } };
        if (geo.boundsTree) {
          try { (geo as any).disposeBoundsTree?.(); } catch {}
        }
      }
    }
    this.colliders = [];
    this.colliderSet.clear();
    if (this.wasmActive) {
      getEngine()?.clearColliders();
      this._wasmColliderSeq = 90000;
    }
  }

  remove(mesh: THREE.Object3D): void {
    const i = this.colliders.indexOf(mesh);
    if (i >= 0) this.colliders.splice(i, 1);
  }

  add(mesh: THREE.Object3D): void {
    // `add` est appelé depuis des traversées de scène et des manifestes : un
    // nœud absent doit être ignoré, pas faire tomber toute l'indexation.
    if (!mesh) return;
    const m = mesh as THREE.Mesh;
    if (!m.isMesh) return;
    if (mesh.userData?.noCollide) return;
    if (this.colliders.includes(mesh)) return;
    ensureBoundsTree(m);
    this.colliders.push(mesh);

    if (this.wasmActive) {
      registerMeshCollider(this._wasmColliderSeq++, mesh);
    }
  }

  isBlocked(from: THREE.Vector3, delta: THREE.Vector3, radius = 0.35): boolean {
    const len = delta.length();
    if (len < 0.001) return false;

    if (this.wasmActive) {
      const engine = getEngine();
      if (engine) {
        const invLen = 1 / len;
        const dx = delta.x * invLen;
        const dy = delta.y * invLen;
        const dz = delta.z * invLen;
        const reach = len + radius;
        return engine.isSegmentBlocked(
          from.x, from.y, from.z,
          from.x + dx * reach, from.y + dy * reach, from.z + dz * reach,
        );
      }
    }

    this.tmpDir.copy(delta).divideScalar(len);
    this.raycaster.set(from, this.tmpDir);
    this.raycaster.far = len + radius;
    this.raycaster.firstHitOnly = true;
    return this.raycaster.intersectObjects(this.colliders, false).length > 0;
  }

  /**
   * Pick le long d'un rayon — le point d'entrée des ÉDITEURS (Forge, gizmos).
   *
   * ── POURQUOI TROIS ÉTATS ET PAS `Point | null` ───────────────────────────────
   *
   * `raycastPoint` rend `null` pour deux situations opposées : le rayon n'a rien
   * touché, ou AUCUN collider n'est enregistré. Un éditeur qui confond les deux
   * repose l'objet sur son plan de secours — historiquement y = 0. Sur la Forge,
   * dont le sol est à plusieurs dizaines d'unités sous zéro, ça donne des objets
   * qui flottent au-dessus du terrain (bug M1). Le monde de collision se peuple de
   * façon asynchrone (`ForgeMapBackdrop`, `ForgeBuiltMap`, `TerrainMesh` appellent
   * `add()` au fil des chargements) : cliquer avant la fin est un cas NORMAL, pas
   * une erreur. L'appelant doit pouvoir attendre au lieu de deviner.
   *
   * `normal` est en espace MONDE. `face.normal` est local : le rendre tel quel
   * donnerait une orientation fausse dès que le mesh porte une rotation ou une
   * échelle — c'est-à-dire presque toujours. Elle vaut `null` quand l'intersection
   * ne porte pas de face ; il y a alors un point, mais aucune orientation à en
   * tirer.
   *
   * @param maxDistance portée du rayon ; par défaut `PICK_MAX_DISTANCE`.
   */
  pickSurface(
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    maxDistance = PICK_MAX_DISTANCE,
  ): SurfacePick {
    if (this.colliders.length === 0) return { status: "empty" };

    this.raycaster.set(origin, dir);
    this.raycaster.far = maxDistance;
    this.raycaster.firstHitOnly = true;
    const hit = this.raycaster.intersectObjects(this.colliders, false)[0];
    if (!hit) return { status: "miss" };

    const normal = hit.face
      ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize()
      : null;

    return { status: "hit", point: hit.point.clone(), normal, object: hit.object };
  }

  /**
   * Variante compacte de `pickSurface` — ne rend que le point.
   *
   * Conservée telle quelle : quatre gizmos de placement s'appuient dessus
   * (`NpcPlacementGizmo`, `HarvestPlacementGizmo`, `PortalPlacementGizmo`,
   * `SpawnPointGizmo`) plus la détection d'escalade de `PlayerRig`. Préférer
   * `pickSurface` dans tout code neuf : `null` n'y distingue pas « rien sous le
   * curseur » de « monde de collision vide ».
   */
  raycastPoint(origin: THREE.Vector3, dir: THREE.Vector3): THREE.Vector3 | null {
    const pick = this.pickSurface(origin, dir);
    return pick.status === "hit" ? pick.point : null;
  }

  /**
   * Nom du matériau du sol sous (x, z) — utilisé par le système de bruits de pas
   * pour choisir la catégorie de surface (herbe, métal, pierre…).
   *
   * Toujours Three.js : il faut le TRIANGLE touché pour remonter à son matériau,
   * information que la broadphase AABB du WASM ne porte pas. Même raison que
   * `getGroundY` / `resolveCameraPosition`.
   *
   * `firstHitOnly = true` : contrairement à `getGroundY`, on ne filtre pas par
   * normale — la première surface rencontrée en descendant EST celle sur
   * laquelle le pied se pose.
   *
   * Les deux noms sont rendus SÉPARÉMENT et non fusionnés : beaucoup de GLB
   * laissent le matériau anonyme alors que le nœud porte un nom parlant
   * ("Rock_01", "Metal_Floor"). C'est à l'appelant de décider de son ordre de
   * préférence — `footstepSystem` essaie le matériau puis le mesh.
   *
   * @returns `{ materialName, meshName }`, ou `null` si aucun sol sous ce point.
   */
  getGroundMaterial(
    x: number,
    z: number,
    fromHeight = 100,
  ): { materialName: string; meshName: string } | null {
    this.raycaster.set(new THREE.Vector3(x, fromHeight, z), this.downVec);
    this.raycaster.far = GROUND_SEARCH_DEPTH;
    this.raycaster.firstHitOnly = true;

    const hit = this.raycaster.intersectObjects(this.colliders, false)[0];
    if (!hit) return null;

    // Un mesh peut porter un tableau de matériaux (un par groupe de géométrie) ;
    // `intersection.face.materialIndex` désigne alors le bon. Sans ce détour, un
    // sol multi-matériaux renverrait toujours le premier — donc un seul son de
    // pas pour toute la map.
    const mesh = hit.object as THREE.Mesh;
    const mat = Array.isArray(mesh.material)
      ? mesh.material[hit.face?.materialIndex ?? 0]
      : mesh.material;

    return { materialName: mat?.name ?? "", meshName: mesh.name ?? "" };
  }

  getGroundY(
    x: number,
    z: number,
    fromHeight = 100,
    maxAboveY?: number,
  ): number | null {
    this.raycaster.set(new THREE.Vector3(x, fromHeight, z), this.downVec);
    // PROFONDEUR DE RECHERCHE, PAS UN PLANCHER MONDE.
    //
    // C'était `fromHeight + 60`, ce qui n'est pas une distance : c'est un
    // plancher absolu à y = -60, où que l'on soit. Tant que les maps vivaient
    // autour de zéro personne ne l'a vu. La Forge porte un offset de -401 : sous
    // -60, plus AUCUN sol n'était détecté, donc chute libre et renvoi au point
    // d'apparition — le « trigger » que le joueur décrivait.
    //
    // Et sous fromHeight = -60 la formule rendait un `far` NÉGATIF : le raycast
    // ne renvoie alors plus jamais rien, sans erreur ni avertissement.
    //
    // Une distance fixe et généreuse n'a aucun de ces deux défauts, et son coût
    // est nul : le BVH ne visite que les nœuds effectivement traversés.
    this.raycaster.far = GROUND_SEARCH_DEPTH;
    this.raycaster.firstHitOnly = false;
    const hits = this.raycaster.intersectObjects(this.colliders, false);

    const worldNormal = TMP_NORMAL;
    for (const h of hits) {
      if (!h.face) continue;
      if (maxAboveY !== undefined && h.point.y > maxAboveY) continue;
      worldNormal.copy(h.face.normal).transformDirection(h.object.matrixWorld);
      if (worldNormal.y > 0.5) {
        return h.point.y;
      }
    }
    return null;
  }

  resolveCameraPosition(
    head: THREE.Vector3,
    desired: THREE.Vector3,
    minDist = 0.5,
    padding = 0.25
  ): THREE.Vector3 {
    const delta = desired.clone().sub(head);
    const dist = delta.length();
    if (dist < 0.001) return desired.clone();
    const dir = delta.normalize();
    this.raycaster.firstHitOnly = true;

    this.raycaster.set(head, dir);
    this.raycaster.far = dist;
    const hits = this.raycaster.intersectObjects(this.colliders, false);
    if (!hits.length) return desired.clone();

    const altDesired = desired.clone();
    altDesired.y = head.y + (desired.y - head.y) * 0.3;
    const altDelta = altDesired.clone().sub(head);
    const altDist = altDelta.length();
    if (altDist > 0.001) {
      const altDir = altDelta.clone().normalize();
      this.raycaster.set(head, altDir);
      this.raycaster.far = altDist;
      const altHits = this.raycaster.intersectObjects(this.colliders, false);
      if (!altHits.length) return altDesired;
    }

    // BORNE DE CONFORT ≠ AUTORISATION DE TRAVERSER.
    //
    // C'était `Math.max(minDist, hits[0].distance - padding)`. `minDist` est un
    // plancher de confort (ne pas coller à la tête du joueur) ; l'écrire en
    // `max` lui donne le dernier mot sur la géométrie. Quand le sol est touché
    // à 1,16 m et que minDist vaut 2,0, la fonction renvoie 2,0 : elle POUSSE
    // la caméra à travers le sol au lieu de l'en empêcher. C'est l'origine
    // mesurée du P0 « TPS écran noir » (caméra à −28,83 pour un sol à −26).
    //
    // Le point d'impact est une contrainte dure : on ne le dépasse jamais. Le
    // confort ne s'applique que dans la marge restante.
    // Le point d'impact est une contrainte DURE : on ne le dépasse jamais.
    // `minDist` n'est volontairement plus consulté ici — un plancher de confort
    // n'a aucun moyen d'être honoré quand la géométrie est plus proche que lui,
    // sinon en traversant. Il reste dans la signature pour les appelants, mais
    // seul CAMERA_MIN_CLEARANCE (garde anti-valeur-négative) borne le résultat.
    const blocked = hits[0].distance - padding;
    const safe = Math.max(CAMERA_MIN_CLEARANCE, blocked);
    return head.clone().add(dir.multiplyScalar(safe));
  }

  /**
   * Racine de la scène 3D, déduite du premier collider enregistré.
   *
   * `colliders` reste privé — personne d'autre ne doit muter la liste. Mais un
   * diagnostic a besoin de PARCOURIR la scène pour dire si le mesh d'une entité
   * y est présent, et c'est le seul point du code qui en tienne une référence.
   */
  sceneRoot(): THREE.Object3D | null {
    const first = this.colliders[0];
    if (!first) return null;
    let o: THREE.Object3D = first;
    while (o.parent) o = o.parent;
    return o;
  }

  get colliderCount(): number {
    return this.colliders.length;
  }

  computeBounds(): THREE.Box3 {
    const box = new THREE.Box3();
    for (const obj of this.colliders) {
      const m = obj as THREE.Mesh;
      if (!m.geometry) continue;
      m.geometry.computeBoundingBox();
      if (!m.geometry.boundingBox) continue;
      const b = m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld);
      box.union(b);
    }
    return box;
  }
}

export const collisionWorld = new CollisionWorld();
