// ══════════════════════════════════════════════════════════════════════════════
// narvos-morphs-vers-glb.mjs — cuit les morphs MakeHuman DANS le GLB.
//
//   node scripts/narvos-morphs-vers-glb.mjs [--apply] [--zones nose,mouth]
//
// ── POURQUOI CE SCRIPT EXISTE ─────────────────────────────────────────────────
// Le prototype web applique les morphs en CPU : `applyMorphs` déforme un tableau
// de positions à chaque mouvement de curseur, puis réécrit le buffer Three.js.
// Rien de tout cela n'est transposable à nanos — le Lua n'a aucun accès aux
// sommets.
//
// nanos pilote la morphologie par `SetMorphTarget(nom, valeur)`, ce qui exige
// que les morphs soient CUITS dans le SkeletalMesh. Ce script fait la
// conversion : `.morphs` MakeHuman ──> morph targets glTF.
//
// ── LES DEUX ESPACES, ET C'EST TOUT LE SUJET ──────────────────────────────────
//   CANONIQUE  19 158 sommets, l'ordre de `base.obj`. Les morphs y sont indexés.
//              Il contient les 5 778 helpers MakeHuman, invisibles.
//   RENDU      14 517 + 160 sommets, ce que le GLB porte réellement, avec des
//              sommets DUPLIQUÉS aux coutures UV.
//
// Le GLB embarque `_MORPH_INDEX` : pour chaque sommet de rendu, son index
// canonique. C'est lui qui fait le pont, et les deux sommets d'une couture
// partagent le même index canonique — ils reçoivent donc le MÊME delta, ce qui
// est exactement ce qu'il faut pour que le maillage ne se fende pas.
//
// ── DENSE, PAS SPARSE ─────────────────────────────────────────────────────────
// Mesuré : 290 morphs de visage pèsent 3,15 Mo en creux contre 48,7 Mo en dense.
// On écrit quand même DENSE, parce que rien ne garantit qu'Interchange lise les
// accessors `sparse` de glTF, et qu'un import qui échoue coûte plus cher que
// 45 Mo sur un pack qui en pèse 31 000. Unreal restocke les deltas de façon
// creuse de son côté.
//
// ── UNITÉS ────────────────────────────────────────────────────────────────────
// Les deltas MakeHuman sont en DÉCIMÈTRES, le corps riggé en MÈTRES
// (`morphUnitScale: 0.1` dans les extras du GLB). L'oublier ne lève rien : le
// visage se déforme DIX FOIS trop, et on croit à des morphs cassés.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";

const BODY = "E:/narvosprime-web-prototype/WebPortal/public/models/personnages/_body";
const SOURCE = `${BODY}/base_skinned.glb`;
const CIBLE = `${BODY}/base_morphable.glb`;

const APPLY = process.argv.includes("--apply");

/** Zones du VISAGE. Les macros du corps (`macrodetails`, 340 morphs, 41 Mo) sont
 *  volontairement exclues : elles relèvent du gabarit général, pas du réglage
 *  fin que l'écran de création propose, et elles tripleraient le fichier. */
const ZONES_DEFAUT = [
  "nose", "mouth", "eyes", "ears", "cheek", "chin",
  "forehead", "eyebrows", "head", "neck",

  // ⚠ `macrodetails` N'EST PAS UNE ZONE DE CURSEURS. Ses 340 morphs sont les
  // ANCRES d'une grille — `universal-male-young-maxmuscle-minweight`,
  // `height/female-old-averagemuscle-averageweight-maxheight`. Aucun ne se
  // regle seul : ce sont six curseurs de haut niveau (genre, age, muscle,
  // poids, taille, ethnie) qui repartissent leur poids entre les ancres qui
  // les encadrent, et c'est ce que fait `Logic/Macros.lua`.
  //
  // Elles sont DENSES, contrairement aux zones du visage : 15 247 sommets
  // touches en moyenne sur 14 677. Le creux couterait 79 Mo la ou le dense en
  // coute 57 — c'est le seul cas du projet ou le dense gagne aussi en taille.
  "macrodetails",
];

const argZones = process.argv.indexOf("--zones");
const ZONES = argZones >= 0 && process.argv[argZones + 1]
  ? process.argv[argZones + 1].split(",").map((z) => z.trim()).filter(Boolean)
  : ZONES_DEFAUT;

/** Morphs ecartes, meme quand leur zone est demandee.
 *
 * ⚠ `proportions/` — 108 morphs, ~18 Mo. Ni le prototype web ni nanos ne les
 * emploient : les reglages d'epaules, de taille et de longueur de bras se font
 * par MISE A L'ECHELLE D'OS, pas par morph target. `bodyProportions.ts`
 * explique pourquoi — les cibles MPFB2 sont indexees sur une topologie
 * differente de celle des tetes du jeu, et les appliquer donnerait du bruit.
 *
 * Les cuire quand meme n'aurait pas ete faux, juste inutile : 108 morph targets
 * qu'aucun code ne peut activer, portes par chaque instance du mesh.
 */
const EXCLUS = [
  /^proportions\//,
];

const estExclu = (nom) => EXCLUS.some((r) => r.test(nom));

// ── Lecture du GLB ────────────────────────────────────────────────────────────

/** Rend { json, bin } d'un GLB binaire. */
function lireGlb(fichier) {
  const buf = fs.readFileSync(fichier);
  if (buf.toString("utf8", 0, 4) !== "glTF") throw new Error("pas un GLB : " + fichier);

  let offset = 12;
  let json = null;
  let bin = null;

  while (offset < buf.length) {
    const taille = buf.readUInt32LE(offset);
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
    // espaces : le test `type === "BIN"` echouait donc, `bin` restait vide, et
    // la premiere lecture d'accessor sortait des bornes. Une heure perdue le
    // 2026-09-04.
// [TROU — ligne jamais lue dans les transcriptions]
    const debut = offset + 8;

    if (type === "JSON") json = JSON.parse(buf.toString("utf8", debut, debut + taille));
    else if (type === "BIN") bin = buf.subarray(debut, debut + taille);

    // Chaque chunk est aligné sur 4 octets.
    offset = debut + taille + ((4 - (taille % 4)) % 4);
  }

  if (!json) throw new Error("chunk JSON absent");
  if (!bin || bin.length === 0) {
    throw new Error(`chunk BIN absent ou vide dans ${path.basename(fichier)} — `
      + "le GLB est-il bien binaire, et le type du chunk bien reconnu ?");
  }
  return { json, bin };
}

/** Écrit un GLB depuis { json, bin }. */
function ecrireGlb(fichier, json, bin) {
  const texte = Buffer.from(JSON.stringify(json), "utf8");
  const bourrageJson = (4 - (texte.length % 4)) % 4;
  const bourrageBin = (4 - (bin.length % 4)) % 4;

  const chunkJson = Buffer.concat([texte, Buffer.alloc(bourrageJson, 0x20)]);
  const chunkBin = Buffer.concat([bin, Buffer.alloc(bourrageBin, 0)]);

  const total = 12 + 8 + chunkJson.length + 8 + chunkBin.length;
  const out = Buffer.alloc(total);

  out.write("glTF", 0, "utf8");
  out.writeUInt32LE(2, 4);
  out.writeUInt32LE(total, 8);

  out.writeUInt32LE(chunkJson.length, 12);
  out.write("JSON", 16, "utf8");
  chunkJson.copy(out, 20);

  const posBin = 20 + chunkJson.length;
  out.writeUInt32LE(chunkBin.length, posBin);
  out.write("BIN\0", posBin + 4, "utf8");
  chunkBin.copy(out, posBin + 8);

  fs.writeFileSync(fichier, out);
  return total;
}

const TYPES = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
const COMPOSANTES = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

/** Lit un accessor en tableau typé, ENTRELACÉ OU NON.
 *
 *  ⚠ `base_skinned.glb` entrelace tous ses attributs dans une seule bufferView
 *  de stride 48 : POSITION à 0, JOINTS_0 à 12, WEIGHTS_0 à 20, `_MORPH_INDEX` à
 *  36, TEXCOORD_0 à 40. Une lecture qui ignore le stride ramènerait les octets
 *  des attributs VOISINS et rendrait des index canoniques absurdes — sans
 *  erreur, avec un visage qui se déforme n'importe où.
 *
 *  On recopie donc élément par élément quand le stride ne colle pas, plutôt que
 *  de pointer directement dans le buffer. */
function lireAccessor(json, bin, index) {
  const a = json.accessors[index];
  const vue = json.bufferViews[a.bufferView];
  const Type = TYPES[a.componentType];
  if (!Type) throw new Error("componentType inconnu : " + a.componentType);

  const composantes = COMPOSANTES[a.type];
  const taille = Type.BYTES_PER_ELEMENT;
  const stride = vue.byteStride ?? taille * composantes;
  const debut = (vue.byteOffset ?? 0) + (a.byteOffset ?? 0);

  // ⚠ DataView ET NON UNE VUE TYPEE DIRECTE. Un `Buffer` Node est decoupe dans
  // un pool partage : son `byteOffset` n'est PAS garanti multiple de 4, et
  // `new Uint32Array(buffer, offset, n)` leve alors « Invalid typed array
  // length » — ou pire, ne leve pas et lit de travers. DataView accepte
  // n'importe quel alignement.
  const dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
  const lire = {
    5120: (o) => dv.getInt8(o),
    5121: (o) => dv.getUint8(o),
    5122: (o) => dv.getInt16(o, true),
    5123: (o) => dv.getUint16(o, true),
    5125: (o) => dv.getUint32(o, true),
    5126: (o) => dv.getFloat32(o, true),
  }[a.componentType];

  const out = new Type(a.count * composantes);
  for (let i = 0; i < a.count; i++) {
    for (let c = 0; c < composantes; c++) {
      out[i * composantes + c] = lire(debut + i * stride + c * taille);
    }
  }
  return out;
}


// ── Lecture des packs de morphs ───────────────────────────────────────────────

/** Un pack `.morphs` : en-tête JSON puis indices Uint16 et deltas Int16. */
function lirePack(region) {
  const buf = fs.readFileSync(`${BODY}/morphs/${region}.morphs`);
  const len = buf.readUInt32LE(0);
  const entete = JSON.parse(buf.subarray(4, 4 + len).toString("utf8").replace(/\0+$/, ""));
  const base = 4 + len;

  const morphs = entete.morphs.map((m) => ({
    name: m.name,
    count: m.count,
    scale: m.scale,
    indices: new Uint16Array(buf.buffer, buf.byteOffset + base + m.indexOffset, m.count),
    deltas: new Int16Array(buf.buffer, buf.byteOffset + base + m.deltaOffset, m.count * 3),
  }));

  return { region: entete.region, canonicalVertexCount: entete.canonicalVertexCount, morphs };
}

// ── Conversion ────────────────────────────────────────────────────────────────

const { json, bin } = lireGlb(SOURCE);

const canonique = json.extras?.canonicalVertexCount;
const echelle = json.extras?.morphUnitScale ?? 0.1;
if (!canonique) throw new Error("le GLB ne declare pas canonicalVertexCount");

console.log(`source   : ${path.basename(SOURCE)}  (${(fs.statSync(SOURCE).size / 1048576).toFixed(2)} Mo)`);
console.log(`canonique: ${canonique} sommets, echelle ${echelle}`);

const mesh = json.meshes[0];
const primitives = mesh.primitives;

// La table de correspondance rendu -> canonique, une par primitive.
const morphIndex = primitives.map((p) => {
  const i = p.attributes._MORPH_INDEX;
  if (i === undefined) throw new Error("_MORPH_INDEX absent d'une primitive");
  return lireAccessor(json, bin, i);
});

console.log(`primitives: ${primitives.map((p, i) => `${morphIndex[i].length} sommets`).join(", ")}`);

// Chargement des packs demandés.
const tous = [];
for (const zone of ZONES) {
  const pack = lirePack(zone);
  if (pack.canonicalVertexCount !== canonique) {
    throw new Error(`zone ${zone} : espace ${pack.canonicalVertexCount}, mesh ${canonique} — incompatibles`);
  }
  let ecartes = 0;
  for (const m of pack.morphs) {
    if (estExclu(m.name)) { ecartes++; continue; }
    tous.push({ zone, ...m });
  }
  if (ecartes > 0) console.log(`  ${zone} : ${ecartes} morph(s) ecarte(s)`);
}

console.log(`morphs   : ${tous.length} sur ${ZONES.length} zone(s) — ${ZONES.join(", ")}`);
console.log("");

// ⚠ TOUTES LES PRIMITIVES DOIVENT AVOIR LE MÊME NOMBRE DE TARGETS, dans le MÊME
// ordre : `mesh.weights` est unique pour le mesh entier, et l'indice N y désigne
// le N-ième target de CHAQUE primitive. Un morph qui ne touche pas les yeux
// reçoit donc un target nul plutôt que d'être omis.

const morceaux = [bin];
let offsetBin = bin.length;

/** Ajoute un bufferView + accessor pour un Float32Array VEC3, rend l'index. */
function ajouterAccessorVec3(donnees, min, max) {
  const octets = Buffer.from(donnees.buffer, donnees.byteOffset, donnees.byteLength);

  // glTF exige que `byteOffset` d'un accessor soit un multiple de la taille du
  // composant. Un Float32 en demande 4 : on aligne avant d'ecrire.
  const bourrage = (4 - (offsetBin % 4)) % 4;
  if (bourrage) {
    morceaux.push(Buffer.alloc(bourrage));
    offsetBin += bourrage;
  }

  json.bufferViews.push({ buffer: 0, byteOffset: offsetBin, byteLength: octets.length });
  morceaux.push(octets);
  offsetBin += octets.length;

  json.accessors.push({
    bufferView: json.bufferViews.length - 1,
    componentType: 5126,
    count: donnees.length / 3,
    type: "VEC3",
    min,
    max,
  });
  return json.accessors.length - 1;
}

for (const p of primitives) p.targets = [];
const noms = [];

let ecrits = 0;
for (const m of tous) {
  // Delta par index CANONIQUE, une seule fois — il servira aux deux primitives.
  const parCanon = new Map();
  for (let k = 0; k < m.count; k++) {
    parCanon.set(m.indices[k], [
      m.deltas[k * 3] * m.scale * echelle,
      m.deltas[k * 3 + 1] * m.scale * echelle,
      m.deltas[k * 3 + 2] * m.scale * echelle,
    ]);
  }

  for (let pi = 0; pi < primitives.length; pi++) {
    const table = morphIndex[pi];
    const n = table.length;
    const out = new Float32Array(n * 3);

    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    let touche = 0;

    for (let i = 0; i < n; i++) {
      const d = parCanon.get(table[i]);
      if (!d) continue;
      // ⚠ AXES. Le GLB est en repere glTF (Y haut, Z avant) comme les deltas,
      // puisque les deux viennent de la meme chaine `mpfb-*`. Aucune permutation
      // ici : en ajouter une par precaution tordrait le visage.
      out[i * 3] = d[0];
      out[i * 3 + 1] = d[1];
      out[i * 3 + 2] = d[2];
      touche++;
      for (let c = 0; c < 3; c++) {
        if (d[c] < min[c]) min[c] = d[c];
        if (d[c] > max[c]) max[c] = d[c];
      }
    }

    // Un target qui ne touche RIEN garde des bornes finies : `Infinity` dans le
    // JSON n'est pas du glTF valide, et Interchange refuserait le fichier.
    if (touche === 0) {
      min.fill(0);
      max.fill(0);
    }

    primitives[pi].targets.push({ POSITION: ajouterAccessorVec3(out, min, max) });
  }

  noms.push(m.name);
  ecrits++;
  if (ecrits % 50 === 0) process.stdout.write(`  ${ecrits} / ${tous.length}\r`);
}

// `targetNames` est ce que lit Unreal pour NOMMER les morph targets. Sans lui,
// ils arrivent numerotes (`..._MorphTarget_17`) et `SetMorphTarget(nom, …)`
// devient inatteignable depuis le Lua — piege deja rencontre sur les 52 cibles
// ARKit des tetes CyberpunkSamurai.
mesh.extras = { ...(mesh.extras ?? {}), targetNames: noms };
mesh.weights = new Array(noms.length).fill(0);

json.extras = {
  ...(json.extras ?? {}),
  morphZones: ZONES,
  morphCount: noms.length,
  generator: "narvos-morphs-vers-glb",
};

const binFinal = Buffer.concat(morceaux);
json.buffers = [{ byteLength: binFinal.length }];

console.log(`targets  : ${noms.length} par primitive, ${noms.length * primitives.length} accessors ajoutes`);
console.log(`binaire  : ${(bin.length / 1048576).toFixed(2)} Mo -> ${(binFinal.length / 1048576).toFixed(1)} Mo`);
console.log("");

if (!APPLY) {
  console.log("=== SIMULATION (ajouter --apply) ===");
  console.log("Rien écrit.");
} else {
  const taille = ecrireGlb(CIBLE, json, binFinal);
  console.log("=== APPLIQUÉ ===");
  console.log(`  écrit : ${CIBLE}  (${(taille / 1048576).toFixed(1)} Mo)`);
  console.log("");
  console.log("Ensuite :");
  console.log("  1. importer dans l'ADK (manifeste + adk-import-narvos.py)");
  console.log("  2. verifier les NOMS avec scripts/adk-probe-morphs.py");
  console.log("  3. cuire, packager, ajouter la famille `mpfb` au catalogue");
}