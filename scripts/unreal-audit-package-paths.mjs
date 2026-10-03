// ══════════════════════════════════════════════════════════════════════════════
// unreal-audit-package-paths.mjs — Détecte les assets déplacés hors de l'éditeur.
//
//   node scripts/unreal-audit-package-paths.mjs <racine-Content> [--json <fichier>]
//
// POURQUOI : un `.uasset` porte SON PROPRE chemin de package en dur dans son
// en-tête, et toutes ses références sont absolues (`/Game/Pack/Meshes/SK_X`).
// Copier un dossier de contenu par l'explorateur ne le déplace donc pas : ça
// produit des assets qui se croient ailleurs, dont aucune référence ne résout.
//
// Symptôme typique côté éditeur : « Unable to retrieve target USkeleton for
// Animation Asset », suivi en cascade de RigHierarchy, ControlRig et de chaque
// piste FK. Des dizaines de milliers de lignes pour une seule faute.
//
// CE QU'ON LIT : les chaînes ASCII de l'en-tête, d'où on tire le chemin que
// l'asset s'attribue. On le compare à sa position réelle sur disque. L'écart
// donne le préfixe à retirer — donc le déplacement qui réparerait tout.
//
// Lecture d'en-tête uniquement (64 Ko par fichier au plus) : des milliers
// d'assets en quelques secondes.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";

const racine = process.argv[2];
const jsonIdx = process.argv.indexOf("--json");
const JSON_OUT = jsonIdx !== -1 ? process.argv[jsonIdx + 1] : null;

if (!racine || !fs.existsSync(racine)) {
  console.error("Usage : node scripts/unreal-audit-package-paths.mjs <racine-Content> [--json <fichier>]");
  process.exit(1);
}

const MAGIC = 0x9e2a83c1;
// L'en-tête suffit : la table des noms y est, et c'est elle qui porte les chemins.
const ENTETE = 64 * 1024;
// Combien d'assets sonder par pack. Un pack est cohérent : quelques fichiers
// suffisent à établir sa racine d'origine, et sonder tout serait inutilement long.
const ECHANTILLON = 12;

/** Chemins de package référencés dans l'en-tête d'un .uasset. */
const cheminsDe = (fichier) => {
  let fd;
  try {
    fd = fs.openSync(fichier, "r");
    const buf = Buffer.alloc(Math.min(ENTETE, fs.statSync(fichier).size));
    fs.readSync(fd, buf, 0, buf.length, 0);
    if (buf.readUInt32LE(0) !== MAGIC) return null;
    const texte = buf.toString("latin1");
    return [...new Set(texte.match(/\/Game\/[A-Za-z0-9_\-/]+/g) || [])];
  } catch {
    return null;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
};

const parcourir = (dir, acc = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) parcourir(f, acc);
    else if (e.name.endsWith(".uasset") || e.name.endsWith(".umap")) acc.push(f);
  }
  return acc;
};

// ─── analyse par pack ─────────────────────────────────────────────────────────

/** Chemin de package réel, déduit de la position sur disque. */
const cheminReel = (fichier) =>
  "/Game/" +
  path
    .relative(racine, fichier)
    .replace(/\.(uasset|umap)$/i, "")
    .split(path.sep)
    .join("/");

// `--packs <sous-dossier>` énumère les packs plus bas dans l'arborescence tout
// en gardant la VRAIE racine de contenu pour reconstruire les chemins. Sans ça,
// analyser Content/NARVOS/ ferait disparaître le segment « NARVOS » du chemin
// calculé — exactement celui qu'on cherche à mettre en évidence.
const packsIdx = process.argv.indexOf("--packs");
const SOUS = packsIdx !== -1 ? process.argv[packsIdx + 1] : null;
const dirPacks = SOUS ? path.join(racine, SOUS) : racine;

const packs = fs
  .readdirSync(dirPacks, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => (SOUS ? path.join(SOUS, e.name) : e.name));

const resultats = [];

for (const pack of packs) {
  const fichiers = parcourir(path.join(racine, pack));
  if (fichiers.length === 0) continue;

  // Échantillon réparti sur l'arborescence plutôt que les 12 premiers, qui
  // seraient tous dans le même sous-dossier.
  const pas = Math.max(1, Math.floor(fichiers.length / ECHANTILLON));
  const sondes = fichiers.filter((_, i) => i % pas === 0).slice(0, ECHANTILLON);

  let sains = 0;
  let casses = 0;
  const prefixes = new Map(); // préfixe à retirer -> occurrences

  for (const f of sondes) {
    const chemins = cheminsDe(f);
    if (!chemins) continue;

    const reel = cheminReel(f);
    const nom = reel.split("/").pop();
    // Le chemin que l'asset s'attribue se termine par son propre nom.
    const declare = chemins.find((c) => c.endsWith("/" + nom));
    if (!declare) continue;

    if (declare === reel) {
      sains++;
      continue;
    }
    casses++;

    // `/Game/NARVOS/Pack/…` réel contre `/Game/Pack/…` déclaré : le préfixe en
    // trop est ce qui sépare les deux têtes de chemin.
    const rSeg = reel.split("/");
    const dSeg = declare.split("/");
    const surplus = rSeg.length - dSeg.length;
    if (surplus > 0 && rSeg.slice(surplus + 2).join("/") === dSeg.slice(2).join("/")) {
      const p = rSeg.slice(2, 2 + surplus).join("/");
      prefixes.set(p, (prefixes.get(p) || 0) + 1);
    } else {
      prefixes.set("(non trivial)", (prefixes.get("(non trivial)") || 0) + 1);
    }
  }

  const dominant = [...prefixes].sort((a, b) => b[1] - a[1])[0];

  resultats.push({
    pack,
    fichiers: fichiers.length,
    sondes: sondes.length,
    sains,
    casses,
    prefixeEnTrop: dominant ? dominant[0] : null,
  });
}

// ─── sortie ───────────────────────────────────────────────────────────────────

const casses = resultats.filter((r) => r.casses > 0);
const sains = resultats.filter((r) => r.casses === 0 && r.sains > 0);
const indetermines = resultats.filter((r) => r.casses === 0 && r.sains === 0);

const total = resultats.reduce((s, r) => s + r.fichiers, 0);
const totalCasses = casses.reduce((s, r) => s + r.fichiers, 0);

console.log(`${resultats.length} packs, ${total.toLocaleString("fr-FR")} assets sous ${racine}`);
console.log("");
console.log(`  ${casses.length} pack(s) aux références cassées — ${totalCasses.toLocaleString("fr-FR")} assets`);
console.log(`  ${sains.length} pack(s) sains`);
if (indetermines.length) console.log(`  ${indetermines.length} pack(s) indéterminés (aucun chemin lisible)`);

if (casses.length) {
  console.log("");
  console.log(`  ${"PACK".padEnd(34)} ${"ASSETS".padStart(7)}  ${"SONDE".padStart(6)}  PRÉFIXE EN TROP`);
  for (const r of casses.sort((a, b) => b.fichiers - a.fichiers)) {
    console.log(
      `  ${r.pack.padEnd(34)} ${String(r.fichiers).padStart(7)}  ${String(r.casses + "/" + r.sondes).padStart(6)}  ${r.prefixeEnTrop ?? "?"}`,
    );
  }
}

if (JSON_OUT) {
  fs.mkdirSync(path.dirname(JSON_OUT), { recursive: true });
  fs.writeFileSync(JSON_OUT, JSON.stringify({ racine, resultats }, null, 2) + "\n", "utf8");
  console.log("");
  console.log(`Inventaire écrit : ${JSON_OUT}`);
}