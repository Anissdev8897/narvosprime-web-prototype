// ══════════════════════════════════════════════════════════════════════════════
// runtime/loading/loadingTips.ts — Astuces immersives affichées pendant le chargement
//
// Les tips sont organisées par thème et affichées aléatoirement sur l'écran
// de chargement pour informer et immerger le joueur pendant l'attente.
// ══════════════════════════════════════════════════════════════════════════════

export interface LoadingTip {
  text: string;
  /** Phase recommandée : "boot" | "preload" | "assembly" | "any" */
  phase: "boot" | "preload" | "assembly" | "any";
}

const TIPS: LoadingTip[] = [
  // ── Exploration & Monde ──────────────────────────────────────────
  { text: "Utilisez la touche M pour ouvrir la carte et vous repérer dans l'univers.", phase: "any" },
  { text: "Les portails lumineux permettent de voyager entre les maps instantanément.", phase: "any" },
  { text: "Chaque map recèle des secrets — inspectez les recoins sombres.", phase: "any" },
  { text: "Le brouillard de guerre se dissipe à mesure que vous explorez.", phase: "any" },
  { text: "Certains passages ne s'ouvrent qu'après avoir vaincu un boss régional.", phase: "any" },
  { text: "Utilisez les balises de voyage rapide pour revenir aux zones déjà visitées.", phase: "any" },

  // ── Combat & Équipement ─────────────────────────────────────────
  { text: "Changez d'arme en cours de combat avec la molette ou les touches 1-4.", phase: "any" },
  { text: "Les combos changent selon votre position : à distance, les armes lancées font plus de dégâts.", phase: "any" },
  { text: "Les créatures mécaniques sont vulnérables aux attaques électriques.", phase: "any" },
  { text: "Améliorez votre équipement à la Forge entre chaque expédition.", phase: "any" },
  { text: "Les armes légères permettent de esquiver plus rapidement.", phase: "any" },
  { text: "Chaque archétype a une compétence ultime accessible après 5 coups en chaîne.", phase: "any" },
  { text: "Les boucliers énergétiques absorbent les tirs mais se vident vite — laissez-les se recharger.", phase: "any" },

  // ── Progression & Personnage ────────────────────────────────────
  { text: "Les talents s'acquièrent auprès des maîtres dans chaque avant-poste.", phase: "any" },
  { text: "Les compétences passives s'activent automatiquement selon votre équipement.", phase: "any" },
  { text: "Votre vaisseau personnel sert de hub : stockage, crafting, et repos.", phase: "any" },
  { text: "Les PNJ marchands proposent des objets différents selon l'heure du cycle.", phase: "any" },
  { text: "Accédez à vos quêtes via le journal (touche J) pour suivre vos objectifs.", phase: "any" },

  // ── Technique & Optimisation ────────────────────────────────────
  { text: "Les assets chargés sont mis en cache — les voyages suivants seront plus rapides.", phase: "preload" },
  { text: "Ce préchargement évite les freeze une fois en jeu — la map est prête à l'arrivée.", phase: "preload" },
  { text: "Les textures sont automatiquement adaptées à votre configuration pour des performances optimales.", phase: "preload" },
  { text: "La carte est assemblée en mémoire GPU avant votre arrivée — zéro temps d'attente en jeu.", phase: "assembly" },
  { text: "Les chunks se chargent par ordre de priorité : ce qui est visible d'abord.", phase: "assembly" },
  { text: "L'assemblage GPU répartit la géométrie pour minimiser les draw calls.", phase: "assembly" },
  { text: "Votre progression est sauvegardée automatiquement à chaque étape clé.", phase: "any" },
  { text: "En cas de baisse de framerate, réduisez la qualité graphique dans les paramètres.", phase: "any" },
  { text: "Le moteur adapte la qualité des textures selon votre VRAM disponible.", phase: "preload" },
  { text: "Les assets lourds sont dégradés automatiquement si la mémoire est insuffisante.", phase: "preload" },

  // ── Boot uniquement ────────────────────────────────────────────
  { text: "Narvos Prime utilise le WebGL avancé pour des rendus 3D sans téléchargement supplémentaire.", phase: "boot" },
  { text: "Le moteur Narvos Engine compile les shaders au premier lancement pour des performances optimales.", phase: "boot" },
  { text: "Bienvenue dans Narvos Prime — un univers en constante expansion.", phase: "boot" },
];

/** Cache des tips déjà montrées dans la session (évite les répétitions). */
const shownInSession = new Set<number>();

/**
 * Choisit une tip aléatoire, de préférence non encore montrée et adaptée à la phase.
 */
export function pickRandomTip(phase: LoadingTip["phase"]): LoadingTip {
  const candidates = TIPS.filter((t) => t.phase === phase || t.phase === "any");
  // Prioriser les non-montrées
  const unseen = candidates.filter((_, i) => {
    const idx = TIPS.indexOf(candidates[i]);
    return !shownInSession.has(idx);
  });
  const pool = unseen.length > 0 ? unseen : candidates;
  const chosen = pool[Math.floor(Math.random() * pool.length)];
  shownInSession.add(TIPS.indexOf(chosen));
  return chosen;
}

/** Remet le cache de session (utile pour les tests). */
export function resetTipsSession(): void {
  shownInSession.clear();
}
