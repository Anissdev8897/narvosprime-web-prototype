// ══════════════════════════════════════════════════════════════════════════════
// scripts/dedupe-textures.mjs — Sort les textures des GLB et les mutualise.
//
//   node scripts/dedupe-textures.mjs <dossier> [--write] [--out <dir>]
//
// ── LE PROBLÈME, MESURÉ ──────────────────────────────────────────────────────
//
// ZombieSoldierPack : 425 fichiers, 39 989 Mo, dont 39 365 Mo de TEXTURES
// (98,4 %). La géométrie entière tient dans 623 Mo. Sur 3 417 images, 249 sont
// distinctes : 92,7 % de doublons. Une PNG de 28,8 Mo est répétée 228 fois —
// 6,6 Go pour une seule image. Un sac à munitions de 252 triangles pèse 44,6 Mo.
//
// Cause : le pack est MODULAIRE. Chaque pièce (botte, chapeau, sacoche) embarque
// le jeu de textures COMPLET du personnage.
//
// ── CE QUE FAIT CE SCRIPT ────────────────────────────────────────────────────
//
// Il SORT chaque image du binaire et la remplace par une `uri` relative vers un
// fichier partagé, nommé par le hash de son contenu. Deux pièces qui utilisaient
// la même texture pointent alors sur le MÊME fichier : écrite une fois,
// téléchargée une fois, mise en cache une fois.
//
// glTF autorise explicitement `image.uri` dans un GLB — c'est du glTF valide,
// pas un contournement. `GLTFLoader` résout l'URI relativement au chemin du GLB.
//
// ── POURQUOI RÉÉCRIRE LE BINAIRE À LA MAIN ───────────────────────────────────
//
// Retirer une image ne suffit pas : son `bufferView` doit disparaître du chunk
// BIN, et TOUS les indices de bufferView qui suivent se décalent. Un accessor
// qui pointerait sur l'ancien indice lirait des octets arbitraires — géométrie
// en charpie, sans la moindre erreur levée. On recompacte donc le binaire, on
// remappe chaque référence, puis on VÉRIFIE (cf. `controler`).
//
// ── CE QUE ÇA NE FAIT PAS ────────────────────────────────────────────────────
//
// Ça ne réduit pas les DIMENSIONS des textures. La VRAM dépend de la taille en
// pixels, pas des octets sur disque : un PNG 2048² fait 22 Mo décompressé sur le
// GPU quel que soit son poids (cf. skill narvos-mesh-pipeline). La suite logique
// est `assets-to-ktx2.mjs` — et elle devient triviale une fois les textures
// mutualisées : 249 fichiers à convertir au lieu de 3 417.
//
// ── SÛRETÉ ───────────────────────────────────────────────────────────────────
//
// Écrit dans un dossier SÉPARÉ, jamais en place. Il n'y a pas de dépôt git ici
// et la source pèse 40 Go : elle n'est pas sauvegardable, donc on n'y touche
// pas. Dry-run par défaut.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const args = process.argv.slice(2);
const SRC = args.find((a) => !a.startsWith("--"));
const WRITE = args.includes("--write");
const iOut = args.indexOf("--out");
const OUT = iOut >= 0 ? args[iOut + 1] : `${SRC}_dedup`;

if (!SRC || !fs.existsSync(SRC)) {
  console.error("usage: node scripts/dedupe-textures.mjs <dossier> [--write] [--out <dir>]");
  process.exit(1);
}

/** Dossier des textures mutualisées, à la racine de la sortie. */
const NOM_TEX = "_textures";

const EXT = {
  "image/png": ".png", "image/jpeg": ".jpg",
  "image/webp": ".webp", "image/ktx2": ".ktx2",
};

const mo = (o) => (o / 1048576).toFixed(0);

function lireGlb(fichier) {
  const b = fs.readFileSync(fichier);
  if (b.length < 20 || b.readUInt32LE(0) !== 0x46546c67) return null;   // « glTF »
  const nJson = b.readUInt32LE(12);
  const json = JSON.parse(b.subarray(20, 20 + nJson).toString("utf8"));

  // Le chunk BIN suit le chunk JSON, aligné sur 4 octets.
  const off = 20 + nJson;
  let bin = Buffer.alloc(0);
  if (off + 8 <= b.length) {
    const nBin = b.readUInt32LE(off);
    if (b.readUInt32LE(off + 4) === 0x004e4942) bin = b.subarray(off + 8, off + 8 + nBin);
  }
  return { json, bin };
}

function ecrireGlb(fichier, json, bin) {
  const j = Buffer.from(JSON.stringify(json), "utf8");
  // Bourrage : JSON avec des ESPACES (0x20), BIN avec des ZÉROS. Le lecteur
  // parse le JSON — un caractère nul le ferait échouer ; le binaire s'en moque.
  const padJ = (4 - (j.length % 4)) % 4;
  const padB = (4 - (bin.length % 4)) % 4;
  const jc = Buffer.concat([j, Buffer.alloc(padJ, 0x20)]);
  const bc = Buffer.concat([bin, Buffer.alloc(padB, 0)]);

  const total = 12 + 8 + jc.length + (bc.length ? 8 + bc.length : 0);
  const out = Buffer.alloc(total);
  let o = 0;
  out.writeUInt32LE(0x46546c67, o); o += 4;
  out.writeUInt32LE(2, o); o += 4;
  out.writeUInt32LE(total, o); o += 4;
  out.writeUInt32LE(jc.length, o); o += 4;
  out.writeUInt32LE(0x4e4f534a, o); o += 4;              // « JSON »
  jc.copy(out, o); o += jc.length;
  if (bc.length) {
    out.writeUInt32LE(bc.length, o); o += 4;
    out.writeUInt32LE(0x004e4942, o); o += 4;            // « BIN\0 »
    bc.copy(out, o);
  }
  fs.mkdirSync(path.dirname(fichier), { recursive: true });
  fs.writeFileSync(fichier, out);
  return total;
}

/**
 * Garde-fou : ce qui doit être IDENTIQUE avant / après.
 *
 * Une déduplication ne change QUE le stockage des images. Si un compte de
 * nœuds, de mailles, d'accesseurs ou d'animations bouge, c'est qu'on a détruit
 * autre chose — et ça ne se verrait qu'au rendu, bien plus tard.
 */
function controler(avant, apres, fichier) {
  const clefs = ["nodes", "meshes", "accessors", "animations", "materials", "images", "textures", "skins"];
  for (const k of clefs) {
    const a = (avant[k] ?? []).length;
    const b = (apres[k] ?? []).length;
    if (a !== b) throw new Error(`${fichier} : ${k} ${a} → ${b}`);
  }
  // Tout indice de bufferView encore référencé doit exister.
  const n = (apres.bufferViews ?? []).length;
  for (const acc of apres.accessors ?? []) {
    if (acc.bufferView !== undefined && !(acc.bufferView < n)) {
      throw new Error(`${fichier} : accessor → bufferView ${acc.bufferView} / ${n}`);
    }
  }
  for (const im of apres.images ?? []) {
    if (im.bufferView !== undefined && !(im.bufferView < n)) {
      throw new Error(`${fichier} : image → bufferView ${im.bufferView} / ${n}`);
    }
  }
  // Une image doit avoir SOIT un bufferView, SOIT une uri — jamais ni l'un ni
  // l'autre, ce qui donnerait une texture noire sans erreur.
  for (const [i, im] of (apres.images ?? []).entries()) {
    if (im.bufferView === undefined && !im.uri) {
      throw new Error(`${fichier} : image ${i} sans bufferView NI uri`);
    }
  }
}

function tousLesGlb(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) tousLesGlb(p, out);
    else if (e.name.toLowerCase().endsWith(".glb")) out.push(p);
  }
  return out;
}

// ── Traitement ──────────────────────────────────────────────────────────────

const fichiers = tousLesGlb(SRC);
console.info(`[dedup] ${fichiers.length} GLB sous ${SRC}`);

const dirTex = path.join(OUT, NOM_TEX);
const ecrites = new Map();     // hash → { nom, octets }
let octetsAvant = 0, octetsApres = 0, imagesVues = 0, erreurs = 0, intacts = 0;

for (const f of fichiers) {
  const lu = lireGlb(f);
  if (!lu) { console.warn(`[dedup] ${f} — pas un GLB v2, ignoré`); continue; }
  const { json, bin } = lu;
  octetsAvant += fs.statSync(f).size;

  const avant = JSON.parse(JSON.stringify(json));
  const aSortir = new Set();
  const relDest = path.relative(SRC, f);

  // 1. Sortir chaque image : hash du contenu → fichier partagé, puis `uri`.
  for (const im of json.images ?? []) {
    if (im.bufferView === undefined) continue;
    const bv = json.bufferViews[im.bufferView];
    const deb = bv.byteOffset ?? 0;
    const octets = bin.subarray(deb, deb + bv.byteLength);
    const hash = crypto.createHash("sha1").update(octets).digest("hex").slice(0, 16);
    const nom = hash + (EXT[im.mimeType] ?? ".bin");
    imagesVues++;

    if (!ecrites.has(hash)) {
      ecrites.set(hash, { nom, octets: octets.length });
      if (WRITE) {
        fs.mkdirSync(dirTex, { recursive: true });
        fs.writeFileSync(path.join(dirTex, nom), octets);
      }
    }

    // URI RELATIVE au GLB : les fichiers sont à des profondeurs variables, un
    // chemin absolu casserait dès que le dossier est déplacé.
    const rel = path.relative(path.dirname(path.join(OUT, relDest)), path.join(dirTex, nom));
    im.uri = rel.split(path.sep).map(encodeURIComponent).join("/");
    aSortir.add(im.bufferView);
    delete im.bufferView;
  }

  if (aSortir.size === 0) {
    // Rien à sortir : on recopie tel quel plutôt que de réécrire pour rien.
    if (WRITE) {
      const dest = path.join(OUT, relDest);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(f, dest);
    }
    octetsApres += fs.statSync(f).size;
    intacts++;
    continue;
  }

  // 2. Recompacter le BIN et REMAPPER les indices — l'étape qui peut tout casser.
  const gardes = [];
  const remap = new Map();
  const morceaux = [];
  let curseur = 0;

  json.bufferViews.forEach((bv, i) => {
    if (aSortir.has(i)) return;
    const deb = bv.byteOffset ?? 0;
    const bloc = bin.subarray(deb, deb + bv.byteLength);
    // Réaligner sur 4 octets : un accessor mal aligné est refusé par le lecteur.
    const pad = (4 - (curseur % 4)) % 4;
    if (pad) { morceaux.push(Buffer.alloc(pad, 0)); curseur += pad; }
    remap.set(i, gardes.length);
    gardes.push({ ...bv, byteOffset: curseur });
    morceaux.push(bloc);
    curseur += bloc.length;
  });

  json.bufferViews = gardes;
  for (const acc of json.accessors ?? []) {
    if (acc.bufferView !== undefined) acc.bufferView = remap.get(acc.bufferView);
  }
  for (const im of json.images ?? []) {
    if (im.bufferView !== undefined) im.bufferView = remap.get(im.bufferView);
  }

  const binNeuf = Buffer.concat(morceaux);
  json.buffers = [{ byteLength: binNeuf.length }];

  try {
    controler(avant, json, path.basename(f));
  } catch (e) {
    console.error(`[dedup] ✗ ${e.message}`);
    erreurs++;
    continue;
  }

  const dest = path.join(OUT, relDest);
  if (WRITE) {
    octetsApres += ecrireGlb(dest, json, binNeuf);
  } else {
    // Taille attendue, calculée même en dry-run pour décider AVANT d'écrire.
    octetsApres += 12 + 8 + Buffer.byteLength(JSON.stringify(json)) + 8 + binNeuf.length;
  }
}

const octetsTex = [...ecrites.values()].reduce((a, e) => a + e.octets, 0);
const total = octetsApres + octetsTex;

console.info(`
[dedup] images rencontrées : ${imagesVues}
[dedup] images DISTINCTES  : ${ecrites.size}   (${(100 * (1 - ecrites.size / Math.max(1, imagesVues))).toFixed(1)} % de doublons)
[dedup] fichiers sans image: ${intacts}   en erreur : ${erreurs}

[dedup] AVANT              : ${mo(octetsAvant)} Mo
[dedup] GLB après          : ${mo(octetsApres)} Mo
[dedup] textures partagées : ${mo(octetsTex)} Mo
[dedup] TOTAL après        : ${mo(total)} Mo   (${(100 * (1 - total / octetsAvant)).toFixed(1)} % de gain)`);

console.info(WRITE ? `\n[dedup] ✓ ${OUT}` : `\n[dedup] dry-run. --write pour produire ${OUT}`);
