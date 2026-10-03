/**
 * Script d'installation et configuration de ccache pour WASM builds
 * Détection automatique et installation via scoop/choco si disponibles.
 * 
 * Usage: node scripts/setup-ccache.cjs [--install]
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function main() {
  const shouldInstall = process.argv.includes('--install');

  // 1. Vérifier si ccache est déjà disponible
  try {
    execSync('ccache --version', { stdio: 'pipe' });
    console.log('✅ ccache déjà installé');
    return;
  } catch {
    console.log('ℹ️ ccache non trouvé');
  }

  if (!shouldInstall) {
    console.log('ℹ️ Pour installer ccache : node scripts/setup-ccache.cjs --install');
    console.log('   Ou manuellement :');
    console.log('   - scoop install ccache');
    console.log('   - choco install ccache');
    console.log('   - https://ccache.dev/download.html');
    return;
  }

  // 2. Essayer scoop
  try {
    execSync('scoop install ccache', { stdio: 'inherit', timeout: 60000 });
    console.log('✅ ccache installé via scoop');
    return;
  } catch {
    console.log('ℹ️ scoop non disponible');
  }

  // 3. Essayer choco
  try {
    execSync('choco install ccache -y', { stdio: 'inherit', timeout: 120000 });
    console.log('✅ ccache installé via choco');
    return;
  } catch {
    console.log('ℹ️ choco non disponible');
  }

  console.error('❌ Impossible d\'installer ccache automatiquement.');
  console.error('   Installez-le manuellement depuis https://ccache.dev/download.html');
}

main().catch(console.error);
