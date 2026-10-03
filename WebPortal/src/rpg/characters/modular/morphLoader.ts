// ══════════════════════════════════════════════════════════════════════════════
// characters/modular/morphLoader.ts — Chargement des packs de morphs, mémoïsé.
//
// Les 46 Mo de morphs sont découpés par région. On ne charge que celles dont
// l'écran a besoin : le créateur ouvre sur `macrodetails` (le corps homme/femme),
// et ne tire `head`, `legs`… que lorsqu'on ouvre l'onglet correspondant.
//
// Mémoïsé PAR RÉGION et par PROMESSE, pas par résultat : deux composants qui
// demandent `macrodetails` en même temps au montage doivent partager le même
// téléchargement, pas en lancer deux.
//
// ⚠ PIÈGE VITE — un fichier absent renvoie du `text/html` en 200, pas un 404
// (fallback SPA). `response.ok` est donc VRAI pour un fichier qui n'existe pas,
// et `parseMorphSet` lirait du HTML comme s'il s'agissait d'un en-tête binaire.
// On vérifie donc le `Content-Type` avant de traiter la réponse comme un asset —
// même règle que `assetExists` et `AudioManager`.
// ══════════════════════════════════════════════════════════════════════════════

import { parseMorphSet, assertCompatible, type MorphSet } from "./morphSet";

/** Racine des données de corps produites par les scripts `mpfb-*`. */
export const BODY_ROOT = "/models/personnages/_body";

/** Taille de l'espace canonique MakeHuman. Doit valoir celle du GLB et des packs. */
export const CANONICAL_VERTEX_COUNT = 19158;

const enCours = new Map<string, Promise<MorphSet>>();

/** Régions ouvertes au créateur. `macrodetails` porte le corps homme/femme. */
export type MorphRegion =
  | "macrodetails" | "head" | "torso" | "arms" | "hands" | "legs" | "feet"
  | "neck" | "hip" | "stomach" | "buttocks" | "breast" | "pelvis"
  | "nose" | "mouth" | "eyes" | "ears" | "cheek" | "chin" | "forehead"
  | "eyebrows" | "expression" | "asym" | "genitals";

/**
 * Charge (ou rend depuis le cache) le pack d'une région.
 *
 * Rejette si le fichier est absent ou incompatible, plutôt que de rendre un jeu
 * vide : un pack manquant qui passerait pour vide donnerait des curseurs sans
 * effet, et on chercherait le bug dans l'UI.
 */
export function loadMorphRegion(region: MorphRegion): Promise<MorphSet> {
  const dejaLa = enCours.get(region);
  if (dejaLa) return dejaLa;

  const url = `${BODY_ROOT}/morphs/${region}.morphs`;
  const p = (async () => {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`morphs « ${region} » : HTTP ${resp.status}`);

    // Le contrôle qui compte. Sans lui, un chemin erroné rend la page d'index
    // de Vite et `parseMorphSet` lit ses premiers octets comme une longueur
    // d'en-tête — soit une erreur incompréhensible, soit pire, un silence.
    const type = resp.headers.get("content-type") ?? "";
    if (type.includes("text/html")) {
      throw new Error(`morphs « ${region} » introuvables (${url} rend du HTML — fallback SPA)`);
    }

    const set = parseMorphSet(await resp.arrayBuffer());
    assertCompatible(set, CANONICAL_VERTEX_COUNT);
    return set;
  })();

  // Une région en échec ne doit pas rester en cache : sinon un incident réseau
  // au boot condamnerait la région pour toute la session.
  p.catch(() => enCours.delete(region));
  enCours.set(region, p);
  return p;
}

/** Charge plusieurs régions en parallèle. */
export function loadMorphRegions(regions: readonly MorphRegion[]): Promise<MorphSet[]> {
  return Promise.all(regions.map(loadMorphRegion));
}

/** Réservé aux TESTS — vide le cache. */
export function __resetMorphCache(): void {
  enCours.clear();
}
