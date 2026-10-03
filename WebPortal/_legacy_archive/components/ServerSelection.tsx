
import React, { useState, useEffect } from 'react';
import { Server, Users, ShieldAlert, Zap, Lock, Info, ScrollText, CheckCircle2, ChevronRight } from 'lucide-react';
import { audioService } from '../services/audioService';
import { GameServer, ServerType } from '../types';

interface ServerSelectionProps {
    onSelect: (server: GameServer) => void;
    currentUser?: string | null;
}

const SERVERS: GameServer[] = [
    {
        id: '1',
        name: 'Guerrier Multi-Élém',
        type: ServerType.HEROIC,
        description: 'Serveur Héroïque : La mort est définitive. Seuls les plus braves survivront dans ce chaos élémentaire.',
        status: 'ONLINE',
        population: 'HIGH',
        xpRate: 3
    },
    {
        id: '2',
        name: 'Arbre de Vie',
        type: ServerType.NORMAL,
        description: 'Serveur Classique : Un havre de paix où les éléments de la nature s\'équilibrent. Idéal pour bâtir une légende durable.',
        status: 'ONLINE',
        population: 'MEDIUM',
        xpRate: 1
    }
];

export const ServerSelection: React.FC<ServerSelectionProps> = ({ onSelect, currentUser }) => {
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
            {/* Background (cohérent avec le login) */}
            <div
                className="absolute inset-0 bg-cover bg-center opacity-40 scale-105 animate-slow-pan"
                style={{ backgroundImage: `url('/textures/launcher/uploaded_image_0_1767472596705.jpg')` }}
            >
                <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-transparent to-slate-950"></div>
            </div>

            {/* UI Container */}
            <div className="relative w-full max-w-6xl h-[80vh] flex flex-col gap-8 px-12 z-10 animate-fade-in">

                {/* Header */}
                <div className="flex justify-between items-end border-b border-cyan-500/30 pb-4">
                    <div>
                        <h2 className="text-4xl font-black text-cyan-400 italic flex items-center gap-4">
                            <Server size={32} /> CHOIX DU SERVEUR
                        </h2>
                        <p className="text-slate-400 text-sm font-mono mt-1">Connecté en tant que : <span className="text-white">{currentUser || 'Invité'}</span></p>
                    </div>
                    <div className="flex gap-4 text-xs font-bold uppercase tracking-widest text-slate-500">
                        <span className="flex items-center gap-1 text-green-400"><CheckCircle2 size={14} /> Système Opérationnel</span>
                        <span>v1.0.4-ALPHA</span>
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
                                {/* Server Image Overlay */}
                                <div className="absolute inset-0 z-0">
                                    <img
                                        src={server.type === ServerType.HEROIC ? '/textures/launcher/ui/server_warrior.png' : '/textures/launcher/ui/server_tree.png'}
                                        alt={server.name}
                                        className={`w-full h-full object-cover transition-transform duration-700 
                                            ${hoveredId === server.id ? 'scale-110 saturate-125' : 'scale-100 opacity-60'}
                                        `}
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent"></div>
                                </div>

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
                                        {selectedServer?.type || 'NORMAL'}
                                    </span>
                                </div>
                            </div>

                            <div className="mt-auto p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl">
                                <h4 className="text-orange-500 text-xs font-black uppercase tracking-widest flex items-center gap-2 mb-2">
                                    <ScrollText size={14} /> Règles
                                </h4>
                                <ul className="text-xs text-orange-200/70 space-y-2 font-medium italic">
                                    <li>• {selectedServer?.type === ServerType.HEROIC ? "Mort Définitive activée" : "Progression persistante"}</li>
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
