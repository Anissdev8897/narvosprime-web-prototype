// ══════════════════════════════════════════════════════════════════════════════
// weapons/weaponPickup.ts — Ramasser une arme au sol : la SÉQUENCE, en pur.
//
// Ramasser enchaîne quatre effets, et chacun peut échouer :
//   1. retirer l'arme du sol      → sinon elle reste ramassable, on la duplique
//   2. résoudre son profil        → sans profil, elle n'est pas équipable
//   3. l'ajouter à l'inventaire   → c'est ce que le joueur voit dans son sac
//   4. l'équiper                  → elle apparaît dans les mains
//
// L'ORDRE N'EST PAS LIBRE. La résolution du profil passe AVANT le retrait du
// sol : si l'arme n'a pas de profil, on veut qu'elle reste par terre plutôt
// qu'elle disparaisse dans le néant. Un retrait d'abord suivi d'un échec
// d'équipement détruirait l'objet.
//
// Ce module est PUR : il reçoit l'état, rend le prochain état et une décision.
// Les effets de bord (animation, son, toast) appartiennent à l'appelant — c'est
// ce qui rend la séquence testable sans contexte 3D.
// ══════════════════════════════════════════════════════════════════════════════

import { weaponRegistry } from "./weaponRegistry";
import { classifyWeapon, weaponTypeMeta } from "./weaponClassifier";
import type { GroundWeapon } from "./groundWeaponStore";
import type { WeaponProfile } from "./weaponTypes";

/** Pourquoi un ramassage a échoué — chaque cas mérite un message différent. */
export type PickupFailure =
  | "introuvable"      // plus au sol (déjà ramassée, double appui)
  | "hors_portee"      // trop loin
  | "pas_une_arme"     // munition, prop, clip d'animation
  | "sans_profil";     // aucune entrée de registre → inéquipable

/**
 * Résultat d'un ramassage.
 *
 * FORME PLATE, ET C'EST DÉLIBÉRÉ. L'union discriminée
 * `{ok:true; weapon; profile} | {ok:false; reason}` serait plus précise, mais
 * elle ne se réduit PAS dans ce projet : `tsconfig.json` n'active pas `strict`,
 * donc `strictNullChecks` est off — et le narrowing sur un discriminant booléen
 * en dépend. `tsc` rendait « Property 'reason' does not exist on type
 * 'PickupResult' » sur un `switch` pourtant correct.
 *
 * NE PAS « améliorer » ceci en union tant que le projet n'est pas passé en
 * strict : la précision serait perdue en silence et les erreurs reviendraient.
 */
export interface PickupResult {
  ok: boolean;
  /** Renseignés quand `ok` est vrai. */
  weapon?: GroundWeapon;
  profile?: WeaponProfile;
  /** Renseigné quand `ok` est faux. */
  reason?: PickupFailure;
}

/**
 * Profil d'équipement d'une arme, d'après son chemin.
 *
 * Le registre est bâti depuis le CATALOGUE : chaque arme équipable y a déjà un
 * profil auto-généré (grip, socket, offset), que `weaponProfiles.json` surcharge
 * à la main pour quelques-unes. On cherche donc par CHEMIN et non par id — le
 * sol connaît le fichier, pas l'identifiant interne.
 */
export function profileForPath(path: string): WeaponProfile | undefined {
  return weaponRegistry.all().find((p) => p.path === path);
}

/**
 * Décide si l'arme peut être ramassée, SANS rien modifier.
 *
 * Séparé de l'exécution pour que l'invite « Ramasser … » à l'écran puisse poser
 * la question à chaque frame sans risque d'effet de bord.
 */
export function canPickup(w: GroundWeapon | null): PickupResult {
  if (!w) return { ok: false, reason: "introuvable" };

  // Une munition, un prop ou un clip d'animation ne s'équipe pas. On le vérifie
  // AVANT le profil : le message « ce n'est pas une arme » est plus juste que
  // « profil manquant » pour une flèche.
  const meta = weaponTypeMeta(classifyWeapon(w.weaponPath));
  if (!meta.isWeapon) return { ok: false, reason: "pas_une_arme" };

  const profile = profileForPath(w.weaponPath);
  if (!profile) return { ok: false, reason: "sans_profil" };

  return { ok: true, weapon: w, profile };
}

/** Message destiné au joueur. Chaque échec dit ce qui s'est passé, pas « erreur ». */
export function pickupMessage(r: PickupResult): string {
  if (r.ok) return `${r.weapon?.label ?? "Arme"} ramassé`;
  switch (r.reason) {
    case "introuvable":  return "Trop tard — l'arme n'est plus là";
    case "hors_portee":  return "Approchez-vous de l'arme";
    case "pas_une_arme": return "Cet objet ne peut pas être équipé";
    case "sans_profil":  return "Cette arme n'est pas encore utilisable";
    default:             return "Ramassage impossible";
  }
}

/** Le slot où poser l'arme : la main principale si libre, sinon la secondaire. */
export function slotForPickup(
  equipped: { primary: string | null; secondary: string | null },
): "primary" | "secondary" {
  // Main principale d'abord. Si les deux sont prises, on REMPLACE la principale :
  // c'est celle que le joueur regarde, et un ramassage qui ne change rien à
  // l'écran passerait pour un bug.
  return equipped.primary === null ? "primary" : equipped.secondary === null ? "secondary" : "primary";
}
