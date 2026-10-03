/**
 * 🔐 Script de génération de certificats auto-signés pour le développement
 * NARVOS PRIME — Équipe RÉSEAU
 *
 * Génère une paire (certificat + clé) auto-signée pour TLS 1.3 en dev.
 * Utilise openssl (prérequis : installé sur le système).
 *
 * Usage :
 *   node scripts/generate-dev-certs.js [--dir=path] [--force]
 *
 *   --dir    Répertoire de sortie (défaut: <project>/certs)
 *   --force  Régénère même si le certificat existe déjà
 *
 * Sortie :
 *   certs/dev-cert.pem  — Certificat auto-signé (PEM)
 *   certs/dev-key.pem   — Clé privée (PEM)
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

// ── Parse args ──────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const outDir = args
  .find((a) => a.startsWith('--dir='))
  ?.split('=')[1] ?? join(ROOT, 'certs');
const force = args.includes('--force');

// ── Config ──────────────────────────────────────────────────────────────
const CERT_FILE = join(outDir, 'dev-cert.pem');
const KEY_FILE  = join(outDir, 'dev-key.pem');
const DAYS      = 365 * 2; // 2 ans

// ── Vérifier openssl ───────────────────────────────────────────────────
function checkOpenssl() {
  try {
    execSync('openssl version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// ── Générer les certificats ─────────────────────────────────────────────
function generate() {
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  const config = [
    '[req]',
    'distinguished_name = req_distinguished_name',
    'x509_extensions = v3_req',
    'prompt = no',
    '[req_distinguished_name]',
    'CN = localhost',
    'O = NARVOS PRIME Dev',
    'C = FR',
    '[v3_req]',
    'keyUsage = keyEncipherment, dataEncipherment, digitalSignature',
    'extendedKeyUsage = serverAuth',
    'subjectAltName = @alt_names',
    '[alt_names]',
    'DNS.1 = localhost',
    'IP.1 = 127.0.0.1',
  ].join('\n');

  const configFile = join(outDir, 'openssl-dev.cnf');
  writeFileSync(configFile, config, 'utf-8');

  const cmd = [
    'openssl req',
    '-x509',
    '-nodes',
    '-newkey rsa:2048',
    `-keyout "${KEY_FILE}"`,
    `-out "${CERT_FILE}"`,
    `-days ${DAYS}`,
    `-config "${configFile}"`,
    // TLS 1.3 compatible signature algorithm
    '-sha256',
  ].join(' ');

  console.log('🔐 Génération du certificat auto-signé…');
  execSync(cmd, { stdio: 'inherit', cwd: ROOT });

  // Nettoyer le fichier config temporaire
  try { execSync(`rm -f "${configFile}" 2>/dev/null; rm "${configFile.replace(/\\//g, '\\\\')}" 2>nul`, { stdio: 'ignore' }); } catch { /* ok */ }

  console.log(`✅ Certificat : ${CERT_FILE}`);
  console.log(`✅ Clé        : ${KEY_FILE}`);
  console.log('');
  console.log('📋 Pour utiliser WSS en dev :');
  console.log(`   Ajoutez dans votre .env :`);
  console.log(`     VITE_USE_WSS=true`);
  console.log(`     VITE_WSS_CERT="${CERT_FILE}"`);
  console.log(`     VITE_WSS_KEY="${KEY_FILE}"`);
  console.log('');
  console.log('⚠️  Certificat auto-signé — acceptez l\'exception de sécurité');
  console.log('   dans le navigateur (ou configurez Electron pour l\'accepter).');
}

// ── Main ────────────────────────────────────────────────────────────────
if (!checkOpenssl()) {
  console.error(
    '❌ openssl est requis mais introuvable.\n' +
    '   Installez-le via :\n' +
    '   • Windows : https://slproweb.com/products/Win32OpenSSL.html\n' +
    '   • macOS   : brew install openssl\n' +
    '   • Linux   : apt install openssl / yum install openssl'
  );
  process.exit(1);
}

if (!force && existsSync(CERT_FILE) && existsSync(KEY_FILE)) {
  console.log(`ℹ️  Les certificats existent déjà :`);
  console.log(`   ${CERT_FILE}`);
  console.log(`   ${KEY_FILE}`);
  console.log(`   Passez --force pour les régénérer.`);
  process.exit(0);
}

generate();
