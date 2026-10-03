/**
 * InventoryPanel.tsx - Panneau d'inventaire NARVOS PRIME (DB-backed Sprint 9).
 *
 * Toutes les operations equip/unequip vont en DB via CharacterPersistService.
 * Plus de localStorage — la DB est l'autorite.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Backpack, Sword, Shield, Zap, X, Star, Loader2 } from 'lucide-react';
import {
  getInventory, getAllItems, equipItem, unequipItem, seedStartingInventory,
  type InventoryRow, type ItemDef,
} from '../../services/CharacterPersistService';

const RARITY_COLORS: Record<string, string> = {
  common: 'border-stone-600 text-stone-300',
  uncommon: 'border-emerald-600 text-emerald-300',
  rare: 'border-blue-600 text-blue-300',
  epic: 'border-purple-600 text-purple-300',
  legendary: 'border-amber-500 text-amber-300',
};

const SLOT_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  head: { label: 'Tête', icon: <Shield size={18} /> },
  body: { label: 'Torse', icon: <Shield size={18} /> },
  weapon: { label: 'Arme', icon: <Sword size={18} /> },
  accessory: { label: 'Accessoire', icon: <Star size={18} /> },
};

interface Props {
  open: boolean;
  onClose: () => void;
  characterId?: string;
  /** Optionnel : callback quand l'equipement change (pour recalculer stats). */
  onEquipChange?: (equipped: Record<string, ItemDef>) => void;
}

export const InventoryPanel: React.FC<Props> = ({ open, onClose, characterId, onEquipChange }) => {
  const [loading, setLoading] = useState(false);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [itemDefs, setItemDefs] = useState<Record<string, ItemDef>>({});

  const loadAll = useCallback(async () => {
    if (!characterId) return;
    setLoading(true);
    try {
      // Si nouveau perso, seed
      const items = await getAllItems();
      setItemDefs(items);
      let inv = await getInventory(characterId);
      if (inv.length === 0) {
        await seedStartingInventory(characterId);
        inv = await getInventory(characterId);
      }
      setInventory(inv);
    } finally {
      setLoading(false);
    }
  }, [characterId]);

  useEffect(() => {
    if (!open || !characterId) return;
    loadAll();
  }, [open, characterId, loadAll]);

  // Notify parent equipped items
  useEffect(() => {
    if (!onEquipChange) return;
    const equippedMap: Record<string, ItemDef> = {};
    inventory.forEach(row => {
      if (row.equipped_slot) {
        const def = itemDefs[row.item_id];
        if (def) equippedMap[row.equipped_slot] = def;
      }
    });
    onEquipChange(equippedMap);
  }, [inventory, itemDefs, onEquipChange]);

  if (!open) return null;

  const handleEquip = async (row: InventoryRow) => {
    if (!characterId) return;
    const def = itemDefs[row.item_id];
    if (!def || def.slot === 'consumable') return;
    await equipItem(characterId, row.id, def.slot);
    await loadAll();
  };

  const handleUnequip = async (row: InventoryRow) => {
    if (!characterId) return;
    await unequipItem(characterId, row.id);
    await loadAll();
  };

  // Build equipped map by slot
  const equippedBySlot: Record<string, InventoryRow & { def?: ItemDef }> = {};
  inventory.forEach(row => {
    if (row.equipped_slot) {
      equippedBySlot[row.equipped_slot] = { ...row, def: itemDefs[row.item_id] };
    }
  });

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[60]">
      <div className="bg-stone-950 border-4 border-stone-700 rounded-2xl p-8 shadow-2xl w-[800px] max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Backpack size={28} className="text-emerald-400" />
            <h2 className="text-2xl font-black uppercase text-white tracking-wider">Inventaire</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-stone-800 rounded">
            <X size={20} className="text-stone-400" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 text-stone-400 py-12">
            <Loader2 size={20} className="animate-spin" /> Chargement DB...
          </div>
        ) : (
          <>
            {/* Equipement actuel */}
            <div className="mb-6">
              <h3 className="text-xs uppercase text-stone-500 tracking-widest mb-3">Équipement (DB)</h3>
              <div className="grid grid-cols-4 gap-3">
                {(['head', 'body', 'weapon', 'accessory'] as const).map(slot => {
                  const slotInfo = SLOT_LABELS[slot];
                  const equipped = equippedBySlot[slot];
                  return (
                    <div key={slot} className={`bg-stone-900 border-2 rounded-lg p-3 ${equipped?.def ? RARITY_COLORS[equipped.def.rarity] : 'border-stone-700'}`}>
                      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-stone-400 mb-2">
                        {slotInfo.icon} {slotInfo.label}
                      </div>
                      {equipped?.def ? (
                        <>
                          <div className="text-sm font-bold">{equipped.def.name}</div>
                          <div className="text-[10px] text-stone-500 mt-1">{equipped.def.description}</div>
                          <button onClick={() => handleUnequip(equipped)} className="mt-2 text-[10px] text-red-400 hover:text-red-300 uppercase">
                            Déséquiper
                          </button>
                        </>
                      ) : (
                        <div className="text-sm text-stone-700 italic">Vide</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Inventaire */}
            <div>
              <h3 className="text-xs uppercase text-stone-500 tracking-widest mb-3">
                Inventaire ({inventory.length} items)
              </h3>
              {inventory.length === 0 ? (
                <p className="text-stone-600 italic text-sm">Aucun item.</p>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {inventory.map(row => {
                    const def = itemDefs[row.item_id];
                    if (!def) return null;
                    const isEquipped = !!row.equipped_slot;
                    return (
                      <div key={row.id} className={`bg-stone-900 border-2 ${RARITY_COLORS[def.rarity]} rounded-lg p-3 ${isEquipped ? 'opacity-50' : 'cursor-pointer hover:bg-stone-800'}`}
                           onClick={() => !isEquipped && handleEquip(row)}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="text-sm font-bold">{def.name}</div>
                          {isEquipped && <span className="text-[9px] uppercase text-emerald-400 font-bold">Équipé</span>}
                          {row.quantity > 1 && <span className="text-[10px] text-stone-500">×{row.quantity}</span>}
                        </div>
                        <div className="text-[10px] text-stone-500 capitalize">{def.slot} · {def.rarity}</div>
                        <div className="text-[11px] text-stone-300 mt-1">{def.description}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
