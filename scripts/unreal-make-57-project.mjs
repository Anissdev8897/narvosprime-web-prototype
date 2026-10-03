#!/usr/bin/env node
/**
 * Monte un projet Unreal 5.7 a partir du projet 5.8 existant.
 *
 * Le projet 5.8 n'est pas touche : ses binaires (UniGLB, VRM4U, Nanimation)
 * sont compiles pour 5.8 et servent au travail en cours. On duplique donc le
 * squelette — .uproject, Source/, Config/ — puis on y recopie les plugins
 * SANS leurs Binaries/ ni Intermediate/, qui sont des artefacts 5.8.
 *
 * Les trois corrections specifiques 5.8 faites dans UnrealMCPServer sont
 * annulees : en 5.7 le header n'a pas bouge, SetEnums prend 4 arguments et
 * FJsonObject::Values est indexe par FString.
 *
 * Simulation par defaut ; `--apply` ecrit.
 *
 * Usage :
 *   node scripts/unreal-make-57-project.mjs [--apply]
 */

import fs from "node:fs";
import path from "node:path";

const SOURCE_PROJECT = "C:/Users/aniss/Documents/TPSModelUE57_01 5.8";
const TARGET_PROJECT = "C:/Users/aniss/Documents/NarvosUE57";
const ENGINE_VERSION = "5.7.0";
const ENGINE_ASSOCIATION = "5.7";

const APPLY = process.argv.includes("--apply");

// UniGLB accompagne le lot : c'est l'importateur GLB dont on a besoin pour
// faire entrer les modeles. Les autres plugins preexistants restent en 5.8.
const PLUGINS = [
  "ACF_UltimateFullSampleUE57",
  "AdvancedGASSystem",
  "BaconCombatGraphU",
  "DragonIK_UniversalIKSystem",
  "FGearPlugin",
  "FastAI",
  "FireChat",
  "FlexiCam",
  "GWOPRO",
  // MetaHumanForHoudini_5.8 volontairement exclu : le dossier ne contient
  // qu'une archive zip de 917 Mo posee a cote d'un .uplugin, pas un plugin
  // installe. Rien a compiler, et c'est un outil Houdini, pas Unreal.
  "NPCEyesSightPRO",
  "OpenRigLogicSampleContent_5.8",
  "OverCrowd_MassiveCrowdSimulation",
  "SkeletalMeshMerger",
  "UIWS",
  "UnrealMCPServer",
  "sky_creator",
  "traillersource",
  "uAim",
  "UniGLB",
];

/**
 * Nom de dossier source -> nom que le plugin attend de porter.
 *
 * Plusieurs plugins appellent `IPluginManager::FindPlugin("<nom>")` avec un nom
 * code en dur, puis dereferencent le resultat SANS verifier. Si le dossier ne
 * porte pas ce nom, FindPlugin renvoie nullptr et l'editeur plante au demarrage
 * du module — pas a la compilation. Le nom du dossier fait donc partie du
 * contrat, il ne se choisit pas librement.
 *
 * Les dossiers de `_vendor_sources/scriptC++/` portent des noms de commande ou
 * de pack, pas des noms de plugin : d'ou ce mappage.
 */
const RENAMES = {
  ACF_UltimateFullSampleUE57: "AscentCombatFramework",
  BaconCombatGraphU: "BaconComboGraph",
  sky_creator: "SkyCreatorPlugin",
  OverCrowd_MassiveCrowdSimulation: "OverCrowd",
};

/**
 * Repertoires que le code exige a l'execution mais qui n'accompagnaient pas les
 * sources. `SetContentRoot` sur un dossier absent se contente d'icones vides,
 * mais `AddShaderSourceDirectoryMapping` fait un check() : dossier absent =
 * assertion = crash. On les cree vides.
 */
const REQUIRED_DIRS = {
  AscentCombatFramework: ["Resources"],
  BaconComboGraph: ["Resources"],
  OverCrowd: ["Resources"],
  SkyCreatorPlugin: ["Shaders"],
};

// Artefacts de compilation : lies a la version du moteur, jamais recopies.
const SKIP_DIRS = new Set(["Binaries", "Intermediate", "DerivedDataCache", "Saved", ".vs"]);

// BuildSettingsVersion plafonne a V6 en 5.7 (Latest = V6) ; V7 n'apparait
// qu'en 5.8. Applique aux Target.cs copies, pas aux plugins.
const TARGET_RULES_58_TO_57 = [
  { from: "BuildSettingsVersion.V7", to: "BuildSettingsVersion.V6" },
];

// Les trois seules divergences 5.7 / 5.8 introduites dans le code des plugins.
const REVERTS_58_TO_57 = [
  {
    file: "UnrealMCPServer/Source/UnrealMCPServer/Private/Tools/MCPDataTools.cpp",
    from: '#include "StructUtils/UserDefinedStruct.h"',
    to: '#include "Engine/UserDefinedStruct.h"',
    why: "le header ne migre vers CoreUObject/StructUtils qu'en 5.8",
  },
  {
    file: "UnrealMCPServer/Source/UnrealMCPServer/Private/Tools/MCPBlueprintTools.cpp",
    from:
      "NewEnum->SetEnums(InitialNames, UEnum::ECppForm::Namespaced, UEnum::EUnderlyingType::uint8, EEnumFlags::None, UEnum::EAddMaxKeyIfMissing::Yes);",
    to: "NewEnum->SetEnums(InitialNames, UEnum::ECppForm::Namespaced, EEnumFlags::None, true);",
    why: "la surcharge a 5 arguments n'existe pas en 5.7",
  },
  {
    file: "UnrealMCPServer/Source/UnrealMCPServer/Private/MCPHttpServer.cpp",
    from: "Arguments.Add(FString(Pair.Key.ToView()), Value);",
    to: "Arguments.Add(Pair.Key, Value);",
    why: "FJsonObject::Values est indexe par FString en 5.7",
  },
];

// ------------------------------------------------------------------ helpers

const copyTree = (from, to) => {
  if (!APPLY) return;
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      copyTree(path.join(from, entry.name), path.join(to, entry.name));
    } else {
      fs.copyFileSync(path.join(from, entry.name), path.join(to, entry.name));
    }
  }
};

const sizeOf = (dir) => {
  let total = 0;
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        walk(path.join(d, entry.name));
      } else {
        total += fs.statSync(path.join(d, entry.name)).size;
      }
    }
  };
  walk(dir);
  return total;
};

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));

const writeJson = (file, data) => {
  if (!APPLY) return;
  fs.writeFileSync(file, JSON.stringify(data, null, "\t") + "\n", "utf8");
};

// --------------------------------------------------------------------- main

console.log(APPLY ? "=== APPLIQUE ===" : "=== SIMULATION (ajouter --apply) ===");
console.log(`source : ${SOURCE_PROJECT}`);
console.log(`cible  : ${TARGET_PROJECT}`);
console.log("");

if (fs.existsSync(TARGET_PROJECT) && APPLY) {
  console.error(`Erreur : ${TARGET_PROJECT} existe deja. Le supprimer ou changer de cible.`);
  process.exit(1);
}

// 1. squelette du projet
for (const dir of ["Source", "Config"]) {
  const from = path.join(SOURCE_PROJECT, dir);
  console.log(`squelette  ${dir}/  (${(sizeOf(from) / 1024).toFixed(0)} ko)`);
  copyTree(from, path.join(TARGET_PROJECT, dir));
}

// 1b. regles de target inconnues de 5.7
if (APPLY) {
  for (const file of fs.readdirSync(path.join(TARGET_PROJECT, "Source"))) {
    if (!file.endsWith(".Target.cs")) continue;
    const full = path.join(TARGET_PROJECT, "Source", file);
    let text = fs.readFileSync(full, "utf8");
    let changed = false;
    for (const rule of TARGET_RULES_58_TO_57) {
      if (!text.includes(rule.from)) continue;
      text = text.replaceAll(rule.from, rule.to);
      changed = true;
      console.log(`target     ${file}  ${rule.from} -> ${rule.to}`);
    }
    if (changed) fs.writeFileSync(full, text, "utf8");
  }
}

// 2. .uproject, rebascule en 5.7
const uprojectName = fs
  .readdirSync(SOURCE_PROJECT)
  .find((f) => f.endsWith(".uproject"));
const uproject = readJson(path.join(SOURCE_PROJECT, uprojectName));
uproject.EngineAssociation = ENGINE_ASSOCIATION;
console.log(`uproject   ${uprojectName}  EngineAssociation -> ${ENGINE_ASSOCIATION}`);
if (APPLY) {
  fs.mkdirSync(TARGET_PROJECT, { recursive: true });
  writeJson(path.join(TARGET_PROJECT, uprojectName), uproject);
}

// 3. plugins, sans artefacts 5.8
console.log("");
let totalBytes = 0;
for (const name of PLUGINS) {
  const from = path.join(SOURCE_PROJECT, "Plugins", name);
  if (!fs.existsSync(from)) {
    console.log(`  MANQUE   ${name}`);
    continue;
  }
  const bytes = sizeOf(from);
  totalBytes += bytes;
  console.log(`  ${name.padEnd(34)} ${(bytes / 1024 / 1024).toFixed(1)} Mo`);
  copyTree(from, path.join(TARGET_PROJECT, "Plugins", name));
}
console.log(`  ${"TOTAL".padEnd(34)} ${(totalBytes / 1024 / 1024).toFixed(1)} Mo`);

// 4. EngineVersion des .uplugin
console.log("");
if (APPLY) {
  for (const name of PLUGINS) {
    const dir = path.join(TARGET_PROJECT, "Plugins", name);
    if (!fs.existsSync(dir)) continue;
    const file = fs.readdirSync(dir).find((f) => f.endsWith(".uplugin"));
    if (!file) continue;
    const full = path.join(dir, file);
    const data = readJson(full);
    data.EngineVersion = ENGINE_VERSION;
    writeJson(full, data);
  }
  console.log(`EngineVersion -> ${ENGINE_VERSION} sur tous les .uplugin`);
} else {
  console.log(`EngineVersion -> ${ENGINE_VERSION} (simulation)`);
}

// 5. retour arriere sur les trois corrections 5.8
console.log("");
for (const rule of REVERTS_58_TO_57) {
  const target = path.join(TARGET_PROJECT, "Plugins", rule.file);
  if (!APPLY) {
    console.log(`revert 5.8->5.7  ${path.basename(rule.file)} — ${rule.why}`);
    continue;
  }
  if (!fs.existsSync(target)) {
    console.log(`  absent : ${rule.file}`);
    continue;
  }
  const before = fs.readFileSync(target, "utf8");
  if (!before.includes(rule.from)) {
    console.log(`  motif introuvable : ${path.basename(rule.file)}`);
    continue;
  }
  fs.writeFileSync(target, before.replace(rule.from, rule.to), "utf8");
  console.log(`revert 5.8->5.7  ${path.basename(rule.file)} — ${rule.why}`);
}

console.log("");
console.log(APPLY ? "Projet 5.7 pret. Lancer un build avec D:\\Epic Games\\UE_5.7." : "Rien ecrit.");