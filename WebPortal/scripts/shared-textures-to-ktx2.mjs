// ══════════════════════════════════════════════════════════════════════════════
// scripts/shared-textures-to-ktx2.mjs — KTX2 sur des textures MUTUALISÉES.
//
//   node scripts/shared-textures-to-ktx2.mjs <dossier> [--write] [--max=1024]
//                                            [--no-uastc-normals] [--jobs=N]
//
// ── POURQUOI UN SCRIPT DE PLUS ───────────────────────────────────────────────
//
// `assets-to-ktx2.mjs` travaille sur des GLB dont les textures sont EMBARQUÉES :
// il les lit dans le binaire, les encode, les réécrit dedans. Sur un dossier
// déjà passé par `dedupe-textures.mjs`, il ré-embarquerait chaque texture dans
// chaque GLB — annulant exactement la déduplication qu'on vient de faire.
//
// Ici les textures sont des fichiers autonomes dans `_textures/`, partagés par
// `uri`. On les convertit SUR PLACE, puis on met à jour les GLB qui les citent.
//
// ── LE LIEN ROLE ↔ ESPACE COLORIMÉTRIQUE, QUE LA DÉDUP AVAIT COUPÉ ───────────
//
// Encoder une texture exige de savoir si elle porte de la COULEUR (sRGB) ou de
// la DONNÉE (linéaire). Se tromper délave les couleurs ou fausse l'éclairage —
// sans la moindre erreur. Or un fichier isolé dans `_textures/` ne dit plus rien
// de son rôle : la mutualisation a coupé ce lien.
//
// On le RECONSTRUIT en balayant les matériaux de tous les GLB. Mesuré sur
// ZombieSoldierPack : 73 normal · 65 metalRough · 63 baseColor · 61 occlusion ·
// 7 emissive · 7 specular. Deux textures servent à la fois de metalRough et
// d'occlusion — toutes deux linéaires, donc sans conflit.
//
//   sRGB      baseColor, emissive
//   linéaire  normal, metallicRoughness, occlusion, specular
//
// Une texture au rôle AMBIGU (couleur ici, donnée là) est traitée en linéaire et
// SIGNALÉE : mieux vaut un éclairage juste et une couleur à revoir que l'inverse.
//
// ── DEUX RÉÉCRITURES DANS LE GLB, PAS UNE ────────────────────────────────────
//
// Changer l'`uri` ne suffit pas. En glTF, une texture KTX2 ne se déclare PAS
// comme une PNG : `texture.source` doit devenir
// `texture.extensions.KHR_texture_basisu.source`, et l'extension être déclarée
// dans `extensionsUsed` ET `extensionsRequired`. Sans ça le lecteur voit un
// `source` pointant sur une image dont il ne reconnaît pas le mimeType : texture
// noire, aucune erreur.
//
// ── VRAM ─────────────────────────────────────────────────────────────────────
//
// C'est ICI que la VRAM baisse, pas à la déduplication. Un PNG 2048² coûte 22 Mo
// de VRAM une fois décompressé en RGBA8, quel que soit son poids sur disque.
// KTX2 reste COMPRESSÉ sur le GPU (BC7/ETC/ASTC selon la machine). Avec le
// redimensionnement à 1024 par défaut, l'empreinte tombe d'un facteur ~17.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { findKtxCli, encodeToKtx2, runPool, DEFAULT_CONCURRENCY, MB } from "./lib/ktx2-encode.mjs";

const argv = process.argv.slice(2);
const SRC = argv.find((a) => !a.startsWith("--"));
const WRITE = argv.includes("--write");
const UASTC_NORMALS = !argv.includes("--no-uastc-normals");
const val = (n, d) => {
  const f = argv.find((x) => x.startsWith(`--${n}=`));
  return f ? f.slice(n.length + 3) : d;
};
const MAX = Number(val("max", 1024));
const JOBS = Number(val("jobs", DEFAULT_CONCURRENCY));

if (!SRC || !fs.existsSync(path.join(SRC, "_textures"))) {
  console.error("usage: node scripts/shared-textures-to-ktx2.mjs <dossier avec _textures/> [--write]");
  process.exit(1);
}

const ktxCli = findKtxCli();
if (!ktxCli) {
  console.error("[ktx2] ktx.exe introuvable — voir findKtxCli() dans scripts/lib/ktx2-encode.mjs");
  process.exit(1);
}

const DIR_TEX = path.join(SRC, "_textures");

/** Rôles porteurs de COULEUR. Tout le reste est de la donnée, donc linéaire. */
const ROLES_SRGB = new Set(["baseColor", "emissive"]);

const lireGlb = (f) => {
  try {
    const b = fs.readFileSync(f);
    if (b.length < 20 || b.readUInt32LE(0) !== 0x46546c67) return null;
    const n = b.readUInt32LE(12);
    return { json: JSON.parse(b.subarray(20, 20 + n).toString("utf8")), brut: b, nJson: n };
  } catch { return null; }
};

function ecrireGlb(fichier, json, brut, nJsonAvant) {
  // Le chunk BIN est recopié TEL QUEL : on ne touche qu'au JSON. Reconstruire le
  // binaire ici serait un risque gratuit — la géométrie n'a pas à bouger.
  const off = 20 + nJsonAvant;
  let bin = Buffer.alloc(0);
  if (off + 8 <= brut.length && brut.readUInt32LE(off + 4) === 0x004e4942) {
    bin = brut.subarray(off + 8, off + 8 + brut.readUInt32LE(off));
  }
  const j = Buffer.from(JSON.stringify(json), "utf8");
  const jc = Buffer.concat([j, Buffer.alloc((4 - (j.length % 4)) % 4, 0x20)]);
  const bc = Buffer.concat([bin, Buffer.alloc((4 - (bin.length % 4)) % 4, 0)]);

  const total = 12 + 8 + jc.length + (bc.length ? 8 + bc.length : 0);
  const out = Buffer.alloc(total);
  let o = 0;
  out.writeUInt32LE(0x46546c67, o); o += 4;
  out.writeUInt32LE(2, o); o += 4;
  out.writeUInt32LE(total, o); o += 4;
  out.writeUInt32LE(jc.length, o); o += 4;
  out.writeUInt32LE(0x4e4f534a, o); o += 4;
  jc.copy(out, o); o += jc.length;
  if (bc.length) {
    out.writeUInt32LE(bc.length, o); o += 4;
    out.writeUInt32LE(0x004e4942, o); o += 4;
    bc.copy(out, o);
  }
  fs.writeFileSync(fichier, out);
}

const tousLesGlb = (d, o = []) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (e.name !== "_textures") tousLesGlb(p, o); }
    else if (e.name.toLowerCase().endsWith(".glb")) o.push(p);
  }
  return o;
};

/** Résout l'image d'une texture, que la source soit directe ou via basisu. */
const sourceDe = (t) =>
  t.source !== undefined ? t.source : t.extensions?.KHR_texture_basisu?.source;

// ── 1. Reconstituer le rôle de chaque texture partagée ──────────────────────

const fichiers = tousLesGlb(SRC);
console.info(`[ktx2] ${fichiers.length} GLB · encodeur ${path.basename(ktxCli)}`);

const roles = new Map();   // nom de fichier → Set(rôles)
for (const f of fichiers) {
  const lu = lireGlb(f);
  if (!lu) continue;
  const g = lu.json;
  const noter = (idx, role) => {
    if (idx === undefined) return;
    const im = g.images?.[sourceDe(g.textures?.[idx] ?? {})];
    if (!im?.uri) return;
    const nom = path.basename(decodeURIComponent(im.uri));
    if (!roles.has(nom)) roles.set(nom, new Set());
    roles.get(nom).add(role);
  };
  for (const m of g.materials ?? []) {
    const p = m.pbrMetallicRoughness ?? {};
    noter(p.baseColorTexture?.index, "baseColor");
    noter(p.metallicRoughnessTexture?.index, "metalRough");
    noter(m.normalTexture?.index, "normal");
    noter(m.occlusionTexture?.index, "occlusion");
    noter(m.emissiveTexture?.index, "emissive");
    for (const ev of Object.values(m.extensions ?? {})) {
      for (const v of Object.values(ev ?? {})) {
        if (v && typeof v === "object" && v.index !== undefined) noter(v.index, "specular");
      }
    }
  }
}

// ── 2. Encoder les PNG (les KTX2 déjà présents sont laissés tels quels) ──────

const aConvertir = fs.readdirSync(DIR_TEX).filter((n) => /\.(png|jpe?g|webp)$/i.test(n));
console.info(`[ktx2] ${aConvertir.length} texture(s) à convertir · ${roles.size} rôles reconstitués`);

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sktx2-"));
const converti = new Map();   // ancien nom → nouveau nom
let avant = 0, apres = 0, ambigus = 0, echecs = 0;

const taches = aConvertir.map((nom) => async () => {
  const src = path.join(DIR_TEX, nom);
  const r = roles.get(nom) ?? new Set();
  const couleur = [...r].some((x) => ROLES_SRGB.has(x));
  const donnee = [...r].some((x) => !ROLES_SRGB.has(x));
  if (couleur && donnee) {
    ambigus++;
    console.warn(`[ktx2] ⚠ ${nom} : rôles mixtes (${[...r].join("+")}) — traité en linéaire`);
  }
  const srgb = couleur && !donnee;
  const uastc = UASTC_NORMALS && r.has("normal");

  const buf = fs.readFileSync(src);
  avant += buf.length;
  try {
    const out = await encodeToKtx2(buf, {
      srgb, uastc, maxSize: MAX, ktxCli, tmpDir,
      tag: path.basename(nom, path.extname(nom)),
    });
    if (!out) throw new Error("encodage vide");
    apres += out.length;
    const neuf = path.basename(nom, path.extname(nom)) + ".ktx2";
    converti.set(nom, neuf);
    if (WRITE) {
      fs.writeFileSync(path.join(DIR_TEX, neuf), out);
      fs.rmSync(src);
    }
  } catch (e) {
    echecs++;
    apres += buf.length;
    console.error(`[ktx2] ✗ ${nom} : ${String(e.message).slice(0, 90)}`);
  }
});

await runPool(taches, JOBS);
fs.rmSync(tmpDir, { recursive: true, force: true });

// ── 3. Mettre à jour les GLB : uri, mimeType, ET la déclaration d'extension ──

let glbTouches = 0, texBasculees = 0;
if (WRITE && converti.size) {
  for (const f of fichiers) {
    const lu = lireGlb(f);
    if (!lu) continue;
    const g = lu.json;
    let change = false;

    // a. images : uri + mimeType
    const bascule = new Set();   // indices d'images passées en KTX2
    (g.images ?? []).forEach((im, i) => {
      if (!im.uri) return;
      const nom = path.basename(decodeURIComponent(im.uri));
      const neuf = converti.get(nom);
      if (!neuf) return;
      im.uri = im.uri.replace(new RegExp(`${nom.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`), neuf);
      im.mimeType = "image/ktx2";
      bascule.add(i);
      change = true;
    });

    // b. textures : `source` → `extensions.KHR_texture_basisu.source`
    //    Sans ce déplacement, le lecteur voit un `source` dont il ne reconnaît
    //    pas le mimeType : texture NOIRE, sans erreur levée.
    for (const t of g.textures ?? []) {
      if (t.source === undefined || !bascule.has(t.source)) continue;
      t.extensions = t.extensions ?? {};
      t.extensions.KHR_texture_basisu = { source: t.source };
      delete t.source;
      texBasculees++;
      change = true;
    }

    // c. déclarer l'extension — REQUISE, le fichier est illisible sans elle
    if (change) {
      g.extensionsUsed = [...new Set([...(g.extensionsUsed ?? []), "KHR_texture_basisu"])];
      g.extensionsRequired = [...new Set([...(g.extensionsRequired ?? []), "KHR_texture_basisu"])];
      ecrireGlb(f, g, lu.brut, lu.nJson);
      glbTouches++;
    }
  }
}

// ── Bilan ───────────────────────────────────────────────────────────────────

const resteMo = fs.readdirSync(DIR_TEX)
  .reduce((a, n) => a + fs.statSync(path.join(DIR_TEX, n)).size, 0);

console.info(`
[ktx2] converties          : ${converti.size} / ${aConvertir.length}   échecs : ${echecs}   ambiguës : ${ambigus}
[ktx2] textures AVANT      : ${MB(avant)} Mo
[ktx2] textures APRÈS      : ${MB(apres)} Mo   (${(100 * (1 - apres / Math.max(1, avant))).toFixed(1)} % de gain)
[ktx2] GLB mis à jour      : ${glbTouches}   textures rebasculées : ${texBasculees}
[ktx2] _textures/ sur disque: ${MB(resteMo)} Mo`);

console.info(WRITE ? "\n[ktx2] ✓ écrit" : "\n[ktx2] dry-run. --write pour appliquer");
