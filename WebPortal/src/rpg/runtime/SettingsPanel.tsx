// ══════════════════════════════════════════════════════════════════════════════
// runtime/SettingsPanel.tsx — Panneau de réglages réutilisable (Touches/Vidéo/Audio)
//
// Utilisé par le menu Pause (en jeu) ET le Menu principal. Lit/écrit le store
// settings/gameSettings (persistant). `onVideoChange` notifie l'hôte de réappliquer
// les réglages vidéo au Canvas (no-op hors jeu).
// ══════════════════════════════════════════════════════════════════════════════

import { useEffect, useReducer, useState } from "react";
import { Keyboard, Monitor, Volume2, RotateCcw } from "lucide-react";
import {
  gameSettings, BINDABLE_ACTIONS, rebindKey, resetKeys, setVideo, setAudio,
  keyLabel, type GraphicsQuality,
} from "../settings/gameSettings";

const ACCENT = "#22d3ee";
type Tab = "keys" | "video" | "audio";

export function SettingsPanel({ onVideoChange }: { onVideoChange?: () => void }) {
  const [tab, setTab] = useState<Tab>("keys");
  const [rebinding, setRebinding] = useState<string | null>(null);
  const [, force] = useReducer((x) => x + 1, 0);

  useEffect(() => {
    if (!rebinding) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.code !== "Escape") rebindKey(rebinding, e.code);
      setRebinding(null);
      force();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [rebinding]);

  const fullscreen = (v: boolean) => {
    setVideo("fullscreen", v);
    try {
      if (v && !document.fullscreenElement) document.documentElement.requestFullscreen?.();
      else if (!v && document.fullscreenElement) document.exitFullscreen?.();
    } catch { /* ignore */ }
    onVideoChange?.(); force();
  };

  const v = gameSettings.video;
  const a = gameSettings.audio;

  const tabBtn = (id: Tab, label: string, Icon: typeof Keyboard) => (
    <button onClick={() => setTab(id)} style={{
      flex: 1, padding: "10px 8px", borderRadius: 10, fontWeight: 800, fontSize: 12,
      textTransform: "uppercase", letterSpacing: "0.1em", cursor: "pointer",
      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
      border: `1px solid ${tab === id ? ACCENT : "#ffffff18"}`,
      background: tab === id ? `${ACCENT}22` : "transparent",
      color: tab === id ? ACCENT : "#94a3b8",
    }}>
      <Icon size={14} /> {label}
    </button>
  );

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {tabBtn("keys", "Touches", Keyboard)}
        {tabBtn("video", "Vidéo", Monitor)}
        {tabBtn("audio", "Audio", Volume2)}
      </div>

      {tab === "keys" && (
        <div>
          {rebinding && (
            <div style={{ textAlign: "center", color: ACCENT, fontWeight: 800, marginBottom: 14, animation: "npPulse 1s infinite" }}>
              Appuie sur une touche… (Échap pour annuler)
            </div>
          )}
          {Array.from(new Set(BINDABLE_ACTIONS.map((b) => b.group))).map((group) => (
            <div key={group} style={{ marginBottom: 14 }}>
              <div style={{ color: "#64748b", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: 6 }}>{group}</div>
              {BINDABLE_ACTIONS.filter((b) => b.group === group).map((act) => (
                <div key={act.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", borderRadius: 8, background: "rgba(255,255,255,0.03)", marginBottom: 4 }}>
                  <span style={{ color: "#cbd5e1", fontSize: 13 }}>{act.label}</span>
                  <button onClick={() => setRebinding(act.id)} style={{
                    minWidth: 70, padding: "5px 12px", borderRadius: 7, fontWeight: 800, fontSize: 12,
                    cursor: "pointer", fontFamily: "monospace",
                    border: `1px solid ${rebinding === act.id ? ACCENT : "#ffffff22"}`,
                    background: rebinding === act.id ? `${ACCENT}33` : "rgba(0,0,0,0.4)",
                    color: rebinding === act.id ? ACCENT : "#e2e8f0",
                  }}>
                    {(gameSettings.keys[act.id] ?? []).map(keyLabel).join(" / ") || "—"}
                  </button>
                </div>
              ))}
            </div>
          ))}
          <button onClick={() => { resetKeys(); force(); }} style={{
            width: "100%", padding: "12px", borderRadius: 10, fontWeight: 800, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            border: `1px solid ${ACCENT}44`, background: "rgba(8,12,20,0.8)", color: "#e2f6ff", marginTop: 8,
          }}>
            <RotateCcw size={16} /> Réinitialiser les touches
          </button>
        </div>
      )}

      {tab === "video" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Toggle label="Plein écran" value={v.fullscreen} onChange={fullscreen} />
          <Toggle label="Ombres" value={v.shadows} onChange={(b) => { setVideo("shadows", b); onVideoChange?.(); force(); }} />
          <Toggle label="Post-traitement" value={v.postProcessing} onChange={(b) => { setVideo("postProcessing", b); onVideoChange?.(); force(); }} />
          <Toggle label="Cycle jour / nuit" value={v.dayNightCycle} onChange={(b) => { setVideo("dayNightCycle", b); force(); }} />
          <Toggle label="Météo dynamique" value={v.dynamicWeather} onChange={(b) => { setVideo("dynamicWeather", b); force(); }} />
          <div>
            <div style={{ color: "#cbd5e1", fontSize: 13, marginBottom: 6 }}>Qualité graphique</div>
            <div style={{ display: "flex", gap: 8 }}>
              {(["low", "medium", "high"] as GraphicsQuality[]).map((q) => (
                <button key={q} onClick={() => { setVideo("quality", q); onVideoChange?.(); force(); }} style={{
                  flex: 1, padding: "8px", borderRadius: 8, fontWeight: 700, fontSize: 12, textTransform: "uppercase", cursor: "pointer",
                  border: `1px solid ${v.quality === q ? ACCENT : "#ffffff18"}`, background: v.quality === q ? `${ACCENT}22` : "transparent",
                  color: v.quality === q ? ACCENT : "#94a3b8",
                }}>
                  {q === "low" ? "Basse" : q === "medium" ? "Moyenne" : "Haute"}
                </button>
              ))}
            </div>
          </div>
          <Slider label="Distance d'affichage" min={300} max={3000} step={100} value={v.renderDistance}
            fmt={(n) => `${n} m`} onChange={(n) => { setVideo("renderDistance", n); onVideoChange?.(); force(); }} />
        </div>
      )}

      {tab === "audio" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Slider label="Volume général" min={0} max={1} step={0.05} value={a.master} fmt={pct} onChange={(n) => { setAudio("master", n); force(); }} />
          <Slider label="Musique"        min={0} max={1} step={0.05} value={a.music}  fmt={pct} onChange={(n) => { setAudio("music", n);  force(); }} />
          <Slider label="Effets (SFX)"   min={0} max={1} step={0.05} value={a.sfx}    fmt={pct} onChange={(n) => { setAudio("sfx", n);    force(); }} />
          <Slider label="Voix"           min={0} max={1} step={0.05} value={a.voice}  fmt={pct} onChange={(n) => { setAudio("voice", n);  force(); }} />
          <Slider label="Interface"      min={0} max={1} step={0.05} value={a.ui}     fmt={pct} onChange={(n) => { setAudio("ui", n);     force(); }} />
        </div>
      )}
      <style>{`@keyframes npPulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
    </div>
  );
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span style={{ color: "#cbd5e1", fontSize: 13 }}>{label}</span>
      <button onClick={() => onChange(!value)} style={{
        width: 52, height: 28, borderRadius: 14, cursor: "pointer", position: "relative",
        border: `1px solid ${value ? ACCENT : "#ffffff22"}`, background: value ? `${ACCENT}33` : "rgba(0,0,0,0.4)", transition: "all .15s",
      }}>
        <span style={{ position: "absolute", top: 2, left: value ? 26 : 2, width: 22, height: 22, borderRadius: "50%",
          background: value ? ACCENT : "#64748b", transition: "all .15s" }} />
      </button>
    </div>
  );
}

function Slider({ label, min, max, step, value, fmt, onChange }: {
  label: string; min: number; max: number; step: number; value: number; fmt: (n: number) => string; onChange: (n: number) => void;
}) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", color: "#cbd5e1", fontSize: 13, marginBottom: 6 }}>
        <span>{label}</span><span style={{ color: ACCENT, fontFamily: "monospace" }}>{fmt(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: "100%", accentColor: ACCENT, cursor: "pointer" }} />
    </div>
  );
}
