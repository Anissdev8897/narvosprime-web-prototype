/**
 * playerPositionStore — singleton exposant la position du joueur
 * au bridge WASM sans traverser React.
 *
 * RpgGameWorld appelle `setRef()` une fois au mount.
 * Le WasmWorldTicker lit `getPosition()` chaque frame.
 */
import * as THREE from 'three';

let posRef: React.MutableRefObject<THREE.Vector3> | null = null;
const fallback = new THREE.Vector3();

export const playerPositionStore = {
  setRef(ref: React.MutableRefObject<THREE.Vector3>): void {
    posRef = ref;
  },

  getPosition(): THREE.Vector3 {
    return posRef?.current ?? fallback;
  },

  clear(): void {
    posRef = null;
  },
};
