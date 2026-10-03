// ══════════════════════════════════════════════════════════════════════════════
// scripts/lib/ktx2-encode.mjs — Cœur d'encodage KTX2/Basis, partagé.
//
// Extrait de chunks-to-ktx2.mjs pour être réutilisé par assets-to-ktx2.mjs :
// les deux pipelines diffèrent par ce qu'ils font à la GÉOMÉTRIE (les chunks de
// map sont dracoifiés et prunés, les personnages ne doivent surtout pas l'être),
// mais le traitement des TEXTURES est strictement identique.
// ══════════════════════════════════════════════════════════════════════════════

import sharp from "sharp";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const execFileAsync = promisify(execFile);

/** Concurrence par défaut : l'encodage Basis sature le CPU. */
export const DEFAULT_CONCURRENCY = Math.max(1, os.cpus().length - 1);

/** Localise le CLI `ktx` (KTX-Software ≥ 4.3) ou renvoie null. */
export function findKtxCli() {
  if (process.env.KTX_CLI && existsSync(process.env.KTX_CLI)) return process.env.KTX_CLI;
  const candidates = [
    "tools/KTX-Software-main/KTX-Software-main/build/Release/ktx.exe",
    "tools/KTX-Software-main/KTX-Software-main/build/Release/ktx",
    "tools/KTX-Software-main/KTX-Software-main/build/tools/ktx/Release/ktx.exe",
  ];
  for (const c of candidates) {
    const p = path.resolve(c);
    if (existsSync(p)) return p;
  }
  return null;
}

/** Exécute des thunks avec une concurrence bornée. */
export async function runPool(tasks, limit) {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (i < tasks.length) await tasks[i++]();
  });
  await Promise.all(workers);
}

/**
 * Calcule des dimensions sûres pour une texture compressée par blocs.
 *
 * BUG CORRIGÉ ICI (il a bloqué le chargement de la forge) : la version
 * précédente utilisait `sharp.resize(max, max, { fit: "inside" })`, qui préserve
 * le ratio. Une texture 3:2 devenait donc 1024×682 — et 682 n'est pas divisible
 * par 4.
 *
 * Or BC1/BC7/ETC encodent des tuiles de 4×4 pixels. Une dimension non multiple
 * de 4 fait rejeter l'upload par le GPU (`GL_INVALID_OPERATION` sur
 * `compressedTexImage2D`), l'exception remonte dans le chargement du chunk, et
 * la map ne s'assemble jamais. L'encodage, lui, réussissait sans broncher : la
 * panne n'apparaissait qu'au runtime.
 *
 * On force donc des PUISSANCES DE DEUX, et pas seulement des multiples de 4 :
 * avec `--generate-mipmap`, une base 1024×684 (multiple de 4) descend en
 * 512×342, puis 256×171 — non multiple de 4 à son tour. Seule une puissance de
 * deux garantit une chaîne de mipmaps entièrement valide.
 *
 * Déformer le ratio est SANS effet visuel : les UV sont normalisées 0..1, donc
 * une texture stockée en 1024×512 au lieu de 1024×682 est simplement échantillonnée
 * avec un peu moins de détail vertical — jamais étirée à l'écran.
 */
export function safeBlockDimensions(width, height, maxSize) {
  const snap = (n) => {
    if (!n || n < 1) return 4;
    const p = 2 ** Math.round(Math.log2(n));
    return Math.max(4, Math.min(maxSize, p));
  };
  // On applique d'abord la réduction à `maxSize` en conservant le ratio, PUIS on
  // arrondit chaque côté : partir des dimensions d'origine ferait remonter une
  // petite texture (256×256) jusqu'à maxSize inutilement.
  const scale = Math.min(1, maxSize / Math.max(width, height));
  return [snap(Math.round(width * scale)), snap(Math.round(height * scale))];
}

/**
 * Encode un buffer image (PNG/WebP/JPEG) en KTX2.
 *
 * `srgb` : les couleurs (baseColor, emissive) sont en sRGB ; les données
 * (normal, metallicRoughness, occlusion) sont LINÉAIRES. Se tromper délave ou
 * assombrit visiblement le rendu.
 *
 * `uastc` : ETC1S est ~2× plus compact mais bloque visiblement sur les normal
 * maps (dégradés doux) — d'où UASTC pour elles, sur les assets vus de près.
 */
export async function encodeToKtx2(buf, { srgb, uastc, maxSize, ktxCli, tmpDir, tag }) {
  const inPath = path.join(tmpDir, `${tag}.png`);
  const outPath = path.join(tmpDir, `${tag}.ktx2`);
  try {
    const { width, height } = await sharp(buf).metadata();
    const [w, h] = safeBlockDimensions(width, height, maxSize);
    // `fit: "fill"` force les dimensions EXACTES calculées ci-dessus. Surtout pas
    // `fit: "inside"` : il préserve le ratio et produit des tailles arbitraires
    // (cf. safeBlockDimensions pour pourquoi c'est fatal côté GPU).
    await sharp(buf)
      .resize(w, h, { fit: "fill" })
      .png()
      .toFile(inPath);

    await execFileAsync(ktxCli, [
      "create",
      "--format", srgb ? "R8G8B8A8_SRGB" : "R8G8B8A8_UNORM",
      "--encode", uastc ? "uastc" : "basis-lz",
      "--generate-mipmap",
      "--assign-tf", srgb ? "srgb" : "linear",
      inPath,
      outPath,
    ], { maxBuffer: 64 * 1024 * 1024 });

    return new Uint8Array(readFileSync(outPath));
  } finally {
    rmSync(inPath, { force: true });
    rmSync(outPath, { force: true });
  }
}

/**
 * Classe les textures d'un document par espace colorimétrique et par rôle.
 * Une même texture peut servir plusieurs matériaux : on prend l'union.
 */
export function classifyTextures(root) {
  const normal = new Set();
  const linear = new Set();
  for (const mat of root.listMaterials()) {
    const nt = mat.getNormalTexture();
    if (nt) { normal.add(nt); linear.add(nt); }
    const mr = mat.getMetallicRoughnessTexture();
    if (mr) linear.add(mr);
    const occ = mat.getOcclusionTexture();
    if (occ) linear.add(occ);
  }
  return { normal, linear };
}

/** Estime la VRAM d'une texture décompressée en RGBA8, mipmaps inclus (×4/3). */
export async function estimateVramBytes(img) {
  try {
    const m = await sharp(Buffer.from(img)).metadata();
    return m.width * m.height * 4 * 1.3333;
  } catch {
    return 0; // déjà en KTX2 : sharp ne sait pas le lire, et ce n'est pas la cible
  }
}

/**
 * Convertit TOUTES les textures d'un document en KTX2, en place.
 * Ne touche ni à la géométrie, ni aux nœuds, ni aux animations.
 *
 * Une texture qui échoue est CONSERVÉE dans son format d'origine : un GLB peut
 * mélanger KTX2 et PNG, mieux vaut un asset partiellement optimisé qu'un asset
 * perdu.
 */
export async function convertDocumentTextures(doc, opts) {
  const { maxSize, ktxCli, tmpDir, tag, uastcNormals, concurrency } = opts;
  const root = doc.getRoot();
  const { normal, linear } = classifyTextures(root);
  const textures = root.listTextures();

  const stats = { count: textures.length, before: 0, after: 0, vramBefore: 0, failed: 0, skipped: 0 };

  const tasks = textures.map((tex, idx) => async () => {
    const img = tex.getImage();
    if (!img) { stats.skipped++; return; }
    if (tex.getMimeType() === "image/ktx2") { stats.skipped++; return; }

    stats.before += img.byteLength;
    // `stats.x += await f()` PERD des écritures : la lecture de `stats.x` a lieu
    // AVANT l'await, donc avec 15 tâches concurrentes les incréments s'écrasent
    // entre eux. On résout d'abord, on additionne ensuite — l'addition seule est
    // atomique dans la boucle d'événements.
    const vram = await estimateVramBytes(img);
    stats.vramBefore += vram;

    try {
      const ktx = await encodeToKtx2(Buffer.from(img), {
        srgb: !linear.has(tex),
        uastc: uastcNormals && normal.has(tex),
        maxSize, ktxCli, tmpDir,
        tag: `${tag}-${idx}`,
      });
      tex.setImage(ktx).setMimeType("image/ktx2");
      stats.after += ktx.byteLength;
    } catch (err) {
      stats.failed++;
      stats.after += img.byteLength;
      console.warn(`    ! texture #${idx} : ${String(err.message ?? err).split("\n")[0]}`);
    }
  });

  await runPool(tasks, concurrency ?? DEFAULT_CONCURRENCY);
  return stats;
}

/**
 * Retire EXT_texture_webp s'il ne reste plus aucune texture WebP.
 * `prune()` ne le fait pas : le GLB déclarerait une extension que son contenu
 * n'utilise plus, ce que certains validateurs rejettent.
 */
export function dropUnusedWebpExtension(doc) {
  const stillWebp = doc.getRoot().listTextures().some((t) => t.getMimeType() === "image/webp");
  if (stillWebp) return;
  for (const ext of doc.getRoot().listExtensionsUsed()) {
    if (ext.extensionName === "EXT_texture_webp") ext.dispose();
  }
}

export const MB = (b) => (b / 1048576).toFixed(1);
