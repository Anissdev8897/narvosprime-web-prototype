#!/usr/bin/env node
/**
 * Range les modeles 3D de NARVOS a cote du plugin Unreal auquel ils appartiennent.
 *
 * Les paquets vivent dans WebPortal/public/models/, classes par CATEGORIE
 * (systemes/, interface/, vfx/...) parce que c'est la taxonomie du runtime web.
 * Cote Unreal, ce qui compte est le plugin qui les exploite. Ce script fait la
 * jonction, etablie en comparant les noms de paquets aux noms de plugins.
 *
 * Destination : <projet>/ImportSources/<Plugin>/ — deliberement HORS de Content/.
 * Unreal ne gere que des .uasset dans Content/ ; y deposer des GLB bruts produit
 * des avertissements de fichiers inconnus sans rien importer. Les sources
 * d'import se rangent a cote, et l'import les convertit vers Content/.
 *
 * Simulation par defaut ; `--apply` copie.
 *
 * Usage :
 *   node scripts/unreal-stage-models.mjs [--apply]
 */

import fs from "node:fs";
import path from "node:path";

const MODELS_ROOT = "E:/narvosprime-web-prototype/WebPortal/public/models";
const PROJECT = "C:/Users/aniss/Documents/nanos_world/asset/NarvosUE57";
const STAGING = path.join(PROJECT, "ImportSources");

const APPLY = process.argv.includes("--apply");

/**
 * Correspondance plugin -> paquet de modeles.
 * Etablie par comparaison de noms, puis verifiee un a un. Les quasi-homonymes
 * ecartes sont notes : `animations/ProceduralWeaponAnimationSystem` n'est PAS
 * Nanimation — la chaine "nAnimation" y apparait par hasard.
 */
const PAIRINGS = [
  { plugin: "ACF_UltimateFullSampleUE57", pack: "systemes/ACF_UltimateFullSampleUE57" },
  { plugin: "AdvancedGASSystem", pack: "systemes/AdvancedGASSystem" },
  { plugin: "FastAI", pack: "systemes/FastAI" },
  { plugin: "NPCEyesSightPRO", pack: "systemes/NPCEyesSightPRO" },
  { plugin: "OverCrowd_MassiveCrowdSimulation", pack: "systemes/OverCrowd_MassiveCrowdSimulation" },
  { plugin: "BaconCombatGraphU", pack: "animations/BaconCombatGraphU" },
  { plugin: "FGearPlugin", pack: "vehicules/FGear" },
  { plugin: "FireChat", pack: "interface/FireChat" },
  { plugin: "FlexiCam", pack: "interface/flexicam" },
  { plugin: "UIWS", pack: "interface/UIWS" },
  { plugin: "uAim", pack: "interface/uAim" },
  { plugin: "GWOPRO", pack: "divers/GWOPRO" },
  { plugin: "sky_creator", pack: "vfx/sky_creator" },
];

/**
 * Bibliotheque d'animations, rangee a part.
 *
 * Elle n'appartient a aucun plugin : une animation joue sur n'importe quel
 * personnage qui partage son squelette. La classer par plugin n'aurait aucun
 * sens, d'ou un dossier dedie.
 *
 * Mesure par `unreal-audit-glb.mjs` : 729 GLB, 668 animations, dont 575 deja
 * sur le Mannequin UE4 — le squelette que nanos exige. C'est le lot le plus
 * directement exploitable de tout le depot.
 */
const ANIMATIONS_PACK = { source: "animations", destination: "_Animations" };

// ------------------------------------------------------------------ helpers

const walk = (dir, acc = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else acc.push(full);
  }
  return acc;
};

const summarize = (dir) => {
  const counts = {};
  let bytes = 0;
  for (const file of walk(dir)) {
    const ext = path.extname(file).slice(1).toLowerCase() || "(sans)";
    counts[ext] = (counts[ext] || 0) + 1;
    bytes += fs.statSync(file).size;
  }
  return { counts, bytes };
};

const topExtensions = (counts, limit = 4) =>
  Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([ext, n]) => `${n} ${ext}`)
    .join(", ");

// --------------------------------------------------------------------- main

if (!fs.existsSync(PROJECT)) {
  console.error(`Projet introuvable : ${PROJECT}`);
  process.exit(1);
}

console.log(APPLY ? "=== APPLIQUE ===" : "=== SIMULATION (ajouter --apply) ===");
console.log(`vers : ${STAGING}`);
console.log("");

const manifest = [];
let totalBytes = 0;

for (const { plugin, pack } of PAIRINGS) {
  const from = path.join(MODELS_ROOT, pack);
  if (!fs.existsSync(from)) {
    console.log(`  MANQUE  ${pack}`);
    continue;
  }

  const { counts, bytes } = summarize(from);
  totalBytes += bytes;
  console.log(
    `  ${plugin.padEnd(34)} ${(bytes / 1024 / 1024).toFixed(0).padStart(5)} Mo   ${topExtensions(counts)}`,
  );

  manifest.push({ plugin, pack, megabytes: Math.round(bytes / 1024 / 1024), files: counts });

  if (APPLY) {
    const to = path.join(STAGING, plugin);
    fs.mkdirSync(to, { recursive: true });
    fs.cpSync(from, to, { recursive: true });
  }
}

// Bibliotheque d'animations : un seul bloc, hors appariement par plugin.
{
  const from = path.join(MODELS_ROOT, ANIMATIONS_PACK.source);
  if (fs.existsSync(from)) {
    const { counts, bytes } = summarize(from);
    totalBytes += bytes;
    console.log("");
    console.log(
      `  ${ANIMATIONS_PACK.destination.padEnd(34)} ${(bytes / 1024 / 1024).toFixed(0).padStart(5)} Mo   ${topExtensions(counts)}`,
    );
    manifest.push({
      plugin: ANIMATIONS_PACK.destination,
      pack: ANIMATIONS_PACK.source,
      megabytes: Math.round(bytes / 1024 / 1024),
      files: counts,
    });
    if (APPLY) {
      const to = path.join(STAGING, ANIMATIONS_PACK.destination);
      fs.mkdirSync(to, { recursive: true });
      fs.cpSync(from, to, { recursive: true });
    }
  }
}

console.log("");
console.log(`  ${"TOTAL".padEnd(34)} ${(totalBytes / 1024 / 1024).toFixed(0).padStart(5)} Mo`);

if (APPLY) {
  fs.writeFileSync(
    path.join(STAGING, "pairings.json"),
    JSON.stringify({ generatedFrom: MODELS_ROOT, pairings: manifest }, null, 2) + "\n",
    "utf8",
  );
  console.log("");
  console.log(`Manifeste ecrit : ${path.join(STAGING, "pairings.json")}`);
}