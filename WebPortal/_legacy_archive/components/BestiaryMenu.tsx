import React, { useState } from 'react';
import { BossDef, BiomeType } from '../types';
import { bossService } from '../services/bossService';
import { X, Skull, Shield, Sword, Zap, Users, MapPin, Star } from 'lucide-react';

interface BestiaryMenuProps {
  onClose: () => void;
  currentBiome?: BiomeType;
}

const RARITY_COLORS: Record<string, string> = {
  'COMMON': 'text-slate-400',
  'UNCOMMON': 'text-green-400',
  'RARE': 'text-blue-400',
  'EPIC': 'text-purple-400',
  'LEGENDARY': 'text-yellow-400',
  'ARTIFACT': 'text-red-400'
};

export const BestiaryMenu: React.FC<BestiaryMenuProps> = ({ onClose, currentBiome }) => {
  const [selectedBoss, setSelectedBoss] = useState<BossDef | null>(null);
  const [filterBiome, setFilterBiome] = useState<BiomeType | 'ALL'>(currentBiome || 'ALL');

  const allBosses = bossService.getAllBosses();
  const filteredBosses = filterBiome === 'ALL' 
    ? allBosses 
    : allBosses.filter(boss => boss.biome === filterBiome);

  const getAbilityIcon = (type: string) => {
    switch (type) {
      case 'AOE': return Shield;
      case 'SINGLE_TARGET': return Sword;
      case 'PROJECTILE': return Zap;
      case 'SPAWN_MINIONS': return Users;
      default: return Zap;
    }
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/90 backdrop-blur z-50">
      <div className="w-[1000px] h-[800px] bg-slate-900 border-2 border-purple-500/50 shadow-2xl flex flex-col rounded-lg overflow-hidden">
        
        {/* HEADER */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-6 border-b-2 border-purple-500/30 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-600/30 rounded-lg border-2 border-purple-500 text-purple-400">
              <Skull size={28} />
            </div>
            <div>
              <h2 className="text-3xl font-black italic text-white tracking-widest">BESTIAIRE</h2>
              <div className="text-xs text-purple-400 font-mono">BOSS & CRÉATURES LÉGENDAIRES</div>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-slate-700 rounded"
          >
            <X size={28}/>
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* SIDEBAR - Liste des boss */}
          <div className="w-80 bg-black/60 border-r-2 border-slate-700 p-4 overflow-y-auto">
            <div className="mb-4">
              <label className="text-xs text-slate-400 mb-2 block">FILTRER PAR BIOME</label>
              <select
                value={filterBiome}
                onChange={(e) => setFilterBiome(e.target.value as BiomeType | 'ALL')}
                className="w-full bg-slate-800 border border-slate-600 text-white p-2 rounded text-sm"
              >
                <option value="ALL">TOUS</option>
                {Object.values(BiomeType).map(biome => (
                  <option key={biome} value={biome}>{biome}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              {filteredBosses.map(boss => (
                <button
                  key={boss.name}
                  onClick={() => setSelectedBoss(boss)}
                  className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                    selectedBoss?.name === boss.name
                      ? 'bg-purple-900/40 border-purple-500 text-purple-100'
                      : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <div className="font-bold text-sm mb-1">{boss.name}</div>
                  <div className="text-xs text-slate-500 flex items-center gap-2">
                    <MapPin size={10} />
                    {boss.biome}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* MAIN CONTENT - Détails du boss */}
          <div className="flex-1 overflow-y-auto p-6 bg-gradient-to-br from-slate-900 to-slate-800">
            {selectedBoss ? (
              <div className="space-y-6">
                {/* Image du boss */}
                <div className="flex justify-center mb-4">
                  <img 
                    src={`/image_monstre_characcter/${selectedBoss.name.replace(/\s+/g, '')}.png`}
                    alt={selectedBoss.name}
                    className="w-64 h-64 object-contain bg-slate-800/50 rounded-lg p-4 border-2 border-purple-500/30"
                    onError={(e) => {
                      // Fallback si l'image n'existe pas
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
                
                {/* Header Boss */}
                <div>
                  <h3 className="text-3xl font-black text-white mb-2">{selectedBoss.name}</h3>
                  <div className="flex items-center gap-4 text-sm text-slate-400">
                    <span className="flex items-center gap-1">
                      <MapPin size={14} />
                      {selectedBoss.biome}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users size={14} />
                      {selectedBoss.recommendedGroup.minPlayers} joueurs min
                    </span>
                    <span className="flex items-center gap-1">
                      <Star size={14} />
                      Niveau {selectedBoss.recommendedGroup.minLevel}+
                    </span>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-slate-800/80 border border-slate-700 p-4 rounded">
                    <div className="text-xs text-slate-400 mb-1">HP</div>
                    <div className="text-2xl font-bold text-red-400">{selectedBoss.hp.toLocaleString()}</div>
                  </div>
                  <div className="bg-slate-800/80 border border-slate-700 p-4 rounded">
                    <div className="text-xs text-slate-400 mb-1">ARMOR</div>
                    <div className="text-2xl font-bold text-blue-400">{selectedBoss.armor}</div>
                  </div>
                  <div className="bg-slate-800/80 border border-slate-700 p-4 rounded">
                    <div className="text-xs text-slate-400 mb-1">SPEED</div>
                    <div className="text-2xl font-bold text-green-400">{selectedBoss.speed.toFixed(2)}</div>
                  </div>
                </div>

                {/* Abilities */}
                <div>
                  <h4 className="text-xl font-bold text-white mb-4">CAPACITÉS</h4>
                  <div className="space-y-3">
                    {selectedBoss.abilities.map((ability, index) => {
                      const Icon = getAbilityIcon(ability.type);
                      return (
                        <div
                          key={index}
                          className="bg-slate-800/80 border border-slate-700 p-4 rounded-lg"
                        >
                          <div className="flex items-start gap-3">
                            <div className="p-2 bg-purple-900/30 rounded border border-purple-500/50">
                              <Icon size={20} className="text-purple-400" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-2">
                                <h5 className="font-bold text-white">{ability.name}</h5>
                                <span className="text-xs text-slate-400">
                                  Cooldown: {ability.cooldown}s
                                </span>
                              </div>
                              <div className="text-sm text-slate-300 space-y-1">
                                {ability.damage && (
                                  <div>Dégâts: <span className="text-red-400 font-bold">{ability.damage}</span></div>
                                )}
                                {ability.damageOverTime && (
                                  <div>
                                    Dégâts sur temps: <span className="text-orange-400 font-bold">
                                      {ability.damageOverTime.dps} HP/s pendant {ability.damageOverTime.duration}s
                                    </span>
                                  </div>
                                )}
                                {ability.effect && (
                                  <div>
                                    Effet: <span className="text-yellow-400 font-bold">
                                      {ability.effect} {ability.effectDuration ? `(${ability.effectDuration}s)` : ''}
                                    </span>
                                  </div>
                                )}
                                {ability.range && (
                                  <div>Portée: <span className="text-blue-400">{ability.range}m</span></div>
                                )}
                                {ability.area && (
                                  <div>Zone: <span className="text-purple-400">{ability.area}m de rayon</span></div>
                                )}
                                {ability.telegraphTime && (
                                  <div className="text-green-400">
                                    ⚠ Télégraphié: {ability.telegraphTime}s avant impact
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Loot Table */}
                <div>
                  <h4 className="text-xl font-bold text-white mb-4">BUTIN</h4>
                  <div className="space-y-2">
                    {selectedBoss.lootTable.map((drop, index) => (
                      <div
                        key={index}
                        className="bg-slate-800/80 border border-slate-700 p-3 rounded flex justify-between items-center"
                      >
                        <span className="text-slate-300">{drop.itemId}</span>
                        <div className="flex items-center gap-4">
                          <span className="text-slate-400 text-sm">
                            {drop.minAmount || 1}-{drop.maxAmount || 1}
                          </span>
                          <span className="text-yellow-400 font-bold">
                            {(drop.chance * 100).toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Spawn Conditions */}
                <div>
                  <h4 className="text-xl font-bold text-white mb-4">CONDITIONS DE SPAWN</h4>
                  <div className="bg-slate-800/80 border border-slate-700 p-4 rounded space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin size={14} className="text-slate-400" />
                      <span className="text-slate-300">Zones: {selectedBoss.spawnConditions.zone.join(', ')}</span>
                    </div>
                    {selectedBoss.spawnConditions.requiresGroup && (
                      <div className="flex items-center gap-2 text-sm">
                        <Users size={14} className="text-slate-400" />
                        <span className="text-slate-300">
                          Groupe requis: {selectedBoss.spawnConditions.minPlayers || 'N/A'} joueurs minimum
                        </span>
                      </div>
                    )}
                    {selectedBoss.spawnConditions.minLevel && (
                      <div className="flex items-center gap-2 text-sm">
                        <Star size={14} className="text-slate-400" />
                        <span className="text-slate-300">
                          Niveau minimum: {selectedBoss.spawnConditions.minLevel}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-center">
                <div className="text-slate-500">
                  <Skull size={64} className="mx-auto mb-4 opacity-50" />
                  <div className="text-lg">Sélectionnez un boss pour voir ses détails</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

