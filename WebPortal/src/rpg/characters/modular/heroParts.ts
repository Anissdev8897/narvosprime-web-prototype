// ══════════════════════════════════════════════════════════════════════════════
// characters/modular/heroParts.ts — Pièces issues du découpage automatique.
//
// Alimenté par `src/data/parts-manifest.json`, produit par
// `scripts/extract-body-parts.mjs`. Ce module ne fait que TRADUIRE : il n'a
// aucune connaissance des GLB, seulement du manifest.
//
// ── POURQUOI UN MODULE SÉPARÉ DE partCatalog ─────────────────────────────────
//
// `partCatalog` liste des chemins écrits à la main, vérifiés par listing du
// dossier. Ici les chemins sont GÉNÉRÉS : re-lancer le découpeur change ce
// fichier de données sans toucher au code. Les garder séparés évite qu'une
// régénération d'assets provoque un diff dans un fichier de catalogue rédigé.
//
// ⚠ Les pièces héros ne sont PAS interchangeables avec celles du pack Biker
// sans contrôle : elles portent leur propre squelette (68 à 168 os selon le
// personnage). `rebindSkinnedMesh` refuse en dessous de 50 % de couverture —
// c'est lui qui tranche, pas ce catalogue. Le champ `bones` est exposé pour que
// l'UI puisse prévenir AVANT l'essai.
// ══════════════════════════════════════════════════════════════════════════════

import manifest from "../../../data/parts-manifest.json";
import type { BodySlot } from "./bodySlots";
import { SLOT_LABELS } from "./bodySlots";

/** Région produite par le découpeur (cf. `scripts/lib/body-regions.mjs`). */
type Region = "head" | "hair" | "torso" | "arms" | "hands" | "legs" | "feet" | "accessory";

interface ManifestPart {
  region: string;
  path: string;
  bones: number;
  method: string;
}

interface ManifestEntry {
  id: string;
  label: string;
  method: string;
  /** Découpe partielle assumée (vêtement, option onlyRegions du découpeur). */
  partial?: boolean;
  parts: ManifestPart[];
}

/**
 * Région du découpeur → emplacement de personnage.
 *
 * Presque une identité, à une exception près : le découpeur classe sac à dos,
 * cape et ailes en `accessory` (son vocabulaire n'a pas de « dos »), alors que
 * `BodySlot` réserve `accessory` aux bijoux et distingue `back`. Sans cette
 * ligne, le sac à dos de Wraith concurrencerait une bague pour le même
 * emplacement.
 */
const REGION_TO_SLOT: Record<Region, BodySlot> = {
  head: "head",
  hair: "hair",
  torso: "torso",
  arms: "arms",
  hands: "hands",
  legs: "legs",
  feet: "feet",
  accessory: "back",
};

/**
 * Genre déduit de la source, quand elle en désigne un.
 *
 * Les six héros sont des personnages nommés : leurs pièces s'essaient sur
 * n'importe quel corps, et `rebindSkinnedMesh` tranche. Les deux mannequins
 * Biker sont autre chose — ce SONT les corps de base, découpés. Une main
 * masculine n'a rien à faire dans le carrousel féminin : sans ce genre, les
 * douze pièces apparaîtraient des deux côtés, et le joueur choisirait une
 * anatomie de l'autre sexe sans que rien ne l'en avertisse.
 *
 * `undefined` = pièce non genrée, proposée aux deux (comportement d'origine).
 */
const GENDER_BY_SOURCE: Record<string, "male" | "female"> = {
  biker_m: "male",
  biker_f: "female",
  // Manny et Quinn sont les mannequins UE masculin et féminin du template
  // ThirdPerson : leurs pièces anatomiques n'ont rien à faire dans le
  // carrousel de l'autre genre (mesuré : 89 os, mêmes noms que le Biker).
  manny: "male",
  quinn: "female",
  // mpfb (corps MakeHuman HM08) est volontairement ABSENT de cette table :
  // c'est un corps de base NEUTRE (non dimorphique), ses pièces restent
  // proposées aux deux genres. Choix assumé, pas un oubli (04/08/2026).
  // Zombies du ZombieSoldierPack : tous masculins (mesuré à l'inventaire).
  zs4_body: "male",
  zs4_head: "male",
  zs4_hat: "male",
  zs4_jacket: "male",
  zs4_pants: "male",
  zs4_shoes: "male",
  // Les six autres variantes zombies (lots B2-B3) : toutes masculines.
  zs1_head: "male",
  zs1_hat: "male",
  zs2_head: "male",
  zs2_hat: "male",
  zsail_head: "male",
  zsail_hat: "male",
  ztank_head: "male",
  ztank_hat: "male",
  zoff_head: "male",
  zoff_hat: "male",
  zoff_jacket: "male",
  zoff_pants: "male",
  zoff_shoes: "male",
  zwin_head: "male",
  zwin_hat: "male",
  zwin_jacket: "male",
  zwin_pants: "male",
  zwin_shoes: "male",
  // SciFi_Trooper_Set : trois silhouettes — homme, femme grande, femme petite.
  tr_m_body: "male",
  tr_m_form: "male",
  tr_m_head_a: "male",
  tr_m_head_b: "male",
  tr_m_chest: "male",
  tr_m_shoulders: "male",
  tr_m_legs: "male",
  tr_m_shoes: "male",
  tr_m_hands: "male",
  tr_m_chest_thin: "male",
  tr_m_legs_thin: "male",
  tr_m_shoes_thin: "male",
  tr_f_body: "female",
  tr_f_form: "female",
  tr_f_head_a: "female",
  tr_f_head_b: "female",
  tr_f_shoulders: "female",
  tr_pf_body: "female",
  tr_pf_form: "female",
  tr_pf_head_a: "female",
  tr_pf_head_b: "female",
  tr_pf_shoulders: "female",
  tr_pf_legs: "female",
  tr_pf_shoes: "female",
  // CyberpunkSamurai : personnage masculin (pièces d'auteur du lot B7).
  cs_head: "male",
  cs_hair: "male",
  cs_helmet: "male",
  cs_torso: "male",
  cs_jacket: "male",
  cs_arm: "male",
  cs_hand: "male",
  cs_leg: "male",
  cs_bag: "male",
  // BikerBundle (lots B8-B10) : dossiers Male/ et Female/ du pack.
  bk_m_head01: "male",
  bk_m_head02: "male",
  bk_m_hair: "male",
  bk_m_hair_wild: "male",
  bk_m_beard: "male",
  bk_m_arms: "male",
  bk_m_hands: "male",
  bk_m_jacket: "male",
  bk_m_jeans_vest: "male",
  bk_m_shirt_vest: "male",
  bk_m_vest_long: "male",
  bk_m_pants: "male",
  bk_m_tanktop: "male",
  bk_m_boots: "male",
  bk_m_shoes: "male",
  bk_m_gloves: "male",
  bk_m_bandana: "male",
  bk_m_glasses: "male",
  bk_f_leather: "female",
  bk_f_shirt_vest: "female",
  bk_f_shirt_half: "female",
  bk_f_pants: "female",
  bk_f_tanktop: "female",
  bk_f_boots: "female",
  bk_f_boots_casual: "female",
  bk_f_hair: "female",
  bk_f_bandana: "female",
  // Mannequins UE4 et mocap MetaHuman « male medium » : masculins.
  // UEFN est volontairement ABSENT : mannequin neutre, proposé aux deux.
  ue4_mannequin: "male",
  mh_mocap_m: "male",
};

export interface HeroPart {
  id: string;
  label: string;
  slot: BodySlot;
  path: string;
  /** Genre imposé, ou `undefined` si la pièce convient aux deux. */
  gender?: "male" | "female";
  /** Personnage d'origine — sert à regrouper et à expliquer un refus d'assemblage. */
  source: string;
  sourceLabel: string;
  /** Nombre d'os du squelette d'origine : un écart fort annonce un remap difficile. */
  bones: number;
  /** `material` = découpe d'auteur (sans couture), `bone` = segmentation calculée,
   *  `author` = pièce livrée déjà séparée par l'auteur (asIs, aucune découpe). */
  cut: "material" | "bone" | "author";
}

function build(): HeroPart[] {
  const out: HeroPart[] = [];
  for (const entry of manifest as ManifestEntry[]) {
    for (const p of entry.parts) {
      const slot = REGION_TO_SLOT[p.region as Region];
      // Une région inconnue est ignorée plutôt que rangée au hasard : ajouter
      // une région au découpeur doit se voir ici, pas se diluer dans `torso`.
      if (!slot) continue;
      out.push({
        id: `${entry.id}_${p.region}`,
        label: `${SLOT_LABELS[slot]} — ${entry.label}`,
        slot,
        path: p.path,
        gender: GENDER_BY_SOURCE[entry.id],
        source: entry.id,
        sourceLabel: entry.label,
        bones: p.bones,
        cut: p.method === "material" ? "material" : p.method === "author" ? "author" : "bone",
      });
    }
  }
  return out;
}

export const HERO_PARTS: HeroPart[] = build();

/** Personnages disponibles au découpage, dans l'ordre du manifest. */
export const HERO_SOURCES: { id: string; label: string; partial?: boolean }[] = (manifest as ManifestEntry[])
  .map((e) => ({ id: e.id, label: e.label, partial: e.partial }));
