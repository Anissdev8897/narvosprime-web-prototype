import React, { useState, useEffect, useMemo } from 'react';
import { PlayerClass, Faction, Gender, CharacterCustomization } from '../types';
// baseColors, (Removed)
// SPELLS_DB (Removed)

import {
    Zap, Activity, Dices
} from 'lucide-react';
import { DOFUS_BREEDS } from '../data/dofusBreeds';
import { breedService } from '../services/breedService';

interface ClassSelectionMenuProps {
    onSelect: (data: {
        name: string,
        class: PlayerClass, // Compatibility
        faction: Faction,
        customization: CharacterCustomization,
        breedId: number // Dofus ID
    }) => void;
}

export const ClassSelectionMenu: React.FC<ClassSelectionMenuProps> = ({ onSelect }) => {
    // State
    const [charName, setCharName] = useState('');
    const [selectedBreedId, setSelectedBreedId] = useState<number>(1); // Feca par défaut
    const [gender, setGender] = useState<Gender>(Gender.MALE);
    const [faceId, setFaceId] = useState(1);

    const currentBreed = breedService.getBreedById(selectedBreedId) || DOFUS_BREEDS[0];

    // Couleurs Dofus (Peau, Cheveux, Habit 1, Habit 2, Habit 3)
    const [colors, setColors] = useState({
        skin: '#f3d1b0',
        hair: '#4a3728',
        base: currentBreed.colors.primary,     // Habit 1
        secondary: currentBreed.colors.secondary, // Habit 2
        detail: '#ffffff'                      // Habit 3
    });

    // Reset colors when breed changes
    useEffect(() => {
        setColors(prev => ({
            ...prev,
            base: currentBreed.colors.primary,
            secondary: currentBreed.colors.secondary
        }));
    }, [currentBreed.id]);

    const starterSpells = useMemo(() => {
        return breedService.getAvailableSpells(currentBreed, 1);
    }, [currentBreed]);

    // Helpers
    const randomizeColors = () => {
        const randHex = () => '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
        setColors({
            skin: '#f3d1b0', // On garde une peau réaliste par défaut
            hair: randHex(),
            base: randHex(),
            secondary: randHex(),
            detail: randHex()
        });
    };

    const handleCreate = () => {
        if (!charName.trim()) return;

        // On mappe vers une classe générique de Narvos pour la compatibilité
        // Mais on passe le vrai ID Dofus dans breedId
        onSelect({
            name: charName,
            class: PlayerClass.PRESSURE_MANIPULATOR, // Placeholder technique
            faction: Faction.HUMAN,
            breedId: currentBreed.id,
            customization: {
                gender,
                faceId,
                skinColor: colors.skin,
                hairColor: colors.hair,
                baseColor: colors.base,
                secondaryColor: colors.secondary,
                detailColor: colors.detail,
                hairStyle: 1,
                accessoryId: 0,
                // Backward compatibility
                colors: {
                    skin: colors.skin,
                    hair: colors.hair,
                    base: colors.base,
                    secondary: colors.secondary,
                    detail: colors.detail
                },
                equippedItems: {}
            }
        });
    };

    return (
        <div className="fixed inset-0 bg-[#0f1115] bg-[url('/textures/ui/dofus_bg_creation.jpg')] bg-cover bg-center flex text-white font-sans overflow-hidden select-none z-50">
            {/* Overlay sombre */}
            <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm" />

            {/* GAUCHE: Liste des Classes */}
            <div className="relative w-1/4 h-full bg-slate-950/80 border-r border-white/10 flex flex-col pt-8 pb-4 px-4 overflow-y-auto custom-scrollbar">
                <div className="mb-6 text-center">
                    <h1 className="text-2xl font-bold tracking-widest text-cyan-400">NOUVEAU HÉROS</h1>
                    <div className="text-xs text-slate-500 uppercase tracking-widest">Sélectionnez votre destinée</div>
                </div>

                <div className="space-y-2 flex-1">
                    {DOFUS_BREEDS.map(breed => (
                        <button
                            key={breed.id}
                            onClick={() => setSelectedBreedId(breed.id)}
                            className={`w-full p-3 rounded-lg flex items-center gap-4 transition-all border border-transparent ${selectedBreedId === breed.id
                                ? 'bg-cyan-900/40 border-cyan-500/50 text-cyan-100'
                                : 'hover:bg-white/5 text-slate-400'
                                }`}
                        >
                            <div className="text-2xl w-8 text-center">{breedService.getBreedIcon(breed.id)}</div>
                            <div className="text-left">
                                <div className="font-bold uppercase text-sm tracking-wide">{breed.name}</div>
                                <div className="text-[10px] opacity-60 flex items-center gap-2">
                                    <span className={`px-1 rounded ${breed.difficulty === 1 ? 'bg-green-500/20 text-green-400' :
                                        breed.difficulty === 2 ? 'bg-yellow-500/20 text-yellow-400' :
                                            'bg-red-500/20 text-red-400'
                                        }`}>
                                        DIFF: {breed.difficulty}
                                    </span>
                                    <span>{breed.role}</span>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* CENTRE: Prévisualisation & Nom */}
            <div className="relative w-2/4 h-full flex flex-col items-center justify-center p-8">

                {/* Visualisation 2D du sprite */}
                <div className="relative w-full h-[60%] flex items-center justify-center mb-8">
                    {/* Placeholder pour le sprite Dofus */}
                    <div className="w-64 h-64 bg-slate-800/50 rounded-full border-4 border-white/5 flex items-center justify-center relative shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                        <span className="text-6xl animate-bounce">{breedService.getBreedIcon(currentBreed.id)}</span>
                        <div className="absolute -bottom-4 bg-black/60 px-4 py-1 rounded-full text-xs font-mono text-cyan-300">
                            SPRITE EN COURS
                        </div>
                    </div>
                </div>

                {/* Saisie du Nom */}
                <div className="w-full max-w-md bg-black/40 border border-cyan-500/30 p-1 mt-auto">
                    <input
                        type="text"
                        placeholder="ENTREZ VOTRE NOM..."
                        value={charName}
                        onChange={(e) => setCharName(e.target.value.toUpperCase())}
                        className="w-full bg-slate-900/80 border-none outline-none text-center text-2xl font-black tracking-widest text-white py-4 placeholder-slate-600 focus:ring-2 focus:ring-cyan-500/50 transition-all uppercase"
                        maxLength={16}
                    />
                </div>

                {/* Bouton Créer */}
                <button
                    onClick={handleCreate}
                    disabled={!charName.trim()}
                    className={`mt-4 w-full max-w-md py-4 font-bold tracking-[0.2em] transition-all transform hover:scale-[1.02] border ${charName.trim()
                        ? 'bg-cyan-600 hover:bg-cyan-500 text-white border-cyan-400 shadow-[0_0_20px_rgba(8,145,178,0.4)]'
                        : 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
                        }`}
                >
                    INCARNER LE HÉROS
                </button>
            </div>

            {/* DROITE: Détails & Personnalisation */}
            <div className="relative w-1/4 h-full bg-slate-950/80 border-l border-white/10 flex flex-col p-6 overflow-y-auto">
                {/* Titre Classe */}
                <div className="mb-8">
                    <h2 className="text-3xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 mb-2">
                        {currentBreed.name}
                    </h2>
                    <p className="text-sm text-slate-300 leading-relaxed border-l-2 border-cyan-500/30 pl-3">
                        {currentBreed.description}
                    </p>
                </div>

                {/* Stats de Base */}
                <div className="mb-8">
                    <h3 className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">
                        <Activity size={14} /> Caractéristiques
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white/5 p-2 rounded flex items-center justify-between">
                            <span className="text-red-400 text-xs font-bold">VITALITÉ</span>
                            <span className="font-mono text-white">{currentBreed.baseStats.vitality * 5 + 55}</span>
                        </div>
                        <div className="bg-white/5 p-2 rounded flex items-center justify-between">
                            <span className="text-blue-400 text-xs font-bold">PA</span>
                            <span className="font-mono text-white">{currentBreed.baseStats.ap}</span>
                        </div>
                        <div className="bg-white/5 p-2 rounded flex items-center justify-between">
                            <span className="text-green-400 text-xs font-bold">PM</span>
                            <span className="font-mono text-white">{currentBreed.baseStats.mp}</span>
                        </div>
                        <div className="bg-white/5 p-2 rounded flex items-center justify-between">
                            <span className="text-yellow-400 text-xs font-bold">INITIATIVE</span>
                            <span className="font-mono text-white">100</span>
                        </div>
                    </div>
                </div>

                {/* Sorts de Départ */}
                <div className="mb-8">
                    <h3 className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">
                        <Zap size={14} /> Sorts de Départ
                    </h3>
                    <div className="space-y-2">
                        {starterSpells.map(spell => (
                            <div key={spell.id} className="bg-black/40 border border-white/5 p-2 rounded flex items-center gap-3">
                                <div className="w-8 h-8 bg-slate-800 rounded flex items-center justify-center text-lg">
                                    🔮
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-cyan-200">{spell.name}</div>
                                    <div className="text-[10px] text-slate-500">{spell.description.substring(0, 40)}...</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Personnalisation Couleurs */}
                <div className="mt-auto">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                            <Dices size={14} className="inline mr-2" /> Apparence
                        </h3>
                        <button onClick={randomizeColors} className="text-[10px] bg-white/10 px-2 py-1 rounded hover:bg-white/20 transition-colors">
                            ALÉATOIRE
                        </button>
                    </div>

                    <div className="grid grid-cols-5 gap-2">
                        {Object.entries(colors).map(([key, value]) => (
                            <div key={key} className="flex flex-col gap-1 items-center">
                                <input
                                    type="color"
                                    value={value}
                                    onChange={(e) => setColors({ ...colors, [key]: e.target.value })}
                                    className="w-8 h-8 rounded cursor-pointer bg-transparent border-none p-0"
                                />
                                <span className="text-[8px] uppercase text-slate-600">{key.substring(0, 3)}</span>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
};
