// ══════════════════════════════════════════════════════════════════════════════
// narvos-apparier-textures.mjs — quelle texture va avec quel matériau ?
//
//   node scripts/narvos-apparier-textures.mjs <dossier de pack Unreal>
//   node scripts/narvos-apparier-textures.mjs <pack> --detail --seuil 0.5
//
// NE MODIFIE RIEN. Il propose un appariement et donne sa couverture, pour qu'on
// décide AVANT d'écrire dans 299 assets.
//
// ── POURQUOI CE SCRIPT EXISTE ─────────────────────────────────────────────────
// Mesuré le 2026-09-08 : sur 2 485 matériaux de `/Game/Narvos`, **1 073 ne
// pointent que les bouche-trous d'Unreal** (`T_White_srgb`, `T_Generic_N`…).
// L'import glTF les a créés sans jamais connecter les textures du pack. Les
// textures, elles, sont là.
//
// Pour certains packs la correspondance est triviale — la texture s'appelle
// `<Materiau>_<Canal>`. Pour `Defender`, non :
//
//     MI_Blade_BlackKnightGreen        <- le matériau
//     T_Blade_BlackKnight_Sword1_D     <- sa couleur
//     T_Blade_BlackKnight_Sword1_N     <- sa normale
//
// « BlackKnightGreen » contre « BlackKnight_Sword1 » : aucun préfixe commun
// exploitable, aucune égalité. Il faut apparier par JETONS, et accepter que ça
// se trompe — d'où un score, un seuil, et un rapport plutôt qu'une écriture.
//
// ⚠ CE SCRIPT NE DEVINE PAS LE VOCABULAIRE DES CANAUX, IL LE MESURE.
// La table ci-dessous vient du dépouillement réel des 247 textures de Defender :
//   N 36 · D 28 · M 27 · Normal 16 · MRS 15 · Diffuse 15 · E 6 · Mask 4 · …
// Un canal inventé apparierait une texture à la mauvaise entrée du matériau,
// et une normale branchée en couleur de base ne se voit qu'à l'écran.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const DETAIL = process.argv.includes("--detail");
const iSeuil = process.argv.indexOf("--seuil");
const SEUIL = iSeuil >= 0 ? Number(process.argv[iSeuil + 1]) : 0.5;

const pack = args[0];
if (!pack || !fs.existsSync(pack)) {
  console.error("Usage : node scripts/narvos-apparier-textures.mjs <dossier de pack> [--detail] [--seuil 0.5]");
  process.exit(1);
}

// ── Vocabulaire des canaux, relevé sur disque ────────────────────────────────
//
// La CLÉ est le suffixe tel qu'il apparaît ; la VALEUR est l'entrée du matériau
// qu'il alimente. Les suffixes longs passent avant les courts au découpage :
// sans ça `_Normal` serait lu comme `_N` suivi de « ormal ».
const CANAUX = new Map(Object.entries({
  occlusionroughnessmetallic: "orm",
  basecolor: "couleur",
  emissive: "emissive",
  metallic: "metal",
  roughness: "rugosite",
  diffuse: "couleur",
  normals: "normale",
  normal: "normale",
  aorm: "orm",
  mask: "masque",
  mrs: "orm",
  n2: "normale",
  ao: "occlusion",
  d: "couleur",
  n: "normale",
  m: "metal",
  e: "emissive",
  r: "rugosite",
  s: "specular",
}));

/** Suffixes triés du plus long au plus court : l'ordre décide du découpage. */
const SUFFIXES = [...CANAUX.keys()].sort((a, b) => b.length - a.length);

/** Jetons de nom : `MI_Blade_BlackKnightGreen` -> [blade, black, knight, green] */
function jetons(nom) {
  return nom
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")   // frontières camelCase
    .split(/[_\-.\s]+/)
    .map((t) => t.toLowerCase())
    .filter(Boolean);
}

// Jetons qui ne distinguent rien : les garder ferait qu'un matériau
// « MI_Truc » s'apparierait à toute texture du pack par le seul « mi ».
const BRUIT = new Set([
  "mi", "m", "mat", "charm", "t", "tex", "texture", "material", "inst",
  "instance", "new", "copy", "01", "02", "1", "2", "3", "a", "b",
]);

const distinctifs = (nom) => jetons(nom).filter((t) => !BRUIT.has(t));

/** Retire le suffixe de canal d'un nom de texture. Rend [sujet, canal|null]. */
function decouperTexture(nom) {
  const bas = nom.toLowerCase();
  for (const s of SUFFIXES) {
    if (bas.endsWith("_" + s)) {
      return [nom.slice(0, nom.length - s.length - 1), CANAUX.get(s)];
    }
  }
  return [nom, null];
}

// ── Lecture du pack ──────────────────────────────────────────────────────────

function uassets(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) uassets(p, out);
    else if (e.name.endsWith(".uasset")) out.push(p.replace(/\\/g, "/"));
  }
  return out;
}

const tous = uassets(pack);
const estTexture = (p) => /\/Textures?\//i.test(p) || /(^|\/)T_/.test(path.basename(p));
const estMateriau = (p) => /\/Materials?\//i.test(p) || /(^|\/)(MI|M|Mat|CharM)_/.test(path.basename(p));

const textures = tous.filter(estTexture).map((p) => path.basename(p, ".uasset"));
const materiaux = tous.filter((p) => estMateriau(p) && !estTexture(p)).map((p) => path.basename(p, ".uasset"));

// ── Regroupement des textures par SUJET ──────────────────────────────────────
//
// Un matériau ne cherche pas une texture, il cherche un JEU de textures :
// couleur + normale + orm. On apparie donc au groupe, pas à l'image.
const groupes = new Map();   // sujet -> { canaux: Map(role -> nom), jetons: Set }
for (const t of textures) {
  const [sujet, canal] = decouperTexture(t);
  if (!groupes.has(sujet)) groupes.set(sujet, { canaux: new Map(), jetons: new Set(distinctifs(sujet)) });
  groupes.get(sujet).canaux.set(canal || "inconnu", t);
}

// ── Appariement ──────────────────────────────────────────────────────────────
//
// Score = jetons partagés / jetons du MATÉRIAU. On divise par le matériau et
// non par l'union : un groupe de textures au nom plus riche (`Blade_BlackKnight
// _Sword1`) ne doit pas être pénalisé face à un matériau plus court.
function apparier(mat) {
  const jm = distinctifs(mat);
  if (jm.length === 0) return null;
  let meilleur = null;
  for (const [sujet, g] of groupes) {
    const partages = jm.filter((t) => g.jetons.has(t)).length;
    if (partages === 0) continue;
    const score = partages / jm.length;
    if (!meilleur || score > meilleur.score ||
        (score === meilleur.score && g.canaux.size > meilleur.groupe.canaux.size)) {
      meilleur = { sujet, groupe: g, score, partages };
    }
  }
  return meilleur;
}

// ── Rapport ──────────────────────────────────────────────────────────────────

console.log(`Pack   : ${pack}`);
console.log(`        ${materiaux.length} materiau(x) · ${textures.length} texture(s) · ${groupes.size} groupe(s) de textures`);
console.log(`Seuil  : ${SEUIL}  (score = jetons partages / jetons du materiau)`);
console.log("");

const surs = [], douteux = [], orphelins = [];
for (const m of materiaux) {
  const r = apparier(m);
  if (!r) { orphelins.push({ m }); continue; }
  (r.score >= SEUIL ? surs : douteux).push({ m, ...r });
}

const pct = (n) => ((n / materiaux.length) * 100).toFixed(0);
console.log(`  APPARIES   ${String(surs.length).padStart(4)}  (${pct(surs.length)} %)   score >= ${SEUIL}`);
console.log(`  DOUTEUX    ${String(douteux.length).padStart(4)}  (${pct(douteux.length)} %)   un jeton partage, pas assez`);
console.log(`  ORPHELINS  ${String(orphelins.length).padStart(4)}  (${pct(orphelins.length)} %)   aucun jeton commun`);

// Quels canaux les appariements sûrs apportent-ils réellement ?
const parCanal = new Map();
for (const s of surs) for (const c of s.groupe.canaux.keys()) parCanal.set(c, (parCanal.get(c) || 0) + 1);
console.log("");
console.log("  canaux apportes par les appariements surs :");
for (const [c, n] of [...parCanal].sort((a, b) => b[1] - a[1])) {
  console.log(`    ${c.padEnd(12)} ${n}`);
}

// ⚠ Un matériau apparié SANS couleur de base reste gris à l'écran. C'est la
// mesure qui compte vraiment, pas le nombre d'appariements.
const avecCouleur = surs.filter((s) => s.groupe.canaux.has("couleur")).length;
console.log("");
console.log(`  dont ${avecCouleur} apportent une COULEUR DE BASE — les seuls qui changent quelque chose a l'ecran.`);

if (DETAIL) {
  console.log("");
  console.log("── APPARIEMENTS SURS ──");
  for (const s of surs.sort((a, b) => b.score - a.score)) {
    const canaux = [...s.groupe.canaux].map(([c, t]) => `${c}=${t}`).join("  ");
    console.log(`  ${s.score.toFixed(2)}  ${s.m}`);
    console.log(`        ${canaux}`);
  }
  console.log("");
  console.log("── DOUTEUX (a trancher a la main) ──");
  for (const d of douteux.sort((a, b) => b.score - a.score).slice(0, 30)) {
    console.log(`  ${d.score.toFixed(2)}  ${d.m}   ->   ${d.sujet}  (${d.partages} jeton(s))`);
  }
  console.log("");
  console.log("── ORPHELINS ──");
  for (const o of orphelins.slice(0, 30)) console.log(`        ${o.m}`);
}

console.log("");
console.log("Rien ecrit. Relancer avec --detail pour voir les appariements un par un.");