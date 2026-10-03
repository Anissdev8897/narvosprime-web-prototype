// ══════════════════════════════════════════════════════════════════════════════
// scripts/mpfb-targets-to-bin.mjs — morphs MakeHuman → binaire prêt au runtime.
//
//   node scripts/mpfb-targets-to-bin.mjs "<.../mpfb2-master/src/mpfb/data/targets>" [sortie]
//
// LE PROBLÈME
// MPFB2 livre 1 258 fichiers `.target.gz`, chacun du texte gzippé de la forme
// `index dx dy dz`, une ligne par sommet touché. Les charger tels quels au
// runtime voudrait dire 1 258 requêtes réseau et autant de parsings de texte —
// intenable pour un écran de création qui doit répondre au curseur.
//
// LA SORTIE
// Un fichier binaire PAR RÉGION du corps (`legs.morphs`, `head.morphs`…), avec
// son en-tête embarqué. Un seul fichier par région plutôt qu'un binaire + un
// JSON à côté : deux fichiers séparés finissent toujours par se désynchroniser,
// et un décalage d'offset ne se voit pas — il déforme le corps sans erreur.
//
//   [uint32 LE]  longueur de l'en-tête JSON, en octets
//   [utf8]       en-tête JSON  (aligné ensuite sur 4 octets)
//   [données]    par morph : Uint16Array(count) indices, Int16Array(count*3) deltas
//
// COMPACTAGE — mesuré, pas supposé
// En Int32 + Float32, les 1 250 morphs pesaient 92,9 Mo : intransportable pour
// du web. Deux réductions sûres, chacune justifiée par une mesure :
//   • INDICES en Uint16. L'espace canonique compte 19 158 sommets, largement
//     sous 65 536. Le script REFUSE de continuer si ce n'était plus vrai —
//     un débordement silencieux réécrirait des sommets au hasard.
//   • DELTAS en Int16, avec une échelle PAR MORPH (`scale` dans l'en-tête).
//     Un morph dont le plus grand déplacement vaut 2 unités se quantifie alors
//     au 1/16 000e d'unité — trois ordres de grandeur sous le visible.
// Total : 8 octets par sommet touché au lieu de 16.
//
// L'en-tête porte `canonicalVertexCount`. Le moteur runtime peut ainsi REFUSER
// un jeu de morphs qui ne correspond pas au mesh chargé, au lieu de produire un
// corps difforme sans rien signaler — c'est le mode d'échec par défaut ici, et
// il est silencieux.
//
// Les indices référencent l'ESPACE CANONIQUE (19 158 sommets, helpers compris),
// pas le mesh de rendu. Voir `mpfb-base-to-glb.mjs` pour la distinction.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

/** Taille de l'espace canonique — doit correspondre au GLB produit à côté. */
const CANONICAL_VERTEX_COUNT = 19158;

// Garde-fou du compactage en Uint16. Si le mesh de base grossissait au-delà de
// 65 535 sommets, les indices déborderaient EN SILENCE et le corps se
// déformerait au hasard. Mieux vaut refuser de générer.
if (CANONICAL_VERTEX_COUNT > 65535) {
  throw new Error(
    `espace canonique ${CANONICAL_VERTEX_COUNT} > 65535 : les indices Uint16 déborderaient`,
  );
}

/** Dossiers de `targets/` qui ne contiennent pas de morphs. */
const IGNORES = new Set(["_images"]);

/** Lit un `.target.gz` → { indices, deltas }. */
function lireTarget(fichier) {
  const texte = zlib.gunzipSync(fs.readFileSync(fichier)).toString("utf8");
  const indices = [];
  const deltas = [];
  let horsBornes = 0;

  for (const ligne of texte.split("\n")) {
    const t = ligne.trim();
    if (!t || t.startsWith("#")) continue;
    const p = t.split(/\s+/);
    if (p.length < 4) continue;
    const i = +p[0];
    // Un indice hors de l'espace canonique ne peut qu'écraser de la mémoire
    // voisine au runtime. On le jette ici, où on peut encore le compter.
    if (!Number.isInteger(i) || i < 0 || i >= CANONICAL_VERTEX_COUNT) { horsBornes++; continue; }
    indices.push(i);
    deltas.push(+p[1], +p[2], +p[3]);
  }
  return { indices, deltas, horsBornes };
}

/**
 * Identifiant de morph : le chemin RELATIF à la région, sans extension.
 *
 * Le nom de fichier seul ne suffit pas. Mesuré sur `expression/` : 102 fichiers
 * pour seulement 34 noms de base distincts, parce qu'un sous-dossier `units/`
 * reprend les mêmes noms. Les indexer par nom de base en écrasait 68 dans la
 * `Map` du runtime — silencieusement, et sans que le compte du script s'en
 * aperçoive.
 */
function nomMorph(fichier, racineRegion) {
  return path.relative(racineRegion, fichier)
    .split(path.sep).join("/")
    .replace(/\.target(\.gz)?$/i, "");
}

function ecrireRegion(region, fichiers, dest, racineRegion) {
  const morphs = [];
  const blocs = [];
  let offset = 0;
  let horsBornesTotal = 0;
  let sommetsTouches = 0;

  for (const f of fichiers.sort()) {
    const { indices, deltas, horsBornes } = lireTarget(f);
    horsBornesTotal += horsBornes;
    if (indices.length === 0) continue;   // morph vide : rien à appliquer
    sommetsTouches += indices.length;

    // Échelle propre au morph : la quantification suit l'amplitude réelle du
    // déplacement, au lieu d'une constante globale qui écraserait les petits
    // morphs pour accommoder les grands.
    let maxAbs = 0;
    for (const d of deltas) { const a = Math.abs(d); if (a > maxAbs) maxAbs = a; }
    const scale = maxAbs > 0 ? maxAbs / 32767 : 1;
    const quant = new Int16Array(deltas.length);
    for (let k = 0; k < deltas.length; k++) quant[k] = Math.round(deltas[k] / scale);

    const bi = Buffer.from(new Uint16Array(indices).buffer);
    const bd = Buffer.from(quant.buffer);
    morphs.push({
      name: nomMorph(f, racineRegion),
      count: indices.length,
      scale,
      indexOffset: offset,
      deltaOffset: offset + bi.byteLength,
    });
    blocs.push(bi, bd);
    offset += bi.byteLength + bd.byteLength;
    // Les deltas sont des Int16 : leur offset doit rester pair, sinon
    // `new Int16Array(buffer, offset)` lève côté navigateur. count*2 et
    // count*6 sont pairs, l'alignement se maintient donc de lui-même.
  }

  // Un doublon d'identifiant serait écrasé par la `Map` du runtime, sans
  // erreur. On préfère refuser de générer.
  const vus = new Set();
  for (const m of morphs) {
    if (vus.has(m.name)) throw new Error(`région « ${region} » : identifiant en double « ${m.name} »`);
    vus.add(m.name);
  }

  const entete = Buffer.from(JSON.stringify({
    region,
    canonicalVertexCount: CANONICAL_VERTEX_COUNT,
    morphs,
  }), "utf8");
  // Alignement sur 4 octets : sans lui, un `new Int32Array(buffer, offset)` lève
  // « start offset must be a multiple of 4 » côté navigateur.
  const bourrage = (4 - (entete.byteLength % 4)) % 4;
  const tete = Buffer.alloc(4);
  tete.writeUInt32LE(entete.byteLength + bourrage, 0);

  const sortie = path.join(dest, `${region}.morphs`);
  fs.writeFileSync(sortie, Buffer.concat([
    tete, entete, Buffer.alloc(bourrage), ...blocs,
  ]));

  return {
    region, morphs: morphs.length, sommetsTouches, horsBornes: horsBornesTotal,
    octets: fs.statSync(sortie).size,
  };
}

function main() {
  const src = process.argv[2];
  if (!src) {
    console.error("usage: node scripts/mpfb-targets-to-bin.mjs <dossier targets> [sortie]");
    process.exit(1);
  }
  const dest = process.argv[3] ?? "public/models/personnages/_body/morphs";
  fs.mkdirSync(dest, { recursive: true });

  const regions = fs.readdirSync(src, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !IGNORES.has(d.name))
    .map((d) => d.name)
    .sort();

  const rapport = [];
  for (const region of regions) {
    const dir = path.join(src, region);
    const fichiers = [];
    // Récursif : certaines régions rangent leurs morphs en sous-dossiers.
    const parcourir = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) { if (!IGNORES.has(e.name)) parcourir(p); }
        else if (/\.target(\.gz)?$/i.test(e.name)) fichiers.push(p);
      }
    };
    parcourir(dir);
    if (fichiers.length === 0) continue;
    rapport.push(ecrireRegion(region, fichiers, dest, dir));
  }

  // Index global : ce que le runtime lit en premier pour savoir quoi charger.
  const index = {
    canonicalVertexCount: CANONICAL_VERTEX_COUNT,
    regions: rapport.map((r) => ({ region: r.region, morphs: r.morphs, bytes: r.octets })),
  };
  fs.writeFileSync(path.join(dest, "index.json"), JSON.stringify(index, null, 2));

  // ── Rapport ────────────────────────────────────────────────────────────────
  rapport.sort((a, b) => b.morphs - a.morphs);
  console.info("\nrégion           morphs   sommets touchés     poids");
  console.info("─".repeat(56));
  for (const r of rapport) {
    console.info(
      `${r.region.padEnd(16)} ${String(r.morphs).padStart(5)}` +
      ` ${String(r.sommetsTouches).padStart(16)}` +
      ` ${(r.octets / 1024).toFixed(0).padStart(8)} Ko` +
      (r.horsBornes ? `   ⚠ ${r.horsBornes} indices hors bornes écartés` : ""),
    );
  }
  const totM = rapport.reduce((n, r) => n + r.morphs, 0);
  const totO = rapport.reduce((n, r) => n + r.octets, 0);
  const totH = rapport.reduce((n, r) => n + r.horsBornes, 0);
  console.info("─".repeat(56));
  console.info(`${"TOTAL".padEnd(16)} ${String(totM).padStart(5)} ${"".padStart(16)} ${(totO / 1024 / 1024).toFixed(1).padStart(8)} Mo`);
  if (totH > 0) console.info(`\n⚠ ${totH} indices hors de l'espace canonique écartés au total`);
  console.info(`\n✓ ${dest}`);
}

main();
