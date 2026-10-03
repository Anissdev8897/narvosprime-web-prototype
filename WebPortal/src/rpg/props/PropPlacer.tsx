// props/PropPlacer.tsx — composant R3F qui rend TOUS les props placés sur la map
// ET le gizmo de transformation du prop sélectionné (translate / rotate / scale).
//
// NOTE : le TransformGizmo partagé (runtime/editor/) ne supporte que translate+rotate.
// Ici on utilise directement drei TransformControls pour ajouter le mode "scale",
// spécifique aux props (les PNJ n'en ont pas besoin car ils utilisent scaleMult).
import { Component, Suspense, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { TransformControls } from "@react-three/drei";
import type * as THREE from "three";
import { propPlacementStore, type PlacedProp } from "./propPlacementStore";
import { getPropDef } from "./propCatalog";
import { PlacedPropMesh } from "./PlacedPropMesh";
import { isAdmin } from "../runtime/admin/AdminPanel";
import { editMode } from "../runtime/gameModeStore";
import type { PropAdminState } from "./PropAdminPanel";

class PropErrorBoundary extends Component<{ propId: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e: unknown) { console.warn(`[PropPlacer] GLB manquant pour le prop "${this.props.propId}" :`, e); }
  render() { return this.state.failed ? null : this.props.children; }
}

// ── Hook interne ───────────────────────────────────────────────────────────────

/** Retourne la liste réactive des props placés pour une map. */
function usePropPlacements(mapId: string): PlacedProp[] {
  useSyncExternalStore(propPlacementStore.subscribe, propPlacementStore.getVersion, propPlacementStore.getVersion);
  return propPlacementStore.getForMap(mapId);
}

// ── Gizmo spécifique props (translate + rotate + scale) ────────────────────────

interface GizmoProps {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  mode: "translate" | "rotate" | "scale";
  onCommit: (pos: [number, number, number], rot: [number, number, number], scl: [number, number, number]) => void;
}

/**
 * Gizmo 3 modes : translate, rotate, scale.
 * Anneau repère cyan au sol pour repérer le prop sélectionné.
 * Au relâchement de la souris, écrit la nouvelle transform complète dans le store.
 */
function PropTransformGizmo({ position, rotation, scale, mode, onCommit }: GizmoProps) {
  const [target, setTarget] = useState<THREE.Group | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controls = useRef<any>(null);

  useEffect(() => {
    const c = controls.current;
    if (!c || !target) return;
    const onUp = () => {
      onCommit(
        [target.position.x, target.position.y, target.position.z],
        [target.rotation.x, target.rotation.y, target.rotation.z],
        [target.scale.x, target.scale.y, target.scale.z],
      );
    };
    c.addEventListener("mouseUp", onUp);
    return () => c.removeEventListener("mouseUp", onUp);
  }, [target, onCommit]);

  return (
    <>
      <group ref={setTarget} position={position} rotation={rotation} scale={scale}>
        {/* Anneau repère cyan pour le prop sélectionné */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
          <torusGeometry args={[1.0, 0.06, 8, 28]} />
          <meshBasicMaterial color="#4de8ff" toneMapped={false} transparent opacity={0.9} depthTest={false} />
        </mesh>
      </group>
      {target && (
        <TransformControls ref={controls} object={target} mode={mode} size={0.9} />
      )}
    </>
  );
}

// ── Composant principal ────────────────────────────────────────────────────────

interface Props {
  /** Identifiant de la map courante. */
  mapId: string;
  /** State admin partagé avec PropAdminPanel (sélection + mode gizmo). */
  adminState: PropAdminState;
}

/**
 * Rend tous les props placés pour la map courante.
 * Si admin + edit mode + prop sélectionné : affiche le gizmo de transformation.
 */
export function PropPlacer({ mapId, adminState }: Props) {
  const placed = usePropPlacements(mapId);
  const showGizmo = isAdmin() && editMode() && adminState.selectedUid !== null;

  // Retrouve le prop sélectionné pour le gizmo
  const selectedProp = showGizmo
    ? placed.find((p) => p.uid === adminState.selectedUid) ?? null
    : null;

  return (
    <>
      {/* Rendu de chaque prop placé */}
      {placed.map((p) => {
        const def = getPropDef(p.propId);
        if (!def) return null;
        // Si c'est le prop sélectionné et le gizmo est actif, on ne rend PAS le mesh
        // ici — le gizmo affiche son propre anneau repère + le mesh via le groupe proxy.
        // En fait, le gizmo ne contient qu'un anneau — on rend toujours le mesh.
        // ⚠ LE <Suspense> PAR PROP EST INDISPENSABLE, PAS DÉCORATIF.
        //
        // PlacedPropMesh appelle useGLTF, qui SUSPEND le temps du téléchargement.
        // Sans frontière locale, React remonte jusqu'au <Suspense> global de
        // RpgGameWorld — celui qui englobe AUSSI les monstres placés, les
        // marchands, les vaisseaux et les VFX.
        //
        // Or React Three Fiber implémente la suspension par `object.visible =
        // false` : le sous-arbre n'est pas démonté, il devient INVISIBLE tout en
        // restant actif. Résultat observé : un seul prop en cours de
        // téléchargement (12 Mo en moyenne, jamais préchargés) faisait
        // DISPARAÎTRE tous les monstres — qui continuaient pourtant à poursuivre
        // et frapper le joueur depuis le néant.
        //
        // Chaque prop isole donc sa propre suspension. fallback={null} : le prop
        // n'apparaît qu'une fois chargé, sans rien masquer d'autre.
        return (
          <PropErrorBoundary key={p.uid} propId={p.propId}>
            <Suspense fallback={null}>
              <PlacedPropMesh
                path={def.path}
                position={p.position}
                rotation={p.rotation}
                scale={p.scale}
              />
            </Suspense>
          </PropErrorBoundary>
        );
      })}

      {/* Gizmo de transformation du prop sélectionné */}
      {selectedProp && (
        <PropTransformGizmo
          position={selectedProp.position}
          rotation={selectedProp.rotation}
          scale={selectedProp.scale}
          mode={adminState.gizmoMode}
          onCommit={(pos, rot, scl) => {
            propPlacementStore.update(selectedProp.uid, {
              position: pos,
              rotation: rot,
              scale: scl,
            });
          }}
        />
      )}
    </>
  );
}
