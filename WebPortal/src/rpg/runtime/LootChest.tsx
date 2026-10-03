// LootChest.tsx — coffre de butin futuriste sci-fi, enregistrable via chestRegistry.
//
// Contrairement au DungeonChest (ouverture par proximite, une seule fois),
// le LootChest supporte le respawn optionnel et s'enregistre/desenregistre
// proprement dans le chestRegistry. L'ouverture est pilotee par l'appelant
// via le handle `takeLoot()` du registre (pas par proximite ici).
//
// Visuels : caisse metallique sombre + bandes d'accent neon + anneau holo
// flottant + pointLight pulsante. Quand le coffre est vide, le halo s'eteint
// et les accents passent en gris.

import { useRef, useEffect, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { LootItem } from "../loot/LootRegistry";
import { chestRegistry } from "../loot/chestRegistry";
import type { ChestHandle } from "../loot/chestRegistry";

interface Props {
  /** Identifiant unique du coffre (cle dans le registre). */
  id: string;
  /** Libelle affiche dans l'UI d'interaction. */
  label: string;
  /** Position monde [x, y, z]. */
  position: [number, number, number];
  /** Contenu initial du coffre. */
  items: LootItem[];
  /** Credits contenus dans le coffre. */
  credits: number;
  /** Delai de reapparition en secondes (0 = pas de respawn). */
  respawnSec?: number;
  /** Couleur d'accent neon (hex). */
  accentColor?: string;
}

/**
 * Coffre de butin futuriste. Se monte dans la scene R3F, s'enregistre
 * dans le chestRegistry au mount et se desenregistre au unmount.
 *
 * Le contenu est recupere par l'appelant via `chestRegistry.get(id).takeLoot()`.
 * Si `respawnSec > 0`, le coffre se recharge apres le delai indique.
 */
export function LootChest({
  id,
  label,
  position,
  items,
  credits,
  respawnSec = 0,
  accentColor = "#38bdf8",
}: Props) {
  // Position en Vector3 (ref stable pour le handle).
  const posVec = useRef(new THREE.Vector3(...position));

  // Contenu courant — null quand le coffre est vide.
  const lootRef = useRef<{ items: LootItem[]; credits: number } | null>({
    items: [...items],
    credits,
  });

  // Etat React pour piloter le rendu conditionnel (halo, couleurs).
  const [available, setAvailable] = useState(true);

  // Refs mesh pour l'animation frame-par-frame.
  const lidRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.PointLight>(null);
  const t = useRef(0);

  // ── Enregistrement dans le chestRegistry ──────────────────────────────
  useEffect(() => {
    const handle: ChestHandle = {
      id,
      label,
      getPosition: () => posVec.current,
      isAvailable: () => !!lootRef.current,
      takeLoot: () => {
        const l = lootRef.current;
        if (!l) return null;
        lootRef.current = null;
        setAvailable(false);

        // Timer de respawn si configure.
        if (respawnSec > 0) {
          setTimeout(() => {
            lootRef.current = { items: [...items], credits };
            setAvailable(true);
          }, respawnSec * 1000);
        }
        return l;
      },
    };
    chestRegistry.register(handle);
    return () => chestRegistry.unregister(id);
  }, [id, label, respawnSec]);

  // ── Animation par frame : rotation holo + pulsation lumiere ───────────
  useFrame((_, dt) => {
    t.current += dt;

    // Rotation lente de l'anneau holo quand le coffre est plein.
    if (lidRef.current && available) {
      lidRef.current.rotation.y += dt * 0.5;
      lidRef.current.position.y = 1.0 + Math.sin(t.current * 2) * 0.08;
    }

    // Intensite pulsante du halo (fort si dispo, faible sinon).
    if (glowRef.current) {
      glowRef.current.intensity = available
        ? 2.0 + Math.sin(t.current * 3) * 0.8
        : 0.3;
    }
  });

  const accent = new THREE.Color(accentColor);

  return (
    <group position={position}>
      {/* Base : caisse metallique futuriste */}
      <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.0, 0.8, 0.7]} />
        <meshStandardMaterial
          color={available ? "#1a2836" : "#0d1520"}
          metalness={0.7}
          roughness={0.3}
          emissive={available ? accent : new THREE.Color("#111")}
          emissiveIntensity={available ? 0.15 : 0.02}
        />
      </mesh>

      {/* Bandes d'accent neon (panneaux lateraux) */}
      <mesh position={[0, 0.4, 0.36]} castShadow>
        <boxGeometry args={[0.9, 0.06, 0.01]} />
        <meshBasicMaterial
          color={available ? accentColor : "#333"}
          transparent
          opacity={available ? 0.9 : 0.3}
        />
      </mesh>
      <mesh position={[0, 0.4, -0.36]} castShadow>
        <boxGeometry args={[0.9, 0.06, 0.01]} />
        <meshBasicMaterial
          color={available ? accentColor : "#333"}
          transparent
          opacity={available ? 0.9 : 0.3}
        />
      </mesh>

      {/* Marqueur holo (anneau flottant quand le coffre est disponible) */}
      {available && (
        <mesh ref={lidRef} position={[0, 1.0, 0]}>
          <torusGeometry args={[0.3, 0.025, 8, 24]} />
          <meshBasicMaterial color={accentColor} transparent opacity={0.7} />
        </mesh>
      )}

      {/* Lumiere halo */}
      <pointLight
        ref={glowRef}
        position={[0, 0.9, 0]}
        color={accentColor}
        intensity={available ? 2.0 : 0.3}
        distance={6}
      />
    </group>
  );
}
