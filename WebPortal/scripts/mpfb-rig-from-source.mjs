// ══════════════════════════════════════════════════════════════════════════════
// scripts/mpfb-rig-from-source.mjs — Rigge le corps avec les DONNÉES D'AUTEUR.
//
//   node scripts/mpfb-rig-from-source.mjs [--rig game_engine] [--verify]
//
// REMPLACE `mpfb-skin-base.mjs`, qui empruntait un squelette figé à
// `_parts/mpfb/torso.glb` et transférait les poids au plus proche voisin. Les
// deux approximations sont inutiles : MPFB livre le squelette ET les poids.
//
// ── CE QUE FAIT L'ADDON, ET QU'ON REPRODUIT ICI ──────────────────────────────
//
//   morph targets  → déplacent TOUS les sommets canoniques, helpers compris
//   joint cubes    → centroïde de 8 sommets = position de l'os
//   weights.*.json → table fixe sur indices canoniques
//
// Un os n'est donc pas une donnée mais une FONCTION du maillage. Comme les
// morphs déplacent aussi les sommets des cubes, le squelette suit la
// morphologie sans code correctif. Ce script calcule la pose de BIND (maillage
// neutre) ; le runtime refera le même calcul après chaque passe de morphs.
//
// ── LE RIG CIBLE EST `game_engine`, PAS `mixamo` — MESURÉ ────────────────────
//
// `scripts/audit-anim-bones.mjs` sur les 668 GLB d'animation du projet :
// 186 os animés, noms UNREAL sans préfixe (`pelvis`, `spine_01`, `upperarm_l`…).
//   rig.game_engine  → 52 de ses 53 os communs
//   rig.mixamo       → 0 os commun
// Riguer en Mixamo aurait produit un corps INANIMABLE par toute la
// bibliothèque, sans lever la moindre erreur : three lie les pistes aux nœuds
// par leur NOM, un nom absent est ignoré en silence.
//
// ── DEUX REPÈRES, NE PAS LES CONFONDRE ───────────────────────────────────────
//
//   base.obj        Y-up, DÉCIMÈTRES   (emprise mesurée : hauteur 16,95)
//   rig.*.json      Z-up, MÈTRES       (Blender ; `head` à z ≈ 1,53)
//
// On calcule les positions d'os depuis NOTRE maillage (donc Y-up décimètres,
// ×0,1 → mètres) et on se sert de `default_position` comme CONTRÔLE après
// conversion Z-up→Y-up : (x, y, z)blender → (x, z, −y)glTF. Prendre le JSON
// comme source aurait figé le squelette sur la morphologie neutre — exactement
// le défaut qu'on corrige.
//
// ⚠ N'importe QUE `@gltf-transform/core` : `@gltf-transform/functions` tire
// `sharp`, dont le binaire natif est cassé sur cette machine.
// ══════════════════════════════════════════════════════════════════════════════

import { NodeIO, Document } from "@gltf-transform/core";
import fs from "node:fs";
import path from "node:path";

const MPFB = "C:/Users/aniss/OneDrive/Bureau/Nouveau dossier/mpfb2-master/src/mpfb/data";
const BASE = "public/models/personnages/_body/base.glb";
const DEST = "public/models/personnages/_body/base_skinned.glb";

/** Décimètres MakeHuman → mètres. Valeur SOURCÉE : `scale_factor` du rig. */
const SCALE = 0.1;

/** Influences par sommet — plafond glTF sans extension. */
const MAX_INFLUENCES = 4;

const arg = (nom, defaut) => {
  const i = process.argv.indexOf(`--${nom}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : defaut;
};

// ── Lecture des sources MPFB ────────────────────────────────────────────────

/** Groupes de sommets : `nom → [[début, fin], …]` (bornes INCLUSES). */
function lireGroupes() {
  const brut = JSON.parse(
    fs.readFileSync(path.join(MPFB, "mesh_metadata/basemesh_vertex_groups.json"), "utf8"),
  );
  const parNom = new Map();
  for (const [nom, plages] of Object.entries(brut)) {
    const indices = [];
    for (const [a, b] of plages) for (let v = a; v <= b; v++) indices.push(v);
    parNom.set(nom, indices);
  }
  return parNom;
}

/**
 * Position d'une extrémité d'os, calculée depuis le maillage.
 *
 * `CUBE` (92 cas sur 104) : centroïde des 8 sommets du cube nommé. Le JSON ne
 * donne PAS les indices dans ce cas — il faut résoudre `cube_name` via les
 * groupes de sommets.
 * `MEAN` (12 cas) : moyenne des `vertex_indices` fournis.
 */
function indicesExtremite(bout, groupes, ou) {
  const indices = bout.strategy === "CUBE" ? groupes.get(bout.cube_name) : bout.vertex_indices;
  if (!indices?.length) {
    throw new Error(
      `${ou} : stratégie ${bout.strategy} sans sommets` +
      (bout.cube_name ? ` (cube « ${bout.cube_name} » introuvable)` : ""),
    );
  }
  return indices;
}

function positionExtremite(bout, positions, groupes, ou) {
  const indices = bout.strategy === "CUBE"
    ? groupes.get(bout.cube_name)
    : bout.vertex_indices;

  if (!indices?.length) {
    throw new Error(
      `${ou} : stratégie ${bout.strategy} sans sommets` +
      (bout.cube_name ? ` (cube « ${bout.cube_name} » introuvable)` : ""),
    );
  }

  let x = 0, y = 0, z = 0;
  for (const v of indices) {
    x += positions[v * 3]; y += positions[v * 3 + 1]; z += positions[v * 3 + 2];
  }
  const n = indices.length;
  return [(x / n) * SCALE, (y / n) * SCALE, (z / n) * SCALE];
}

/**
 * Poids par sommet, depuis la table d'auteur.
 *
 * Le fichier est indexé PAR OS (`os → [[sommet, poids], …]`). Le glTF veut
 * l'inverse. On retourne la table, on garde les 4 influences les plus fortes et
 * on renormalise — glTF exige une somme de 1, et une somme qui dérive fait
 * gonfler ou rétrécir le sommet à chaque pose.
 */
function lirePoids(fichier, nbSommets, indexOs) {
  const table = JSON.parse(fs.readFileSync(fichier, "utf8")).weights;
  const parSommet = Array.from({ length: nbSommets }, () => []);
  let ignores = 0;

  for (const [os, entrees] of Object.entries(table)) {
    const io = indexOs.get(os);
    if (io === undefined) { ignores++; continue; }
    for (const [sommet, poids] of entrees) {
      if (poids > 0 && sommet < nbSommets) parSommet[sommet].push([io, poids]);
    }
  }
  if (ignores) console.warn(`[rig] ${ignores} os pondéré(s) absent(s) du rig — ignoré(s)`);
  return parSommet;
}

// ── Programme ───────────────────────────────────────────────────────────────

async function main() {
  const nomRig = arg("rig", "game_engine");
  const fRig = path.join(MPFB, `rigs/standard/rig.${nomRig}.json`);
  const fPoids = path.join(MPFB, `rigs/standard/weights.${nomRig}.json`);
  for (const f of [fRig, fPoids, BASE]) {
    if (!fs.existsSync(f)) { console.error(`[rig] introuvable : ${f}`); process.exit(1); }
  }

  const rig = JSON.parse(fs.readFileSync(fRig, "utf8"));
  const osDef = rig.bones ?? rig;
  const groupes = lireGroupes();
  console.info(`[rig] ${nomRig} — ${Object.keys(osDef).length} os · scale_factor ${rig.scale_factor}`);

  // ── Maillage canonique, depuis base.obj (ordre fichier INTACT) ────────────
  // On relit l'OBJ plutôt que le GLB : le GLB ne porte que les 14 677 sommets
  // de RENDU, alors que les joint cubes et les poids indexent les 19 158
  // sommets CANONIQUES. C'est tout l'objet de l'espace canonique.
  const canon = lireCanonique(path.join(MPFB, "3dobjs/base.obj"));
  console.info(`[rig] maillage canonique : ${canon.length / 3} sommets`);

  // ── Squelette : positions calculées, hiérarchie déclarée ─────────────────
  const noms = Object.keys(osDef);
  const indexOs = new Map(noms.map((n, i) => [n, i]));
  const os = noms.map((nom) => {
    const d = osDef[nom];
    return {
      nom,
      parent: d.parent || null,
      tete: positionExtremite(d.head, canon, groupes, `${nom}.head`),
      queue: positionExtremite(d.tail, canon, groupes, `${nom}.tail`),
      // Indices canoniques du cube — la RECETTE de la position, pas la position.
      // C'est ce que le runtime rejouera après chaque passe de morphs.
      cubeTete: indicesExtremite(d.head, groupes, `${nom}.head`),
      controle: d.head.default_position ?? null,
    };
  });

  verifierContreSource(os);



  // ── Poids d'auteur → 4 influences triées et renormalisées ────────────────
  const parSommet = lirePoids(fPoids, canon.length / 3, indexOs);
  const sansPoids = parSommet.filter((e, i) => e.length === 0 && i < canon.length / 3).length;
  console.info(
    `[rig] poids : ${parSommet.reduce((a, e) => a + e.length, 0)} entrées · ` +
    `${sansPoids} sommet(s) canonique(s) sans influence`,
  );

  await ecrireGlb(os, parSommet, indexOs, nomRig);
}

/** Positions de `base.obj`, ordre fichier, sans déduplication. */
function lireCanonique(src) {
  const out = [];
  for (const ligne of fs.readFileSync(src, "utf8").split("\n")) {
    if (!ligne.startsWith("v ")) continue;
    const p = ligne.split(/\s+/);
    out.push(+p[1], +p[2], +p[3]);
  }
  return new Float32Array(out);
}

/**
 * Confronte les positions calculées à `default_position` du JSON.
 *
 * Le JSON est en Z-up mètres (Blender), notre maillage en Y-up décimètres :
 * (x, y, z)blender → (x, z, −y)glTF. Un écart important signale une erreur de
 * repère ou de résolution de cube — pas un défaut du maillage.
 */
function verifierContreSource(os) {
  const ecarts = [];
  for (const b of os) {
    if (!b.controle) continue;
    const [cx, cy, cz] = b.controle;
    ecarts.push({
      nom: b.nom,
      d: [b.tete[0] - cx, b.tete[1] - cz, b.tete[2] + cy],   // Z-up → Y-up
    });
  }
  if (!ecarts.length) { console.warn("[rig] aucun default_position — contrôle impossible"); return; }

  // UN DÉCALAGE CONSTANT N'EST PAS UNE ERREUR DE REPÈRE.
  // `base.obj` est CENTRÉ sur l'origine (pieds à −0,817 m) alors que le rig
  // MPFB est exprimé pieds au sol. Comparer les distances brutes fait crier
  // l'audit sur un squelette parfaitement juste. Ce qui compte est le RÉSIDU
  // une fois ce décalage retiré : lui seul révèle une rotation manquée ou un
  // cube mal résolu.
  const median = (v) => { const s = [...v].sort((a, b) => a - b); return s[s.length >> 1]; };
  const offset = [0, 1, 2].map((k) => median(ecarts.map((e) => e.d[k])));

  let max = 0, pire = "";
  for (const e of ecarts) {
    const r = Math.hypot(e.d[0] - offset[0], e.d[1] - offset[1], e.d[2] - offset[2]);
    if (r > max) { max = r; pire = e.nom; }
  }

  console.info(
    `[rig] contrôle vs default_position — décalage constant ` +
    `[${offset.map((v) => v.toFixed(3)).join(", ")}] m · ` +
    `résidu max ${(max * 1000).toFixed(1)} mm (${pire})`,
  );
  if (max > 0.02) {
    console.warn("[rig] ⚠ résidu > 2 cm — repère ou résolution de cube à vérifier");
  }
}

async function ecrireGlb(os, parSommet, indexOs, nomRig) {
  const io = new NodeIO();
  const baseDoc = await io.read(BASE);
  const basePrims = baseDoc.getRoot().listMeshes()[0].listPrimitives();

  // ── PIEDS AU SOL — LA NORME DE TOUT LE PROJET ─────────────────────────────
  //
  // `base.obj` est CENTRÉ sur l'origine : ses pieds sont à −0,82 m. Manny, les
  // pièces Biker, les coiffures — tous les autres packs ont les pieds à y = 0.
  //
  // Tant que notre corps faisait exception, `groundAlign` le remontait au
  // runtime et ça suffisait POUR LUI. Mais toute pièce liée à son squelette
  // hérite de l'écart : la première coiffure posée est apparue 0,82 m plus bas,
  // à hauteur de chevilles. Décaler la coiffure aurait traité le symptôme ;
  // c'est la pose de bind du corps qui doit rentrer dans la norme.
  //
  // On mesure sur le maillage RENDU, pas sur le canonique : ce dernier contient
  // des helpers MakeHuman sous les pieds qui fausseraient le plancher.
  //
  // Sommets ET os sont remontés du MÊME vecteur — le skinning reste donc
  // rigoureusement identique, seule l'origine change.
  let bas = Infinity;
  for (const prim of basePrims) {
    const p = prim.getAttribute("POSITION").getArray();
    for (let i = 1; i < p.length; i += 3) if (p[i] < bas) bas = p[i];
  }
  const decalage = -bas * SCALE;
  for (const b of os) { b.tete[1] += decalage; b.queue[1] += decalage; }
  console.info(`[rig] pieds ramenés au sol : +${(decalage * 1000).toFixed(0)} mm sur Y`);

  const doc = new Document();
  const buf = doc.createBuffer();
  const acc = (nom, arr, type) =>
    doc.createAccessor(nom).setArray(arr).setType(type).setBuffer(buf);

  // ── Hiérarchie d'os ───────────────────────────────────────────────────────
  // Translation LOCALE = position monde moins celle du parent. glTF compose les
  // transforms ; écrire la position monde sur chaque os cumulerait les parents.
  const noeuds = os.map((b) => doc.createNode(b.nom));
  os.forEach((b, i) => {
    const parent = b.parent ? os.find((o) => o.nom === b.parent) : null;
    const p = parent ? parent.tete : [0, 0, 0];
    noeuds[i].setTranslation([b.tete[0] - p[0], b.tete[1] - p[1], b.tete[2] - p[2]]);
  });
  os.forEach((b, i) => {
    if (b.parent) noeuds[indexOs.get(b.parent)].addChild(noeuds[i]);
  });

  // Matrices de bind inverses : l'inverse de la pose monde. Les os n'ayant
  // aucune rotation ici, c'est une simple translation négative.
  const ibm = new Float32Array(os.length * 16);
  os.forEach((b, i) => {
    const m = [1,0,0,0, 0,1,0,0, 0,0,1,0, -b.tete[0], -b.tete[1], -b.tete[2], 1];
    ibm.set(m, i * 16);
  });

  const skin = doc.createSkin("mpfb")
    .setInverseBindMatrices(acc("ibm", ibm, "MAT4"));
  for (const n of noeuds) skin.addJoint(n);
  const racineOs = os.findIndex((b) => !b.parent);
  if (racineOs >= 0) skin.setSkeleton(noeuds[racineOs]);

  // ── Surfaces : géométrie de rendu + poids remontés via _MORPH_INDEX ──────
  const mesh = doc.createMesh("mh_body");
  let total = 0;

  for (const prim of basePrims) {
    const nom = prim.getMaterial()?.getName() ?? "surface";
    const pos = prim.getAttribute("POSITION").getArray();
    const uv = prim.getAttribute("TEXCOORD_0")?.getArray();
    const morph = prim.getAttribute("_MORPH_INDEX").getArray();
    const idx = prim.getIndices().getArray();
    const n = pos.length / 3;

    const outPos = new Float32Array(n * 3);
    const outJ = new Uint16Array(n * 4);
    const outW = new Float32Array(n * 4);
    let orphelins = 0;

    for (let v = 0; v < n; v++) {
      outPos[v * 3] = pos[v * 3] * SCALE;
      outPos[v * 3 + 1] = pos[v * 3 + 1] * SCALE + decalage;
      outPos[v * 3 + 2] = pos[v * 3 + 2] * SCALE;

      // Le sommet de RENDU emprunte les poids de son sommet CANONIQUE : c'est
      // exactement ce que `_MORPH_INDEX` sert à faire. Les doublons de couture
      // UV reçoivent donc des poids identiques et restent cousus.
      const infl = parSommet[morph[v]] ?? [];
      if (infl.length === 0) { orphelins++; outJ[v * 4] = 0; outW[v * 4] = 1; continue; }

      const quatre = [...infl].sort((a, b) => b[1] - a[1]).slice(0, MAX_INFLUENCES);
      let somme = 0;
      for (const [, w] of quatre) somme += w;
      quatre.forEach(([io2, w], k) => {
        outJ[v * 4 + k] = io2;
        outW[v * 4 + k] = somme > 0 ? w / somme : 0;
      });
      if (somme <= 0) { outJ[v * 4] = 0; outW[v * 4] = 1; }
    }

    console.info(`[rig] ${nom.padEnd(6)} : ${String(n).padStart(6)} sommets · ${orphelins} sans influence`);
    total += n;

    const p = doc.createPrimitive()
      .setAttribute("POSITION", acc(`POSITION_${nom}`, outPos, "VEC3"))
      .setAttribute("JOINTS_0", acc(`JOINTS_0_${nom}`, outJ, "VEC4"))
      .setAttribute("WEIGHTS_0", acc(`WEIGHTS_0_${nom}`, outW, "VEC4"))
      .setAttribute("_MORPH_INDEX", acc(`_MORPH_INDEX_${nom}`, Uint32Array.from(morph), "SCALAR"))
      .setIndices(acc(`indices_${nom}`, Uint32Array.from(idx), "SCALAR"))
      .setMaterial(
        doc.createMaterial(nom)
          .setRoughnessFactor(prim.getMaterial()?.getRoughnessFactor() ?? 0.8)
          .setMetallicFactor(0),
      );
    if (uv) p.setAttribute("TEXCOORD_0", acc(`TEXCOORD_0_${nom}`, Float32Array.from(uv), "VEC2"));
    mesh.addPrimitive(p);
  }

  const noeudMesh = doc.createNode("mh_body").setMesh(mesh).setSkin(skin);
  const scene = doc.createScene("BaseBody").addChild(noeudMesh);
  if (racineOs >= 0) scene.addChild(noeuds[racineOs]);

  doc.getRoot().setExtras({
    canonicalVertexCount: baseDoc.getRoot().getExtras()?.canonicalVertexCount ?? null,
    units: "meters",
    morphUnitScale: SCALE,
    rig: nomRig,
    groundOffset: decalage,
    surfaces: mesh.listPrimitives().map((p) => p.getMaterial()?.getName() ?? "?"),
    generator: "mpfb-rig-from-source",
  });

  fs.mkdirSync(path.dirname(DEST), { recursive: true });
  // ── RECETTE DES OS POUR LE RUNTIME ────────────────────────────────────────
  //
  // Le squelette écrit ici n'est que la pose de BIND, calculée sur le maillage
  // NEUTRE. Dès qu'un morph déplace les sommets, les joint cubes bougent — et
  // les os devraient bouger avec. Sans ça, la peau se déforme autour d'un
  // squelette figé : un crâne rétréci garde son os `head` au même endroit, et
  // toute pièce qui s'y accroche (coiffure) flotte.
  //
  // On exporte donc la RECETTE — quels sommets canoniques forment chaque cube —
  // et non le résultat. Le runtime refait le même centroïde après chaque passe.
  const recette = {
    scale: SCALE,
    groundOffset: decalage,
    canonicalVertexCount: null,
    // `neutre` est INDISPENSABLE : les joint cubes sont des HELPERS, absents du
    // maillage de rendu. Le tableau canonique du runtime vaut donc ZÉRO à leurs
    // indices (cf. `gatherFromRender`) — il n'y porte pas une position mais un
    // DÉPLACEMENT. Sans la position neutre à laquelle l'ajouter, tous les os
    // s'effondrent à l'origine et le corps est écrasé.
    bones: os.map((b) => ({
      nom: b.nom, parent: b.parent, cube: b.cubeTete,
      neutre: [b.tete[0], b.tete[1], b.tete[2]],
    })),
  };
  recette.canonicalVertexCount = baseDoc.getRoot().getExtras()?.canonicalVertexCount ?? null;
  const fRecette = path.join(path.dirname(DEST), "joint-cubes.json");
  fs.writeFileSync(fRecette, JSON.stringify(recette));
  console.info(
    `[rig] ✓ ${fRecette} — ${recette.bones.length} os, ` +
    `${(fs.statSync(fRecette).size / 1024).toFixed(0)} Ko`,
  );

  await io.write(DEST, doc);
  console.info(
    `[rig] ✓ ${DEST} (${(fs.statSync(DEST).size / 1024).toFixed(0)} Ko) — ` +
    `${mesh.listPrimitives().length} surface(s), ${total} sommets, ${os.length} os (${nomRig})`,
  );
}

main().catch((e) => { console.error(e); process.exit(1); });
