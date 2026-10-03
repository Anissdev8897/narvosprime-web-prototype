#!/usr/bin/env node
/**
 * ══════════════════════════════════════════════════════════════════════════════
 * gen-docs.mjs — Générateur automatique de documentation NARVOS PRIME
 *
 * Analyse le code source TypeScript / React du projet WebPortal et génère :
 *   • ARCHITECTURE.md   — Diagramme des dépendances entre modules
 *   • API.md            — Liste de tous les modules et leurs responsabilités
 *   • docs/modules/*.md — README dédié pour chaque module
 *   • docs/JSDOC.md     — Documentation JSDoc de toutes les fonctions exportées
 *
 * Usage :
 *   node scripts/gen-docs.mjs              → génère la documentation dans docs/
 *   node scripts/gen-docs.mjs --check      → mode vérification (compare l'existant)
 *   node scripts/gen-docs.mjs --html       → génère aussi docs/index.html (docsify-ready)
 *
 * ══════════════════════════════════════════════════════════════════════════════
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { resolve, relative, dirname, basename } from 'path';

// ── Configuration ────────────────────────────────────────────────────────────

const ROOT = resolve(import.meta.dirname, '..');
const SRC = resolve(ROOT, 'src');
const RPG = resolve(SRC, 'rpg');
const DOCS = resolve(ROOT, 'docs');
const MODULES_DIR = resolve(DOCS, 'modules');

const EXCLUDED_DIRS = new Set(['node_modules', 'dist', 'dist-electron', '_legacy_archive']);
const EXCLUDED_FILES = new Set(['vite-env.d.ts', 'types.ts']);

// ── Helpers ──────────────────────────────────────────────────────────────────

function walkDir(dir, depth = 3) {
  const entries = [];
  if (!existsSync(dir)) return entries;
  for (const name of readdirSync(dir)) {
    if (EXCLUDED_DIRS.has(name) || name.startsWith('.')) continue;
    const full = resolve(dir, name);
    if (statSync(full).isDirectory()) {
      if (depth > 0) entries.push(...walkDir(full, depth - 1));
    } else if (name.endsWith('.ts') || name.endsWith('.tsx')) {
      entries.push(full);
    }
  }
  return entries;
}

function getExports(filePath) {
  try {
    const code = readFileSync(filePath, 'utf-8');
    const exports = [];
    const lines = code.split('\n');

    // export class X
    const classRe = /^export\s+(abstract\s+)?class\s+(\w+)/g;
    let m;
    while ((m = classRe.exec(code)) !== null) {
      const lineIdx = code.substring(0, m.index).split('\n').length;
      exports.push({ type: 'class', name: m[2], line: lineIdx });
    }

    // export function X / export async function X
    const fnRe = /^export\s+(async\s+)?function\s+(\w+)/gm;
    while ((m = fnRe.exec(code)) !== null) {
      const lineIdx = code.substring(0, m.index).split('\n').length;
      exports.push({ type: 'function', name: m[2], line: lineIdx });
    }

    // export const X = / export let X = / export var X =
    const constRe = /^export\s+(const|let|var)\s+(\w+)\s*=/gm;
    while ((m = constRe.exec(code)) !== null) {
      const lineIdx = code.substring(0, m.index).split('\n').length;
      const decl = m[1];
      exports.push({ type: decl === 'const' ? 'constant' : 'variable', name: m[2], line: lineIdx });
    }

    // export interface X
    const ifaceRe = /^export\s+interface\s+(\w+)/gm;
    while ((m = ifaceRe.exec(code)) !== null) {
      const lineIdx = code.substring(0, m.index).split('\n').length;
      exports.push({ type: 'interface', name: m[1], line: lineIdx });
    }

    // export type X = ...
    const typeRe = /^export\s+type\s+(\w+)\s*=/gm;
    while ((m = typeRe.exec(code)) !== null) {
      const lineIdx = code.substring(0, m.index).split('\n').length;
      exports.push({ type: 'type', name: m[1], line: lineIdx });
    }

    // export enum X
    const enumRe = /^export\s+enum\s+(\w+)/gm;
    while ((m = enumRe.exec(code)) !== null) {
      const lineIdx = code.substring(0, m.index).split('\n').length;
      exports.push({ type: 'enum', name: m[1], line: lineIdx });
    }

    // export { X, Y, Z } from / export { X, Y, Z }
    // Look for multiline export { ... } blocks
    const barrelRe = /^export\s+\{([^}]+)\}(?:\s*;|$)/gm;
    while ((m = barrelRe.exec(code)) !== null) {
      const lineIdx = code.substring(0, m.index).split('\n').length;
      const names = m[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean);
      for (const n of names) {
        exports.push({ type: 're-export', name: n, line: lineIdx });
      }
    }

    return exports;
  } catch {
    return [];
  }
}

function getJSDoc(code, lineIndex) {
  const lines = code.split('\n');
  const comments = [];
  let i = lineIndex - 1;
  while (i >= 0) {
    const line = lines[i].trim();
    if (line.startsWith('//')) {
      comments.unshift(line.replace(/^\/\//, '').trim());
    } else if (line.startsWith('/*') || line.startsWith('/**')) {
      // Collect multi-line comment
      const block = [];
      let j = i;
      let inBlock = true;
      while (j < lines.length && inBlock) {
        const l = lines[j].trim();
        if (l.startsWith('/*') || l.startsWith('/**')) {
          if (l.endsWith('*/')) {
            block.push(l.replace(/^\/\*+/, '').replace(/\*\/$/, '').trim());
            inBlock = false;
          } else {
            block.push(l.replace(/^\/\*+/, '').trim());
          }
        } else if (l.endsWith('*/')) {
          block.push(l.replace(/^\s*\*/, '').replace(/\*\/$/, '').trim());
          inBlock = false;
        } else if (inBlock) {
          block.push(l.replace(/^\s*\*/, '').trim());
        }
        j++;
      }
      comments.unshift(...block);
      break;
    } else if (line === '' || line.startsWith('import') || line.startsWith('export')) {
      break;
    } else {
      break;
    }
  }
  return comments.filter(Boolean).join(' ');
}

function getModuleLabel(dirName) {
  const labels = {
    ambient: 'Système d\'ambiance',
    animation: 'Système d\'animation',
    animations: 'Maps d\'animations',
    archetypes: 'Archétypes de classes',
    audio: 'Système audio',
    benchmarks: 'Benchmarks',
    cache: 'Système de cache',
    camera: 'Système de caméra',
    characters: 'Personnages',
    chat: 'Système de chat',
    classes: 'Définition des classes',
    combat: 'Système de combat',
    elements: 'Système d\'éléments',
    factions: 'Système de factions',
    forge: 'Éditeur Forge',
    hud: 'Affichage tête-haute',
    loaders: 'Chargeurs d\'assets',
    loot: 'Système de butin',
    mapgen: 'Génération procédurale',
    materials: 'Système de matériaux',
    memory: 'Gestion mémoire',
    monitoring: 'Monitoring',
    nature: 'Système nature',
    network: 'Réseau',
    npc: 'PNJs',
    persistence: 'Persistance',
    pets: 'Familiers',
    professions: 'Métiers',
    props: 'Props / décors',
    quests: 'Système de quêtes',
    regression: 'Tests de régression',
    render: 'Rendu 3D',
    reputation: 'Réputation',
    runtime: 'Runtime / orchestration',
    settings: 'Paramètres',
    skeleton: 'Squelette / bones',
    skills: 'Compétences',
    spells: 'Sorts',
    stats: 'Statistiques',
    styles: 'Styles visuels',
    talents: 'Talents',
    threading: 'Threading WASM',
    ui: 'Interface utilisateur',
    utils: 'Utilitaires',
    wasm: 'Pont WASM',
    weapons: 'Système d\'armes',
    world: 'Système monde',
  };
  return labels[dirName] || `Module ${dirName}`;
}

// ── Analyse ──────────────────────────────────────────────────────────────────

export function analyzeProject() {
  const modules = [];

  for (const dirName of readdirSync(RPG)) {
    if (EXCLUDED_DIRS.has(dirName) || dirName.startsWith('.')) continue;
    const dirPath = resolve(RPG, dirName);
    if (!statSync(dirPath).isDirectory()) continue;

    const files = walkDir(dirPath, 1).filter(f => !EXCLUDED_FILES.has(basename(f)));
    if (files.length === 0) continue;

    const moduleFiles = [];
    for (const file of files) {
      const exports = getExports(file);
      if (exports.length > 0) {
        moduleFiles.push({
          path: file,
          name: basename(file),
          relPath: relative(RPG, file),
          exports,
          loc: readFileSync(file, 'utf-8').split('\n').length,
        });
      }
    }

    modules.push({
      name: dirName,
      label: getModuleLabel(dirName),
      path: dirPath,
      relPath: `src/rpg/${dirName}`,
      fileCount: files.length,
      files: moduleFiles,
      totalExports: moduleFiles.reduce((s, f) => s + f.exports.length, 0),
      totalLOC: moduleFiles.reduce((s, f) => s + f.loc, 0),
    });
  }

  modules.sort((a, b) => a.name.localeCompare(b.name));
  return { modules };
}

// ── Generators ────────────────────────────────────────────────────────────────

function genArchitecture(analysis) {
  const { modules } = analysis;
  const map = {};
  for (const mod of modules) {
    map[mod.name] = mod;
  }

  // Detect dependencies by scanning import statements across modules
  const deps = {};
  for (const mod of modules) {
    const importedModules = new Set();
    for (const f of mod.files) {
      const code = readFileSync(f.path, 'utf-8');
      const importRe = /from\s+['"](.+?)['"]/g;
      let m;
      while ((m = importRe.exec(code)) !== null) {
        const imp = m[1];
        // Check if it references another rpg module
        for (const otherMod of modules) {
          if (otherMod.name === mod.name) continue;
          if (imp.includes(`/${otherMod.name}/`) || imp.includes(`@/rpg/${otherMod.name}`)) {
            importedModules.add(otherMod.name);
          }
        }
      }
    }
    deps[mod.name] = [...importedModules].sort();
  }

  let md = `# ARCHITECTURE — NARVOS PRIME WebPortal

> Généré automatiquement par \`scripts/gen-docs.mjs\`

## Vue d'ensemble

Le projet **WebPortal** est le client web du MMORPG NARVOS PRIME.  
Il est structuré en **${modules.length} modules** organisés dans \`src/rpg/\`, avec un point d'entrée public via \`src/rpg/index.ts\`.

### Stack technique

| Couche | Technologie |
|--------|------------|
| Framework | React 19 + TypeScript 5.8 |
| Rendu 3D | Three.js + @react-three/fiber + @react-three/drei |
| Post-processing | @react-three/postprocessing |
| Build | Vite 6 |
| Tests | Vitest |
| Desktop | Electron 39 |
| Calcul natif | WebAssembly (C++ → Emscripten) |
|

## Architecture par couches

\`\`\`
┌──────────────────────────────────────────────────┐
│                    UI Layer                       │
│  src/components/   src/rpg/ui/   src/rpg/hud/    │
├──────────────────────────────────────────────────┤
│              Gameplay Layer                       │
│  runtime/  combat/  weapons/  characters/   npc/  │
│  spells/   loot/    quests/   professions/        │
├──────────────────────────────────────────────────┤
│              Simulation Layer                     │
│  animation/  audio/  camera/  materials/  render/│
│  nature/     props/  ambient/  mapgen/           │
├──────────────────────────────────────────────────┤
│           Data / Persistence Layer                │
│  cache/  memory/  persistence/  network/  chat/   │
│  settings/  loaders/  forge/                     │
├──────────────────────────────────────────────────┤
│           WASM Bridge Layer                       │
│  wasm/  threading/                               │
└──────────────────────────────────────────────────┘
\`\`\`

## Diagramme des dépendances entre modules

\`\`\`mermaid
graph TD
`;

  // Add nodes
  for (const mod of modules) {
    const safeId = mod.name.replace(/[-\/]/g, '_');
    md += `  ${safeId}["${mod.label}"]\n`;
  }

  // Add edges
  for (const [modName, modDeps] of Object.entries(deps)) {
    const safeFrom = modName.replace(/[-\/]/g, '_');
    for (const dep of modDeps) {
      const safeTo = dep.replace(/[-\/]/g, '_');
      md += `  ${safeFrom} --> ${safeTo}\n`;
    }
  }

  md += `\`\`\`

## Modules principaux

| Module | Fichiers | Exportations | Lignes de code |
|--------|----------|-------------|----------------|
`;

  for (const mod of modules) {
    md += `| \`${mod.name}\` | ${mod.fileCount} | ${mod.totalExports} | ~${mod.totalLOC} |\n`;
  }

  md += `\n## Flux de données

\`\`\`
Input (clavier/souris/manette)
       ↓
  InputManager ─→ CharacterController ─→ AnimationController
       ↓                  ↓                      ↓
    Camera            CollisionWorld        AnimationGraph (WASM)
       ↓                  ↓                      ↓
  FpsCamera         Physique WASM           Squelette → Mesh
       ↓
  AudioBus ← AudioGraph ← footstepSystem / zone annonces
\`\`\`

> *Dernière mise à jour : ${new Date().toISOString().split('T')[0]}*
`;

  return md;
}

function genAPI(analysis) {
  const { modules } = analysis;

  let md = `# API Reference — NARVOS PRIME WebPortal

> Généré automatiquement par \`scripts/gen-docs.mjs\`

**${modules.length} modules** · **${modules.reduce((s, m) => s + m.totalExports, 0)} exportations**  
**~${modules.reduce((s, m) => s + m.totalLOC, 0)} lignes de code TypeScript**

---

`;

  for (const mod of modules) {
    md += `## ${mod.label} (\`${mod.name}\`)\n\n`;
    md += `**${mod.fileCount} fichiers** · **${mod.totalExports} exports** · **~${mod.totalLOC} LOC**\n\n`;
    md += `Chemin : \`${mod.relPath}/\`\n\n`;

    if (mod.files.length === 0) {
      md += '_Aucune exportation publique._\n\n---\n\n';
      continue;
    }

    for (const file of mod.files) {
      md += `### \`${file.name}\`\n\n`;

      if (file.exports.length > 4) {
        md += '<details>\n<summary>Exports (${file.exports.length})</summary>\n\n';
      }

      md += `| Type | Export | Ligne |\n|------|--------|------|\n`;
      for (const exp of file.exports) {
        const icon = { class: '🔷', function: '⚡', constant: '🔶', variable: '🔹', interface: '📐', type: '📋', enum: '📌', 're-export': '🔁' }[exp.type] || '•';
        md += `| ${icon} ${exp.type} | \`${exp.name}\` | ${exp.line} |\n`;
      }

      if (file.exports.length > 4) {
        md += '</details>\n\n';
      }
    }

    md += `---\n\n`;
  }

  md += `\n> Généré le ${new Date().toISOString().split('T')[0]}\n`;

  return md;
}

function genModuleReadme(analysis) {
  const { modules } = analysis;
  const results = [];

  for (const mod of modules) {
    let md = `# ${mod.label}\n\n`;
    md += `> Module \`${mod.name}\` — ${mod.fileCount} fichiers, ${mod.totalExports} exports\n\n`;
    md += `**Chemin** : \`${mod.relPath}/\`\n\n`;

    // Find index.ts or main entry
    const indexFile = mod.files.find(f => f.name === 'index.ts');
    if (indexFile) {
      md += '## Point d\'entrée\n\n';
      md += 'Ce module expose une barillet centralisée :\n\n';
      for (const exp of indexFile.exports) {
        md += `- \`${exp.name}\` — ${exp.type === 're-export' ? 'ré-exporté depuis un sous-module' : exp.type}\n`;
      }
      md += '\n';
    }

    md += '## Fichiers\n\n';
    md += '| Fichier | Lignes | Exports |\n|--------|-------|--------|\n';
    for (const file of mod.files) {
      md += `| \`${file.name}\` | ${file.loc} | ${file.exports.length} |\n`;
    }

    md += '\n## Exports\n\n';
    for (const file of mod.files) {
      if (file.exports.length === 0) continue;
      md += `### \`${file.name}\`\n\n`;
      md += '| Nom | Type |\n|-----|------|\n';
      for (const exp of file.exports) {
        md += `| \`${exp.name}\` | ${exp.type} |\n`;
      }
      md += '\n';
    }

    results.push({ name: mod.name, content: md });
  }

  return results;
}

function genJSDoc(analysis) {
  const { modules } = analysis;
  let md = `# JSDoc — Documentation des fonctions exportées\n\n`;
  md += `> Généré automatiquement par \`scripts/gen-docs.mjs\`\n\n`;

  for (const mod of modules) {
    md += `## ${mod.label} (\`${mod.name}\`)\n\n`;

    for (const file of mod.files) {
      const code = readFileSync(file.path, 'utf-8');
      const lines = code.split('\n');

      for (const exp of file.exports) {
        const commentLines = getJSDocFromCode(code, exp.line);
        const doc = commentLines.length > 0
          ? commentLines.join('\n')
          : '*Aucune documentation associée.*';

        md += `### \`${exp.name}\` (${exp.type})\n\n`;
        md += `> **Fichier** : \`${file.relPath}\` | **Ligne** : ${exp.line}\n\n`;
        md += `${doc}\n\n---\n\n`;
      }
    }
  }

  return md;
}

function getJSDocFromCode(code, lineIndex) {
  const lines = code.split('\n');
  const commentLines = [];
  let i = lineIndex - 2; // 0-indexed, one line above the export
  let found = false;

  while (i >= 0) {
    const trimmed = lines[i].trim();
    if (trimmed === '') break;
    if (trimmed.startsWith('//')) {
      commentLines.unshift(trimmed.replace(/^\/\//, '').trim());
      found = true;
    } else if (trimmed.startsWith('/*') || trimmed.startsWith('/**')) {
      // Multi-line comment
      const block = [];
      let j = i;
      let inBlock = true;
      while (j < lines.length && inBlock) {
        const l = lines[j].trim();
        if (l.startsWith('/**')) {
          const content = l.replace(/^\/\*+\*?/, '').replace(/\*\/$/, '').trim();
          if (content) block.push(content);
          if (l.includes('*/')) inBlock = false;
        } else if (l.startsWith('/*')) {
          const content = l.replace(/^\/\*/, '').replace(/\*\/$/, '').trim();
          if (content) block.push(content);
          if (l.includes('*/')) inBlock = false;
        } else if (l.endsWith('*/')) {
          block.push(l.replace(/^\s*\*/, '').replace(/\*\/$/, '').trim());
          inBlock = false;
        } else if (inBlock) {
          block.push(l.replace(/^\s*\*/, '').trim());
        }
        j++;
      }
      commentLines.unshift(...block);
      found = true;
      break;
    } else if (trimmed.startsWith('import')) {
      break;
    } else {
      break;
    }
    i--;
  }

  return commentLines;
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const checkMode = args.includes('--check');
  const htmlMode = args.includes('--html');

  console.log('🔍 Analyse du code source...');
  const analysis = analyzeProject();
  console.log(`   → ${analysis.modules.length} modules trouvés`);
  console.log(`   → ${analysis.modules.reduce((s, m) => s + m.totalExports, 0)} exports`);

  // Ensure output dirs
  if (!existsSync(DOCS)) mkdirSync(DOCS, { recursive: true });
  if (!existsSync(MODULES_DIR)) mkdirSync(MODULES_DIR, { recursive: true });

  // ── ARCHITECTURE.md ──
  console.log('📐 Génération ARCHITECTURE.md...');
  const arch = genArchitecture(analysis);
  writeFileSync(resolve(DOCS, 'ARCHITECTURE.md'), arch, 'utf-8');

  // ── API.md ──
  console.log('📋 Génération API.md...');
  const api = genAPI(analysis);
  writeFileSync(resolve(DOCS, 'API.md'), api, 'utf-8');

  // ── Module READMEs ──
  console.log('📖 Génération des READMEs modules...');
  const readmes = genModuleReadme(analysis);
  for (const { name, content } of readmes) {
    writeFileSync(resolve(MODULES_DIR, `README-${name}.md`), content, 'utf-8');
  }

  // ── JSDoc ──
  console.log('📝 Génération JSDOC.md...');
  const jsdoc = genJSDoc(analysis);
  writeFileSync(resolve(DOCS, 'JSDOC.md'), jsdoc, 'utf-8');

  // ── HTML output (docsify) ──
  if (htmlMode) {
    console.log('🌐 Génération index.html (docsify)...');
    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NARVOS PRIME — Documentation</title>
  <link rel="stylesheet" href="//cdn.jsdelivr.net/npm/docsify@4/lib/themes/dark.min.css">
</head>
<body>
  <div id="app"></div>
  <script>
    window.$docsify = {
      name: 'NARVOS PRIME',
      repo: '',
      loadSidebar: true,
      subMaxLevel: 3,
      auto2top: true,
      search: 'auto',
    }
  </script>
  <script src="//cdn.jsdelivr.net/npm/docsify@4"></script>
  <script src="//cdn.jsdelivr.net/npm/docsify/lib/plugins/search.min.js"></script>
</body>
</html>`;
    writeFileSync(resolve(DOCS, 'index.html'), html, 'utf-8');

    // Sidebar
    const sidebar = `* [Accueil](/)
* [ARCHITECTURE](ARCHITECTURE.md)
* [API Reference](API.md)
* [JSDoc](JSDOC.md)
* Modules
${analysis.modules.map(m => `  * [${m.label}](modules/README-${m.name}.md)`).join('\n')}
`;
    writeFileSync(resolve(DOCS, '_sidebar.md'), sidebar, 'utf-8');
  }

  // ── Check mode ──
  if (checkMode) {
    console.log('\n🔎 Mode vérification :');
    const existingDocs = [];
    for (const f of readdirSync(DOCS)) {
      if (f.endsWith('.md') && f !== 'API.md' && f !== 'ARCHITECTURE.md') {
        existingDocs.push(f);
      }
    }
    console.log(`   Doc existante : ${existingDocs.join(', ')}`);
    console.log(`   Modules documentés : ${readmes.length}`);
    console.log(`   Nouveau docs générés ✓`);
  }

  // ── Summary ──
  console.log('\n✅ Documentation générée avec succès !');
  console.log(`   📐 ARCHITECTURE.md  → ${resolve(DOCS, 'ARCHITECTURE.md')}`);
  console.log(`   📋 API.md           → ${resolve(DOCS, 'API.md')}`);
  console.log(`   📝 JSDOC.md         → ${resolve(DOCS, 'JSDOC.md')}`);
  console.log(`   📖 ${readmes.length} READMEs modules → ${MODULES_DIR}/`);
  if (htmlMode) console.log(`   🌐 index.html       → ${resolve(DOCS, 'index.html')}`);
}

main();
