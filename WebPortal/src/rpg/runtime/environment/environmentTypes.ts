// environment/environmentTypes.ts — modèle de données de l'environnement réglable
import type { FallbackPreset } from "../lighting/FallbackEnvironment"; // sunset|city|night|dawn|forest

/** Ciel procédural (Sky/Stars drei — zéro réseau). 'none' = pas de ciel (intérieur). */
export type SkyMode = "none" | "day" | "sunset" | "overcast" | "night" | "space";

export interface EnvConfig {
  preset: FallbackPreset;     // ambiance hémisphère
  ambientIntensity: number;   // <ambientLight intensity>      (0–2)
  sunIntensity: number;       // <directionalLight intensity>  (0–3)
  sunColor: string;           // couleur du soleil (hex #rrggbb)
  backgroundColor: string;    // fond/ciel (scene.background, hex #rrggbb)
  sky?: SkyMode;              // ciel procédural in-game (Sky/Stars)
  fog?: { color: string; density: number }; // brume (FogExp2)
}

/** Défauts PAR MAP terrestre — donnent une identité visuelle distincte. */
export const DEFAULT_ENV: Record<string, EnvConfig> = {
  // Forge : COUCHER DE SOLEIL — ciel chaud bas + lumière dorée.
  forge: { preset: "sunset", ambientIntensity: 0.5, sunIntensity: 1.3, sunColor: "#ffb877", backgroundColor: "#2a1a30", sky: "sunset" },
  // Tower : BRUME — ciel couvert + brouillard gris diffus.
  tower: { preset: "city", ambientIntensity: 0.55, sunIntensity: 0.8, sunColor: "#cdd6e0", backgroundColor: "#aeb8c4", sky: "overcast", fog: { color: "#aeb8c4", density: 0.02 } },
  // Donjon : très sombre, teinte braise — ambiance via DonjonLighting (torches/lave).
  donjon_furiste: { preset: "night", ambientIntensity: 0.2, sunIntensity: 0.35, sunColor: "#ff6a3a", backgroundColor: "#0a0507", sky: "none", fog: { color: "#0a0507", density: 0.03 } },
  // Hub orbital : ESPACE étoilé.
  orbital: { preset: "night", ambientIntensity: 0.3, sunIntensity: 0.7, sunColor: "#aab4ff", backgroundColor: "#02030a", sky: "space" },
};

/** Repli pour toute map sans défaut explicite. */
export const FALLBACK_ENV: EnvConfig =
  { preset: "sunset", ambientIntensity: 0.5, sunIntensity: 1.3, sunColor: "#ffffff", backgroundColor: "#101018", sky: "day" };
