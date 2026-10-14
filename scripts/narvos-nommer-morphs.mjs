// ══════════════════════════════════════════════════════════════════════════════
// narvos-nommer-morphs.mjs — rend leurs noms aux morph targets d'un GLB.
//
//   node scripts/narvos-nommer-morphs.mjs <fichier|dossier> [--apply]
//
// ── LE PROBLÈME ───────────────────────────────────────────────────────────────
// Nos têtes portent 52 morph targets — le compte exact du jeu ARKit — mais le
// glTF ne les nomme pas. Unreal les a donc numérotés à l'import :
//
//     SK_CyberpunkSamurai_Head_mesh_0_17_MorphTarget
//
// La géométrie de chaque expression est intacte ; seule l'étiquette manque. Or
// nanos pilote les morphs par `SetMorphTarget(nom, valeur)` : sans nom
// exploitable, le système existe mais reste inatteignable depuis le Lua.
//
// ── D'OÙ VIENT LA PERTE ───────────────────────────────────────────────────────
// `asset.generator` dit « Unreal Engine 5.8.0 » : ces GLB ont été EXPORTÉS
// depuis Unreal. Les noms existaient dans l'asset d'origine — c'est l'export
// glTF qui les a laissés tomber. Le projet 5.8 source n'est plus sur le disque,
// on ne peut donc pas les y relire.
//
// ── ⚠ L'HYPOTHÈSE, ET COMMENT LA VÉRIFIER ────────────────────────────────────
// On applique l'ordre ARKit canonique d'Apple (`ARFaceAnchor.BlendShapeLocation`,
// 52 entrées, ordre alphabétique). C'est l'ordre qu'emploient les exportateurs
// qui suivent la norme, et 52 cibles sur une tête ne laissent guère de doute sur
// le JEU utilisé — mais l'ORDRE, lui, reste une hypothèse.
//
// Se tromper d'ordre n'échoue jamais : ça étiquette simplement un sourire en
// clignement d'œil, sans que rien ne le signale. D'où la commande `/morph` du
// serveur, qui pousse une cible à 1 et laisse regarder le visage. Vérifier trois
// noms évidents suffit — `jawOpen`, `eyeBlinkLeft`, `mouthSmileLeft`.
//
// Si l'ordre s'avère faux, seule la constante ARKIT ci-dessous change.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";
// Chemin explicite vers le dist : ce script vit dans `scripts/` à la racine du
// dépôt, alors que gltf-transform est installé sous `WebPortal/node_modules`.
// Un specifier nu (`@gltf-transform/core`) ne résoudrait que depuis WebPortal —
// c'est pourquoi `puzzle-chunks.mjs`, qui y vit, peut se le permettre.
import { NodeIO } from "../WebPortal/node_modules/@gltf-transform/core/dist/index.js";
import { ALL_EXTENSIONS } from "../WebPortal/node_modules/@gltf-transform/extensions/dist/index.js";

/**
 * Les 52 blendshapes ARKit, dans l'ordre canonique d'Apple.
 * Source : `ARFaceAnchor.BlendShapeLocation`. L'ordre est alphabétique et c'est
 * lui que suivent les exportateurs conformes.
 */
const ARKIT = [
  "browDownLeft", "browDownRight", "browInnerUp", "browOuterUpLeft", "browOuterUpRight",
  "cheekPuff", "cheekSquintLeft", "cheekSquintRight",
  "eyeBlinkLeft", "eyeBlinkRight",
  "eyeLookDownLeft", "eyeLookDownRight", "eyeLookInLeft", "eyeLookInRight",
  "eyeLookOutLeft", "eyeLookOutRight", "eyeLookUpLeft", "eyeLookUpRight",
  "eyeSquintLeft", "eyeSquintRight", "eyeWideLeft", "eyeWideRight",
  "jawForward", "jawLeft", "jawOpen", "jawRight",
  "mouthClose", "mouthDimpleLeft", "mouthDimpleRight",
  "mouthFrownLeft", "mouthFrownRight", "mouthFunnel", "mouthLeft",
  "mouthLowerDownLeft", "mouthLowerDownRight", "mouthPressLeft", "mouthPressRight",
  "mouthPucker", "mouthRight", "mouthRollLower", "mouthRollUpper",
  "mouthShrugLower", "mouthShrugUpper", "mouthSmileLeft", "mouthSmileRight",
  "mouthStretchLeft", "mouthStretchRight", "mouthUpperUpLeft", "mouthUpperUpRight",
  "noseSneerLeft", "noseSneerRight", "tongueOut",
];

const cible = process.argv[2];
const APPLY = process.argv.includes("--apply");

if (!cible || !fs.existsSync(cible)) {
  console.error("Usage : node scripts/narvos-nommer-morphs.mjs <fichier|dossier> [--apply]");
  process.exit(1);
}

if (ARKIT.length !== 52) {
  // Garde-fou : une entrée perdue en éditant la liste décalerait TOUS les noms
  // suivants, et le défaut ne se verrait qu'à l'écran.
  console.error(`La table ARKit doit compter 52 entrées, elle en a ${ARKIT.length}.`);
  process.exit(1);
}

// ─── collecte ─────────────────────────────────────────────────────────────────

const fichiers = [];
const collecter = (p) => {
  const st = fs.statSync(p);
  if (st.isFile()) {
    if (p.toLowerCase().endsWith(".glb")) fichiers.push(p);
    return;
  }
  for (const e of fs.readdirSync(p, { withFileTypes: true })) collecter(path.join(p, e.name));
};
collecter(cible);

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

console.log(APPLY ? "=== APPLIQUÉ ===" : "=== SIMULATION (ajouter --apply) ===");
console.log(`  ${fichiers.length} GLB à examiner`);
console.log("");

let nommes = 0;
let ignores = 0;

for (const f of fichiers) {
  let doc;
  try {
    doc = await io.read(f);
  } catch (err) {
    console.log(`  ILLISIBLE ${path.basename(f)} — ${err.message.split("\n")[0]}`);
    continue;
  }

  const meshes = doc.getRoot().listMeshes();
  let touche = false;

  for (const mesh of meshes) {
    const prim = mesh.listPrimitives()[0];
    if (!prim) continue;

    const cibles = prim.listTargets().length;
    if (cibles === 0) continue;

    // On ne nomme QUE ce qu'on sait nommer. 52 cibles = le jeu ARKit ; tout
    // autre compte est un rig différent, et y plaquer des noms ARKit serait
    // pire que de ne rien faire.
    if (cibles !== 52) {
      console.log(`  IGNORÉ    ${path.basename(f)} — ${cibles} cibles, pas 52 (rig inconnu)`);
      ignores++;
      continue;
    }

    const extras = mesh.getExtras() ?? {};
    if (Array.isArray(extras.targetNames) && extras.targetNames.length === 52) {
      console.log(`  DÉJÀ NOMMÉ ${path.basename(f)}`);
      continue;
    }

    // `mesh.extras.targetNames` est la convention que lit l'importeur glTF
    // d'Unreal. Les poids par défaut vont de pair : leur absence est ce qui
    // déclenchait l'avertissement « MorphTargetNames count does not match its
    // MorphTargetWeights count ».
    mesh.setExtras({ ...extras, targetNames: [...ARKIT] });
    mesh.setWeights(new Array(52).fill(0));

    // Nommer aussi chaque cible : gltf-transform les expose individuellement, et
    // certains outils lisent là plutôt que dans les extras.
    prim.listTargets().forEach((t, i) => t.setName(ARKIT[i]));

    touche = true;
  }

  if (!touche) continue;

  console.log(`  NOMMÉ     ${path.basename(f)}  → 52 blendshapes ARKit`);
  nommes++;

  if (APPLY) {
    // Écriture en place : le GLB source EST notre source de vérité, et en
    // garder deux versions garantirait qu'on réimporte un jour la mauvaise.
    await io.write(f, doc);
  }
}

console.log("");
console.log(`${nommes} fichier(s) nommé(s), ${ignores} ignoré(s).`);

if (!APPLY) {
  console.log("");
  console.log("Rien écrit.");
} else if (nommes > 0) {
  console.log("");
  console.log("Ensuite : réimporter ces GLB, recuire, puis VÉRIFIER en jeu avec");
  console.log("  /morph jawOpen 1      la mâchoire doit s'ouvrir");
  console.log("  /morph eyeBlinkLeft 1 l'œil GAUCHE doit se fermer");
  console.log("Si un nom ne fait pas ce qu'il dit, l'ordre ARKit ne correspond pas");
  console.log("à celui de l'export — seule la table ARKIT de ce script est à revoir.");
}