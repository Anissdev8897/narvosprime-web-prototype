// ══════════════════════════════════════════════════════════════════════════════
// adk-copier-hyper.mjs — COPIER sous Narvos/Hyper/ la fermeture de dependances
// des objets Hyper retenus. Jamais deplacer.
//
//   node scripts/adk-copier-hyper.mjs            essai : compte et pese
//   node scripts/adk-copier-hyper.mjs --apply    copie
//
// Entree : WebPortal/Server/adk/_manifests/hyper-promotion.json (ecrit par
//          narvos-hyper-to-lua.mjs --apply : meshes + icones des objets retenus).
//
// ── ⚠ POURQUOI COPIER, ET POURQUOI C'EST NON NEGOCIABLE ─────────────────────
// `adk/Content/Hyper` est une JONCTION vers le pack d'origine dans asset_game —
// la seule copie connue de ce que Hanibes a achete. `adk-promouvoir-packs.py`
// DEPLACE (`rename_assets`) : lance ici, il supprimerait les fichiers du pack
// d'origine a travers la jonction. Ce script ne fait que LIRE sous `Hyper/` et
// n'ECRIT que sous `Narvos/Hyper/`, et il le verifie avant chaque ecriture.
//
// ── POURQUOI LES IMPORTS SE RESOLVENT QUAND MEME ─────────────────────────────
// Un .uasset copie garde ses imports vers `/Game/Hyper/...`. Le PackageRedirects
// `/Game/Hyper/` -> `/Game/Narvos/Hyper/` (DefaultEngine.ini) les ramene sur les
// copies. Methode PROUVEE le 2026-09-12 sur MetaCustom : 53 paquets aux imports
// perimes sortis du cook, tous resolus.
//
// ── ⚠ LA FERMETURE EST APPROXIMATIVE, DANS LE BON SENS ───────────────────────
// Elle lit les chemins `/Game/Hyper/...` dans les octets des paquets. Une MENTION
// n'est pas forcement un import : elle SURESTIME, donc copie un peu plus que
// necessaire — jamais moins. Apres le cook, `narvos-imports-casses.mjs` sur
// `Narvos/Hyper` dit si un import manque encore.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";

const RACINE = "E:/narvosprime-web-prototype";
const CONTENT = `${RACINE}/WebPortal/Server/adk/Content`;
// ── LA RACINE EST UN PARAMETRE ───────────────────────────────────────────────
// Ecrit pour Hyper, puis generalise le meme soir pour Crystals and Crafting
// (`Hypernova/CrystalKeeper`) et Farming And Mining (`Farming_And_Mining`).
//
//   --racine <Chemin/Sous/Content>   defaut : Hyper
//   --manifeste <fichier.json>       defaut : _manifests/<racine>-promotion.json
const arg = (nom, defaut) => {
  const i = process.argv.indexOf(nom);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : defaut;
};
const RACINE_PACK = arg("--racine", "Hyper").replace(/^\/+|\/+$/g, "");
// ── SOURCE ET CIBLE PARAMETRABLES (2026-09-13, les vrais MetaHumans) ─────────
// `Metahuman_Ref` n'a JAMAIS ete sous Content/ : le reste du Meta Customization
// System y a ete copie (Content/Metahuman_Customization_System, sans lui) puis
// promu sous Narvos/MetaCustom/ — nom COURT, celui qu'attend le redirect existant
// `/Game/Metahuman_Customization_System/` -> `/Game/Narvos/MetaCustom/`.
//
//   --source <dossier disque>   defaut : Content/<racine> (la jonction)
//   --cible  <Sous/Narvos>      defaut : <racine>
const SOURCE = arg("--source", `${CONTENT}/${RACINE_PACK}`).replace(/\\/g, "/").replace(/\/+$/, "");
const CIBLE = `${CONTENT}/Narvos/${arg("--cible", RACINE_PACK).replace(/^\/+|\/+$/g, "")}`;
const PREFIXE = `/Game/${RACINE_PACK}/`;
const nomManifeste = RACINE_PACK === "Hyper" ? "hyper" : RACINE_PACK.replace(/[\/]/g, "_").toLowerCase();
const MANIFESTE = arg("--manifeste", `${RACINE}/WebPortal/Server/adk/_manifests/${nomManifeste}-promotion.json`);
const APPLY = process.argv.includes("--apply");

// ── EXCLURE UNE PARTIE DU PACK DE LA FERMETURE ───────────────────────────────
// Ajoute le 2026-09-13 pour Ako Minimap : son DataAsset de reglages cite cinq
// classes de la DEMO (309 Mo, un vehicule AUDI entre autres), ramenees sur nos
// proxies par ClassRedirects. Suivre ces mentions lierait toute la demo.
//
//   --exclure "Example_Content_Demo/,ako_mini_map_Content/ui/EUW_"
//
// Sous-chemins RELATIFS a la racine, separes par des virgules. Une mention exclue
// n'est pas suivie — SAUF si elle est elle-meme une racine du manifeste (Box_board,
// le mesh de la boite de bornes, vit dans la demo et doit entrer).
//
// Une entree est un PREFIXE (`EUW_` prend tous les widgets EUW_*). Terminee par `$`,
// elle designe UN paquet exactement : `Common/Face/Face_Archetype$` ne doit pas
// emporter ses voisins `Face_Archetype_Skeleton` et `Face_Archetype_Physics`.
const EXCLUS = arg("--exclure", "").split(",").map((x) => x.trim().replace(/^\/+/, "")).filter(Boolean)
  .map((x) => `${PREFIXE}${x}`);
const correspond = (paquet, entree) => (entree.endsWith("$") ? paquet === entree.slice(0, -1) : paquet.startsWith(entree));

// ── NE SUIVRE QU'UNE PARTIE DU PACK ──────────────────────────────────────────
// Ajoute le 2026-09-13 pour Metahuman_Ref : ses paquets citent aussi le RESTE du
// pack (squelette metahuman_base_skel, Body Tool…), deja promu et RESAUVE sous
// Narvos/MetaCustom/. Le suivre voudrait lier l'original par-dessus la copie promue.
//
//   --seulement "Metahuman_Ref/"
//
// Une mention hors perimetre n'est pas suivie : le redirect la resout vers ce qui
// est deja sous la cible. Le script verifie qu'elle y existe, et la liste sinon.
const SEULEMENT = arg("--seulement", "").split(",").map((x) => x.trim().replace(/^\/+/, "")).filter(Boolean)
  .map((x) => `${PREFIXE}${x}`);

// ── LIENS DURS PAR DEFAUT, COPIE SUR DEMANDE ─────────────────────────────────
// Premier essai, 2026-09-12 : 1 306 paquets, 6,4 Go. Hanibes venait de dire
// « c'est enorme de copier ». Source et destination sont sur le MEME volume (D:),
// donc un LIEN DUR NTFS suffit : le fichier existe a deux chemins et partage ses
// octets sur le disque. Zero octet de plus.
//
// ⚠ LE RISQUE, ET POURQUOI IL EST ACCEPTABLE ICI : un lien dur partage le
// CONTENU. Un outil qui reecrirait le fichier EN PLACE modifierait aussi
// l'original. Le cook ne reecrit jamais une source, et l'editeur sauvegarde par
// fichier temporaire puis renommage — ce qui ROMPT le lien et laisse l'original
// intact. Mais on ne lance JAMAIS sur ces copies un script qui resauve des assets
// (`adk-plafonner-textures.py`, par exemple) : le plafonnement se fera au cook.
const COPIE_PHYSIQUE = process.argv.includes("--copie");

// Les fichiers qui composent UN paquet cuit ou non cuit.
const EXTENSIONS = [".uasset", ".uexp", ".ubulk", ".uptnl", ".umap"];

if (!fs.existsSync(MANIFESTE)) {
  console.error("ARRET : manifeste absent — lancer narvos-hyper-to-lua.mjs --apply");
  process.exit(1);
}
if (!fs.existsSync(SOURCE)) {
  console.error(`ARRET : ${SOURCE} absent (jonction non posee ?)`);
  process.exit(1);
}

const { racines } = JSON.parse(fs.readFileSync(MANIFESTE, "utf8"));
if (!Array.isArray(racines) || racines.length === 0) {
  console.error("ARRET : manifeste sans racine — rien a copier, et c'est suspect.");
  process.exit(1);
}

/** /Game/Hyper/X/Y -> chemin disque du .uasset sous la source (la jonction par defaut). */
const disque = (paquet) => `${SOURCE}/${paquet.slice(PREFIXE.length)}.uasset`;

// Le prefixe ne contient que lettres, chiffres, `_` et `/` : aucun caractere
// special d'expression reguliere a echapper. On le verifie plutot que de le
// supposer — un nom de pack avec un point casserait la fermeture en silence.
if (!/^[A-Za-z0-9_\/]+$/.test(PREFIXE)) {
  console.error(`ARRET : racine « ${RACINE_PACK} » avec un caractere inattendu.`);
  process.exit(1);
}
const MOTIF = new RegExp(PREFIXE + "[A-Za-z0-9_\\-./ ]{2,200}", "g");

// ── Fermeture ────────────────────────────────────────────────────────────────
const vus = new Set();
const absents = [];
const exclues = new Set();
const horsPerimetre = new Set();
const file = [...racines];
const estRacine = new Set(racines);
while (file.length) {
  const p = file.pop();
  if (vus.has(p)) continue;
  const f = disque(p);
  if (!fs.existsSync(f)) { absents.push(p); vus.add(p); continue; }
  vus.add(p);
  const texte = fs.readFileSync(f).toString("latin1");
  for (const m of texte.matchAll(MOTIF)) {
    // Un nom d'objet suit parfois le paquet : « /Game/X/Y.Y » -> « /Game/X/Y ».
    const nu = m[0].split(".")[0].replace(/[/ ]+$/, "");
    if (!estRacine.has(nu) && EXCLUS.some((e) => correspond(nu, e))) { exclues.add(nu); continue; }
    if (SEULEMENT.length && !estRacine.has(nu) && !SEULEMENT.some((s) => correspond(nu, s))) {
      if (nu.length > PREFIXE.length) horsPerimetre.add(nu);
      continue;
    }
    if (nu.length > PREFIXE.length && !vus.has(nu)) file.push(nu);
  }
}

const presents = [...vus].filter((p) => !absents.includes(p)).sort();

// ── Taille et plan de copie ──────────────────────────────────────────────────
let octets = 0;
const copies = [];
for (const p of presents) {
  const base = `${SOURCE}/${p.slice(PREFIXE.length)}`;
  for (const ext of EXTENSIONS) {
    const src = base + ext;
    if (!fs.existsSync(src)) continue;
    const dst = `${CIBLE}/${p.slice(PREFIXE.length)}${ext}`;
    octets += fs.statSync(src).size;
    copies.push([src, dst]);
  }
}

const parDossier = {};
for (const p of presents) {
  const d = p.split("/").slice(3, 5).join("/");
  parDossier[d] = (parDossier[d] ?? 0) + 1;
}

console.log(`Racines : ${racines.length}   fermeture : ${presents.length} paquet(s)   absents : ${absents.length}`);
if (EXCLUS.length) {
  console.log(`Exclus (--exclure ${EXCLUS.map((e) => e.slice(PREFIXE.length)).join(",")}) : ${exclues.size} mention(s) non suivie(s)`);
  for (const e of [...exclues].sort().slice(0, 12)) console.log(`  - ${e}`);
}
console.log(`Fichiers a copier : ${copies.length}   poids : ${(octets / 1048576).toFixed(1)} Mo`);
console.log("Par dossier :");
for (const [d, n] of Object.entries(parDossier).sort((a, b) => b[1] - a[1]).slice(0, 12)) {
  console.log(`  ${String(n).padStart(5)}  ${d}`);
}
if (absents.length) {
  // Un chemin cite qui n'existe pas : souvent une mention (surestimation), parfois
  // un vrai manque du pack. On le montre, on ne s'arrete pas.
  console.log(`\n${absents.length} chemin(s) cite(s) sans fichier (mentions probables) :`);
  for (const a of absents.slice(0, 8)) console.log(`  ${a}`);
}
if (SEULEMENT.length) {
  // Hors perimetre = resolu par le redirect vers ce qui est DEJA sous la cible.
  const sousCible = (p) => [".uasset", ".umap"].some((e) => fs.existsSync(`${CIBLE}/${p.slice(PREFIXE.length)}${e}`));
  const introuvables = [...horsPerimetre].filter((p) => !sousCible(p)).sort();
  console.log(`\nHors perimetre (--seulement) : ${horsPerimetre.size} mention(s) ; ${horsPerimetre.size - introuvables.length} deja sous Narvos/, ${introuvables.length} introuvable(s) :`);
  for (const p of introuvables.slice(0, 25)) console.log(`  ? ${p}`);
}
// Une destination deja presente avec d'AUTRES octets (une copie promue puis
// resauvee, typiquement) n'est jamais ecrasee.
const conflits = copies.filter(([src, dst]) => fs.existsSync(dst) && fs.statSync(dst).size !== fs.statSync(src).size);
if (conflits.length) {
  console.log(`\n${conflits.length} destination(s) deja presente(s) avec un autre contenu — jamais ecrasees :`);
  for (const [, d] of conflits.slice(0, 8)) console.log(`  ${d}`);
}

if (!APPLY) {
  console.log("\nESSAI — rien n'est copie. --apply pour copier.");
  process.exit(0);
}

// ── Copie, avec la garde ─────────────────────────────────────────────────────
const SOURCE_REELLE = fs.realpathSync(SOURCE);
let ecrits = 0, deja = 0;
for (const [src, dst] of copies) {
  // ⚠ LA GARDE : la destination ne doit JAMAIS resoudre sous le pack d'origine.
  const dossierDst = path.dirname(dst);
  fs.mkdirSync(dossierDst, { recursive: true });
  const reel = fs.realpathSync(dossierDst);
  if (reel.toLowerCase().startsWith(SOURCE_REELLE.toLowerCase())) {
    console.error(`ARRET : ${dst} resout sous le pack d'origine (${reel}). Rien de plus n'est ecrit.`);
    process.exit(1);
  }
  if (fs.existsSync(dst)) {
    // Meme taille : deja lie. Autre taille : un conflit, compte plus haut, JAMAIS ecrase.
    if (fs.statSync(dst).size === fs.statSync(src).size) deja++;
    continue;
  }
  if (COPIE_PHYSIQUE) {
    fs.copyFileSync(src, dst);
  } else {
    fs.linkSync(src, dst);
  }
  ecrits++;
}

// ⚠ LE SEUL CONTROLE QUI VAUT : un recompte a l'arrivee.
let arrives = 0;
for (const [, dst] of copies) if (fs.existsSync(dst)) arrives++;
console.log(`\n${COPIE_PHYSIQUE ? "Copie" : "Liens durs"} : ${ecrits} ecrit(s), ${deja} deja present(s), ${conflits.length} conflit(s) conserve(s), ${arrives}/${copies.length} a l'arrivee.`);
if (conflits.length) {
  console.error("ARRET : des destinations portaient deja un autre contenu (conservees) — a trancher avant de cuire.");
  process.exit(1);
}
if (arrives !== copies.length) {
  console.error("ARRET : le recompte ne tombe pas juste.");
  process.exit(1);
}