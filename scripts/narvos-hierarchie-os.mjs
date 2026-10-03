// ══════════════════════════════════════════════════════════════════════════════
// narvos-hierarchie-os.mjs — deux squelettes ont-ils la même CHAÎNE PARENTALE ?
//
//   node scripts/narvos-hierarchie-os.mjs <reference.glb> <candidat.glb>
//
// ── POURQUOI CET OUTIL EXISTE ─────────────────────────────────────────────────
// `narvos-skeleton-compat.mjs` comparait des ENSEMBLES DE NOMS. Sur ce projet,
// il a rendu « importable » des MetaHuman qui INTERCALENT `spine_04`, `spine_05`
// et `neck_02` dans la chaîne — et qui sont pondérés dessus. Quatorze assets ont
// été importés et cuits sur la foi de ce verdict, à tort.
//
// Un nom présent ne dit RIEN. Ce qui compte est : `spine_03` a-t-il le même
// parent des deux côtés ? Si la référence enchaîne
//
//     spine_03 -> neck_01
//
// et le candidat
//
//     spine_03 -> spine_04 -> spine_05 -> neck_01
//
// alors une animation faite pour la référence ne pilote NI spine_04 NI spine_05.
// Le haut du corps reste figé pendant que le reste bouge, et rien ne le signale.
//
// ── LES TROIS VERDICTS ────────────────────────────────────────────────────────
//   IDENTIQUE   chaque os commun a le même parent — interchangeable
//   INTERCALE   des os s'insèrent DANS une chaîne commune — animations fausses
//   REPARENTE   un os commun change de parent — pire, le membre part ailleurs
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";

function entete(fichier) {
  const fd = fs.openSync(fichier, "r");
  try {
    const h = Buffer.alloc(12);
    fs.readSync(fd, h, 0, 12, 0);
    if (h.toString("utf8", 0, 4) !== "glTF") return null;
    const c = Buffer.alloc(8);
    fs.readSync(fd, c, 0, 8, 12);
    const taille = c.readUInt32LE(0);
    const j = Buffer.alloc(taille);
    fs.readSync(fd, j, 0, taille, 20);
    return JSON.parse(j.toString("utf8"));
  } catch {
    return null;
  } finally {
    fs.closeSync(fd);
  }
}

/** Table `os -> parent` du premier skin. Les noms sont normalisés en minuscules :
 *  `Root` et `root` sont le même os, et une casse ne casse aucune animation. */
function hierarchie(gltf) {
  const skin = (gltf.skins ?? [])[0];
  if (!skin) return null;

  const parentDe = new Map();
  for (const [i, n] of (gltf.nodes ?? []).entries()) {
    for (const enfant of n.children ?? []) parentDe.set(enfant, i);
  }

  const nom = (i) => ((gltf.nodes[i] ?? {}).name ?? `#${i}`).toLowerCase();

  const table = new Map();
  for (const j of skin.joints) {
    const p = parentDe.get(j);
    table.set(nom(j), p === undefined ? null : nom(p));
  }
  return table;
}

const [fichierRef, fichierCand] = process.argv.slice(2);
if (!fichierRef || !fichierCand) {
  console.error("Usage : node scripts/narvos-hierarchie-os.mjs <reference.glb> <candidat.glb>");
  process.exit(1);
}

const ref = hierarchie(entete(fichierRef) ?? {});
const cand = hierarchie(entete(fichierCand) ?? {});

if (!ref || !cand) {
  console.error("Un des deux fichiers n'a pas de skin lisible.");
  process.exit(1);
}

console.log(`reference : ${path.basename(fichierRef)}  ${ref.size} os`);
console.log(`candidat  : ${path.basename(fichierCand)}  ${cand.size} os`);
console.log("");

const communs = [...ref.keys()].filter((n) => cand.has(n));
const absents = [...ref.keys()].filter((n) => !cand.has(n));

console.log(`${communs.length} / ${ref.size} os de la reference presents chez le candidat`);
if (absents.length) console.log(`  ABSENTS : ${absents.join(", ")}`);

// ── Le contrôle qui compte ────────────────────────────────────────────────────
//
// Pour chaque os commun, on compare son parent. Trois cas se distinguent, et
// seule la distinction rend le verdict utile :
//
//   · même parent                       → rien à signaler
//   · parent du candidat INCONNU de la
//     référence, mais qui REMONTE au
//     même parent de référence          → os INTERCALÉ
//   · parent connu mais DIFFÉRENT       → os REPARENTÉ

/** Remonte la chaîne du candidat jusqu'au premier os que la référence connaît. */
function ancetreConnu(os) {
  const vus = new Set();
  let courant = cand.get(os);
  while (courant && !vus.has(courant)) {
    if (ref.has(courant)) return courant;
    vus.add(courant);
    courant = cand.get(courant);
  }
  return null;
}

const intercales = [];
const reparentes = [];

for (const os of communs) {
  const parentRef = ref.get(os);
  const parentCand = cand.get(os);

  if (parentRef === parentCand) continue;
  if (parentRef === null || parentCand === null) continue;   // racines

  if (!ref.has(parentCand)) {
    // Le parent immédiat est inconnu de la référence. S'il remonte au bon
    // endroit, ce sont des os INSÉRÉS dans la chaîne — le cas MetaHuman.
    const remonte = ancetreConnu(os);
    if (remonte === parentRef) intercales.push({ os, via: parentCand });
    else reparentes.push({ os, attendu: parentRef, obtenu: parentCand });
  } else {
    reparentes.push({ os, attendu: parentRef, obtenu: parentCand });
  }
}

console.log("");
if (reparentes.length > 0) {
  console.log(`VERDICT : REPARENTE — ${reparentes.length} os changent de parent`);
  for (const r of reparentes.slice(0, 10)) {
    console.log(`  ${r.os} : attendu sous ${r.attendu}, trouve sous ${r.obtenu}`);
  }
  console.log("");
  console.log("Un membre entier suivra le mauvais os. Ce squelette n'est PAS");
  console.log("interchangeable avec la reference, et aucun renommage n'y changera rien.");
  process.exitCode = 1;
} else if (intercales.length > 0) {
  console.log(`VERDICT : INTERCALE — ${intercales.length} os s'inserent dans la chaine`);
  for (const i of intercales.slice(0, 10)) {
    console.log(`  ${i.os} passe desormais par ${i.via}`);
  }
  console.log("");
  console.log("Les os inseres ne sont pilotes par AUCUNE animation de la reference.");
  console.log("Utilisable comme corps AUTONOME avec ses propres animations, jamais");
  console.log("comme piece attachee a un corps de la reference.");
} else {
  console.log("VERDICT : IDENTIQUE — chaque os commun a le meme parent.");
  console.log("Les animations de la reference pilotent ce squelette correctement.");
}

// Les os supplémentaires qui ne s'intercalent pas (feuilles ajoutées : doigts,
// IK, twists terminaux) sont inoffensifs — ils pendent au bout d'une chaîne
// pilotée. On les compte sans en faire un verdict.
const enPlus = [...cand.keys()].filter((n) => !ref.has(n));
const feuillesAjoutees = enPlus.filter((n) => !intercales.some((i) => i.via === n));
if (enPlus.length) {
  console.log("");
  console.log(`${enPlus.length} os en plus chez le candidat, dont ${feuillesAjoutees.length} hors chaine`);
}