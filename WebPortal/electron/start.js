/**
 * Script de démarrage simplifié pour Electron
 * Utilisé en développement pour lancer Electron avec Vite
 */

const { spawn } = require('child_process');
const path = require('path');

// Attendre que Vite soit prêt
const waitForServer = () => {
  return new Promise((resolve) => {
    const checkServer = () => {
      fetch('http://localhost:3005')
        .then(() => resolve())
        .catch(() => {
          setTimeout(checkServer, 500);
        });
    };
    checkServer();
  });
};

// Lancer Electron après que Vite soit prêt
waitForServer().then(() => {
  const electronPath = require('electron');
  const mainPath = path.join(__dirname, '../dist-electron/main.cjs');
  
  const electronProcess = spawn(electronPath, [mainPath], {
    stdio: 'inherit',
  });
  
  electronProcess.on('close', () => {
    process.exit(0);
  });
});