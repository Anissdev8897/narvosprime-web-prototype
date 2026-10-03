// ══════════════════════════════════════════════════════════════════════════════
// hairPlacement.test.ts — Une pièce reliée doit être INSENSIBLE à la transform
// de son ancêtre.
//
// ── LE BUG QUE CE FICHIER VERROUILLE (observé à l'écran) ─────────────────────
//
// La coiffure flottait à hauteur de HANCHE, sur le mannequin masculin comme sur
// le féminin, alors que corps et cheveux partagent le même squelette et que la
// couverture de poids est de 100 %.
//
// Cause : `SkinnedMesh.updateMatrixWorld` de three ne traite pas les deux modes
// de la même façon —
//
//   AttachedBindMode : bindMatrixInverse = inverse(matrixWorld)   ← chaque frame
//   DetachedBindMode : bindMatrixInverse = inverse(bindMatrix)    ← figé
//
// Le rendu calcule `matrixWorld × bindMatrixInverse × Σ(os) × bindMatrix × v`.
// En mode attaché, `matrixWorld` et son inverse s'annulent : le résultat ne
// dépend QUE des os. En mode détaché avec une bindMatrix identité, rien
// n'annule `matrixWorld` — la transform de l'ancêtre est appliquée DEUX fois à
// la pièce, une seule au corps (qui, lui, est resté attaché).
//
// Or `ForgePersonnages` enveloppe l'aperçu dans le `<Stage>` de drei, qui
// recentre et met à l'échelle ses enfants. `ModularCharacter` fait de même avec
// `<group scale={[scale * girth, scale, scale * girth]}>`.
//
// Arithmétique du cas mesuré (ancêtre : translate −0,83 puis scale 1,2) :
//   tête correcte   = 1,2 × 1,514 − 0,83 = 0,987   ← observé sur le corps
//   cheveux fautifs = 1,2 × 0,987 − 0,83 = 0,354   ← observé sur la coiffure
//
// ⚠ CE TEST DOIT S'EXÉCUTER SOUS UN ANCÊTRE TRANSFORMÉ. À l'identité, le bug
// est invisible — c'est exactement pour ça qu'il avait survécu à une première
// vérification, qui mesurait sans ancêtre.
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import * as THREE from "three";
import { GLTFLoader, SkeletonUtils } from "three-stdlib";
import { collectSkinnedMeshes, rebindSkinnedMesh } from "./rebindSkinnedMesh";
import { COIFFURES } from "./hairCatalog";

const PUB = path.resolve(__dirname, "../../../../public");
const CORPS = "models/personnages/_body/base_skinned.glb";

/** Hauteur de l'os `head` au repos, mesurée sur `base_skinned.glb`. */
const Y_TETE_REPOS = 1.514;

/**
 * Retire matériaux, textures et images du GLB.
 *
 * Les packs sont en KTX2 : sans ça, three exige un `KTX2Loader` et un
 * `createImageBitmap` que Node n'a pas. On ne mesure que géométrie et os, donc
 * l'apparence ne change rien au verdict.
 */
function sansTextures(buf: Buffer): ArrayBuffer {
  const lenJson = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + lenJson).toString("utf8"));
  const bin = buf.subarray(20 + lenJson + 8);

  for (const m of json.meshes ?? []) for (const p of m.primitives ?? []) delete p.material;
  delete json.materials; delete json.textures; delete json.images; delete json.samplers;
  const garder = (x: string) => x !== "KHR_texture_basisu";
  if (json.extensionsUsed) json.extensionsUsed = json.extensionsUsed.filter(garder);
  if (json.extensionsRequired) json.extensionsRequired = json.extensionsRequired.filter(garder);

  let txt = Buffer.from(JSON.stringify(json), "utf8");
  while (txt.length % 4) txt = Buffer.concat([txt, Buffer.from(" ")]);   // padding GLB obligatoire
  const out = Buffer.alloc(28 + txt.length + bin.length);
  out.write("glTF", 0, "ascii"); out.writeUInt32LE(2, 4); out.writeUInt32LE(out.length, 8);
  out.writeUInt32LE(txt.length, 12); out.write("JSON", 16, "ascii"); txt.copy(out, 20);
  out.writeUInt32LE(bin.length, 20 + txt.length);
  out.write("BIN\0", 24 + txt.length, "ascii"); bin.copy(out, 28 + txt.length);
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer;
}

function charge(rel: string): Promise<THREE.Group> {
  const ab = sansTextures(fs.readFileSync(path.join(PUB, rel)));
  return new Promise((res, rej) => {
    new GLTFLoader().parse(ab, "", (g) => res(g.scene as THREE.Group), rej);
  });
}

/** Position MONDE d'un sommet skinné, exactement comme la calcule le shader. */
function sommetMonde(mesh: THREE.SkinnedMesh, i: number, v = new THREE.Vector3()) {
  const p = mesh.geometry.getAttribute("position");
  v.set(p.getX(i), p.getY(i), p.getZ(i));
  mesh.applyBoneTransform(i, v);            // bindMatrix → os → bindMatrixInverse
  return v.applyMatrix4(mesh.matrixWorld);
}

function boiteMonde(mesh: THREE.SkinnedMesh) {
  const b = new THREE.Box3();
  const v = new THREE.Vector3();
  const n = mesh.geometry.getAttribute("position").count;
  const pas = Math.max(1, Math.floor(n / 2000));   // la boîte suffit : pas besoin de tout lire
  for (let i = 0; i < n; i += pas) b.expandByPoint(sommetMonde(mesh, i, v));
  return b;
}

interface Ancetre { y: number; echelle: number; }

/** Le corps monté comme dans l'app, sous un ancêtre TRANSFORMÉ. */
async function scenePersonnage(ancetre: Ancetre) {
  const racine = SkeletonUtils.clone(await charge(CORPS)) as THREE.Object3D;
  const corps = collectSkinnedMeshes(racine);
  const skeleton = corps[0].skeleton;

  const scene = new THREE.Scene();
  const stage = new THREE.Group();          // ce que font <Stage> et <group scale>
  stage.position.y = ancetre.y;
  stage.scale.setScalar(ancetre.echelle);
  scene.add(stage);
  stage.add(racine);
  scene.updateMatrixWorld(true);
  skeleton.update();

  const head = skeleton.bones.find((b) => b.name === "head");
  if (!head) throw new Error("os 'head' absent du corps");
  return { scene, stage, skeleton, corps, head };
}

/** Monte une coiffure en FRÈRE du corps et rend ses meshes reliés. */
async function poseCoiffure(
  ctx: Awaited<ReturnType<typeof scenePersonnage>>,
  rel: string,
) {
  const hr = SkeletonUtils.clone(await charge(rel)) as THREE.Object3D;
  ctx.stage.add(hr);
  const meshes = collectSkinnedMeshes(hr);
  let relie = 0;
  let couverture = 0;
  for (const m of meshes) {
    const r = rebindSkinnedMesh(m, ctx.skeleton);
    if (r.ok) relie++;
    couverture = Math.max(couverture, r.coverage);
  }
  ctx.scene.updateMatrixWorld(true);
  ctx.skeleton.update();
  return { meshes, relie, couverture };
}

/**
 * En dessous, la pièce est mal appariée : ses influences dominantes sont
 * rabattues sur des os secondaires éloignés et le maillage se déchire. Le
 * placement reste bon — c'est la FORME qui ne l'est pas. Deux défauts
 * distincts, donc deux vérifications distinctes.
 */
const COUVERTURE_SAINE = 0.95;

const COIFFURES_A_TESTER = COIFFURES.map((c) => ({ id: c.id, rel: c.path.replace(/^\//, "") }));

// L'ancêtre reproduit <Stage> : un recentrage ET une mise à l'échelle.
const ANCETRE: Ancetre = { y: -0.83, echelle: 1.2 };

describe("placement d'une pièce reliée sous un ancêtre transformé", () => {
  beforeAll(() => {
    if (!fs.existsSync(path.join(PUB, CORPS))) throw new Error(`corps absent : ${CORPS}`);
  });

  it("le corps sert de référence : il suit l'ancêtre UNE seule fois", async () => {
    const { head, corps } = await scenePersonnage(ANCETRE);
    const yTete = new THREE.Vector3().setFromMatrixPosition(head.matrixWorld).y;
    expect(yTete).toBeCloseTo(Y_TETE_REPOS * ANCETRE.echelle + ANCETRE.y, 2);
    // Le corps est en mode ATTACHÉ — c'est POURQUOI il est juste, et la
    // référence à laquelle les pièces greffées doivent se conformer.
    expect(corps[0].bindMode).toBe(THREE.AttachedBindMode);
  });

  for (const { id, rel } of COIFFURES_A_TESTER) {
    it(`la coiffure "${id}" se pose sur la tête, pas à la hanche`, async () => {
      if (!fs.existsSync(path.join(PUB, rel))) {
        throw new Error(`coiffure absente du disque : ${rel} — le catalogue ment`);
      }
      const ctx = await scenePersonnage(ANCETRE);
      const yTete = new THREE.Vector3().setFromMatrixPosition(ctx.head.matrixWorld).y;

      const { meshes, relie, couverture } = await poseCoiffure(ctx, rel);
      expect(meshes.length, "aucun mesh skinné").toBeGreaterThan(0);
      expect(relie, "aucun mesh relié").toBeGreaterThan(0);

      const b = boiteMonde(meshes[0]);
      const centre = b.getCenter(new THREE.Vector3());

      // ⚠ Tolérance en CENTIMÈTRES : le bug déplaçait de 63 cm. 8 cm reste plus
      // serré que l'épaisseur d'un crâne — discriminant sans être fragile.
      expect(
        Math.abs(centre.y - yTete),
        `centre de la coiffure à ${centre.y.toFixed(3)} m, os head à ${yTete.toFixed(3)} m`,
      ).toBeLessThan(0.08);

      // La TAILLE : la double application de l'échelle rétrécissait la
      // chevelure. Un test de position seule laisserait passer ce défaut-là.
      //
      // Réservé aux pièces BIEN appariées. `boris` ne l'est pas (54 % de poids)
      // et son maillage est déchiré — un défaut RÉEL mais SÉPARÉ, épinglé par
      // le test « couverture » plus bas. L'exclure ici évite de faire échouer
      // la vérification de placement pour une raison qui n'est pas le placement.
      if (couverture >= COUVERTURE_SAINE) {
        const hauteur = b.max.y - b.min.y;
        expect(hauteur, "chevelure écrasée").toBeGreaterThan(0.12 * ANCETRE.echelle);
        expect(hauteur, "chevelure dilatée").toBeLessThan(0.45 * ANCETRE.echelle);
      }
    });
  }

  it("le catalogue n'expose QUE `boris` en dessous du seuil sain", async () => {
    // ── TEST DE CARACTÉRISATION, pas de validation ──────────────────────────
    //
    // `boris` passe `MIN_COVERAGE` (50 %) à 54 % : il est donc ACCEPTÉ et
    // affiché déchiré — 97 os non appariés, ~12 000 influences rabattues,
    // 29 sommets à poids nul qui s'effondrent à l'origine. Le seuil laisse
    // passer une pièce que l'œil rejette.
    //
    // Ce test fige l'état connu pour qu'il soit VISIBLE plutôt que subi. Il
    // échouera si une autre coiffure se dégrade — et aussi le jour où `boris`
    // sera recoupé ou retiré du catalogue, ce qui est l'occasion voulue de
    // mettre cette liste à jour.
    const faibles: string[] = [];
    for (const { id, rel } of COIFFURES_A_TESTER) {
      const ctx = await scenePersonnage({ y: 0, echelle: 1 });
      const { couverture } = await poseCoiffure(ctx, rel);
      if (couverture < COUVERTURE_SAINE) faibles.push(`${id} (${(couverture * 100).toFixed(0)}%)`);
    }
    expect(faibles.map((f) => f.split(" ")[0])).toEqual(["boris"]);
  });

  it("le placement ne dépend PAS de la transform de l'ancêtre", async () => {
    // L'invariant de fond : une pièce reliée est pilotée par les OS. Deux
    // ancêtres différents doivent donner le même écart tête↔cheveux, une fois
    // ramené à l'échelle — sinon on confondrait « suit » et « ne bouge pas ».
    const ecart = async (a: Ancetre) => {
      const ctx = await scenePersonnage(a);
      const { meshes } = await poseCoiffure(ctx, COIFFURES_A_TESTER[0].rel);
      const yTete = new THREE.Vector3().setFromMatrixPosition(ctx.head.matrixWorld).y;
      return (boiteMonde(meshes[0]).getCenter(new THREE.Vector3()).y - yTete) / a.echelle;
    };
    expect(await ecart(ANCETRE)).toBeCloseTo(await ecart({ y: 0, echelle: 1 }), 2);
  });
});
