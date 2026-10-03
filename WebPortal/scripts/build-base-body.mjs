// ══════════════════════════════════════════════════════════════════════════════
// build-base-body.mjs — Corps de base MakeHuman riggé Mixamo → GLB.
//
// Assemble trois fichiers CC0 de MPFB2 en un maillage skinné utilisable par le
// moteur :
//   data/3dobjs/base.obj                 19 158 sommets, nu
//   data/rigs/standard/rig.mixamo.json   52 os, nomenclature `mixamorig:`
//   data/rigs/standard/weights.mixamo.json  poids déjà calculés pour ce maillage
//
// Usage : node scripts/build-base-body.mjs [--src=<mpfb2-master>]
// Sortie : public/models/personnages/base/SK_BaseBody_Mixamo.glb
//
// ── POURQUOI LE RIG MIXAMO ET PAS UN AUTRE ───────────────────────────────────
//
// MPFB2 en propose huit (default, game_engine, cmu_mb, rigify, openpose…). On
// prend `mixamo` parce que c'est la convention que `humanoidBones.ts` gère déjà
// nativement, et celle des 22 personnages Meshy du projet avec leurs animations
// fusionnées. Aucun retargeting à écrire.
//
// ── TROIS CHOIX ASSUMÉS ──────────────────────────────────────────────────────
//
// 1. AUCUNE UV. Les indices de sommets DOIVENT rester alignés sur `base.obj`,
//    sinon les 527 cibles de morphologie pointent à côté. Or une UV de couture
//    exige de DÉDOUBLER des sommets. On sacrifie donc les UV — le corps est nu
//    et coloré par teinte, pas par texture. Les rétablir demandera une table de
//    correspondance ancien→nouveau sommet.
//
// 2. POSE DE BIND SANS ROTATION. On ne pose que les translations d'os ; les
//    `roll` du fichier de rig sont ignorés. Suffisant pour le skinning, mais
//    ⚠ la compatibilité avec les clips Mixamo réels demande une VÉRIFICATION
//    VISUELLE : un roll ignoré se voit sur les avant-bras et les épaules.
//
// 3. LE MAILLAGE ET LE RIG NE SONT PAS DANS LE MÊME ESPACE. Mesuré :
//
//      base.obj              Y vertical (étendue 16,9) · ~17 unités de haut
//      rig.mixamo.json       Z vertical (tête à 1,530) · ~1,7 m
//
//    Deux désaccords simultanés : axe vertical ET échelle (facteur 10). Traiter
//    les deux sources de la même façon donne un corps couché sur le dos et dix
//    fois trop grand — première version de ce script, corrigée après rendu.
//
//    On travaille donc en ESPACE MAILLAGE (Y-up), simplement ramené au mètre.
//    Les positions d'os viennent des `vertex_indices` — donc du maillage, donc
//    déjà dans le bon espace. Seul le repli `default_position` doit être
//    converti depuis le Z-up du fichier de rig.
// ══════════════════════════════════════════════════════════════════════════════

import { Document, NodeIO } from "@gltf-transform/core";
import { readFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { parseObjPositions } from "./lib/mh-target.mjs";
import { buildSkinAttributes, boneHeadPosition, topologicalBoneOrder, INFLUENCES } from "./lib/mh-skin.mjs";

const arg = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const SRC = arg("src", "C:/Users/aniss/mes_projet/mpfb2-master/mpfb2-master");
const OUT = "public/models/personnages/base/SK_BaseBody_Mixamo.glb";

const DATA = path.join(SRC, "src", "mpfb", "data");
const F_OBJ = path.join(DATA, "3dobjs", "base.obj");
const F_RIG = path.join(DATA, "rigs", "standard", "rig.mixamo.json");
const F_W = path.join(DATA, "rigs", "standard", "weights.mixamo.json");

for (const f of [F_OBJ, F_RIG, F_W]) {
  if (!existsSync(f)) { console.error(`[base] introuvable : ${f}`); process.exit(1); }
}

// ── Maillage ─────────────────────────────────────────────────────────────────

const objText = readFileSync(F_OBJ, "utf8");
const rawPos = parseObjPositions(objText);
const vertexCount = rawPos.length / 3;

/**
 * Facteur de mise à l'échelle du maillage vers le mètre.
 *
 * Déduit de la MESURE, pas d'une constante devinée : on compare la hauteur du
 * maillage à celle du rig, qui est en mètres par construction (tête à 1,530).
 * Un pack MakeHuman réexporté avec une autre unité continuera de fonctionner.
 */
function mesureEchelle(pos, rigBones) {
  let minY = Infinity, maxY = -Infinity;
  for (let i = 1; i < pos.length; i += 3) {
    if (pos[i] < minY) minY = pos[i];
    if (pos[i] > maxY) maxY = pos[i];
  }
  const hauteurMaillage = maxY - minY;
  // Le rig est en Z-up : la hauteur utile est la composante Z de la tête.
  const hauteurRig = rigBones["mixamorig:Head"]?.head?.default_position?.[2] ?? 1.53;
  return { facteur: hauteurMaillage / (hauteurRig * 1.105), hauteurMaillage };
}

const rigPre = JSON.parse(readFileSync(F_RIG, "utf8"));
const { facteur, hauteurMaillage } = mesureEchelle(rawPos, rigPre.bones);

// Espace de travail : celui du MAILLAGE (Y-up), simplement ramené au mètre.
const positions = new Float32Array(rawPos.length);
for (let i = 0; i < rawPos.length; i++) positions[i] = rawPos[i] / facteur;

/**
 * `base.obj` N'EST PAS QUE LE CORPS.
 *
 * MakeHuman y range aussi des géométries d'AIDE, utilisées pour ajuster les
 * vêtements : une jupe, des collants, des cheveux, des cils, des dents, une
 * langue. Les rendre toutes donne un personnage en longue robe — première
 * version de ce script, corrigée après rendu.
 *
 * `hm08_config.json` donne les plages de sommets de chaque groupe. On filtre
 * les FACES, jamais les SOMMETS : les 527 cibles de morphologie sont indexées
 * sur la numérotation de `base.obj`, et en retirer un seul décalerait tout.
 * ~30 % de sommets inutilisés, contre la garantie que les curseurs marchent.
 */
const RANGES = JSON.parse(readFileSync(path.join(DATA, "mesh_metadata", "hm08_config.json"), "utf8")).groups_by_range;

/** Groupes rendus, et leur matériau. Le reste de `base.obj` est ignoré. */
const PARTIES = [
  { nom: "Body", plages: [RANGES["body"]], couleur: [0.85, 0.68, 0.56, 1], rugosite: 0.75 },
  // Les yeux sont livrés comme deux helpers séparés. Les sortir en primitive
  // distincte est ce qui rend une palette de couleur d'iris possible : teinter
  // ce matériau ne touche pas la peau.
  { nom: "Eyes", plages: [RANGES["helper-l-eye"], RANGES["helper-r-eye"]], couleur: [0.25, 0.45, 0.65, 1], rugosite: 0.15 },
];

const dansPlages = (i, plages) => plages.some(([a, b]) => i >= a && i <= b);

/**
 * Triangulation des faces OBJ, ventilée par groupe.
 *
 * Le maillage MakeHuman est majoritairement en QUADS. Un éventail depuis le
 * premier sommet suffit : les faces sont convexes et planes. On ne garde que
 * l'indice de POSITION (`v` de `v/vt/vn`) — les UV sont écartées, cf. entête.
 */
const parPartie = PARTIES.map(() => []);
for (const raw of objText.split("\n")) {
  if (!raw.startsWith("f ")) continue;
  const coins = raw.trim().split(/\s+/).slice(1)
    .map((t) => Number.parseInt(t.split("/")[0], 10) - 1)   // OBJ indexe à 1
    .filter((i) => i >= 0 && i < vertexCount);
  if (coins.length < 3) continue;

  // Une face appartient à un groupe si TOUS ses coins y sont : une face à
  // cheval relierait le corps à un helper et tirerait un triangle parasite.
  const g = PARTIES.findIndex((p) => coins.every((i) => dansPlages(i, p.plages)));
  if (g < 0) continue;

  for (let k = 1; k + 1 < coins.length; k++) parPartie[g].push(coins[0], coins[k], coins[k + 1]);
}

const indices = parPartie.flat();   // normales calculées sur l'ensemble rendu

// Normales par moyenne des normales de face — pas de lissage par angle : le
// corps de base n'a aucune arête vive.
const normals = new Float32Array(positions.length);
for (let t = 0; t < indices.length; t += 3) {
  const [a, b, c] = [indices[t], indices[t + 1], indices[t + 2]];
  const ax = positions[b * 3] - positions[a * 3], ay = positions[b * 3 + 1] - positions[a * 3 + 1], az = positions[b * 3 + 2] - positions[a * 3 + 2];
  const bx = positions[c * 3] - positions[a * 3], by = positions[c * 3 + 1] - positions[a * 3 + 1], bz = positions[c * 3 + 2] - positions[a * 3 + 2];
  const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
  for (const i of [a, b, c]) { normals[i * 3] += nx; normals[i * 3 + 1] += ny; normals[i * 3 + 2] += nz; }
}
for (let v = 0; v < vertexCount; v++) {
  const o = v * 3;
  const l = Math.hypot(normals[o], normals[o + 1], normals[o + 2]) || 1;
  normals[o] /= l; normals[o + 1] /= l; normals[o + 2] /= l;
}

// ── Squelette ────────────────────────────────────────────────────────────────

const rig = rigPre;
const boneOrder = topologicalBoneOrder(rig.bones);
const boneIdx = new Map(boneOrder.map((n, i) => [n, i]));

// Position monde de chaque os, recalculée depuis le MAILLAGE (strategy MEAN) :
// c'est ce qui permettra au squelette de suivre les curseurs de morphologie.
//
// Les `vertex_indices` pointent dans le maillage, donc le résultat est DÉJÀ en
// espace maillage (Y-up, mètres après division). Seul le repli
// `default_position` vient du fichier de rig, en Z-up mètres : lui seul se
// convertit.
const world = boneOrder.map((n) => {
  const h = rig.bones[n].head;
  const [dx, dy, dz] = h.default_position ?? [0, 0, 0];
  const repli = [dx, dz, -dy];                       // Z-up → Y-up, déjà en mètres
  return boneHeadPosition(positions, h.vertex_indices, repli);
});

const { weights: wJson } = JSON.parse(readFileSync(F_W, "utf8"));
const skin = buildSkinAttributes(wJson, boneOrder, vertexCount);

const hautM = (Math.max(...world.map((w) => w[1])) - Math.min(...world.map((w) => w[1]))).toFixed(2);
console.log(`Échelle   : maillage ${hauteurMaillage.toFixed(2)} u → ÷${facteur.toFixed(2)} · squelette ${hautM} m`);
console.log(`Maillage  : ${vertexCount} sommets · ${indices.length / 3} triangles rendus`);
PARTIES.forEach((p, g) => console.log(`            ${p.nom.padEnd(6)} ${String(parPartie[g].length / 3).padStart(6)} tri`));
console.log(`Squelette : ${boneOrder.length} os (${boneOrder[0]} → …)`);
console.log(`Skinning  : ${skin.orphans} orphelins · ${skin.truncated} sommets tronqués à ${INFLUENCES} influences\n`);

// ── Document glTF ────────────────────────────────────────────────────────────

const doc = new Document();
const buf = doc.createBuffer();
const scene = doc.createScene("BaseBody");

const nodes = boneOrder.map((n) => doc.createNode(n));
for (let i = 0; i < boneOrder.length; i++) {
  const parent = rig.bones[boneOrder[i]].parent;
  const pi = parent ? boneIdx.get(parent) : undefined;
  if (pi !== undefined) {
    nodes[pi].addChild(nodes[i]);
    // Translation LOCALE : monde de l'os moins monde du parent.
    nodes[i].setTranslation([world[i][0] - world[pi][0], world[i][1] - world[pi][1], world[i][2] - world[pi][2]]);
  } else {
    scene.addChild(nodes[i]);
    nodes[i].setTranslation(world[i]);
  }
}

// Matrices inverses de bind : rotation identité, donc simple translation
// opposée. Colonne-major, la translation occupe les indices 12/13/14.
const ibm = new Float32Array(boneOrder.length * 16);
for (let i = 0; i < boneOrder.length; i++) {
  const o = i * 16;
  ibm[o] = 1; ibm[o + 5] = 1; ibm[o + 10] = 1; ibm[o + 15] = 1;
  ibm[o + 12] = -world[i][0]; ibm[o + 13] = -world[i][1]; ibm[o + 14] = -world[i][2];
}

const gltfSkin = doc.createSkin("mixamo")
  .setInverseBindMatrices(doc.createAccessor().setType("MAT4").setArray(ibm).setBuffer(buf))
  .setSkeleton(nodes[boneIdx.get(boneOrder.find((n) => !rig.bones[n].parent) ?? boneOrder[0])]);
for (const n of nodes) gltfSkin.addJoint(n);

const acc = (type, array) => doc.createAccessor().setType(type).setArray(array).setBuffer(buf);

// Attributs de sommets PARTAGÉS entre les primitives : un seul jeu de positions
// pour tout le maillage, donc les cibles de morphologie déforment corps et yeux
// d'un même mouvement.
const aPos = acc("VEC3", positions);
const aNrm = acc("VEC3", normals);
const aJnt = acc("VEC4", skin.joints);
const aWgt = acc("VEC4", skin.weights);

const mesh = doc.createMesh("BaseBody");
for (let g = 0; g < PARTIES.length; g++) {
  if (parPartie[g].length === 0) continue;
  const p = PARTIES[g];
  mesh.addPrimitive(doc.createPrimitive()
    .setAttribute("POSITION", aPos)
    .setAttribute("NORMAL", aNrm)
    .setAttribute("JOINTS_0", aJnt)
    .setAttribute("WEIGHTS_0", aWgt)
    .setIndices(acc("SCALAR", Uint32Array.from(parPartie[g])))
    .setMaterial(doc.createMaterial(p.nom).setBaseColorFactor(p.couleur).setRoughnessFactor(p.rugosite)));
}

scene.addChild(doc.createNode("BaseBody").setMesh(mesh).setSkin(gltfSkin));

mkdirSync(path.dirname(OUT), { recursive: true });
await new NodeIO().write(OUT, doc);

console.log(`✅ ${OUT}  (${(statSync(OUT).size / 1048576).toFixed(2)} Mo)`);
console.log(`⚠ Pose de bind sans rotation (rolls ignorés) — vérifier à l'écran avec un clip Mixamo réel.`);
console.log(`⚠ Aucune UV : les indices de sommets restent alignés sur base.obj pour les cibles morpho.`);
