#!/usr/bin/env node
/**
 * Active ou desactive des plugins du projet Unreal en basculant
 * `EnabledByDefault` dans leur .uplugin.
 *
 * Les 16 plugins generes par unreal-plugins-migrate.mjs sont volontairement
 * desactives : 16 modules jamais compiles actives d'un coup empechent
 * l'editeur de demarrer des la premiere erreur. On les remonte par lots.
 *
 * Usage :
 *   node scripts/unreal-plugin-toggle.mjs list
 *   node scripts/unreal-plugin-toggle.mjs on  uAim NPCEyesSightPRO ...
 *   node scripts/unreal-plugin-toggle.mjs off uAim ...
 */

import fs from "node:fs";
import path from "node:path";

// Plusieurs projets coexistent (5.7 et 5.8) : la racine est surchargeable.
const PLUGINS_ROOT =
  process.env.UE_PLUGINS_ROOT ?? "C:/Users/aniss/Documents/NarvosUE57/Plugins";

/** Certains .uplugin livres par des marketplaces portent un BOM UTF-8. */
const readUplugin = (file) =>
  JSON.parse(fs.readFileSync(file, "utf8").replace(/^﻿/, ""));

const upluginOf = (name) => {
  const dir = path.join(PLUGINS_ROOT, name);
  if (!fs.existsSync(dir)) return null;
  const file = fs.readdirSync(dir).find((f) => f.endsWith(".uplugin"));
  return file ? path.join(dir, file) : null;
};

/** Absent vaut true cote UBT : un plugin projet est actif sauf mention contraire. */
const isEnabled = (data) => data.EnabledByDefault !== false;

const countModules = (name) => {
  const src = path.join(PLUGINS_ROOT, name, "Source");
  if (!fs.existsSync(src)) return 0;
  let total = 0;
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(path.join(dir, entry.name));
      else if (entry.name.endsWith(".cpp")) total++;
    }
  };
  walk(src);
  return total;
};

const list = () => {
  const rows = fs
    .readdirSync(PLUGINS_ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => {
      const file = upluginOf(e.name);
      if (!file) return { name: e.name, state: "?", cpp: 0 };
      const data = readUplugin(file);
      return { name: e.name, state: isEnabled(data) ? "ON" : "off", cpp: countModules(e.name) };
    })
    .sort((a, b) => a.cpp - b.cpp);

  for (const row of rows)
    console.log(`${row.state.padEnd(4)} ${String(row.cpp).padStart(4)} cpp  ${row.name}`);
};

const toggle = (names, enabled) => {
  for (const name of names) {
    const file = upluginOf(name);
    if (!file) {
      console.error(`introuvable : ${name}`);
      continue;
    }
    const data = readUplugin(file);
    data.EnabledByDefault = enabled;
    fs.writeFileSync(file, JSON.stringify(data, null, "\t") + "\n", "utf8");
    console.log(`${enabled ? "ON " : "off"} ${name}`);
  }
};

const [command, ...names] = process.argv.slice(2);
if (command === "list") list();
else if (command === "on") toggle(names, true);
else if (command === "off") toggle(names, false);
else {
  console.error("Usage : list | on <plugins...> | off <plugins...>");
  process.exit(1);
}