const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function hasEmcmake() {
  try {
    execSync(process.platform === 'win32' ? 'where emcmake' : 'which emcmake', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

if (!hasEmcmake()) {
  console.log('\x1b[33m[WASM] emcmake introuvable — build WASM ignore. Installer Emscripten SDK pour activer.\x1b[0m');
  const wasmDir = path.join(__dirname, '..', 'public', 'wasm');
  if (fs.existsSync(path.join(wasmDir, 'narvos-engine.wasm'))) {
    console.log('[WASM] Binary existant dans public/wasm/ — utilise la version en cache.');
  }
  process.exit(0);
}

console.log('[WASM] emcmake detecte — lancement build C++...');
try {
  execSync('npm run build:wasm && npm run copy:wasm', {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..'),
  });
} catch (e) {
  console.error('\x1b[31m[WASM] Build echoue — lancement continue sans WASM.\x1b[0m');
}
