// ══════════════════════════════════════════════════════════════════════════════
// scripts/puzzle-chunks.mjs — Découpe un GLB en N chunks équilibrés
//
// Usage :
//   node scripts/puzzle-chunks.mjs <input.glb> <outputDir> <chunkCount>
//
// Exemple :
//   node scripts/puzzle-chunks.mjs \
//     public/models/Maps/M02_OrbitalHub.glb \
//     public/models/Maps/orbital \
//     8
//
// Stratégie :
//   1. Charge le GLB source via @gltf-transform/core.
//   2. Liste tous les Nodes top-level de la scène principale.
//   3. Calcule le "vertex cost" agrégé sous chaque sous-arbre.
//   4. Tri par cost desc, puis round-robin par bucket de min-cost
//      (greedy LPT scheduling = NP-hard mais bonne approx).
//   5. Pour chaque bucket :
//      a) Clone le Document complet.
//      b) Détache TOUS les nodes top-level qui ne sont PAS dans ce bucket.
//      c) prune() → vire les buffers/textures/materials/meshes orphelins.
//      d) dedup() → fusionne les ressources identiques (instancing préservé).
//      e) Écrit le GLB du chunk.
//
// Note position monde : chaque Node garde son transform (TRS). Donc charger
// les chunks dans n'importe quel ordre les assemble correctement à l'écran.
// ══════════════════════════════════════════════════════════════════════════════

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { prune, dedup, flatten, join as joinMeshes, cloneDocument, draco, textureCompress } from "@gltf-transform/functions";
import { mkdirSync, statSync, createReadStream, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import draco3d from "draco3dgltf";
import sharp from "sharp";

const SPATIAL = process.argv.includes("--spatial");

/** Lit un flag `--nom=valeur`, sinon retourne `fallback`. */
function val(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}
const positional = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const [inputPath, outputDir, chunkCountArg, maxTexSizeArg] = positional;
if (!inputPath || !outputDir || !chunkCountArg) {
  console.error("Usage: node puzzle-chunks.mjs <input.glb> <outputDir> <chunkCount> [maxTexSize] [--spatial] [--format=webp|png]");
  console.error("  maxTexSize : optional, default 2048 (2048 = ~25-40MB/chunk, 512 = ~7MB/chunk)");
  console.error("  --spatial  : spatial bucketing (grid XZ) instead of LPT vertex-balanced");
  process.exit(1);
}
const CHUNK_COUNT = parseInt(chunkCountArg, 10);
if (!Number.isFinite(CHUNK_COUNT) || CHUNK_COUNT < 2) {
  console.error("chunkCount must be >= 2");
  process.exit(1);
}
// Taille max textures (longueur du côté le plus long). Default 2048 (cap GPU runtime).
// Le runtime (StreamingPuzzleMap.downsampleTexture) clamp à 2048px de toute façon :
// aller au-delà gaspille de la bande passante sans gain visuel.
const MAX_TEX_SIZE = maxTexSizeArg ? parseInt(maxTexSizeArg, 10) : 2048;

// Format des textures. WebP par defaut : c est ce que veut le runtime web.
// --format=png pour un import UNREAL : Interchange ne lit pas EXT_texture_webp
// (18 extensions KHR supportees, celle-ci n en fait pas partie). Les meshes
// passeraient, les textures non, SANS erreur — personnages et decors gris.
const TEX_FORMAT = val("format", "webp");

// Bits de quantification Draco. Voir le commentaire long au niveau de l'appel
// draco() : le défaut de gltf-transform (14) détruit les petits objets une fois
// join() appliqué. 18 bits est le minimum sûr pour une map de plusieurs milliers
// d'unités ; surchargeable via --quant=<bits> pour les maps très étendues.
const QUANT_POSITION = parseInt(val("quant", "18"), 10);
const QUANT_NORMAL = 12;
if (!Number.isFinite(QUANT_POSITION) || QUANT_POSITION < 14 || QUANT_POSITION > 24) {
  console.error("--quant doit être entre 14 et 24 bits");
  process.exit(1);
}

mkdirSync(outputDir, { recursive: true });

// ── Tag du chunk → utilisé pour les noms de fichiers de sortie ──────────────
// On utilise le basename du GLB d'entrée comme préfixe (ex: "orbital" depuis
// "M02_OrbitalHub.glb"). Mais ici on simplifie : chunk_NN.glb suffit, le
// dossier de sortie indique déjà la map.
function chunkFilename(i) {
  const n = String(i + 1).padStart(2, "0");
  return `chunk_${n}.glb`;
}

// ── Centre monde d'un node (après flatten, translation = position monde) ────
function nodeCenter(node) {
  const t = node.getTranslation();
  // Si le node a un mesh, utiliser le centre AABB comme offset
  const mesh = node.getMesh();
  if (mesh) {
    let sumX = 0, sumY = 0, sumZ = 0, count = 0;
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute("POSITION");
      if (!pos) continue;
      const arr = pos.getArray();
      for (let i = 0; i < arr.length; i += 3) {
        sumX += arr[i]; sumY += arr[i + 1]; sumZ += arr[i + 2];
      }
      count += arr.length / 3;
    }
    if (count > 0) {
      return [t[0] + sumX / count, t[1] + sumY / count, t[2] + sumZ / count];
    }
  }
  return [t[0], t[1], t[2]];
}

// ── Bucketing spatial (médiane récursive k-d tree) ──────────────────────────
// Découpe les nodes en `count` groupes spatialement cohérents en splitant
// alternativement sur l'axe de plus grande étendue au médian.
function spatialBucket(nodesWithCenter, count) {
  if (count <= 1 || nodesWithCenter.length === 0) return [nodesWithCenter];

  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const nc of nodesWithCenter) {
    minX = Math.min(minX, nc.cx); maxX = Math.max(maxX, nc.cx);
    minZ = Math.min(minZ, nc.cz); maxZ = Math.max(maxZ, nc.cz);
  }

  const useX = (maxX - minX) >= (maxZ - minZ);
  const sorted = [...nodesWithCenter].sort((a, b) =>
    useX ? a.cx - b.cx : a.cz - b.cz
  );

  const mid = Math.floor(sorted.length / 2);
  const leftCount = Math.floor(count / 2);
  const rightCount = count - leftCount;

  return [
    ...spatialBucket(sorted.slice(0, mid), leftCount),
    ...spatialBucket(sorted.slice(mid), rightCount),
  ];
}

// ── Calcul du vertex cost d'un sous-arbre ───────────────────────────────────
// On somme les vertex counts de toutes les primitives sous le node.
function vertexCost(node) {
  let total = 0;
  const visit = (n) => {
    const mesh = n.getMesh();
    if (mesh) {
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute("POSITION");
        if (pos) total += pos.getCount();
      }
    }
    for (const child of n.listChildren()) visit(child);
  };
  visit(node);
  return total;
}

// ── Main ────────────────────────────────────────────────────────────────────
const t0 = Date.now();

// NodeIO + extensions Khronos (KHR_draco_mesh_compression, KHR_materials_*, etc.).
// Sans `registerDependencies` Draco, lire un GLB compressé throw immédiatement.
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    "draco3d.decoder": await draco3d.createDecoderModule(),
    "draco3d.encoder": await draco3d.createEncoderModule(),
  });

console.log(`[puzzle] Loading ${inputPath} ...`);

// .glb (binaire, un seul fichier) et .gltf (JSON + .bin + images à côté) ne se
// lisent PAS pareil. `readBinary` refuse un .gltf avec « Invalid glTF 2.0
// binary » — c'est ce qui a fait échouer la découpe de la map orbitale, qui
// s'accompagne d'un .bin et de 247 images séparées.
//
// Le .glb passe par une lecture en FLUX : `fs.readFile` plafonne à 2 Gio sous
// Node, et halo_map.glb en pèse 3,06. `io.read()` gère la résolution des
// fichiers voisins du .gltf tout seul.
let doc;
if (/\.gltf$/i.test(inputPath)) {
  doc = await io.read(inputPath);
  console.log(`[puzzle] .gltf lu (ressources externes résolues)`);
} else {
  const fileChunks = [];
  for await (const chunk of createReadStream(inputPath)) {
    fileChunks.push(chunk);
  }
  const fileBuf = Buffer.concat(fileChunks);
  console.log(`[puzzle] Read ${(fileBuf.length / (1024 * 1024 * 1024)).toFixed(2)} GiB into memory`);
  doc = await io.readBinary(new Uint8Array(fileBuf.buffer, fileBuf.byteOffset, fileBuf.byteLength));
}

// Aplatit la hiérarchie : tous les Nodes-avec-mesh remontent au niveau racine
// avec leur matrice monde appliquée. Indispensable pour un split équilibré
// quand la map a une hiérarchie pyramidale (1 racine → 25k enfants).
console.log(`[puzzle] Flattening hierarchy...`);
await doc.transform(flatten());

// Compresse les textures UNE SEULE FOIS sur le document source.
// - resize : longueur max d'un côté (préserve l'aspect ratio).
// - targetFormat 'webp' : 25-35% plus petit que JPEG à qualité équivalente.
// - Encoder sharp : backend Node.js (libvips bindings).
// Après cette étape, `cloneDocument()` dans la boucle des buckets duplique les
// bytes WebP déjà encodés → coût négligeable (vs ré-encoder 8x).
console.log(`[puzzle] Compressing textures (max ${MAX_TEX_SIZE}px, ${TEX_FORMAT})...`);
await doc.transform(
  textureCompress({
    encoder: sharp,
    targetFormat: TEX_FORMAT,
    resize: [MAX_TEX_SIZE, MAX_TEX_SIZE],
  })
);

const root = doc.getRoot();
const scene = root.getDefaultScene() ?? root.listScenes()[0];
if (!scene) {
  console.error("No scene found in GLB");
  process.exit(1);
}

const topNodes = scene.listChildren();
console.log(`[puzzle] Scene "${scene.getName()}" : ${topNodes.length} top-level nodes (after flatten)`);

// Calcul cost par node + tri desc
const ranked = topNodes
  .map((n) => ({ node: n, cost: vertexCost(n), name: n.getName() || "<unnamed>" }))
  .sort((a, b) => b.cost - a.cost);

const totalCost = ranked.reduce((s, r) => s + r.cost, 0);
console.log(`[puzzle] Total vertices: ${totalCost.toLocaleString()}`);

// ── Bucketing : LPT (vertex-balanced) ou spatial (XZ grid k-d tree) ─────────
const buckets = Array.from({ length: CHUNK_COUNT }, () => ({ nodes: [], cost: 0 }));

if (SPATIAL) {
  console.log(`[puzzle] Mode SPATIAL — bucketing par médiane k-d tree (XZ)`);
  const nodesWithCenter = ranked.map((r) => {
    const c = nodeCenter(r.node);
    return { node: r.node, cost: r.cost, cx: c[0], cy: c[1], cz: c[2] };
  });
  const groups = spatialBucket(nodesWithCenter, CHUNK_COUNT);
  for (let i = 0; i < groups.length; i++) {
    for (const nc of groups[i]) {
      buckets[i].nodes.push(nc.node);
      buckets[i].cost += nc.cost;
    }
  }
} else {
  // Greedy LPT scheduling : assigne chaque node au bucket le moins chargé
  for (const r of ranked) {
    let minIdx = 0;
    for (let i = 1; i < CHUNK_COUNT; i++) {
      if (buckets[i].cost < buckets[minIdx].cost) minIdx = i;
    }
    buckets[minIdx].nodes.push(r.node);
    buckets[minIdx].cost += r.cost;
  }
}

console.log("[puzzle] Bucket plan:");
for (let i = 0; i < CHUNK_COUNT; i++) {
  console.log(
    `  bucket ${String(i + 1).padStart(2, "0")} : ${buckets[i].nodes.length} nodes, ${buckets[i].cost.toLocaleString()} verts`
  );
}

// ── Génération de chaque chunk ──────────────────────────────────────────────
// Stratégie : on clone le document complet pour chaque bucket, puis on
// dispose les nodes qui n'appartiennent PAS au bucket courant. La méthode
// `dispose()` détache le node ET retire sa référence du graph → après
// prune(), les meshes/textures/materials non-référencés disparaissent.
//
// On identifie les nodes à conserver par leur **index** dans topNodes,
// car après clone() les références d'objet changent (nouvelles instances).
const nodeIndexInScene = new Map();
topNodes.forEach((n, idx) => nodeIndexInScene.set(n, idx));

const bucketIndexSets = buckets.map(
  (b) => new Set(b.nodes.map((n) => nodeIndexInScene.get(n)))
);

const chunkSizes = [];

for (let b = 0; b < CHUNK_COUNT; b++) {
  const tBucket = Date.now();
  const keepSet = bucketIndexSets[b];

  // Clone : duplique tout le Document (deep copy via cloneDocument helper).
  const clonedDoc = cloneDocument(doc);
  const clonedRoot = clonedDoc.getRoot();
  const clonedScene = clonedRoot.getDefaultScene() ?? clonedRoot.listScenes()[0];
  const clonedTopNodes = clonedScene.listChildren();

  // Dispose des nodes hors bucket.
  // On le fait en deux temps : collecter d'abord (mutation pendant iter casse),
  // puis dispose() ensuite.
  const toDispose = [];
  clonedTopNodes.forEach((n, idx) => {
    if (!keepSet.has(idx)) toDispose.push(n);
  });
  for (const n of toDispose) n.dispose();

  // Pipeline d'optimisation par chunk :
  //   prune()  → vire les ressources orphelines (mesh/material/texture sans réf)
  //   dedup()  → fusionne matériaux/textures/accessors identiques en un seul objet
  //   join()   → FUSIONNE les meshes partageant un matériau en une seule
  //              BufferGeometry → effondre le nombre de draw calls (ex: tower
  //              ~5165 meshes/chunk → ~400). C'est LE gain runtime majeur :
  //              moins de draw calls = plus de FPS + moins de shaders à compiler.
  //              keepNamed:false → fusionne aussi les nodes nommés (agressif).
  //   draco()  → ré-encode la géométrie compressée (sinon sortie raw = 5-10x +gros).
  // Ordre dedup→join : join ne fusionne que des meshes pointant vers le MÊME
  // objet matériau, donc dedup doit unifier les matériaux d'abord.
  //
  // ⚠️ quantizePosition DOIT être relevé au-dessus du défaut (14) parce que
  // draco() tourne APRÈS join(). Draco quantifie les positions sur la boîte
  // englobante de chaque primitive : avant join, c'est celle d'un objet
  // (médiane 1,9 unité) ; après join, c'est celle de la map entière
  // (~2440 unités). À 14 bits le pas devient 2440/2^14 = 0,15 unité, alors que
  // 10 % des objets de halo_map mesurent moins de 0,23 unité. Ces objets
  // s'aplatissent, leurs triangles deviennent dégénérés et l'encodeur les
  // SUPPRIME — mesuré : 12,8 % des triangles perdus, soit des morceaux de map
  // manquants en jeu. À 18 bits le pas retombe à 0,009 unité (9 mm).
  // Le surcoût disque est négligeable : la géométrie pèse ~3 Mo sur des chunks
  // de 36 Mo dont 33 Mo de textures.
  // Mesure par étage : sans ça, une perte de géométrie dans le pipeline est
  // invisible jusqu'à ce qu'un joueur signale un trou dans la map. Comparer la
  // ligne `bucket` (ce qu'on a mis dedans) à la ligne `draco` (ce qui sort).
  const tally = (label) => {
    let tris = 0, verts = 0, prims = 0;
    for (const m of clonedDoc.getRoot().listMeshes()) {
      for (const p of m.listPrimitives()) {
        prims++;
        const i = p.getIndices();
        tris += i ? i.getCount() / 3 : 0;
        verts += p.getAttribute("POSITION").getCount();
      }
    }
    console.log(
      `    [geo] ${label.padEnd(8)} prims=${String(prims).padStart(6)}` +
      ` verts=${verts.toLocaleString().padStart(11)} tris=${Math.round(tris).toLocaleString().padStart(11)}`
    );
    return { prims, verts, tris };
  };

  const before = tally("bucket");
  await clonedDoc.transform(prune());                          tally("prune");
  await clonedDoc.transform(dedup());                          tally("dedup");
  await clonedDoc.transform(joinMeshes({ keepNamed: false })); tally("join");
  await clonedDoc.transform(
    draco({ quantizePosition: QUANT_POSITION, quantizeNormal: QUANT_NORMAL }),
  );
  const after = tally("draco");

  const triLoss = before.tris ? (1 - after.tris / before.tris) * 100 : 0;
  if (triLoss > 1) {
    console.warn(
      `    [geo] ⚠ ${triLoss.toFixed(1)}% des triangles perdus dans le pipeline ` +
      `(${Math.round(before.tris - after.tris).toLocaleString()} triangles) — ` +
      `géométrie manquante en jeu.`
    );
  }

  // Écrit le chunk.
  const outPath = join(outputDir, chunkFilename(b));
  await io.write(outPath, clonedDoc);
  const sizeMb = statSync(outPath).size / (1024 * 1024);
  chunkSizes[b] = sizeMb;
  console.log(
    `[puzzle] wrote ${outPath} — ${sizeMb.toFixed(1)} MB (${Date.now() - tBucket}ms)`
  );
}

// ── Métadonnées spatiales par chunk (pour le streaming WASM) ────────────────
// Calcule le centre et le rayon de chaque chunk à partir des positions monde
// des nodes qu'il contient. Le rayon inclut l'étendue du mesh de chaque node
// (via la bounding sphere), pas seulement le centre — sans quoi les meshes
// étendus (sols, murs) dépasseraient systématiquement le rayon calculé.
// Les coques enveloppantes (grand mesh, très peu de triangles) gonflent
// artificiellement le rayon ; le runtime JS les exclut et corrige le rayon
// WASM après chargement via `updateChunkRadius`.
const chunkMeta = buckets.map((bucket, i) => {
  let sumX = 0, sumY = 0, sumZ = 0;
  const centers = [];
  const nodeRadii = [];
  for (const node of bucket.nodes) {
    const c = nodeCenter(node);
    sumX += c[0]; sumY += c[1]; sumZ += c[2];
    centers.push(c);
    // Calcule le rayon de la bounding sphere du node lui-même (étendue du mesh)
    const mesh = node.getMesh();
    let nodeRadius = 0;
    if (mesh) {
      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;
      let minZ = Infinity, maxZ = -Infinity;
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute("POSITION");
        if (!pos) continue;
        const arr = pos.getArray();
        for (let vi = 0; vi < arr.length; vi += 3) {
          const px = arr[vi] + c[0];   // position MONDE = translation node + position locale
          const py = arr[vi + 1] + c[1];
          const pz = arr[vi + 2] + c[2];
          if (px < minX) minX = px; if (px > maxX) maxX = px;
          if (py < minY) minY = py; if (py > maxY) maxY = py;
          if (pz < minZ) minZ = pz; if (pz > maxZ) maxZ = pz;
        }
      }
      if (Number.isFinite(minX)) {
        const halfX = (maxX - minX) / 2;
        const halfY = (maxY - minY) / 2;
        const halfZ = (maxZ - minZ) / 2;
        nodeRadius = Math.sqrt(halfX * halfX + halfY * halfY + halfZ * halfZ);
      }
    }
    nodeRadii.push(nodeRadius);
  }
  const n = centers.length || 1;
  const cx = sumX / n, cy = sumY / n, cz = sumZ / n;
  let maxR = 0;
  for (let ci = 0; ci < centers.length; ci++) {
    const c = centers[ci];
    const dx = c[0] - cx, dy = c[1] - cy, dz = c[2] - cz;
    // Distance du centre du chunk au centre du node + rayon du mesh du node
    const r = Math.sqrt(dx * dx + dy * dy + dz * dz) + nodeRadii[ci];
    if (r > maxR) maxR = r;
  }
  return {
    id: i,
    file: chunkFilename(i),
    center: [+cx.toFixed(2), +cy.toFixed(2), +cz.toFixed(2)],
    radius: +maxR.toFixed(2),
    estimatedMB: +(chunkSizes[i] || 0).toFixed(1),
    nodeCount: centers.length,
    vertexCount: bucket.cost,
  };
});

const metaPath = join(outputDir, "chunk-metadata.json");
writeFileSync(metaPath, JSON.stringify({ spatial: SPATIAL, chunks: chunkMeta }, null, 2));
console.log(`[puzzle] Metadata → ${metaPath}`);

console.log(`[puzzle] Done in ${((Date.now() - t0) / 1000).toFixed(1)}s.`);
