// ══════════════════════════════════════════════════════════════════════════════
// runtime/lighting/FallbackEnvironment.tsx — Environnement lumineux OFFLINE-SAFE
//
// Remplace `<Environment preset="..." />` de @react-three/drei qui télécharge des
// HDRI depuis raw.githack.com (CDN externe). En Electron sans connexion (ou
// derrière un firewall), le fetch échoue → crash de <CanvasImpl> → écran noir.
//
// Stratégie : on n'utilise PAS de HDR du tout (zéro réseau). On simule la
// qualité d'un HDR par un hemisphereLight (gradient ciel→sol) dont les couleurs
// changent selon le preset choisi. Ce n'est pas aussi réaliste qu'un vrai HDR
// avec réflexions IBL, mais c'est :
//   • 100 % offline-safe (jamais de fetch),
//   • 0 KB de bundle (aucun asset),
//   • robuste à la perte de réseau en cours de session.
//
// L'API mime celle de drei (`preset`) pour faciliter la substitution. Si tu
// veux un vrai HDR plus tard, sers-le depuis `public/hdr/{preset}.hdr` et
// branche `<Environment files={...} />` ici (ne JAMAIS utiliser `preset` qui
// va sur le CDN externe).
// ══════════════════════════════════════════════════════════════════════════════

export type FallbackPreset = "sunset" | "city" | "night" | "dawn" | "forest";

interface PresetColors {
  sky: string;     // teinte haute (ciel)
  ground: string;  // teinte basse (sol)
  intensity: number;
}

/** Palette par preset — inspirée des HDRI drei éponymes. */
const PRESET_COLORS: Record<FallbackPreset, PresetColors> = {
  sunset: { sky: "#ffb070", ground: "#3a2050", intensity: 0.85 },
  city:   { sky: "#ffffff", ground: "#9aa6b3", intensity: 0.70 },
  night:  { sky: "#3a4a7a", ground: "#0a0a18", intensity: 0.55 },
  dawn:   { sky: "#ffc8a0", ground: "#5a4870", intensity: 0.70 },
  forest: { sky: "#a8d8a0", ground: "#3a4830", intensity: 0.65 },
};

interface FallbackEnvironmentProps {
  /** Preset visuel (calque drei) — détermine les couleurs du gradient. */
  preset?: FallbackPreset;
  /** Multiplicateur d'intensité (1 = défaut du preset). */
  intensity?: number;
}

/**
 * Composant R3F : ajoute un hemisphereLight cohérent avec le preset.
 * À placer DANS le `<Canvas>` (avec les autres lights), JAMAIS dans Suspense
 * — comme ça il s'allume même si un autre asset Suspense est en cours de load.
 */
export function FallbackEnvironment({
  preset = "sunset",
  intensity = 1,
}: FallbackEnvironmentProps) {
  const c = PRESET_COLORS[preset];
  return (
    <hemisphereLight
      args={[c.sky, c.ground, c.intensity * intensity]}
    />
  );
}
