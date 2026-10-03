// ══════════════════════════════════════════════════════════════════════════════
// electron/devTarget.ts — Quelle URL la fenêtre Electron charge en dev.
//
// ── POURQUOI UN MODULE À PART ───────────────────────────────────────────────
//
// Cette fonction ne décide pas seulement de ce qu'on AFFICHE : son `origine`
// alimente aussi la liste blanche de `will-navigate` dans `main.ts`. Une valeur
// d'environnement mal filtrée y élargirait la surface autorisée. C'est de la
// logique de sécurité, donc elle vit dans un module pur, testable sans lancer
// Electron — le pattern « logique pure / coquille impure » du projet.
//
// ── LE CHOIX DE PORT ────────────────────────────────────────────────────────
//
// Le jeu occupe 3005, les prototypes 3006, pour qu'ils tournent EN MÊME TEMPS.
// `vite.config.ts` pose `strictPort: true` : un port pris échoue bruyamment au
// lieu de glisser en silence sur 3007, où Electron ne trouverait rien.
// ══════════════════════════════════════════════════════════════════════════════

export interface DevTarget {
  /** Origine autorisée — la SEULE origine http que la fenêtre peut atteindre. */
  origine: string;
  /** URL complète à charger. */
  url: string;
}

export const PORT_PAR_DEFAUT = 3005;

/**
 * Port du dev-server, validé.
 *
 * Chiffres seuls et plage TCP valide : une variable hostile ne doit pas pouvoir
 * fabriquer une origine qui élargit la liste blanche (`3005 evil.com`,
 * `3005/../..`, `3005#`). Toute valeur douteuse retombe sur le port du jeu.
 */
export function portDev(brut: string | undefined): number {
  if (!brut || !/^\d{1,5}$/.test(brut)) return PORT_PAR_DEFAUT;
  const n = Number(brut);
  return n >= 1 && n <= 65535 ? n : PORT_PAR_DEFAUT;
}

/**
 * Sous-chemin à ouvrir.
 *
 * - `.`            → la page d'accueil des prototypes (littéral fixe)
 * - `Proto_xxx`    → `/Prototype/Proto_xxx/`
 * - vide / douteux → `/`, c'est-à-dire le jeu
 *
 * Un seul segment alphanumérique est accepté : ni `/`, ni `..`, ni schéma. Un
 * nom refusé ramène au jeu plutôt que de construire un chemin approximatif.
 */
export function cheminPrototype(brut: string | undefined): string {
  if (brut === ".") return "/Prototype/";
  return brut && /^[A-Za-z0-9_-]+$/.test(brut) ? `/Prototype/${brut}/` : "/";
}

/**
 * Assemble la cible de dev à partir de l'environnement.
 *
 * Le paramètre est volontairement un dictionnaire ouvert plutôt qu'un objet à
 * deux clés : `process.env` est un `ProcessEnv`, et tsc refuse de le passer à
 * un type fermé — « no properties in common ». Élargir ici est plus honnête que
 * forcer un cast au point d'appel.
 */
export function resolveDevTarget(env: Record<string, string | undefined>): DevTarget {
  const origine = `http://localhost:${portDev(env.NARVOS_DEV_PORT)}`;
  return { origine, url: `${origine}${cheminPrototype(env.NARVOS_PROTO)}` };
}