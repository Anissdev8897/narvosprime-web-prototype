import React, { useState, useEffect } from 'react';
import { Faction, Rank, CraftCategory, Rarity, CraftableItem } from '../types';
import { craftService } from '../services/craftService';
import { Hammer, Shield, Sword, Box, X, Zap, Clock, Star, AlertCircle, CheckCircle, Car, Wrench } from 'lucide-react';

interface CraftShopProps {
  faction: Faction;
  rank: Rank;
  level: number;
  planetId: string;
  inventory: Map<string, number>;
  onCraft: (itemId: string) => void;
  onClose: () => void;
  artisan?: string; // Nom de l'artisan spécial
}

const RARITY_COLORS: Record<Rarity, string> = {
  'COMMON': 'text-slate-400 border-slate-500',
  'UNCOMMON': 'text-green-400 border-green-500',
  'RARE': 'text-blue-400 border-blue-500',
  'EPIC': 'text-purple-400 border-purple-500',
  'LEGENDARY': 'text-yellow-400 border-yellow-500',
  'ARTIFACT': 'text-red-400 border-red-500'
};

const RARITY_BG: Record<Rarity, string> = {
  'COMMON': 'bg-slate-900/50',
  'UNCOMMON': 'bg-green-900/20',
  'RARE': 'bg-blue-900/20',
  'EPIC': 'bg-purple-900/20',
  'LEGENDARY': 'bg-yellow-900/20',
  'ARTIFACT': 'bg-red-900/20'
};

const CATEGORY_ICONS = {
  'WEAPON': Sword,
  'ARMOR': Shield,
  'ITEM': Box,
  'VEHICLE': Car,
  'GADGET': Wrench,
  'STRUCTURE': Box
};

export const CraftShop: React.FC<CraftShopProps> = ({
  faction,
  rank,
  level,
  planetId,
  inventory,
  onCraft,
  onClose,
  artisan
}) => {
  const [activeCategory, setActiveCategory] = useState<CraftCategory>('WEAPON');
  const [selectedItem, setSelectedItem] = useState<CraftableItem | null>(null);
  const [craftProgress, setCraftProgress] = useState<{ [itemId: string]: number }>({});

  // Obtenir les objets craftables
  const availableItems = craftService.getCraftablesByPlanet(planetId, faction, rank, level);
  const filteredItems = availableItems.filter(item => item.category === activeCategory);

  // Vérifier les crafts en cours
  useEffect(() => {
    const interval = setInterval(() => {
      const { inProgress } = craftService.checkCraftProgress();
      const progress: { [itemId: string]: number } = {};
      inProgress.forEach(p => {
        const elapsed = Date.now() - p.startTime;
        progress[p.itemId] = (elapsed / p.duration) * 100;
      });
      setCraftProgress(progress);
    }, 100);

    return () => clearInterval(interval);
  }, []);

  const getResourceCount = (resId: string): number => {
    return inventory.get(resId) || 0;
  };

  const canCraftItem = (item: CraftableItem): { can: boolean; reason?: string } => {
    return craftService.canCraft(item.id, inventory, rank, level);
  };

  const handleCraft = (item: CraftableItem) => {
    const check = canCraftItem(item);
    if (check.can) {
      const result = craftService.startCraft(item.id, inventory, rank, level);
      if (result.success) {
        onCraft(item.id);
      }
    }
  };

  const getRarityStars = (rarity: Rarity | string): number => {
    const rarityLevels: Record<string, number> = {
      'COMMON': 1,
      'UNCOMMON': 2,
      'RARE': 3,
      'EPIC': 4,
      'LEGENDARY': 5,
      'ARTIFACT': 6
    };
    return rarityLevels[rarity as string] || 1;
  };

  const categories: CraftCategory[] = ['WEAPON', 'ARMOR', 'ITEM', 'VEHICLE', 'GADGET', 'STRUCTURE'];

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/90 backdrop-blur z-50">
      <div className="w-[1000px] h-[700px] bg-slate-900 border-2 border-blue-500/50 shadow-2xl flex flex-col rounded-lg overflow-hidden">

        {/* HEADER */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-6 border-b-2 border-blue-500/30 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-600/30 rounded-lg border-2 border-blue-500 text-blue-400">
              <Hammer size={28} />
            </div>
            <div>
              <h2 className="text-3xl font-black italic text-white tracking-widest">CRAFT STATION</h2>
              <div className="text-xs text-blue-400 font-mono">
                {artisan ? `ARTISAN: ${artisan.toUpperCase()}` : 'SYSTEM ONLINE'} // PLANET: {planetId.toUpperCase()}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-slate-700 rounded"
          >
            <X size={28} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">

          {/* SIDEBAR */}
          <div className="w-72 bg-black/60 border-r-2 border-slate-700 p-4 flex flex-col gap-2">
            {/* Catégories */}
            <div className="space-y-2">
              {categories.map(category => {
                const Icon = CATEGORY_ICONS[category];
                const isActive = activeCategory === category;
                return (
                  <button
                    key={category}
                    onClick={() => setActiveCategory(category)}
                    className={`w-full flex items-center gap-3 p-4 rounded-lg transition-all border-2 ${isActive
                        ? 'bg-blue-900/40 border-blue-500 text-blue-100 shadow-lg shadow-blue-500/20'
                        : 'hover:bg-white/5 border-transparent text-slate-400 hover:text-white'
                      }`}
                  >
                    <Icon size={18} />
                    <span className="font-bold tracking-wider text-sm">{category}</span>
                  </button>
                );
              })}
            </div>

            {/* Info Joueur */}
            <div className="mt-4 pt-4 border-t border-white/10">
              <div className="text-xs text-slate-500 mb-2 font-mono">PLAYER INFO</div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-300">
                  <span>Rank:</span>
                  <span className="font-bold text-blue-400">{rank}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Level:</span>
                  <span className="font-bold text-yellow-400">{level}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Faction:</span>
                  <span className="font-bold text-green-400">{faction}</span>
                </div>
              </div>
            </div>

            {/* Inventaire */}
            <div className="mt-auto pt-4 border-t border-white/10">
              <div className="text-xs text-slate-500 mb-2 font-mono">INVENTORY</div>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {Array.from(inventory.entries()).map(([resId, count]) => {
                  const resource = craftService.getAllResources().find(r => r.id === resId);
                  if (!resource || count === 0) return null;
                  return (
                    <div key={resId} className="flex justify-between text-xs text-slate-300 bg-slate-800/50 p-1.5 rounded">
                      <span className="truncate">{resource.name}</span>
                      <span className="font-bold text-white ml-2">x{count}</span>
                    </div>
                  );
                })}
                {Array.from(inventory.values()).every(v => v === 0) && (
                  <div className="text-[10px] text-slate-600 italic text-center py-2">Empty Storage</div>
                )}
              </div>
            </div>
          </div>

          {/* MAIN CONTENT */}
          <div className="flex-1 bg-gradient-to-br from-slate-900 to-slate-800 p-6 overflow-y-auto">
            {filteredItems.length === 0 ? (
              <div className="flex items-center justify-center h-full text-center">
                <div className="text-slate-500 font-mono">
                  <AlertCircle size={48} className="mx-auto mb-4 opacity-50" />
                  <div className="text-lg">NO BLUEPRINTS FOUND</div>
                  <div className="text-sm mt-2">Category: {activeCategory} | Planet: {planetId}</div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {filteredItems.map(item => {
                  const check = canCraftItem(item);
                  const canCraft = check.can;
                  const progress = craftProgress[item.id] || 0;
                  const stars = getRarityStars(item.rarity);
                  const rarityColor = RARITY_COLORS[item.rarity];
                  const rarityBg = RARITY_BG[item.rarity];

                  return (
                    <div
                      key={item.id}
                      className={`${rarityBg} border-2 ${rarityColor} p-4 rounded-lg relative group hover:shadow-xl transition-all cursor-pointer`}
                      onClick={() => setSelectedItem(item)}
                    >
                      {/* Rarity Stars */}
                      <div className="absolute top-2 right-2 flex gap-0.5">
                        {Array.from({ length: stars }).map((_, i) => (
                          <Star key={i} size={12} className="fill-current text-yellow-400" />
                        ))}
                      </div>

                      {/* Image de l'objet */}
                      {item.icon && (
                        <div className="mb-3 flex justify-center">
                          <img
                            src={item.icon}
                            alt={item.name}
                            className="w-24 h-24 object-contain bg-slate-800/50 rounded-lg p-2 border border-slate-700"
                            onError={(e) => {
                              // Fallback si l'image n'existe pas
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        </div>
                      )}

                      {/* Header */}
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="text-xl font-bold text-white pr-8">{item.name}</h3>
                        <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase ${rarityColor} border`}>
                          {item.rarity}
                        </span>
                      </div>

                      {/* Description */}
                      <p className="text-xs text-slate-400 mb-3 h-10 line-clamp-2">{item.description}</p>

                      {/* Stats Preview */}
                      {item.stats && (
                        <div className="mb-3 space-y-1 text-[10px] text-slate-300">
                          {item.stats.damage && (
                            <div className="flex justify-between">
                              <span>Damage:</span>
                              <span className="text-red-400 font-bold">{item.stats.damage}</span>
                            </div>
                          )}
                          {item.stats.armor && (
                            <div className="flex justify-between">
                              <span>Armor:</span>
                              <span className="text-blue-400 font-bold">{item.stats.armor}</span>
                            </div>
                          )}
                          {item.stats.hp && (
                            <div className="flex justify-between">
                              <span>HP:</span>
                              <span className="text-green-400 font-bold">+{item.stats.hp}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Requirements avec icônes */}
                      <div className="space-y-1.5 mb-3">
                        <div className="text-[10px] text-slate-500 mb-1 font-mono uppercase">RESSOURCES REQUISES:</div>
                        {item.cost.map(cost => {
                          const has = getResourceCount(cost.resourceId);
                          const resource = craftService.getAllResources().find(r => r.id === cost.resourceId);
                          return (
                            <div
                              key={cost.resourceId}
                              className={`flex items-center justify-between text-xs font-mono p-2 rounded ${has >= cost.amount ? 'bg-green-900/20 border border-green-500/30' : 'bg-red-900/20 border border-red-500/30'
                                }`}
                            >
                              <div className="flex items-center gap-2">
                                {resource?.icon && (
                                  <img
                                    src={resource.icon}
                                    alt={resource.name}
                                    className="w-6 h-6 object-contain"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                  />
                                )}
                                <span className="text-slate-300">{resource?.name || cost.resourceId}</span>
                              </div>
                              <span className={has >= cost.amount ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
                                {has}/{cost.amount}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Craft Button */}
                      {progress > 0 && progress < 100 ? (
                        <div className="w-full bg-slate-800 p-2 rounded">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-slate-400">Crafting...</span>
                            <span className="text-xs text-blue-400 font-bold">{Math.round(progress)}%</span>
                          </div>
                          <div className="w-full bg-slate-700 rounded-full h-2">
                            <div
                              className="bg-blue-500 h-2 rounded-full transition-all"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <button
                          disabled={!canCraft}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCraft(item);
                          }}
                          className={`w-full py-3 font-bold tracking-widest transition-all flex items-center justify-center gap-2 rounded-lg ${canCraft
                              ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)] hover:shadow-[0_0_20px_rgba(37,99,235,0.7)]'
                              : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                            }`}
                        >
                          {canCraft ? (
                            <>
                              <Zap size={16} className="fill-white" />
                              CRAFT ({item.craftTime}s)
                            </>
                          ) : (
                            <>
                              <AlertCircle size={16} />
                              {check.reason || 'CANNOT CRAFT'}
                            </>
                          )}
                        </button>
                      )}

                      {/* Faction Badge */}
                      {item.faction !== 'NEUTRAL' && (
                        <div className="absolute bottom-2 left-2 text-[8px] px-1.5 py-0.5 bg-black/50 rounded text-slate-400 uppercase">
                          {item.faction} ONLY
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* PANEL DÉTAILS ITEM SÉLECTIONNÉ */}
          {selectedItem && (
            <div className="w-96 bg-black/80 border-l-2 border-blue-500/30 p-6 overflow-y-auto">
              <div className="mb-4">
                <button
                  onClick={() => setSelectedItem(null)}
                  className="text-slate-400 hover:text-white mb-4"
                >
                  <X size={20} />
                </button>
                <h3 className="text-2xl font-bold text-white mb-2">{selectedItem.name}</h3>
                <p className="text-sm text-slate-400 mb-4">{selectedItem.description}</p>

                {/* Image grande */}
                {selectedItem.icon && (
                  <div className="mb-4 flex justify-center">
                    <img
                      src={selectedItem.icon}
                      alt={selectedItem.name}
                      className="w-48 h-48 object-contain bg-slate-800/50 rounded-lg p-4 border-2 border-blue-500/30"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Stats détaillées */}
              {selectedItem.stats && (
                <div className="mb-4">
                  <h4 className="text-lg font-bold text-white mb-2">STATS</h4>
                  <div className="space-y-2">
                    {selectedItem.stats.damage && (
                      <div className="flex justify-between p-2 bg-slate-800/50 rounded">
                        <span className="text-slate-300">Dégâts:</span>
                        <span className="text-red-400 font-bold">{selectedItem.stats.damage}</span>
                      </div>
                    )}
                    {selectedItem.stats.armor && (
                      <div className="flex justify-between p-2 bg-slate-800/50 rounded">
                        <span className="text-slate-300">Armure:</span>
                        <span className="text-blue-400 font-bold">{selectedItem.stats.armor}</span>
                      </div>
                    )}
                    {selectedItem.stats.hp && (
                      <div className="flex justify-between p-2 bg-slate-800/50 rounded">
                        <span className="text-slate-300">HP Bonus:</span>
                        <span className="text-green-400 font-bold">+{selectedItem.stats.hp}</span>
                      </div>
                    )}
                    {selectedItem.stats.speed && (
                      <div className="flex justify-between p-2 bg-slate-800/50 rounded">
                        <span className="text-slate-300">Vitesse:</span>
                        <span className="text-yellow-400 font-bold">+{selectedItem.stats.speed}</span>
                      </div>
                    )}
                    {selectedItem.stats.special && (
                      <div className="mt-2 p-2 bg-purple-900/20 rounded border border-purple-500/30">
                        <div className="text-xs text-purple-300 font-mono">BONUS SPÉCIAUX:</div>
                        {Object.entries(selectedItem.stats.special).map(([key, value]) => (
                          <div key={key} className="text-xs text-slate-300 mt-1">
                            {key}: <span className="text-purple-400 font-bold">{String(value)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Ressources nécessaires détaillées */}
              <div className="mb-4">
                <h4 className="text-lg font-bold text-white mb-2">RESSOURCES NÉCESSAIRES</h4>
                <div className="space-y-2">
                  {selectedItem.cost.map(cost => {
                    const has = getResourceCount(cost.resourceId);
                    const resource = craftService.getAllResources().find(r => r.id === cost.resourceId);
                    const canAfford = has >= cost.amount;
                    return (
                      <div
                        key={cost.resourceId}
                        className={`p-3 rounded-lg border-2 ${canAfford
                            ? 'bg-green-900/20 border-green-500/30'
                            : 'bg-red-900/20 border-red-500/30'
                          }`}
                      >
                        <div className="flex items-center gap-3 mb-2">
                          {resource?.icon && (
                            <img
                              src={resource.icon}
                              alt={resource.name}
                              className="w-10 h-10 object-contain bg-slate-800/50 rounded p-1"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          )}
                          <div className="flex-1">
                            <div className="font-bold text-white">{resource?.name || cost.resourceId}</div>
                            {resource?.description && (
                              <div className="text-xs text-slate-400">{resource.description}</div>
                            )}
                          </div>
                        </div>
                        <div className="flex justify-between items-center mt-2">
                          <span className="text-xs text-slate-400">Quantité requise:</span>
                          <span className={`text-lg font-bold ${canAfford ? 'text-green-400' : 'text-red-400'}`}>
                            {has}/{cost.amount}
                          </span>
                        </div>
                        {!canAfford && (
                          <div className="text-xs text-red-400 mt-1">
                            Manque: {cost.amount - has} {resource?.name || cost.resourceId}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Informations de craft */}
              <div className="mb-4 p-3 bg-slate-800/50 rounded border border-slate-700">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-slate-400 text-sm">Temps de craft:</span>
                  <span className="text-blue-400 font-bold flex items-center gap-1">
                    <Clock size={14} />
                    {selectedItem.craftTime}s
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-sm">Rang minimum:</span>
                  <span className="text-yellow-400 font-bold">{selectedItem.minRank || 'Aucun'}</span>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-slate-400 text-sm">Niveau minimum:</span>
                  <span className="text-green-400 font-bold">{selectedItem.minLevel}</span>
                </div>
              </div>

              {/* Bouton de craft */}
              <button
                onClick={() => {
                  handleCraft(selectedItem);
                  setSelectedItem(null);
                }}
                disabled={!canCraftItem(selectedItem).can}
                className={`w-full py-3 font-bold tracking-widest transition-all flex items-center justify-center gap-2 rounded-lg ${canCraftItem(selectedItem).can
                    ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)] hover:shadow-[0_0_20px_rgba(37,99,235,0.7)]'
                    : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                  }`}
              >
                {canCraftItem(selectedItem).can ? (
                  <>
                    <Zap size={16} className="fill-white" />
                    CRAFT ({selectedItem.craftTime}s)
                  </>
                ) : (
                  <>
                    <AlertCircle size={16} />
                    {canCraftItem(selectedItem).reason || 'CANNOT CRAFT'}
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

