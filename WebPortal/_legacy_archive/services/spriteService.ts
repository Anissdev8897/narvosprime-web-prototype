
import * as THREE from 'three';
import { SpriteConfig, AnimationState, CharacterCustomization } from '../types';

/**
 * Shader pour Sprites avec Color Masking (Style Dofus "Trinity")
 * Supporte 5 zones de couleurs : Peau, Cheveux, Base, Secondaire, Détails.
 */
export const SpriteColorMaskShader = {
    uniforms: {
        map: { value: null },      // Albedo / Texture base
        mask: { value: null },     // Masque RGBA (R=Skin, G=Hair, B=Base, A=Secondary, Mixed=Detail)
        colorSkin: { value: new THREE.Color('#f3d1b0') },
        colorHair: { value: new THREE.Color('#4a3728') },
        colorBase: { value: new THREE.Color('#3b82f6') },
        colorSecondary: { value: new THREE.Color('#1e40af') },
        colorDetail: { value: new THREE.Color('#60a5fa') },
        offset: { value: new THREE.Vector2(0, 0) },
        repeat: { value: new THREE.Vector2(1, 1) }
    },
    vertexShader: `
        varying vec2 vUv;
        uniform vec2 offset;
        uniform vec2 repeat;
        void main() {
            vUv = uv * repeat + offset;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D map;
        uniform sampler2D mask;
        uniform vec3 colorSkin;
        uniform vec3 colorHair;
        uniform vec3 colorBase;
        uniform vec3 colorSecondary;
        uniform vec3 colorDetail;
        varying vec2 vUv;

        void main() {
            vec4 texel = texture2D(map, vUv);
            
            // 🎯 TRANSPARENCE & CHROMACUT
            // Si l'alpha est bas, on vire. Si c'est du noir pur (souvent fond de texture en chargement), on vire.
            if (texel.a < 0.1) discard;
            float lum = dot(texel.rgb, vec3(0.299, 0.587, 0.114));
            if (texel.a > 0.9 && lum < 0.02) discard;

            vec4 m = texture2D(mask, vUv);
            vec3 finalColor = texel.rgb;
            
            // 🌈 TINTING PRÉSERVATEUR (RGB ONLY)
            // On ignore le canal Alpha du masque car il est souvent à 1.0 par défaut sur les PNG,
            // ce qui causait le fameux "fond bleu" sur tout le carré du sprite.
            
            vec3 skinRes = colorSkin * texel.rgb * 1.2;
            vec3 hairRes = colorHair * texel.rgb * 1.2;
            vec3 baseRes = colorBase * texel.rgb * 1.2;

            // On ne mixe QUE si le masque a de la couleur dans les canaux R, G ou B
            if (m.r > 0.01) finalColor = mix(finalColor, skinRes, m.r);
            if (m.g > 0.01) finalColor = mix(finalColor, hairRes, m.g);
            if (m.b > 0.01) finalColor = mix(finalColor, baseRes, m.b);
            
            // Note: On peut utiliser m.a pour un 4ème canal SI on est sûr que le masque est conçu pour.
            // Pour l'instant on reste sur RGB pour éviter les bugs visuels.
            
            finalColor = clamp(finalColor, 0.0, 1.0);
            
            gl_FragColor = vec4(finalColor, texel.a);
        }
    `
};

export class SpriteService {
    public static createSprite(config: SpriteConfig, customization?: CharacterCustomization): THREE.Mesh {
        const loader = new THREE.TextureLoader();

        // Dynamic path based on gender
        let texPath = config.texturePath;
        let mskPath = config.maskPath;

        if (customization) {
            if (customization.gender === 'MALE' && config.malePath) texPath = config.malePath;
            if (customization.gender === 'FEMALE' && config.femalePath) texPath = config.femalePath;
            if (customization.gender === 'MALE' && config.maleMask) mskPath = config.maleMask;
            if (customization.gender === 'FEMALE' && config.femaleMask) mskPath = config.femaleMask;
        }

        // Récupérer les textures du cache si possible
        let texture: THREE.Texture;
        let mask: THREE.Texture | null = null;

        // On essaie de récupérer via le singleton preloadService
        // Note: On utilise un chargement direct car on est en mode synchrone ici pour Three.js Mesh creation
        // Mais comme c'est préchargé, TextureLoader devrait être instantané (du cache)
        texture = loader.load(texPath);
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        texture.generateMipmaps = false;

        if (mskPath) {
            mask = loader.load(mskPath);
            mask.magFilter = THREE.NearestFilter;
            mask.minFilter = THREE.NearestFilter;
            mask.generateMipmaps = false;
        }

        const material = new THREE.ShaderMaterial({
            uniforms: THREE.UniformsUtils.clone(SpriteColorMaskShader.uniforms),
            vertexShader: SpriteColorMaskShader.vertexShader,
            fragmentShader: SpriteColorMaskShader.fragmentShader,
            transparent: true,
            alphaTest: 0.1, // Seuil plus bas pour garder les détails
            side: THREE.DoubleSide, // Mieux pour les previews tournants
            depthWrite: false, // Évite les problèmes de tri sur les sprites transparents
            name: 'SpriteColorMaskMaterial'
        });

        // Create a default transparent mask (1x1) to avoid shader issues until loading is complete
        const blackMask = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1, THREE.RGBAFormat);
        blackMask.needsUpdate = true;

        material.uniforms.map.value = texture;
        material.uniforms.mask.value = blackMask; // Start with transparent mask

        if (mskPath) {
            loader.load(mskPath, (loadedMask) => {
                loadedMask.magFilter = THREE.NearestFilter;
                loadedMask.minFilter = THREE.NearestFilter;
                loadedMask.generateMipmaps = false;
                material.uniforms.mask.value = loadedMask;
            });
        }

        if (customization) {
            this.applyCustomization(material, customization);
        }

        material.uniforms.repeat.value.set(1 / config.cols, 1 / config.rows);

        // CENTERED GEOMETRY
        const aspectRatio = config.aspectRatio || 1.0;
        const geometry = new THREE.PlaneGeometry(2 * aspectRatio, 2);

        const mesh = new THREE.Mesh(geometry, material);
        mesh.userData = { config };

        return mesh;
    }

    public static applyCustomization(material: THREE.ShaderMaterial, cust: CharacterCustomization): void {
        material.uniforms.colorSkin.value.set(cust.colors.skin);
        material.uniforms.colorHair.value.set(cust.colors.hair);
        material.uniforms.colorBase.value.set(cust.colors.base);
        material.uniforms.colorSecondary.value.set(cust.colors.secondary);
        material.uniforms.colorDetail.value.set(cust.colors.detail);
    }


    public static updateSprite(mesh: THREE.Mesh, state: AnimationState, deltaTime: number, autoScale: boolean = true): void {
        const config = mesh.userData.config as SpriteConfig;
        if (!config) return;

        state.lastUpdate += deltaTime;
        const interval = 1 / config.frameRate;

        if (state.lastUpdate >= interval) {
            state.frame = (state.frame + 1) % config.totalFrames;
            state.lastUpdate = 0;
        }

        const col = state.frame % config.cols;
        const row = (config.rows - 1) - state.direction;
        const material = mesh.material as THREE.ShaderMaterial;
        material.uniforms.offset.value.set(col / config.cols, row / config.rows);


        // ✅ SCALE CONSISTENT POUR ISO (Style Dofus)
        if (autoScale) {
            // Une tuile fait 6.4 unités. 
            // Un perso à 5.5 unités de haut (base 2 * 2.75) fit bien.
            const targetScale = 2.75;
            mesh.scale.set(targetScale, targetScale, targetScale);
        }
    }

    public static calculateDirection(velocity: THREE.Vector3): number {
        if (velocity.lengthSq() < 0.01) return 0;
        const angle = Math.atan2(velocity.x, velocity.z);
        let dir = Math.round(angle / (Math.PI / 4));
        if (dir < 0) dir += 8;
        return dir % 8;
    }
}
