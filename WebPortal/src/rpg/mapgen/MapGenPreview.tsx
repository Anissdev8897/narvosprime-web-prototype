// mapgen/MapGenPreview.tsx — PRÉVISUALISATION temps réel de la génération (in-Canvas).
//
// Marqueurs simples au-dessus du sol : monstres (sphères rouges, taille = meute),
// ressources (cubes verts), POI (octaèdres violets) + anneau de zone sûre. Aucun
// asset chargé : la décision se prend AVANT d'appliquer.
import { useMapGen } from "./mapGenStore";

export function MapGenPreview() {
  const s = useMapGen();
  if (!s.open || !s.preview) return null;
  const y = 2.5; // marqueurs flottants (le terrain réel cale les entités au montage)
  return (
    <group>
      {/* Anneau de la zone sûre autour du hub */}
      <mesh position={[s.config.hub.x, 0.4, s.config.hub.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[s.config.safeRadius - 0.6, s.config.safeRadius, 48]} />
        <meshBasicMaterial color="#36d3c2" transparent opacity={0.45} depthWrite={false} />
      </mesh>
      {s.preview.monsters.map((m, i) => (
        <mesh key={`m${i}`} position={[m.x, y + m.level * 0.02, m.z]}>
          <sphereGeometry args={[0.5 + m.packSize * 0.18, 10, 10]} />
          <meshBasicMaterial color={m.biome === 2 ? "#ff3838" : m.biome === 1 ? "#ff7a4d" : "#ffb46a"} transparent opacity={0.85} />
        </mesh>
      ))}
      {s.preview.resources.map((r, i) => (
        <mesh key={`r${i}`} position={[r.x, y, r.z]}>
          <boxGeometry args={[0.8, 0.8, 0.8]} />
          <meshBasicMaterial color="#6fff8a" transparent opacity={0.85} />
        </mesh>
      ))}
      {s.preview.pois.map((p, i) => (
        <mesh key={`p${i}`} position={[p.x, y + 1.2, p.z]}>
          <octahedronGeometry args={[1.1, 0]} />
          <meshBasicMaterial color="#c9a8ff" transparent opacity={0.9} />
        </mesh>
      ))}
    </group>
  );
}
