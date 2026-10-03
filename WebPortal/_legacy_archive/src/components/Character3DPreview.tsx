/**
 * @deprecated LEGACY — Character3DPreview (Sprint 3D NARVOS PRIME).
 *
 * REMPLACÉ PAR : src/components/character/HeroPreview3D.tsx
 *
 * Pourquoi cette dépréciation ?
 *   - Source de données : utilisait `model3D.basePath` pointant vers /models/iso_poc/
 *     qui n'existe pas dans le projet → fallback constant "Aucun modèle 3D".
 *   - Architecture : couplé à ClassData legacy + chargement double (base + anim).
 *   - Remplaçant : HeroPreview3D charge directement un GLB merged Meshy AI
 *     (1 fichier au lieu de 3) depuis `/models/characters/<folder>/`.
 *
 * Ce fichier est conservé temporairement pour ne pas casser d'éventuels imports
 * non identifiés. À supprimer lors d'un cleanup ultérieur.
 */

import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader';

interface Model3DConfig {
    basePath: string;
    animations?: {
        idle?: string;
        walking?: string;
        running?: string;
        attacking?: string;
        casting?: string;
        hit?: string;
        death?: string;
    };
    scale?: number;
    yOffset?: number;
    rotationY?: number;
}

interface Props {
    model3D?: Model3DConfig;
    outlineColor?: string;
    bgColor?: string | null;
    scale?: number;
    forceAnimation?: keyof NonNullable<Model3DConfig['animations']>;
}

function safeColor(input: string | null | undefined): THREE.Color | null {
    if (!input) return null;
    const lower = input.toLowerCase().trim();
    if (lower === "transparent" || lower === "none") return null;
    try {
        return new THREE.Color(lower);
    } catch (_) {
        return null;
    }
}

function UniversalModelPreview({
    config,
    scale,
    yOffset,
    rotationY,
    outlineColor,
    currentAnim = 'idle',
}: {
    config: Model3DConfig;
    scale: number;
    yOffset: number;
    rotationY: number;
    outlineColor: string;
    currentAnim?: keyof NonNullable<Model3DConfig['animations']>;
}) {
    const path = config.animations?.[currentAnim] || config.basePath;
    const isDae = path.toLowerCase().endsWith('.dae');
    
    // Charger le modèle principal (basePath) pour avoir la structure
    const baseGltf = useLoader(GLTFLoader, config.basePath);
    
    // Charger l'animation courante si elle est dans un fichier séparé
    const animGltf = useLoader(GLTFLoader, path);

    const mixerRef = useRef<THREE.AnimationMixer | null>(null);
    const groupRef = useRef<THREE.Group>(null!);

    const wrapped = useMemo(() => {
        const cloned = SkeletonUtils.clone(baseGltf.scene);
        const gradient = (() => {
            const data = new Uint8Array([80,80,80,255, 140,140,140,255, 220,220,220,255]);
            const tex = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
            tex.minFilter = THREE.NearestFilter;
            tex.magFilter = THREE.LinearFilter;
            tex.needsUpdate = true;
            return tex;
        })();

        const outlineColorObj = safeColor(outlineColor) || new THREE.Color('#1A3550');

        cloned.traverse((child) => {
            if ((child as THREE.Mesh).isMesh && !(child.userData && child.userData.isOutlineHull)) {
                const mesh = child as THREE.Mesh;
                const original = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial | undefined;
                
                const toonMat = new THREE.MeshToonMaterial({
                    color: original?.color?.clone() ?? new THREE.Color(0xffffff),
                    map: original?.map ?? null,
                    gradientMap: gradient,
                    transparent: original?.transparent ?? false,
                });
                mesh.material = toonMat;

                const hullMat = new THREE.MeshBasicMaterial({
                    color: outlineColorObj.clone(),
                    side: THREE.BackSide,
                });
                const hull = new THREE.Mesh(mesh.geometry, hullMat);
                hull.scale.setScalar(1.025);
                hull.renderOrder = -1;
                hull.userData.isOutlineHull = true;
                mesh.add(hull);
            }
        });

        return cloned;
    }, [baseGltf, outlineColor]);

    // On utilise un ref pour stocker tous les clips chargés afin d'éviter les recharges inutiles
    const allClipsRef = useRef<Record<string, THREE.AnimationClip>>({});

    useEffect(() => {
        // Enregistrer les clips du modèle de base
        baseGltf.animations.forEach(clip => {
            if (!allClipsRef.current[clip.name]) allClipsRef.current[clip.name] = clip;
        });
    }, [baseGltf]);

    useEffect(() => {
        // Enregistrer les clips du fichier d'animation
        animGltf.animations.forEach(clip => {
            // On préfixe ou on mappe si nécessaire, mais ici on prend le premier si c'est un fichier dédié
            if (!allClipsRef.current[currentAnim]) {
                allClipsRef.current[currentAnim] = clip;
            }
        });
    }, [animGltf, currentAnim]);

    useEffect(() => {
        if (!wrapped) return;
        
        const mixer = new THREE.AnimationMixer(wrapped);
        mixerRef.current = mixer;
        
        // Trouver le meilleur clip
        let clip: THREE.AnimationClip | null = null;

        // 1. Chercher dans les clips chargés (allClipsRef)
        if (allClipsRef.current[currentAnim]) {
            clip = allClipsRef.current[currentAnim];
        } 
        
        // 2. Si non trouvé, chercher dans les animations du fichier courant (animGltf)
        if (!clip && animGltf.animations.length > 0) {
            // Souvent les fichiers d'animation isolés n'ont qu'un clip nommé "Animation" ou "Take 001"
            clip = animGltf.animations.find(c => c.name.toLowerCase().includes(currentAnim.toLowerCase())) 
                || animGltf.animations[0];
        }

        // 3. Si toujours non trouvé, chercher dans le modèle de base
        if (!clip && baseGltf.animations.length > 0) {
            clip = baseGltf.animations.find(c => c.name.toLowerCase().includes(currentAnim.toLowerCase()))
                || baseGltf.animations[0];
        }

        if (clip) {
            // IMPORTANT: S'assurer que le clip est compatible avec le squelette cloné
            // SkeletonUtils.clone préserve normalement les noms des os, donc mixer.clipAction(clip) devrait marcher.
            try {
                const action = mixer.clipAction(clip);
                action.reset().fadeIn(0.2).play();
            } catch (e) {
                console.warn(`[3DPreview] Failed to play clip ${clip.name}:`, e);
            }
        }

        return () => { 
            mixer.stopAllAction(); 
        };
    }, [currentAnim, wrapped, baseGltf, animGltf]);

    useFrame((_, dt) => { 
        if (mixerRef.current) {
            mixerRef.current.update(dt);
        }
    });

    return (
        <group ref={groupRef} position={[0, yOffset, 0]} rotation={[0, rotationY, 0]} scale={scale}>
            <primitive object={wrapped} />
        </group>
    );
}

export const Character3DPreview: React.FC<Props> = ({
    model3D,
    outlineColor = '#1A3550',
    bgColor = '#0f1115',
    scale = 1.4,
    forceAnimation
}) => {
    const [hovered, setHovered] = useState(false);

    if (!model3D || !model3D.basePath) {
        return (
            <div className="w-full h-full flex items-center justify-center text-stone-500 text-sm italic">
                Aucun modèle 3D associé à cette classe.
            </div>
        );
    }

    // Logique d'animation : forceAnimation > hover (walking) > idle
    const currentAnim: keyof NonNullable<Model3DConfig['animations']> = 
        forceAnimation || (hovered ? (model3D.animations?.walking ? 'walking' : 'idle') : 'idle');

    const sceneBg = safeColor(bgColor as string | null);
    const outlineSafe = safeColor(outlineColor) || new THREE.Color('#1A3550');

    return (
        <div 
            className="w-full h-full" 
            onMouseEnter={() => setHovered(true)} 
            onMouseLeave={() => setHovered(false)}
        >
            <Canvas
                shadows
                dpr={[1, 2]}
                gl={{ antialias: true, alpha: true }}
                camera={{ position: [0, 1.5, 4], near: 0.1, far: 100, fov: 35 }}
                onCreated={({ scene }) => {
                    if (sceneBg) scene.background = sceneBg;
                    else scene.background = null;
                }}
            >
                <ambientLight intensity={0.55} />
                <directionalLight position={[5, 8, 4]} intensity={1.6} color="#fff8e7" castShadow />
                <directionalLight position={[-4, 5, -3]} intensity={0.45} color="#a8c5ff" />

                <Suspense fallback={null}>
                    <UniversalModelPreview
                        config={model3D}
                        scale={(model3D.scale ?? 1) * scale}
                        yOffset={model3D.yOffset ?? -1}
                        rotationY={model3D.rotationY ?? Math.PI}
                        outlineColor={`#${outlineSafe.getHexString()}`}
                        currentAnim={currentAnim}
                    />
                </Suspense>

                <OrbitControls
                    enablePan={false}
                    enableZoom={false}
                    minPolarAngle={Math.PI / 3}
                    maxPolarAngle={Math.PI / 2.2}
                    autoRotate={!hovered}
                    autoRotateSpeed={1.2}
                />
            </Canvas>
        </div>
    );
};
