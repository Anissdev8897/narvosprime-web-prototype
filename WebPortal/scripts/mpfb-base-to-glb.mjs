// ══════════════════════════════════════════════════════════════════════════════
// scripts/mpfb-base-to-glb.mjs — base.obj MakeHuman → GLB exploitable au runtime.
//
//   node scripts/mpfb-base-to-glb.mjs "<chemin/vers/base.obj>" [sortie]
//
// POURQUOI CE SCRIPT EXISTE PLUTÔT QU'UN CONVERTISSEUR OBJ STANDARD
//
// Un morph target MakeHuman est une liste de `index_sommet dx dy dz`. Il ne
// s'applique QUE sur l'ordre de sommets exact du fichier source. Or tout
// convertisseur OBJ généraliste déduplique les sommets par tuple `(v/vt/vn)` :
// il en RÉORDONNE et en DUPLIQUE. Les 1 260 morphs deviendraient alors faux,
// sans erreur ni avertissement — le corps se déformerait n'importe comment.
//
// MESURÉ SUR LE FICHIER LIVRÉ (mpfb2-master) :
//   19 158 sommets · 21 334 UV · 18 486 faces QUAD · 172 groupes
//   groupe `body`   : 13 378 quads · 13 380 sommets  ← le seul visible
//   138 groupes `helper-*` / `joint-*` : 5 108 quads · 5 778 sommets
//
// Les helpers servent à MakeHuman pour ajuster les vêtements et placer les
// articulations. Ils ne se rendent pas — MAIS les morphs les déforment aussi,
// donc ils doivent rester dans l'espace d'indexation.
//
// D'OÙ LA SORTIE EN DEUX ESPACES :
//
//   ESPACE CANONIQUE   19 158 positions, ordre fichier INTACT.
//                      C'est l'espace où s'appliquent les morphs.
//   MESH DE RENDU      une PRIMITIVE par surface (cf. `SURFACES` : la peau, les
//                      yeux), quads triangulés, sommets dédupliqués par (v, vt)
//                      pour porter les UV aux coutures.
//                      + `_MORPH_INDEX` : pour chaque sommet de rendu, son
//                        indice dans l'espace canonique — COMMUN aux surfaces.
//
// Au runtime : appliquer les deltas dans l'espace canonique, puis redistribuer
// vers le buffer de rendu via `_MORPH_INDEX`. L'indirection coûte une passe
// linéaire et garantit que rien ne peut se désaligner.
//
// `_MORPH_INDEX` voyage DANS le GLB (attribut personnalisé, préfixe `_` = valide
// en glTF) plutôt que dans un fichier à côté : deux fichiers séparés finissent
// toujours par se désynchroniser.
// ══════════════════════════════════════════════════════════════════════════════

import { NodeIO, Document } from "@gltf-transform/core";
import fs from "node:fs";
import path from "node:path";

/**
 * Surfaces rendues, une PRIMITIVE chacune. Tout groupe absent d'ici est de la
 * géométrie d'aide MakeHuman et n'est pas rendu.
 *
 * POURQUOI LES YEUX SONT UNE PRIMITIVE À PART, ET PAS DES FACES DE PLUS.
 * Une primitive porte un matériau. Les fondre dans `skin` rendrait toute teinte
 * d'iris impossible : colorer la peau colorerait les yeux du même geste. Le
 * matériau se nomme exactement `Eyes` parce que `skinTint.ts` filtre par NOM de
 * matériau (`EYE_MATERIAL`) — le renommer ici casse la teinte sans rien lever.
 *
 * ⚠ CORRESPONDANCE EXACTE, JAMAIS UN PRÉFIXE. `base.obj` contient aussi
 * `helper-l-eyelashes-1` et `-2` (les cils, 40 groupes). Un `startsWith`
 * embarquerait ces quads plats en travers du visage. D'où le `Set` et son
 * `.has()`.
 *
 * Les yeux restent indexés dans l'ESPACE CANONIQUE comme le corps : les morphs
 * de la région `eyes` continuent donc de les déplacer avec les orbites, sans
 * traitement particulier.
 */
const SURFACES = [
  { nom: "skin", groupes: new Set(["body"]), rugosite: 0.8, metal: 0 },
  { nom: "Eyes", groupes: new Set(["helper-l-eye", "helper-r-eye"]), rugosite: 0.15, metal: 0 },
];

/**
 * Lit l'OBJ sans jamais réordonner les positions.
 *
 * Retourne les positions dans l'ordre du fichier, les UV, et les faces avec
 * leurs indices d'origine (1-based dans l'OBJ, ramenés à 0).
 */
function lireObj(src) {
  const positions = [];   // [x,y,z] × n, ORDRE FICHIER
  const uvs = [];         // [u,v] × m
  const faces = [];       // { v:[...], vt:[...], groupe }
  let groupe = "default";

  const texte = fs.readFileSync(src, "utf8");
  for (const ligne of texte.split("\n")) {
    if (ligne.startsWith("v ")) {
      const p = ligne.split(/\s+/);
      positions.push([+p[1], +p[2], +p[3]]);
    } else if (ligne.startsWith("vt ")) {
      const p = ligne.split(/\s+/);
      uvs.push([+p[1], +p[2]]);
    } else if (ligne.startsWith("g ")) {
      groupe = ligne.slice(2).trim();
    } else if (ligne.startsWith("f ")) {
      const coins = ligne.trim().split(/\s+/).slice(1);
      const v = [], vt = [];
      for (const c of coins) {
        const [iv, ivt] = c.split("/");
        v.push(+iv - 1);
        vt.push(ivt ? +ivt - 1 : -1);
      }
      faces.push({ v, vt, groupe });
    }
  }
  return { positions, uvs, faces };
}

/**
 * Construit UNE surface de rendu : les groupes demandés, quads triangulés,
 * sommets dédupliqués par (position, uv).
 *
 * La déduplication se fait ICI et nulle part ailleurs : elle produit un NOUVEL
 * espace d'indices, distinct de l'espace canonique, et `morphIndex` est le pont
 * entre les deux.
 *
 * Chaque surface a son PROPRE cache, donc sa propre numérotation à partir de 0 :
 * c'est ce qu'exige glTF, où les indices d'une primitive ne désignent que ses
 * accesseurs à elle. Le lien commun reste `morphIndex`, qui pointe vers l'espace
 * canonique partagé — deux surfaces peuvent ainsi être morphées par une seule
 * passe.
 */
function construireRendu(positions, uvs, faces, groupes) {
  const cache = new Map();          // "v|vt" → indice de rendu
  const outPos = [];                // positions du mesh de rendu
  const outUv = [];
  const morphIndex = [];            // rendu → canonique
  const indices = [];

  const sommet = (iv, ivt) => {
    const cle = `${iv}|${ivt}`;
    const vu = cache.get(cle);
    if (vu !== undefined) return vu;
    const i = outPos.length / 3;
    const p = positions[iv];
    outPos.push(p[0], p[1], p[2]);
    const t = ivt >= 0 && uvs[ivt] ? uvs[ivt] : [0, 0];
    // glTF a l'origine UV en haut à gauche, l'OBJ en bas à gauche.
    outUv.push(t[0], 1 - t[1]);
    morphIndex.push(iv);
    cache.set(cle, i);
    return i;
  };

  for (const f of faces) {
    if (!groupes.has(f.groupe)) continue;
    // Éventail depuis le premier coin : valable pour les quads convexes de
    // MakeHuman. Un quad donne 2 triangles, un n-gone n-2.
    const c = f.v.map((iv, k) => sommet(iv, f.vt[k]));
    for (let k = 1; k + 1 < c.length; k++) indices.push(c[0], c[k], c[k + 1]);
  }

  return { outPos, outUv, morphIndex, indices };
}

function boite(positions) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const p of positions) {
    for (let i = 0; i < 3; i++) {
      if (p[i] < min[i]) min[i] = p[i];
      if (p[i] > max[i]) max[i] = p[i];
    }
  }
  return { min, max, taille: max.map((v, i) => v - min[i]) };
}

async function main() {
  const src = process.argv[2];
  if (!src) {
    console.error("usage: node scripts/mpfb-base-to-glb.mjs <base.obj> [sortie.glb]");
    process.exit(1);
  }
  const dest = process.argv[3]
    ?? "public/models/personnages/_body/base.glb";

  console.info(`[mpfb] lecture ${src}`);
  const { positions, uvs, faces } = lireObj(src);
  console.info(`[mpfb] ${positions.length} sommets · ${uvs.length} UV · ${faces.length} faces`);

  const bb = boite(positions);
  console.info(
    `[mpfb] emprise : ${bb.taille.map((v) => v.toFixed(2)).join(" × ")} unités` +
    ` — hauteur ${bb.taille[1].toFixed(2)}`,
  );

  // ── Écriture GLB ────────────────────────────────────────────────────────────
  const doc = new Document();
  const buf = doc.createBuffer();
  const mesh = doc.createMesh("mh_base");
  const bilan = [];

  for (const surface of SURFACES) {
    const { outPos, outUv, morphIndex, indices } = construireRendu(
      positions, uvs, faces, surface.groupes,
    );
    const nRendu = outPos.length / 3;

    // Un groupe renommé en amont ne lève rien : la surface sort simplement vide
    // et le corps perd une pièce en silence. On refuse plutôt que de livrer un
    // mannequin amputé.
    if (nRendu === 0) {
      console.error(
        `[mpfb] surface « ${surface.nom} » VIDE — groupes introuvables dans l'OBJ :` +
        ` ${[...surface.groupes].join(", ")}`,
      );
      process.exit(1);
    }

    const aPos = doc.createAccessor(`POSITION_${surface.nom}`)
      .setArray(new Float32Array(outPos)).setType("VEC3").setBuffer(buf);
    const aUv = doc.createAccessor(`TEXCOORD_0_${surface.nom}`)
      .setArray(new Float32Array(outUv)).setType("VEC2").setBuffer(buf);
    // Uint32 et non Uint16 : l'espace canonique compte 19 158 entrées, au-delà de
    // 65 535 ce serait faux — autant ne pas poser de plafond qu'on oublierait.
    const aMorph = doc.createAccessor(`_MORPH_INDEX_${surface.nom}`)
      .setArray(new Uint32Array(morphIndex)).setType("SCALAR").setBuffer(buf);
    const aIdx = doc.createAccessor(`indices_${surface.nom}`)
      .setArray(new Uint32Array(indices)).setType("SCALAR").setBuffer(buf);

    mesh.addPrimitive(
      doc.createPrimitive()
        .setAttribute("POSITION", aPos)
        .setAttribute("TEXCOORD_0", aUv)
        .setAttribute("_MORPH_INDEX", aMorph)
        .setIndices(aIdx)
        .setMaterial(
          doc.createMaterial(surface.nom)
            .setRoughnessFactor(surface.rugosite)
            .setMetallicFactor(surface.metal),
        ),
    );

    bilan.push({ nom: surface.nom, nRendu, nTris: indices.length / 3, duplic: nRendu - new Set(morphIndex).size });
  }

  for (const b of bilan) {
    console.info(
      `[mpfb] surface ${b.nom.padEnd(6)} : ${String(b.nRendu).padStart(6)} sommets ·` +
      ` ${String(b.nTris).padStart(6)} triangles (${b.duplic} dupliqués aux coutures UV)`,
    );
  }

  const node = doc.createNode("mh_base").setMesh(mesh);
  doc.createScene("scene").addChild(node);

  // Trace la taille de l'espace canonique DANS le fichier : le moteur runtime
  // peut ainsi refuser un jeu de morphs qui ne correspond pas, au lieu de
  // produire un corps difforme.
  doc.getRoot().setExtras({
    canonicalVertexCount: positions.length,
    sourceFaces: faces.length,
    // Les surfaces attendues, dans l'ordre des primitives. Le riggeur s'en sert
    // pour vérifier qu'il n'en perd aucune en route.
    surfaces: SURFACES.map((s) => s.nom),
    generator: "mpfb-base-to-glb",
  });

  fs.mkdirSync(path.dirname(dest), { recursive: true });
  await new NodeIO().write(dest, doc);
  const ko = (fs.statSync(dest).size / 1024).toFixed(0);
  console.info(`[mpfb] ✓ ${dest} (${ko} Ko) — espace canonique ${positions.length}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
