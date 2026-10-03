// ══════════════════════════════════════════════════════════════════════════════
// scripts/mpfb-to-manny.mjs — Complète le corps MPFB au squelette Manny 89 os.
//
//   node scripts/mpfb-to-manny.mjs [--dry-run]
//
// Port en Node de l'étape 3 d'UniGLB (« inject + prune »), qui n'existe que
// comme plugin Unreal. Ici on n'a QUE l'injection à faire : notre corps ne porte
// aucun os étranger à élaguer.
//
// ── POURQUOI ─────────────────────────────────────────────────────────────────
// Mesuré : 34 des 103 packs du projet portent 100 % de Manny. `mpfb` est à
// 58 % — le moins complet de la bibliothèque. Tant qu'il l'est, les têtes et
// cheveux Biker ne peuvent pas se lier au corps morphable : trop d'os manquent.
//
// ── CE QU'ON INJECTE, ET POURQUOI ÇA NE DÉFORME RIEN ─────────────────────────
// Les 36 os manquants sont STRUCTURELS, pas déformants :
//   colonne  3   spine_04, spine_05, neck_02
//   twist   16   upperarm/lowerarm/thigh/calf × 01|02 × gauche|droite
//   main     8   métacarpiens index/middle/ring/pinky
//   IK       7   ik_foot_*, ik_hand_* — jamais skinnés
//   virtuel  2   interaction, center_of_mass
//
// Chacun a un parent DÉJÀ présent (hors sa propre famille, réglé par l'ordre).
// On les pose à translation LOCALE NULLE, donc exactement sur leur parent, et
// AUCUN sommet ne leur est attribué. Conséquence : un os à poids nul suit son
// parent, et une animation qui le pilote ne déforme rien. Le corps reste au
// sommet près ce qu'il est aujourd'hui — seule la STRUCTURE change.
//
// ⚠ LIMITE ASSUMÉE. Les twists ne produiront donc pas de vrai twist : personne
// n'y est pondéré. C'est une complétion structurelle, pas une amélioration de
// déformation. Redistribuer les poids de `lowerarm_l` vers ses twists est une
// étape SÉPARÉE, qui elle changerait la silhouette et doit être jugée à l'œil.
//
// ⚠ ON AJOUTE EN FIN DE LISTE, jamais au milieu. Les indices `JOINTS_0` déjà
// écrits dans les primitives restent donc valides — réordonner obligerait à
// réécrire tous les poids, pour aucun gain.
//
// ⚠ N'importe QUE `@gltf-transform/core` : `@gltf-transform/functions` tire
// `sharp`, binaire natif cassé sur cette machine.
// ══════════════════════════════════════════════════════════════════════════════

import { NodeIO } from "@gltf-transform/core";
import fs from "node:fs";

const CORPS = "public/models/personnages/_body/base_skinned.glb";
const MANNY = "public/models/personnages/ThirdPerson/Characters/Mannequins/Meshes/SKM_Manny_Simple.glb";
const DRY = process.argv.includes("--dry-run");

/** Notre racine s'appelle `Root` (MPFB), celle de Manny `root`. */
const RACINE_MPFB = "Root";
const RACINE_MANNY = "root";

/** Lit l'en-tête JSON d'un GLB sans toucher au binaire. */
function enTete(fichier) {
  const b = fs.readFileSync(fichier);
  return JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString("utf8"));
}

/** Hiérarchie et transforms locales des joints de Manny. */
function squeletteManny() {
  const j = enTete(MANNY);
  const parentDe = new Map();
  j.nodes.forEach((n, i) => (n.children ?? []).forEach((c) => parentDe.set(c, i)));

  const joints = j.skins?.[0]?.joints ?? [];
  const ordre = [];
  for (const i of joints) {
    const n = j.nodes[i];
    ordre.push({
      nom: n.name,
      parent: j.nodes[parentDe.get(i)]?.name ?? null,
      translation: n.translation ?? [0, 0, 0],
      rotation: n.rotation ?? [0, 0, 0, 1],
    });
  }
  return ordre;
}

async function main() {
  const io = new NodeIO();
  const doc = await io.read(CORPS);
  const skin = doc.getRoot().listSkins()[0];
  if (!skin) { console.error("[manny] le corps n'a pas de skin"); process.exit(1); }

  const presents = new Map(skin.listJoints().map((n) => [n.getName(), n]));

  // ── Renommage de la racine ────────────────────────────────────────────────
  // Un seul caractère de casse, et zéro animation ne s'applique : three lie les
  // pistes aux nœuds PAR LEUR NOM. `Root` ≠ `root`.
  const racine = presents.get(RACINE_MPFB);
  if (racine) {
    racine.setName(RACINE_MANNY);
    presents.delete(RACINE_MPFB);
    presents.set(RACINE_MANNY, racine);
    console.info(`[manny] racine « ${RACINE_MPFB} » → « ${RACINE_MANNY} »`);
  }

  const manny = squeletteManny();
  const manquants = manny.filter((b) => !presents.has(b.nom));
  console.info(`[manny] ${presents.size} os présents · ${manny.length} attendus · ${manquants.length} à injecter`);

  // Un os étranger à Manny fausserait la compatibilité annoncée.
  const attendus = new Set(manny.map((b) => b.nom));
  const etrangers = [...presents.keys()].filter((n) => !attendus.has(n));
  if (etrangers.length) console.warn(`[manny] ⚠ ${etrangers.length} os hors Manny : ${etrangers.join(", ")}`);

  if (DRY) {
    for (const b of manquants) console.info(`   + ${b.nom.padEnd(24)} ⊂ ${b.parent}`);
    console.info("[manny] dry-run — rien écrit.");
    return;
  }

  // ── Injection ─────────────────────────────────────────────────────────────
  // Dans l'ordre de Manny : un os dont le parent est lui-même manquant
  // (spine_05 ⊂ spine_04, ik_hand_l ⊂ ik_hand_gun) trouve son parent déjà créé.
  const ibmAvant = skin.getInverseBindMatrices()?.getArray();
  const nouveaux = [];

  for (const b of manquants) {
    const n = doc.createNode(b.nom).setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]);
    presents.set(b.nom, n);
    nouveaux.push(n);
  }
  for (const b of manquants) {
    const parent = presents.get(b.parent);
    if (parent) parent.addChild(presents.get(b.nom));
    else console.warn(`[manny] ⚠ « ${b.nom} » : parent « ${b.parent}` + `» introuvable, laissé détaché`);
  }

  // ── Matrices de bind inverses ─────────────────────────────────────────────
  // Translation locale nulle ⇒ l'os est exactement sur son parent ⇒ sa matrice
  // de bind inverse est celle du parent. On la RECOPIE plutôt que de poser
  // l'identité : l'identité placerait l'os à l'origine du monde, et tout sommet
  // qu'on lui attribuerait un jour s'effondrerait aux pieds du personnage.
  const n0 = ibmAvant.length / 16;
  const ibm = new Float32Array((n0 + nouveaux.length) * 16);
  ibm.set(ibmAvant, 0);

  const indexDe = new Map(skin.listJoints().map((n, i) => [n.getName(), i]));
  manquants.forEach((b, k) => {
    let src = b.parent;
    // Remonter jusqu'à un ancêtre DÉJÀ pondéré : le parent peut lui-même faire
    // partie des nouveaux (spine_05 → spine_04 → spine_03).
    while (src && !indexDe.has(src)) src = manny.find((x) => x.nom === src)?.parent ?? null;
    const i = src ? indexDe.get(src) : 0;
    ibm.set(ibmAvant.subarray(i * 16, i * 16 + 16), (n0 + k) * 16);
  });

  const buf = doc.getRoot().listBuffers()[0];
  skin.setInverseBindMatrices(
    doc.createAccessor("ibm_manny").setArray(ibm).setType("MAT4").setBuffer(buf),
  );
  // AJOUT en fin de liste : les indices JOINTS_0 déjà écrits restent valides.
  for (const n of nouveaux) skin.addJoint(n);

  const extras = doc.getRoot().getExtras() ?? {};
  doc.getRoot().setExtras({ ...extras, rig: "manny89", rigSource: extras.rig ?? "game_engine" });

  await io.write(CORPS, doc);
  console.info(
    `[manny] ✓ ${CORPS} — ${skin.listJoints().length} os ` +
    `(+${nouveaux.length}), poids INCHANGÉS`,
  );
}

main().catch((e) => { console.error(e); process.exit(1); });
