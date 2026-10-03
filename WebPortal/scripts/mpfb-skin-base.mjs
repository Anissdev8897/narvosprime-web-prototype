// ══════════════════════════════════════════════════════════════════════════════
// scripts/mpfb-skin-base.mjs — Rigge le corps MakeHuman sur le squelette du jeu.
//
//   node scripts/mpfb-skin-base.mjs
//
// LE PROBLÈME
// `base.glb` porte la géométrie morphable, mais aucun squelette : le mannequin
// se déforme et ne s'anime pas. Or tout NARVOS tourne sur un rig Mixamo à
// 52 os (les clips le confirment : `tracks=52` dans chaque log d'animation).
//
// LA MESURE QUI DÉCIDE DE LA MÉTHODE
// Les six pièces de `_parts/mpfb/` sont déjà riggées sur ce Mixamo 52 os. En
// comparant leurs sommets à ceux de `base.glb` mis à l'échelle 0,1 :
//
//   distance au plus proche sommet — médiane 1,3 mm · maximum 1,9 mm
//   sommets au-delà d'1 cm : 0 sur 14 517
//
// Autrement dit ce sont les MÊMES sommets, simplement redécoupés en six
// morceaux et renumérotés. Un transfert de poids par plus proche voisin est
// donc quasi exact — pas une approximation à surveiller.
//
// LA MÉTHODE : PARTIR D'UN FICHIER QUI A DÉJÀ LE SQUELETTE
// On ouvre `torso.glb`, on lui RETIRE sa géométrie et on lui greffe la nôtre.
// Reconstruire une hiérarchie de 52 os et ses matrices de bind à la main
// offrirait autant d'occasions de se tromper, pour aucun gain.
//
// ⚠ ESPACE DES POSITIONS. Le glTF précise que la transform du nœud portant un
// mesh SKINNÉ est ignorée : seules comptent les matrices de bind inverses et la
// pose des os. On écrit donc les positions en espace MONDE, à l'échelle des
// pièces (mètres), et non dans l'espace local d'un nœud.
//
// ⚠ UNITÉS. `base.glb` est en décimètres MakeHuman, le squelette en mètres. La
// sortie est donc en MÈTRES. Les deltas de morphs, eux, restent en décimètres :
// le runtime doit les multiplier par `MAKEHUMAN_TO_METERS` (cf. le paramètre
// `unitScale` de `applyMorphs`).
// ══════════════════════════════════════════════════════════════════════════════

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import draco3d from "draco3dgltf";
import fs from "node:fs";
import path from "node:path";

const BASE = "public/models/personnages/_body/base.glb";
const PARTS = "public/models/personnages/_parts/mpfb";
const DEST = "public/models/personnages/_body/base_skinned.glb";

/** Pièce dont on emprunte le squelette. N'importe laquelle ferait l'affaire. */
const DONNEUR = "torso";

/** Pièces qui alimentent le nuage de poids. Toutes, pour couvrir tout le corps. */
const SOURCES = ["torso", "legs", "arms", "hands", "feet", "head"];

/** Décimètres MakeHuman → mètres. Cf. l'emprise mesurée dans `mpfb-base-to-glb`. */
const SCALE = 0.1;

/** Côté d'une cellule de la grille spatiale, en mètres. */
const CELL = 0.05;

async function ouvrir() {
  return new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "draco3d.decoder": await draco3d.createDecoderModule() });
}

/**
 * Nuage de sommets pondérés, en espace monde, avec les os DÉSIGNÉS PAR NOM.
 *
 * Par nom et non par indice : chaque fichier numérote ses articulations dans
 * son propre ordre. Copier les indices bruts d'une pièce à l'autre attacherait
 * les sommets aux mauvais os — et le corps se tordrait à la première animation,
 * sans qu'aucune erreur ne soit levée.
 */
function collecterNuage(io, fichiers) {
  const pts = [];      // [x, y, z]
  const infl = [];     // [[nomOs, poids] × 4]

  for (const f of fichiers) {
    const doc = f.doc;
    for (const node of doc.getRoot().listNodes()) {
      const mesh = node.getMesh();
      const skin = node.getSkin();
      if (!mesh || !skin) continue;

      const os = skin.listJoints().map((j) => j.getName());
      const s = node.getWorldScale();
      const t = node.getWorldTranslation();

      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute("POSITION");
        const joints = prim.getAttribute("JOINTS_0");
        const poids = prim.getAttribute("WEIGHTS_0");
        if (!pos || !joints || !poids) continue;

        const P = pos.getArray(), J = joints.getArray(), W = poids.getArray();
        for (let i = 0; i < pos.getCount(); i++) {
          pts.push(P[i * 3] * s[0] + t[0], P[i * 3 + 1] * s[1] + t[1], P[i * 3 + 2] * s[2] + t[2]);
          const quatre = [];
          for (let k = 0; k < 4; k++) {
            const w = W[i * 4 + k];
            if (w > 0) quatre.push([os[J[i * 4 + k]], w]);
          }
          infl.push(quatre);
        }
      }
    }
  }
  return { pts, infl };
}

/** Grille spatiale — 14 500 × 14 100 en force brute serait inutilement lent. */
function construireGrille(pts) {
  const grid = new Map();
  const n = pts.length / 3;
  for (let i = 0; i < n; i++) {
    const k = `${Math.floor(pts[i * 3] / CELL)},${Math.floor(pts[i * 3 + 1] / CELL)},${Math.floor(pts[i * 3 + 2] / CELL)}`;
    const b = grid.get(k);
    if (b) b.push(i); else grid.set(k, [i]);
  }
  return grid;
}

function plusProche(grid, pts, x, y, z) {
  const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL), cz = Math.floor(z / CELL);
  let best = -1, bestD = Infinity;
  // Rayon croissant : on s'arrête au premier anneau qui donne un candidat, puis
  // on en explore un de plus — le plus proche peut se trouver dans la cellule
  // voisine même quand la cellule courante n'est pas vide.
  for (let r = 1; r <= 6; r++) {
    for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) for (let c = -r; c <= r; c++) {
      const bucket = grid.get(`${cx + a},${cy + b},${cz + c}`);
      if (!bucket) continue;
      for (const i of bucket) {
        const d = (pts[i * 3] - x) ** 2 + (pts[i * 3 + 1] - y) ** 2 + (pts[i * 3 + 2] - z) ** 2;
        if (d < bestD) { bestD = d; best = i; }
      }
    }
    if (best >= 0 && r >= 2) break;
  }
  return { i: best, d: Math.sqrt(bestD) };
}

async function main() {
  const io = await ouvrir();

  if (!fs.existsSync(BASE)) {
    console.error(`[skin] ${BASE} absent — lance d'abord mpfb-base-to-glb.mjs`);
    process.exit(1);
  }

  // ── Nuage pondéré, depuis les six pièces ───────────────────────────────────
  const fichiers = [];
  for (const f of SOURCES) {
    const p = `${PARTS}/${f}.glb`;
    if (!fs.existsSync(p)) { console.warn(`[skin] ${p} absent — ignoré`); continue; }
    fichiers.push({ nom: f, doc: await io.read(p) });
  }
  if (fichiers.length === 0) { console.error("[skin] aucune pièce source"); process.exit(1); }

  const { pts, infl } = collecterNuage(io, fichiers);
  console.info(`[skin] nuage de référence : ${infl.length} sommets pondérés (${fichiers.length} pièces)`);

  // ── Document donneur : on garde son squelette, on remplace sa géométrie ────
  const donneur = fichiers.find((f) => f.nom === DONNEUR) ?? fichiers[0];
  const doc = donneur.doc;
  const skin = doc.getRoot().listNodes().find((n) => n.getSkin())?.getSkin();
  if (!skin) { console.error("[skin] le donneur n'a pas de skin"); process.exit(1); }

  const osCible = skin.listJoints().map((j) => j.getName());
  const indexOs = new Map(osCible.map((n, i) => [n, i]));
  console.info(`[skin] squelette repris de « ${donneur.nom} » : ${osCible.length} os`);

  // ── Géométrie de base, ramenée en mètres ──────────────────────────────────
  //
  // UNE PRIMITIVE PAR SURFACE, et il faut TOUTES les rigger. `base.glb` en porte
  // deux : la peau et les yeux. N'en traiter qu'une (ce que faisait ce script
  // avant l'ajout des yeux) livre un mannequin qui a l'air correct au repos et
  // laisse l'autre surface plantée à l'origine dès la première animation.
  const baseDoc = await io.read(BASE);
  const basePrims = baseDoc.getRoot().listMeshes()[0].listPrimitives();
  const attendues = baseDoc.getRoot().getExtras()?.surfaces ?? null;
  if (attendues && attendues.length !== basePrims.length) {
    console.error(
      `[skin] base.glb annonce ${attendues.length} surface(s) (${attendues.join(", ")})` +
      ` mais en porte ${basePrims.length} — régénère avec mpfb-base-to-glb.mjs`,
    );
    process.exit(1);
  }

  const grid = construireGrille(pts);
  const buf = doc.getRoot().listBuffers()[0] ?? doc.createBuffer();
  const acc = (nom, arr, type) =>
    doc.createAccessor(nom).setArray(arr).setType(type).setBuffer(buf);

  const mesh = doc.createMesh("mh_body");
  let totalSommets = 0;

  for (const [iPrim, basePrim] of basePrims.entries()) {
    // Le NOM du matériau est porteur de sens côté runtime (`skinTint.ts` filtre
    // dessus pour teinter les iris sans toucher la peau). On le reconduit tel
    // quel — un matériau générique casserait la teinte sans rien lever.
    const matSrc = basePrim.getMaterial();
    const nom = matSrc?.getName() ?? attendues?.[iPrim] ?? `surface_${iPrim}`;

    const bPos = basePrim.getAttribute("POSITION").getArray();
    const bUv = basePrim.getAttribute("TEXCOORD_0")?.getArray();
    const bMorph = basePrim.getAttribute("_MORPH_INDEX")?.getArray();
    const bIdx = basePrim.getIndices()?.getArray();
    const nb = bPos.length / 3;
    if (!bMorph) {
      console.error(`[skin] _MORPH_INDEX absent de la surface « ${nom} »`);
      process.exit(1);
    }

    // ── Transfert ────────────────────────────────────────────────────────────
    const outPos = new Float32Array(nb * 3);
    const outJ = new Uint16Array(nb * 4);
    const outW = new Float32Array(nb * 4);
    let maxD = 0, orphelins = 0;

    for (let v = 0; v < nb; v++) {
      const x = bPos[v * 3] * SCALE, y = bPos[v * 3 + 1] * SCALE, z = bPos[v * 3 + 2] * SCALE;
      outPos[v * 3] = x; outPos[v * 3 + 1] = y; outPos[v * 3 + 2] = z;

      const { i, d } = plusProche(grid, pts, x, y, z);
      if (i < 0) {
        // Aucune influence trouvée : on rattache au premier os plutôt que de
        // laisser des poids nuls, qui feraient s'effondrer le sommet à l'origine.
        orphelins++;
        outJ[v * 4] = 0; outW[v * 4] = 1;
        continue;
      }
      if (d > maxD) maxD = d;

      let somme = 0;
      const quatre = infl[i];
      for (let k = 0; k < 4; k++) {
        const e = quatre[k];
        if (!e) break;
        outJ[v * 4 + k] = indexOs.get(e[0]) ?? 0;
        outW[v * 4 + k] = e[1];
        somme += e[1];
      }
      // Renormalisation : glTF exige que les quatre poids totalisent 1. Une somme
      // qui dérive fait rétrécir ou gonfler le sommet à chaque pose.
      if (somme > 0) for (let k = 0; k < 4; k++) outW[v * 4 + k] /= somme;
      else { outJ[v * 4] = 0; outW[v * 4] = 1; }
    }

    // Distance rapportée PAR SURFACE, jamais globalement : la peau colle au
    // nuage à ~2 mm, alors que les yeux sont logés DANS le crâne et n'ont donc
    // aucun voisin proche — les moyenner masquerait une vraie dérive de la peau
    // derrière un chiffre d'yeux normalement élevé.
    console.info(
      `[skin] ${nom.padEnd(6)} : ${String(nb).padStart(6)} sommets ·` +
      ` distance max ${(maxD * 1000).toFixed(2)} mm · ${orphelins} orphelin(s)`,
    );
    totalSommets += nb;

    const prim = doc.createPrimitive()
      .setAttribute("POSITION", acc(`POSITION_${nom}`, outPos, "VEC3"))
      .setAttribute("JOINTS_0", acc(`JOINTS_0_${nom}`, outJ, "VEC4"))
      .setAttribute("WEIGHTS_0", acc(`WEIGHTS_0_${nom}`, outW, "VEC4"))
      .setAttribute("_MORPH_INDEX", acc(`_MORPH_INDEX_${nom}`, Uint32Array.from(bMorph), "SCALAR"))
      .setIndices(acc(`indices_${nom}`, Uint32Array.from(bIdx), "SCALAR"))
      .setMaterial(
        doc.createMaterial(nom)
          .setRoughnessFactor(matSrc?.getRoughnessFactor() ?? 0.8)
          .setMetallicFactor(matSrc?.getMetallicFactor() ?? 0),
      );
    if (bUv) prim.setAttribute(`TEXCOORD_0`, acc(`TEXCOORD_0_${nom}`, Float32Array.from(bUv), "VEC2"));

    mesh.addPrimitive(prim);
  }

  // Le nœud porteur reste à l'identité : sa transform serait de toute façon
  // ignorée pour un mesh skinné, autant ne pas laisser croire le contraire.
  //
  // ⚠ `setMesh(null)` DÉTACHE le mesh du nœud, il ne le SUPPRIME PAS du
  // document. Mesuré : le fichier sortait à 16 107 sommets au lieu de 14 517 —
  // les 1 590 du torse donneur y voyageaient encore, invisibles (aucun nœud ne
  // les référence) mais bien présents dans le binaire. Il faut les détruire
  // explicitement.
  const anciens = [];
  for (const n of doc.getRoot().listNodes()) {
    const m = n.getMesh();
    if (m) { anciens.push(m); n.setMesh(null); n.setSkin(null); }
  }
  const node = doc.createNode("mh_body").setMesh(mesh).setSkin(skin);
  doc.getRoot().listScenes()[0].addChild(node);

  // Destruction APRÈS avoir posé le nouveau mesh : `dispose()` supprime aussi
  // les accesseurs devenus orphelins, et on ne veut pas emporter les nôtres.
  for (const m of anciens) m.dispose();

  doc.getRoot().setExtras({
    canonicalVertexCount: baseDoc.getRoot().getExtras()?.canonicalVertexCount ?? null,
    units: "meters",
    morphUnitScale: SCALE,
    surfaces: mesh.listPrimitives().map((p) => p.getMaterial()?.getName() ?? "?"),
    skeleton: `${osCible.length} os (mixamo)`,
    generator: "mpfb-skin-base",
  });

  fs.mkdirSync(path.dirname(DEST), { recursive: true });
  await io.write(DEST, doc);
  console.info(
    `[skin] ✓ ${DEST} (${(fs.statSync(DEST).size / 1024).toFixed(0)} Ko) —` +
    ` ${mesh.listPrimitives().length} surface(s), ${totalSommets} sommets, ${osCible.length} os`,
  );
}

main().catch((e) => { console.error(e); process.exit(1); });
