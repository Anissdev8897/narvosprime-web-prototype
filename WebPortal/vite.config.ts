import fs from 'fs';
import path from 'path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Dossiers de `public/` SANS LESQUELS L'APPLICATION NE DÉMARRE PAS.
 *
 * `copyPublicDir: false` empêche Vite de recopier `public/` — indispensable, car
 * `public/models/` pèse 244,8 Go et le build devenait impraticable. Mais ces
 * trois dossiers-ci ne sont pas des assets de contenu : ce sont des DÉCODEURS,
 * chargés par URL au runtime, et ils totalisent 1,6 Mo.
 *
 *   draco/  décodeurs Draco servis en local (jamais le CDN Google — cf. CLAUDE.md).
 *           Absents → « No DRACOLoader instance provided » sur chaque GLB compressé.
 *   basis/  transcodeur KTX2. Absent → toutes les textures compressées échouent.
 *   wasm/   moteur NarvosEngine. Absent → `getEngine()` rend null en permanence
 *           (le jeu tourne en repli JS, mais silencieusement dégradé).
 */
const RUNTIME_DECODER_DIRS = ['draco', 'basis', 'wasm'] as const;

/**
 * Recopie les décodeurs dans `dist/` après le bundle.
 *
 * Volontairement BRUYANT : un décodeur manquant ne casse pas le build, il casse
 * le jeu au premier chargement d'asset — c'est-à-dire loin, et sans rapport
 * apparent avec la cause.
 */
function copyRuntimeDecoders(): Plugin {
  return {
    name: 'narvos-copy-runtime-decoders',
    apply: 'build',
    closeBundle() {
      for (const dir of RUNTIME_DECODER_DIRS) {
        const src = path.resolve(__dirname, 'public', dir);
        if (!fs.existsSync(src)) {
          this.warn(
            `[narvos] public/${dir}/ INTROUVABLE — le build ne contiendra pas ce décodeur. ` +
            `Les assets qui en dépendent échoueront au runtime.`,
          );
          continue;
        }
        fs.cpSync(src, path.resolve(__dirname, 'dist', dir), { recursive: true });
      }
    },
  };
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const isDev = mode === 'development';
    
    return {
      envDir: path.resolve(__dirname, '..'),   // lit le .env racine (expose VITE_*)
      // ── Chemins RELATIFS en production ────────────────────────────────────
      // Electron charge le build avec `loadFile(dist/index.html)` : l'origine
      // est `file://`. Un `src="/assets/index-xxx.js"` (le défaut de Vite) y
      // résout vers la RACINE DU DISQUE — `C:\assets\…` — et l'application ne
      // charge même pas son propre bundle. Mesuré sur le build du 02/08 : le
      // `dist/index.html` produit portait bien un chemin absolu.
      //
      // En dev on garde `/` : le serveur Vite sert depuis la racine et le HMR
      // s'appuie dessus.
      base: isDev ? '/' : './',
      server: {
        port: 3005,
        host: '127.0.0.1',
        strictPort: true,
        headers: {
          'Cross-Origin-Opener-Policy': 'same-origin',
          'Cross-Origin-Embedder-Policy': 'require-corp',
        },
      },
      plugins: [react(), copyRuntimeDecoders()],
      define: {
        // SECURITE: Les clés API ne doivent JAMAIS être exposées dans le bundle client.
        // Utiliser un proxy serveur pour les appels API nécessitant des clés.
        'process.env.NODE_ENV': JSON.stringify(mode),
        'process.env.APP_IS_PACKAGED': JSON.stringify(!isDev),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        outDir: 'dist',
        emptyOutDir: true,
        copyPublicDir: false,
      },
      optimizeDeps: {
        exclude: ['narvos-engine'],
      },
      assetsInclude: ['**/*.wasm'],
    };
});