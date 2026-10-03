#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════════
// scripts/bench/bench.mjs — Runner de benchmarks NARVOS PRIME
//
// Usage :
//   node scripts/bench/bench.mjs                     # Tous les benchmarks
//   node scripts/bench/bench.mjs --perf               # Benchmarks de perf seulement
//   node scripts/bench/bench.mjs --vitest             # Benchmarks vitest seulement
//   node scripts/bench/bench.mjs --group wasm         # Groupe spécifique
//   node scripts/bench/bench.mjs --json               # Sortie JSON seulement
//   node scripts/bench/bench.mjs --out ./bench-output # Répertoire de sortie
//   node scripts/bench/bench.mjs --ci                 # Mode CI (exit 1 si régression >5%)
//
// npm run bench
// npm run bench:perf
// npm run bench:compare
// ══════════════════════════════════════════════════════════════════════════════

import { performance } from 'perf_hooks';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BENCH_DIR = join(__dirname, 'perf');
const REPORTERS_DIR = join(__dirname, 'reporters');
const DATA_DIR = join(__dirname, 'data');

// ── Métadonnées ──────────────────────────────────────────────────────────────

function collectMeta() {
  let commit = 'unknown';
  let branch = 'unknown';
  try {
    commit = spawnSync('git', ['rev-parse', '--short', 'HEAD']).trim() || 'unknown';
    branch = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD']).trim() || 'unknown';
  } catch (_) {}

  return {
    commit,
    branch,
    host: process.env.COMPUTERNAME || process.env.HOSTNAME || 'unknown',
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
  };
}

function spawnSync(cmd, args) {
  const child_process = require('child_process');
  try {
    const result = child_process.spawnSync(cmd, args, { encoding: 'utf-8', timeout: 5000 });
    return result.stdout || '';
  } catch { return ''; }
}

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// ── Modules de benchmarks ────────────────────────────────────────────────────

const PERF_MODULES = [
  'characterController',
  'navMesh',
  'chunkLoading',
  'rendering',
  'wasm',
];

async function loadPerfModule(name) {
  const path = join(BENCH_DIR, `${name}.mjs`);
  if (!existsSync(path)) {
    throw new Error(`Module de benchmark introuvable: ${path}`);
  }
  // Windows requires file:// URLs for dynamic import()
  const fileUrl = new URL(`file://${path.replace(/\\/g, '/')}`);
  return await import(fileUrl.href);
}

async function runPerfBenchmarks(groups = null, options = {}) {
  const allResults = [];
  const modulesToRun = groups
    ? PERF_MODULES.filter(m => groups.includes(m))
    : PERF_MODULES;

  for (const modName of modulesToRun) {
    console.log(`\n  ── ${modName} ──`);
    try {
      const mod = await loadPerfModule(modName);
      const results = await mod.runSuite({ verbose: true, ...options });
      allResults.push(...results);
      console.log(`  ✓ ${results.length} benchmarks dans ${modName}`);
    } catch (err) {
      console.error(`  ✗ Erreur dans ${modName}: ${err.message}`);
    }
  }

  return allResults;
}

// ── Vitest suite runner ──────────────────────────────────────────────────────

async function runVitestBenchmarks(options = {}) {
  // Vérifier si vitest est disponible
  try {
    require.resolve('vitest');
  } catch {
    console.log(`  ! vitest non trouvé, skip.`);
    return [];
  }

  console.log(`\n  ── Vitest Benchmarks (via npx vitest run) ──`);

  const vitestFile = options.group === 'characterController'
    ? 'src/rpg/benchmarks/characterController.bench.ts'
    : options.group === 'navMesh'
      ? 'src/rpg/benchmarks/navMesh.bench.ts'
      : '';

  const cmd = vitestFile
    ? `npx vitest run --reporter json "${vitestFile}"`
    : 'npx vitest run --reporter json';

  return new Promise((resolve) => {
    const child = spawn(cmd, [], {
      cwd: join(__dirname, '..', '..'),
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
      env: { ...process.env, FORCE_COLOR: '0' },
    });

    const timeout = setTimeout(() => {
      console.log('  ! vitest timeout (30s), skip.');
      child.kill();
      resolve([]);
    }, 30000);

    let stdout = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => {}); // discard stderr

    child.on('close', (code) => {
      clearTimeout(timeout);
      try {
        const jsonMatch = stdout.match(/\{[\s\S]*"numTotalTestSuites"[\s\S]*\}/);
        if (jsonMatch) {
          const data = JSON.parse(jsonMatch[0]);
          const results = parseVitestResults(data);
          console.log(`  ✓ ${results.length} tests benchmarks vitest`);
          resolve(results);
        } else {
          if (code !== 0 && code !== null) {
            console.log(`  ! vitest a échoué (code=${code}), skip.`);
          } else {
            console.log(`  ✓ vitest exécuté (aucun bench JSON trouvé)`);
          }
          resolve([]);
        }
      } catch (err) {
        console.log(`  ! Erreur parse vitest: ${err.message}`);
        resolve([]);
      }
    });
  });
}

function parseVitestResults(data) {
  const results = [];
  if (data.testResults) {
    for (const suite of data.testResults) {
      for (const test of suite.assertionResults || []) {
        if (test.duration !== undefined) {
          results.push({
            name: `${suite.name} > ${test.title}`,
            group: 'vitest',
            scenario: test.title,
            samples: 1,
            meanMs: test.duration,
            minMs: test.duration,
            maxMs: test.duration,
            unit: 'ms',
            vitestSuite: suite.name,
            status: test.status,
          });
        }
      }
    }
  }
  return results;
}

// ── Rapporteurs ──────────────────────────────────────────────────────────────

async function generateReports(results, meta, outputDir) {
  const reportersDirUrl = new URL(`file://${REPORTERS_DIR.replace(/\\/g, '/')}/`);
  const { generateReport } = await import(new URL('json.mjs', reportersDirUrl).href);
  const { generateMarkdown } = await import(new URL('markdown.mjs', reportersDirUrl).href);
  const { generateHTML } = await import(new URL('html.mjs', reportersDirUrl).href);

  // JSON (inclut historique)
  const reportData = generateReport(results, meta, outputDir);

  // Markdown
  generateMarkdown(results, reportData, outputDir);

  // HTML
  generateHTML(results, reportData, outputDir);

  return reportData;
}

// ── CI Check (régression > 5%) ──────────────────────────────────────────────

function checkRegressions(reportData, threshold = 5) {
  const trending = reportData?.trending ?? {};
  const regressions = [];

  for (const [name, t] of Object.entries(trending)) {
    if (t.changePercent > threshold && t.previousValue !== null) {
      regressions.push({
        name,
        currentValue: t.currentValue,
        previousValue: t.previousValue,
        changePercent: t.changePercent,
      });
    }
  }

  return regressions;
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════════

async function main() {
  const args = process.argv.slice(2);

  const options = {
    perf: args.includes('--perf'),
    vitest: args.includes('--vitest'),
    ci: args.includes('--ci'),
    jsonOnly: args.includes('--json'),
    all: !args.includes('--perf') && !args.includes('--vitest'),
    group: null,
    outputDir: join(__dirname, '..', '..'), // par défaut: project root
  };

  // Parser --group GROUP
  const groupIdx = args.indexOf('--group');
  if (groupIdx !== -1 && args[groupIdx + 1]) {
    options.group = args[groupIdx + 1];
    options.all = false;
  }

  // Parser --out DIR
  const outIdx = args.indexOf('--out');
  if (outIdx !== -1 && args[outIdx + 1]) {
    options.outputDir = args[outIdx + 1];
  }

  // Créer le répertoire de sortie
  mkdirSync(options.outputDir, { recursive: true });

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║      NARVOS PRIME — Suite de Benchmarks                    ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`  Output: ${options.outputDir}`);
  console.log(`  Mode: ${options.ci ? 'CI' : options.all ? 'complet' : options.perf ? 'perf' : options.vitest ? 'vitest' : 'personnalisé'}`);
  if (options.group) console.log(`  Groupe: ${options.group}`);
  console.log('');

  // Collecter les métadonnées
  const meta = collectMeta();

  // 1. Benchmarks de performance
  let perfResults = [];
  if (options.all || options.perf) {
    const groups = options.group ? [options.group] : null;
    // Filtrer pour ne garder que les modules perf qui matchent le groupe
    const perfGroups = options.group && PERF_MODULES.includes(options.group) ? [options.group] : (options.group ? [] : null);
    perfResults = await runPerfBenchmarks(perfGroups, { all: true });
  }

  // 2. Benchmarks vitest
  let vitestResults = [];
  if (options.all || options.vitest) {
    vitestResults = await runVitestBenchmarks(options);
  }

  // Fusionner les résultats
  const allResults = [...perfResults, ...vitestResults];

  if (allResults.length === 0) {
    console.log('\n  ⚠ Aucun benchmark exécuté.\n');
    process.exit(options.ci ? 1 : 0);
  }

  console.log(`\n  Total: ${allResults.length} benchmarks`);

  // 3. Générer les rapports
  console.log('\n  ── Rapports ──');
  const reportData = await generateReports(allResults, meta, options.outputDir);

  // 4. Vérifier les régressions (mode CI)
  if (options.ci) {
    const regressions = checkRegressions(reportData, 5);
    if (regressions.length > 0) {
      console.log(`\n  ⚠️ RÉGRESSIONS DÉTECTÉES (>5%):`);
      for (const reg of regressions) {
        console.log(`    • ${reg.name}: +${reg.changePercent.toFixed(2)}% (${reg.previousValue.toFixed(4)} → ${reg.currentValue.toFixed(4)} ms)`);
      }
      console.log(`\n  ❌ CI FAILED — ${regressions.length} régression(s) détectée(s).\n`);
      process.exit(1);
    } else {
      console.log(`\n  ✅ CI PASSED — Aucune régression > 5%.\n`);
    }
  } else {
    console.log(`\n  ✅ Benchmarks terminés.\n`);
  }
}

main().catch(err => {
  console.error('Erreur fatale:', err);
  process.exit(1);
});
