// loaders/RendererRegistrar.tsx — expose le renderer d'un Canvas aux loaders.
//
// KTX2Loader exige `detectSupport(renderer)` avant tout transcodage : il doit
// savoir quels formats compressés le GPU accepte (BC7, ETC2, ASTC…). Le renderer
// vit dans R3F, les loaders vivent hors React — d'où ce pont d'une ligne.
//
// Sans lui, `attachKTX2` retombe sur son filet de secours : instancier un
// WebGLRenderer jetable juste pour l'interroger. Ça marche, mais ça crée un
// contexte WebGL de plus — précisément ce qu'on cherche à éviter sur les écrans
// qui saturent déjà la VRAM. Monter ce composant dans un Canvas rend le filet
// inutile.
//
// À placer dans TOUT <Canvas> qui charge des GLB (aperçus de la Forge, écran de
// création, jeu). Idempotent et sans rendu.
import { useThree } from "@react-three/fiber";
import { registerRenderer } from "./sharedLoaders";

export function RendererRegistrar(): null {
  const gl = useThree((s) => s.gl);
  registerRenderer(gl);
  return null;
}
