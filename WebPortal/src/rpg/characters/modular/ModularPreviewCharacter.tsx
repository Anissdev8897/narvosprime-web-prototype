// ══════════════════════════════════════════════════════════════════════════════
// characters/modular/ModularPreviewCharacter.tsx — Pont R3F entre le pipeline
// mort (modular/) et l'aperçu Forge.
//
// Wrapper fin autour de modular/ModularCharacter.tsx (le composant assemblé
// avec rebindSkinnedMesh). Il prend un genre + equipped et délègue le rendu.
//
// POURQUOI CE WRAPPER existe au lieu d'appeler ModularCharacter directement :
//   - ModularCharacter.tsx (le mort) importe useGLTF/mapLoaderExtend → R3F
//   - Le Forge utilise déjà Canvas/Stage/OrbitControls → compatible
//   - Le wrapper isole la surface publique (bridge) du détail Three.js interne
// ══════════════════════════════════════════════════════════════════════════════

import { useMemo } from "react";
import { ModularCharacter } from "./ModularCharacter";
import { resolveEquipped } from "./bridge";
import { type Gender, getPart } from "./partCatalog";
import { getBuild, type BuildId } from "./bodyArchetypes";
import { sanitizeProportions, type BodyProportions } from "./bodyProportions";
import type { BodySlot } from "./bodySlots";
import type { CustomCharacter } from "../customCharacterStore";

export interface ModularPreviewCharacterProps {
  /** Genre du personnage (détermine le catalogue utilisé). */
  gender: Gender;
  /** Équipement résolu (slots → id de pièce). */
  equipped: Partial<Record<BodySlot, string>>;
  /** Échelle globale (multipliée par la taille du modèle). */
  scale?: number;
  /** Épaisseur de la morphologie (X/Z seulement). 1 = inchangée. */
  girth?: number;
  /** Réglages fins de silhouette (épaules, taille, bras). */
  proportions?: BodyProportions;
  /** Teinte de PEAU (`#ffffff` = inchangée) — distincte de la teinte de tenue. */
  skinTint?: string;
  /** Couleur des IRIS (`#ffffff` = inchangée) — distincte de la peau. */
  eyeTint?: string;
}

/**
 * Aperçu d'un personnage modulaire BikerBundle dans un Canvas R3F.
 *
 * Utilisé par ForgePersonnages quand `baseAvatar === "modular"`.
 * Le composant est SUSPENSE-BOUND : l'appelant DOIT l'envelopper dans <Suspense>.
 */
export function ModularPreviewCharacter({
  gender,
  equipped,
  scale = 1,
  girth = 1,
  proportions,
  skinTint,
  eyeTint,
}: ModularPreviewCharacterProps) {
  // Filtre les pièces inexistantes (évite un crash useGLTF sur un path undefined)
  const validEquipped = useMemo(() => {
    const out: Partial<Record<BodySlot, string>> = {};
    for (const [slot, id] of Object.entries(equipped)) {
      if (getPart(id as string)) {
        out[slot as BodySlot] = id as string;
      }
    }
    return out;
  }, [equipped]);

  if (!validEquipped.body) {
    // Pas de corps = rien à afficher (le corps est REQUIRED_SLOTS)
    return null;
  }

  return (
    <ModularCharacter
      gender={gender}
      equipped={validEquipped}
      scale={scale}
      girth={girth}
      proportions={proportions}
      skinTint={skinTint}
      eyeTint={eyeTint}
    />
  );
}

/**
 * Helper : convertit un CustomCharacter (v1 ou v2) en props pour ModularPreviewCharacter.
 *
 * Applique la migration v1→v2 si nécessaire, puis résout l'équipement.
 */
export function modularPropsFromCustomCharacter(
  c: CustomCharacter,
  gender: Gender = "male",
): ModularPreviewCharacterProps {
  return {
    gender,
    equipped: resolveEquipped(c, gender),
    scale: c.scaleMult,
    // Morphologie inconnue ou absente → 1, pas d'épaississement. Une valeur par
    // défaut arbitraire déformerait silencieusement les personnages d'avant.
    girth: getBuild(c.build as BuildId)?.girth ?? 1,
    proportions: sanitizeProportions(c.proportions),
    skinTint: c.skinTint,
    eyeTint: c.eyeTint,
  };
}
