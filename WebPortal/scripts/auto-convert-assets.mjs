// scripts/auto-convert-assets.mjs — CONVERSION AUTO des assets au démarrage (no-code).
//
// Flux (idempotent, rapide si rien à faire) :
//   1. Scanne public/models pour les .fbx/.obj SANS .glb voisin (= nouveaux dépôts).
//   2. Si aucun → ne lance PAS Blender (coût zéro), juste le ré-index.
//   3. Si trouvés → lance Blender headless (tools/convert_maps_to_glb.py) pour les convertir
//      en .glb (textures packées, même dossier), puis ré-indexe.
//   4. Blender introuvable → avertit et continue (le dev n'est pas bloqué).
//
// Branché sur `generate:assets` (predev) → `npm run dev` intègre tout nouveau modèle seul.
import { readdirSync, statSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const MODELS = join(process.cwd(), "public", "models");
// Skip-list : fichiers déjà tentés SANS produire de GLB (FBX d'anim sans mesh, exports vides).
// Évite de relancer Blender pour eux à chaque boot.
const SKIP_FILE = join(MODELS, ".noconvert.json");
function loadSkip() { try { return new Set(JSON.parse(readFileSync(SKIP_FILE, "utf8"))); } catch { return new Set(); } }
function saveSkip(set) { try { writeFileSync(SKIP_FILE, JSON.stringify([...set], null, 0)); } catch { /* ignore */ } }
const skip = loadSkip();
// Exclusions : sauvegardes/sources + packs d'ANIMATION (FBX sans mesh → jamais de GLB,
// sinon relance Blender à CHAQUE boot pour rien). Mêmes familles que build-model-index.
const EXCLUDE = /(^|[\\/])(_orig_chunks|node_modules|source|sources|textures|\.fbm|assets_character|Weapons|animation_[\w]+|creature_animation_melee|Great Sword Pack|Pro Magic Pack|Pro Sword and Shield Pack|Farming Pack|spells|voice_characters)([\\/]|$)/i;

/** Tous les .fbx/.obj dont le .glb voisin (même nom) n'existe pas encore. */
function findPending(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    // Carve-out : le dossier d'ÉQUIPEMENTS (assets_character/equipe) DOIT être converti
    // (sinon les FBX/OBJ d'équipement déposés là ne deviennent jamais des GLB).
    const isEquip = /assets_character[\\/]equipe/i.test(full);
    if (EXCLUDE.test(full) && !isEquip) continue;
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) { out.push(...findPending(full)); continue; }
    const m = /\.(fbx|obj)$/i.exec(name);
    if (!m) continue;
    const glb = full.slice(0, -m[0].length) + ".glb";
    if (!existsSync(glb) && !skip.has(full)) out.push(full); // pas déjà en échec connu
    // (le dossier d'ÉQUIPEMENTS assets_character/equipe est carve-out de EXCLUDE ci-dessous)
  }
  return out;
}

function findBlender() {
  if (process.env.BLENDER_PATH && existsSync(process.env.BLENDER_PATH)) return process.env.BLENDER_PATH;
  const candidates = [
    "C:/Program Files/Blender Foundation/Blender 4.5/blender.exe",
    "C:/Program Files/Blender Foundation/Blender 4.4/blender.exe",
    "C:/Program Files/Blender Foundation/Blender 4.3/blender.exe",
    "/Applications/Blender.app/Contents/MacOS/Blender",
    "/usr/bin/blender",
  ];
  return candidates.find((p) => existsSync(p)) ?? null;
}

function rebuildIndex() {
  const r = spawnSync(process.execPath, [join(process.cwd(), "scripts", "build-model-index.mjs")], { stdio: "inherit" });
  if (r.status !== 0) console.warn("[auto-convert] ré-index échoué");
}

if (!existsSync(MODELS)) {
  console.log("[auto-convert] public/models absent — skip");
  process.exit(0);
}

const pending = findPending(MODELS);
if (process.argv.includes("--dry")) {
  console.log(`[auto-convert] (dry) ${pending.length} en attente`);
  pending.slice(0, 15).forEach((p) => console.log("  " + p.replace(MODELS, "models")));
  process.exit(0);
}
if (pending.length === 0) {
  console.log("[auto-convert] aucun FBX/OBJ à convertir — ré-index seul");
  rebuildIndex();
  process.exit(0);
}

console.log(`[auto-convert] ${pending.length} fichier(s) source sans GLB → conversion…`);
const blender = findBlender();
if (!blender) {
  console.warn("[auto-convert] ⚠ Blender introuvable (définis BLENDER_PATH). Conversion SAUTÉE.");
  console.warn(`[auto-convert]   ${pending.slice(0, 5).map((p) => p.replace(MODELS, "models")).join("\n   ")}${pending.length > 5 ? "\n   …" : ""}`);
  rebuildIndex();
  process.exit(0);
}

// Convertit UNIQUEMENT les fichiers en attente (pas tout l'arbre → rapide, pas de re-traitement
// des anim). Si beaucoup (>40), passe le dossier racine (Blender saute les .glb à jour).
const py = join(process.cwd(), "tools", "convert_maps_to_glb.py");
const targets = pending.length > 40 ? [MODELS] : pending;
const conv = spawnSync(blender, ["-b", "-P", py, "--", ...targets], { stdio: "inherit" });
if (conv.status !== 0) console.warn("[auto-convert] ⚠ conversion Blender terminée avec erreurs");

// Les fichiers TOUJOURS sans GLB après tentative = échecs (mesh vide…) → skip-list (1 essai max).
for (const f of pending) {
  const glb = f.replace(/\.(fbx|obj)$/i, ".glb");
  if (!existsSync(glb)) skip.add(f);
}
saveSkip(skip);
rebuildIndex();
