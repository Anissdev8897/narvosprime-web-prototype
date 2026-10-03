// ══════════════════════════════════════════════════════════════════════════════
// narvos-degraisser-glb.mjs — Retire les textures embarquées des GLB d'ANIMATION.
//
//   node scripts/narvos-degraisser-glb.mjs <fichier.glb|dossier> [--apply]
//
// POURQUOI : les GLB d'animation de Tiger_M (127 fichiers, 8 Go) embarquent chacun
// la même texture recopiée (~57 Mo sur 60 Mo par fichier). Le mesh de base et
// Fur/ portent les vraies textures ; retirer celles des animations ne rend rien gris.
//
// RÈGLES DE SÉCURITÉ (non négociables) :
//   1. Ne touche QU'AUX fichiers d'ANIMATION (gltf.animations non vide). Le mesh
//      de base, Fur/, Materials/ ne sont jamais modifiés.
//   2. L'original n'est JAMAIS modifié : sortie dans un dossier frère
//      (`<dossier>_degraisse/`) ou `<nom>_degraisse.glb` pour un fichier.
//   3. Intégrité vérifiée après écriture : animations / nodes / accessors
//      identiques à l'original (et meshes / skins en bonus).
//   4. extensionsRequired est réécrit d'après ce qui reste réellement utilisé :
//      une extension qui ne servait qu'aux textures retirées disparaît, sinon
//      Unreal refuse le document entier.
//
// SIMULATION par défaut. --apply pour écrire.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";

const APPLY = process.argv.includes("--apply");
const CIBLE = process.argv.slice(2).find((a) => !a.startsWith("--"));

if (!CIBLE) {
  console.error("Usage : node scripts/narvos-degraisser-glb.mjs <fichier.glb|dossier> [--apply]");
  process.exit(1);
}

// ─── utilitaires ───────────────────────────────────────────────────────────────

const MO = (n) => `${(n / 1024 / 1024).toFixed(1)} Mo`;

function poids(chemin) {
  try {
    return fs.statSync(chemin).size;
  } catch {
    return -1;
  }
}

// ─── lecture / écriture GLB (stdlib uniquement) ────────────────────────────────

const MAGIC = 0x46546c67; // "glTF"
const CHUNK_JSON = 0x4e4f534a; // "JSON"
const CHUNK_BIN = 0x004e4942; // "BIN\0"

function lireGlb(chemin) {
  const buf = fs.readFileSync(chemin);
  if (buf.readUInt32LE(0) !== MAGIC || buf.readUInt32LE(4) !== 2) {
    throw new Error("Pas un GLB v2 : " + chemin);
  }
  let off = 12;
  let json = null;
  let bin = null;
  while (off < buf.length) {
    const clen = buf.readUInt32LE(off);
    const ctype = buf.readUInt32LE(off + 4);
    const cdata = buf.subarray(off + 8, off + 8 + clen);
    if (ctype === CHUNK_JSON) json = JSON.parse(cdata.toString("utf8"));
    else if (ctype === CHUNK_BIN) bin = cdata;
    off += 8 + clen;
  }
  if (!json) throw new Error("Chunk JSON introuvable : " + chemin);
  return { json, bin };
}

const pad = (n, size) => {
  const r = n % size;
  return r === 0 ? n : n + (size - r);
};

function ecrireGlb(chemin, json, bin) {
  const jsonBuf = Buffer.from(JSON.stringify(json), "utf8");
  const jsonPad = Buffer.alloc(pad(jsonBuf.length, 4) - jsonBuf.length, 0x20);
  const binPad = Buffer.alloc(pad(bin.length, 4) - bin.length, 0);
  const total = 12 + 8 + jsonBuf.length + jsonPad.length + (bin ? 8 + bin.length + binPad.length : 0);
  const out = Buffer.alloc(total);
  out.writeUInt32LE(MAGIC, 0);
  out.writeUInt32LE(2, 4);
  out.writeUInt32LE(total, 8);
  let o = 12;
  out.writeUInt32LE(jsonBuf.length + jsonPad.length, o);
  out.writeUInt32LE(CHUNK_JSON, o + 4);
  jsonBuf.copy(out, o + 8);
  jsonPad.copy(out, o + 8 + jsonBuf.length);
  o += 8 + jsonBuf.length + jsonPad.length;
  if (bin) {
    out.writeUInt32LE(bin.length + binPad.length, o);
    out.writeUInt32LE(CHUNK_BIN, o + 4);
    bin.copy(out, o + 8);
    binPad.copy(out, o + 8 + bin.length);
  }
  fs.writeFileSync(chemin, out);
  return out.length;
}

// ─── extraction récursive des noms d'extensions encore utilisés ────────────────

function collecterExtensions(node, acc) {
  if (Array.isArray(node)) {
    for (const v of node) collecterExtensions(v, acc);
    return;
  }
  if (node && typeof node === "object") {
    if (node.extensions && typeof node.extensions === "object") {
      for (const k of Object.keys(node.extensions)) acc.add(k);
    }
    for (const v of Object.values(node)) collecterExtensions(v, acc);
  }
}

// ─── remap récursif des index (bufferView / accessor) ──────────────────────────

function remapIndex(obj, mapBv, mapAcc) {
  if (Array.isArray(obj)) {
    for (const v of obj) remapIndex(v, mapBv, mapAcc);
    return;
  }
  if (!obj || typeof obj !== "object") return;
  for (const [k, v] of Object.entries(obj)) {
    if (k === "bufferView" && typeof v === "number" && mapBv.has(v)) {
      obj[k] = mapBv.get(v);
    } else if (k === "accessor" && typeof v === "number" && mapAcc.has(v)) {
      obj[k] = mapAcc.get(v);
    } else {
      remapIndex(v, mapBv, mapAcc);
    }
  }
}

// Vérifie qu'aucune référence ne pointe vers une bufferView retirée.
function verifierReferences(obj, nbBv) {
  let invalide = false;
  const scan = (n) => {
    if (Array.isArray(n)) { for (const v of n) scan(v); return; }
    if (!n || typeof n !== "object") return;
    for (const [k, v] of Object.entries(n)) {
      if (k === "bufferView" && typeof v === "number" && v >= nbBv) invalide = true;
      else scan(v);
    }
  };
  scan(obj);
  return !invalide;
}

// ─── nettoyage des champs de texture (tout *Texture) ───────────────────────────

function nettoyerTextures(obj) {
  if (Array.isArray(obj)) {
    for (const v of obj) nettoyerTextures(v);
    return;
  }
  if (!obj || typeof obj !== "object") return;
  for (const k of Object.keys(obj)) {
    if (k.endsWith("Texture")) delete obj[k];
    else nettoyerTextures(obj[k]);
  }
}

// ─── transformation principale ──────────────────────────────────────────────────

function degraisser(chemin) {
  const avant = poids(chemin);
  const { json, bin } = lireGlb(chemin);

  const comptes = {
    animations: json.animations?.length ?? 0,
    nodes: json.nodes?.length ?? 0,
    accessors: json.accessors?.length ?? 0,
    meshes: json.meshes?.length ?? 0,
    skins: json.skins?.length ?? 0,
    images: json.images?.length ?? 0,
    textures: json.textures?.length ?? 0,
    materials: json.materials?.length ?? 0,
    samplers: json.samplers?.length ?? 0,
    bufferViews: json.bufferViews?.length ?? 0,
  };

  // Règle 1 : ne touche qu'aux fichiers d'ANIMATION.
  if (!json.animations || json.animations.length === 0) {
    return { chemin, cible: false, avant, apres: avant, comptes, raison: "pas d'animation — ignoré" };
  }

  // 1. Images embarquées = celles avec bufferView (ou data: URI). On retire TOUTES
  //    les images d'un GLB d'animation : ses textures sont des copies redondantes.
  const imagesRetirees = (json.images ?? []).map((im) => im.bufferView).filter((i) => i !== undefined && i !== null);
  const imageUriExterne = (json.images ?? []).filter((im) => im.uri && !im.uri.startsWith("data:")).length;

  // 2. bufferViews des images -> à retirer (sauf si un accessor les référence).
  const bvParAccessors = new Set();
  for (const a of json.accessors ?? []) if (a.bufferView !== undefined) bvParAccessors.add(a.bufferView);
  const bvARetirer = [];
  for (const i of imagesRetirees) {
    if (bvParAccessors.has(i)) continue; // partagée avec un accessor : garder
    bvARetirer.push(i);
  }
  const bvConservee = [];
  const mapBv = new Map();
  (json.bufferViews ?? []).forEach((_, i) => {
    if (!bvARetirer.includes(i)) {
      mapBv.set(i, bvConservee.length);
      bvConservee.push(i);
    }
  });

  // 3. Réindexer bufferView/accessor (les accessors, eux, ne changent pas de compte).
  remapIndex(json, mapBv, new Map());

  // 4. Retirer images / textures / samplers (s'ils ne servent plus) et vider les
  //    champs de texture des matériaux (baseColorTexture, normalTexture, …).
  delete json.images;
  delete json.textures;
  delete json.samplers;
  nettoyerTextures(json.materials ?? []);

  const refsValides = verifierReferences(json, bvConservee.length);

  // 5. reconstruire le buffer : concat des bufferViews conservées, alignées à 4.
  const fragments = [];
  let pos = 0;
  const bvsFinales = [];
  for (const i of bvConservee) {
    const bv = json.bufferViews[i];
    const start = bv.byteOffset ?? 0;
    const end = start + bv.byteLength;
    const aligne = Buffer.alloc(pad(pos, 4) - pos);
    fragments.push(aligne);
    pos += aligne.length;
    fragments.push(bin ? bin.subarray(start, end) : Buffer.alloc(0));
    bv.byteOffset = pos;
    bvsFinales.push(bv);
    pos += end - start;
  }
  json.bufferViews = bvsFinales;
  const nouveauBin = Buffer.concat(fragments);
  if (json.buffers) json.buffers[0].byteLength = nouveauBin.length;

  // 6. extensionsUsed / extensionsRequired = seulement ce qui reste utilisé.
  const encore = new Set();
  collecterExtensions(json, encore);
  const ancienUsed = json.extensionsUsed ?? [];
  const ancienReq = json.extensionsRequired ?? [];
  if (ancienUsed.length) json.extensionsUsed = ancienUsed.filter((e) => encore.has(e));
  if (ancienReq.length) json.extensionsRequired = ancienReq.filter((e) => encore.has(e));

  // 7. taille estimée / écrite
  const jsonBuf = Buffer.from(JSON.stringify(json), "utf8");
  const apres = 12 + 8 + pad(jsonBuf.length, 4) + 8 + pad(nouveauBin.length, 4);
  const integrite = {
    animations: comptes.animations === (json.animations?.length ?? 0),
    nodes: comptes.nodes === (json.nodes?.length ?? 0),
    accessors: comptes.accessors === (json.accessors?.length ?? 0),
    meshes: comptes.meshes === (json.meshes?.length ?? 0),
    skins: comptes.skins === (json.skins?.length ?? 0),
    bufferViews: comptes.bufferViews - bvARetirer.length === (json.bufferViews?.length ?? 0),
    refs: refsValides,
  };
  return { chemin, cible: true, avant, apres, comptes, integrite, nouveauBin, json, imageUriExterne };
}

// ─── collecte des cibles ────────────────────────────────────────────────────────

const estDossier = fs.existsSync(CIBLE) && fs.statSync(CIBLE).isDirectory();
let fichiers = [];
let sortieRacine = null;
if (estDossier) {
  const parcourir = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) parcourir(p);
      else if (e.name.toLowerCase().endsWith(".glb") && !e.name.toLowerCase().includes("_degraisse")) fichiers.push(p);
    }
  };
  parcourir(CIBLE);
  sortieRacine = `${CIBLE}_degraisse`;
} else {
  fichiers = [CIBLE];
  sortieRacine = null;
}

console.log(APPLY ? "=== APPLIQUÉ ===" : "=== SIMULATION (ajouter --apply) ===");
console.log(`Cible : ${CIBLE}${estDossier ? " (dossier)" : " (fichier)"}`);
console.log(`${fichiers.length} fichier(s) .glb trouvé(s)`);
console.log("");

// ─── traitement ────────────────────────────────────────────────────────────────

const rapports = [];
let avantTotal = 0;
let apresTotal = 0;
let cibles = 0;
let echecs = 0;
const echecsListe = [];

for (const f of fichiers) {
  try {
    const r = degraisser(f);
    avantTotal += r.avant > 0 ? r.avant : 0;
    if (r.cible) {
      cibles++;
      apresTotal += r.apres > 0 ? r.apres : 0;
      const gain = r.avant > 0 ? ((r.avant - r.apres) / r.avant) * 100 : 0;
      const rel = path.relative(estDossier ? CIBLE : path.dirname(f), r.chemin);
      const dest = APPLY
        ? estDossier
          ? path.join(sortieRacine, rel)
          : r.chemin.replace(/\.glb$/i, "_degraisse.glb")
        : "(simulation)";
      const ok = Object.values(r.integrite).every(Boolean);
      rapports.push({ f, rel, avant: r.avant, apres: r.apres, gain, ok, cible: true, integrite: r.integrite, img: r.comptes.images, ext: r.imageUriExterne });
      if (!ok) {
        echecs++;
        echecsListe.push(f);
      }
      if (APPLY) {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        const tailleE = ecrireGlb(dest, r.json, r.nouveauBin);
        // relecture de contrôle : intégrité du fichier écrit
        const relu = lireGlb(dest);
        const verif = {
          animations: (relu.json.animations?.length ?? 0) === r.comptes.animations,
          nodes: (relu.json.nodes?.length ?? 0) === r.comptes.nodes,
          accessors: (relu.json.accessors?.length ?? 0) === r.comptes.accessors,
          meshes: (relu.json.meshes?.length ?? 0) === r.comptes.meshes,
          skins: (relu.json.skins?.length ?? 0) === r.comptes.skins,
          images: (relu.json.images?.length ?? 0) === 0,
        };
        const okE = Object.values(verif).every(Boolean);
        rapports[rapports.length - 1].ecrit = dest;
        rapports[rapports.length - 1].tailleEcrite = tailleE;
        rapports[rapports.length - 1].relu = verif;
        if (!okE) {
          echecs++;
          echecsListe.push(f + " (relecture)");
        }
      }
    } else {
      rapports.push({ f, rel: path.relative(estDossier ? CIBLE : path.dirname(f), f), avant: r.avant, apres: r.avant, gain: 0, ok: true, cible: false, integrite: null, img: r.comptes.images, ext: 0, nonCible: true, raison: r.raison });
    }
  } catch (err) {
    echecs++;
    echecsListe.push(f + " :: " + err.message);
    rapports.push({ f, erreur: err.message, avant: poids(f), apres: 0, gain: 0, ok: false });
  }
}

// ─── rapport ───────────────────────────────────────────────────────────────────

console.log("─" .repeat(96));
console.log("RAPPORT — dégraissage des GLB d'animation");
console.log("─" .repeat(96));
if (fichiers.length <= 30) {
  for (const r of rapports) {
    if (r.erreur) {
      console.log(`✗ ${path.basename(r.f)}  ERREUR : ${r.erreur}`);
      continue;
    }
    if (r.nonCible) {
      console.log(`· ${r.rel}  (${MO(r.avant)})  — ${r.raison}`);
      continue;
    }
    const g = r.gain.toFixed(1);
    const ig = r.integrite ? (Object.values(r.integrite).every(Boolean) ? "INTÉGRITÉ OK" : "INTÉGRITÉ ✗") : "";
    const relecture = r.relu ? (Object.values(r.relu).every(Boolean) ? " · relecture OK" : " · relecture ✗") : "";
    console.log(`✓ ${r.rel}  ${MO(r.avant)} → ${MO(r.apres)}  (−${g} %)  ${ig}${relecture}`);
  }
} else {
  const okC = rapports.filter((r) => r.cible && r.ok).length;
  const nonC = rapports.filter((r) => r.nonCible).length;
  const err = rapports.filter((r) => r.erreur).length;
  console.log(`${cibles} GLB d'animation traités (${okC} intègres · ${nonC} non-animations ignorés · ${err} erreurs)`);
  const gains = rapports.filter((r) => r.cible).map((r) => r.gain);
  const min = gains.length ? Math.min(...gains) : 0;
  const max = gains.length ? Math.max(...gains) : 0;
  console.log(`Gain par fichier : ${min.toFixed(1)} % → ${max.toFixed(1)} %`);
}
console.log("");
console.log(`Poids avant : ${MO(avantTotal)}   Poids après : ${MO(apresTotal)}   Gain : ${MO(avantTotal - apresTotal)} (${avantTotal ? (((avantTotal - apresTotal) / avantTotal) * 100).toFixed(1) : 0} %)`);
if (APPLY) console.log(`Sortie : ${sortieRacine ?? "(fichiers *_degraisse.glb)"}`);
else console.log("Simulation — aucun fichier écrit. Relancer avec --apply pour écrire.");
if (echecs > 0) {
  console.log(`${echecs} fichier(s) en échec :`);
  for (const e of echecsListe) console.log("  ✗ " + e);
}