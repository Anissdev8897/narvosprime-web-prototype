// utils/color.ts — validation STRICTE des couleurs hex (anti "THREE.Color: Invalid hex color").
//
// Cause historique : des inputs texte persistaient chaque FRAPPE ("#d", "#d8"…) → des hex
// partiels en base/localStorage → warning THREE à chaque montage. Toute couleur venant
// d'une saisie ou d'une persistance DOIT passer par sanitizeHexColor avant usage moteur.

const HEX6 = /^#[0-9a-fA-F]{6}$/;
const HEX3 = /^#[0-9a-fA-F]{3}$/;

/** true si la chaîne est une couleur hex exploitable (#rgb ou #rrggbb). */
export function isValidHexColor(v: unknown): v is string {
  return typeof v === "string" && (HEX6.test(v) || HEX3.test(v));
}

/** Normalise vers #rrggbb ; toute valeur invalide → `fallback` (défaut blanc neutre). */
export function sanitizeHexColor(v: unknown, fallback = "#ffffff"): string {
  if (typeof v !== "string") return fallback;
  const s = v.trim();
  if (HEX6.test(s)) return s.toLowerCase();
  if (HEX3.test(s)) {
    const [, r, g, b] = s;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return fallback;
}
