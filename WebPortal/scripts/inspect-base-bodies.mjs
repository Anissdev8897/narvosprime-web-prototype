// ══════════════════════════════════════════════════════════════════════════════
// inspect-base-bodies.mjs — Les corps de base H/F partagent-ils un squelette ?
//
// Le mannequin Biker est le squelette CANONIQUE : toute pièce découpée d'un
// nouvel asset y sera greffée. Si les corps homme et femme n'ont pas la même
// nomenclature d'os, ce n'est plus un squelette canonique mais deux — et une
// pièce validée sur l'un serait refusée sur l'autre, sans que rien ne le dise.
//
// Usage : node scripts/inspect-base-bodies.mjs
// ══════════════════════════════════════════════════════════════════════════════

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { existsSync } from "node:fs";

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const B = "public/models/personnages/BikerBundle/CharacterParts_Biker/Meshes/UE5_Mannequin_meta";

const CIBLES = [
  ["Homme", `${B}/Male/Bodyparts/SK_ma_UE5_meta_body.glb`],
  ["Femme", `${B}/Female/Bodyparts/SK_fe_UE5_meta_body_muscular_IK.glb`],
];

const sets = {};

for (const [nom, p] of CIBLES) {
  if (!existsSync(p)) { console.log(`${nom.padEnd(6)} ABSENT — ${p}`); continue; }
  try {
    const doc = await io.read(p);
    const skin = doc.getRoot().listSkins()[0];
    const os = skin ? skin.listJoints().map((j) => j.getName()) : [];
    sets[nom] = new Set(os);
    console.log(`${nom.padEnd(6)} ${String(os.length).padStart(4)} os  racine="${os[0] ?? "?"}"`);
  } catch (e) {
    console.log(`${nom.padEnd(6)} ERREUR — ${String(e.message).slice(0, 70)}`);
  }
}

const [a, b] = Object.keys(sets);
if (a && b) {
  const A = sets[a], Bs = sets[b];
  const communs = [...A].filter((n) => Bs.has(n));
  const seulA = [...A].filter((n) => !Bs.has(n));
  const seulB = [...Bs].filter((n) => !A.has(n));
  const recouvrement = (100 * communs.length) / Math.max(A.size, Bs.size);

  console.log(`\ncommuns        : ${communs.length}`);
  console.log(`${a} seul     : ${seulA.length}${seulA.length ? ` (${seulA.slice(0, 6).join(", ")}${seulA.length > 6 ? "…" : ""})` : ""}`);
  console.log(`${b} seule    : ${seulB.length}${seulB.length ? ` (${seulB.slice(0, 6).join(", ")}${seulB.length > 6 ? "…" : ""})` : ""}`);
  console.log(`recouvrement   : ${recouvrement.toFixed(1)} %`);
  console.log(
    recouvrement >= 99
      ? "\n✅ Squelette commun — une pièce validée sur un genre vaut pour l'autre."
      : "\n⚠ Squelettes DIVERGENTS — une pièce compatible d'un genre peut être refusée sur l'autre.",
  );
}