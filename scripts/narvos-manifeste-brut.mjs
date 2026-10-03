// ══════════════════════════════════════════════════════════════════════════════
// narvos-manifeste-brut.mjs — manifeste d'import SANS controle de squelette.
//
//   node scripts/narvos-manifeste-brut.mjs <dossier|fichier>... <nom-du-manifeste>
//                                          [--racine <dossier>] [--exclure <regex>]
//
// Plusieurs cibles sont acceptées : c'est la seule façon de couvrir des dossiers
// disjoints (`creatures/` ET `pnj_monstre/`) sous une racine COMMUNE. La racine
// décide de l'arborescence de destination — voir la clé `racine` plus bas.
// `--exclure` écarte par motif (les LOD séparés, par exemple, qu'Unreal sait
// reconstruire lui-même et qui n'ajouteraient que des assets morts).
//
// ── QUAND L'UTILISER, ET QUAND SURTOUT PAS ────────────────────────────────────
// `narvos-skeleton-compat.mjs` produit le manifeste NORMAL : il ne retient que
// les GLB dont la hiérarchie d'os correspond à SKEL_Mannequin. C'est la bonne
// porte pour tout ce qui est un personnage.
//
// Ce script-ci est pour l'autre cas : des personnages riggés sur un AUTRE
// squelette. Mesuré le 2026-09-04, les GLB de `public/models/pnj` et de
// `pnj_monstre` ont 24 os (Grunt) à 102 (RobotGirl), nommés selon la convention
// Meshy. Le contrôle de squelette les rejette donc tous en `ETRANGER` — verdict
// EXACT, puisqu'il compare les NOMS, mais qui ne dit pas quoi faire d'eux.
//
// Ils s'importent avec `NARVOS_SANS_SQUELETTE=1` : Interchange leur fabrique
// alors un squelette propre, et ils se jouent via `CharacterSimple`, seule
// classe nanos qui n'impose aucun squelette.
//
// ⚠ NE JAMAIS L'EMPLOYER SUR UN PACK DEJA COMPATIBLE MANNEQUIN. Il ne vérifie
// rien : un personnage qui aurait pu partager SKEL_Mannequin se retrouverait
// avec un squelette neuf, donc inattachable et incapable de jouer nos 1 842
// animations. Passer d'abord par `narvos-skeleton-compat.mjs` : s'il rend
// IDENTIQUE, SUR-ENSEMBLE ou REPARENTE, c'est l'autre porte qu'il faut.
//
// ── CE QU'IL VÉRIFIE QUAND MÊME ───────────────────────────────────────────────
// Les extensions de texture qu'Interchange ne lit pas. Déclarée dans
// `extensionsRequired`, une telle extension fait refuser le fichier ENTIER — pas
// seulement ses textures. Un GLB ainsi écarté est compté et nommé, jamais avalé
// en silence. Voir `ILLISIBLES` : la liste ne se limite PAS au KTX2, et le
// commentaire qui l'accompagne dit pourquoi s'y limiter était un défaut.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";

/**
 * Lit une option `--nom valeur` et la retire de la ligne de commande.
 *
 * On consomme les options AVANT de traiter les positionnels : sans ça, la
 * valeur d'une option (`--racine <dossier>`) serait comptée comme une cible à
 * parcourir, et le manifeste listerait tout l'arbre des modèles.
 */
const options = process.argv.slice(2);
const lireOption = (nom) => {
  const i = options.indexOf(nom);
  if (i < 0) return null;
  const valeur = options[i + 1];
  if (valeur === undefined || valeur.startsWith("--")) {
    console.error(`${nom} attend une valeur`);
    process.exit(1);
  }
  options.splice(i, 2);
  return valeur;
};

const RACINE_IMPOSEE = lireOption("--racine");
const EXCLURE = lireOption("--exclure");
const INCLURE_FBX = options.includes("--fbx");
if (INCLURE_FBX) options.splice(options.indexOf("--fbx"), 1);

const positionnels = options.filter((a) => !a.startsWith("--"));

// ⚠ PLUSIEURS CIBLES, UNE SEULE RACINE.
//
// Le dernier positionnel est le nom du manifeste ; tout ce qui précède est une
// cible. Un appel à deux arguments — l'usage d'origine — reste donc valide.
//
// Pourquoi plusieurs cibles : un lot d'import s'étale sur des dossiers qui ne
// se touchent pas (`creatures/` ET `pnj_monstre/`). Les passer en un seul appel
// est la SEULE façon d'obtenir une racine commune, et la racine décide de
// l'arborescence de destination : `adk-import-narvos.py` calcule
// `relpath(fichier, racine)`. Deux manifestes séparés donneraient deux racines,
// donc deux arbres qui s'écrasent sous /Game/Narvos/.
const nom = positionnels.pop();
const cibles = positionnels;

if (cibles.length === 0 || !nom) {
  console.error("Usage : node scripts/narvos-manifeste-brut.mjs <dossier...> <nom-du-manifeste>");
  console.error("                                              [--racine <dossier>] [--exclure <regex>] [--fbx]");
  console.error("Exemple : … WebPortal/public/models/pnj pnj");
  console.error("Exemple : … models/creatures models/pnj_monstre/dog animaux --racine models");
  process.exit(1);
}
for (const c of cibles) {
  if (!fs.existsSync(c)) {
    console.error(`Introuvable : ${c}`);
    process.exit(1);
  }
}
if (RACINE_IMPOSEE && !fs.existsSync(RACINE_IMPOSEE)) {
  console.error(`Racine introuvable : ${RACINE_IMPOSEE}`);
  process.exit(1);
}

// La racine doit CONTENIR chaque cible, sinon `relpath` produit des `..` et
// l'import écrit hors de /Game/Narvos. Vérifié ici plutôt que découvert après
// dix minutes de commandlet.
if (RACINE_IMPOSEE) {
  const abs = path.resolve(RACINE_IMPOSEE);
  for (const c of cibles) {
    const rel = path.relative(abs, path.resolve(c));
    if (rel.startsWith("..") || path.isAbsolute(rel)) {
      console.error(`La cible ${c} n'est pas sous la racine ${RACINE_IMPOSEE}`);
      process.exit(1);
    }
  }
}

const motifExclusion = EXCLURE ? new RegExp(EXCLURE, "i") : null;

const SORTIE = "E:/narvosprime-web-prototype/WebPortal/Server/adk/_manifests";

// ── Collecte ──────────────────────────────────────────────────────────────────

const fichiers = [];
const exclus = [];
const collecter = (p) => {
  const st = fs.statSync(p);
  if (st.isFile()) {
    const fin = p.toLowerCase();
    const glb = fin.endsWith(".glb") || fin.endsWith(".gltf");
    const fbx = INCLURE_FBX && fin.endsWith(".fbx");
    // ⚠ ON ECARTE LES `_degraisse`. `narvos-degraisser-glb.mjs` en mode fichier
    // unique ecrit `<nom>_degraisse.glb` A COTE de l'original. Sans ce filtre, un
    // manifeste porterait les DEUX versions du meme clip, importees sous deux
    // noms — et rien ne le signalerait : l'import reussit, il fait juste le
    // travail deux fois. Le filtre est ICI, chez le consommateur, parce que
    // compter sur le menage a la main est ce qui fabrique un defaut silencieux.
    const degraisse = fin.includes("_degraisse");
    if ((glb || fbx) && !degraisse) {
      const normalise = p.split(path.sep).join("/");
      if (motifExclusion && motifExclusion.test(normalise)) exclus.push(p);
      else fichiers.push(p);
    }
    return;
  }
  for (const e of fs.readdirSync(p, { withFileTypes: true })) collecter(path.join(p, e.name));
};
for (const c of cibles) collecter(c);

/** Le GLB exige-t-il une extension qu'Interchange ne lit pas ?
 *
 *  On lit l'en-tête JSON du conteneur binaire plutôt que d'ouvrir le document
 *  avec gltf-transform : c'est cent fois plus rapide sur des packs de plusieurs
 *  gigaoctets, et la question ne porte que sur une liste de noms. */
function extensionsRequises(chemin) {
  if (chemin.toLowerCase().endsWith(".gltf")) {
    try {
      return JSON.parse(fs.readFileSync(chemin, "utf8")).extensionsRequired ?? [];
    } catch { return []; }
  }

  const fd = fs.openSync(chemin, "r");
  try {
    // En-tête GLB : magic(4) version(4) length(4), puis chunkLength(4) type(4).
    const entete = Buffer.alloc(20);
    if (fs.readSync(fd, entete, 0, 20, 0) < 20) return [];
    if (entete.toString("ascii", 0, 4) !== "glTF") return [];

    const longueurJson = entete.readUInt32LE(12);
    // Un en-tête JSON dépasse rarement quelques centaines de kilo-octets ; on
    // borne pour ne pas charger un fichier entier par accident.
    const aLire = Math.min(longueurJson, 4 * 1024 * 1024);
    const tampon = Buffer.alloc(aLire);
    fs.readSync(fd, tampon, 0, aLire, 20);

    // On ne parse pas : un JSON tronqué ferait échouer JSON.parse alors que la
    // seule question est la présence du nom d'extension.
    const texte = tampon.toString("utf8");
    const m = texte.match(/"extensionsRequired"\s*:\s*\[(.*?)\]/s);
    if (!m) return [];
    return [...m[1].matchAll(/"(.*?)"/g)].map((x) => x[1]);
  } catch {
    return [];
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Extensions de texture qu'Interchange ne sait PAS lire.
 *
 * ⚠ CETTE LISTE NE DOIT PAS SE LIMITER AU KTX2. Le filtre d'origine ne
 * connaissait que `KHR_texture_basisu` — le premier cas rencontré. Or la règle
 * n'est pas « le KTX2 pose problème » mais « une extension listée dans
 * extensionsRequired engage le lecteur : il DOIT la comprendre ou refuser le
 * document ENTIER » (spec glTF). Toute extension illisible bloque donc de la
 * même manière.
 *
 * Mesuré le 2026-09-06 : `pnj_monstre/aquarys_crab` exige `EXT_texture_webp`.
 * Il passait ce filtre, entrait dans `pnj-monstre.json` comme importable, et
 * Interchange le refusait en entier — d'où le contournement
 * `_textures_png/` déjà présent dans le dépôt, qui traite le symptôme.
 *
 * La liste est celle de `narvos-textures-vers-png.mjs` (ILLISIBLES), qui est
 * l'outil qui les corrige : les deux doivent connaître les mêmes noms, sinon on
 * écarte des fichiers qu'on ne sait pas réparer, ou on en laisse passer qu'on
 * aurait su réparer.
 */
const ILLISIBLES = new Set(["KHR_texture_basisu", "EXT_texture_webp", "EXT_texture_avif"]);

const retenus = [];
const ecartes = [];

for (const f of fichiers) {
  const requises = extensionsRequises(f);
  const bloquantes = requises.filter((e) => ILLISIBLES.has(e));
  if (bloquantes.length > 0) {
    ecartes.push({ fichier: f, cause: bloquantes.join(", ") });
    continue;
  }
  // ⚠ CHEMIN ABSOLU, TOUJOURS. Un commandlet Unreal n'a PAS le dépôt pour
  // répertoire courant : il tourne depuis `Engine/Binaries/Win64/`. Un chemin
  // relatif y est résolu contre CE dossier, et Interchange répond
  // « There was no data to import in the provided source data » — un message qui
  // accuse le fichier alors que le fichier n'a jamais été ouvert.
  // Mesuré deux fois sur ce projet : 584 imports perdus, puis 60.
  retenus.push({ fichier: path.resolve(f).replace(/\\/g, "/"), verdict: "BRUT", os: 0 });
}

// ── Écriture ──────────────────────────────────────────────────────────────────

// ⚠ LA CLÉ `racine` EST OBLIGATOIRE.
//
// `adk-import-narvos.py` la lit par `donnees["racine"]`, sans valeur par défaut :
// un manifeste sans elle s'arrête sur `KeyError: 'racine'`, après que le
// commandlet a démarré le moteur — plusieurs minutes perdues pour rien.
//
// Elle sert à calculer la destination : `relpath(dirname(fichier), racine)` est
// recopié sous /Game/Narvos/. Une racine trop profonde aplatit l'arborescence et
// fait collider les noms ; une racine hors des cibles produit des `..`.
const racine = RACINE_IMPOSEE
  ? RACINE_IMPOSEE
  : (fs.statSync(cibles[0]).isDirectory() ? cibles[0] : path.dirname(cibles[0]));

const manifeste = {
  genere_le: "manuel",
  reference: "(aucune — import sans squelette)",
  os_reference: 0,
  racine: path.resolve(racine).replace(/\\/g, "/"),
  total_analyses: fichiers.length,
  importables: retenus.length,
  ecartes_ktx2: ecartes.length,
  fichiers: retenus,
};

fs.mkdirSync(SORTIE, { recursive: true });
const chemin = path.join(SORTIE, `${nom}.json`);
fs.writeFileSync(chemin, JSON.stringify(manifeste, null, 2), "utf8");

console.log(`  cibles      : ${cibles.length}`);
console.log(`  racine      : ${manifeste.racine}`);
console.log(`  analyses    : ${fichiers.length}`);
console.log(`  retenus     : ${retenus.length}`);
if (motifExclusion) console.log(`  exclus      : ${exclus.length}  (--exclure ${EXCLURE})`);
console.log(`  illisibles  : ${ecartes.length}`);
for (const e of ecartes.slice(0, 8)) console.log(`      ${path.basename(e.fichier)}  (${e.cause})`);
console.log(`  ecrit       : ${chemin}`);
console.log("");
console.log("  Importer avec :  NARVOS_SANS_SQUELETTE=1 NARVOS_MANIFEST=" + chemin);