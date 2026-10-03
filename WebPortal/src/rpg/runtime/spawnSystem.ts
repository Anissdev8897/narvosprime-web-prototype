// ══════════════════════════════════════════════════════════════════════════════
// runtime/spawnSystem.ts — Système de spawn robuste
//
// Quatre niveaux de résolution :
//   1. Point custom admin (spawnPointStore) avec validation getGroundY
//   2. Point par défaut de la map (SPAWN_CONFIGS)
//   3. Alternatives configurées (ex: Orbital : fixe + alternatif)
//   4. Random dans un rayon autour du point par défaut (5 tentatives)
//   5. Fallback au centre de la map
//
// Anti-spawn-kill : zone de protection inconditionnelle pendant
// SPAWN_PROTECTION_DURATION ms après chaque apparition.
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Un point d'apparition possible.
 * `position` : coordonnées (x, y, z) du spawn.
 * `yaw`      : orientation en radians (0 = regard vers -Z).
 * `label`    : nom lisible pour l'admin (optionnel).
 */
export interface SpawnPoint {
  position: [number, number, number];
  yaw?: number;
  label?: string;
}

/**
 * Configuration de spawn complète pour une map.
 */
export interface MapSpawnConfig {
  /** Point d'apparition principal. */
  default: SpawnPoint;
  /** Points alternatifs (tentés si le défaut est bloqué). */
  alternatives?: SpawnPoint[];
  /**
   * Rayon de recherche pour le spawn aléatoire (mètres).
   * Par défaut 5 m autour du point par défaut.
   */
  randomRadius?: number;
  /**
   * Centre de la map (= fallback ultime).
   * Par défaut (0, 5, 0).
   */
  center?: [number, number, number];
  /**
   * Durée de la protection anti-spawn-kill en ms.
   * Par défaut 5000 (5 s).
   */
  antiSpawnKillDuration?: number;
}

/**
 * Résultat d'une résolution de spawn.
 */
export interface SpawnResult {
  position: [number, number, number];
  yaw: number;
  /** Méthode utilisée pour obtenir ce point. */
  method: "default" | "alternative" | "random" | "fallback" | "custom";
  /** Label pour le debug. */
  label: string;
}

// ── Protection anti-spawn-kill ───────────────────────────────────────────────
/** Durée par défaut de l'immunité post-spawn (ms). */
export const SPAWN_PROTECTION_DURATION = 5000;
/** Durée minimale (ms). */
const SPAWN_PROTECTION_MIN = 1000;
/** Durée maximale (ms). */
const SPAWN_PROTECTION_MAX = 30000;

/**
 * Convertit une durée de protection en ms avec clamping.
 */
export function clampProtectionDuration(ms: number): number {
  return Math.max(SPAWN_PROTECTION_MIN, Math.min(SPAWN_PROTECTION_MAX, ms));
}

/**
 * Calcule le timestamp de fin de protection.
 * Retourne `performance.now() + duration` (ou la durée par défaut).
 */
export function spawnProtectionEnd(
  duration: number = SPAWN_PROTECTION_DURATION,
): number {
  return performance.now() + clampProtectionDuration(duration);
}

/**
 * Vrai si `timestamp` est dans le futur = protection active.
 */
export function isSpawnProtected(timestamp: number): boolean {
  return timestamp > performance.now();
}

// ── Configurations par map ───────────────────────────────────────────────────

export const SPAWN_CONFIGS: Record<string, MapSpawnConfig> = {
  // ── Forge ─────────────────────────────────────────────────────────────────
  // Sol mesuré au spawn à Y≈-27,8. Le point par défaut correspond aux anciennes
  // coordonnées MAP_SPAWN, avec une hauteur suffisante pour que CharacterController
  // le rattrape par gravité si la collision n'est pas encore chargée.
  forge: {
    default: {
      position: [0, -26, 10],
      yaw: 0,
      label: "Entrée centrale",
    },
    alternatives: [
      {
        position: [30, -26, 10],
        yaw: Math.PI,
        label: "Côté EST",
      },
      {
        position: [-30, -26, 10],
        yaw: 0,
        label: "Côté OUEST",
      },
    ],
    randomRadius: 8,
    center: [0, -20, 0],
    antiSpawnKillDuration: SPAWN_PROTECTION_DURATION,
  },

  // ── Orbital ───────────────────────────────────────────────────────────────
  // Hub spatial. Le contenu est vers x ≈ 700–7000. Deux points fixes :
  // entrée principale + quai secondaire.
  orbital: {
    default: {
      position: [1000, 50, 0],
      yaw: 0,
      label: "Entrée principale",
    },
    alternatives: [
      {
        position: [1050, 50, 30],
        yaw: Math.PI / 2,
        label: "Quai secondaire",
      },
    ],
    randomRadius: 10,
    center: [1000, 50, 0],
    antiSpawnKillDuration: SPAWN_PROTECTION_DURATION,
  },

  // ── Donjon Furiste ────────────────────────────────────────────────────────
  // Entrée du donjon. Le sol est à Y≈6. Le joueur apparaît face à l'arène
  // (centre en 0,0,0), regard vers -Z.
  donjon_furiste: {
    default: {
      position: [0, 6, 34],
      yaw: Math.PI, // regard vers l'arène (Z négatif)
      label: "Entrée du donjon",
    },
    randomRadius: 4,
    center: [0, 6, 0],
    antiSpawnKillDuration: 3000, // 3 s dans un donjon (plus intense)
  },

  // ── Tower ─────────────────────────────────────────────────────────────────
  // Map intermédiaire. Point fixe à l'entrée.
  tower: {
    default: {
      position: [0, 5, 10],
      yaw: 0,
      label: "Entrée de la tour",
    },
    randomRadius: 5,
    center: [0, 5, 0],
    antiSpawnKillDuration: SPAWN_PROTECTION_DURATION,
  },
};

/**
 * Récupère la configuration de spawn pour une map.
 * Retourne un objet par défaut si la map n'est pas listée.
 */
export function getSpawnConfig(mapId: string): MapSpawnConfig {
  return (
    SPAWN_CONFIGS[mapId] ?? {
      default: { position: [0, 5, 0], label: "Fallback" },
      center: [0, 5, 0],
      randomRadius: 5,
      antiSpawnKillDuration: SPAWN_PROTECTION_DURATION,
    }
  );
}

/**
 * Fonction de validation du sol (injectée par l'appelant).
 * Retourne la hauteur Y du sol à la position (x, z), ou null si non trouvé.
 */
export type GroundChecker = (x: number, z: number, fromY: number) => number | null;

/**
 * Résout le meilleur point d'apparition pour une map.
 *
 * Algorithme (par ordre de priorité) :
 *   1. Point CUSTOM (admin) → validé getGroundY → `custom`
 *   2. Point DÉFAUT de la map → validé getGroundY → `default`
 *   3. Points ALTERNATIFS → premier valide → `alternative`
 *   4. ALÉATOIRE dans `randomRadius` autour du défaut (5 tentatives) → `random`
 *   5. CENTRE de la map → `fallback`
 *
 * @param mapId        Identifiant de la map.
 * @param getGroundY   Fonction de mesure du sol (collisionWorld.getGroundY).
 *                     Si non fournie, on utilise les Y statiques des configs.
 * @param customPoint  Point custom (depuis spawnPointStore), ou null.
 * @returns Un objet SpawnResult avec position, yaw, méthode et label.
 */
export function resolveSpawn(
  mapId: string,
  getGroundY?: GroundChecker | null,
  customPoint?: [number, number, number] | null,
): SpawnResult {
  const config = getSpawnConfig(mapId);

  // ── 1. Point custom (admin) ────────────────────────────────────────────
  if (customPoint) {
    const [cx, cy, cz] = customPoint;
    if (getGroundY) {
      const gy = getGroundY(cx, cz, cy + 30);
      if (gy !== null) {
        return {
          position: [cx, gy + 0.5, cz],
          yaw: 0,
          method: "custom",
          label: "Point custom (admin)",
        };
      }
    } else {
      // Pas de getGroundY → on prend le Y tel quel
      return {
        position: [cx, cy, cz],
        yaw: 0,
        method: "custom",
        label: "Point custom (admin)",
      };
    }
  }

  // ── 2. Point par défaut ────────────────────────────────────────────────
  const def = config.default;
  const tryPoint = (
    pos: [number, number, number],
    yaw: number | undefined,
    method: SpawnResult["method"],
    label: string,
  ): SpawnResult | null => {
    if (getGroundY) {
      const gy = getGroundY(pos[0], pos[2], pos[1] + 30);
      if (gy !== null) {
        return {
          position: [pos[0], Math.max(pos[1], gy + 0.5), pos[2]],
          yaw: yaw ?? 0,
          method,
          label,
        };
      }
      return null; // sol non trouvé → on passe au suivant
    }
    // Pas de getGroundY → Y déclaratif
    return {
      position: [pos[0], pos[1], pos[2]],
      yaw: yaw ?? 0,
      method,
      label,
    };
  };

  const defResult = tryPoint(def.position, def.yaw, "default", def.label ?? "Défaut");
  if (defResult) return defResult;

  // ── 3. Points alternatifs ──────────────────────────────────────────────
  if (config.alternatives) {
    for (const alt of config.alternatives) {
      const altResult = tryPoint(alt.position, alt.yaw, "alternative", alt.label ?? "Alternatif");
      if (altResult) return altResult;
    }
  }

  // ── 4. Aléatoire dans un rayon ─────────────────────────────────────────
  const radius = config.randomRadius ?? 5;
  for (let i = 0; i < 5; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * radius;
    const rx = def.position[0] + Math.cos(angle) * dist;
    const rz = def.position[2] + Math.sin(angle) * dist;
    if (getGroundY) {
      const gy = getGroundY(rx, rz, def.position[1] + 30);
      if (gy !== null) {
        return {
          position: [rx, gy + 0.5, rz],
          yaw: def.yaw ?? 0,
          method: "random",
          label: "Aléatoire dans rayon",
        };
      }
    } else {
      return {
        position: [rx, def.position[1], rz],
        yaw: def.yaw ?? 0,
        method: "random",
        label: "Aléatoire dans rayon",
      };
    }
  }

  // ── 5. Fallback : centre de la map ─────────────────────────────────────
  const center = config.center ?? [0, 5, 0];
  if (getGroundY) {
    const gy = getGroundY(center[0], center[2], center[1] + 30);
    if (gy !== null) {
      return {
        position: [center[0], gy + 0.5, center[2]],
        yaw: 0,
        method: "fallback",
        label: "Centre de la map",
      };
    }
  }
  // Fallback ultime : Y déclaratif du centre
  return {
    position: center,
    yaw: 0,
    method: "fallback",
    label: "Fallback ultime",
  };
}

/**
 * Résout un spawn et retourne un tableau [x, y, z] compatible avec l'ancienne
 * API `mapSpawn`. Utilisé pour la rétrocompatibilité.
 *
 * La méthode de résolution est identique à `resolveSpawn`, mais on écrase
 * le Y statique par le Y du sol si getGroundY est fourni.
 */
export function resolveSpawnPosition(
  mapId: string,
  getGroundY?: GroundChecker | null,
  customPoint?: [number, number, number] | null,
): [number, number, number] {
  const result = resolveSpawn(mapId, getGroundY, customPoint);
  return result.position;
}
