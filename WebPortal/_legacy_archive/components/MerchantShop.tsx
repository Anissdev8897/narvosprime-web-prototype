import React, { useState, useEffect } from 'react';
import { Merchant, Faction, CurrencyType } from '../types';
import { economyService } from '../services/economyService';
import { itemService } from '../services/itemService';
import { currencyService } from '../services/currencyService';
import { X, ShoppingCart, Coins, Package, AlertCircle, CheckCircle } from 'lucide-react';

interface MerchantShopProps {
  merchant: Merchant;
  playerFaction: Faction;
  playerCurrencies: { type: CurrencyType; amount: number }[];
  onClose: () => void;
  onPurchase: (itemId: string, quantity: number, cost: number, currency: CurrencyType) => void;
  onSell?: (itemId: string, quantity: number, earned: number, currency: CurrencyType) => void;
  playerInventory?: { id: string; count: number }[];
}

export const MerchantShop: React.FC<MerchantShopProps> = ({
  merchant,
  playerFaction,
  playerCurrencies,
  onClose,
  onPurchase,
  onSell,
  playerInventory = []
}) => {
  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const playerCurrencyMap = new Map(playerCurrencies.map(c => [c.type, c.amount]));

  const handleBuy = () => {
    if (!selectedItem) return;

    const inventoryItem = merchant.inventory.find(i => i.itemId === selectedItem);
    if (!inventoryItem) return;

    if (inventoryItem.stock < quantity) {
      setMessage({ type: 'error', text: 'Stock insuffisant' });
      return;
    }

    const result = economyService.buyItem(
      merchant.id,
      selectedItem,
      quantity,
      inventoryItem.currency,
      playerFaction
    );

    if (result.success && result.totalCost) {
      const playerCurrency = playerCurrencyMap.get(inventoryItem.currency) || 0;
      if (playerCurrency < result.totalCost) {
        setMessage({ type: 'error', text: 'Monnaie insuffisante' });
        return;
      }

      onPurchase(selectedItem, quantity, result.totalCost, inventoryItem.currency);
      setMessage({ type: 'success', text: `Achat réussi: ${quantity}x ${selectedItem}` });
      setTimeout(() => setMessage(null), 2000);
    } else {
      setMessage({ type: 'error', text: result.reason || 'Erreur d\'achat' });
    }
  };

  const handleSell = () => {
    if (!selectedItem || !onSell) return;

    const playerItem = playerInventory.find(i => i.id === selectedItem);
    if (!playerItem || playerItem.count < quantity) {
      setMessage({ type: 'error', text: 'Quantité insuffisante dans l\'inventaire' });
      return;
    }

    const result = economyService.sellItem(
      merchant.id,
      selectedItem,
      quantity,
      CurrencyType.DARNIAR, // Devise par défaut
      playerFaction
    );

    if (result.success && result.totalEarned) {
      onSell(selectedItem, quantity, result.totalEarned, CurrencyType.DARNIAR);
      setMessage({ type: 'success', text: `Vente réussie: ${quantity}x ${selectedItem}` });
      setTimeout(() => setMessage(null), 2000);
    } else {
      setMessage({ type: 'error', text: result.reason || 'Erreur de vente' });
    }
  };

  const getItemInfo = (itemId: string) => {
    return itemService.getItem(itemId);
  };

  const getPlayerItemCount = (itemId: string) => {
    const item = playerInventory.find(i => i.id === itemId);
    return item?.count || 0;
  };

  const canAfford = (price: number, currency: CurrencyType) => {
    const playerAmount = playerCurrencyMap.get(currency) || 0;
    return playerAmount >= price * quantity;
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/90 backdrop-blur z-50">
      <div className="w-[900px] h-[700px] bg-slate-900 border-2 border-yellow-500/50 shadow-2xl flex flex-col rounded-lg overflow-hidden">
        
        {/* HEADER */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-6 border-b-2 border-yellow-500/30 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-yellow-600/30 rounded-lg border-2 border-yellow-500 text-yellow-400">
              <ShoppingCart size={28} />
            </div>
            <div>
              <h2 className="text-3xl font-black italic text-white tracking-widest">{merchant.name}</h2>
              <div className="text-xs text-yellow-400 font-mono">
                {merchant.type} • {merchant.faction}
                {merchant.faction === playerFaction && merchant.factionDiscount && (
                  <span className="ml-2 text-green-400">
                    -{Math.round(merchant.factionDiscount * 100)}% Faction
                  </span>
                )}
              </div>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-slate-700 rounded"
          >
            <X size={28}/>
          </button>
        </div>

        {/* TABS */}
        <div className="flex border-b border-slate-700 bg-slate-800/50">
          <button
            onClick={() => setActiveTab('buy')}
            className={`flex-1 py-4 font-bold transition-all border-b-2 ${
              activeTab === 'buy'
                ? 'border-yellow-500 text-yellow-400 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Package size={18} className="inline mr-2" />
            ACHETER
          </button>
          {onSell && (
            <button
              onClick={() => setActiveTab('sell')}
              className={`flex-1 py-4 font-bold transition-all border-b-2 ${
                activeTab === 'sell'
                  ? 'border-yellow-500 text-yellow-400 bg-slate-900'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <Coins size={18} className="inline mr-2" />
              VENDRE
            </button>
          )}
        </div>

        {/* MESSAGE */}
        {message && (
          <div className={`p-3 mx-6 mt-4 rounded flex items-center gap-2 ${
            message.type === 'success' 
              ? 'bg-green-900/30 border border-green-500/50 text-green-400'
              : 'bg-red-900/30 border border-red-500/50 text-red-400'
          }`}>
            {message.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
            <span className="text-sm">{message.text}</span>
          </div>
        )}

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-6 bg-gradient-to-br from-slate-900 to-slate-800">
          {activeTab === 'buy' ? (
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-white mb-4">Inventaire du Marchand</h3>
              {merchant.inventory.length === 0 ? (
                <div className="text-center text-slate-500 py-8">
                  Le marchand n'a plus rien en stock
                </div>
              ) : (
                merchant.inventory.map(invItem => {
                  const item = getItemInfo(invItem.itemId);
                  if (!item) return null;

                  const isSelected = selectedItem === invItem.itemId;
                  const playerCurrency = playerCurrencyMap.get(invItem.currency) || 0;
                  const totalPrice = invItem.price * quantity;
                  const canBuy = playerCurrency >= totalPrice && invItem.stock >= quantity;

                  // Appliquer réduction faction
                  let finalPrice = invItem.price;
                  if (merchant.faction === playerFaction && merchant.factionDiscount) {
                    finalPrice = invItem.price * (1 - merchant.factionDiscount);
                  }

                  return (
                    <div
                      key={invItem.itemId}
                      className={`bg-slate-800/80 border-2 p-4 rounded-lg cursor-pointer transition-all ${
                        isSelected
                          ? 'border-yellow-500 bg-yellow-900/20'
                          : 'border-slate-700 hover:border-slate-600'
                      }`}
                      onClick={() => {
                        setSelectedItem(invItem.itemId);
                        setQuantity(1);
                      }}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <h4 className="text-lg font-bold text-white">{item.name}</h4>
                          <p className="text-xs text-slate-400 mt-1">{item.description}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-yellow-400">
                            {currencyService.formatCurrency(finalPrice, invItem.currency)}
                          </div>
                          <div className="text-xs text-slate-500">
                            Stock: {invItem.stock}
                          </div>
                        </div>
                      </div>

                      {isSelected && (
                        <div className="mt-4 pt-4 border-t border-slate-700 space-y-3">
                          <div className="flex items-center gap-4">
                            <label className="text-sm text-slate-400">Quantité:</label>
                            <input
                              type="number"
                              min="1"
                              max={invItem.stock}
                              value={quantity}
                              onChange={(e) => setQuantity(Math.max(1, Math.min(invItem.stock, parseInt(e.target.value) || 1)))}
                              className="w-20 bg-slate-700 border border-slate-600 text-white p-2 rounded text-sm"
                            />
                            <span className="text-sm text-slate-400">
                              Total: {currencyService.formatCurrency(finalPrice * quantity, invItem.currency)}
                            </span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleBuy();
                            }}
                            disabled={!canBuy}
                            className={`w-full py-2 font-bold rounded transition-all ${
                              canBuy
                                ? 'bg-yellow-600 hover:bg-yellow-500 text-white'
                                : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                            }`}
                          >
                            {canBuy ? 'ACHETER' : 'MONNAIE INSUFFISANTE'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-white mb-4">Votre Inventaire</h3>
              {playerInventory.length === 0 ? (
                <div className="text-center text-slate-500 py-8">
                  Votre inventaire est vide
                </div>
              ) : (
                playerInventory
                  .filter(item => item.count > 0)
                  .map(playerItem => {
                    const item = getItemInfo(playerItem.id);
                    if (!item || item.type === 'ARMOR') return null; // Ne pas vendre les armures équipées

                    const isSelected = selectedItem === playerItem.id;
                    const sellResult = economyService.sellItem(
                      merchant.id,
                      playerItem.id,
                      1,
                      CurrencyType.DARNIAR,
                      playerFaction
                    );

                    return (
                      <div
                        key={playerItem.id}
                        className={`bg-slate-800/80 border-2 p-4 rounded-lg cursor-pointer transition-all ${
                          isSelected
                            ? 'border-yellow-500 bg-yellow-900/20'
                            : 'border-slate-700 hover:border-slate-600'
                        }`}
                        onClick={() => {
                          setSelectedItem(playerItem.id);
                          setQuantity(1);
                        }}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <h4 className="text-lg font-bold text-white">{item.name}</h4>
                            <p className="text-xs text-slate-400 mt-1">Quantité: {playerItem.count}</p>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-green-400">
                              {sellResult.success && sellResult.totalEarned
                                ? currencyService.formatCurrency(sellResult.totalEarned, CurrencyType.DARNIAR)
                                : 'N/A'}
                            </div>
                            <div className="text-xs text-slate-500">par unité</div>
                          </div>
                        </div>

                        {isSelected && (
                          <div className="mt-4 pt-4 border-t border-slate-700 space-y-3">
                            <div className="flex items-center gap-4">
                              <label className="text-sm text-slate-400">Quantité:</label>
                              <input
                                type="number"
                                min="1"
                                max={playerItem.count}
                                value={quantity}
                                onChange={(e) => setQuantity(Math.max(1, Math.min(playerItem.count, parseInt(e.target.value) || 1)))}
                                className="w-20 bg-slate-700 border border-slate-600 text-white p-2 rounded text-sm"
                              />
                              <span className="text-sm text-green-400">
                                Total: {sellResult.success && sellResult.totalEarned
                                  ? currencyService.formatCurrency(sellResult.totalEarned * quantity, CurrencyType.DARNIAR)
                                  : 'N/A'}
                              </span>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSell();
                              }}
                              className="w-full py-2 font-bold bg-green-600 hover:bg-green-500 text-white rounded transition-all"
                            >
                              VENDRE
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
              )}
            </div>
          )}
        </div>

        {/* FOOTER - Monnaies du joueur */}
        <div className="bg-slate-800/80 border-t border-slate-700 p-4">
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-400">Vos Monnaies:</span>
            <div className="flex gap-4">
              {playerCurrencies.map(currency => (
                <span key={currency.type} className="text-white font-bold">
                  {currencyService.formatCurrency(currency.amount, currency.type)}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

