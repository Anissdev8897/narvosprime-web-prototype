// ══════════════════════════════════════════════════════════════════════════════
// narvos-vetements-morphables.mjs — des vêtements taillés DANS le corps.
//
//   node scripts/narvos-vetements-morphables.mjs [--apply]
//
// ── LE PROBLÈME ───────────────────────────────────────────────────────────────
// Le corps morphable sort nu. Ses 522 morph targets le déforment en continu, et
// aucun vêtement du projet ne peut le suivre : les pièces Stylized et Trooper
// sont modélisées sur d'autres topologies, avec d'autres volumes. Posées dessus,
// elles s'interpénètrent dès que le joueur touche un curseur.
//
// ── LA SOLUTION : UNE SECONDE PEAU ────────────────────────────────────────────
// On découpe le vêtement DANS le corps lui-même, puis on le décale de quelques
// millimètres vers l'extérieur. Trois propriétés en découlent, gratuitement :
//
//   · il porte les MÊMES morphs, donc il suit chaque réglage du joueur ;
//   · il porte les MÊMES poids de skinning, donc il s'anime sans retouche ;
//   · il ne peut pas s'interpénétrer, puisqu'il est le corps décalé.
//
// C'est la technique des combinaisons et sous-vêtements dans beaucoup de jeux.
// Elle ne donne pas une veste qui pend — pour ça il faut un vrai modèle — mais
// elle donne des vêtements JUSTES, ce qu'aucun autre chemin ne permet ici.
//
// ── LE DÉCOUPAGE VIENT DES OS ─────────────────────────────────────────────────
// Chaque sommet a un os dominant, celui qui porte le plus de poids. Mesuré sur
// les 14 517 sommets de la peau : `spine_*` et `pelvis` donnent le torse,
// `thigh`/`calf` les jambes, `hand` et les doigts les mains, `foot`/`ball` les
// pieds. Le découpage est net, sans zone ambiguë.
//
// ── LES MORPHS SONT FILTRÉS ───────────────────────────────────────────────────
// Un pantalon n'a aucun besoin des 42 morphs de nez. On ne garde, pour chaque
// pièce, que les morphs qui déplacent RÉELLEMENT au moins un de ses sommets.
// Sans ce filtre, quatre pièces × 522 morphs pèseraient plus que le corps.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";

import { lireGlb, ecrireGlb, lireAccessor, creerBuffer, bornesVec3 } from "./lib/glb.mjs";

const BODY = "E:/narvosprime-web-prototype/WebPortal/public/models/personnages/_body";
const SOURCE = `${BODY}/base_morphable.glb`;
const SORTIE = `${BODY}/vetements`;

const APPLY = process.argv.includes("--apply");

/** Décalage vers l'extérieur, en mètres. Le corps est en mètres (`units` dans
 *  ses extras).
 *
 *  3 mm : assez pour qu'aucun pixel de peau ne perce le tissu — le z-fighting
 *  se voit à 0,5 mm — et assez peu pour que le vêtement ne flotte pas. */
const EPAISSEUR = 0.003;

/** Pièces produites. `os` liste les préfixes d'os qui composent la région.
 *
 *  ⚠ LE SLOT DOIT EXISTER dans `Modular.SLOTS`, sinon la pièce sera cuite,
 *  référencée, et jamais posée : `Habiller` itère les slots connus. */
const PIECES = [
  {
    id: "combinaison",
    slot: "torse",
    label: "Combinaison",
    couleur: [0.16, 0.18, 0.22, 1],
    // `neck_01` ferme le col : sans lui le vêtement s'arrête sous la gorge et
    // laisse un anneau de peau. Les clavicules et bras couvrent les épaules.
    os: ["spine_", "pelvis", "neck_01", "clavicle_", "upperarm_", "lowerarm_"],
  },
  {
    id: "pantalon",
    slot: "jambes",
    label: "Pantalon",
    couleur: [0.12, 0.13, 0.16, 1],
    os: ["thigh_", "calf_"],
  },
  {
    id: "gants",
    slot: "mains",
    label: "Gants",
    couleur: [0.09, 0.10, 0.12, 1],
    // Les doigts portent leurs propres os : `hand_` seul ne prendrait que la
    // paume, et les gants s'arrêteraient aux phalanges.
    os: ["hand_", "index_", "middle_", "ring_", "pinky_", "thumb_"],
  },
  {
    id: "bottes",
    slot: "pieds",
    label: "Bottes",
    couleur: [0.07, 0.08, 0.09, 1],
    os: ["foot_", "ball_"],
  },
];

// ── Lecture du corps ──────────────────────────────────────────────────────────

const { json, bin } = lireGlb(SOURCE);

console.log(`source : ${path.basename(SOURCE)} (${(fs.statSync(SOURCE).size / 1048576).toFixed(0)} Mo)`);

const mesh = json.meshes[0];
// La primitive 0 est la peau ; la 1 est les yeux, qu'aucun vêtement ne couvre.
const prim = mesh.primitives[0];
const nomsMorphs = mesh.extras.targetNames;

const positions = lireAccessor(json, bin, prim.attributes.POSITION);
const joints = lireAccessor(json, bin, prim.attributes.JOINTS_0);
const poids = lireAccessor(json, bin, prim.attributes.WEIGHTS_0);
const uv = lireAccessor(json, bin, prim.attributes.TEXCOORD_0);
const morphIndex = lireAccessor(json, bin, prim.attributes._MORPH_INDEX);
const indices = lireAccessor(json, bin, prim.indices);

const nbSommets = positions.length / 3;
const nomOs = json.skins[0].joints.map((j) => json.nodes[j].name || "");

console.log(`         ${nbSommets} sommets, ${indices.length / 3} triangles, ${nomsMorphs.length} morphs`);

/** Os dominant de chaque sommet. */
const dominant = new Uint16Array(nbSommets);
for (let i = 0; i < nbSommets; i++) {
  let best = 0;
  let bw = -1;
  for (let c = 0; c < 4; c++) {
    const w = poids[i * 4 + c];
    if (w > bw) { bw = w; best = joints[i * 4 + c]; }
  }
  dominant[i] = best;
}

// ── Normales, calculées ───────────────────────────────────────────────────────
//
// Le corps n'embarque PAS de NORMAL — ses attributs sont POSITION, JOINTS_0,
// WEIGHTS_0, _MORPH_INDEX, TEXCOORD_0. Sans normales, impossible de décaler vers
// l'extérieur : on les reconstruit depuis la géométrie.
//
// Moyenne des normales de face, pondérée par l'aire du triangle — le produit
// vectoriel non normalisé la porte déjà. Un sommet partagé par une grande et une
// petite face suit donc surtout la grande, ce qui est le comportement voulu aux
// coutures.

const normales = new Float32Array(nbSommets * 3);

for (let t = 0; t < indices.length; t += 3) {
  const a = indices[t], b = indices[t + 1], c = indices[t + 2];

  const ax = positions[a * 3], ay = positions[a * 3 + 1], az = positions[a * 3 + 2];
  const bx = positions[b * 3], by = positions[b * 3 + 1], bz = positions[b * 3 + 2];
  const cx = positions[c * 3], cy = positions[c * 3 + 1], cz = positions[c * 3 + 2];

  const ux = bx - ax, uy = by - ay, uz = bz - az;
  const vx = cx - ax, vy = cy - ay, vz = cz - az;

  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;

  for (const s of [a, b, c]) {
    normales[s * 3] += nx;
    normales[s * 3 + 1] += ny;
    normales[s * 3 + 2] += nz;
  }
}

let degenerees = 0;
for (let i = 0; i < nbSommets; i++) {
  const x = normales[i * 3], y = normales[i * 3 + 1], z = normales[i * 3 + 2];
  const n = Math.hypot(x, y, z);
  if (n < 1e-12) {
    // Un sommet isolé ou sur des faces dégénérées n'a pas de normale. Le décaler
    // au hasard ferait un pic ; on le laisse sur la peau.
    degenerees++;
    continue;
  }
  normales[i * 3] = x / n;
  normales[i * 3 + 1] = y / n;
  normales[i * 3 + 2] = z / n;
}
if (degenerees > 0) console.log(`         ${degenerees} sommet(s) sans normale — laissés sur la peau`);

// ── Découpe ───────────────────────────────────────────────────────────────────

const materiaux = json.materials || [];
const materiauPeau = prim.material;

/** Construit le GLB d'une pièce. Rend un résumé. */
function tailler(piece) {
  const dansRegion = (sommet) => {
    const nom = nomOs[dominant[sommet]] || "";
    return piece.os.some((p) => nom.startsWith(p));
  };

  // ⚠ UN TRIANGLE ENTIER, PAS UN SOMMET. Garder les triangles dont SEULS les
  // trois sommets sont dans la région laisserait un anneau de trous à chaque
  // frontière. On garde ceux dont au moins un sommet y est : les pièces se
  // chevauchent d'une rangée de triangles, ce qui ferme les jointures.
  const gardes = [];
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t], b = indices[t + 1], c = indices[t + 2];
    if (dansRegion(a) || dansRegion(b) || dansRegion(c)) gardes.push(a, b, c);
  }

  if (gardes.length === 0) return null;

  // Renumérotation : la pièce ne garde que les sommets qu'elle emploie.
  const ancienVersNeuf = new Map();
  const ordre = [];
  for (const s of gardes) {
    if (!ancienVersNeuf.has(s)) {
      ancienVersNeuf.set(s, ordre.length);
      ordre.push(s);
    }
  }

  const n = ordre.length;
  const pos = new Float32Array(n * 3);
  const jnt = new Uint16Array(n * 4);
  const wgt = new Float32Array(n * 4);
  const tex = new Float32Array(n * 2);
  const mi = new Uint32Array(n);

  for (let i = 0; i < n; i++) {
    const s = ordre[i];
    // Le décalage vers l'extérieur : c'est lui qui fait le vêtement.
    for (let c = 0; c < 3; c++) {
      pos[i * 3 + c] = positions[s * 3 + c] + normales[s * 3 + c] * EPAISSEUR;
    }
    for (let c = 0; c < 4; c++) {
      jnt[i * 4 + c] = joints[s * 4 + c];
      wgt[i * 4 + c] = poids[s * 4 + c];
    }
    tex[i * 2] = uv[s * 2];
    tex[i * 2 + 1] = uv[s * 2 + 1];
    mi[i] = morphIndex[s];
  }

  const idx = new Uint32Array(gardes.length);
  for (let i = 0; i < gardes.length; i++) idx[i] = ancienVersNeuf.get(gardes[i]);

  // ── Morphs, filtrés ─────────────────────────────────────────────────────────
  //
  // On lit chaque target du corps et on ne garde que ceux qui bougent au moins
  // un sommet de la pièce. Un seuil, plutôt que « non nul » : les deltas
  // flottants portent du bruit à 1e-9 qui ne déplace rien de visible.
  const SEUIL = 1e-5;

  const targets = [];
  const nomsGardes = [];

  for (let m = 0; m < prim.targets.length; m++) {
    const delta = lireAccessor(json, bin, prim.targets[m].POSITION);

    const sortie = new Float32Array(n * 3);
    let touche = false;

    for (let i = 0; i < n; i++) {
      const s = ordre[i];
      for (let c = 0; c < 3; c++) {
        const d = delta[s * 3 + c];
        sortie[i * 3 + c] = d;
        if (!touche && Math.abs(d) > SEUIL) touche = true;
      }
    }

    if (touche) {
      targets.push(sortie);
      nomsGardes.push(nomsMorphs[m]);
    }
  }

  // ── Assemblage ──────────────────────────────────────────────────────────────

  const sortieJson = {
    asset: { version: "2.0", generator: "narvos-vetements-morphables" },
    scene: 0,
    scenes: json.scenes,
    nodes: json.nodes,
    skins: json.skins,
    // ⚠ UN MATERIAU PROPRE, PAS CELUI DE LA PEAU.
    //
    // Reprendre `skin` donnerait un vetement exactement de la couleur du corps
    // — invisible. Et le laisser SANS materiau ferait retomber Interchange sur
    // `WorldGridMaterial`, le nom reserve du moteur : c'est ce qui avait rendu
    // les 67 pieces Trooper grises.
    //
    // Chaque piece porte donc le sien, nomme et teinte. `SetMaterialColorParameter`
    // pourra le recolorer depuis le Lua sans toucher a la peau.
    materials: [{
      name: `MI_mpfb_${piece.id}`,
      pbrMetallicRoughness: {
        baseColorFactor: piece.couleur,
        metallicFactor: 0.0,
        roughnessFactor: 0.75,
      },
    }],
    meshes: [],
    accessors: [],
    bufferViews: [],
    buffers: [],
    extras: {
      ...(json.extras ?? {}),
      generator: "narvos-vetements-morphables",
      piece: piece.id,
      epaisseur: EPAISSEUR,
    },
  };

  const buf = creerBuffer();

  const accVec = (donnees, composantes, type, componentType) => {
    const vue = buf.ajouter(donnees, sortieJson);
    const a = {
      bufferView: vue,
      componentType,
      count: donnees.length / composantes,
      type,
    };
    if (type === "VEC3" && componentType === 5126) Object.assign(a, bornesVec3(donnees));
    sortieJson.accessors.push(a);
    return sortieJson.accessors.length - 1;
  };

  const aPos = accVec(pos, 3, "VEC3", 5126);
  const aJnt = accVec(jnt, 4, "VEC4", 5123);
  const aWgt = accVec(wgt, 4, "VEC4", 5126);
  const aTex = accVec(tex, 2, "VEC2", 5126);
  const aMi = accVec(mi, 1, "SCALAR", 5125);
  const aIdx = accVec(idx, 1, "SCALAR", 5125);

  const primitive = {
    attributes: {
      POSITION: aPos, JOINTS_0: aJnt, WEIGHTS_0: aWgt,
      TEXCOORD_0: aTex, _MORPH_INDEX: aMi,
    },
    indices: aIdx,
    targets: targets.map((t) => ({ POSITION: accVec(t, 3, "VEC3", 5126) })),
  };
  primitive.material = 0;

  sortieJson.meshes.push({
    name: piece.id,
    primitives: [primitive],
    weights: new Array(targets.length).fill(0),
    extras: { targetNames: nomsGardes },
  });

  // Le squelette est repris tel quel : les poids référencent ses index, et les
  // renuméroter n'apporterait rien qu'un risque de décalage.
  const binFinal = buf.resultat();
  sortieJson.buffers = [{ byteLength: binFinal.length }];

  return { json: sortieJson, bin: binFinal, sommets: n, triangles: gardes.length / 3, morphs: targets.length };
}

// ── Production ────────────────────────────────────────────────────────────────

console.log("");
const resultats = [];

for (const piece of PIECES) {
  const r = tailler(piece);
  if (!r) {
    console.error(`  ${piece.id.padEnd(14)} AUCUN triangle — les prefixes d'os sont-ils justes ?`);
    continue;
  }

  const octets = r.bin.length;
  console.log(
    `  ${piece.id.padEnd(14)} ${String(r.sommets).padStart(5)} sommets  ` +
    `${String(r.triangles).padStart(5)} triangles  ` +
    `${String(r.morphs).padStart(3)} morphs  ${(octets / 1048576).toFixed(1)} Mo`,
  );

  resultats.push({ piece, ...r });
}

console.log("");

if (!APPLY) {
  console.log("=== SIMULATION (ajouter --apply) ===");
  console.log("Rien écrit.");
} else {
  fs.mkdirSync(SORTIE, { recursive: true });
  let total = 0;
  for (const r of resultats) {
    const cible = `${SORTIE}/mpfb_${r.piece.id}.glb`;
    total += ecrireGlb(cible, r.json, r.bin);
    console.log(`  écrit : ${path.basename(cible)}`);
  }
  console.log("");
  console.log(`=== APPLIQUÉ === ${(total / 1048576).toFixed(0)} Mo dans ${SORTIE}`);
  console.log("");
  console.log("Ensuite :");
  console.log("  1. manifeste + import dans l'ADK");
  console.log("  2. cuire, packager");
  console.log("  3. declarer les pieces dans le generateur du catalogue modulaire");
}