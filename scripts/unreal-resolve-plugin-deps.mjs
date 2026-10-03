#!/usr/bin/env node
/**
 * Trouve les plugins MOTEUR dont dependent nos plugins, et les active.
 *
 * Un module peut compiler sans que son plugin soit active : UBT resout les
 * headers via les chemins d'include, alors que le chargement de la DLL exige
 * que le plugin fournisseur soit monte. D'ou des "Missing import:
 * UnrealEditor-Mover.dll" au demarrage sur un build parfaitement vert.
 *
 * Le script lit les .Build.cs de nos plugins, releve les modules dont ils
 * dependent, cherche quel plugin moteur declare chacun de ces modules, et
 * ajoute les plugins manquants au .uproject.
 *
 * Simulation par defaut ; `--apply` ecrit le .uproject.
 *
 * Usage :
 *   node scripts/unreal-resolve-plugin-deps.mjs <projet.uproject> <racine-moteur> [--apply]
 */

import fs from "node:fs";
import path from "node:path";

const [uprojectPath, engineRoot] = process.argv.slice(2);
const APPLY = process.argv.includes("--apply");

if (!uprojectPath || !engineRoot) {
  console.error(
    "Usage : node scripts/unreal-resolve-plugin-deps.mjs <projet.uproject> <racine-moteur> [--apply]",
  );
  process.exit(1);
}

const projectDir = path.dirname(uprojectPath);
const readJson = (f) => JSON.parse(fs.readFileSync(f, "utf8").replace(/^﻿/, ""));

const walk = (dir, acc = []) => {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (entry.name === "Intermediate" || entry.name === "Binaries") continue;
      walk(path.join(dir, entry.name), acc);
    } else acc.push(path.join(dir, entry.name));
  }
  return acc;
};

// --- 1. modules dont nos plugins dependent -----------------------------------

const wanted = new Set();
for (const file of walk(path.join(projectDir, "Plugins"))) {
  if (!file.endsWith(".Build.cs")) continue;
  const text = fs.readFileSync(file, "utf8");
  // Les listes sont ecrites en C#, sur plusieurs lignes, avec commentaires.
  // On releve tout litteral de chaine des blocs *DependencyModuleNames.
  for (const block of text.matchAll(
    /(?:Public|Private)DependencyModuleNames\s*\.\s*(?:AddRange|Add)\s*\(([\s\S]*?)\)\s*;/g,
  )) {
    for (const literal of block[1].matchAll(/"([A-Za-z0-9_]+)"/g)) wanted.add(literal[1]);
  }
}

// --- 2. quel plugin moteur declare chaque module ------------------------------

const moduleToPlugin = new Map();
for (const file of walk(path.join(engineRoot, "Plugins"))) {
  if (!file.endsWith(".uplugin")) continue;
  let data;
  try {
    data = readJson(file);
  } catch {
    continue;
  }
  const pluginName = path.basename(file, ".uplugin");
  for (const mod of data.Modules || []) {
    if (!moduleToPlugin.has(mod.Name)) moduleToPlugin.set(mod.Name, pluginName);
  }
}

// --- 3. difference avec ce que le .uproject active deja -----------------------

const uproject = readJson(uprojectPath);
uproject.Plugins ||= [];
const enabled = new Set(
  uproject.Plugins.filter((p) => p.Enabled !== false).map((p) => p.Name),
);

const needed = new Map(); // plugin -> modules qui l'exigent
for (const mod of [...wanted].sort()) {
  const plugin = moduleToPlugin.get(mod);
  if (!plugin || enabled.has(plugin)) continue;
  if (!needed.has(plugin)) needed.set(plugin, []);
  needed.get(plugin).push(mod);
}

console.log(`modules requis par nos plugins : ${wanted.size}`);
console.log(`modules fournis par des plugins moteur : ${moduleToPlugin.size}`);
console.log("");

if (needed.size === 0) {
  console.log("Aucun plugin moteur manquant.");
  process.exit(0);
}

for (const [plugin, mods] of [...needed].sort()) {
  console.log(`  ${plugin.padEnd(34)} <- ${mods.join(", ")}`);
}

if (!APPLY) {
  console.log("");
  console.log("SIMULATION — ajouter --apply pour ecrire le .uproject");
  process.exit(0);
}

for (const plugin of needed.keys()) {
  const existing = uproject.Plugins.find((p) => p.Name === plugin);
  if (existing) existing.Enabled = true;
  else uproject.Plugins.push({ Name: plugin, Enabled: true });
}
uproject.Plugins.sort((a, b) => a.Name.localeCompare(b.Name));

fs.writeFileSync(uprojectPath, JSON.stringify(uproject, null, "\t") + "\n", "utf8");
console.log("");
console.log(`${needed.size} plugin(s) active(s) dans ${path.basename(uprojectPath)}`);