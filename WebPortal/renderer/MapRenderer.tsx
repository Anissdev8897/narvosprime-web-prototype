import React, { useEffect, useRef, useState } from 'react';
import { socket } from '../net/socket';

interface MapRendererProps {
    mapId: string;
    onTileClick?: (x: number, y: number) => void;
}

/**
 * 🗺️ NARVOS PRIME - MAP RENDERER
 * Gère l'affichage haute performance des cartes et des props.
 * Utilise Canvas pour une fluidité maximale (60 FPS).
 */
export const MapRenderer: React.FC<MapRendererProps> = ({ mapId, onTileClick }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [mapData, setMapData] = useState<any>(null);
    const TILE_SIZE = 100;

    useEffect(() => {
        // Demander les données de la carte au serveur dès que le mapId change
        socket.send({ type: 'REQUEST_MAP_DATA', data: { mapId } });

        const handleMapData = (data: any) => {
            if (data.id === mapId) {
                setMapData(data);
            }
        };

        // Écouter les données de la carte
        // Note: socket.onMapData est une abstraction que nous devrons ajouter à socket.ts
        // Pour l'instant on utilise le mécanisme générique
        const cleanup = socket.on('MAP_DATA', handleMapData);

        return () => cleanup();
    }, [mapId]);

    useEffect(() => {
        if (!mapData || !canvasRef.current) return;

        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;

        // Charger l'image de fond
        const bgImage = new Image();
        bgImage.src = mapData.backgroundUrl;
        bgImage.onload = () => {
            render(ctx, bgImage);
        };
    }, [mapData]);

    const render = (ctx: CanvasRenderingContext2D, bgImage: HTMLImageElement) => {
        if (!mapData) return;

        // 1. Dessiner le fond
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.drawImage(bgImage, 0, 0, ctx.canvas.width, ctx.canvas.height);

        // 2. Dessiner la grille (Optionnel/Debug)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        for (let x = 0; x < ctx.canvas.width; x += TILE_SIZE) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, ctx.canvas.height);
            ctx.stroke();
        }
        for (let y = 0; y < ctx.canvas.height; y += TILE_SIZE) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(ctx.canvas.width, y);
            ctx.stroke();
        }

        // 3. Dessiner les props (arbres, rochers)
        mapData.props?.forEach((prop: any) => {
            // Logique de dessin des props (simplifiée)
            ctx.fillStyle = 'rgba(0, 255, 0, 0.3)';
            ctx.fillRect(prop.x, prop.y, prop.width || 50, prop.height || 50);
        });
    };

    const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect || !onTileClick) return;

        const x = Math.floor((e.clientX - rect.left) / TILE_SIZE);
        const y = Math.floor((e.clientY - rect.top) / TILE_SIZE);
        onTileClick(x, y);
    };

    return (
        <div className="relative w-full h-full overflow-hidden bg-slate-900 rounded-xl shadow-2xl border border-slate-700">
            <canvas
                ref={canvasRef}
                width={1000}
                height={800}
                onClick={handleCanvasClick}
                className="cursor-pointer transition-opacity duration-500"
            />

            {/* HUD de Map */}
            <div className="absolute top-4 left-4 bg-slate-900/80 backdrop-blur-md p-3 rounded-lg border border-slate-600">
                <h3 className="text-white font-bold text-sm">{mapData?.name || 'Chargement...'}</h3>
                <p className="text-slate-400 text-xs">Coords: {mapData?.coord_x}, {mapData?.coord_y}</p>
            </div>
        </div>
    );
};
