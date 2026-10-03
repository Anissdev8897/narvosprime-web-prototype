// ══════════════════════════════════════════════════════════════════════════════
// narvos-audit-squelettes-creatures.mjs — combien de squelettes DIFFERENTS nos
// creatures utilisent-elles vraiment, et lesquels peuvent se rejoindre ?
//
//   node scripts/narvos-audit-squelettes-creatures.mjs [dossier...] [--detail]
//
// ── POURQUOI PAS narvos-skeleton-compat.mjs ───────────────────────────────────
// Cet outil-la repond a UNE question : « ce GLB partage-t-il les 68 os de
// SKEL_Mannequin ? ». Sur nos creatures il repond « 2 os, ETRANGER » pour tout
// le monde — ce qui est vrai (2 noms en commun) et inutile : ca ne dit pas si
// deux creatures partagent leur squelette ENTRE ELLES.
//
// ⚠ ET IL A DEJA INDUIT EN ERREUR. L'en-tete de `Server/Spawner.lua` le note :
// « On avait d'abord cru les PNJ non riggés : narvos-skeleton-compat.mjs leur
// comptait un ou deux os. C'était FAUX. » Mesure directe ici : le soldat humain
// porte 24 joints, le zombi 46, le lion 17. Ils sont riggés — sur d'AUTRES
// conventions de nommage.
//
// Ce script mesure donc ce qui decide vraiment du regroupement :
//   · le nombre de joints
//   · la CONVENTION de nommage (Mixamo, Rigify, UE4, Blender brut, custom)
//   · l'empreinte du squelette : la liste triee des noms d'os, hachee.
//     Deux creatures de meme empreinte partagent LE MEME squelette et peuvent
//     donc partager un Body — c'est ca, la question posee.
//   · les animations embarquees, car les garder est une consigne explicite
//   · la morphologie : biped ou quadrupede, deduite des noms d'os
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const RACINE = "E:/narvosprime-web-prototype/WebPortal/public/models";
const DEFAUT = ["pnj", "pnj_monstre", "pet", "personnages"];

const args = process.argv.slice(2);
const DETAIL = args.includes("--detail");
const dossiers = args.filter((a) => !a.startsWith("--"));
const cibles = (dossiers.length ? dossiers : DEFAUT).map((d) =>
  path.isAbsolute(d) ? d : path.join(RACINE, d),
);

// ── Lecture d'un GLB : uniquement l'en-tete JSON ─────────────────────────────
//
// Un GLB de 18 Mo n'a pas besoin d'etre lu en entier pour compter ses os : le
// bloc JSON est en tete et fait quelques kilo-octets. On lit donc juste ce
// qu'il faut — sinon un balayage de 1 500 fichiers rendrait la main en minutes.
function enTete(fichier) {
  let fd;
  try {
    fd = fs.openSync(fichier, "r");
    const entete = Buffer.alloc(20);
    if (fs.readSync(fd, entete, 0, 20, 0) < 20) return null;
    if (entete.toString("ascii", 0, 4) !== "glTF") return null;
    const taille = entete.readUInt32LE(12);
    if (taille <= 0 || taille > 64 * 1024 * 1024) return null;
    const bloc = Buffer.alloc(taille);
    fs.readSync(fd, bloc, 0, taille, 20);
    return JSON.parse(bloc.toString("utf8"));
  } catch {
    return null;
  } finally {
    if (fd !== undefined) try { fs.closeSync(fd); } catch { /* rien */ }
  }
}

// ── La convention de nommage ─────────────────────────────────────────────────
//
// C'est elle qui decide du COUT du regroupement : deux squelettes de meme
// convention se remappent avec la MEME table ; deux conventions differentes en
// demandent deux. Reconnaitre la convention, c'est donc compter le travail.
function convention(noms) {
  const j = noms.join(" ");
  if (/\bDEF-spine\b|\bDEF-thigh/.test(j)) return "Rigify";
  if (/\bLeftUpLeg\b|\bRightForeArm\b|\bLeftForeArm\b/.test(j)) return "Mixamo";
  if (/\bupperarm_[lr]\b|\bthigh_[lr]\b/.test(j)) return "UE4 Mannequin";
  if (/\bleftUpperArm\b|\bleftLowerArm\b/.test(j)) return "VRM";
  if (/^Bone(\.\d+)?$/.test(noms[0] || "") && noms.filter((n) => /^Bone(\.\d+)?$/.test(n)).length > noms.length / 2)
    return "Blender brut";
  if (/\bClavicle_[LR]\b|\bSpine_0\d\b/.test(j)) return "custom PascalCase";
  return "inconnue";
}

// ── Biped ou quadrupede ──────────────────────────────────────────────────────
//
// On cherche des marqueurs de PATTES AVANT. Un biped a des bras (`arm`, `hand`,
// `Shoulder`) ; un quadrupede a une hanche avant (`front_thigh`, `foreleg`) ou
// des bras absents avec quatre chaines de pattes. Le doute est declare, pas
// devine : « ? » vaut mieux qu'une etiquette fausse sur laquelle on planifiera.
function morphologie(noms) {
  const j = noms.join(" ").toLowerCase();
  if (/front_thigh|foreleg|frontleg|paw|tail_0|hock/.test(j)) return "quadrupede";
  const bras = /(hand|forearm|lowerarm|upperarm|leftarm|rightarm)/.test(j);
  const jambes = (j.match(/thigh|upleg|femur|calf|shin/g) || []).length;
  if (!bras && jambes >= 4) return "quadrupede";
  if (bras) return "biped";
  return "?";
}

function glbs(racine) {
  const out = [];
  const pile = [racine];
  while (pile.length) {
    const d = pile.pop();
    let entrees;
    try { entrees = fs.readdirSync(d, { withFileTypes: true }); } catch { continue; }
    for (const e of entrees) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) pile.push(p);
      else if (e.name.toLowerCase().endsWith(".glb")) out.push(p);
    }
  }
  return out.sort();
}

// ── Balayage ─────────────────────────────────────────────────────────────────

const fiches = [];
for (const cible of cibles) {
  if (!fs.existsSync(cible)) {
    console.error(`ABSENT : ${cible}`);
    continue;
  }
  for (const f of glbs(cible)) {
    const j = enTete(f);
    if (!j) continue;
    const noeuds = j.nodes || [];
    const skins = j.skins || [];
    const joints = skins.length ? skins[0].joints || [] : [];
    const noms = joints.map((i) => (noeuds[i] || {}).name || "?");
    const anims = j.animations || [];
    fiches.push({
      fichier: path.relative(RACINE, f).replace(/\\/g, "/"),
      pack: path.relative(RACINE, f).split(/[\\/]/)[0],
      os: noms.length,
      convention: noms.length ? convention(noms) : "sans os",
      morpho: noms.length ? morphologie(noms) : "statique",
      // L'empreinte IGNORE l'ordre : deux exports du meme rig peuvent lister
      // leurs joints differemment sans que le squelette differe.
      empreinte: noms.length
        ? crypto.createHash("sha1").update([...noms].sort().join("|")).digest("hex").slice(0, 10)
        : "-",
      anims: anims.length,
      canaux: anims.reduce((s, a) => s + (a.channels || []).length, 0),
      noms,
    });
  }
}

if (fiches.length === 0) {
  console.error("Aucun GLB lu.");
  process.exit(1);
}

// ── Rapport ──────────────────────────────────────────────────────────────────

const parEmpreinte = new Map();
for (const f of fiches) {
  if (f.empreinte === "-") continue;
  if (!parEmpreinte.has(f.empreinte)) parEmpreinte.set(f.empreinte, []);
  parEmpreinte.get(f.empreinte).push(f);
}

console.log(`${fiches.length} GLB lus dans : ${cibles.map((c) => path.basename(c)).join(", ")}\n`);

const compter = (cle) => {
  const m = new Map();
  for (const f of fiches) m.set(f[cle], (m.get(f[cle]) || 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1]);
};

console.log("=== CONVENTION DE NOMMAGE ===");
console.log("(deux squelettes de MEME convention se remappent avec la MEME table)");
for (const [k, n] of compter("convention")) console.log(`  ${String(k).padEnd(22)} ${String(n).padStart(5)}`);

console.log("\n=== MORPHOLOGIE ===");
for (const [k, n] of compter("morpho")) console.log(`  ${String(k).padEnd(22)} ${String(n).padStart(5)}`);

console.log("\n=== SQUELETTES DISTINCTS ===");
console.log(`  ${parEmpreinte.size} squelette(s) distinct(s) pour ${fiches.filter((f) => f.os > 0).length} GLB riggé(s)`);

const groupes = [...parEmpreinte.entries()].sort((a, b) => b[1].length - a[1].length);
console.log("");
console.log(`  ${"EMPREINTE".padEnd(12)}${"GLB".padStart(5)}${"OS".padStart(5)}  ${"CONVENTION".padEnd(20)}${"MORPHO".padEnd(12)}ANIMS  EXEMPLE`);
console.log("  " + "-".repeat(104));
let partageables = 0;
for (const [emp, liste] of groupes.slice(0, 24)) {
  const t = liste[0];
  const anims = liste.reduce((s, f) => s + f.anims, 0);
  if (liste.length > 1) partageables += liste.length;
  console.log(
    "  " + emp.padEnd(12) + String(liste.length).padStart(5) + String(t.os).padStart(5) +
    "  " + t.convention.padEnd(20) + t.morpho.padEnd(12) +
    String(anims).padStart(5) + "  " + t.fichier.slice(0, 44),
  );
}
if (groupes.length > 24) console.log(`  … ${groupes.length - 24} squelette(s) de plus, tous a 1 GLB`);

console.log("");
console.log(`  ${partageables} GLB partagent deja un squelette avec au moins un autre.`);
console.log(`  ${groupes.filter((g) => g[1].length === 1).length} squelette(s) n'ont qu'un seul porteur.`);

// ── Les quadrupedes : ont-ils leurs animations ? ─────────────────────────────
//
// Consigne explicite : garder leurs animations quand elles existent, et ne
// fabriquer un corps commun QUE pour ceux qui n'en ont aucune.
const quad = fiches.filter((f) => f.morpho === "quadrupede");
const quadSansAnim = quad.filter((f) => f.anims === 0);
console.log("\n=== QUADRUPEDES ===");
console.log(`  ${quad.length} GLB quadrupede(s), dont ${quadSansAnim.length} SANS animation embarquee`);
if (DETAIL) {
  for (const f of quad) {
    console.log(`   ${f.anims > 0 ? "ANIME " : "SANS  "} ${String(f.os).padStart(3)} os  ${f.convention.padEnd(18)} ${f.fichier}`);
  }
} else if (quadSansAnim.length) {
  console.log("  sans animation (candidats au corps commun) :");
  for (const f of quadSansAnim.slice(0, 12)) console.log(`     ${f.fichier}`);
  if (quadSansAnim.length > 12) console.log(`     … ${quadSansAnim.length - 12} de plus`);
}

// ── Les GLB sans os ──────────────────────────────────────────────────────────
const sansOs = fiches.filter((f) => f.os === 0);
console.log("\n=== SANS SQUELETTE ===");
console.log(`  ${sansOs.length} GLB sans joint : ce sont des meshes statiques, pas des corps.`);