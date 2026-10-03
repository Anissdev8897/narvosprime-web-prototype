#!/usr/bin/env node

/**
 * NARVOS PRIME — Test de régression automatisé (CI smoketest)
 *
 * Vérifie en séquence :
 *   1. Build (tsc + vite build) — doit passer
 *   2. Tests (vitest run) — doivent tous passer, count >= référence
 *   3. Assets GLB critiques — doivent exister sur disque
 *   4. TypeScript (tsc --noEmit) — pas de nouvelles erreurs
 *
 * Usage :  node scripts/regression-test.js [--ci] [--skip-build] [--skip-tests] [--skip-assets] [--skip-tsc]
 * Sortie : exit 0 si tout OK, exit 1 si échec.
 */

import { execSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ─── Chemins ─────────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");
const REPORT_PATH = resolve(ROOT, "regression-report.json");
const PUBLIC = resolve(ROOT, "public", "models");

// ─── Configuration ───────────────────────────────────────────────────────────
const CI = process.argv.includes("--ci");
const SKIP_BUILD = process.argv.includes("--skip-build");
const SKIP_TESTS = process.argv.includes("--skip-tests");
const SKIP_ASSETS = process.argv.includes("--skip-assets");
const SKIP_TSC = process.argv.includes("--skip-tsc");

const REFERENCE_TEST_COUNT = 1701; // Nb de tests attendu (référence — vérifié 2026-07-30)
const MIN_TEST_COUNT_TOLERANCE = 0.95; // accepte 95%+ de la référence

// ─── Assets GLB critiques à vérifier ─────────────────────────────────────────
// Liste issue de avatarAssets.ts + audit assets 2026-07-30.
// Chemins relatifs à public/models/
const CRITICAL_GLBS = [
  // ═══ Avatars joueur (Paragon) ═══
  "assets_character/wraith/Wraith.glb",
  "assets_character/murdock/Murdock.glb",
  "personnages/boris/Boris.glb",
  "assets_character/rampange/Rampage.glb",

  // ═══ Skins clés ═══
  "assets_character/wraith/Wraith_LunarOps.glb",
  "assets_character/murdock/Murdock_Shogun_GDC.glb",

  // ═══ Locomotion (UTA — marche/run directionnel) ═══
  "animations/uta_locomotion/AnimSeq_Traversal_Movement_Idle.glb",
  "animations/uta_locomotion/AnimSeq_Traversal_Movement_Sprint.glb",
  "animations/uta_locomotion/AnimSeq_Traversal_Movement_Walk_Forward.glb",
  "animations/uta_locomotion/AnimSeq_Traversal_Movement_Run_Forward.glb",

  // ═══ Locomotion (Bullet/MoCap) ═══
  "animations/MoCapCombatAnimations_DualCharacter/Demo/Characters/Mannequin_UE4/Animations/Jog_Fwd.glb",
  "animations/WW100IdleAnimPack/Animations/UE4/AS_StandUpright_Normal01_Loop01.glb",

  // ═══ Traversal (saut, escalade) ═══
  "animations/uta_locomotion/AnimSeq_Traversal_Movement_Jump_InPlace_Jump.glb",
  "animations/uta_locomotion/AnimSeq_Traversal_Wall_Climb_Up_LeftHand.glb",

  // ═══ Crouch ═══
  "animations/uta_locomotion/Anim_Crouch_Idle_Hip.glb",

  // ═══ Animations Wraith (combat) ═══
  "assets_character/wraith/animations/stripped/Ability_E.glb",

  // ═══ Maps — chunks critiques (forge + orbital) ═══
  "Maps/forge_map/chunks_v3/chunk_01.glb",
  "Maps/forge_map/chunks_v3/chunk_04.glb",
  "Maps/forge_map/chunks_v3/chunk_08.glb",
  "Maps/Orbital/chunks/chunk_01.glb",
  "Maps/Orbital/chunks/chunk_04.glb",
  "Maps/Orbital/chunks/chunk_08.glb",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Logger avec timestamp */
function log(level, msg) {
  const ts = new Date().toISOString().slice(11, 19);
  const prefix = { info: "ℹ", ok: "✅", warn: "⚠️", fail: "❌" }[level] || "•";
  const line = `[${ts}] ${prefix} ${msg}`;
  console.log(line);
  return line;
}

/** Exécute une commande, capture stdout/stderr, retourne { ok, stdout, stderr, code } */
function run(cmd, opts = {}) {
  const cwd = opts.cwd || ROOT;
  const env = { ...process.env, ...(opts.env || {}) };
  // Augmenter la mémoire Node pour le build
  if (!env.NODE_OPTIONS) env.NODE_OPTIONS = "--max-old-space-size=4096";

  log("info", `RUN: ${cmd}`);
  const start = Date.now();

  let result;
  try {
    result = execSync(cmd, {
      cwd,
      env,
      stdio: "pipe",
      timeout: opts.timeout || 300_000, // 5 min par défaut
      encoding: "utf-8",
      maxBuffer: 50 * 1024 * 1024, // 50 Mo
    });
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    log("ok", `OK (${elapsed}s)`);
    return { ok: true, stdout: result, stderr: "", code: 0 };
  } catch (err) {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    const stdout = err.stdout || "";
    const stderr = err.stderr || "";
    const code = err.status ?? 1;
    log("fail", `FAILED (${elapsed}s) — exit code ${code}`);
    if (stderr) log("fail", `STDERR (dernières lignes):\n${stderr.slice(-1000)}`);
    return { ok: false, stdout, stderr, code };
  }
}

/** Parse la sortie de vitest pour extraire le nombre de tests */
function parseVitestOutput(stdout) {
  // Supprimer les codes ANSI (couleurs) de vitest
  const clean = stdout.replace(/\x1b\[[0-9;]*m/g, "");

  // Patterns vitest (format réel) :
  //   "      Tests  1685 passed (1701)"                          — tout passe
  //   "      Tests  16 failed | 1685 passed (1701)"              — échecs
  //   " Test Files  154 passed (165)"
  //   " Test Files  11 failed | 154 passed (165)"
  const testsMatch = clean.match(/Tests\s+(\d+)\s+failed\s*\|\s*(\d+)\s+passed\s*\((\d+)\)/);
  const testsPassMatch = clean.match(/Tests\s+(\d+)\s+passed\s*\((\d+)\)/);
  const filesMatch = clean.match(/Test Files\s+(\d+)\s+failed\s*\|\s*(\d+)\s+passed\s*\((\d+)\)/);
  const filesPassMatch = clean.match(/Test Files\s+(\d+)\s+passed\s*\((\d+)\)/);

  // Toujours parser le pattern "failed | passed (total)" en priorité
  if (testsMatch) {
    return {
      passed: parseInt(testsMatch[2], 10),
      failed: parseInt(testsMatch[1], 10),
      total: parseInt(testsMatch[3], 10),
      filesPassed: filesMatch ? parseInt(filesMatch[2], 10) : (filesPassMatch ? parseInt(filesPassMatch[1], 10) : null),
      filesTotal: filesMatch ? parseInt(filesMatch[3], 10) : (filesPassMatch ? parseInt(filesPassMatch[2], 10) : null),
    };
  }
  if (testsPassMatch) {
    return {
      passed: parseInt(testsPassMatch[1], 10),
      failed: 0,
      total: parseInt(testsPassMatch[2], 10),
      filesPassed: filesPassMatch ? parseInt(filesPassMatch[1], 10) : null,
      filesTotal: filesPassMatch ? parseInt(filesPassMatch[2], 10) : null,
    };
  }
  return { passed: null, failed: null, total: null, filesPassed: null, filesTotal: null };
}

/** Vérifie l'existence d'un GLB sur disque */
function checkGlb(relativePath) {
  const full = resolve(PUBLIC, relativePath);
  const exists = existsSync(full);
  let sizeKb = null;
  let corrupt = false;

  if (exists) {
    try {
      const stat = readFileSync(full); // buffer brut pour la taille
      sizeKb = Math.round(stat.length / 1024);
      corrupt = stat.length < 200; // GLB corrompu si < 200 octets (cf audit)
    } catch {
      corrupt = true;
    }
  }

  return { path: relativePath, exists, sizeKb, corrupt };
}

/** Analyse la sortie de tsc --noEmit */
function parseTscOutput(stdout, stderr) {
  const combined = stdout + "\n" + stderr;
  const errors = combined.match(/error TS\d+/g) || [];
  const uniqueErrors = [...new Set(errors)];
  return {
    errorCount: errors.length,
    uniqueErrorCount: uniqueErrors.length,
    hasErrors: errors.length > 0,
  };
}

// ─── Rapport ─────────────────────────────────────────────────────────────────

const report = {
  timestamp: new Date().toISOString(),
  project: "NARVOS PRIME",
  results: {},
  summary: { passed: 0, failed: 0, skipped: 0, warnings: 0 },
};

function addResult(section, ok, details = {}) {
  report.results[section] = { ok, ...details };
  if (ok) {
    report.summary.passed++;
  } else {
    report.summary.failed++;
  }
  if (details.warnings) report.summary.warnings += details.warnings;
}

function saveReport() {
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), "utf-8");
  log("info", `Rapport sauvegardé → ${REPORT_PATH}`);
}

// ─── Étape 1 : Build ─────────────────────────────────────────────────────────

if (!SKIP_BUILD) {
  log("info", "━━━ ÉTAPE 1/4 : BUILD (tsc + vite build) ━━━");
  const build = run("npm run build", { timeout: 600_000 }); // 10 min
  addResult("build", build.ok, {
    exitCode: build.code,
    stderrTail: build.stderr ? build.stderr.slice(-300) : null,
  });

  if (!build.ok) {
    log("fail", "BUILD ÉCHOUÉ — pas la peine de continuer les étapes dépendantes.");
    // On continue quand même pour le rapport complet, mais on flag
  }
} else {
  log("info", "━━━ ÉTAPE 1/4 : BUILD — SKIPPÉ ━━━");
  report.summary.skipped++;
}

// ─── Étape 2 : Tests ─────────────────────────────────────────────────────────

if (!SKIP_TESTS) {
  log("info", "━━━ ÉTAPE 2/4 : TESTS (vitest run) ━━━");
  const test = run("npx vitest run", { timeout: 600_000 });

  // vitest écrit le résumé dans stdout en cas de succès, stderr en cas d'échec
  const parsed = parseVitestOutput(test.stdout + "\n" + test.stderr);
  const countOk = parsed.total !== null && parsed.total >= REFERENCE_TEST_COUNT * MIN_TEST_COUNT_TOLERANCE;
  const allPassed = parsed.failed === 0 && test.ok;

  addResult("tests", allPassed && countOk, {
    exitCode: test.code,
    passed: parsed.passed,
    failed: parsed.failed,
    total: parsed.total,
    referenceTotal: REFERENCE_TEST_COUNT,
    ratio: parsed.total !== null ? (parsed.total / REFERENCE_TEST_COUNT).toFixed(2) : null,
    countOk,
    filesPassed: parsed.filesPassed,
    filesTotal: parsed.filesTotal,
  });

  if (!test.ok) {
    log("fail", `Tests échoués : ${parsed.failed || "?"} failed / ${parsed.total || "?"} total`);
  } else if (!countOk) {
    log("warn", `Nombre de tests (${parsed.total}) sous le seuil de ${REFERENCE_TEST_COUNT} (tolérance ${Math.round((1 - MIN_TEST_COUNT_TOLERANCE) * 100)}%)`);
    report.results.tests.warnings = (report.results.tests.warnings || 0) + 1;
  } else {
    log("ok", `Tests OK : ${parsed.passed} passed / ${parsed.total} total (réf: ${REFERENCE_TEST_COUNT})`);
  }
} else {
  log("info", "━━━ ÉTAPE 2/4 : TESTS — SKIPPÉ ━━━");
  report.summary.skipped++;
}

// ─── Étape 3 : Assets GLB critiques ──────────────────────────────────────────

if (!SKIP_ASSETS) {
  log("info", `━━━ ÉTAPE 3/4 : ASSETS GLB (${CRITICAL_GLBS.length} fichiers) ━━━`);
  const results = CRITICAL_GLBS.map(checkGlb);

  const missing = results.filter((r) => !r.exists);
  const corrupt = results.filter((r) => r.corrupt);
  const ok = results.filter((r) => r.exists && !r.corrupt);

  for (const r of missing) {
    log("fail", `ABSENT : ${r.path}`);
  }
  for (const r of corrupt) {
    log("warn", `CORROMPU (${r.sizeKb} Ko) : ${r.path}`);
  }
  for (const r of ok) {
    log("ok", `OK (${r.sizeKb} Ko) : ${r.path}`);
  }

  const assetsOk = missing.length === 0 && corrupt.length === 0;
  addResult("assets", assetsOk, {
    total: results.length,
    present: ok.length,
    missing: missing.length,
    corrupt: corrupt.length,
    missingList: missing.map((r) => r.path),
    corruptList: corrupt.map((r) => r.path),
    warnings: corrupt.length,
  });
} else {
  log("info", "━━━ ÉTAPE 3/4 : ASSETS — SKIPPÉ ━━━");
  report.summary.skipped++;
}

// ─── Étape 4 : TypeScript (tsc --noEmit) ─────────────────────────────────────

if (!SKIP_TSC) {
  log("info", "━━━ ÉTAPE 4/4 : TYPESCRIPT (tsc --noEmit) ━━━");
  const tsc = run("npx tsc --noEmit", { timeout: 300_000 });

  const parsedTsc = parseTscOutput(tsc.stdout, tsc.stderr);
  addResult("typecheck", !parsedTsc.hasErrors, {
    exitCode: tsc.code,
    errorCount: parsedTsc.errorCount,
    uniqueErrorCount: parsedTsc.uniqueErrorCount,
  });

  if (parsedTsc.hasErrors) {
    log("fail", `TSC : ${parsedTsc.errorCount} erreurs (${parsedTsc.uniqueErrorCount} uniques)`);
  } else if (tsc.code !== 0) {
    // tsc peut exit 1 même sans erreurs explicites (warnings stricts)
    log("warn", `TSC exit ${tsc.code} mais pas d'erreurs TS détectées.`);
    report.results.typecheck.warnings = 1;
  } else {
    log("ok", "TSC : aucune erreur");
  }
} else {
  log("info", "━━━ ÉTAPE 4/4 : TYPESCRIPT — SKIPPÉ ━━━");
  report.summary.skipped++;
}

// ─── Rapport final ───────────────────────────────────────────────────────────
log("info", "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
log("info", "RÉSULTAT FINAL");

const failed = report.summary.failed;
const passed = report.summary.passed;
const skipped = report.summary.skipped;
const warnings = report.summary.warnings;

let exitCode = 0;

if (failed > 0) {
  log("fail", `${failed} étape(s) en échec, ${passed} OK, ${skipped} skip, ${warnings} warning(s)`);
  log("fail", "REGRESSION DÉTECTÉE — EXIT 1");
  exitCode = 1;
} else if (warnings > 0) {
  log("warn", `Toutes les étapes OK (${passed}/${passed + skipped}) mais ${warnings} warning(s)`);
  log("ok", "SMOKETEST PASSÉ AVEC WARNINGS — EXIT 0");
} else {
  log("ok", `Toutes les étapes OK (${passed}/${passed + skipped}) — EXIT 0`);
}

saveReport();

// Affichage compact du rapport
if (CI) {
  console.log("\n─── RAPPORT JSON (compact) ───");
  console.log(JSON.stringify(report, null, 0));
}

process.exit(exitCode);
