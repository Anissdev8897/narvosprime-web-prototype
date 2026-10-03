
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { SpriteConfig, CharacterCustomization } from '../types';
import { SpriteService } from '../services/spriteService';

interface CharacterPreviewProps {
    spriteConfig: SpriteConfig;
    customization: CharacterCustomization;
    className?: string;
}

export const CharacterPreview: React.FC<CharacterPreviewProps> = ({ spriteConfig, customization, className }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const spriteRef = useRef<THREE.Mesh | null>(null);
    const frameIdRef = useRef<number>(0);
    const clockRef = useRef(new THREE.Clock());

    useEffect(() => {
        if (!containerRef.current) return;

        // Scene Setup
        const scene = new THREE.Scene();
        sceneRef.current = scene;

        const camera = new THREE.PerspectiveCamera(35, 300 / 400, 0.1, 100);
        camera.position.set(0, 1.8, 12); // Plus haut et reculé pour centrer
        cameraRef.current = camera;

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(300, 400); // Fixed size for preview
        renderer.setPixelRatio(window.devicePixelRatio);
        containerRef.current.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
        scene.add(ambientLight);

        // Initial Sprite
        const sprite = SpriteService.createSprite(spriteConfig, customization);
        sprite.scale.set(4.5, 4.5, 4.5); // Grosse taille pour bien voir
        // Centrage parfait : on neutralise le décalage X des sprites Dofus
        sprite.position.set(-0.9, -0.6, 0);
        scene.add(sprite);
        spriteRef.current = sprite;

        // Animation Loop
        const animate = () => {
            const delta = clockRef.current.getDelta();

            if (spriteRef.current) {
                // Direction cycle for preview (toutes les 2 secondes)
                const time = Date.now() * 0.001;
                const direction = Math.floor((time * 0.5) % 8);

                SpriteService.updateSprite(spriteRef.current, {
                    current: 'IDLE',
                    frame: Math.floor((time * 6) % 4), // 4 frames à 6 fps
                    direction: direction,
                    lastUpdate: 0
                }, delta, false);
            }

            renderer.render(scene, camera);
            frameIdRef.current = requestAnimationFrame(animate);
        };

        animate();

        return () => {
            cancelAnimationFrame(frameIdRef.current);
            renderer.dispose();
            if (containerRef.current) containerRef.current.removeChild(renderer.domElement);
        };
    }, [spriteConfig, customization]);

    // Update colors in real-time
    useEffect(() => {
        if (spriteRef.current) {
            const material = spriteRef.current.material as THREE.ShaderMaterial;
            SpriteService.applyCustomization(material, customization);
        }
    }, [customization]);

    return (
        <div
            ref={containerRef}
            className={`relative flex items-center justify-center overflow-hidden rounded-3xl ${className}`}
            style={{
                width: '300px',
                height: '500px',
                background: 'transparent',
                border: 'none'
            }}
        >
        </div>
    );
};
