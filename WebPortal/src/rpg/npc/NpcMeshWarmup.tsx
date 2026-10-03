// npc/NpcMeshWarmup.tsx — force l'UPLOAD GPU du mesh d'un PNJ pendant l'édition.
//
// `useGLTF.preload` parse le GLB + décode les textures EN CPU, mais l'UPLOAD GPU (le vrai
// coût du freeze) ne se fait qu'au 1er RENDU. On rend donc le mesh SOURCE du PNJ sélectionné
// TRÈS loin sous la map (jamais vu) → three l'upload sur le GPU. Comme `SkeletonUtils.clone`
// (utilisé par <Npc/>) PARTAGE la géométrie + les textures avec la source, tous les clones
// placés ensuite RÉUTILISENT les ressources GPU déjà uploadées → placement INSTANTANÉ.
// C'est le pendant PNJ de « l'arme équipée de force » de l'éditeur d'arme.
import { useGLTF } from "@react-three/drei";
import { getNpc } from "./npcCatalog";
import { getNpcModelPath } from "../loaders/assetManifest";
import { qualityVariant } from "../loaders/assetQuality";

export function NpcMeshWarmup({ folder }: { folder: string }) {
  const def = getNpc(folder);
  const path = qualityVariant(def?.modelPath ?? getNpcModelPath(folder, def?.assetRoot, def?.modelFile));
  const { scene } = useGLTF(path);
  // Mesh SOURCE rendu hors-champ (sous la map) → upload GPU. Pas de clone : on veut que ce
  // soient EXACTEMENT les géométries/textures partagées par les futurs clones <Npc/>.
  return <primitive object={scene} position={[0, -10000, 0]} scale={0.01} />;
}
