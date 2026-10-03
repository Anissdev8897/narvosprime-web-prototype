// ══════════════════════════════════════════════════════════════════════════════
// scripts/convert-audio.mjs — Pipeline de compression audio WAV→MP3/AAC/Opus
//
// Stratégie :
//   • SFX (bruitage, UI, footsteps)           → MP3  (compatibilité max)
//   • Musique (boucles, thèmes)                → Opus dans container WebM
//   • Ambiance (boucles, fonds sonores)        → Opus
//   • Fichiers déjà en MP3/OGG                 → conservés (intacts)
//
// Comportement :
//   • Idempotent : ne reconvertit que les WAV dont le fichier cible
//     est absent ou plus ancien que le WAV source.
//   • Fallback silencieux : si un format cible échoue, on essaie
//     le suivant (MP3→AAC→Opus), et si tout échoue → pas de crash,
//     pas de console.error — juste un log debug en DEV.
//   • Tous les fichiers convertis atterrissent À CÔTÉ du fichier source,
//     dans le même dossier.
//
// Usage :
//   node scripts/convert-audio.mjs             ← convertit tout
//   node scripts/convert-audio.mjs --dry       ← montre ce qui serait fait
//   node scripts/convert-audio.mjs --force     ← reconvertit tout (ignore cache)
//   node scripts/convert-audio.mjs --fast      ← ne convertit que les fichiers
//                                                sans aucune sortie
// ══════════════════════════════════════════════════════════════════════════════

import { readdirSync, statSync, existsSync, mkdirSync } from "node:fs";
import { join, relative, dirname, extname, basename } from "node:path";
import { spawnSync } from "node:child_process";

// ── Configuration ─────────────────────────────────────────────────────────────

const AUDIO_ROOT = join(process.cwd(), "public", "models", "audio");
const FFMPEG_QUALITY = {
  mp3:  { codec: "libmp3lame", bitrate: "192k",  ext: ".mp3"  },
  aac:  { codec: "aac",        bitrate: "128k",  ext: ".aac"  },
  opus: { codec: "libopus",    bitrate: "96k",   ext: ".opus" },
  webm: { codec: "libopus",    bitrate: "96k",   ext: ".webm" },
};

// Catégories par dossier racine (patterns de nom de dossier)
// L'ORDRE compte — le premier pattern qui matche gagne.
// Les ambiances doivent être détectées AVANT le sfx générique.
const CATEGORY_MAP = [
  // Footsteps → MP3 (SFX, compat max)
  { pattern: /[Ff]ootstep/i,            target: "mp3" },
  // Ambiance → Opus (meilleur ratio qualité/taille)
  { pattern: /ambian/i,                 target: "opus" },
  // desert_map → MP3 (SFX)
  { pattern: /desert/i,                 target: "mp3" },
  // dojon → Opus (déjà en OGG pour la musique adaptative)
  { pattern: /dojon/i,                  target: "opus" },
  // Musique → Opus/WebM (meilleur ratio qualité/taille)
  { pattern: /music/i,                  target: "webm" },
  // Boutons, UI → MP3
  { pattern: /[Bb]utton/i,              target: "mp3" },
  // Transitions → MP3
  { pattern: /[Tt]ransition/i,          target: "mp3" },
  // Backgrounds → MP3
  { pattern: /[Bb]ackground/i,          target: "mp3" },
  // Glitch → MP3
  { pattern: /[Gg]litch/i,              target: "mp3" },
  // Loading → MP3
  { pattern: /[Ll]oading/i,             target: "mp3" },
  // Login → MP3
  { pattern: /login/i,                  target: "mp3" },
  // levelUP → MP3
  { pattern: /level/i,                  target: "mp3" },
  // map_game → MP3
  { pattern: /map_game/i,               target: "mp3" },
  // sfx_mouvement → MP3
  { pattern: /mouvement/i,              target: "mp3" },
  // SFX générique (doit être APRÈS les sous-catégories)
  { pattern: /sfx/i,                    target: "mp3" },
];

// Formats source supportés
const SOURCE_EXTS = [".wav", ".WAV"];

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Détermine le format cible pour un fichier selon son chemin. */
function detectTargetFormat(filePath) {
  for (const rule of CATEGORY_MAP) {
    if (rule.pattern.test(filePath)) return rule.target;
  }
  // Défaut : dossier inconnu → MP3 (compatibilité max)
  return "mp3";
}

/** Construit le chemin du fichier de sortie. */
function outputPath(inputPath, targetFormat) {
  const cfg = FFMPEG_QUALITY[targetFormat];
  return inputPath.replace(/\.\w+$/, cfg.ext);
}

/** Vérifie si ffmpeg est disponible. */
function findFfmpeg() {
  const r = spawnSync("ffmpeg", ["-version"], { stdio: "pipe" });
  return r.status === 0;
}

/** Vérifie si le fichier source est plus récent que la cible. */
function needsConversion(srcPath, dstPath) {
  if (!existsSync(dstPath)) return true;
  try {
    const srcMtime = statSync(srcPath).mtimeMs;
    const dstMtime = statSync(dstPath).mtimeMs;
    return srcMtime > dstMtime + 1000; // 1s de tolérance
  } catch {
    return true;
  }
}

/** Formatte la taille en humain. */
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Calcule la taille totale d'un tableau de fichiers. */
function totalSize(files) {
  return files.reduce((sum, f) => {
    try { return sum + statSync(f).size; } catch { return sum; }
  }, 0);
}

// ── Scan récursif ─────────────────────────────────────────────────────────────

function findAudioFiles(dir) {
  const results = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return results;
  }
  for (const name of entries) {
    const full = join(dir, name);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) {
      results.push(...findAudioFiles(full));
    } else {
      const ext = extname(name);
      if (SOURCE_EXTS.includes(ext)) {
        results.push(full);
      }
    }
  }
  return results;
}

// ── Conversion ────────────────────────────────────────────────────────────────

function convertFile(srcPath, targetFormat) {
  const dstPath = outputPath(srcPath, targetFormat);
  const cfg = FFMPEG_QUALITY[targetFormat];

  // S'assurer que le dossier de destination existe
  mkdirSync(dirname(dstPath), { recursive: true });

  const args = ["-y", "-i", srcPath];

  switch (targetFormat) {
    case "mp3":
      args.push("-c:a", cfg.codec, "-b:a", cfg.bitrate, "-q:a", "2");
      break;
    case "aac":
      args.push("-c:a", cfg.codec, "-b:a", cfg.bitrate);
      break;
    case "opus":
      args.push("-c:a", cfg.codec, "-b:a", cfg.bitrate, "-vbr", "on");
      break;
    case "webm":
      args.push("-c:a", cfg.codec, "-b:a", cfg.bitrate, "-vbr", "on");
      break;
  }

  // Silencieux : stderr redirigé, pas de logs de ffmpeg
  args.push("-loglevel", "error", dstPath);

  const r = spawnSync("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });

  if (r.status !== 0) {
    // Échec silencieux : pas de console.error
    // En DEV, un petit log discret
    if (process.env.DEV || process.argv.includes("--verbose")) {
      process.stderr.write(`  ⚠ Échec conversion: ${relative(AUDIO_ROOT, srcPath)} → ${targetFormat}\n`);
    }
    return false;
  }

  // Affiche la taille avant/après
  const srcSize = statSync(srcPath).size;
  const dstSize = statSync(dstPath).size;
  const ratio = srcSize > 0 ? ((1 - dstSize / srcSize) * 100).toFixed(0) : "?";
  console.log(`  ✓ ${relative(AUDIO_ROOT, srcPath)}`);
  console.log(`    ${formatSize(srcSize)} → ${formatSize(dstSize)} (-${ratio}%)`);

  return true;
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  if (!existsSync(AUDIO_ROOT)) {
    console.log("[convert-audio] public/models/audio/ absent — rien à faire.");
    process.exit(0);
  }

  if (!findFfmpeg()) {
    console.warn("[convert-audio] ⚠ ffmpeg introuvable. Installe FFmpeg (https://ffmpeg.org).\n"
      + "  Les fichiers WAV resteront en l'état — le navigateur ne les lira pas.");
    process.exit(0);
  }

  const isDry = process.argv.includes("--dry");
  const isForce = process.argv.includes("--force");
  const isFast = process.argv.includes("--fast");

  const allSources = findAudioFiles(AUDIO_ROOT);

  if (allSources.length === 0) {
    console.log("[convert-audio] aucun fichier source (.wav) trouvé.");
    process.exit(0);
  }

  console.log(`[convert-audio] ${allSources.length} fichier(s) WAV trouvé(s)`);

  // Si --fast, ne convertir que les fichiers sans AUCUNE sortie
  const toConvert = isFast
    ? allSources.filter((f) => {
        const target = detectTargetFormat(f);
        const dst = outputPath(f, target);
        return !existsSync(dst);
      })
    : isForce
      ? allSources
      : allSources.filter((f) => {
          const target = detectTargetFormat(f);
          const dst = outputPath(f, target);
          return needsConversion(f, dst);
        });

  if (toConvert.length === 0) {
    console.log("[convert-audio] tout est à jour — rien à convertir.");
    process.exit(0);
  }

  const srcTotal = totalSize(toConvert);
  console.log(`[convert-audio] ${toConvert.length} fichier(s) à convertir (${formatSize(srcTotal)})`);
  if (isDry) {
    for (const f of toConvert) {
      const target = detectTargetFormat(f);
      const dst = outputPath(f, target);
      console.log(`  ~ ${relative(AUDIO_ROOT, f)} → ${basename(dst)} (${target})`);
    }
    console.log(`[convert-audio] (dry) ${toConvert.length} conversions simulées.`);
    process.exit(0);
  }

  // Stats
  let success = 0;
  let fail = 0;
  let totalSrcBytes = 0;
  let totalDstBytes = 0;

  for (const f of toConvert) {
    const target = detectTargetFormat(f);
    const ok = convertFile(f, target);
    if (ok) {
      success++;
      try {
        totalSrcBytes += statSync(f).size;
        totalDstBytes += statSync(outputPath(f, target)).size;
      } catch {}
    } else {
      fail++;
      // Fallback silencieux : essayer un autre format
      const fallbackFormats = target === "mp3" ? ["aac", "opus"] :
                              target === "opus" ? ["mp3", "aac"] :
                              target === "webm" ? ["opus", "mp3"] :
                              ["mp3"];
      let fallbackOk = false;
      for (const fb of fallbackFormats) {
        if (convertFile(f, fb)) {
          fallbackOk = true;
          success++;
          try {
            totalSrcBytes += statSync(f).size;
            totalDstBytes += statSync(outputPath(f, fb)).size;
          } catch {}
          break;
        }
      }
      if (!fallbackOk) {
        fail++;
      }
    }
  }

  console.log("");
  if (success > 0) {
    const saved = ((1 - totalDstBytes / (totalSrcBytes || 1)) * 100).toFixed(1);
    console.log(
      `[convert-audio] ✅ ${success} fichier(s) convertis, ${fail} échec(s).\n`
      + `  Volume total : ${formatSize(totalSrcBytes)} → ${formatSize(totalDstBytes)} (économie ${saved}%)`
    );
  } else {
    console.log(`[convert-audio] ⚠ ${fail} échec(s) — aucun fichier converti.`);
  }

  if (fail > 0) {
    process.exitCode = 0; // pas de code d'erreur — fallback silencieux
  }
}

main();
