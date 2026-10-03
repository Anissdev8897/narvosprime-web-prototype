// ══════════════════════════════════════════════════════════════════════════════
// runtime/itemIcons.tsx — Icônes d'objets vectorielles (SVG, sans asset externe)
//
// Priorité d'affichage (ItemIcon) :
//   1. PNG launcher (lootIcon) si disponible
//   2. SVG spécifique par item ID (potions, ressources spéciales)
//   3. SVG par slot d'équipement
//   4. SVG par catégorie
// `stroke="currentColor"` → la couleur suit la rareté de l'item.
// ══════════════════════════════════════════════════════════════════════════════

import type { LootItem } from "../loot/LootRegistry";
import { categoryOf, type GearSlot, type ItemCategory } from "../loot/gear";
import { lootIcon } from "../loaders/launcherAssets";

// ── Chemins SVG par slot d'équipement ───────────────────────────────────────
const SLOT_PATHS: Record<GearSlot, React.ReactNode> = {
  helmet:  <><path d="M12 4a7 7 0 0 0-7 7v2h14v-2a7 7 0 0 0-7-7Z" /><path d="M5 13v3c0 2.2 1.8 3 4 3h6c2.2 0 4-.8 4-3v-3" /><path d="M9 20v1M15 20v1" /></>,
  amulet:  <><path d="M12 3 19 9l-7 12-7-12 7-6Z" /><path d="M5 9h14M12 3v18" /></>,
  armor:   <><path d="M12 3 5 6v5c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z" /><path d="M9 10h6M9 14h6" /></>,
  cape:    <><path d="M7 4s-3 0-3 4c0 4-2 8-2 10 0 1.5 1.5 2.5 5 2.5h10c3.5 0 5-1 5-2.5 0-2-2-6-2-10 0-4-3-4-3-4l-2 1.5-3-1.5-3 1.5L7 4Z" /></>,
  gloves:  <><path d="M8 11V7a2 2 0 1 1 4 0v4M12 9V7a2 2 0 1 1 4 0v6M16 11V9a2 2 0 0 1 3 1.7V14c0 3-2 6-6 6h-3c-2 0-3-1-3-3v-5l1.5-1" /><path d="M6 13v2" /></>,
  belt:    <><rect x="3" y="9" width="18" height="6" rx="1.5" /><rect x="9" y="7" width="6" height="10" rx="1" /><path d="M3 12h6M15 12h6M12 9v6" /></>,
  ring:    <><circle cx="12" cy="15" r="5" /><path d="M12 5 14.5 9h-5L12 5Z" /><path d="M9.5 9 12 12l2.5-3" /></>,
  boots:   <><path d="M6 18V11c0-2 1-4 3-4h2v4c0 2 1.5 3 3.5 3H19v4H6Z" /><path d="M4 20v1h16v-2c0-1-1-1-2-1H6c-1 0-2 1-2 2Z" /></>,
  weapon:  <><path d="M14 4 5 13l-2 5 5-2 9-9-3-3Z" /><path d="M15 5l3 3M6 18l3-1" /></>,
  offhand: <><path d="M12 3 18 6v4.5c0 4-2.5 7-6 8.5-3.5-1.5-6-4.5-6-8.5V6l6-3Z" /><path d="M12 8v8M8.5 11.5h7" /></>,
};

// ── Chemins SVG par catégorie ─────────────────────────────────────────────────
const CATEGORY_PATHS: Record<ItemCategory, React.ReactNode> = {
  equipment:  SLOT_PATHS.armor,
  consumable: <><path d="M9 3h6M10 3v3.5L6 13c-1 2 0 5 3 5h6c3 0 4-3 3-5l-4-6.5V3" /><path d="M7.5 13h9" /></>, // fiole
  resource:   <><path d="M12 2 5 9l7 13 7-13-7-7Z" /><path d="M5 9h14M9 9l3 13M15 9l-3 13" /></>,               // cristal
  material:   <><path d="M3 8l9-4 9 4-9 4-9-4Z" /><path d="M3 8v8l9 4 9-4V8" /><path d="M12 12v8" /></>,        // lingot
  quest:      <><path d="M12 3l2.4 5.6L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.6-.4L12 3Z" /></>,                      // étoile
};

// ── Icônes SVG spécifiques par item ID ───────────────────────────────────────
// Prioritaires sur catégorie / slot → donne une identité visuelle unique
// à chaque type de potion / ressource / artefact.
const ITEM_SVG: Record<string, React.ReactNode> = {
  // Potions de soin (fiole rouge avec croix)
  potion_soin_mineure: (
    <>
      <path d="M9 3h6M10 3v3.5L6 13c-1 2 0 5 3 5h6c3 0 4-3 3-5l-4-6.5V3" strokeWidth={1.5} />
      <path d="M7.5 13h9" strokeWidth={1.5} />
      <path d="M12 15v4M10 17h4" strokeWidth={2} stroke="#ef4444" />
    </>
  ),
  potion_soin_majeure: (
    <>
      <path d="M9 3h6M10 3v3.5L5 13c-1.5 2.5 0 6 4 6h6c4 0 5.5-3.5 4-6l-5-9.5V3" strokeWidth={1.5} />
      <path d="M7 13h10" strokeWidth={1.5} />
      <path d="M12 15v4M10 17h4" strokeWidth={2.5} stroke="#ef4444" />
    </>
  ),
  potion_soin_supreme: (
    <>
      <path d="M9 3h6M10 3v3L5 12c-2 3 0 7 5 7h4c5 0 7-4 5-7l-5-9V3" strokeWidth={1.5} />
      <path d="M6.5 12h11" strokeWidth={1.5} />
      <path d="M12 14v5M10 16.5h4" strokeWidth={3} stroke="#f87171" />
    </>
  ),
  // Potions de mana (fiole bleue avec goutte)
  potion_mana_mineure: (
    <>
      <path d="M9 3h6M10 3v3.5L6 13c-1 2 0 5 3 5h6c3 0 4-3 3-5l-4-6.5V3" strokeWidth={1.5} />
      <path d="M7.5 13h9" strokeWidth={1.5} />
      <path d="M12 16 10 19h4Z" strokeWidth={1.5} fill="currentColor" stroke="none" />
    </>
  ),
  potion_mana_majeure: (
    <>
      <path d="M9 3h6M10 3v3.5L5 13c-1.5 2.5 0 6 4 6h6c4 0 5.5-3.5 4-6l-5-9.5V3" strokeWidth={1.5} />
      <path d="M7 13h10" strokeWidth={1.5} />
      <path d="M12 15.5 9.5 19.5h5Z" strokeWidth={1.5} fill="currentColor" stroke="none" />
    </>
  ),
  elixir_vital: (
    <>
      <path d="M9 3h6M10 3v2.5L5 12c-2 3 0 7 5 7h4c5 0 7-4 5-7l-5-8.5V3" strokeWidth={1.5} />
      <path d="M6.5 12h11" strokeWidth={1.5} />
      <circle cx="12" cy="17" r="2.5" fill="currentColor" stroke="none" opacity={0.7} />
    </>
  ),
  // Fragment de vie (cœur)
  fragment_vie: (
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  ),
  // Cristal d'énergie (diamant lumineux)
  cristal_energie: (
    <>
      <path d="M12 2 5 9l7 13 7-13-7-7Z" />
      <path d="M5 9h14" />
      <path d="M8 9 12 2l4 7" />
    </>
  ),
  // ADN alien (double hélice)
  adn_alien: (
    <>
      <path d="M10 3c0 4 4 4 4 8s-4 4-4 8M14 3c0 4-4 4-4 8s4 4 4 8" />
      <path d="M10 7h4M10 12h4M10 17h4" />
    </>
  ),
  // Métal rare (boulon/engrenage)
  metal_rare: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" />
    </>
  ),
  // Noyau plasma (sphère rayonnante)
  noyau_plasma: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v3M12 19v3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M2 12h3M19 12h3" />
    </>
  ),
  // Nano-composant (circuit)
  nano_composant: (
    <>
      <rect x="5" y="5" width="14" height="14" rx="2" />
      <path d="M9 9h6M9 12h6M9 15h4" />
      <path d="M5 9H2M5 12H2M5 15H2M19 9h3M19 12h3M19 15h3" />
    </>
  ),
  // POWERNAX (éclair dans un hexagone)
  powernax: (
    <>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <path d="M13 8l-3 4h5l-3 4" strokeWidth={2} />
    </>
  ),
  // Noyau du vide (spirale)
  voidcore: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 12 m-6 0 a6 6 0 1 1 6 6" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </>
  ),
  // CRYON-X (flocon)
  cryon_x: (
    <>
      <path d="M12 2v20M4.93 4.93l14.14 14.14M2 12h20M4.93 19.07 19.07 4.93" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  // POWERTOX (tête de mort)
  powertox: (
    <>
      <path d="M9 11c0-1.5 1.3-2.7 3-2.7s3 1.2 3 2.7c0 2-1 3-2 3.7V18H11v-3.3C10 14 9 13 9 11z" />
      <path d="M7 7.5A6 6 0 0 1 18 11c0 2.8-1.5 5.2-3.7 6.5H9.7A7.3 7.3 0 0 1 6 11" />
      <path d="M10 18h4M10 20h4" />
    </>
  ),
  // Clés de véhicule (clé simple)
  key_chasseur_avion:     <><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" /></>,
  key_longsword:          <><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" /></>,
  key_phamtom:            <><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" /></>,
  key_vehicule_terrestre: <><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" /></>,
  // Kit de réparation (clé anglaise)
  repair_kit: (
    <>
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </>
  ),
};

interface SvgProps { size?: number; color?: string; }

/** Icône d'un slot d'équipement vide (placeholder). */
export function SlotIcon({ slot, size = 28, color = "currentColor" }: SvgProps & { slot: GearSlot }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      {SLOT_PATHS[slot]}
    </svg>
  );
}

/** Icône d'un objet : PNG launcher > SVG item-specific > SVG slot > SVG catégorie. */
export function ItemIcon({ item, size = 30 }: SvgProps & { item: LootItem }) {
  // Vignette rendue hors-ligne d'une pièce modulaire — prioritaire sur tout le
  // reste : c'est la seule illustration qui montre RÉELLEMENT l'objet, là où
  // les icônes génériques ne distinguent pas une tête d'une autre.
  if (item.thumb) {
    return (
      <img src={item.thumb} alt="" width={size} height={size} loading="lazy" decoding="async"
        style={{ objectFit: "contain", filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.6))" }}
        onError={(e) => { e.currentTarget.style.display = "none"; }} />
    );
  }

  const png = lootIcon(item.id);
  if (png) {
    return (
      <img src={png} alt="" width={size} height={size}
        style={{ objectFit: "contain" }}
        onError={(e) => { (e.currentTarget.style.display = "none"); }} />
    );
  }
  // Icône SVG spécifique par item ID (potions, ressources nommées)
  const specific = ITEM_SVG[item.id];
  if (specific) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        {specific}
      </svg>
    );
  }
  // Fallback : SVG par slot (équipement) ou par catégorie
  const paths = item.slot ? SLOT_PATHS[item.slot] : CATEGORY_PATHS[categoryOf(item)];
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      {paths}
    </svg>
  );
}
