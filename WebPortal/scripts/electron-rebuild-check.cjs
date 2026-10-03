/**
 * Rebuild conditionnel de better-sqlite3 pour Electron.
 * Évite le rebuild systématique si les binaires natifs existent déjà.
 * 
 * Usage: node scripts/electron-rebuild-check.cjs [--force]
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function checkBetterSqlite3() {
  // Vérifie si better-sqlite3 a déjà été compilé pour cette arch/plateforme
  try {
    const binding = require('better-sqlite3');
    // Si on arrive ici, le module est déjà fonctionnel
    const version = binding.constructor?.prototype?.constructor?.name;
    console.log('✅ better-sqlite3 déjà fonctionnel');
    return true;
  } catch {
    console.log('ℹ️ better-sqlite3 nécessite un rebuild');
    return false;
  }
}

function getNodeVersion() {
  try {
    const out = execSync('node -e "console.log(process.versions.node)"', { encoding: 'utf8' }).trim();
    return out;
  } catch {
    return null;
  }
}

function getElectronVersion() {
  try {
    const out = execSync('node -e "try{console.log(require(\'electron\'))}catch{console.log(\'?\')}"', { encoding: 'utf8' }).trim();
    return out;
  } catch {
    return null;
  }
}

async function main() {
  const force = process.argv.includes('--force');
  const electronVersion = getElectronVersion();

  console.log(`📦 Node.js  : ${getNodeVersion() || '?'}`);
  console.log(`⚡ Electron : ${electronVersion || '?'}`);

  if (!force && checkBetterSqlite3()) {
    console.log('✅ Rebuild ignoré — better-sqlite3 déjà compatible.');
    return;
  }

  console.log('🔨 Rebuild de better-sqlite3 pour Electron...');
  execSync(
    'node node_modules/@electron/rebuild/lib/cli.js -f -w better-sqlite3',
    { stdio: 'inherit', cwd: path.resolve(__dirname, '..') }
  );
  console.log('✅ Rebuild terminé');
}

main().catch((err) => {
  console.error('❌ Erreur:', err.message);
  process.exit(1);
});
