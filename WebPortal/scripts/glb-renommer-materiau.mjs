/**
 * glb-renommer-materiau.mjs — renomme un matériau (et ses images) DANS le chunk
 * JSON d'un GLB, sur place, sans toucher un octet de géométrie.
 *
 * USAGE
 *   node scripts/glb-renommer-materiau.mjs <ancien> <nouveau> <fichier|dossier>…
 *   node scripts/glb-renommer-materiau.mjs --verifier <ancien> <fichier|dossier>…
 *
 * ── POURQUOI CE SCRIPT EXISTE ────────────────────────────────────────────────
 * `WorldGridMaterial` est le nom RÉSERVÉ du matériau par défaut d'Unreal. Un GLB
 * qui nomme ainsi l'un de ses matériaux se fait silencieusement déposséder à
 * l'import : Interchange reconnaît le nom, substitue le matériau du moteur, et
 * **jette les textures que le GLB portait pourtant**. Le mesh s'affiche en gris
 * uni, sans une ligne de log.
 *
 * Mesuré le 2026-09-05 sur la Forge : 7 `LandscapeComponent` gris, dont un de
 * 1 180 × 1 459 m, alors que le GLB portait bien BaseColor, MetallicRoughness et
 * Normal. Même piège que les 67 pièces Trooper.
 *
 * ── POURQUOI LE NOUVEAU NOM DOIT ÊTRE PLUS COURT OU ÉGAL ─────────────────────
 * Un GLB déclare la taille de son chunk JSON dans un en-tête, et la taille totale
 * du fichier dans un autre. RALLONGER le JSON obligerait à réécrire les deux et à
 * décaler tout le binaire — pour un renommage, c'est disproportionné et c'est une
 * occasion de casser plusieurs Go de géométrie.
 *
 * Le RACCOURCIR, en revanche, ne coûte rien : la spec glTF rembourre déjà le
 * chunk JSON d'espaces (0x20) jusqu'au multiple de 4. On rend donc les octets
 * économisés sous forme d'espaces en fin de chunk. La longueur déclarée reste
 * exacte, les en-têtes ne bougent pas, le binaire n'est jamais touché.
 *
 * Le script REFUSE un nom plus LONG. Choisir plus court est trivial ; réparer un
 * GLB tronqué ne l'est pas.
 *
 * ── CE QUI EST PATCHÉ, ET CE QUI NE L'EST PAS ────────────────────────────────
 * Uniquement l'intervalle d'octets du chunk JSON. Le chunk binaire n'est jamais
 * ouvert en écriture : une séquence d'octets qui ressemblerait au nom au milieu
 * d'un buffer de sommets ne peut pas être touchée par accident.
 */

import { open, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

const MAGIC_GLB = 0x46546c67;
const TYPE_JSON = 0x4e4f534a;

/** Bornes du chunk JSON d'un GLB : { debut, longueur }. */
async function bornesJson(fh, taille) {
  const entete = Buffer.alloc(12);
  await fh.read(entete, 0, 12, 0);
  if (entete.readUInt32LE(0) !== MAGIC_GLB) throw new Error("pas un GLB");

  let curseur = 12;
  while (curseur + 8 <= taille) {
    const e = Buffer.alloc(8);
    await fh.read(e, 0, 8, curseur);
    const longueur = e.readUInt32LE(0);
    const type = e.readUInt32LE(4);
    if (type === TYPE_JSON) return { debut: curseur + 8, longueur };
    curseur = curseur + 8 + longueur;
  }
  throw new Error("chunk JSON introuvable");
}

/** Toutes les positions d'un motif dans un tampon. */
function positions(tampon, motif) {
  const out = [];
  let i = tampon.indexOf(motif, 0);
  while (i !== -1) {
    out.push(i);
    i = tampon.indexOf(motif, i + 1);
  }
  return out;
}

async function traiter(chemin, ancien, nouveau, verifierSeulement) {
  const fh = await open(chemin, verifierSeulement ? "r" : "r+");
  try {
    const taille = (await fh.stat()).size;
    const { debut, longueur } = await bornesJson(fh, taille);

    const json = Buffer.alloc(longueur);
    await fh.read(json, 0, longueur, debut);

    const motif = Buffer.from(ancien, "utf8");
    const trouves = positions(json, motif);
    if (trouves.length === 0) return { chemin, occurrences: 0 };

    if (verifierSeulement) return { chemin, occurrences: trouves.length };

    // Remplacement sur le TEXTE, puis remise a la longueur exacte du chunk par
    // des espaces de fin — c'est le rembourrage que la spec glTF prevoit deja.
    const texte = json.toString("utf8").split(ancien).join(nouveau);
    const octets = Buffer.from(texte, "utf8");
    if (octets.length > longueur) {
      throw new Error(`le JSON a grossi (${octets.length} > ${longueur}) : ${chemin}`);
    }

    // Le JSON doit rester du JSON. Un nom contenant un guillemet ou un antislash
    // casserait la chaine — on le constate AVANT d'ecrire.
    JSON.parse(texte);

    const sortie = Buffer.alloc(longueur, 0x20); // espaces
    octets.copy(sortie, 0);

    await fh.write(sortie, 0, longueur, debut);
    return { chemin, occurrences: trouves.length, ecrit: true, gagnes: longueur - octets.length };
  } finally {
    await fh.close();
  }
}

/**
 * Développe les dossiers en liste de .glb, RÉCURSIVEMENT.
 *
 * Les packs rangent leurs meshes en sous-dossiers (`Characters/Echo/Meshes`), et
 * une version non récursive ne trouvait rien en pointant la racine d'un pack —
 * en rendant « 0 fichier concerné », ce qui se lit comme « rien à faire ».
 */
async function cibles(entrees) {
  const out = [];
  for (const e of entrees) {
    const s = await stat(e);
    if (!s.isDirectory()) {
      out.push(e);
      continue;
    }
    for (const entree of (await readdir(e, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const chemin = join(e, entree.name);
      if (entree.isDirectory()) {
        out.push(...(await cibles([chemin])));
      } else if (entree.name.toLowerCase().endsWith(".glb")) {
        out.push(chemin);
      }
    }
  }
  return out;
}

// ── Mode AUTO ─────────────────────────────────────────────────────────────────
//
// Le même nom réservé traîne dans des dizaines de packs sans rapport. Les
// renommer tous pareil retirerait l'homonymie avec le moteur pour en créer autant
// entre eux : impossible de savoir, en lisant `MTL_Narvos`, d'où sort un asset.
//
// Le nom dérive donc des deux derniers segments PARLANTS du chemin du fichier —
// la même règle que `scripts/adk-renommer-asset.py`, pour que la source et l'ADK
// portent les mêmes noms après un réimport.
//
// ⚠ TRONQUÉ à la longueur de l'ancien nom : le chunk JSON ne peut que rétrécir.
// Une troncature vaut mieux qu'un refus — le but est de sortir du nom réservé.
const SEGMENTS_MUETS = new Set(["Meshes", "Mesh", "Parts", "Characters", "Content", "SkeletalMeshes", "models"]);

function nomDerive(cheminFichier, longueurMax) {
  const parts = cheminFichier.replace(/\\/g, "/").split("/").slice(0, -1);
  const parlants = parts
    .filter((p) => p && !SEGMENTS_MUETS.has(p))
    .map((p) => p.replace(/[^A-Za-z0-9_]/g, "_"));

  if (parlants.length === 0) return "MTL_Asset";

  // ⚠ PARTIR DU DERNIER SEGMENT, pas des deux puis tronquer. Une troncature
  // aveugle donnait `MTL_GameAnimation` pour `GameAnimationSample/Echo` : le
  // segment qui identifie l'asset — `Echo` — était précisément celui qui sautait,
  // et deux packs voisins retombaient sur le même nom illisible.
  //
  // On garde donc le plus spécifique, et on n'ajoute le parent que s'il TIENT.
  const dernier = "MTL_" + parlants[parlants.length - 1];
  if (parlants.length < 2) return dernier.slice(0, longueurMax);

  const avecParent = "MTL_" + parlants[parlants.length - 2] + "_" + parlants[parlants.length - 1];
  if (Buffer.byteLength(avecParent, "utf8") <= longueurMax) return avecParent;
  return dernier.slice(0, longueurMax);
}

// ────────────────────────────────────────────────────────────────────── main

const args = process.argv.slice(2);
const verifierSeulement = args[0] === "--verifier";
const reste = verifierSeulement ? args.slice(1) : args;

const ancien = reste[0];
const nouveau = verifierSeulement ? null : reste[1];
const AUTO = !verifierSeulement && String(nouveau).toUpperCase() === "AUTO";
const entrees = verifierSeulement ? reste.slice(1) : reste.slice(2);

if (!ancien || entrees.length === 0 || (!verifierSeulement && !nouveau)) {
  console.error("Usage : node scripts/glb-renommer-materiau.mjs <ancien> <nouveau> <fichier|dossier>…");
  console.error("        node scripts/glb-renommer-materiau.mjs --verifier <ancien> <fichier|dossier>…");
  process.exit(1);
}

if (!verifierSeulement) {
  const la = Buffer.byteLength(ancien, "utf8");
  const ln = Buffer.byteLength(nouveau, "utf8");
  if (!AUTO && ln > la) {
    console.error(`REFUS : "${ancien}" fait ${la} octets, "${nouveau}" en fait ${ln}.`);
    console.error("Un nom PLUS LONG obligerait a reecrire les en-tetes et a decaler le binaire.");
    console.error("Choisir un nom de longueur inferieure ou egale.");
    process.exit(2);
  }
  if (AUTO) {
    console.log(`Renommage "${ancien}" -> nom derive du dossier (tronque a ${la} octets)\n`);
  } else {
    console.log(`Renommage "${ancien}" -> "${nouveau}"  (${la} -> ${ln} octets, ${la - ln} rendu(s) au rembourrage)\n`);
  }
} else {
  console.log(`Recherche de "${ancien}"\n`);
}

const fichiers = await cibles(entrees);
let totalOcc = 0;
let touches = 0;

const laLongueur = Buffer.byteLength(ancien, "utf8");

for (const f of fichiers) {
  const cible = AUTO ? nomDerive(f, laLongueur) : nouveau;
  const r = await traiter(f, ancien, cible, verifierSeulement);
  totalOcc += r.occurrences;
  if (r.occurrences > 0) {
    touches++;
    const quoi = r.ecrit ? `-> ${cible}` : "";
    console.log(`  ${r.ecrit ? "ecrit " : "trouve"}  ${r.occurrences.toString().padStart(3)} occ.  ${f}  ${quoi}`);
  }
}

console.log("");
console.log(`${fichiers.length} fichier(s) examine(s), ${touches} concerne(s), ${totalOcc} occurrence(s).`);
