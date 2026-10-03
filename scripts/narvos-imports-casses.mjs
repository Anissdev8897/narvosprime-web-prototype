// ============================================================================
// narvos-imports-casses.mjs — quels paquets un .uasset CUIT reference-t-il, et
// lesquels manquent au pack livre ?
//
//   node scripts/narvos-imports-casses.mjs [sous-dossier]
//   node scripts/narvos-imports-casses.mjs Narvos/MetaCustom/Premade_Blueprints
//
// -- LE DEFAUT QU IL MESURE ---------------------------------------------------
// 2026-09-12. `BP_MH_Male_Playable` est cuit, declare dans Assets.toml, et le
// serveur le pose sans une erreur. Le CLIENT, lui, refuse :
//
//     Failed to load Unreal Asset: 'narvos::BP_MH_Male_Playable'
//     (.../BP_MH_Male_Playable.BP_MH_Male_Playable_C)!
//     Asset File not found or is from a different type.
//     Required type 'BlueprintGeneratedClass'.
//
// Le fichier EST la. Ce qui manque, ce sont ses IMPORTS : ils pointent encore
// `/Game/Metahuman_Customization_System/...`, l emplacement d AVANT la promotion
// sous `Narvos/`. Or le cook ne prend que `Narvos/` : la classe parente n est
// nulle part, donc la BlueprintGeneratedClass ne se construit pas.
//
// Un Blueprint sans parent ne rate pas a moitie : il n existe pas.
//
// -- POURQUOI LIRE LES CHAINES ET PAS LA TABLE D IMPORTS ----------------------
// La table d imports d un paquet cuit demande de decoder l en-tete (versions,
// offsets, noms indexes) — beaucoup de code pour un verdict binaire. Les chemins
// `/Game/...` sont des NOMS, stockes en clair dans la table de noms : les lire
// suffit a dire ce que le paquet cherche.
//
// ATTENTION a ce que cette mesure NE fait PAS : distinguer un import d une
// simple mention. Elle SURESTIME donc les references, jamais l inverse — un
// manquant qu elle signale peut etre inoffensif, un manquant reel ne lui
// echappe pas.
// ============================================================================

import fs from "node:fs";
import path from "node:path";

const PACK = "E:/narvosprime-web-prototype/WebPortal/Server/Assets/narvos";
const SOUS = process.argv[2] || "Narvos/MetaCustom/Premade_Blueprints";

const enPosix = (p) => p.split(path.sep).join("/");

const racine = path.join(PACK, SOUS);
if (!fs.existsSync(racine)) {
  console.error("Dossier absent : " + racine);
  process.exit(1);
}

const fichiers = [];
(function descendre(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) descendre(p);
    else if (e.name.endsWith(".uasset")) fichiers.push(p);
  }
})(racine);

// Un arret sur resultat vide : un balayage qui ne trouve rien a plus souvent un
// chemin faux qu un dossier vide. Lecon du 2026-09-12 (manifestes vides).
if (fichiers.length === 0) {
  console.error("AUCUN .uasset sous " + SOUS + " — chemin faux ?");
  process.exit(1);
}

const MOTIF = new RegExp("/Game/[A-Za-z0-9_./-]{3,180}", "g");
const FIN_PONCTUATION = new RegExp("[./]+$");

/** Les chemins /Game/ lisibles dans la table de noms d un paquet cuit. */
const referencesDe = (fichier) => {
  const texte = fs.readFileSync(fichier).toString("latin1");
  const vus = new Set();
  for (const m of texte.matchAll(MOTIF)) {
    const n = m[0].replace(FIN_PONCTUATION, "");
    if (n.length > 6) vus.add(n);
  }
  return vus;
};

const versFichier = (paquet) => path.join(PACK, paquet.slice("/Game/".length) + ".uasset");

// -- LE PACK DE BASE N EST PAS UN MANQUE --------------------------------------
// `/Game/NanosWorld/...` est fourni par le CLIENT nanos (pack `nanos-world`), pas
// par le notre. Premier passage apres le cook du 2026-09-13 : 65 animations de
// Farming signalees « ABSENT » parce qu elles citent
// `/Game/NanosWorld/Characters/Common/SKEL_Mannequin` — c est exactement la
// PREUVE que l ObjectRedirect du squelette a pris, lue comme un defaut. On
// compte ces references a part, et on les verifie contre le pack de base
// installe quand il est lisible.
// Le CONTENT du client installe : `/Game/NanosWorld/X` y vit sous
// `Content/NanosWorld/X.uasset` (verifie le 2026-09-13 pour SKEL_Mannequin).
// ⚠ Pas `Content/NanosWorldAssets` : c est le pack d objets, sans les personnages.
const BASE_NANOS = process.env.NANOS_CLIENT_CONTENT
  || "D:/steam/steamapps/common/nanos-world-playtest/NanosWorld/Content";
const baseLisible = fs.existsSync(path.join(BASE_NANOS, "NanosWorld"));
const fournisParNanos = new Map();   // paquet -> present dans la base installee ?
const estBaseNanos = (paquet) => paquet.startsWith("/Game/NanosWorld/");
const present = (paquet) => fs.existsSync(versFichier(paquet));

const manquants = new Map();
let refs = 0;

console.log("Imports de " + fichiers.length + " paquet(s) cuit(s) sous " + SOUS);
console.log("");

for (const f of fichiers.sort()) {
  const nom = path.basename(f, ".uasset");
  const cassees = [];
  for (const r of referencesDe(f)) {
    if (r.endsWith("/" + nom)) continue;
    refs++;
    if (estBaseNanos(r)) {
      if (!fournisParNanos.has(r)) fournisParNanos.set(r, null);
      continue;
    }
    if (!present(r)) {
      cassees.push(r);
      if (!manquants.has(r)) manquants.set(r, []);
      manquants.get(r).push(nom);
    }
  }
  if (cassees.length) {
    console.log("  " + nom + "  —  " + cassees.length + " import(s) ABSENT(S) du pack");
    for (const c of cassees.sort()) console.log("      " + c);
  }
}

console.log("");
console.log(refs + " reference(s) /Game/ examinee(s).");
if (fournisParNanos.size > 0) {
  const dansBase = (p) => fs.existsSync(path.join(BASE_NANOS, p.slice("/Game/".length) + ".uasset"));
  const absentsBase = [...fournisParNanos.keys()].filter((p) => baseLisible && !dansBase(p));
  console.log(fournisParNanos.size + " reference(s) au pack de BASE nanos (fourni par le client)"
    + (baseLisible ? ", dont " + absentsBase.length + " introuvable(s) dans la base installee" : " — base installee illisible, non verifiees"));
  for (const p of [...fournisParNanos.keys()].sort()) {
    console.log("      " + (absentsBase.includes(p) ? "INTROUVABLE " : "base nanos  ") + p);
  }
  if (absentsBase.length > 0) process.exitCode = 1;
}
if (manquants.size === 0) {
  console.log("Aucun import absent du pack.");
  process.exit(0);
}

// L index des noms de base du pack, construit UNE fois : chercher un homonyme
// en re-descendant l arborescence par manquant coutait un balayage complet a
// chaque ligne.
const parNom = new Map();
(function indexer(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const q = path.join(d, e.name);
    if (e.isDirectory()) indexer(q);
    else if (e.name.endsWith(".uasset")) {
      const base = e.name.slice(0, -".uasset".length);
      if (!parNom.has(base)) parNom.set(base, []);
      parNom.get(base).push("/Game/" + enPosix(path.relative(PACK, q)).slice(0, -".uasset".length));
    }
  }
})(PACK);

console.log(manquants.size + " paquet(s) reference(s) et ABSENT(S) :");
console.log("");
for (const [p, par] of [...manquants].sort()) {
  const base = p.split("/").pop();
  const ailleurs = parNom.get(base) || [];
  console.log("  " + p);
  console.log("      demande par : " + [...new Set(par)].join(", "));
  if (ailleurs.length) {
    for (const a of ailleurs) console.log("      homonyme    : " + a);
  } else {
    console.log("      homonyme    : AUCUN — cet asset n est pas dans le pack");
  }
}
process.exit(1);