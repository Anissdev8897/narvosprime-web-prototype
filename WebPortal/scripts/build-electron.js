/**
 * Script de build pour compiler les fichiers Electron
 * Compile main.ts et preload.ts vers dist-electron/
 */

import { build } from 'esbuild';
import path from 'path';
import { existsSync, readdirSync, rmSync } from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUT_DIR = path.join(__dirname, '../dist-electron');

/**
 * Purge les sourcemaps orphelines.
 *
 * `sourcemap: false` ci-dessous n'EFFACE pas les `.map` d'un build antérieur —
 * il se contente de ne pas en écrire. Mesuré le 03/08/2026 : `main.cjs.map`
 * traînait avec quatre jours de retard, tout en étant listé dans les `files` du
 * packaging. Une sourcemap périmée fait pointer un débogueur sur du code qui
 * n'existe plus — pire qu'aucune sourcemap.
 */
const purgerSourcemaps = () => {
  if (!existsSync(OUT_DIR)) return;
  for (const f of readdirSync(OUT_DIR)) {
    if (!f.endsWith('.map')) continue;
    rmSync(path.join(OUT_DIR, f), { force: true });
    console.log(`🧹 Sourcemap périmée supprimée : ${f}`);
  }
};

const buildElectron = async () => {
  console.log('🔨 Compilation des fichiers Electron...');

  try {
    purgerSourcemaps();
    // Compiler main.ts (en .cjs pour éviter les conflits avec ES modules)
    // ✅ Inclut automatiquement database.ts via import
    await build({
      entryPoints: [path.join(__dirname, '../electron/main.ts')],
      bundle: true,
      platform: 'node',
      target: 'node18',
      outfile: path.join(__dirname, '../dist-electron/main.cjs'),
      external: ['electron', 'better-sqlite3', 'electron-updater'], // electron-updater est natif, ne pas bundler
      format: 'cjs',
      sourcemap: false, // Pas de sourcemaps en prod : -30% taille
      minify: true,    // Minifier : -35% taille du bundle
      treeShaking: true, // Elimination du code mort
    });

    console.log('✅ main.ts compilé (inclut database.ts)');

    // Compiler preload.ts (en .cjs pour éviter les conflits avec ES modules)
    await build({
      entryPoints: [path.join(__dirname, '../electron/preload.ts')],
      bundle: true,
      platform: 'node',
      target: 'node18',
      outfile: path.join(__dirname, '../dist-electron/preload.cjs'),
      external: ['electron'],
      format: 'cjs',
      sourcemap: false, // Pas de sourcemaps en prod
      minify: true,    // Minifier le preload
      treeShaking: true,
    });

    console.log('✅ preload.ts compilé');
    console.log('✅ Compilation Electron terminée');
  } catch (error) {
    console.error('❌ Erreur lors de la compilation Electron:', error);
    process.exit(1);
  }
};

buildElectron();

