// ══════════════════════════════════════════════════════════════════════════════
// audit-part-compat.mjs — Les pièces découpées peuvent-elles se mélanger ?
//
// Répond à UNE question, chiffres à l'appui : si on pose la tête de Wraith sur
// le corps du mannequin Biker, quelle part du maillage suit correctement, et de
// combien les proportions diffèrent-elles ?
//
// ── DEUX ERREURS DE MESURE CORRIGÉES (02/08/2026) ────────────────────────────
//
// 1. LA COUVERTURE PAR NOMS D'OS EST LE MAUVAIS CRITÈRE.
//    Compter `os communs / os de la pièce` donnait 42 à 50 % pour tous les héros
//    Paragon, donc un refus général. Or leurs os non appariés sont des twist,
//    correctifs et IK qui ne portent presque AUCUN poids de skinning. Ce qui
//    compte n'est pas combien d'os sont appariés, mais quelle FRACTION DU POIDS
//    atterrit sur un os apparié — c'est elle qui décide si le maillage se
//    déchire. D'où `weighted` ci-dessous.
//
// 2. LA TRANSLATION D'UNE MATRICE INVERSE DE BIND N'EST PAS −position.
//    Pour M = [R|t], M⁻¹ = [R⁻¹ | −R⁻¹t]. Prendre −t donne un résultat faux dès
//    qu'un os est tourné — ce qui est le cas de presque tous. On inverse donc
//    réellement la partie 3×3.
//
// Usage : node scripts/audit-part-compat.mjs [--json=<sortie>]
// ══════════════════════════════════════════════════════════════════════════════

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const OUT = process.argv.find((a) => a.startsWith("--json="))?.slice(7);

// ── LA RÉFÉRENCE DOIT ÊTRE CHOISIE, PAS SUBIE (03/08/2026) ───────────────────
//
// Elle était codée en dur sur le mannequin Biker. Conséquence mesurée : tous les
// rapports « 8 pièces refusées sur 39 » validaient le mannequin Biker, et n'ont
// JAMAIS testé le corps de base MPFB2 (52 os) qu'ils étaient censés qualifier.
// Un audit dont on ne peut pas changer la référence ne mesure qu'une chose, et
// laisse croire qu'il en mesure une autre.
const BASES = {
  biker: {
    id: "biker_male",
    label: "Mannequin Biker (H)",
    path: "public/models/personnages/BikerBundle/CharacterParts_Biker/Meshes/UE5_Mannequin_meta/Male/Bodyparts/SK_ma_UE5_meta_body.glb",
  },
  // Re-ciblé le 10/08/2026 : le corps MPFB porte désormais le rig `game_engine`
  // (53 os, noms Unreal) produit par `mpfb-rig-from-source.mjs`. Mesuré :
  // 52 de ses 53 os sont communs au mannequin Biker, contre 0 pour l'ancien
  // `SK_BaseBody_Mixamo.glb`. Auditer contre l'ancienne base rendrait un verdict
  // d'incompatibilité qui n'a plus lieu d'être.
  mpfb: {
    id: "mpfb_ue",
    label: "Corps MPFB2 (rig game_engine)",
    path: "public/models/personnages/_body/base_skinned.glb",
  },
};

const BASE_KEY = process.argv.find((a) => a.startsWith("--base="))?.slice(7) ?? "biker";
const BASE = BASES[BASE_KEY];
if (!BASE) {
  console.error(`[compat] référence inconnue : ${BASE_KEY} (attendu : ${Object.keys(BASES).join(" | ")})`);
  process.exit(1);
}

/**
 * Position de bind d'un os, depuis sa matrice inverse de bind (colonne-major).
 *
 * On inverse la 3×3 puis on applique −R⁻¹t. Renvoie `null` si la matrice est
 * dégénérée — mieux vaut une absence qu'une coordonnée inventée.
 */
function bindPosition(m, o) {
  const a = m[o], b = m[o + 1], c = m[o + 2];
  const d = m[o + 4], e = m[o + 5], f = m[o + 6];
  const g = m[o + 8], h = m[o + 9], i = m[o + 10];
  const tx = m[o + 12], ty = m[o + 13], tz = m[o + 14];

  const det = a * (e * i - f * h) - d * (b * i - c * h) + g * (b * f - c * e);
  if (!det || !Number.isFinite(det)) return null;
  const s = 1 / det;

  // Inverse de la 3×3 (comatrice transposée / déterminant).
  const i00 = (e * i - f * h) * s, i01 = (g * f - d * i) * s, i02 = (d * h - g * e) * s;
  const i10 = (h * c - b * i) * s, i11 = (a * i - g * c) * s, i12 = (g * b - a * h) * s;
  const i20 = (b * f - e * c) * s, i21 = (d * c - a * f) * s, i22 = (a * e - d * b) * s;

  return [
    -(i00 * tx + i10 * ty + i20 * tz),
    -(i01 * tx + i11 * ty + i21 * tz),
    -(i02 * tx + i12 * ty + i22 * tz),
  ];
}

/** Os, positions de bind, et poids de skinning cumulés par os. */
async function inspect(file) {
  if (!existsSync(file)) return null;
  const doc = await io.read(file);
  const skin = doc.getRoot().listSkins()[0];
  if (!skin) return null;

  const joints = skin.listJoints();
  const names = joints.map((j) => j.getName());
  const invs = skin.getInverseBindMatrices()?.getArray();

  const pos = new Map();
  if (invs) {
    for (let i = 0; i < names.length; i++) {
      const p = bindPosition(invs, i * 16);
      if (p) pos.set(names[i], p);
    }
  }

  // Poids total porté par chaque os : c'est lui qui dit si un os compte.
  const weight = new Float64Array(names.length);
  let total = 0;
  for (const m of doc.getRoot().listMeshes())
    for (const p of m.listPrimitives()) {
      const J = p.getAttribute("JOINTS_0"), W = p.getAttribute("WEIGHTS_0");
      if (!J || !W) continue;
      const je = [0, 0, 0, 0], we = [0, 0, 0, 0];
      for (let v = 0; v < J.getCount(); v++) {
        J.getElement(v, je);
        W.getElement(v, we);
        for (let k = 0; k < 4; k++) {
          if (we[k] <= 0 || je[k] >= names.length) continue;
          weight[je[k]] += we[k];
          total += we[k];
        }
      }
    }

  return { names, pos, weight, total };
}

/** Écart de proportions : rapport des distances bassin→tête entre deux rigs. */
function scaleRatio(a, b) {
  const span = (sk) => {
    const head = sk.pos.get("head") ?? sk.pos.get("Head") ?? sk.pos.get("mixamorig:Head");
    const hips = sk.pos.get("pelvis") ?? sk.pos.get("Hips") ?? sk.pos.get("mixamorig:Hips");
    if (!head || !hips) return null;
    return Math.hypot(head[0] - hips[0], head[1] - hips[1], head[2] - hips[2]);
  };
  const sa = span(a), sb = span(b);
  return sa && sb ? sb / sa : null;
}

const base = await inspect(BASE.path);
if (!base) { console.error(`[compat] référence introuvable : ${BASE.path}`); process.exit(1); }
const baseSet = new Set(base.names);

const baseSpan = scaleRatio(base, base) === null ? null : 1;
console.log(`Référence : ${BASE.label} — ${base.names.length} os${baseSpan === null ? " (bassin/tête introuvables)" : ""}\n`);
console.log("pièce                  os   nom%   POIDS%   écart bind   échelle");
console.log("─".repeat(72));

const manifest = JSON.parse(readFileSync("src/data/parts-manifest.json", "utf8"));
const rows = [];
const vus = new Set();

for (const hero of manifest) {
  for (const part of hero.parts) {
    const sk = await inspect("public" + part.path);
    if (!sk) continue;

    let nomOk = 0, poidsOk = 0;
    for (let i = 0; i < sk.names.length; i++) {
      if (!baseSet.has(sk.names[i])) continue;
      nomOk++;
      poidsOk += sk.weight[i];
    }
    const parNom = nomOk / sk.names.length;
    const parPoids = sk.total > 0 ? poidsOk / sk.total : 0;

    // Écart de morphologie sur les os communs, en position de bind.
    let ecart = 0;
    for (const [n, pa] of sk.pos) {
      const pb = base.pos.get(n);
      if (!pb) continue;
      const d = Math.hypot(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]);
      if (d > ecart) ecart = d;
    }
    const ech = scaleRatio(sk, base);

    rows.push({
      id: `${hero.id}_${part.region}`, source: hero.id, region: part.region,
      bones: sk.names.length, coverageByName: parNom, coverageByWeight: parPoids,
      bindDelta: ecart, scale: ech,
    });

    const flag = parPoids < 0.5 ? "  ✗ REFUSÉ" : parPoids < 0.9 ? "  ⚠" : "";
    console.log(
      `${(hero.id + "/" + part.region).padEnd(20)} ${String(sk.names.length).padStart(4)} ` +
      `${(parNom * 100).toFixed(0).padStart(5)}% ${(parPoids * 100).toFixed(1).padStart(7)}% ` +
      `${ecart.toFixed(4).padStart(12)} ${(ech ? ech.toFixed(3) : "—").padStart(9)}${flag}`,
    );
    vus.add(hero.id);
  }
}

const refuses = rows.filter((r) => r.coverageByWeight < 0.5);
console.log(`\n${rows.length} pièces · ${refuses.length} sous 50 % de POIDS apparié`);
console.log(`Si l'on avait gardé le critère par NOMS : ${rows.filter((r) => r.coverageByName < 0.5).length} refusées.`);

if (OUT) { writeFileSync(OUT, JSON.stringify(rows, null, 2), "utf8"); console.log(`\n→ ${OUT}`); }
