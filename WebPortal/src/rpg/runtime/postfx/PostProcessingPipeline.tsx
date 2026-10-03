// postfx/PostProcessingPipeline.tsx — Pipeline post-processing piloté par gameSettings.
//
// Effets activés : Bloom (émissifs, lumières), SSAO (occlusion ambiante),
// ToneMapping ACES, Vignette. Chaque effet adapte son intensité au preset qualité.
import { useThree } from "@react-three/fiber";
import {
  EffectComposer,
  Bloom,
  SSAO,
  Vignette,
  ToneMapping,
} from "@react-three/postprocessing";
import { BlendFunction, ToneMappingMode } from "postprocessing";
import { useMemo } from "react";
import type { GraphicsQuality } from "../../settings/gameSettings";

interface Props {
  quality: GraphicsQuality;
}

const BLOOM_CFG: Record<GraphicsQuality, { intensity: number; luminanceThreshold: number; radius: number }> = {
  low:    { intensity: 0.3, luminanceThreshold: 0.9, radius: 0.4 },
  medium: { intensity: 0.5, luminanceThreshold: 0.8, radius: 0.6 },
  high:   { intensity: 0.7, luminanceThreshold: 0.7, radius: 0.85 },
};

const SSAO_CFG: Record<GraphicsQuality, { radius: number; intensity: number; samples: number } | null> = {
  low:    null,
  medium: { radius: 0.12, intensity: 1.5, samples: 16 },
  high:   { radius: 0.15, intensity: 2.0, samples: 32 },
};

export function PostProcessingPipeline({ quality }: Props) {
  const { size } = useThree();
  const bloom = BLOOM_CFG[quality];
  const ssao = SSAO_CFG[quality];
  const halfRes = quality === "low";

  return (
    <EffectComposer multisampling={0} frameBufferType={undefined as never} enableNormalPass>
      <Bloom
        intensity={bloom.intensity}
        luminanceThreshold={bloom.luminanceThreshold}
        luminanceSmoothing={0.3}
        radius={bloom.radius}
        mipmapBlur
      />
      {ssao && (
        <SSAO
          radius={ssao.radius}
          intensity={ssao.intensity}
          luminanceInfluence={0.5}
          samples={ssao.samples}
          rings={4}
          worldDistanceThreshold={50}
          worldDistanceFalloff={10}
          worldProximityThreshold={0.5}
          worldProximityFalloff={0.3}
          blendFunction={BlendFunction.MULTIPLY}
        />
      )}
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette offset={0.3} darkness={0.5} blendFunction={BlendFunction.NORMAL} />
    </EffectComposer>
  );
}
