// ══════════════════════════════════════════════════════════════════════════════
// runtime/MapBoundsGizmo.tsx — VOIR les murs invisibles pendant qu'on les règle.
//
// Un mur invisible ne se règle pas à l'aveugle : sans rendu, l'admin déplace des
// nombres et ne découvre le résultat qu'en se cognant dedans. Ce composant ne
// vit que le temps de l'édition et rend chaque volume en fil de fer + faces
// translucides, avec un code couleur qui dit le SENS du mur :
//
//   • `block`  (rouge)  — volume INTERDIT : on ne peut pas y entrer.
//   • `keepIn` (vert)   — volume AUTORISÉ : on ne peut pas en sortir.
//
// Les deux se ressemblent à l'écran et font l'inverse l'un de l'autre ; se
// tromper de mode donne une map soit entièrement bloquée, soit sans limite.
// D'où la couleur, et non un simple libellé dans une liste.
//
// Le mur SÉLECTIONNÉ est plus opaque et porte ses axes : c'est celui que les
// champs du panneau modifient.
// ══════════════════════════════════════════════════════════════════════════════

import * as THREE from "three";
import { mapBoundsStore, useMapBoundsVersion, type MapWall } from "./mapBoundsStore";

const COULEUR: Record<MapWall["mode"], string> = {
  block: "#ff4d4d",
  keepIn: "#4ade80",
};

function WallBox({ wall, selected }: { wall: MapWall; selected: boolean }) {
  const couleur = COULEUR[wall.mode];
  // Un mur désactivé reste visible, en gris : le faire disparaître donnerait
  // l'impression qu'il a été supprimé, alors qu'il est seulement en pause.
  const c = wall.enabled ? couleur : "#6b7280";

  return (
    <group position={wall.center} rotation={[0, wall.yaw, 0]}>
      <mesh>
        <boxGeometry args={wall.size} />
        <meshBasicMaterial
          color={c}
          transparent
          opacity={selected ? 0.18 : 0.07}
          // Sans `DoubleSide`, un volume vu de l'INTÉRIEUR disparaît — or c'est
          // la position normale de l'admin dans un `keepIn` qui cerne la map.
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* Arêtes : c'est ce qui reste lisible à distance, quand les faces
          translucides se confondent avec le décor. */}
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(...wall.size)]} />
        <lineBasicMaterial color={c} transparent opacity={selected ? 1 : 0.5} />
      </lineSegments>
      {selected && <axesHelper args={[Math.max(...wall.size) * 0.25]} />}
    </group>
  );
}

export function MapBoundsGizmo({ mapId, selectedId }: { mapId: string; selectedId: string | null }) {
  useMapBoundsVersion(); // re-rend dès qu'un mur bouge dans le panneau
  const walls = mapBoundsStore.walls(mapId);
  return (
    <>
      {walls.map((w) => (
        <WallBox key={w.id} wall={w} selected={w.id === selectedId} />
      ))}
    </>
  );
}
