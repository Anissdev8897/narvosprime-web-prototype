import React from 'react';
import { Faction, Vector3 } from '../types';

interface RadarProps {
    playerPosition: Vector3;
    playerRotation: number;
    range: number;
    entities: any[];
    playerFaction: Faction;
    playerReputation: Record<string, number>;
}

export const Radar: React.FC<RadarProps> = ({
    playerPosition,
    playerRotation,
    range,
    entities,
    playerFaction,
    playerReputation
}) => {
    return (
        <div className="w-32 h-32 bg-slate-900/80 rounded-full border-2 border-cyan-500/50 relative">
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
            </div>
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[8px] text-cyan-400">
                RADAR
            </div>
        </div>
    );
};
