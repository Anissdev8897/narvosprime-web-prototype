import React, { useState, useEffect } from 'react';
import { CurrencyType, Currency, Faction, Merchant } from '../types';
import { currencyService } from '../services/currencyService';
import { economyService } from '../services/economyService';
import { X, Coins, ArrowRightLeft, ShoppingCart, TrendingUp, AlertCircle } from 'lucide-react';

interface EconomyMenuProps {
  playerCurrencies: Currency[];
  playerFaction: Faction;
  currentPlanetId: string;
  onClose: () => void;
  onCurrencyUpdate: (currencies: Currency[]) => void;
}

export const EconomyMenu: React.FC<EconomyMenuProps> = ({
  playerCurrencies,
  playerFaction,
  currentPlanetId,
  onClose,
  onCurrencyUpdate
}) => {
  const [activeTab, setActiveTab] = useState<'currencies' | 'exchange' | 'merchants'>('currencies');
  const [exchangeFrom, setExchangeFrom] = useState<CurrencyType>(CurrencyType.DARNIAR);
  const [exchangeTo, setExchangeTo] = useState<CurrencyType>(CurrencyType.LYS);
  const [exchangeAmount, setExchangeAmount] = useState<string>('100');
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [tensionLevel, setTensionLevel] = useState<number>(0);

  useEffect(() => {
    // Charger les marchands de la planète actuelle
    const planetMerchants = economyService.getMerchantsByPlanet(currentPlanetId);
    setMerchants(planetMerchants);

    // Obtenir le niveau de tension
    setTensionLevel(currencyService.getTensionLevel());

    // Restock automatique
    economyService.restockMerchants();
  }, [currentPlanetId]);

  const handleExchange = () => {
    const amount = parseFloat(exchangeAmount);
    if (isNaN(amount) || amount <= 0) return;

    const fromCurrency = playerCurrencies.find(c => c.type === exchangeFrom);
    if (!fromCurrency || fromCurrency.amount < amount) {
      alert('Monnaie insuffisante');
      return;
    }

    // Trouver un changeur
    const exchangers = economyService.getExchangers(currentPlanetId);
    if (exchangers.length === 0) {
      alert('Aucun changeur disponible sur cette planète');
      return;
    }

    const result = economyService.exchangeCurrency(
      exchangers[0].id,
      amount,
      exchangeFrom,
      exchangeTo
    );

    if (result.success && result.converted) {
      // Mettre à jour les monnaies
      const updated = playerCurrencies.map(c => {
        if (c.type === exchangeFrom) {
          return { ...c, amount: c.amount - amount };
        }
        if (c.type === exchangeTo) {
          return { ...c, amount: c.amount + result.converted };
        }
        return c;
      });

      onCurrencyUpdate(updated);
      alert(`Conversion réussie : ${result.converted.toFixed(2)} ${currencyService.getCurrencySymbol(exchangeTo)}`);
    } else {
      alert(result.reason || 'Erreur de conversion');
    }
  };

  const getExchangeRate = () => {
    const rate = currencyService.getExchangeRate(exchangeFrom, exchangeTo);
    if (!rate) return 0;
    
    const conversion = currencyService.convertCurrency(1, exchangeFrom, exchangeTo, true);
    return conversion.rate;
  };

  const getTensionWarning = () => {
    if (tensionLevel > 0.3) {
      return {
        show: true,
        message: `Tension interplanétaire élevée (${Math.round(tensionLevel * 100)}%). Les frais de conversion sont augmentés.`
      };
    }
    return { show: false };
  };

  const tensionWarning = getTensionWarning();

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/90 backdrop-blur z-50">
      <div className="w-[900px] h-[700px] bg-slate-900 border-2 border-blue-500/50 shadow-2xl flex flex-col rounded-lg overflow-hidden">
        
        {/* HEADER */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-6 border-b-2 border-blue-500/30 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-600/30 rounded-lg border-2 border-blue-500 text-blue-400">
              <Coins size={28} />
            </div>
            <div>
              <h2 className="text-3xl font-black italic text-white tracking-widest">ÉCONOMIE</h2>
              <div className="text-xs text-blue-400 font-mono">
                PLANET: {currentPlanetId.toUpperCase()} // FACTION: {playerFaction}
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
          {[
            { id: 'currencies', label: 'MONNAIES', icon: Coins },
            { id: 'exchange', label: 'CHANGE', icon: ArrowRightLeft },
            { id: 'merchants', label: 'MARCHANDS', icon: ShoppingCart }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-6 py-4 font-bold transition-all border-b-2 ${
                  isActive
                    ? 'border-blue-500 text-blue-400 bg-slate-900'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-6 bg-gradient-to-br from-slate-900 to-slate-800">
          {activeTab === 'currencies' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white">Vos Monnaies</h3>
                {tensionWarning.show && (
                  <div className="flex items-center gap-2 text-yellow-400 bg-yellow-900/20 px-3 py-2 rounded border border-yellow-500/50">
                    <AlertCircle size={16} />
                    <span className="text-xs">{tensionWarning.message}</span>
                  </div>
                )}
              </div>
              {playerCurrencies.map(currency => (
                <div
                  key={currency.type}
                  className="bg-slate-800/80 border-2 border-slate-700 p-4 rounded-lg flex justify-between items-center"
                >
                  <div>
                    <div className="text-lg font-bold text-white">
                      {currencyService.formatCurrency(currency.amount, currency.type)}
                    </div>
                    <div className="text-xs text-slate-400">{currency.type}</div>
                  </div>
                  <div className="text-xs text-slate-500">
                    Taux: {currency.baseRate.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'exchange' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-white mb-4">Conversion de Monnaie</h3>
                {tensionWarning.show && (
                  <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-500/50 rounded text-yellow-400 text-sm">
                    {tensionWarning.message}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm text-slate-400 mb-2 block">De</label>
                  <select
                    value={exchangeFrom}
                    onChange={(e) => setExchangeFrom(e.target.value as CurrencyType)}
                    className="w-full bg-slate-800 border border-slate-600 text-white p-3 rounded"
                  >
                    {Object.values(CurrencyType).map(currency => (
                      <option key={currency} value={currency}>
                        {currency} ({currencyService.getCurrencySymbol(currency)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm text-slate-400 mb-2 block">Vers</label>
                  <select
                    value={exchangeTo}
                    onChange={(e) => setExchangeTo(e.target.value as CurrencyType)}
                    className="w-full bg-slate-800 border border-slate-600 text-white p-3 rounded"
                  >
                    {Object.values(CurrencyType).filter(c => c !== exchangeFrom).map(currency => (
                      <option key={currency} value={currency}>
                        {currency} ({currencyService.getCurrencySymbol(currency)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm text-slate-400 mb-2 block">Montant</label>
                  <input
                    type="number"
                    value={exchangeAmount}
                    onChange={(e) => setExchangeAmount(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-600 text-white p-3 rounded"
                    min="0"
                    step="0.01"
                  />
                </div>

                {exchangeAmount && !isNaN(parseFloat(exchangeAmount)) && (
                  <div className="bg-slate-800/50 p-4 rounded border border-slate-700">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-slate-400">Taux de change:</span>
                      <span className="text-white font-bold">{getExchangeRate().toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Vous recevrez:</span>
                      <span className="text-green-400 font-bold">
                        {currencyService.formatCurrency(
                          parseFloat(exchangeAmount) * getExchangeRate(),
                          exchangeTo
                        )}
                      </span>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleExchange}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-2"
                >
                  <ArrowRightLeft size={18} />
                  CONVERTIR
                </button>
              </div>
            </div>
          )}

          {activeTab === 'merchants' && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-white mb-4">Marchands Disponibles</h3>
              {merchants.length === 0 ? (
                <div className="text-center text-slate-500 py-8">
                  Aucun marchand disponible sur cette planète
                </div>
              ) : (
                merchants.map(merchant => (
                  <div
                    key={merchant.id}
                    className="bg-slate-800/80 border-2 border-slate-700 p-4 rounded-lg"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="text-lg font-bold text-white">{merchant.name}</h4>
                        <div className="text-xs text-slate-400">
                          {merchant.type} • {merchant.faction}
                        </div>
                      </div>
                      {merchant.faction === playerFaction && merchant.factionDiscount && (
                        <div className="text-xs bg-green-900/30 text-green-400 px-2 py-1 rounded border border-green-500/50">
                          -{Math.round(merchant.factionDiscount * 100)}% Faction
                        </div>
                      )}
                    </div>
                    {merchant.inventory.length > 0 ? (
                      <div className="space-y-2">
                        {merchant.inventory.map(item => (
                          <div
                            key={item.itemId}
                            className="flex justify-between items-center bg-slate-900/50 p-2 rounded text-sm"
                          >
                            <span className="text-slate-300">{item.itemId}</span>
                            <div className="flex items-center gap-4">
                              <span className="text-slate-400">Stock: {item.stock}</span>
                              <span className="text-white font-bold">
                                {currencyService.formatCurrency(item.price, item.currency)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 italic">Aucun item en stock</div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

