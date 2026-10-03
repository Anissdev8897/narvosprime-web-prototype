// runtime/donjon/DonjonLighting.tsx — rig d'éclairage in-engine du Donjon Furiste.
// Le GLB est meshes-only (pas de lumières) → on recrée l'ambiance torchlit avec
// des point-lights aux positions clés. Positions converties depuis le build
// Blender : jeu (x, hauteur, z) = Blender (x, z, -y). Pas d'ombres sur ces
// lampes (l'ombre vient du directionnel de TunableEnvironment) → perf WebGL OK.

const WARM = "#ff8a45";
const FIRE = "#ff6a22";
const LAVA = "#ff5a18";
const BOSS = "#ff3a30";

// torches au centre des 7 salles (Entrée, Antre, Couloir, Cage, Sanctuaire, Annexe, Caverne)
const ROOMS: Array<[number, number, number]> = [
  [0, 3, 34], [0, 4, -40], [34, 3, 0], [-32, 3, 9], [-32, 3, -11], [34, 3, 26], [34, 3, -30],
];
// anneau de torches de l'arène (r=13)
const ARENA: Array<[number, number, number]> = Array.from({ length: 6 }, (_, i) => {
  const a = ((i * 60 + 30) * Math.PI) / 180;
  return [13 * Math.cos(a), 3, -13 * Math.sin(a)];
});

export function DonjonLighting() {
  return (
    <group>
      {/* foyer central */}
      <pointLight position={[0, 2.4, 0]} color={FIRE} intensity={16} distance={28} decay={2} />
      {/* braseros de l'antre du chef */}
      <pointLight position={[9, 2.6, -33]} color={FIRE} intensity={9} distance={16} decay={2} />
      <pointLight position={[-9, 2.6, -33]} color={FIRE} intensity={9} distance={16} decay={2} />
      {/* statue colossale / lueur rouge du boss */}
      <pointLight position={[0, 4, -47]} color={BOSS} intensity={7} distance={22} decay={2} />
      {/* bassin de lave (caverne) */}
      <pointLight position={[34, 2, -30]} color={LAVA} intensity={10} distance={20} decay={2} />
      {/* anneau d'arène */}
      {ARENA.map((p, i) => (
        <pointLight key={`ar${i}`} position={p} color={WARM} intensity={5} distance={15} decay={2} />
      ))}
      {/* torches de salles */}
      {ROOMS.map((p, i) => (
        <pointLight key={`rm${i}`} position={p} color={WARM} intensity={6} distance={16} decay={2} />
      ))}
      {/* remplissage d'ambiance abyssale (rouge sombre par le haut, quasi noir au sol) */}
      <hemisphereLight color={"#3a1014"} groundColor={"#050204"} intensity={0.25} />
    </group>
  );
}
