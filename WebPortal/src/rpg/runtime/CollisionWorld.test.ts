// Tests exhaustifs de CollisionWorld (BVH, fallbacks, edge cases).
// CollisionWorld est du TS pur avec Three.js BVH — testé avec de vraies
// géométries Box pour exercer les raycasts réels.

import { describe, it, expect, beforeEach } from "vitest";
import * as THREE from "three";
import { collisionWorld } from "./CollisionWorld";

/** Mesh boîte avec BVH, positionné dans la scène. */
function makeBox(w: number, h: number, d: number, pos: [number, number, number] = [0, 0, 0]): THREE.Mesh {
  const g = new THREE.BoxGeometry(w, h, d);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial());
  m.position.set(...pos);
  m.updateMatrixWorld(true);
  return m;
}

/** Crée une scène avec un sol plat à y=0 et l'enregistre. */
function setupGround(y = 0): void {
  const root = new THREE.Group();
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1000, 1000),
    new THREE.MeshBasicMaterial(),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, y, 0);
  ground.updateMatrixWorld(true);
  root.add(ground);
  root.updateMatrixWorld(true);
  collisionWorld.registerScene(root);
}

describe("CollisionWorld — cycle de vie", () => {
  beforeEach(() => collisionWorld.clear());

  it("démarre avec 0 colliders", () => {
    expect(collisionWorld.colliderCount).toBe(0);
  });

  it("registerScene peuple les colliders et le Set", () => {
    const root = new THREE.Group();
    root.add(makeBox(1, 1, 1));
    root.add(makeBox(2, 2, 2, [5, 0, 0]));
    root.updateMatrixWorld(true);
    collisionWorld.registerScene(root);
    expect(collisionWorld.colliderCount).toBe(2);
  });

  it("ignore les objets marqués noCollide", () => {
    const root = new THREE.Group();
    const m = makeBox(1, 1, 1);
    m.userData.noCollide = true;
    root.add(m);
    root.add(makeBox(2, 2, 2, [5, 0, 0]));
    root.updateMatrixWorld(true);
    collisionWorld.registerScene(root);
    expect(collisionWorld.colliderCount).toBe(1);
  });

  it("add ajoute un mesh et dédoublonne via le Set", () => {
    const m = makeBox(1, 1, 1);
    collisionWorld.add(m);
    expect(collisionWorld.colliderCount).toBe(1);
    collisionWorld.add(m); // doublon → ignoré
    expect(collisionWorld.colliderCount).toBe(1);
  });

  it("add ignore les non-Mesh (Group, Light…)", () => {
    const g = new THREE.Group();
    collisionWorld.add(g);
    expect(collisionWorld.colliderCount).toBe(0);
    // test de robustesse : add(undefined)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    collisionWorld.add(null as any);
    expect(collisionWorld.colliderCount).toBe(0);
  });

  it("add ignore les meshes marqués noCollide", () => {
    const m = makeBox(1, 1, 1);
    m.userData.noCollide = true;
    collisionWorld.add(m);
    expect(collisionWorld.colliderCount).toBe(0);
  });

  it("remove retire du Set ET du tableau", () => {
    const m = makeBox(1, 1, 1);
    collisionWorld.add(m);
    expect(collisionWorld.colliderCount).toBe(1);
    collisionWorld.remove(m);
    expect(collisionWorld.colliderCount).toBe(0);
    // remove d'un mesh absent ne casse rien
    collisionWorld.remove(m);
    expect(collisionWorld.colliderCount).toBe(0);
  });

  it("clear vide tout", () => {
    const root = new THREE.Group();
    root.add(makeBox(1, 1, 1));
    root.updateMatrixWorld(true);
    collisionWorld.registerScene(root);
    expect(collisionWorld.colliderCount).toBe(1);
    collisionWorld.clear();
    expect(collisionWorld.colliderCount).toBe(0);
  });

  it("sceneRoot remonte jusqu'à la racine", () => {
    const root = new THREE.Group();
    const child = new THREE.Group();
    const m = makeBox(1, 1, 1);
    child.add(m);
    root.add(child);
    root.updateMatrixWorld(true);
    collisionWorld.registerScene(root);
    expect(collisionWorld.sceneRoot()).toBe(root);
  });

  it("sceneRoot rend null quand aucun collider n'est enregistré", () => {
    expect(collisionWorld.sceneRoot()).toBeNull();
  });
});

describe("CollisionWorld — isBlocked (collision mur)", () => {
  beforeEach(() => collisionWorld.clear());

  it("renvoie false sans collider", () => {
    expect(collisionWorld.isBlocked(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(1, 0, 0),
    )).toBe(false);
  });

  it("renvoie false pour un delta quasi nul (len < 0.001)", () => {
    setupGround();
    expect(collisionWorld.isBlocked(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, 0, 0.0001),
    )).toBe(false);
  });

  it("détecte un mur vertical devant le joueur", () => {
    const root = new THREE.Group();
    const wall = makeBox(10, 5, 0.5, [0, 0, -2]);
    root.add(wall);
    root.updateMatrixWorld(true);
    collisionWorld.registerScene(root);

    // Depuis (0,0,0), avancer vers (0,0,-2) → bloqué
    expect(collisionWorld.isBlocked(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -3),
    )).toBe(true);

    // Depuis (0,0,0), avancer vers +z → libre
    expect(collisionWorld.isBlocked(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 3),
    )).toBe(false);
  });

  it("le radius étend la portée du rayon (anti-pénétration)", () => {
    const root = new THREE.Group();
    // Mur fin à x=5, traversant en z. Le joueur va de (0,0,0) vers (5,0,0).
    const wall = makeBox(0.5, 5, 100, [5, 0, 0]);
    root.add(wall);
    root.updateMatrixWorld(true);
    collisionWorld.registerScene(root);

    const from = new THREE.Vector3(0, 0, 0);
    // delta = (4.5, 0, 0) : le segment finit à x=4.5, juste AVANT le mur à x=5
    // (half-extent x=0.25 → face avant à x=4.75)
    const shortDelta = new THREE.Vector3(4.5, 0, 0);

    // radius=0 : le segment court de x=0 à x=4.5. La face avant du mur est à
    // x=4.75 → pas d'intersection.
    expect(collisionWorld.isBlocked(from, shortDelta, 0)).toBe(false);

    // radius=0.5 : le segment s'étend de x=0 à x=4.5+0.5=5.0 → il touche
    // le mur dont la face avant est à x=4.75. Le personnage (sphère de rayon
    // 0.5) serait bloqué avant d'atteindre la destination.
    expect(collisionWorld.isBlocked(from, shortDelta, 0.5)).toBe(true);
  });

  it("ne détecte PAS un mur hors de portée (ray non intersecté)", () => {
    const root = new THREE.Group();
    const wall = makeBox(1, 5, 10, [100, 0, 0]); // loin à droite
    root.add(wall);
    root.updateMatrixWorld(true);
    collisionWorld.registerScene(root);

    // On avance vers l'avant (z-), on ne devrait pas toucher le mur à x=100
    expect(collisionWorld.isBlocked(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -3),
    )).toBe(false);
  });
});

describe("CollisionWorld — getGroundY (détection du sol)", () => {
  beforeEach(() => collisionWorld.clear());

  it("renvoie null sans collider", () => {
    expect(collisionWorld.getGroundY(0, 0, 100)).toBeNull();
  });

  it("trouve un sol plat à y = 0", () => {
    setupGround(0);
    const ground = collisionWorld.getGroundY(0, 0, 100);
    expect(ground).toBeCloseTo(0, 1);
  });

  it("trouve un sol décalé en Y", () => {
    setupGround(-50);
    const ground = collisionWorld.getGroundY(0, 0, 100);
    expect(ground).toBeCloseTo(-50, 1);
  });

  it("filtre les faces orientées vers le bas (normale y < 0.5)", () => {
    const root = new THREE.Group();
    // Plafond (normale vers le bas)
    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100),
      new THREE.MeshBasicMaterial(),
    );
    ceiling.rotation.x = Math.PI / 2; // normale = (0, -1, 0) → y < 0.5
    ceiling.position.set(0, 5, 0);
    ceiling.updateMatrixWorld(true);
    root.add(ceiling);
    // Sol
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100),
      new THREE.MeshBasicMaterial(),
    );
    ground.rotation.x = -Math.PI / 2; // normale = (0, 1, 0)
    ground.position.set(0, 0, 0);
    ground.updateMatrixWorld(true);
    root.add(ground);
    root.updateMatrixWorld(true);
    collisionWorld.registerScene(root);

    const y = collisionWorld.getGroundY(0, 0, 100);
    // Doit trouver le sol à 0, pas le plafond à 5
    expect(y).toBeCloseTo(0, 1);
  });

  it("respecte maxAboveY — ignore les étages supérieurs", () => {
    const root = new THREE.Group();
    // Étage supérieur à y=10
    const upper = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100),
      new THREE.MeshBasicMaterial(),
    );
    upper.rotation.x = -Math.PI / 2;
    upper.position.set(0, 10, 0);
    upper.updateMatrixWorld(true);
    root.add(upper);
    // Sol à y=0
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100),
      new THREE.MeshBasicMaterial(),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, 0);
    ground.updateMatrixWorld(true);
    root.add(ground);
    root.updateMatrixWorld(true);
    collisionWorld.registerScene(root);

    // maxAboveY = 5 : ignore l'étage à 10, trouve le sol à 0
    const y = collisionWorld.getGroundY(0, 0, 100, 5);
    expect(y).toBeCloseTo(0, 1);
  });

  it("renvoie null si aucune face n'a une normale vers le haut", () => {
    const root = new THREE.Group();
    // Uniquement un plafond
    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100),
      new THREE.MeshBasicMaterial(),
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, 5, 0);
    ceiling.updateMatrixWorld(true);
    root.add(ceiling);
    root.updateMatrixWorld(true);
    collisionWorld.registerScene(root);

    expect(collisionWorld.getGroundY(0, 0, 100)).toBeNull();
  });

  it("la profondeur de recherche est GROUND_SEARCH_DEPTH, pas fromHeight", () => {
    // Test que le raycast descend bien de 1000 unités (GROUND_SEARCH_DEPTH),
    // pas de fromHeight. On place le sol à -800 : avec fromHeight=100 et
    // far=1000, le rayon parcourt de y=100 à y=-900 → atteint le sol à -800.
    setupGround(-800);
    const y = collisionWorld.getGroundY(0, 0, 100);
    // Le sol est à -800 : le raycast (de y=100 vers le bas, far=1000)
    // descend jusqu'à y=-900 et touche bien le sol.
    expect(y).toBeCloseTo(-800, 1);
  });
});

describe("CollisionWorld — raycastPoint", () => {
  beforeEach(() => collisionWorld.clear());

  it("renvoie null sans collider", () => {
    expect(collisionWorld.raycastPoint(
      new THREE.Vector3(0, 10, 0),
      new THREE.Vector3(0, -1, 0),
    )).toBeNull();
  });

  it("renvoie le point d'impact exact", () => {
    setupGround(0);
    const hit = collisionWorld.raycastPoint(
      new THREE.Vector3(0, 10, 0),
      new THREE.Vector3(0, -1, 0),
    );
    expect(hit).not.toBeNull();
    expect(hit!.y).toBeCloseTo(0, 1);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// pickSurface — le point d'entrée des éditeurs (M1)
//
// Ce que `raycastPoint` ne peut pas dire : la différence entre « le rayon n'a
// rien touché » et « aucun collider n'est enregistré ». Un éditeur qui confond
// les deux repose l'objet sur y = 0 — sur la Forge, dont le sol est bien plus
// bas, l'objet flotte. C'est le bug M1.
// ══════════════════════════════════════════════════════════════════════════════

describe("CollisionWorld — pickSurface", () => {
  beforeEach(() => collisionWorld.clear());

  const DOWN = () => new THREE.Vector3(0, -1, 0);
  const FROM_SKY = () => new THREE.Vector3(0, 10, 0);

  it("distingue un monde VIDE d'un rayon qui rate", () => {
    // Monde vide : on ne sait rien.
    expect(collisionWorld.pickSurface(FROM_SKY(), DOWN()).status).toBe("empty");

    // Monde peuplé mais le rayon part vers le haut : on sait qu'il n'y a rien.
    setupGround(0);
    expect(collisionWorld.pickSurface(FROM_SKY(), new THREE.Vector3(0, 1, 0)).status)
      .toBe("miss");
  });

  it("rend le point d'impact exact, sol très en dessous de zéro", () => {
    // Le cas Forge : un sol loin sous l'origine. Un repli sur y = 0 donnerait 0.
    setupGround(-51);
    const pick = collisionWorld.pickSurface(FROM_SKY(), DOWN());

    expect(pick.status).toBe("hit");
    if (pick.status !== "hit") return;
    expect(pick.point.y).toBeCloseTo(-51, 1);
    expect(pick.point.y).not.toBeCloseTo(0, 1);
  });

  it("rend la normale en espace MONDE, pas la normale locale de la face", () => {
    // `setupGround` pose un PlaneGeometry pivoté de -PI/2 sur X.
    // Normale LOCALE d'un PlaneGeometry : (0, 0, 1).
    // Après rotation : (0, 1, 0).
    // Rendre `face.normal` brut donnerait (0, 0, 1) — une orientation fausse dès
    // que le mesh porte une rotation ou une échelle, donc presque toujours.
    setupGround(0);
    const pick = collisionWorld.pickSurface(FROM_SKY(), DOWN());

    expect(pick.status).toBe("hit");
    if (pick.status !== "hit") return;
    expect(pick.normal).not.toBeNull();
    expect(pick.normal!.y).toBeCloseTo(1, 3);
    expect(pick.normal!.z).toBeCloseTo(0, 3);
  });

  it("rend l'objet touché", () => {
    setupGround(0);
    const pick = collisionWorld.pickSurface(FROM_SKY(), DOWN());

    expect(pick.status).toBe("hit");
    if (pick.status !== "hit") return;
    expect((pick.object as THREE.Mesh).isMesh).toBe(true);
  });

  it("respecte maxDistance", () => {
    setupGround(0); // sol à 10 unités sous l'origine du rayon
    expect(collisionWorld.pickSurface(FROM_SKY(), DOWN(), 5).status).toBe("miss");
    expect(collisionWorld.pickSurface(FROM_SKY(), DOWN(), 20).status).toBe("hit");
  });

  it("raycastPoint garde son comportement (4 gizmos en dépendent)", () => {
    // Non-régression : `raycastPoint` délègue désormais à `pickSurface`, mais
    // NpcPlacementGizmo / HarvestPlacementGizmo / PortalPlacementGizmo /
    // SpawnPointGizmo et PlayerRig attendent toujours `Vector3 | null`.
    expect(collisionWorld.raycastPoint(FROM_SKY(), DOWN())).toBeNull(); // vide

    setupGround(-51);
    expect(collisionWorld.raycastPoint(FROM_SKY(), new THREE.Vector3(0, 1, 0)))
      .toBeNull(); // rate
    expect(collisionWorld.raycastPoint(FROM_SKY(), DOWN())!.y).toBeCloseTo(-51, 1);
  });
});

describe("CollisionWorld — resolveCameraPosition", () => {
  beforeEach(() => collisionWorld.clear());

  it("retourne desired si aucun obstacle", () => {
    const head = new THREE.Vector3(0, 1.65, 0);
    const desired = new THREE.Vector3(0, 1.65, -5);
    const result = collisionWorld.resolveCameraPosition(head, desired);
    expect(result.x).toBeCloseTo(0);
    expect(result.z).toBeCloseTo(-5);
  });

  it("recule devant un mur", () => {
    const root = new THREE.Group();
    const wall = makeBox(10, 5, 0.5, [0, 0, -3]);
    root.add(wall);
    root.updateMatrixWorld(true);
    collisionWorld.registerScene(root);

    const head = new THREE.Vector3(0, 1.65, 0);
    const desired = new THREE.Vector3(0, 1.65, -5); // derrière le mur à z=-3
    const result = collisionWorld.resolveCameraPosition(head, desired, 0.5, 0.25);
    // La caméra doit s'arrêter AVANT le mur
    expect(result.z).toBeGreaterThan(-3); // pas traversé
    expect(result.z).toBeLessThan(0);     // a avancé un peu
  });

  it("distance nulle → retourne desired", () => {
    const head = new THREE.Vector3(0, 0, 0);
    const desired = head.clone();
    const result = collisionWorld.resolveCameraPosition(head, desired);
    expect(result.toArray()).toEqual(head.toArray());
  });
});

describe("CollisionWorld — computeBounds", () => {
  beforeEach(() => collisionWorld.clear());

  it("rend une boîte vide sans collider", () => {
    const box = collisionWorld.computeBounds();
    expect(box.isEmpty()).toBe(true);
  });

  it("englobe tous les colliders", () => {
    const root = new THREE.Group();
    root.add(makeBox(2, 2, 2, [-5, 0, 0]));
    root.add(makeBox(3, 3, 3, [5, 0, 0]));
    root.updateMatrixWorld(true);
    collisionWorld.registerScene(root);
    const box = collisionWorld.computeBounds();
    expect(box.min.x).toBeLessThanOrEqual(-6);
    expect(box.max.x).toBeGreaterThanOrEqual(6);
  });
});

describe("CollisionWorld — concurrence / robustesse", () => {
  beforeEach(() => collisionWorld.clear());

  it("isBlocked ne crashe pas si colliders est vide", () => {
    expect(() => collisionWorld.isBlocked(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(1, 0, 0),
    )).not.toThrow();
  });

  it("getGroundY ne crashe pas si colliders est vide", () => {
    expect(collisionWorld.getGroundY(0, 0, 100)).toBeNull();
  });

  it("registerScene puis clear puis registerScene — pas de fuite d'état", () => {
    const root1 = new THREE.Group();
    root1.add(makeBox(1, 1, 1));
    root1.updateMatrixWorld(true);
    collisionWorld.registerScene(root1);
    expect(collisionWorld.colliderCount).toBe(1);

    collisionWorld.clear();
    expect(collisionWorld.colliderCount).toBe(0);

    const root2 = new THREE.Group();
    root2.add(makeBox(2, 2, 2));
    root2.add(makeBox(3, 3, 3, [5, 0, 0]));
    root2.updateMatrixWorld(true);
    collisionWorld.registerScene(root2);
    expect(collisionWorld.colliderCount).toBe(2);
  });

  it("add pendant que le même mesh existe déjà → pas de doublon", () => {
    const m = makeBox(1, 1, 1);
    collisionWorld.add(m);
    collisionWorld.add(m);
    collisionWorld.add(m);
    expect(collisionWorld.colliderCount).toBe(1);
  });

  it("filtre de registerScene — appliqué à chaque traversée", () => {
    const root = new THREE.Group();
    root.add(makeBox(1, 1, 1, [0, 0, 0]));
    root.add(makeBox(2, 2, 2, [10, 0, 0]));
    root.updateMatrixWorld(true);
    collisionWorld.registerScene(root, {
      filter: (o) => (o as THREE.Mesh).geometry
        && (o.position.x > 5 || o.position.x < -5),
    });
    // Seul le mesh à x=10 passe le filtre
    expect(collisionWorld.colliderCount).toBe(1);
  });
});
