
import React, { useState } from 'react';
import { PLANETS } from '../constants';
import { PlanetConfig } from '../types';

interface MapSelectorProps {
    onSelect: (planetId: string) => void;
    onCancel: () => void;
    isOpen: boolean;
    mode: 'PLAYING' | 'EDITOR'; // ✅ NOUVEAU
}

export const MapSelector: React.FC<MapSelectorProps> = ({ onSelect, onCancel, isOpen, mode }) => {
    const [selectedId, setSelectedId] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleConfirm = () => {
        if (selectedId) {
            onSelect(selectedId);
        }
    };

    // ✅ Filtrer la liste des planètes
    const displayedPlanets = PLANETS.filter(p => p.id !== 'mezalayis');

    // ✅ Ajouter le Spawn (Hub) et l'Espace pour l'éditeur
    const mapOptions = [
        ...(mode === 'EDITOR' ? [
            { id: 'hub', name: 'SPAWN (HUB)', color: 0xcccccc },
            { id: 'space', name: 'ESPACE', color: 0x000000 } // ✅ NOUVEAU
        ] : []),
        ...displayedPlanets
    ];

    return (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="w-[400px] bg-slate-900 border border-slate-700 rounded-lg overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="p-4 bg-slate-800 border-b border-slate-700">
                    <h2 className="text-xl font-bold text-white tracking-widest uppercase">
                        {mode === 'EDITOR' ? 'SELECT EDITOR MAP' : 'MAP SELECTION'}
                    </h2>
                </div>

                {/* List */}
                <div className="p-4 max-h-[400px] overflow-y-auto space-y-2">
                    {mapOptions.map((planet) => (
                        <div
                            key={planet.id}
                            onClick={() => setSelectedId(planet.id)}
                            className={`
                cursor-pointer p-3 rounded border transition-all duration-200 flex items-center gap-3
                ${selectedId === planet.id
                                    ? 'bg-blue-600/20 border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]'
                                    : 'bg-slate-800 border-slate-700 hover:bg-slate-700 hover:border-slate-500'}
              `}
                        >
                            <div
                                className="w-4 h-4 rounded-full shadow-sm"
                                style={{ backgroundColor: `#${(planet.color || 0xcccccc).toString(16).padStart(6, '0')}` }}
                            ></div>
                            <span className={`text-sm font-mono uppercase tracking-wider ${selectedId === planet.id ? 'text-white font-bold' : 'text-slate-300'}`}>
                                {planet.name}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-800 border-t border-slate-700 flex justify-end gap-3">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-xs font-bold text-slate-400 uppercase hover:text-white transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!selectedId}
                        className={`
              px-6 py-2 text-xs font-bold text-white uppercase rounded transition-all duration-200
              ${selectedId
                                ? 'bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/20'
                                : 'bg-slate-600 cursor-not-allowed opacity-50'}
            `}
                    >
                        Confirm
                    </button>
                </div>
            </div>
        </div>
    );
};
