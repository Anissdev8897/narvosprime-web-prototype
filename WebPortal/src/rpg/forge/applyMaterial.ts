// forge/applyMaterial.ts — applique une SURCHARGE DE MATÉRIAU à un clone GLB (texture
// custom + PBR réaliste). Mute les meshStandardMaterial du sous-arbre. Réutilisé par
// l'éditeur (aperçu live) et le rendu en jeu (ForgeBuiltMap).
import * as THREE from "three";
import type { ForgeMaterial } from "./forgeSceneStore";

const texCache = new Map<string, THREE.Texture>();
function loadTex(path: string, repeat: number): THREE.Texture {
  let t = texCache.get(path);
  if (!t) { t = new THREE.TextureLoader().load(path); t.colorSpace = THREE.SRGBColorSpace; texCache.set(path, t); }
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  return t;
}

/** Applique `mat` à TOUS les meshStandardMaterial du clone. Clone les matériaux d'abord
 *  (sinon on muterait le matériau partagé du cache useGLTF → contamine les autres instances). */
export function applyMaterialOverride(root: THREE.Object3D, mat?: ForgeMaterial): void {
  if (!mat) return;
  const tex = mat.texture ? loadTex(mat.texture, mat.textureRepeat ?? 1) : null;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.material) return;
    const arr = Array.isArray(m.material) ? m.material : [m.material];
    m.material = arr.map((src) => {
      const std = (src.clone ? src.clone() : src) as THREE.MeshStandardMaterial;
      if (mat.tint) std.color = new THREE.Color(mat.tint);
      if (tex) std.map = tex;
      if (mat.roughness != null && "roughness" in std) std.roughness = mat.roughness;
      if (mat.metalness != null && "metalness" in std) std.metalness = mat.metalness;
      if (mat.emissive && "emissive" in std) { std.emissive = new THREE.Color(mat.emissive); std.emissiveIntensity = mat.emissiveIntensity ?? 1; }
      std.needsUpdate = true;
      return std;
    });
    m.material = arr.length === 1 ? (m.material as THREE.Material[])[0] : m.material;
  });
}
