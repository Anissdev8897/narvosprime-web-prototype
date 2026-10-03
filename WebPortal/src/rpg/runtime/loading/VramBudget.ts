// ══════════════════════════════════════════════════════════════════════════════
// runtime/loading/VramBudget.ts — Budget VRAM avec seuil et dégradation
//
// Surveille l'utilisation VRAM estimée et décide si un nouveau chargement est
// possible. En cas de dépassement, force une dégradation de qualité (medium→low,
// low→abandon) ou reporte les assets non-critiques au prochain idle.
//
// Utilise `performance.memory` (Chrome) si disponible, sinon une estimation
// conservative basée sur le nombre d'assets chargés × taille moyenne.
// ══════════════════════════════════════════════════════════════════════════════

/** Seuils VRAM (en MB) — adaptés à une carte milieu de gamme (6–8 GB VRAM). */
const BUDGET: Record<string, number> = {
  /** Budget total max — au-delà, on refuse tout nouveau chargement lourd. */
  total: 2048,
  /** Seuil D'ALERTE — au-delà, on dégrade les nouveaux assets (med→low). */
  alert: 1536,
  /** Seuil CRITIQUE — on ne charge que les assets essentiels. */
  critical: 1792,
  /** Estimation taille moyenne d'un GLB de chunk. */
  avgChunkMB: 1.5,
  /** Estimation taille moyenne d'un GLB d'asset (perso/arme). */
  avgAssetMB: 3.5,
};

export interface VramStatus {
  /** Mémoire estimée utilisée (MB). */
  usedMB: number;
  /** Budget total (MB). */
  totalMB: number;
  /** Pourcentage d'utilisation. */
  percent: number;
  /** Niveau d'alerte. */
  level: "ok" | "alert" | "critical" | "full";
  /** Peut-on charger un asset de cette taille ? */
  canLoad(mb: number): boolean;
}

/** Compteur estimé d'assets chargés. */
let loadedCount = 0;
let totalEstimatedMB = 0;

/**
 * Récupère l'utilisation mémoire navigateur (Chrome-only).
 * Retourne null si l'API n'est pas disponible.
 */
function getBrowserMemoryMB(): number | null {
  try {
    const m = (performance as unknown as { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
    if (m) {
      return m.usedJSHeapSize / (1024 * 1024);
    }
  } catch { /* ignore */ }
  return null;
}

/** Tente de lire le budget GPU via l'extension WebGL. */
function getGpuMemoryMB(): number | null {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") as WebGL2RenderingContext | null;
    if (!gl) return null;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    if (!ext) return null;
    const renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string;
    // Détection GPU connue → budget adapté
    if (/intel/i.test(renderer) && /uhd|hd|iris/i.test(renderer)) return 2048; // iGPU ≈ 2 GB partagé
    if (/nvidia|geforce|rtx/i.test(renderer)) return 4096;    // GPU dédié ≈ 4+ GB
    if (/amd|radeon/i.test(renderer)) return 4096;
    if (/apple|m[1-4]/i.test(renderer)) return 3072;           // Apple Silicon
    return 2048; // fallback conservateur
  } catch {
    return null;
  }
}

/** Lit le VRAM max détectée ou retourne le défaut. */
export function getVramBudgetMB(): number {
  const gpu = getGpuMemoryMB();
  if (gpu) return Math.min(gpu, BUDGET.total);
  return BUDGET.total;
}

/**
 * Enregistre le chargement d'un asset dans le suivi VRAM.
 */
export function trackAssetLoaded(sizeMB: number): void {
  loadedCount++;
  totalEstimatedMB += sizeMB;
}

/**
 * Enregistre le déchargement d'un asset.
 */
export function trackAssetUnloaded(sizeMB: number): void {
  loadedCount = Math.max(0, loadedCount - 1);
  totalEstimatedMB = Math.max(0, totalEstimatedMB - sizeMB);
}

/** Estime la consommation VRAM actuelle. */
export function getEstimatedVRAM(): number {
  const browserMB = getBrowserMemoryMB();
  if (browserMB) {
    // Le heap JS n'est pas exactement la VRAM mais une approximation conservative
    return Math.max(browserMB * 0.6, totalEstimatedMB);
  }
  return totalEstimatedMB;
}

/**
 * Retourne le statut VRAM actuel et une fonction canLoad pour tester
 * si un asset de taille donnée peut être chargé.
 */
export function getVramStatus(): VramStatus {
  const usedMB = getEstimatedVRAM();
  const totalMB = getVramBudgetMB();
  const percent = Math.round((usedMB / Math.max(1, totalMB)) * 100);

  let level: VramStatus["level"] = "ok";
  if (usedMB >= totalMB) level = "full";
  else if (usedMB >= BUDGET.critical) level = "critical";
  else if (usedMB >= BUDGET.alert) level = "alert";

  return {
    usedMB: Math.round(usedMB),
    totalMB,
    percent,
    level,
    canLoad(mb: number): boolean {
      return usedMB + mb <= totalMB;
    },
  };
}

/** Taille estimée d'un asset par type de contenu. */
export function estimateAssetSize(url: string): number {
  if (/chunk/i.test(url)) return BUDGET.avgChunkMB;
  if (/ship|vaisseau/i.test(url)) return 5.0;
  if (/npc|pnj|personnage/i.test(url)) return 2.5;
  if (/weapon|arme|sword|epe/i.test(url)) return 1.0;
  if (/anim/i.test(url)) return 0.5;
  if (/avatar|wraith/i.test(url)) return 3.0;
  return BUDGET.avgAssetMB;
}

/**
 * Qualité recommandée selon le budget VRAM.
 * Retourne "high", "medium", ou "low".
 * En mode "high" → on ne dégrade pas ; en mode "alert" → on dégrade ;
 * en mode "critical" → on force low ; en mode "full" → on bloque.
 */
export function recommendedQuality(baseQuality: "high" | "medium" | "low"): "high" | "medium" | "low" | "block" {
  const vram = getVramStatus();
  if (vram.level === "full") return "block";
  if (vram.level === "critical") return "low";
  if (vram.level === "alert" && baseQuality === "high") return "medium";
  return baseQuality;
}

/** Remet les compteurs à zéro (tests). */
export function resetVramBudget(): void {
  loadedCount = 0;
  totalEstimatedMB = 0;
}
