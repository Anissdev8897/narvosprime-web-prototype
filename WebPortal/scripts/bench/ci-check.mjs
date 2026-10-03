#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════════
// scripts/bench/ci-check.mjs — Point d'entrée CI pour les benchmarks
//
// Usage :
//   node scripts/bench/ci-check.mjs           # Vérification CI complète
//
// S'utilise dans GitHub Actions / GitLab CI / etc. :
//   bench: node scripts/bench/ci-check.mjs
//
// Comportement :
//   1. Lance tous les benchmarks
//   2. Compare avec la baseline de la branche main
//   3. Exit 0 si tout est OK, exit 1 si régression > 5%
// ══════════════════════════════════════════════════════════════════════════════

import { spawnSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BENCH_DIR = __dirname;
const DATA_DIR = join(BENCH_DIR, 'data');
const PROJECT_ROOT = join(BENCH_DIR, '..', '..');

// ── Notification Slack/Webhook (optionnelle) ─────────────────────────────────

async function sendNotification(message, webhookUrl) {
  if (!webhookUrl) return;
  try {
    const https = (await import('https'));
    const data = JSON.stringify({ text: message });
    const url = new URL(webhookUrl);
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': data.length },
    });
    req.write(data);
    req.end();
  } catch (err) {
    console.error(`  ! Notification failed: ${err.message}`);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const isPR = args.includes('--pr') || !!process.env.GITHUB_HEAD_REF;

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║   NARVOS PRIME — CI Benchmark Check                         ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  // Métadonnées CI
  const ciInfo = {
    commit: process.env.GITHUB_SHA || process.env.CI_COMMIT_SHA || 'unknown',
    branch: process.env.GITHUB_HEAD_REF || process.env.CI_COMMIT_BRANCH || 'unknown',
    pr: process.env.GITHUB_PR_NUMBER || process.env.CI_MERGE_REQUEST_IID || null,
    runId: process.env.GITHUB_RUN_ID || process.env.CI_JOB_ID || 'unknown',
    runner: process.env.RUNNER_NAME || process.env.HOSTNAME || 'unknown',
    eventName: process.env.GITHUB_EVENT_NAME || 'manual',
  };

  console.log(`  Commit:    ${ciInfo.commit}`);
  console.log(`  Branche:   ${ciInfo.branch}`);
  console.log(`  PR:        ${ciInfo.pr || '—'}`);
  console.log(`  Runner:    ${ciInfo.runner}`);
  console.log('');

  // 1. Baseline branch
  const targetBranch = isPR
    ? (process.env.GITHUB_BASE_REF || 'main')
    : 'main';

  console.log(`  Target branch for baseline: ${targetBranch}`);
  console.log('');

  // 2. Générer le répertoire de sortie
  const outputDir = join(BENCH_DIR, 'ci-output');
  mkdirSync(outputDir, { recursive: true });

  // 3. Lancer les benchmarks
  console.log('  Lancement des benchmarks...\n');
  const result = spawnSync('node', [
    join(BENCH_DIR, 'bench.mjs'),
    '--ci',
    '--out', outputDir,
  ], {
    cwd: PROJECT_ROOT,
    stdio: 'inherit',
    timeout: 300000, // 5 min
    shell: true,
  });

  if (result.status === 1) {
    // Les benchmarks ont détecté des régressions
    console.log('');
    console.log('  ❌ CI CHECK FAILED — Régressions détectées.');
    console.log('');

    // Lire le rapport pour notification
    const reportPath = join(outputDir, 'bench-report.json');
    if (existsSync(reportPath)) {
      const report = JSON.parse(readFileSync(reportPath, 'utf-8'));
      if (report.trending) {
        const regressions = Object.entries(report.trending)
          .filter(([_, t]) => t.changePercent > 5);
        const msgLines = [
          `⚠️ *Benchmark régressions détectées* — ${ciInfo.branch}`,
          `Commit: \`${ciInfo.commit?.substring(0, 8)}\``,
          '',
        ];
        for (const [name, t] of regressions.slice(0, 10)) {
          msgLines.push(`• ${name}: +${t.changePercent.toFixed(2)}%`);
        }
        await sendNotification(msgLines.join('\n'), process.env.BENCH_SLACK_WEBHOOK);
      }
    }

    process.exit(1);
  } else if (result.status === 0) {
    console.log('');
    console.log('  ✅ CI CHECK PASSED');
    console.log('');

    // Copier le rapport dans l'historique global
    const srcReport = join(outputDir, 'bench-report.json');
    if (existsSync(srcReport)) {
      // Sauvegarder comme baseline si on est sur main
      if (ciInfo.branch === 'main' || ciInfo.branch === 'master') {
        mkdirSync(DATA_DIR, { recursive: true });
        copyFileSync(
          srcReport,
          join(DATA_DIR, `baseline-${targetBranch}.json`)
        );
        console.log(`  ✓ Baseline mise à jour pour ${targetBranch}`);
      }
    }

    process.exit(0);
  } else {
    // Erreur d'exécution
    console.log(`  ❌ CI CHECK ERROR — Exit code ${result.status}`);
    process.exit(result.status);
  }
}

main().catch(err => {
  console.error('Erreur fatale:', err);
  process.exit(1);
});
