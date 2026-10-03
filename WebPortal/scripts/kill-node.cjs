// scripts/kill-node.cjs — Nettoie les processus Node/Electron sur le port 3005
const { execSync } = require('child_process');
const myPid = process.pid;

try {
  // Trouve le PID qui écoute sur le port 3005
  const out = execSync('netstat -ano | findstr :3005 | findstr LISTENING', { encoding: 'utf8', stdio: 'pipe' });
  const lines = out.trim().split(/\r?\n/);
  for (const line of lines) {
    const pid = line.trim().split(/\s+/).pop();
    if (pid && parseInt(pid) !== myPid) {
      try { execSync(`taskkill -PID ${pid} -F`, { stdio: 'ignore' }); } catch {}
    }
  }
} catch {}
// Nettoie aussi les processus electron zombie
try { execSync('taskkill -F -IM electron.exe 2>nul', { stdio: 'ignore' }); } catch {}
console.log('[kill-node] Port 3005 libere');
