
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Hash, Grid, Package, Download, Play, ChevronRight, X, Layers } from 'lucide-react';

interface TileMapData {
    name: string;
    faction: string;
    tileSize: number;
    cols: number;
    rows: number;
    totalUniqueTiles: number;
    data: number[][];
}

/**
 * NarvosTileset: Votre outil personnel de gestion de tilesets
 */
export const TilesetEditor: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onTestMap?: (faction: string, mapId: string) => void;
}> = ({ isOpen, onClose, onTestMap }) => {
    const [factions, setFactions] = useState<string[]>([]);
    const [fullManifest, setFullManifest] = useState<Record<string, string[]>>({});
    const [selectedFaction, setSelectedFaction] = useState('');
    const [maps, setMaps] = useState<string[]>([]);
    const [selectedMap, setSelectedMap] = useState<string | null>(null);
    const [mapData, setMapData] = useState<TileMapData | null>(null);
    const [hoveredTile, setHoveredTile] = useState<{ r: number, c: number } | null>(null);

    const loadManifest = async () => {
        try {
            let response = await fetch('/tilesets/manifest.json').catch(() => null);
            if (!response || !response.ok) {
                response = await fetch('./tilesets/manifest.json').catch(() => null);
            }
            if (response && response.ok) {
                const data = await response.json();
                setFullManifest(data);
                const factionList = Object.keys(data);
                setFactions(factionList);
                if (factionList.length > 0 && !selectedFaction) setSelectedFaction(factionList[0]);
            }
        } catch (e) { console.error(e); }
    };

    useEffect(() => {
        if (isOpen) loadManifest();
    }, [isOpen]);

    useEffect(() => {
        if (selectedFaction && fullManifest[selectedFaction]) {
            setMaps(fullManifest[selectedFaction]);
            setSelectedMap(null);
            setMapData(null);
        }
    }, [selectedFaction, fullManifest]);

    useEffect(() => {
        if (selectedMap) {
            const f = encodeURIComponent(selectedFaction);
            const m = encodeURIComponent(selectedMap);
            const url = `/tilesets/${f}/${m}/map_data.json`;

            fetch(url)
                .then(res => {
                    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                    const contentType = res.headers.get('content-type');
                    if (!contentType || !contentType.includes('application/json')) {
                        throw new Error(`Invalid content-type: ${contentType} (expected JSON)`);
                    }
                    return res.json();
                })
                .then(data => setMapData(data))
                .catch(err => {
                    // Only log if it's a real error (not just missing file during browsing)
                    if (selectedMap) {
                        console.warn(`⚠️ [NarvosTileset] Map non trouvée: ${selectedMap}`);
                    }
                    setMapData(null);
                });
        }
    }, [selectedMap, selectedFaction]);

    const formatName = (name: string) => {
        return name.replace(/_/g, ' ').replace(/\.png$/i, '').toUpperCase();
    };

    const [activeCategory, setActiveCategory] = useState<'ALL' | 'VILLE' | 'DONJON' | 'EXTERIEUR' | 'CHEMIN'>('ALL');

    const categories = [
        { id: 'ALL', label: 'TOUT', color: 'text-white' },
        { id: 'VILLE', label: 'VILLES', color: 'text-emerald-400' },
        { id: 'DONJON', label: 'DONJONS', color: 'text-red-400' },
        { id: 'EXTERIEUR', label: 'EXTÉRIEUR', color: 'text-amber-400' },
        { id: 'CHEMIN', label: 'CHEMINS', color: 'text-cyan-400' }
    ];

    const filteredMaps = maps.filter(m => {
        if (activeCategory === 'ALL') return true;
        const name = m.toUpperCase();
        if (activeCategory === 'VILLE') return name.includes('VILLE') || name.includes('STATION_01');
        if (activeCategory === 'DONJON') return name.includes('DONJON');
        if (activeCategory === 'EXTERIEUR') return name.includes('EXTERIEUR') || name.includes('OUTDOOR');
        if (activeCategory === 'CHEMIN') return name.includes('CHEMIN');
        return true;
    });

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[10000] bg-slate-950/90 backdrop-blur-xl flex flex-col font-sans uppercase tracking-tight text-white overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10 bg-white/5">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <Grid size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black italic tracking-tighter leading-none">NarvosTileset <span className="text-blue-500">v1.1</span></h1>
                        <p className="text-[10px] text-white/40 font-black tracking-widest">Adaptateur Global & Moteur de Tuiles</p>
                    </div>
                </div>
                <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all">
                    <X size={20} />
                </button>
            </div>

            <div className="flex-1 flex overflow-hidden">

                {/* Sidebar: Browser */}
                <div className="w-80 border-r border-white/10 p-6 flex flex-col gap-8 bg-black/20 overflow-y-auto">

                    <section className="space-y-4">
                        <h3 className="text-[10px] text-blue-400 font-black tracking-widest flex items-center gap-2">
                            <Layers size={14} /> RÉGIONS DÉTECTÉES
                        </h3>
                        <div className="space-y-2">
                            {factions.map(f => (
                                <button
                                    key={f}
                                    onClick={() => setSelectedFaction(f)}
                                    className={`w-full text-left px-4 py-3 rounded-xl border transition-all text-xs font-black
                                    ${selectedFaction === f ? 'bg-blue-600/20 border-blue-500/50 text-white' : 'bg-white/5 border-transparent text-white/40 hover:bg-white/10'}
                                `}
                                >
                                    {f.replace(/_/g, ' ')}
                                </button>
                            ))}
                        </div>
                    </section>

                    <section className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-[10px] text-pink-400 font-black tracking-widest flex items-center gap-2">
                                <Package size={14} /> FILTRAGE MAPS
                            </h3>
                        </div>

                        {/* Categories Tabs */}
                        <div className="grid grid-cols-1 gap-1">
                            {categories.map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => setActiveCategory(cat.id as any)}
                                    className={`px-3 py-2 rounded-lg text-[10px] font-black text-left transition-all flex items-center justify-between
                                        ${activeCategory === cat.id ? 'bg-white/10 ring-1 ring-white/10' : 'opacity-40 hover:opacity-100 hover:bg-white/5'}
                                    `}
                                >
                                    <span className={cat.color}>{cat.label}</span>
                                    <span className="text-[8px] bg-black/40 px-1.5 py-0.5 rounded border border-white/5">
                                        {maps.filter(m => {
                                            const name = m.toUpperCase();
                                            if (cat.id === 'ALL') return true;
                                            if (cat.id === 'VILLE') return name.includes('VILLE') || name.includes('STATION_01');
                                            if (cat.id === 'DONJON') return name.includes('DONJON');
                                            if (cat.id === 'EXTERIEUR') return name.includes('EXTERIEUR') || name.includes('OUTDOOR');
                                            if (cat.id === 'CHEMIN') return name.includes('CHEMIN');
                                            return true;
                                        }).length}
                                    </span>
                                </button>
                            ))}
                        </div>

                        <div className="space-y-2 pt-4">
                            {filteredMaps.map(m => (
                                <button
                                    key={m}
                                    onClick={() => setSelectedMap(m)}
                                    className={`w-full text-left px-4 py-3 rounded-xl border transition-all text-[11px] font-bold flex items-center justify-between
                                        ${selectedMap === m ? 'bg-white/10 border-white/20 text-white' : 'bg-transparent border-transparent text-white/30 hover:bg-white/5'}
                                    `}
                                >
                                    {formatName(m)}
                                    {selectedMap === m && <ChevronRight size={14} className="text-blue-400" />}
                                </button>
                            ))}
                        </div>
                    </section>
                </div>

                {/* Main View: Tile Inspector */}
                <div className="flex-1 p-8 flex flex-col gap-8 overflow-y-auto bg-[radial-gradient(circle_at_top_right,_rgba(37,99,235,0.05),_transparent)]">

                    {mapData ? (
                        <>
                            <div className="flex items-start justify-between">
                                <div className="space-y-2">
                                    <h2 className="text-4xl font-black italic tracking-tighter">{formatName(mapData.name)}</h2>
                                    <div className="flex gap-4">
                                        <div className="flex items-center gap-2 text-[10px] font-black text-white/50">
                                            <Hash size={12} className="text-blue-400" />
                                            {mapData.cols}x{mapData.rows} TUILES
                                        </div>
                                        <div className="flex items-center gap-2 text-[10px] font-black text-white/50">
                                            <Package size={12} className="text-pink-400" />
                                            {mapData.totalUniqueTiles} TUILES UNIQUES
                                        </div>
                                    </div>

                                    {/* Navigation Logique */}
                                    <div className="flex gap-2 mt-4">
                                        <button
                                            disabled={filteredMaps.indexOf(selectedMap!) <= 0}
                                            onClick={() => setSelectedMap(filteredMaps[filteredMaps.indexOf(selectedMap!) - 1])}
                                            className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-[9px] font-black hover:bg-white/10 disabled:opacity-20 transition-all"
                                        >
                                            PRÉCÉDENT
                                        </button>
                                        <button
                                            disabled={filteredMaps.indexOf(selectedMap!) >= filteredMaps.length - 1}
                                            onClick={() => setSelectedMap(filteredMaps[filteredMaps.indexOf(selectedMap!) + 1])}
                                            className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-[9px] font-black hover:bg-white/10 disabled:opacity-20 transition-all"
                                        >
                                            SUIVANT
                                        </button>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => {
                                            // Save as default map for this faction
                                            const defaults = JSON.parse(localStorage.getItem('narvos_default_maps') || '{}');
                                            defaults[selectedFaction] = selectedMap;
                                            localStorage.setItem('narvos_default_maps', JSON.stringify(defaults));
                                            alert(`✅ ${selectedMap} défini comme map par défaut pour ${selectedFaction}`);
                                        }}
                                        className="bg-amber-600/20 hover:bg-amber-600/40 border border-amber-500/30 px-4 py-3 rounded-xl text-xs font-black flex items-center gap-2 transition-all text-amber-400"
                                    >
                                        ⭐ DÉFINIR PAR DÉFAUT
                                    </button>
                                    <button
                                        onClick={() => onTestMap?.(selectedFaction, selectedMap!)}
                                        className="bg-white/5 hover:bg-white/10 border border-white/10 px-6 py-3 rounded-xl text-xs font-black flex items-center gap-3 transition-all"
                                    >
                                        <Play size={16} className="text-green-400" /> TESTER DANS LE JEU
                                    </button>
                                    <button className="bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-xl text-xs font-black flex items-center gap-3 transition-all shadow-lg shadow-blue-500/20">
                                        <Download size={16} /> EXPORTER JSON
                                    </button>
                                </div>
                            </div>

                            {/* Grid Inspector */}
                            <div className="relative border border-white/10 rounded-2xl overflow-hidden bg-slate-900 shadow-2xl">
                                <div
                                    className="grid gap-px bg-white/5"
                                    style={{
                                        gridTemplateColumns: `repeat(${mapData.cols}, minmax(0, 1fr))`,
                                        width: 'fit-content',
                                        maxWidth: '100%'
                                    }}
                                >
                                    {mapData.data.map((row, r) => row.map((tileId, c) => (
                                        <div
                                            key={`${r}-${c}`}
                                            onMouseEnter={() => setHoveredTile({ r, c })}
                                            className="aspect-square relative group cursor-crosshair"
                                            style={{ width: '40px' }}
                                        >
                                            <img
                                                src={`/tilesets/${selectedFaction}/${selectedMap}/tiles/tile_${tileId}.png`}
                                                alt=""
                                                className="w-full h-full object-cover"
                                            />
                                            {hoveredTile?.r === r && hoveredTile?.c === c && (
                                                <div className="absolute inset-0 border-2 border-blue-500 z-10 bg-blue-500/20" />
                                            )}
                                            {/* Tooltip on tile */}
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-black border border-white/20 px-2 py-1 rounded text-[8px] opacity-0 group-hover:opacity-100 pointer-events-none z-50 whitespace-nowrap">
                                                ID: {tileId} | POS: {c},{r}
                                            </div>
                                        </div>
                                    )))}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center opacity-20 gap-4">
                            <Grid size={80} strokeWidth={1} />
                            <p className="font-black text-xl tracking-[0.5em]">Sélectionnez une map pour inspecter les tuiles</p>
                        </div>
                    )}
                </div>

                {/* Palette: Unique Tiles */}
                <div className="w-[400px] border-l border-white/10 p-6 flex flex-col gap-6 bg-black/20 overflow-y-auto">
                    <h3 className="text-[10px] text-white/50 font-black tracking-widest flex items-center gap-2">
                        <Layers size={14} /> PALETTE DES TUILES ({mapData?.totalUniqueTiles || 0})
                    </h3>

                    <div className="grid grid-cols-4 gap-2">
                        {mapData && Array.from({ length: Math.min(mapData.totalUniqueTiles, 100) }).map((_, i) => (
                            <div key={i} className="aspect-square bg-white/5 rounded-lg border border-white/5 p-1 group hover:border-blue-500/50 transition-all">
                                <img
                                    src={`/tilesets/${selectedFaction}/${selectedMap}/tiles/tile_${i}.png`}
                                    alt=""
                                    className="w-full h-full object-cover rounded shadow-md"
                                />
                                <div className="text-[6px] text-center mt-1 text-white/20 group-hover:text-blue-400 font-black">ID {i}</div>
                            </div>
                        ))}
                    </div>
                    {mapData && mapData.totalUniqueTiles > 100 && (
                        <p className="text-[10px] text-white/20 italic text-center">+ {mapData.totalUniqueTiles - 100} autres tuiles...</p>
                    )}
                </div>
            </div>
        </div>
    );
};
