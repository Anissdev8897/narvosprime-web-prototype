
import * as THREE from 'three';

/**
 * Shader personnalisé pour le "Color Masking" (Style Dofus)
 * Remplace les canaux de couleur R, G, B d'un masque par des couleurs choisies.
 */
export const ColorMaskShader = {
    uniforms: {
        tDiffuse: { value: null },      // Texture d'albedo de base (tons gris/ombres)
        tMask: { value: null },         // Texture de masque (R=Peau, G=Armure, B=Détails)
        colorR: { value: new THREE.Color(1, 0, 0) }, // Couleur pour zone Rouge
        colorG: { value: new THREE.Color(0, 1, 0) }, // Couleur pour zone Verte
        colorB: { value: new THREE.Color(0, 0, 1) }, // Couleur pour zone Bleue
        brightness: { value: 1.0 }
    },
    vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
    fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform sampler2D tMask;
    uniform vec3 colorR;
    uniform vec3 colorG;
    uniform vec3 colorB;
    uniform float brightness;
    varying vec2 vUv;

    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      vec4 mask = texture2D(tMask, vUv);

      // Calculer la couleur finale en mélangeant les masques
      // On utilise le canal de couleur multiplié par l'intensité du masque et l'albedo (pour garder les ombres)
      vec3 finalColor = texel.rgb;
      
      // Application dynamique des couleurs
      // Plus la valeur du canal est haute dans le masque, plus on applique la couleur choisie
      finalColor = mix(finalColor, colorR * texel.rgb, mask.r);
      finalColor = mix(finalColor, colorG * texel.rgb, mask.g);
      finalColor = mix(finalColor, colorB * texel.rgb, mask.b);

      gl_FragColor = vec4(finalColor * brightness, texel.a);
    }
  `
};

export class CustomizationService {
    /**
     * Applique les couleurs de personnalisation à un mesh via le shader
     */
    public static applyCustomization(mesh: THREE.Mesh, colors: { primary: string, secondary: string, detail: string }): void {
        if (!(mesh.material instanceof THREE.ShaderMaterial) || mesh.material.name !== 'ColorMaskMaterial') {
            const material = new THREE.ShaderMaterial({
                ...ColorMaskShader,
                transparent: true,
                name: 'ColorMaskMaterial'
            });
            // Copier les textures si elles existent sur l'ancien matériel
            if ((mesh.material as any).map) material.uniforms.tDiffuse.value = (mesh.material as any).map;
            mesh.material = material;
        }

        const mat = mesh.material as THREE.ShaderMaterial;
        mat.uniforms.colorR.value.set(colors.primary);
        mat.uniforms.colorG.value.set(colors.secondary);
        mat.uniforms.colorB.value.set(colors.detail);
    }

    /**
     * Attache un équipement modulaire à un squelette
     */
    public static equipItem(parentBone: THREE.Bone, itemMesh: THREE.Object3D): void {
        parentBone.add(itemMesh);
    }
}
