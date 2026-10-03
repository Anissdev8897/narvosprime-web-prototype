/**
 * ToonOutline.tsx - Application du toon shading + outline coloré faction
 * sur un mesh GLTF charge.
 *
 * Pipeline visuel par mesh enfant:
 *   1. Replace MeshStandardMaterial par MeshToonMaterial (3 tons via gradientMap)
 *   2. Conserve la map diffuse originale
 *   3. Ajoute un mesh outline en "Inverted Hull": meme geometrie scale 1.025
 *      avec material BackSide opaque coloré faction
 *
 * Faction colors:
 *   AKARLYS    -> #1A3550 (cyan-acier sombre)
 *   ZAYAN      -> #2E0F3D (pourpre tres sombre)
 *   MEZALAYIS  -> #2A1810 (ocre-rouille tres sombre)
 *   NEUTRAL    -> #1F1F1F (gris fonce)
 */

import { useMemo } from "react";
import * as THREE from "three";
import type { Faction } from "./combat/CombatTypes";

const FACTION_OUTLINE_COLOR: Record<Faction, string> = {
  AKARLYS: "#1A3550",
  ZAYAN: "#2E0F3D",
  MEZALAYIS: "#2A1810",
  NEUTRAL: "#1F1F1F",
};

/**
 * Genere une gradient map 3 tons (soft) pour MeshToonMaterial.
 * Plus la valeur est haute, plus la lumiere recue est forte.
 */
function buildGradientMap(): THREE.DataTexture {
  // 3 tons: shadow / mid / highlight + transitions douces
  const data = new Uint8Array([
    80, 80, 80, 255,    // ombre
    140, 140, 140, 255, // mid
    220, 220, 220, 255, // highlight
  ]);
  const tex = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.NearestFilter;  // pas d'interp -> "step" net
  tex.magFilter = THREE.LinearFilter;   // soft transitions
  tex.needsUpdate = true;
  return tex;
}

interface ApplyToonOutlineOptions {
  faction: Faction;
  /** Epaisseur outline en proportion (1.025 = +2.5%). */
  outlineScale?: number;
  /** Charge un nouveau gradient ou reutilise un cache. */
  gradientMap?: THREE.DataTexture;
}

/**
 * Applique le toon shading + outline a un Object3D et retourne un Group
 * comprenant le mesh original + son hull outline.
 */
export function applyToonOutlineToObject(
  source: THREE.Object3D,
  opts: ApplyToonOutlineOptions
): THREE.Group {
  const gradientMap = opts.gradientMap ?? buildGradientMap();
  const outlineColor = new THREE.Color(FACTION_OUTLINE_COLOR[opts.faction]);
  const outlineScale = opts.outlineScale ?? 1.025;

  const wrapper = new THREE.Group();
  wrapper.name = `toon_${source.name || "obj"}`;

  // Clone la source pour pouvoir modifier les materials sans toucher au cache GLTF
  const cloned = source.clone(true);

  cloned.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      const original = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial | undefined;

      // Toon material avec map preservee si elle existe
      const toonMat = new THREE.MeshToonMaterial({
        color: original?.color?.clone() ?? new THREE.Color(0xffffff),
        map: original?.map ?? null,
        gradientMap,
        transparent: original?.transparent ?? false,
        side: THREE.FrontSide,
      });
      mesh.material = toonMat;

      // Inverted hull pour outline
      const hullGeometry = mesh.geometry;
      const hullMaterial = new THREE.MeshBasicMaterial({
        color: outlineColor,
        side: THREE.BackSide,
      });
      const hull = new THREE.Mesh(hullGeometry, hullMaterial);
      hull.scale.setScalar(outlineScale);
      // Rendre l'outline en premier pour eviter overlap
      hull.renderOrder = -1;
      // Hull suit le mesh parent — on l'ajoute comme enfant
      mesh.add(hull);
    }
  });

  wrapper.add(cloned);
  return wrapper;
}
