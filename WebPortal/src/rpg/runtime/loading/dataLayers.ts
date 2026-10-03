/**
 * DataLayers — système à 3 états pour le streaming de chunks (type Unreal Engine).
 *
 * 3 états :
 *   - Unloaded       : chunk non chargé (ni mémoire, ni GPU, ni scène)
 *   - PreWarm        : GLB parsé, textures uploadées GPU, collision active,
 *                      mais PAS dans la scène → 0 draw call, consommation VRAM
 *   - Activated      : visible dans la scène, rendu normal
 *
 * Fonctionnalités :
 *   - LRU tracking (dernière activation/frustum) pour éviction intelligente
 *   - Budget VRAM strict : refus de charger si dépassement
 *   - Éviction automatique par ordre LRU (prewarming d'abord)
 *   - Détermination du layer selon la distance joueur
 */

export type DataLayer = 'unloaded' | 'prewarming' | 'activated';

export interface DataLayerEntry {
  chunkId: number;
  layer: DataLayer;
  /** Timestamp (performance.now()) du dernier usage : activation ou frustum hit. */
  lastUsed: number;
  /** VRAM estimée en MB. */
  estimatedVRAM: number;
  /** Distance au joueur calculée à la dernière frame. */
  lastDistance: number;
}

// ── État interne ──────────────────────────────────────────────────────────

const _entries = new Map<number, DataLayerEntry>();
let _budgetMB = 3600;
let _totalVRAM = 0;

// ── API Publique ──────────────────────────────────────────────────────────

export function setBudget(mb: number): void {
  _budgetMB = mb;
}

export function getBudget(): number {
  return _budgetMB;
}

/** VRAM totale actuellement consommée par les chunks (prewarming + activated). */
export function getTotalVRAM(): number {
  return _totalVRAM;
}

/** État d'un chunk. */
export function getLayer(id: number): DataLayer {
  return _entries.get(id)?.layer ?? 'unloaded';
}

/** Enregistre ou met à jour l'état d'un chunk. */
export function setLayer(
  id: number,
  layer: DataLayer,
  vramMB?: number,
  distance?: number,
): void {
  let e = _entries.get(id);
  const now = performance.now();
  if (!e) {
    e = { chunkId: id, layer, lastUsed: now, estimatedVRAM: vramMB ?? 0, lastDistance: distance ?? 0 };
    _entries.set(id, e);
    if (layer !== 'unloaded' && (vramMB ?? 0) > 0) {
      _totalVRAM += vramMB ?? 0;
    }
  } else {
    const prevLayer = e.layer;
    e.layer = layer;
    e.lastDistance = distance ?? e.lastDistance;
    // On touche le timestamp à l'activation ou au passage en prewarming
    if (prevLayer === 'unloaded' && layer !== 'unloaded') {
      e.lastUsed = now;
    }
    if (vramMB !== undefined && vramMB !== e.estimatedVRAM) {
      _totalVRAM += vramMB - e.estimatedVRAM;
      e.estimatedVRAM = vramMB;
    }
  }
  // Si on passe à unloaded, on retire du total
  if (layer === 'unloaded') {
    _totalVRAM -= e.estimatedVRAM;
    _entries.delete(id);
  }
}

/** Marque un chunk comme « utilisé » (dernier passage dans le frustum). */
export function touch(id: number): void {
  const e = _entries.get(id);
  if (e) e.lastUsed = performance.now();
}

/** Met à jour la distance d'un chunk (chaque frame). */
export function updateDistance(id: number, dist: number): void {
  const e = _entries.get(id);
  if (e) e.lastDistance = dist;
}

/**
 * Recalcule le total VRAM à partir des entrées.
 * Utile après une série d'opérations pour resynchroniser.
 */
export function recomputeTotalVRAM(): number {
  let total = 0;
  for (const e of Array.from(_entries.values())) {
    if (e.layer !== 'unloaded') total += e.estimatedVRAM;
  }
  _totalVRAM = total;
  return total;
}

/**
 * Détermine la DataLayer cible d'après la distance au joueur.
 *
 * @param distance   Distance joueur → chunk (centre moins rayon).
 * @param loadRadius Rayon d'activation (le chunk devient visible).
 * @param prewarmRadius Rayon de pré-warm (loaded not visible).
 */
export function determineLayer(
  distance: number,
  loadRadius: number,
  prewarmRadius: number,
): DataLayer {
  if (distance <= loadRadius) return 'activated';
  if (distance <= prewarmRadius) return 'prewarming';
  return 'unloaded';
}

/**
 * Éviction LRU : libère de la VRAM jusqu'à rentrer dans le budget
 * (ou libérer `neededMB` supplémentaires).
 *
 * Stratégie (2 phases) :
 *   1. Décharger les PreWarm les plus vieux → Unloaded
 *   2. Si besoin, décharger les Activated les plus vieux → Unloaded
 *      (ils étaient peut-être hors frustum depuis longtemps)
 *
 * @param neededMB VRAM additionnelle à libérer (ex: avant de charger un chunk de X MB).
 * @returns { toUnload, toDeactivate }
 *   - toUnload : chunks à DISPOSER complètement (plus besoin du tout)
 *   - toDeactivate : chunks à retirer de la scène seulement (Activated→PreWarm)
 */
export function evictToBudget(
  neededMB = 0,
): { toUnload: number[]; toDeactivate: number[] } {
  const toUnload: number[] = [];
  const toDeactivate: number[] = [];

  let current = _totalVRAM;
  const target = _budgetMB - neededMB;
  if (current <= target) return { toUnload, toDeactivate };

  let toFree = current - target;

  // ── Phase 1 : évincer les PreWarm les plus vieux ─────────────────
  const prewarm = entriesArray()
    .filter((e) => e.layer === 'prewarming')
    .sort((a, b) => a.lastUsed - b.lastUsed);

  for (const e of prewarm) {
    if (toFree <= 0) break;
    toFree -= e.estimatedVRAM;
    toUnload.push(e.chunkId);
    _totalVRAM -= e.estimatedVRAM;
    _entries.delete(e.chunkId);
  }

  // ── Phase 2 : dégrader les Activated les plus vieux ──────────────
  // On ne les décharge pas complètement tout de suite ; on les passe
  // en PreWarm (retirés de la scène, mémoire conservée). Si le budget
  // est toujours excédentaire, la phase 1 du prochain tick les
  // déchargera.
  if (toFree > 0) {
    const activated = entriesArray()
      .filter((e) => e.layer === 'activated')
      .sort((a, b) => a.lastUsed - b.lastUsed);

    for (const e of activated) {
      if (toFree <= 0) break;
      // Le chunk reste chargé en mémoire, on le retire juste de la scène
      toDeactivate.push(e.chunkId);
      e.layer = 'prewarming';
      // On ne libère pas la VRAM ici (les textures sont toujours sur GPU)
      // mais on réduit la pression sur le budget visible
      // Seul le déchargement complet (phase 1 du prochain tick si nécessaire) libère.
      // Pour le compteur, on ne soustrait pas — la VRAM est toujours allouée.
    }
  }

  return { toUnload, toDeactivate };
}

/**
 * Vérifie si le chargement d'un chunk de `estimatedVRAM` MB est possible
 * sans dépasser le budget.
 */
export function canLoad(estimatedVRAM: number): boolean {
  return _totalVRAM + estimatedVRAM <= _budgetMB;
}

/**
 * Calcule quel pourcentage du budget VRAM est utilisé.
 */
export function budgetUsedPercent(): number {
  if (_budgetMB <= 0) return 0;
  return Math.round((_totalVRAM / _budgetMB) * 100);
}

/**
 * Compteurs pour le diagnostic.
 */
export function counts(): {
  activated: number;
  prewarming: number;
  totalVRAM: number;
  budgetMB: number;
} {
  let activated = 0;
  let prewarming = 0;
  for (const e of entriesArray()) {
    if (e.layer === 'activated') activated++;
    else if (e.layer === 'prewarming') prewarming++;
  }
  return { activated, prewarming, totalVRAM: _totalVRAM, budgetMB: _budgetMB };
}

/** Réinitialise toutes les entrées. */
export function clearLayers(): void {
  _entries.clear();
  _totalVRAM = 0;
}

// ── Utilitaires internes (évite les TS2802 sur MapIterator) ────────────────
function entriesArray(): DataLayerEntry[] {
  return Array.from(_entries.values());
}

/** Export pour debug / tests. */
export function getEntries(): ReadonlyMap<number, DataLayerEntry> {
  return _entries;
}

// ── Exposition globale pour le HUD debug ─────────────────────────────────
if (typeof window !== 'undefined') {
  const w = window as unknown as Record<string, unknown>;
  w.__dataLayers = {
    getEntries: () => Array.from(_entries.entries()).map(([id, e]) => ({ id, ...e })),
    getBudget: () => _budgetMB,
    getTotalVRAM: () => _totalVRAM,
    clear: clearLayers,
  };
}
