// ══════════════════════════════════════════════════════════════════════════════
// adk-setup-import.mjs — Prépare l'ADK nanos à recevoir nos GLB.
//
//   node scripts/adk-setup-import.mjs [--apply]
//
// POURQUOI : l'ADK est livré nu — aucun dossier `Plugins/`, un seul plugin
// activé (Water). Il ne sait donc pas lire un `.glb`. Ce script y installe la
// chaîne d'import qu'on a mise au point côté NarvosUE57, sans rien changer à ce
// que nanos impose.
//
// CE QU'IL FAIT :
//   1. copie UniGLB (1.0, contenu 5.7, patché cible Mannequin UE4 + headless)
//   2. active PythonScriptPlugin et EditorScriptingUtilities dans le .uproject
//   3. écrit Scripts/import_glb.py et son import_config.json
//
// CE QU'IL NE TOUCHE PAS : `Content/NanosWorld/`. Le README de l'ADK l'interdit
// — « do not MODIFY, DELETE, CREATE or COPY any file inside NanosWorld/ ». Toutes
// les références du pack doivent continuer à pointer dessus telles quelles.
//
// LE POINT QUI REND ÇA SIMPLE : UniGLB résout sa cible via une liste de chemins
// dont le premier est `/Game/NanosWorld/Characters/Mannequin/SK_Mannequin`. Ce
// mesh existe DÉJÀ dans l'ADK, et c'est le Mannequin UE4 (~68 os) que nanos
// exige. La topologie injectée à l'import étant lue sur ce mesh, un personnage
// importé sort directement au format nanos — aucun retarget intermédiaire.
//
// ⚠ AVANT DE COOKER : supprimer les `VA_*_VrmAssetList`. Ce sont des UObject de
// UniGLB ; un asset cooké qui les référence exigerait le plugin côté nanos, or
// UniGLB n'est PAS dans la whitelist. Les SkeletalMesh, matériaux et textures
// produits sont des types moteur natifs et passent sans lui.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";

const SOURCE_PROJECT = "C:/Users/aniss/Documents/nanos_world/asset/NarvosUE57";
const ADK = "C:/Users/aniss/Documents/nanos_world/asset/assets-development-kit-master";

// Nom unique imposé par la doc nanos : deux packs qui partagent un nom de
// dossier sous Content/ ne peuvent pas être chargés ensemble.
const PACK_NAME = "Narvos";

const APPLY = process.argv.includes("--apply");

// Artefacts liés à une version de moteur : jamais recopiés, UBT les régénère.
const SKIP_DIRS = new Set(["Binaries", "Intermediate", "DerivedDataCache", "Saved", ".vs"]);

const PLUGINS_REQUIS = ["PythonScriptPlugin", "EditorScriptingUtilities"];

// ─── utilitaires ──────────────────────────────────────────────────────────────

const lireJson = (f) => JSON.parse(fs.readFileSync(f, "utf8").replace(/^\uFEFF/, ""));

const ecrireJson = (f, data) => {
  if (!APPLY) return;
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(data, null, "\t") + "\n", "utf8");
};

const copier = (depuis, vers) => {
  if (!APPLY) return;
  fs.mkdirSync(vers, { recursive: true });
  for (const e of fs.readdirSync(depuis, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      copier(path.join(depuis, e.name), path.join(vers, e.name));
    } else {
      fs.copyFileSync(path.join(depuis, e.name), path.join(vers, e.name));
    }
  }
};

const poids = (dir) => {
  let total = 0;
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name)) continue;
        walk(path.join(d, e.name));
      } else total += fs.statSync(path.join(d, e.name)).size;
    }
  };
  walk(dir);
  return total;
};

// ─── 0. faire de l'ADK un projet C++ ──────────────────────────────────────────
//
// L'ADK est livré Blueprint-only : pas de `Source/`, aucun module déclaré. Un
// plugin C++ n'y compile donc pas — il n'existe aucune target à bâtir. On génère
// le module minimal qu'Unreal créerait lui-même à l'ajout d'une première classe.
//
// `BuildSettingsVersion.V6` et non V7 : V7 n'existe qu'à partir de 5.8, et
// l'ADK est en 5.7. Passer V7 échoue en CS0117 avant toute ligne de C++.

const NOM_MODULE = "NanosWorldADK";

const FICHIERS_MODULE = {
  [`Source/${NOM_MODULE}/${NOM_MODULE}.Build.cs`]: `using UnrealBuildTool;

public class ${NOM_MODULE} : ModuleRules
{
	public ${NOM_MODULE}(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

		PublicDependencyModuleNames.AddRange(
			new string[] { "Core", "CoreUObject", "Engine", "InputCore" });
	}
}
`,
  [`Source/${NOM_MODULE}/${NOM_MODULE}.h`]: `#pragma once

#include "CoreMinimal.h"
`,
  [`Source/${NOM_MODULE}/${NOM_MODULE}.cpp`]: `#include "${NOM_MODULE}.h"
#include "Modules/ModuleManager.h"

// Module de jeu vide : il n'existe que pour rendre le projet compilable, donc
// capable d'héberger un plugin C++. Aucun gameplay ici — le jeu nanos se code
// en Lua, ce projet ne sert qu'à produire des assets.
IMPLEMENT_PRIMARY_GAME_MODULE(FDefaultGameModuleImpl, ${NOM_MODULE}, "${NOM_MODULE}");
`,
  [`Source/${NOM_MODULE}.Target.cs`]: `using UnrealBuildTool;
using System.Collections.Generic;

public class ${NOM_MODULE}Target : TargetRules
{
	public ${NOM_MODULE}Target(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Game;
		DefaultBuildSettings = BuildSettingsVersion.V6;
		ExtraModuleNames.AddRange(new string[] { "${NOM_MODULE}" });
	}
}
`,
  [`Source/${NOM_MODULE}Editor.Target.cs`]: `using UnrealBuildTool;
using System.Collections.Generic;

public class ${NOM_MODULE}EditorTarget : TargetRules
{
	public ${NOM_MODULE}EditorTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Editor;
		DefaultBuildSettings = BuildSettingsVersion.V6;
		ExtraModuleNames.AddRange(new string[] { "${NOM_MODULE}" });
	}
}
`,
};

if (fs.existsSync(path.join(ADK, "Source"))) {
  console.log("module     Source/ déjà présent, rien à générer");
} else {
  for (const [relatif, contenu] of Object.entries(FICHIERS_MODULE)) {
    console.log(`module     ${relatif}`);
    if (APPLY) {
      const cible = path.join(ADK, relatif);
      fs.mkdirSync(path.dirname(cible), { recursive: true });
      fs.writeFileSync(cible, contenu, "utf8");
    }
  }
}

// ─── 1. UniGLB ────────────────────────────────────────────────────────────────

console.log(APPLY ? "=== APPLIQUÉ ===" : "=== SIMULATION (ajouter --apply) ===");
console.log(`ADK : ${ADK}`);
console.log("");

const uniglbSource = path.join(SOURCE_PROJECT, "Plugins", "UniGLB");
if (!fs.existsSync(uniglbSource)) {
  console.error(`UniGLB introuvable : ${uniglbSource}`);
  process.exit(1);
}
console.log(`plugin     UniGLB  (${(poids(uniglbSource) / 1024 / 1024).toFixed(0)} Mo, sans binaires)`);
copier(uniglbSource, path.join(ADK, "Plugins", "UniGLB"));

// ─── 2. .uproject ─────────────────────────────────────────────────────────────

const uprojectPath = path.join(ADK, "NanosWorldADK.uproject");
const uproject = lireJson(uprojectPath);

// Sans entrée Modules, UBT ne sait pas qu'il y a du C++ à bâtir : la target
// existe sur disque mais le projet reste considéré Blueprint-only.
uproject.Modules ||= [];
if (!uproject.Modules.some((m) => m.Name === NOM_MODULE)) {
  uproject.Modules.push({ Name: NOM_MODULE, Type: "Runtime", LoadingPhase: "Default" });
  console.log(`uproject   + module ${NOM_MODULE}`);
}

uproject.Plugins ||= [];
for (const nom of PLUGINS_REQUIS) {
  const existant = uproject.Plugins.find((p) => p.Name === nom);
  if (existant) existant.Enabled = true;
  else uproject.Plugins.push({ Name: nom, Enabled: true });
  console.log(`uproject   + ${nom}`);
}
ecrireJson(uprojectPath, uproject);

// ─── 3. structure du pack ─────────────────────────────────────────────────────

const CATEGORIES = ["Characters", "Animations", "Vehicles", "Weapons", "Props", "Environment"];
for (const c of CATEGORIES) {
  if (APPLY) fs.mkdirSync(path.join(ADK, "Content", PACK_NAME, c), { recursive: true });
}
console.log(`content    Content/${PACK_NAME}/ : ${CATEGORIES.join(", ")}`);

// ─── 4. scripts d'import ──────────────────────────────────────────────────────

const scriptSource = path.join(SOURCE_PROJECT, "Scripts", "import_glb.py");
if (fs.existsSync(scriptSource)) {
  if (APPLY) {
    fs.mkdirSync(path.join(ADK, "Scripts"), { recursive: true });
    fs.copyFileSync(scriptSource, path.join(ADK, "Scripts", "import_glb.py"));
  }
  console.log("scripts    import_glb.py");
} else {
  console.log(`scripts    MANQUE ${scriptSource}`);
}

// Le dossier ImportSources/ de l'ADK est une jonction vers celui de NarvosUE57 :
// les mêmes 1 043 GLB, sans duplication. `plugins` vide = tout importer.
ecrireJson(path.join(ADK, "Scripts", "import_config.json"), {
  plugins: [],
  limit_per_plugin: 0,
  destination: `/Game/${PACK_NAME}`,
});
console.log(`scripts    import_config.json  ->  /Game/${PACK_NAME}`);

console.log("");
if (!APPLY) {
  console.log("Rien écrit.");
} else {
  console.log("Prêt. Import sans interface :");
  console.log(
    `  UnrealEditor-Cmd.exe "${path.join(ADK, "NanosWorldADK.uproject")}" -run=pythonscript ^`,
  );
  console.log(`      -script="${path.join(ADK, "Scripts", "import_glb.py")}" -unattended -nosplash`);
}