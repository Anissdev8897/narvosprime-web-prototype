import React, { useEffect, useRef, useState } from 'react';

interface SpriteColors {
    hair?: string;
    eyes?: string;
    skin?: string;
    jacket?: string;
    pants?: string;
    shoes?: string;
}

interface ColoredSpriteProps {
    src: string;
    colors: SpriteColors;
    className?: string;
    style?: React.CSSProperties;
    alt?: string;
}

/**
 * Composant qui affiche un sprite avec des couleurs personnalisées.
 * Utilise des filtres HSL pour recolorer dynamiquement les zones du sprite.
 */
export const ColoredSprite: React.FC<ColoredSpriteProps> = ({
    src,
    colors,
    className = '',
    style = {},
    alt = 'Sprite'
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [processedSrc, setProcessedSrc] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const processImage = async () => {
            if (!src) return;

            setIsLoading(true);

            try {
                const img = new Image();
                img.crossOrigin = 'anonymous';

                await new Promise<void>((resolve, reject) => {
                    img.onload = () => resolve();
                    img.onerror = reject;
                    img.src = src;
                });

                const canvas = canvasRef.current;
                if (!canvas) return;

                const ctx = canvas.getContext('2d');
                if (!ctx) return;

                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);

                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;

                // Appliquer les modifications de couleur
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    const a = data[i + 3];

                    if (a < 10) continue; // Skip transparent pixels

                    // Convertir en HSL pour analyser la couleur
                    const hsl = rgbToHsl(r, g, b);
                    const h = hsl[0] * 360;
                    const s = hsl[1];
                    const l = hsl[2];

                    // Détecter et recolorer les zones spécifiques basées sur la teinte
                    let newColor: [number, number, number] | null = null;

                    // Cheveux (généralement des couleurs saturées variées)
                    if (colors.hair && s > 0.2 && l > 0.2 && l < 0.8) {
                        // Teintes brunes/noires/blondes typiques des cheveux
                        if ((h >= 0 && h <= 50) || (h >= 330 && h <= 360) || (h >= 200 && h <= 280)) {
                            newColor = applyColorShift([r, g, b], colors.hair, 0.4);
                        }
                    }

                    // Peau (teintes chair/beige)
                    if (colors.skin && !newColor) {
                        if ((h >= 0 && h <= 40) && s > 0.15 && s < 0.7 && l > 0.5 && l < 0.9) {
                            newColor = applyColorShift([r, g, b], colors.skin, 0.3);
                        }
                    }

                    // Veste/Armure (couleurs saturées principales)
                    if (colors.jacket && !newColor) {
                        if (s > 0.3 && l > 0.2 && l < 0.7) {
                            newColor = applyColorShift([r, g, b], colors.jacket, 0.5);
                        }
                    }

                    // Pantalon (généralement plus sombre)
                    if (colors.pants && !newColor) {
                        if (l > 0.15 && l < 0.5 && s > 0.1) {
                            newColor = applyColorShift([r, g, b], colors.pants, 0.4);
                        }
                    }

                    // Chaussures (très sombres)
                    if (colors.shoes && !newColor) {
                        if (l < 0.3 && s < 0.5) {
                            newColor = applyColorShift([r, g, b], colors.shoes, 0.3);
                        }
                    }

                    // Appliquer la nouvelle couleur si trouvée
                    if (newColor) {
                        data[i] = newColor[0];
                        data[i + 1] = newColor[1];
                        data[i + 2] = newColor[2];
                    }
                }

                ctx.putImageData(imageData, 0, 0);
                setProcessedSrc(canvas.toDataURL('image/png'));
            } catch (error) {
                console.error('Error processing sprite:', error);
                setProcessedSrc(src); // Fallback to original
            } finally {
                setIsLoading(false);
            }
        };

        processImage();
    }, [src, colors.hair, colors.eyes, colors.skin, colors.jacket, colors.pants, colors.shoes]);

    return (
        <>
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            {processedSrc ? (
                <img
                    src={processedSrc}
                    className={className}
                    style={style}
                    alt={alt}
                />
            ) : (
                <img
                    src={src}
                    className={className}
                    style={{ ...style, opacity: isLoading ? 0.5 : 1 }}
                    alt={alt}
                />
            )}
        </>
    );
};

// Convertir RGB en HSL
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

        switch (max) {
            case r:
                h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
                break;
            case g:
                h = ((b - r) / d + 2) / 6;
                break;
            case b:
                h = ((r - g) / d + 4) / 6;
                break;
        }
    }

    return [h, s, l];
}

// Convertir HSL en RGB
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
    let r, g, b;

    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p: number, q: number, t: number) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };

        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

// Convertir hex en RGB
function hexToRgb(hex: string): [number, number, number] {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
        return [
            parseInt(result[1], 16),
            parseInt(result[2], 16),
            parseInt(result[3], 16)
        ];
    }
    return [128, 128, 128];
}

// Appliquer un décalage de couleur vers une couleur cible
function applyColorShift(
    original: [number, number, number],
    targetHex: string,
    intensity: number
): [number, number, number] {
    const target = hexToRgb(targetHex);
    const targetHsl = rgbToHsl(target[0], target[1], target[2]);
    const originalHsl = rgbToHsl(original[0], original[1], original[2]);

    // Mélanger la teinte de la cible avec la luminosité originale
    const newH = targetHsl[0];
    const newS = originalHsl[1] * (1 - intensity) + targetHsl[1] * intensity;
    const newL = originalHsl[2]; // Garder la luminosité originale pour préserver les ombres

    return hslToRgb(newH, newS, newL);
}

export default ColoredSprite;
