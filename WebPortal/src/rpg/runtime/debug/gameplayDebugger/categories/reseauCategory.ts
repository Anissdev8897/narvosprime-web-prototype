// ══════════════════════════════════════════════════════════════════════════════
// categories/reseauCategory.ts — Catégorie Réseau du GameplayDebugger
//
// Affiche les métriques réseau (latence, paquets, connexion) :
//   • Latence (ping)
//   • Paquets envoyés/reçus
//   • État de la connexion
// ══════════════════════════════════════════════════════════════════════════════

import type { GameplayDebuggerCategory, DebugDrawCall } from "../core";

// ── Données réseau simulées / partagées ─────────────────────────────────────

export interface ReseauData {
  /** Latence estimée en ms. */
  ping: number;
  /** Paquets entrants dans la dernière seconde. */
  packetsIn: number;
  /** Paquets sortants dans la dernière seconde. */
  packetsOut: number;
  /** Paquets perdus dans la dernière seconde. */
  packetsLost: number;
  /** Bande passante entrante (bytes/s). */
  bandwidthIn: number;
  /** Bande passante sortante (bytes/s). */
  bandwidthOut: number;
  /** État de la connexion. */
  status: "connected" | "reconnecting" | "disconnected" | "connecting";
  /** Type de transport. */
  transport: "ws" | "wss" | "webrtc" | "none";
  /** Nombre de joueurs connectés (si serveur). */
  peers: number;
  /** Taux d'échantillonnage (updates/s). */
  tickRate: number;
}

let currentReseau: ReseauData = {
  ping: 0,
  packetsIn: 0,
  packetsOut: 0,
  packetsLost: 0,
  bandwidthIn: 0,
  bandwidthOut: 0,
  status: "disconnected",
  transport: "none",
  peers: 0,
  tickRate: 20,
};

/** Met à jour les données réseau. */
export function updateReseauData(data: Partial<ReseauData>): void {
  currentReseau = { ...currentReseau, ...data };
}

/** Récupère les données réseau courantes. */
export function getReseauData(): ReseauData {
  return { ...currentReseau };
}

// ── Catégorie ───────────────────────────────────────────────────────────────

/**
 * Catégorie Réseau : latence, paquets, connexion.
 */
export class ReseauDebugCategory implements GameplayDebuggerCategory {
  id = "reseau";
  label = "Réseau";
  keybind = "5";

  private lines: string[] = [];

  update(_dt: number): void {
    const r = currentReseau;
    const lines: string[] = [];

    lines.push(`▓ RÉSEAU`);
    lines.push("");

    // État connexion
    const statusColors: Record<string, string> = {
      connected: "#4ade80",
      connecting: "#fbbf24",
      reconnecting: "#fb923c",
      disconnected: "#f87171",
    };
    const statusColor = statusColors[r.status] ?? "#94a3b8";
    lines.push(`  [${statusColor}]État: ${r.status.toUpperCase()}[/]`);
    lines.push(`  Transport: ${r.transport.toUpperCase()}`);

    // Latence
    const pingColor = r.ping < 50 ? "#4ade80" : r.ping < 150 ? "#fbbf24" : "#f87171";
    const barLen = Math.min(40, Math.max(1, Math.round(r.ping / 5)));
    const bar = "█".repeat(barLen) + "░".repeat(Math.max(0, 40 - barLen));
    lines.push(`  [${pingColor}]Latence: ${r.ping} ms[/]`);
    lines.push(`    [${pingColor}][${bar}][/]`);
    lines.push("");

    // Paquets
    const lossPct = r.packetsIn + r.packetsOut > 0
      ? (r.packetsLost / (r.packetsIn + r.packetsOut) * 100).toFixed(1)
      : "0.0";
    const lossColor = r.packetsLost > 5 ? "#f87171" : r.packetsLost > 0 ? "#fbbf24" : "#4ade80";
    lines.push(`  Paquets reçus: ${r.packetsIn}/s`);
    lines.push(`  Paquets envoyés: ${r.packetsOut}/s`);
    lines.push(`  [${lossColor}]Perte: ${r.packetsLost}/s (${lossPct}%)[/]`);
    lines.push("");

    // Bande passante
    const bwIn = r.bandwidthIn > 1024
      ? `${(r.bandwidthIn / 1024).toFixed(1)} KB/s`
      : `${r.bandwidthIn} B/s`;
    const bwOut = r.bandwidthOut > 1024
      ? `${(r.bandwidthOut / 1024).toFixed(1)} KB/s`
      : `${r.bandwidthOut} B/s`;
    lines.push(`  ↓ ${bwIn}`);
    lines.push(`  ↑ ${bwOut}`);
    lines.push("");

    // Infos session
    lines.push(`  Tick rate: ${r.tickRate} Hz`);
    if (r.peers > 0) {
      lines.push(`  Joueurs connectés: ${r.peers}`);
    }

    // Graphique latence minute (historique basique)
    lines.push("");
    lines.push(`  ─── Pulse ───`);
    const pulseLen = r.status === "connected" ? 12 : r.status === "reconnecting" ? 3 : 0;
    const pulse = "●".repeat(pulseLen) + "○".repeat(Math.max(0, 12 - pulseLen));
    lines.push(`  [${statusColor}]${pulse}[/]`);

    lines.push(``);
    lines.push(`───`);
    lines.push(`reseauDebug: ${r.status} · ${r.ping}ms · ${r.peers} peers`);

    this.lines = lines;
  }

  getOverlayData(): string[] {
    return this.lines;
  }

  getDrawCalls(): DebugDrawCall[] {
    return []; // Pas de draw 3D pour le réseau
  }
}
