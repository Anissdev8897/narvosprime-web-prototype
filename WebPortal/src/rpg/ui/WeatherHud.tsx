// ui/WeatherHud.tsx — indicateur météo in-game.
//
// Petit badge en bas à droite (au-dessus de TimeHud) montrant l'état météo
// actuel avec un emoji. Masqué quand la météo dynamique est désactivée.
import { useSyncExternalStore } from "react";
import { weatherSystem, type WeatherType } from "../runtime/environment/weatherSystem";
import { gameSettings } from "../settings/gameSettings";

const subscribe = (cb: () => void) => weatherSystem.subscribe(cb);
const getSnapshot = () => weatherSystem.getSnapshot();

const WEATHER_ICONS: Record<WeatherType, string> = {
  clear: "☀️",
  cloudy: "☁️",
  rain: "🌧️",
  storm: "⛈️",
  fog: "🌫️",
  snow: "❄️",
};

const WEATHER_LABELS: Record<WeatherType, string> = {
  clear: "Clair",
  cloudy: "Nuageux",
  rain: "Pluie",
  storm: "Orage",
  fog: "Brouillard",
  snow: "Neige",
};

export function WeatherHud() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  if (!state.enabled || !gameSettings.video.dynamicWeather) return null;

  const icon = WEATHER_ICONS[state.current];
  const label = WEATHER_LABELS[state.current];

  return (
    <div style={{
      position: "fixed",
      bottom: 42,
      right: 16,
      display: "flex",
      alignItems: "center",
      gap: 6,
      padding: "4px 10px",
      background: "rgba(0,0,0,0.55)",
      borderRadius: 6,
      backdropFilter: "blur(4px)",
      zIndex: 40,
      pointerEvents: "none",
      fontFamily: "monospace",
      fontSize: 12,
      color: "#e2e8f0",
      letterSpacing: "0.04em",
    }}>
      <span style={{ fontSize: 14, lineHeight: 1 }}>{icon}</span>
      <span>{label}</span>
    </div>
  );
}
