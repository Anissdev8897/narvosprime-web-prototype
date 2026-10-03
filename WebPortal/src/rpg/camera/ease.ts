// camera/ease.ts — courbes d'interpolation pour le retour de recoil (designer-friendly).
// Toutes prennent x∈[0,1] et renvoient [0,1]. Ajouter une courbe = un case.

export type EaseId = "linear" | "easeOutQuad" | "easeOutCubic" | "easeInOutCubic" | "spring";

export function ease(id: EaseId, x: number): number {
  const t = x < 0 ? 0 : x > 1 ? 1 : x;
  switch (id) {
    case "linear":        return t;
    case "easeOutQuad":   return 1 - (1 - t) * (1 - t);
    case "easeInOutCubic":return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    // "spring" : retour avec léger rebond amorti (overshoot puis stabilisation).
    case "spring":        return 1 - Math.cos(t * Math.PI * 1.6) * Math.exp(-3.2 * t);
    case "easeOutCubic":
    default:              return 1 - Math.pow(1 - t, 3);
  }
}
