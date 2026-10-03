import { CurrencyType, Currency, CurrencyConfig, ExchangeRate, Faction } from '../types';

// Configuration des monnaies
const CURRENCY_CONFIGS: Record<CurrencyType, CurrencyConfig> = {
  [CurrencyType.DARNIAR]: {
    symbol: 'D',
    baseRate: 1.0,
    currentRate: 1.0
  },
  [CurrencyType.LYS]: {
    symbol: 'L',
    baseRate: 0.8,
    currentRate: 0.8
  },
  [CurrencyType.ALA]: {
    symbol: 'A',
    baseRate: 1.2,
    currentRate: 1.2
  }
};

// Mapping Faction -> Currency
const FACTION_CURRENCY: Record<Faction, CurrencyType> = {
  [Faction.ALIEN]: CurrencyType.DARNIAR,    // ZAYAN
  [Faction.HUMAN]: CurrencyType.LYS,        // AKARLYS
  [Faction.MERCENARY]: CurrencyType.ALA,    // MEZALAYIS
  [Faction.NEUTRAL]: CurrencyType.DARNIAR,
  [Faction.HOSTILE]: CurrencyType.DARNIAR
};

// Service de gestion de la monnaie
export class CurrencyService {
  private static instance: CurrencyService;
  private tensionLevel: number = 0; // 0-1 : niveau de tension interplanétaire
  private exchangeRates: Map<string, ExchangeRate> = new Map();

  private constructor() {
    this.initializeExchangeRates();
  }

  public static getInstance(): CurrencyService {
    if (!CurrencyService.instance) {
      CurrencyService.instance = new CurrencyService();
    }
    return CurrencyService.instance;
  }

  private initializeExchangeRates(): void {
    // Taux de base entre toutes les monnaies
    const currencies = Object.values(CurrencyType);
    
    currencies.forEach(from => {
      currencies.forEach(to => {
        if (from !== to) {
          const fromConfig = CURRENCY_CONFIGS[from];
          const toConfig = CURRENCY_CONFIGS[to];
          
          // Calcul du taux de base
          const baseRate = toConfig.baseRate / fromConfig.baseRate;
          
          this.exchangeRates.set(`${from}_${to}`, {
            from,
            to,
            rate: baseRate,
            fee: 0 // Pas de frais par défaut
          });
        }
      });
    });
  }

  // Obtenir la monnaie d'une faction
  public getCurrencyForFaction(faction: Faction): CurrencyType {
    return FACTION_CURRENCY[faction] || CurrencyType.DARNIAR;
  }

  // Obtenir le symbole d'une monnaie
  public getCurrencySymbol(currency: CurrencyType): string {
    return CURRENCY_CONFIGS[currency].symbol;
  }

  // Convertir une monnaie vers une autre
  public convertCurrency(
    amount: number,
    from: CurrencyType,
    to: CurrencyType,
    applyTensionFee: boolean = true
  ): { converted: number; fee: number; rate: number } {
    if (from === to) {
      return { converted: amount, fee: 0, rate: 1.0 };
    }

    const rateKey = `${from}_${to}`;
    const exchangeRate = this.exchangeRates.get(rateKey);
    
    if (!exchangeRate) {
      return { converted: amount, fee: 0, rate: 1.0 };
    }

    // Appliquer le taux de tension si nécessaire
    let finalRate = exchangeRate.rate;
    let fee = exchangeRate.fee;

    if (applyTensionFee && this.tensionLevel > 0) {
      // Augmenter les frais selon le niveau de tension
      const tensionMultiplier = 1 + (this.tensionLevel * 0.5); // +50% max
      fee = exchangeRate.fee * tensionMultiplier;
      finalRate = exchangeRate.rate * (1 - fee / 100);
    }

    const converted = amount * finalRate;
    const feeAmount = amount * (fee / 100);

    return {
      converted: converted - feeAmount,
      fee: feeAmount,
      rate: finalRate
    };
  }

  // Mettre à jour le niveau de tension
  public setTensionLevel(level: number): void {
    this.tensionLevel = Math.max(0, Math.min(1, level));
    this.updateExchangeRates();
  }

  // Obtenir le niveau de tension
  public getTensionLevel(): number {
    return this.tensionLevel;
  }

  // Mettre à jour les taux de change selon la tension
  private updateExchangeRates(): void {
    // Les taux de base restent, mais les frais augmentent
    // Cette logique peut être étendue pour modifier les taux eux-mêmes
  }

  // Obtenir le taux de change actuel
  public getExchangeRate(from: CurrencyType, to: CurrencyType): ExchangeRate | null {
    const rateKey = `${from}_${to}`;
    return this.exchangeRates.get(rateKey) || null;
  }

  // Formater une monnaie pour affichage
  public formatCurrency(amount: number, currency: CurrencyType): string {
    const symbol = this.getCurrencySymbol(currency);
    return `${amount.toFixed(2)} ${symbol}`;
  }

  // Obtenir toutes les monnaies du joueur
  public getPlayerCurrencies(playerCurrencies: Currency[]): Currency[] {
    // S'assurer que toutes les monnaies existent
    const allCurrencies = Object.values(CurrencyType);
    const result: Currency[] = [];

    allCurrencies.forEach(currencyType => {
      const existing = playerCurrencies.find(c => c.type === currencyType);
      if (existing) {
        result.push(existing);
      } else {
        result.push({
          type: currencyType,
          symbol: this.getCurrencySymbol(currencyType),
          baseRate: CURRENCY_CONFIGS[currencyType].baseRate,
          amount: 0
        });
      }
    });

    return result;
  }
}

export const currencyService = CurrencyService.getInstance();

