// ══════════════════════════════════════════════════════════════════════════════
// characters/modular/skinTint.ts — Teinte de peau appliquée à l'assemblage.
//
// ── DEUX PIÈGES, TOUS DEUX SILENCIEUX ────────────────────────────────────────
//
// 1. `SkeletonUtils.clone` NE CLONE PAS LES MATÉRIAUX. Ils restent partagés avec
//    l'entrée du cache de `useGLTF`. Teinter directement colorerait donc TOUTES
//    les instances du même GLB — les autres personnages de l'écran de sélection,
//    et les PNJ du monde qui réutilisent le même corps. D'où `prepareTintable`,
//    qui clone avant toute écriture.
//
// 2. Multiplier la couleur à chaque application la ferait DÉRIVER : deux passes
//    d'un gris 0,5 donnent 0,25. On mémorise donc la couleur d'origine dans
//    `userData` et on repart toujours d'elle.
//
// ── POURQUOI MULTIPLIER PLUTÔT QU'AFFECTER ───────────────────────────────────
//
// `color` multiplie la texture de base. L'affecter écraserait le facteur d'origine
// du matériau (souvent non blanc sur les assets UE) et aplatirait le rendu.
// Multiplier garde `#ffffff` neutre — ce que promet `DEFAULT_SKIN_TINT`.
// ══════════════════════════════════════════════════════════════════════════════

import * as THREE from "three";
import { type BodySlot, SLOT_CATEGORY } from "./bodySlots";

/** Clé de stockage de la couleur d'origine, sur `material.userData`. */
const BASE_COLOR = "narvosBaseColor";
const BASE_MAP = "narvosBaseMap";

/**
 * Cet emplacement porte-t-il de la PEAU ?
 *
 * Anatomie, cheveux et barbe exclus : une teinte de peau appliquée à une
 * chevelure la colorerait en même temps que le visage, alors que ce sont deux
 * réglages distincts. Les vêtements relèvent de `tint`, pas de `skinTint`.
 */
export function isSkinSlot(slot: BodySlot): boolean {
  return SLOT_CATEGORY[slot] === "anatomy" && slot !== "hair" && slot !== "beard";
}

/** Matériaux d'un mesh, qu'il en porte un ou plusieurs. */
function materialsOf(mesh: THREE.Mesh): THREE.Material[] {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}

function hasColor(m: THREE.Material): m is THREE.Material & { color: THREE.Color } {
  return (m as { color?: unknown }).color instanceof THREE.Color;
}

/**
 * Détache les matériaux d'un sous-arbre du cache et mémorise leur couleur.
 *
 * À appeler UNE FOIS par assemblage, avant toute teinte. Idempotent : un
 * matériau déjà préparé n'est ni recloné ni re-mémorisé, sinon une deuxième
 * passe enregistrerait la couleur DÉJÀ teintée comme référence.
 *
 * @returns nombre de matériaux préparés
 */
export function prepareTintable(root: THREE.Object3D): number {
  let n = 0;
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh && !(mesh as THREE.SkinnedMesh).isSkinnedMesh) return;

    const mats = materialsOf(mesh);
    const clonés = mats.map((m) => {
      if (!hasColor(m)) return m;
      if (m.userData?.[BASE_COLOR]) return m; // déjà préparé
      const c = m.clone() as THREE.Material & { color: THREE.Color; map?: THREE.Texture | null };
      // La TEXTURE d'origine est mémorisée au même titre que la couleur : la
      // teinte d'iris la retire pour couvrir la pupille (cf. `applyTint`), et
      // une teinte neutre doit pouvoir la rendre à l'identique.
      c.userData = { ...c.userData, [BASE_COLOR]: c.color.clone(), [BASE_MAP]: c.map ?? null };
      n++;
      return c;
    });
    mesh.material = Array.isArray(mesh.material) ? clonés : clonés[0];
  });
  return n;
}

/**
 * Nom du matériau des globes oculaires, tel que produit par
 * `scripts/build-base-body.mjs`.
 *
 * Les yeux de MakeHuman sont des géométries d'aide (`helper-l-eye`,
 * `helper-r-eye`) que le constructeur sort en primitive distincte avec ce
 * matériau. C'est ce qui permet de les teinter indépendamment de la peau.
 */
export const EYE_MATERIAL = "Eyes";

/**
 * L'iris se reconnaît par MOTIF, pas par nom exact.
 *
 * `EYE_MATERIAL = "Eyes"` ne correspondait à AUCUN matériau des corps Biker —
 * la teinte des yeux ne s'appliquait donc à rien, sans erreur, sur les deux
 * genres. Noms réels mesurés :
 *
 *   Homme : M_EyeRefractive_SK_ma_UE5_meta_body
 *   Femme : MI_eye_Brown_SK_fe_UE5_meta_body_muscular_IK
 *
 * Le suffixe reprend le nom du fichier : aucune liste fixe ne peut suivre. D'où
 * un motif — mais un motif qui doit EXCLURE trois leurres présents sur les deux
 * corps : `eyelashes` (les cils), `eye_occlusion` (l'ombre de l'orbite) et
 * `tearline` (le bord humide). Les teinter colorerait les cils en bleu.
 */
export function isIrisMaterial(name: string): boolean {
  if (!/eye/i.test(name)) return false;
  // `eyebrow` en entier, jamais `brow` seul : `MI_eye_Brown_…` désigne un iris
  // BRUN, et un motif trop court l'excluait — l'iris féminin ne se teintait pas.
  return !/lash|occlusion|tearline|eyebrow/i.test(name);
}

export interface TintFilter {
  /** Ne teinter QUE ces matériaux (par nom exact). */
  only?: readonly string[];
  /** Ne teinter QUE les matériaux acceptés par ce prédicat. */
  onlyMatch?: (name: string) => boolean;
  /** Teinter tout SAUF ces matériaux. */
  except?: readonly string[];
  /** Teinter tout SAUF les matériaux acceptés par ce prédicat. */
  exceptMatch?: (name: string) => boolean;
  /**
   * Retire la texture pour que la teinte couvre TOUT le matériau.
   *
   * ── POURQUOI LA PUPILLE NE CHANGEAIT PAS DE COULEUR ─────────────────────────
   *
   * La teinte s'applique en MULTIPLIANT : `couleur × texture`. Les matériaux
   * d'iris des corps Biker portent une texture (mesuré : `map=OUI` sur les
   * deux genres) dans laquelle la pupille est noire. Or `0 × n'importe quoi`
   * vaut `0` — la pupille reste noire quelle que soit la teinte choisie.
   * Ce n'était pas un bug de filtre : c'est de l'arithmétique.
   *
   * En mode `flat`, la texture est écartée et la teinte devient la couleur du
   * matériau entier — iris ET pupille. On perd le détail d'iris, on gagne un
   * œil cohérent. Une teinte NEUTRE restaure la texture d'origine, donc le
   * réglage reste réversible.
   */
  flat?: boolean;
}

/**
 * Applique une teinte à un sous-arbre préparé.
 *
 * Repart systématiquement de la couleur mémorisée : rejouer l'appel avec une
 * autre teinte remplace la précédente au lieu de s'y cumuler.
 *
 * ── POURQUOI UN FILTRE PAR MATÉRIAU ──────────────────────────────────────────
 *
 * Le corps de base et les yeux partagent le même maillage — deux primitives,
 * deux matériaux. Sans filtre, la teinte de peau colorerait les iris en même
 * temps que le visage, et il serait impossible d'avoir un teint sombre avec des
 * yeux clairs. Les deux réglages visent le même sous-arbre, ils se distinguent
 * par le NOM du matériau.
 *
 * @param hex couleur CSS ; `#ffffff` restaure l'aspect d'origine
 * @returns nombre de matériaux teintés
 */
export function applyTint(root: THREE.Object3D, hex: string, filter: TintFilter = {}): number {
  const teinte = new THREE.Color(hex);
  const only = filter.only ? new Set(filter.only) : null;
  const except = filter.except ? new Set(filter.except) : null;
  let n = 0;

  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh && !(mesh as THREE.SkinnedMesh).isSkinnedMesh) return;

    for (const m of materialsOf(mesh)) {
      if (only && !only.has(m.name)) continue;
      if (filter.onlyMatch && !filter.onlyMatch(m.name)) continue;
      if (except && except.has(m.name)) continue;
      if (filter.exceptMatch && filter.exceptMatch(m.name)) continue;
      const base = m.userData?.[BASE_COLOR] as THREE.Color | undefined;
      if (!base || !hasColor(m)) continue;

      if (filter.flat) {
        const mm = m as THREE.Material & { color: THREE.Color; map?: THREE.Texture | null };
        const mapOrigine = (m.userData?.[BASE_MAP] ?? null) as THREE.Texture | null;
        // Teinte neutre ⇒ on rend la texture. Sans ça, remettre le curseur sur
        // « couleur d'origine » laisserait un œil peint en aplat.
        if (isNeutralTint(hex)) {
          if (mm.map !== mapOrigine) { mm.map = mapOrigine; mm.needsUpdate = true; }
          mm.color.copy(base);
        } else {
          if (mm.map !== null) { mm.map = null; mm.needsUpdate = true; }
          mm.color.copy(teinte);
        }
        n++;
        continue;
      }

      m.color.copy(base).multiply(teinte);
      n++;
    }
  });
  return n;
}

/** Une teinte qui ne change rien — évite un parcours de scène inutile. */
export function isNeutralTint(hex: string): boolean {
  return new THREE.Color(hex).getHex() === 0xffffff;
}
