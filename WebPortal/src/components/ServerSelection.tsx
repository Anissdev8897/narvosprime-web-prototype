
import React, { useState, useRef, useEffect } from 'react';
import { Server, Users, ShieldAlert, Zap, Info, ScrollText, CheckCircle2, ChevronRight, Skull } from 'lucide-react';
import { hardcoreLadder, fallenIds } from '../rpg/runtime/hardcoreLadder';
import { APP_VERSION } from '../utils/version';

// ─── REFONTE : vidéos d'ambiance pour chaque carte serveur ────────────────
// Fichiers présents dans WebPortal/public/models/launcher/ui/
const SERVER_VIDEO_BG = '/models/launcher/ui/animate-this-underwater-alien-city-scene-with-gent.mp4';
const SERVER_VIDEOS: Record<string, string> = {
    HEROIC: '/models/launcher/ui/server_warrior.mp4',
    NORMAL: '/models/launcher/ui/server_tree.mp4',
};

// Use same types as the project
export enum ServerType {
    NORMAL = 'NORMAL',
    HEROIC = 'HEROIC',
    TOURNAMENT = 'TOURNAMENT'
}

export interface GameServer {
    id: string;
    name: string;
    type: ServerType;
    description: string;
    status: 'ONLINE' | 'OFFLINE' | 'MAINTENANCE';
    population: 'LOW' | 'MEDIUM' | 'HIGH' | 'FULL';
    xpRate: number;
}

interface ServerSelectionProps {
    onSelect: (server: GameServer) => void;
    username?: string | null;
}

const SERVERS: GameServer[] = [
    {
        id: 'heroic_1',
        name: 'Guerrier Multi-Élém',
        type: ServerType.HEROIC,
        description: 'Serveur Héroïque : La mort est définitive. Seuls les plus braves survivront dans ce chaos élémentaire.',
        status: 'ONLINE',
        population: 'HIGH',
        xpRate: 3
    },
    {
        id: 'normal_1',
        name: 'Arbre de Vie',
        type: ServerType.NORMAL,
        description: 'Serveur Paradisiaque : Un havre de paix où la mort n\'est qu\'un passage. Idéal pour bâtir une légende durable, sans rien perdre.',
        status: 'ONLINE',
        population: 'MEDIUM',
        xpRate: 1
    }
];

export const ServerSelection: React.FC<ServerSelectionProps> = ({ onSelect, username }) => {
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [hoveredId, setHoveredId] = useState<string | null>(null);

    const handleServerSelect = (server: GameServer) => {
        setSelectedId(server.id);
        // On laisse un petit délai pour l'animation avant de quitter
        setTimeout(() => {
            onSelect(server);
        }, 300);
    };

    const selectedServer = SERVERS.find(s => s.id === selectedId) || null;

    return (
        <div className="fixed inset-0 flex items-center justify-center bg-black overflow-hidden select-none">
            {/* ─── REFONTE : Background vidéo "underwater alien city" en autoplay ─── */}
            <div className="absolute inset-0 overflow-hidden">
                <video
                    src={SERVER_VIDEO_BG}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="absolute inset-0 w-full h-full object-cover opacity-50 scale-105"
                    onError={(e) => console.warn('[ServerSelection] BG video failed:', e)}
                />
                <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-950/40 to-slate-950"></div>
                {/* Fallback : si la vidéo plante, on a au moins l'image */}
                <div
                    className="absolute inset-0 bg-cover bg-center opacity-30 mix-blend-overlay"
                    style={{ backgroundImage: `url('/textures/launcher/uploaded_image_0_1767472596705.jpg')` }}
                />
            </div>

            {/* UI Container */}
            <div className="relative w-full max-w-6xl h-[80vh] flex flex-col gap-8 px-12 z-10 animate-fade-in">

                {/* Header */}
                <div className="flex justify-between items-end border-b border-cyan-500/30 pb-4">
                    <div>
                        <h2 className="text-4xl font-black text-cyan-400 italic flex items-center gap-4">
                            <Server size={32} /> CHOIX DU SERVEUR
                        </h2>
                        <p className="text-slate-400 text-sm font-mono mt-1">Connecté en tant que : <span className="text-white">{username || 'Invité'}</span></p>
                    </div>
                    <div className="flex gap-4 text-xs font-bold uppercase tracking-widest text-slate-500">
                        <span className="flex items-center gap-1 text-green-400"><CheckCircle2 size={14} /> Système Opérationnel</span>
                        <span>{APP_VERSION}</span>
                    </div>
                </div>

                {/* Main Content: Card List */}
                <div className="flex-1 flex gap-8 py-4">

                    {/* Servers Grid */}
                    <div className="flex-1 grid grid-cols-2 gap-8">
                        {SERVERS.map((server) => (
                            <div
                                key={server.id}
                                onClick={() => handleServerSelect(server)}
                                onMouseEnter={() => setHoveredId(server.id)}
                                onMouseLeave={() => setHoveredId(null)}
                                className={`relative flex flex-col rounded-2xl cursor-pointer overflow-hidden transition-all duration-300 transform
                                    ${selectedId === server.id ? 'ring-4 ring-orange-500 scale-[0.98]' : 'hover:scale-[1.02]'}
                                    bg-slate-900/60 border border-white/10 shadow-2xl group
                                `}
                            >
                                {/* ─── REFONTE : Vidéo d'ambiance par type de serveur ─── */}
                                <ServerCardVideo
                                    src={SERVER_VIDEOS[server.type]}
                                    hovered={hoveredId === server.id}
                                />

                                {/* Header de la carte */}
                                <div className="relative z-10 p-6 flex justify-between items-start">
                                    <div className="px-3 py-1 bg-black/60 rounded border border-cyan-500/30 backdrop-blur-sm">
                                        <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">
                                            {server.name}
                                        </h3>
                                    </div>
                                    <div className={`px-2 py-2 rounded-full backdrop-blur-md border shadow-lg
                                        ${server.type === ServerType.HEROIC ? 'bg-red-500/20 border-red-500/50' : 'bg-cyan-500/20 border-cyan-500/50'}
                                    `}>
                                        {server.type === ServerType.HEROIC ? <ShieldAlert className="text-red-400" size={24} /> : <Zap className="text-cyan-400" size={24} />}
                                    </div>
                                </div>

                                {/* Footer de la carte (Description de l'image) */}
                                <div className="mt-auto relative z-10 p-6 bg-gradient-to-t from-black to-transparent">
                                    <div className="flex items-center gap-4 mb-3">
                                        <div className="flex items-center gap-2 text-xs font-bold text-green-400">
                                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                            EN LIGNE
                                        </div>
                                        <div className="flex items-center gap-1 text-xs font-bold text-slate-400">
                                            <Users size={12} /> {server.population}
                                        </div>
                                    </div>
                                    <p className="text-sm text-slate-200 leading-relaxed font-medium line-clamp-3 italic opacity-80 group-hover:opacity-100 transition-opacity">
                                        "{server.description}"
                                    </p>
                                </div>

                                {/* Hover Glow */}
                                <div className="absolute inset-0 bg-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                            </div>
                        ))}
                    </div>

                    {/* Server Inspector (Right Panel) */}
                    <div className="w-80 flex flex-col gap-4">

                        {/* Selected Server Details */}
                        <div className="flex-1 bg-slate-900/80 border border-white/5 rounded-2xl p-6 flex flex-col gap-6">
                            <h4 className="text-xs font-black text-cyan-400 uppercase tracking-widest flex items-center gap-2">
                                <Info size={14} /> Détails de Session
                            </h4>

                            <div className="space-y-4">
                                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                    <span className="text-slate-400 text-xs uppercase font-bold">XP Rate</span>
                                    <span className="text-white font-black text-lg">x{selectedServer?.xpRate || 1}</span>
                                </div>
                                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                    <span className="text-slate-400 text-xs uppercase font-bold">Type</span>
                                    <span className={`font-black text-sm uppercase ${selectedServer?.type === ServerType.HEROIC ? 'text-red-400' : 'text-cyan-400'}`}>
                                        {selectedServer?.type === ServerType.HEROIC ? 'MORT DÉFINITIVE' : 'PARADISIAQUE'}
                                    </span>
                                </div>
                            </div>

                            {/* Tableau des Morts — la vitrine du serveur Mort Définitive */}
                            {selectedServer?.type === ServerType.HEROIC && (
                                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                                    <h4 className="text-red-400 text-xs font-black uppercase tracking-widest flex items-center gap-2 mb-2">
                                        <Skull size={14} /> Tableau des Morts
                                    </h4>
                                    {hardcoreLadder.top(5).length === 0 ? (
                                        <p className="text-xs text-red-200/60 italic">Aucun héros n'est encore tombé. Serez-vous le premier ?</p>
                                    ) : (
                                        <ul className="text-xs text-red-200/80 space-y-1 font-mono">
                                            {hardcoreLadder.top(5).map((e, i) => (
                                                <li key={i}>#{i + 1} {e.name} · niv {e.level} · tué par {e.killedBy}</li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            )}

                            {/* Personnages Verrouillés — mort définitive active */}
                            {selectedServer?.type === ServerType.HEROIC && (
                                <FallenWarning />
                            )}

                            <div className="mt-auto p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl">
                                <h4 className="text-orange-500 text-xs font-black uppercase tracking-widest flex items-center gap-2 mb-2">
                                    <ScrollText size={14} /> Règles
                                </h4>
                                <ul className="text-xs text-orange-200/70 space-y-2 font-medium italic">
                                    <li>• {selectedServer?.type === ServerType.HEROIC ? "Mort Définitive activée — un seul essai" : "Monde paradisiaque — aucune perte à la mort"}</li>
                                    <li>• {selectedServer?.xpRate && selectedServer.xpRate > 1 ? "Bonus XP actif sur tout le serveur" : "XP standard"}</li>
                                    <li>• Économie inter-factions limitée</li>
                                </ul>
                            </div>
                        </div>

                        {/* Play Button */}
                        <button
                            disabled={!selectedId}
                            onClick={() => selectedServer && handleServerSelect(selectedServer)}
                            className={`w-full py-5 rounded-2xl font-black text-xl uppercase tracking-widest transition-all flex items-center justify-center gap-3 overflow-hidden group
                                ${selectedId
                                    ? 'bg-orange-600 text-white shadow-lg hover:shadow-orange-500/40 hover:bg-orange-500'
                                    : 'bg-slate-800 text-slate-500'
                                }
                            `}
                        >
                            <span className="relative z-10">VALIDER</span>
                            <ChevronRight size={24} className={`relative z-10 group-hover:translate-x-1 transition-transform`} />

                            {/* Animated Background on active */}
                            {selectedId && (
                                <div className="absolute inset-0 bg-gradient-to-r from-orange-600 via-white/20 to-orange-600 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                            )}
                        </button>

                    </div>
                </div>
            </div>

            {/* Animations CSS */}
            <style>{`
                @keyframes slow-pan {
                    0% { transform: scale(1.05) translate(0, 0); }
                    50% { transform: scale(1.1) translate(-1%, -1%); }
                    100% { transform: scale(1.05) translate(0, 0); }
                }
                .animate-slow-pan { animation: slow-pan 30s ease-in-out infinite; }

                @keyframes fade-in {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in { animation: fade-in 0.8s ease-out; }
            `}</style>
        </div>
    );
};

/**
 * ServerCardVideo — vidéo de carte serveur avec auto-play + hover boost.
 *
 * - Le `<video>` est muet (requis par les navigateurs pour l'autoplay)
 * - Loop infini
 * - Au hover : scale + saturation augmentés (cohérent avec l'ancien comportement
 *   d'image)
 * - Fallback noir si la vidéo plante (onError silencieux + opacity 60)
 */
const ServerCardVideo: React.FC<{ src: string; hovered: boolean }> = ({ src, hovered }) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const v = videoRef.current;
        if (!v) return;
        // Tentative explicite de play (certains navigateurs n'autoplay pas tout de suite)
        v.play().catch(() => {/* silencieux : autoplay bloqué = OK, on a un poster */});
    }, []);

    return (
        <div className="absolute inset-0 z-0 overflow-hidden">
            <video
                ref={videoRef}
                src={src}
                autoPlay
                loop
                muted
                playsInline
                preload="auto"
                onError={() => console.warn(`[ServerCardVideo] Failed: ${src}`)}
                className={`w-full h-full object-cover transition-all duration-700
                    ${hovered ? 'scale-110 saturate-150' : 'scale-100 saturate-100 opacity-65'}
                `}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent"></div>
        </div>
    );
};

/**
 * FallenWarning — affiche la liste des personnages verrouillés (mort définitive)
 * sur un serveur HEROIC. Utilise l'accessor fallenIds() pour éviter de dupliquer
 * la clé de stockage.
 */
const FallenWarning: React.FC = () => {
    const [fallenList, setFallenList] = useState<string[]>([]);

    useEffect(() => {
        try {
            setFallenList(fallenIds());
        } catch { setFallenList([]); }
    }, []);

    if (fallenList.length === 0) return null;

    return (
        <div className="p-3 bg-red-600/15 border-2 border-red-500/40 rounded-xl animate-pulse">
            <h4 className="text-red-400 text-xs font-black uppercase tracking-widest flex items-center gap-2 mb-2">
                <Skull size={14} /> Personnages Verrouillés
            </h4>
            <p className="text-xs text-red-300/80 font-mono leading-relaxed">
                {fallenList.length} personnage{fallenList.length > 1 ? "s" : ""} définitivement mort{fallenList.length > 1 ? "s" : ""}.
                <br />
                <span className="text-red-400/60 italic">
                    Ces héros ne peuvent plus être rejoués sur ce serveur.
                </span>
            </p>
        </div>
    );
};
