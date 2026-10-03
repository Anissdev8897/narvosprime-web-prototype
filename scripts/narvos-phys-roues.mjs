// ══════════════════════════════════════════════════════════════════════════════
// narvos-phys-roues.mjs — quels OS portent un corps de collision ?
//
//   node scripts/narvos-phys-roues.mjs
//
// ── LA QUESTION ───────────────────────────────────────────────────────────────
// Le doc nanos l'interdit noir sur blanc pour les véhicules :
//   « Do not add physics shapes to the Wheels! it will only cause physics
//     problems »
// (docs/assets-modding/creating-assets/skeletal-meshes/vehicles-meshes.mdx)
//
// Un véhicule qui tremble, s'enfonce ou décolle vient de LÀ, pas des réglages
// de suspension. Encore faut-il savoir si le pack respecte l'interdit.
//
// ── LA MÉTHODE, ET POURQUOI PAS L'AUTRE ───────────────────────────────────────
// Un premier relevé cherchait le mot « sphère » dans le binaire et concluait
// « 8 voitures sur 12 sont fautives, 4 sont propres ». **Faux.** Les quatre
// « propres » portaient des CAPSULES (`KSphylElem`) au lieu de sphères
// (`KSphereElem`) : un volume quand même, donc l'interdit quand même violé.
// Chercher un nom de forme, c'est présumer quelle forme on trouvera.
//
// Ce script cherche l'OS, pas la forme. La table de noms d'un PhysicsAsset ne
// contient que ce qu'il RÉFÉRENCE : un os absent de la table ne porte aucun
// corps. La question « ce squelette a-t-il un corps sur ses roues » se lit donc
// sans ouvrir l'éditeur, et sans rien présumer de la géométrie.
//
// La forme est rapportée EN PLUS, pour information — jamais comme critère.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";

const DIR =
  "E:/narvosprime-web-prototype/WebPortal/Server/Assets/narvos/Narvos/City_Traffic_Pro/Cars/Meshes/Skeletal_Meshes";

// Les 14 chaînes d'os relevées sur `Car_Skeleton` (skill nanos-world §30).
const OS = [
  "Body",
  "Wheel_FL", "Wheel_FR", "Wheel_RL", "Wheel_RR",
  "Headlight_L", "Headlight_R", "HeadlightL", "HeadlightR", "HeadlighR",
  "PlateF", "PlateR", "RegPlateF", "RegPlateR",
];
const ROUES = ["Wheel_FL", "Wheel_FR", "Wheel_RL", "Wheel_RR"];
const FORMES = [
  "KSphereElem", "KSphylElem", "KBoxElem", "KConvexElem",
  "SphereElems", "SphylElems", "BoxElems", "ConvexElems", "TaperedCapsuleElems",
];

function chaines(f) {
  if (!fs.existsSync(f)) return [];
  const b = fs.readFileSync(f);
  const out = [];
  let cur = "";
  for (const o of b) {
    if (o >= 32 && o < 127) cur += String.fromCharCode(o);
    else {
      if (cur.length >= 3) out.push(cur);
      cur = "";
    }
  }
  if (cur.length >= 3) out.push(cur);
  return out;
}

if (!fs.existsSync(DIR)) {
  console.error(`Dossier introuvable : ${DIR}`);
  console.error("Le pack n'est pas cuit, ou le chemin a changé.");
  process.exit(1);
}

const phys = fs
  .readdirSync(DIR)
  .filter((f) => /_PhysicsAsset\.uasset$/.test(f))
  .sort();

if (phys.length === 0) {
  // ⚠ Zéro cible = rouge, jamais « vert par vacuité ».
  console.error("Aucun PhysicsAsset trouvé — le contrôle n'a rien mesuré.");
  process.exit(1);
}

console.log(`${phys.length} PhysicsAsset(s) cuit(s) sous Skeletal_Meshes/\n`);

// ⚠ CE QUE CE CONTRÔLE MESURE — ET CE QU'IL A MESURÉ À TORT
//
// Première version : « l'os `Wheel_FL` est-il dans la table de noms ? ». C'était
// la bonne question tant que la question était « y a-t-il un CORPS sur la roue ».
//
// Le correctif du 2026-09-10 (`scripts/adk-reparer-roues.py`) ne SUPPRIME pas les
// corps — l'API Python de 5.7 ne le permet pas — il VIDE leur géométrie. Les os
// restent donc dans la table de noms, et l'ancien témoin a continué d'annoncer
// « 12 / 12 fautives » sur douze assets réparés. **Quatrième fois de la session
// qu'un témoin mesure autre chose que la question posée.**
//
// La question est maintenant : **reste-t-il un VOLUME sur une roue ?**
// Elle se lit sur les familles de géométrie déclarées :
//   · `KConvexElem` / `ConvexElems`  = les enveloppes de la CARROSSERIE (`Body`),
//     elles doivent RESTER — c'est la collision du véhicule ;
//   · `KSphereElem` / `KSphylElem` / `KBoxElem` = ce que portaient les ROUES
//     (mesuré avant correctif : 8 voitures en sphère, 4 en capsule, rien d'autre).
//
// Aucune sphère, capsule ou boîte dans l'asset ⇒ aucune roue ne porte de volume.
// La vérification faisant AUTORITÉ reste l'éditeur (`adk-reparer-roues.py` en
// mode constat, qui lit `agg_geom` corps par corps) ; ce script est le contrôle
// qui tourne sans lancer Unreal.
const FORMES_ROUE = ["KSphereElem", "KSphylElem", "KBoxElem",
                     "SphereElems", "SphylElems", "BoxElems"];
const FORMES_CARROSSERIE = ["KConvexElem", "ConvexElems"];

let fautifs = 0;
for (const f of phys) {
  const base = f.replace(/\.uasset$/, "");
  const nom = base.replace("_PhysicsAsset", "");
  const s = new Set([
    ...chaines(path.join(DIR, f)),
    ...chaines(path.join(DIR, base + ".uexp")),
  ]);
  const osVus = OS.filter((o) => s.has(o));
  const rouesVues = ROUES.filter((r) => s.has(r));
  const volumesRoue = FORMES_ROUE.filter((k) => s.has(k));
  const carrosserie = FORMES_CARROSSERIE.filter((k) => s.has(k));
  if (volumesRoue.length > 0) fautifs++;

  console.log(
    `${nom.padEnd(30)} ${volumesRoue.length > 0 ? "VOLUME SUR LES ROUES" : "roues sans volume"}`
  );
  console.log(
    `${" ".repeat(31)}corps declares : ${osVus.join(", ")}  (${rouesVues.length}/4 roues)`
  );
  console.log(
    `${" ".repeat(31)}geometrie      : carrosserie [${carrosserie.join(", ") || "AUCUNE"}]` +
      `  roue [${volumesRoue.join(", ") || "aucune"}]`
  );

  // ⚠ Une carrosserie SANS enveloppe serait une régression grave : le véhicule
  // traverserait le décor. Le correctif ne doit vider que les roues — ce
  // contrôle-là n'existait pas avant, et rien ne l'aurait signalé.
  if (carrosserie.length === 0) {
    console.error(`${" ".repeat(31)}ECHEC : la carrosserie a perdu sa collision.`);
    fautifs++;
  }
}

console.log(
  `\n${fautifs} / ${phys.length} portent encore un volume sur une roue — ` +
    `le cas que le doc nanos interdit.`
);

// Contrôle croisé : un SK_ sans PhysicsAsset n'est pas « propre », il est
// non mesuré. La distinction compte.
const sk = fs
  .readdirSync(DIR)
  .filter((f) => /^SK_.*\.uasset$/.test(f) && !/_PhysicsAsset/.test(f));
const sans = sk.filter(
  (f) => !fs.existsSync(path.join(DIR, f.replace(/\.uasset$/, "_PhysicsAsset.uasset")))
);
console.log(
  `${sk.length} SK_ cuits ; sans PhysicsAsset (donc non mesurés) : ` +
    `${sans.length ? sans.join(", ") : "aucun"}`
);