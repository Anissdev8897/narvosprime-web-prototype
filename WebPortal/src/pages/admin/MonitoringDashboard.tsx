// ══════════════════════════════════════════════════════════════════════════════
// pages/admin/MonitoringDashboard.tsx — Tableau de bord monitoring production
//
// Routes : /admin/monitoring (via stage "admin_monitoring" dans App.tsx)
//
// Affiche :
//   • Cartes métriques en temps réel (FPS, mémoire, VRAM, draw calls)
//   • Graphique FPS (24h)
//   • Graphique mémoire (24h)
//   • Alertes récentes
//   • Top erreurs JS
//   • Crash reports
//   • Performance marks
// ══════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useState, useRef } from "react";
import {
  monitoringService,
  type MetricsSnapshot,
  type AlertEvent,
  type CrashReport,
} from "../../rpg/monitoring/MonitoringService";
import {
  getAllMeasures,
  clearPerformanceMarks,
} from "../../rpg/monitoring/performanceMarks";

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmtTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function fmtDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString("fr-FR");
}

function fmtBytes(mb: number): string {
  if (mb > 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb.toFixed(0)} MB`;
}

// ── Mini Sparkline SVG ──────────────────────────────────────────────────────

function Sparkline({
  data,
  width = 280,
  height = 60,
  color = "#22d3ee",
  maxValue,
  label,
}: {
  data: { timestamp: number; value: number }[];
  width?: number;
  height?: number;
  color?: string;
  maxValue?: number;
  label?: string;
}) {
  if (data.length < 2) {
    return (
      <div style={{ color: "#5b748a", fontSize: 12, fontFamily: "monospace", textAlign: "center", padding: 20 }}>
        Pas assez de données
      </div>
    );
  }

  const max = maxValue ?? Math.max(...data.map((d) => d.value), 1);
  const min = Math.min(...data.map((d) => d.value), 0);
  const range = max - min || 1;
  const pad = 4;
  const w = width - pad * 2;
  const h = height - pad * 2;

  const points = data.map((d, i) => {
    const x = pad + (i / Math.max(data.length - 1, 1)) * w;
    const y = pad + h - ((d.value - min) / range) * h;
    return `${x},${y}`;
  });

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p}`).join(" ");

  // Tooltip value at hover
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  return (
    <div style={{ position: "relative" }}>
      <svg width={width} height={height} style={{ display: "block" }}>
        {/* Grille */}
        <line x1={pad} y1={pad} x2={pad} y2={pad + h} stroke="#1d3247" strokeWidth={1} />
        <line x1={pad} y1={pad + h} x2={pad + w} y2={pad + h} stroke="#1d3247" strokeWidth={1} />
        {/* Ligne */}
        <path d={pathD} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        {/* Points de survol */}
        {data.map((d, i) => (
          <circle
            key={i}
            cx={parseFloat(points[i].split(",")[0])}
            cy={parseFloat(points[i].split(",")[1])}
            r={hoverIdx === i ? 3 : 0}
            fill={color}
            style={{ cursor: "pointer" }}
            onMouseEnter={() => setHoverIdx(i)}
            onMouseLeave={() => setHoverIdx(null)}
          />
        ))}
      </svg>
      {hoverIdx !== null && (
        <div
          style={{
            position: "absolute",
            top: -20,
            left: `${(hoverIdx / Math.max(data.length - 1, 1)) * 100}%`,
            transform: "translateX(-50%)",
            background: "#0d1622",
            color,
            fontSize: 11,
            fontFamily: "monospace",
            padding: "2px 6px",
            borderRadius: 4,
            border: `1px solid ${color}44`,
            whiteSpace: "nowrap",
            zIndex: 10,
          }}
        >
          {data[hoverIdx].value.toFixed(1)} — {fmtTime(data[hoverIdx].timestamp)}
        </div>
      )}
      {label && (
        <div style={{ color: "#5b748a", fontSize: 10, fontFamily: "monospace", marginTop: 2, textAlign: "center" }}>
          {label}
        </div>
      )}
    </div>
  );
}

// ── Métrique Carte ──────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  unit,
  color = "#22d3ee",
  detail,
}: {
  label: string;
  value: string | number;
  unit?: string;
  color?: string;
  detail?: string;
}) {
  return (
    <div
      style={{
        background: "#0a0f1a",
        border: "1px solid #1d3247",
        borderRadius: 8,
        padding: "14px 18px",
        minWidth: 160,
        flex: "1 1 160px",
      }}
    >
      <div style={{ color: "#5b748a", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ color, fontSize: 26, fontWeight: 700, fontFamily: "monospace" }}>
        {value}
        {unit && <span style={{ fontSize: 13, color: "#5b748a", marginLeft: 4 }}>{unit}</span>}
      </div>
      {detail && (
        <div style={{ color: "#5b748a", fontSize: 11, fontFamily: "monospace", marginTop: 2 }}>
          {detail}
        </div>
      )}
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const PAGE_STYLE: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 9999,
  background: "#020308",
  color: "#e2f6ff",
  fontFamily: "system-ui, sans-serif",
  overflow: "auto",
  padding: 24,
};

const HEADER_STYLE: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 24,
  paddingBottom: 16,
  borderBottom: "1px solid #1d3247",
};

const SECTION_STYLE: React.CSSProperties = {
  background: "#0a0f1a",
  border: "1px solid #1d3247",
  borderRadius: 8,
  padding: 16,
  marginBottom: 20,
};

const SECTION_TITLE: React.CSSProperties = {
  color: "#5bd6ff",
  fontSize: 13,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.2em",
  marginBottom: 14,
};

const BTN_STYLE: React.CSSProperties = {
  padding: "8px 16px",
  fontWeight: 700,
  cursor: "pointer",
  background: "transparent",
  color: "#5b748a",
  border: "1px solid #1d3247",
  borderRadius: 6,
  fontFamily: "monospace",
  fontSize: 12,
};

// ── Component ───────────────────────────────────────────────────────────────

interface Props {
  onExit: () => void;
}

export function MonitoringDashboard({ onExit }: Props) {
  const [, forceUpdate] = useState(0);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    // Rafraîchir toutes les 2 secondes
    intervalRef.current = window.setInterval(() => {
      forceUpdate((n) => n + 1);
    }, 2000);
    return () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
    };
  }, []);

  const metrics = monitoringService.getMetrics();
  const latest = monitoringService.getLatestMetrics();
  const alerts = monitoringService.getAlerts();
  const crashes = monitoringService.getCrashes();
  const topErrors = monitoringService.getTopErrors(10);
  const measures = getAllMeasures();

  // Métriques pour les graphiques (24h)
  const cutoff24h = Date.now() - 24 * 60 * 60 * 1000;
  const recentMetrics = metrics.filter((m) => m.timestamp >= cutoff24h);

  const fpsData = recentMetrics.map((m) => ({ timestamp: m.timestamp, value: m.fps }));
  const memData = recentMetrics.map((m) => ({ timestamp: m.timestamp, value: m.memoryPercent }));
  const drawData = recentMetrics.map((m) => ({ timestamp: m.timestamp, value: m.drawCalls }));

  const handleClear = () => {
    monitoringService.clear();
    clearPerformanceMarks();
    forceUpdate((n) => n + 1);
  };

  return (
    <div style={PAGE_STYLE}>
      {/* ── Header ───────────────────────────────────────────── */}
      <div style={HEADER_STYLE}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: "0.3em", color: "#5bd6ff", textTransform: "uppercase" }}>
            Monitoring Production
          </div>
          <div style={{ color: "#5b748a", fontSize: 11, fontFamily: "monospace", marginTop: 4 }}>
            {metrics.length} snapshots · {alerts.length} alertes · {crashes.length} crashs
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={handleClear} style={BTN_STYLE}>Effacer</button>
          <button onClick={onExit} style={{ ...BTN_STYLE, color: "#22d3ee", borderColor: "#22d3ee44" }}>
            ← Retour
          </button>
        </div>
      </div>

      {/* ── Cartes métriques ──────────────────────────────────── */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <MetricCard
          label="FPS"
          value={latest?.fps ?? "—"}
          unit="fps"
          color={latest && latest.fps < 20 ? "#ff6b6b" : latest && latest.fps < 40 ? "#ffb877" : "#22d3ee"}
          detail={latest ? `Dernière snapshot : ${fmtTime(latest.timestamp)}` : undefined}
        />
        <MetricCard
          label="Mémoire JS"
          value={latest ? `${latest.memoryMB} MB` : "—"}
          color={latest && latest.memoryPercent > 90 ? "#ff6b6b" : latest && latest.memoryPercent > 70 ? "#ffb877" : "#22d3ee"}
          detail={latest ? `${latest.memoryPercent}% du heap` : undefined}
        />
        <MetricCard
          label="VRAM"
          value={latest?.vramMB ? `${latest.vramMB} MB` : "N/A"}
          color="#5b748a"
        />
        <MetricCard
          label="Draw Calls"
          value={latest?.drawCalls ?? "—"}
          color={latest && latest.drawCalls > 500 ? "#ffb877" : "#22d3ee"}
        />
        <MetricCard
          label="Triangles"
          value={latest?.triangles ? (latest.triangles / 1000).toFixed(0) : "—"}
          unit="k"
          color="#5b748a"
        />
        <MetricCard
          label="Textures"
          value={latest?.textures ?? "—"}
          color="#5b748a"
        />
        <MetricCard
          label="Erreurs JS"
          value={latest?.jsErrors ?? 0}
          color={latest && latest.jsErrors > 0 ? "#ff6b6b" : "#5b748a"}
          detail="depuis dernière snapshot"
        />
        <MetricCard
          label="Dernier Chargement"
          value={latest?.loadDurationMs ? `${(latest.loadDurationMs / 1000).toFixed(1)}s` : "—"}
          color="#5b748a"
        />
      </div>

      {/* ── Graphiques ────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <div style={SECTION_STYLE}>
          <div style={SECTION_TITLE}>FPS (24h)</div>
          <Sparkline data={fpsData} color="#22d3ee" width={400} height={80} maxValue={120} label="FPS" />
        </div>
        <div style={SECTION_STYLE}>
          <div style={SECTION_TITLE}>Mémoire % (24h)</div>
          <Sparkline data={memData} color="#ffb877" width={400} height={80} maxValue={100} label="% heap used" />
        </div>
      </div>

      {/* ── Draw Calls (24h) ──────────────────────────────────── */}
      <div style={{ ...SECTION_STYLE, maxWidth: 800 }}>
        <div style={SECTION_TITLE}>Draw Calls (24h)</div>
        <Sparkline data={drawData} color="#5bd6ff" width={600} height={60} label="calls" />
      </div>

      {/* ── Top Erreurs ───────────────────────────────────────── */}
      {topErrors.length > 0 && (
        <div style={SECTION_STYLE}>
          <div style={SECTION_TITLE}>Top Erreurs JS</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "monospace" }}>
            <thead>
              <tr>
                <th style={TH}>#</th>
                <th style={TH}>Message</th>
                <th style={TH}>Occurrences</th>
                <th style={TH}>Dernière</th>
              </tr>
            </thead>
            <tbody>
              {topErrors.map((e, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #1d3247" }}>
                  <td style={TD}>{i + 1}</td>
                  <td style={TD}>{e.message}</td>
                  <td style={TD}>{e.count}</td>
                  <td style={TD}>{fmtTime(e.lastSeen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Alertes ───────────────────────────────────────────── */}
      {alerts.length > 0 && (
        <div style={SECTION_STYLE}>
          <div style={SECTION_TITLE}>Alertes récentes</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[...alerts].reverse().slice(0, 20).map((a, i) => (
              <div
                key={i}
                style={{
                  padding: "8px 12px",
                  borderRadius: 6,
                  background: a.severity === "critical" ? "rgba(255,80,80,.1)" : "rgba(255,180,60,.08)",
                  border: `1px solid ${a.severity === "critical" ? "#ff444444" : "#ffb87733"}`,
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12,
                  fontFamily: "monospace",
                }}
              >
                <span style={{ color: a.severity === "critical" ? "#ff6b6b" : "#ffb877" }}>
                  {a.severity === "critical" ? "⚠️" : "⚡"} {a.message}
                </span>
                <span style={{ color: "#5b748a" }}>{fmtTime(a.timestamp)}</span>
              </div>
            ))}
          </div>
          {alerts.length > 20 && (
            <div style={{ color: "#5b748a", fontSize: 11, fontFamily: "monospace", marginTop: 8 }}>
              … et {alerts.length - 20} autres alertes
            </div>
          )}
        </div>
      )}

      {/* ── Crash Reports ──────────────────────────────────────── */}
      {crashes.length > 0 && (
        <div style={SECTION_STYLE}>
          <div style={SECTION_TITLE}>Crash Reports</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[...crashes].reverse().slice(0, 10).map((c, i) => (
              <details key={i} style={{ fontSize: 12, fontFamily: "monospace" }}>
                <summary style={{ cursor: "pointer", color: "#ff6b6b", padding: "6px 0" }}>
                  [{fmtDate(c.timestamp)}] {c.message.length > 80 ? c.message.slice(0, 80) + "…" : c.message}
                </summary>
                <div style={{ padding: "6px 12px", marginTop: 4, background: "#060b14", borderRadius: 4, border: "1px solid #1d3247" }}>
                  <div style={{ color: "#5b748a", marginBottom: 4 }}>Contexte :</div>
                  <pre style={{ color: "#9bb8cc", fontSize: 11, lineHeight: 1.5, whiteSpace: "pre-wrap", margin: 0 }}>
                    {JSON.stringify(c.context, null, 2)}
                  </pre>
                  {c.stack && (
                    <>
                      <div style={{ color: "#5b748a", margin: "8px 0 4px" }}>Stack :</div>
                      <pre style={{ color: "#5b748a", fontSize: 11, lineHeight: 1.5, whiteSpace: "pre-wrap", margin: 0, maxHeight: 120, overflow: "auto" }}>
                        {c.stack}
                      </pre>
                    </>
                  )}
                </div>
              </details>
            ))}
          </div>
          {crashes.length > 10 && (
            <div style={{ color: "#5b748a", fontSize: 11, fontFamily: "monospace", marginTop: 8 }}>
              … et {crashes.length - 10} autres crashs
            </div>
          )}
        </div>
      )}

      {/* ── Performance Marks ──────────────────────────────────── */}
      {measures.length > 0 && (
        <div style={SECTION_STYLE}>
          <div style={SECTION_TITLE}>Performance Marks (User Timing)</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "monospace" }}>
            <thead>
              <tr>
                <th style={TH}>Mesure</th>
                <th style={TH}>Durée</th>
              </tr>
            </thead>
            <tbody>
              {measures.map((m, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #1d3247" }}>
                  <td style={TD}>{m.name}</td>
                  <td style={{ ...TD, color: m.duration > 3000 ? "#ffb877" : m.duration > 10000 ? "#ff6b6b" : "#9bb8cc" }}>
                    {(m.duration / 1000).toFixed(2)} s
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Footer ─────────────────────────────────────────────── */}
      <div style={{ color: "#2a4055", fontSize: 10, fontFamily: "monospace", textAlign: "center", marginTop: 32, padding: 12 }}>
        Narvos Prime — Monitoring Production — Mise à jour toutes les 2 s
      </div>
    </div>
  );
}

// ── Table helpers ────────────────────────────────────────────────────────────

const TH: React.CSSProperties = {
  textAlign: "left",
  padding: "6px 10px",
  color: "#5b748a",
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  borderBottom: "1px solid #1d3247",
};

const TD: React.CSSProperties = {
  padding: "6px 10px",
  color: "#9bb8cc",
  fontSize: 12,
};
