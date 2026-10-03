// ══════════════════════════════════════════════════════════════════════════════
// narvos-os-uasset.mjs — les noms d'os d'un asset de squelette, sans l'éditeur.
//
//   node scripts/narvos-os-uasset.mjs <reference.uasset> <candidat.uasset> [...]
//
// Le premier argument est la RÉFÉRENCE ; les suivants sont comparés à elle.
//
// ── POURQUOI ──────────────────────────────────────────────────────────────────
// `AddSkeletalMeshAttached` exige « le même squelette que le mesh de cet Actor ».
// Savoir si une garde-robe est portable se joue donc sur les NOMS D'OS, et cette
// question se tranche sur disque — pas besoin d'ouvrir Unreal pour compter.
//
// ⚠ CE QUE ÇA NE DIT PAS. Deux squelettes peuvent partager tous leurs noms et
// n'être pas interchangeables : la HIÉRARCHIE (qui est parent de qui) et la POSE
// DE LIAISON comptent autant. `narvos-hierarchie-os.mjs` compare les chaînes
// parentales sur du GLB ; ici on n'a que la table de noms d'un `.uasset`, donc le
// verdict « noms compatibles » est un FEU ORANGE, jamais un feu vert.
//
// ⚠ On lit 1 Mo à chaque bout du fichier : la table de noms d'un `.uasset` vit
// près du début et de la fin, et certains de ces fichiers dépassent 512 Mo — au
// delà, V8 refuse de fabriquer la chaîne (`ERR_STRING_TOO_LONG`).
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";

// Convention Epic : minuscules, suffixe de latéralité `_l`/`_r`, index `_01`.
// On refuse les noms trop courts (bruit binaire) et ceux qui ressemblent à des
// chemins ou à des classes.
const OS = /\b([a-z][a-z0-9]*(?:_[a-z0-9]+){0,4}_(?:l|r)|root|pelvis|spine_\d{2}|neck_\d{2}|head|ik_[a-z_]+)\b/g;

function noms(fichier) {
  const T = 1048576;
  const st = fs.statSync(fichier);
  const fd = fs.openSync(fichier, "r");
  let texte;
  try {
    const a = Buffer.alloc(Math.min(T, st.size));
    fs.readSync(fd, a, 0, a.length, 0);
    const dep = Math.max(0, st.size - T);
    const b = Buffer.alloc(Math.min(T, st.size - dep));
    fs.readSync(fd, b, 0, b.length, dep);
    texte = a.toString("latin1") + " " + b.toString("latin1");
  } finally {
    fs.closeSync(fd);
  }
  return new Set([...texte.matchAll(OS)].map((m) => m[1]));
}

const [ref, ...candidats] = process.argv.slice(2);
if (!ref) {
  console.error("usage : node scripts/narvos-os-uasset.mjs <reference> <candidat> [...]");
  process.exit(1);
}

const osRef = noms(ref);
console.log(`RÉFÉRENCE  ${path.basename(ref)} — ${osRef.size} os reconnus`);
console.log(`  ${[...osRef].sort().slice(0, 12).join(" ")}${osRef.size > 12 ? " …" : ""}`);

for (const c of candidats) {
  const os = noms(c);
  const communs = [...os].filter((x) => osRef.has(x));
  const manquants = [...osRef].filter((x) => !os.has(x));
  const enPlus = [...os].filter((x) => !osRef.has(x));

  // ── LES `ik_*` NE DÉFORMENT RIEN ────────────────────────────────────────────
  // Ce sont des cibles d'animation (IK pieds/mains, `ik_hand_gun`), feuilles sans
  // poids de peau. Les compter comme des os manquants fait rendre « incompatible »
  // un squelette qui porte les 61 os déformants de la référence — c'est ce qu'a
  // fait la première version de ce script sur `Skel_Metahuman` : 61/68 = 89,7 %,
  // sous un seuil de 90 %, verdict « retargeting obligatoire ». Faux, et par un
  // artefact de seuil. Le skill nanos classe déjà cette famille à part (« 67 GLB
  // auxquels ne manquent que des `ik_*` », comptés importables).
  const estIK = (n) => n.startsWith("ik_");
  const manquantsDeformants = manquants.filter((n) => !estIK(n));
  const manquantsIK = manquants.filter(estIK);
  const refDeformants = [...osRef].filter((n) => !estIK(n));
  const couverture = refDeformants.length
    ? ((refDeformants.length - manquantsDeformants.length) / refDeformants.length) * 100
    : 0;

  console.log(`\nCANDIDAT   ${path.basename(c)} — ${os.size} os reconnus`);
  console.log(`  os DÉFORMANTS communs : ${refDeformants.length - manquantsDeformants.length}/${refDeformants.length} (${couverture.toFixed(1)} %)`);
  console.log(`  manquants déformants (${manquantsDeformants.length}) : ${manquantsDeformants.sort().slice(0, 15).join(" ") || "aucun"}`);
  console.log(`  manquants ik_* (${manquantsIK.length}) : ${manquantsIK.sort().join(" ") || "aucun"}  ← ne déforment rien`);
  console.log(`  en plus    (${enPlus.length}) : ${enPlus.sort().slice(0, 12).join(" ")}${enPlus.length > 12 ? " …" : ""}`);

  // ⚠ Le verdict porte sur les NOMS seuls — voir l'avertissement en tête. Il ne
  // dit jamais « compatible », seulement ce qui reste à prouver.
  if (manquantsDeformants.length === 0 && manquantsIK.length === 0) {
    console.log("  → SUR-ENSEMBLE COMPLET par les noms. Reste : hiérarchie + pose de liaison.");
  } else if (manquantsDeformants.length === 0) {
    console.log(`  → tous les os déformants présents ; seuls ${manquantsIK.length} ik_* manquent.`);
    console.log("     Reste à prouver : hiérarchie (chaînes parentales) et pose de liaison.");
  } else {
    console.log(`  → ${manquantsDeformants.length} os DÉFORMANT(S) absent(s) : retargeting obligatoire.`);
  }
}