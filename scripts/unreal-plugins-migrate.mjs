#!/usr/bin/env node
/**
 * Migre les sources C++ Unreal de `_vendor_sources/scriptC++/` vers le dossier
 * Plugins/ d'un projet Unreal, en reconstituant un plugin valide pour chaque.
 *
 * Trois formes existent cote source, et une seule est directement deplacable :
 *
 *   A `plugin`   — possede deja un .uplugin        -> deplacement direct
 *   B `module1`  — un module nu (Build.cs a la racine)
 *                                                  -> X/Source/X/ + X.uplugin
 *   C `multi`    — plusieurs modules cote a cote   -> X/Source/<modules>/ + X.uplugin
 *   D `source`   — possede deja un Source/         -> X.uplugin seulement
 *
 * Unreal ignore en silence un dossier de Plugins/ sans .uplugin : sans cette
 * enveloppe, un simple deplacement ne chargerait rien.
 *
 * Par defaut le script ne fait que simuler. `--apply` execute reellement.
 *
 * Usage :
 *   node scripts/unreal-plugins-migrate.mjs
 *   node scripts/unreal-plugins-migrate.mjs --apply
 */

import fs from "node:fs";
import path from "node:path";

const SOURCE_ROOT =
  "E:/narvosprime-web-prototype/WebPortal/src/rpg/_vendor_sources/scriptC++";
const TARGET_ROOT = "C:/Users/aniss/Documents/TPSModelUE57_01 5.8/Plugins";
const ENGINE_VERSION = "5.8.0";

const APPLY = process.argv.includes("--apply");

// Dossiers dont une copie identique existe deja cote projet : les deplacer
// ecraserait la version buildee et utilisee par l'editeur.
const DUPLICATES = new Set(["UniGLB", "Nanimation"]);

// ------------------------------------------------------------------ helpers

const listDirs = (dir) =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);

const listFiles = (dir) => {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile())
      .map((e) => e.name);
  } catch {
    return [];
  }
};

const hasBuildCs = (dir) => listFiles(dir).some((f) => f.endsWith(".Build.cs"));

const moduleNamesIn = (dir) =>
  listDirs(dir).filter((sub) => {
    const inner = path.join(dir, sub);
    // Un module = un dossier contenant son .Build.cs, directement ou dans un
    // sous-dossier de meme nom (les deux conventions existent dans ces packs).
    return hasBuildCs(inner) || hasBuildCs(path.join(inner, sub));
  });

/** Type et phase de chargement deduits du nom du module. */
const moduleEntry = (name) => {
  const isEditor = /Editor(Plugin)?$/.test(name);
  return {
    Name: name,
    Type: isEditor ? "Editor" : "Runtime",
    LoadingPhase: isEditor ? "PostEngineInit" : "Default",
  };
};

const upluginBody = (pluginName, modules) => ({
  FileVersion: 3,
  Version: 1,
  VersionName: "1.0",
  FriendlyName: pluginName,
  Description: `Source C++ importee depuis NARVOS PRIME (_vendor_sources/scriptC++/${pluginName}).`,
  Category: "NARVOS",
  CreatedBy: "",
  CreatedByURL: "",
  DocsURL: "",
  MarketplaceURL: "",
  SupportURL: "",
  CanContainContent: true,
  IsBetaVersion: false,
  IsExperimentalVersion: false,
  Installed: false,
  EngineVersion: ENGINE_VERSION,
  Modules: modules.map(moduleEntry),
});

// ---------------------------------------------------------------- classement

const classify = (name) => {
  const dir = path.join(SOURCE_ROOT, name);
  const files = listFiles(dir);

  const uplugin = files.find((f) => f.endsWith(".uplugin"));
  if (uplugin) return { form: "A:plugin", dir, uplugin, modules: [] };

  if (hasBuildCs(dir)) return { form: "B:module1", dir, modules: [name] };

  if (fs.existsSync(path.join(dir, "Source")))
    return { form: "D:source", dir, modules: moduleNamesIn(path.join(dir, "Source")) };

  return { form: "C:multi", dir, modules: moduleNamesIn(dir) };
};

// ------------------------------------------------------------------- actions

const log = [];
const record = (name, action, detail) => log.push({ name, action, detail });

/**
 * Deplace `from` vers `to`. rename() echoue entre volumes differents
 * (D: -> C:), on retombe alors sur une copie recursive suivie d'une suppression.
 */
const movePath = (from, to) => {
  if (!APPLY) return;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  try {
    fs.renameSync(from, to);
  } catch (err) {
    if (err.code !== "EXDEV") throw err;
    fs.cpSync(from, to, { recursive: true });
    fs.rmSync(from, { recursive: true, force: true });
  }
};

const writeUplugin = (dest, pluginName, modules) => {
  const file = path.join(dest, `${pluginName}.uplugin`);
  if (!APPLY) return file;
  fs.writeFileSync(file, JSON.stringify(upluginBody(pluginName, modules), null, "\t") + "\n", "utf8");
  return file;
};

/** Force EngineVersion a 5.8.0 et remplace les champs deprecies. */
const normalizeUplugin = (file) => {
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, "utf8");
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return "JSON invalide, laisse tel quel";
  }

  const changes = [];
  if (data.EngineVersion !== ENGINE_VERSION) {
    changes.push(`EngineVersion ${data.EngineVersion ?? "(absent)"} -> ${ENGINE_VERSION}`);
    data.EngineVersion = ENGINE_VERSION;
  }
  for (const mod of data.Modules || []) {
    // Renommes en UE5 ; UBT les ignore silencieusement sous l'ancien nom.
    for (const [old, next] of [
      ["WhitelistPlatforms", "PlatformAllowList"],
      ["BlacklistPlatforms", "PlatformDenyList"],
    ]) {
      if (mod[old]) {
        mod[next] = mod[old];
        delete mod[old];
        changes.push(`${mod.Name}: ${old} -> ${next}`);
      }
    }
  }

  if (changes.length && APPLY)
    fs.writeFileSync(file, JSON.stringify(data, null, "\t") + "\n", "utf8");
  return changes.length ? changes.join(" | ") : "deja conforme";
};

// ---------------------------------------------------------------------- main

if (!fs.existsSync(TARGET_ROOT))
  throw new Error(`Dossier Plugins introuvable : ${TARGET_ROOT}`);

for (const name of listDirs(SOURCE_ROOT)) {
  const dest = path.join(TARGET_ROOT, name);

  if (DUPLICATES.has(name)) {
    record(name, "IGNORE", "copie identique deja presente dans le projet");
    continue;
  }
  if (fs.existsSync(dest)) {
    record(name, "IGNORE", `collision non prevue : ${dest} existe deja`);
    continue;
  }

  const info = classify(name);

  if (info.form === "A:plugin") {
    movePath(info.dir, dest);
    const note = APPLY ? normalizeUplugin(path.join(dest, info.uplugin)) : "(simulation)";
    record(name, "MOVE", `plugin complet -> ${note}`);
    continue;
  }

  if (info.form === "D:source") {
    movePath(info.dir, dest);
    writeUplugin(dest, name, info.modules);
    record(name, "MOVE+UPLUGIN", `Source/ existant, ${info.modules.length} module(s)`);
    continue;
  }

  if (info.form === "B:module1") {
    // Le dossier EST le module : il devient X/Source/X/.
    movePath(info.dir, path.join(dest, "Source", name));
    writeUplugin(dest, name, [name]);
    record(name, "WRAP+UPLUGIN", `module unique -> Source/${name}/`);
    continue;
  }

  // C:multi — chaque sous-dossier module glisse sous Source/.
  if (info.modules.length === 0) {
    record(name, "IGNORE", "aucun module detecte (pas de .Build.cs)");
    continue;
  }
  for (const mod of info.modules)
    movePath(path.join(info.dir, mod), path.join(dest, "Source", mod));
  // Ce qui reste a la racine (Content, Resources, docs) suit le plugin.
  if (APPLY)
    for (const leftover of fs.readdirSync(info.dir))
      movePath(path.join(info.dir, leftover), path.join(dest, leftover));
  writeUplugin(dest, name, info.modules);
  record(name, "WRAP+UPLUGIN", `${info.modules.length} modules -> Source/`);
}

// -------------------------------------------------------------------- sortie

console.log(APPLY ? "=== APPLIQUE ===" : "=== SIMULATION (ajouter --apply) ===");
console.log("");
for (const row of log)
  console.log(`${row.name.padEnd(34)} ${row.action.padEnd(14)} ${row.detail}`);

const tally = log.reduce((acc, r) => ({ ...acc, [r.action]: (acc[r.action] || 0) + 1 }), {});
console.log("");
console.log(
  Object.entries(tally)
    .map(([k, v]) => `${k}=${v}`)
    .join("  "),
);