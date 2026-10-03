import { Faction, CurrencyType, GameItem, PlanetConfig, Merchant } from '../types';
import { currencyService } from './currencyService';
import { itemService } from './itemService';

// Service de gestion de l'économie
export class EconomyService {
  private static instance: EconomyService;
  private merchants: Map<string, Merchant> = new Map();
  private lastRestockTime: Map<string, number> = new Map();

  private constructor() {
    this.initializeMerchants();
  }

  public static getInstance(): EconomyService {
    if (!EconomyService.instance) {
      EconomyService.instance = new EconomyService();
    }
    return EconomyService.instance;
  }

  private initializeMerchants(): void {
    // Changeur ZAYAN
    const changeurZayan: Merchant = {
      id: 'changeur_zayan',
      name: 'Changeur ZAYAN',
      faction: Faction.ALIEN,
      planetId: 'mycelion',
      position: { x: 0, y: 2, z: 0 },
      type: 'EXCHANGER',
      inventory: [],
      exchangeFee: 0
    };

    // Changeur AKARLYS
    const changeurAkarlys: Merchant = {
      id: 'changeur_akarlys',
      name: 'Changeur AKARLYS',
      faction: Faction.HUMAN,
      planetId: 'aquarys',
      position: { x: 0, y: 2, z: 0 },
      type: 'EXCHANGER',
      inventory: [],
      exchangeFee: 0
    };

    // Changeur MEZALAYIS
    const changeurMezalayis: Merchant = {
      id: 'changeur_mezalayis',
      name: 'Changeur MEZALAYIS',
      faction: Faction.MERCENARY,
      planetId: 'draelkara',
      position: { x: 0, y: 2, z: 0 },
      type: 'EXCHANGER',
      inventory: []
    };

    // Apothicaire ZAYAN (vend potions)
    const apothicaireZayan: Merchant = {
      id: 'apothicaire_zayan',
      name: 'Apothicaire ZAYAN',
      faction: Faction.ALIEN,
      planetId: 'mycelion',
      position: { x: 10, y: 2, z: 10 },
      type: 'APOTHECARY',
      inventory: [
        {
          itemId: 'anti_poison',
          stock: 50,
          price: 100,
          currency: CurrencyType.DARNIAR,
          maxStock: 100,
          restockRate: 10
        },
        {
          itemId: 'antispore_violet',
          stock: 30,
          price: 250,
          currency: CurrencyType.DARNIAR,
          maxStock: 50,
          restockRate: 5
        },
        {
          itemId: 'stimulant_myco_boost',
          stock: 5,
          price: 500,
          currency: CurrencyType.DARNIAR,
          maxStock: 10,
          restockRate: 1
        },
        {
          itemId: 'kit_soin_standard',
          stock: 100,
          price: 80,
          currency: CurrencyType.DARNIAR,
          maxStock: 200,
          restockRate: 20
        }
      ],
      factionDiscount: 0.1
    };

    // Marchand Armures AKARLYS (AQUARYS)
    const marchandArmuresAkarlys: Merchant = {
      id: 'marchand_armures_akarlys',
      name: 'Marchand d\'Armures AKARLYS',
      faction: Faction.HUMAN,
      planetId: 'aquarys',
      position: { x: 15, y: 2, z: 15 },
      type: 'SHOP',
      inventory: [
        {
          itemId: 'armure_tactique_mk1',
          stock: 10,
          price: 500,
          currency: CurrencyType.LYS,
          maxStock: 20,
          restockRate: 2
        },
        {
          itemId: 'armure_plongeur_mk2',
          stock: 5,
          price: 800,
          currency: CurrencyType.LYS,
          maxStock: 10,
          restockRate: 1
        },
        {
          itemId: 'casque_sonar',
          stock: 3,
          price: 1200,
          currency: CurrencyType.LYS,
          maxStock: 5,
          restockRate: 0.5
        },
        {
          itemId: 'exo_armure_mk3',
          stock: 2,
          price: 2000,
          currency: CurrencyType.LYS,
          maxStock: 3,
          restockRate: 0.2
        },
        {
          itemId: 'serum_respiration_aquatique',
          stock: 20,
          price: 300,
          currency: CurrencyType.LYS,
          maxStock: 50,
          restockRate: 5
        },
        {
          itemId: 'antitoxine_marine',
          stock: 30,
          price: 180,
          currency: CurrencyType.LYS,
          maxStock: 50,
          restockRate: 8
        },
        {
          itemId: 'injection_hyper_oxygene',
          stock: 10,
          price: 350,
          currency: CurrencyType.LYS,
          maxStock: 20,
          restockRate: 2
        }
      ],
      factionDiscount: 0.15
    };

    // Marchand Armures ZAYAN (FUNGARIA)
    const marchandArmuresZayan: Merchant = {
      id: 'marchand_armures_zayan',
      name: 'Marchand d\'Armures ZAYAN',
      faction: Faction.ALIEN,
      planetId: 'mycelion',
      position: { x: 15, y: 2, z: 15 },
      type: 'SHOP',
      inventory: [
        {
          itemId: 'armure_fongique_bio',
          stock: 8,
          price: 700,
          currency: CurrencyType.DARNIAR,
          maxStock: 15,
          restockRate: 1.5
        },
        {
          itemId: 'cuirasse_myco_titan',
          stock: 2,
          price: 2500,
          currency: CurrencyType.DARNIAR,
          maxStock: 3,
          restockRate: 0.2
        },
        {
          itemId: 'casque_sporesight',
          stock: 3,
          price: 1500,
          currency: CurrencyType.DARNIAR,
          maxStock: 5,
          restockRate: 0.5
        },
        {
          itemId: 'antispore_violet',
          stock: 25,
          price: 250,
          currency: CurrencyType.DARNIAR,
          maxStock: 40,
          restockRate: 6
        },
        {
          itemId: 'stimulant_myco_boost',
          stock: 3,
          price: 500,
          currency: CurrencyType.DARNIAR,
          maxStock: 5,
          restockRate: 0.5
        }
      ],
      factionDiscount: 0.15
    };

    // Marchand Armures MEZALAYIS (DÉSERTICA)
    const marchandArmuresMezalayis: Merchant = {
      id: 'marchand_armures_mezalayis',
      name: 'Marchand d\'Armures MEZALAYIS',
      faction: Faction.MERCENARY,
      planetId: 'draelkara',
      position: { x: 15, y: 2, z: 15 },
      type: 'SHOP',
      inventory: [
        {
          itemId: 'armure_hybride_modulaire',
          stock: 5,
          price: 1000,
          currency: CurrencyType.ALA,
          maxStock: 10,
          restockRate: 1
        },
        {
          itemId: 'armure_rogue_titan',
          stock: 1,
          price: 3000,
          currency: CurrencyType.ALA,
          maxStock: 2,
          restockRate: 0.1
        },
        {
          itemId: 'casque_tactique_jaune',
          stock: 2,
          price: 1800,
          currency: CurrencyType.ALA,
          maxStock: 3,
          restockRate: 0.3
        },
        {
          itemId: 'potion_anti_canicule',
          stock: 20,
          price: 200,
          currency: CurrencyType.ALA,
          maxStock: 40,
          restockRate: 5
        },
        {
          itemId: 'serum_anti_deshydratation',
          stock: 50,
          price: 100,
          currency: CurrencyType.ALA,
          maxStock: 100,
          restockRate: 10
        }
      ],
      factionDiscount: 0.15
    };

    // Marchand Généraliste (HUB) - vend objets tech, gadgets, munitions
    const marchandGeneraliste: Merchant = {
      id: 'marchand_generaliste_hub',
      name: 'Marchand Généraliste',
      faction: 'NEUTRAL',
      planetId: 'hub',
      position: { x: 0, y: 2, z: 0 },
      type: 'SHOP',
      inventory: [
        {
          itemId: 'kit_medical_avance',
          stock: 50,
          price: 150,
          currency: CurrencyType.DARNIAR,
          maxStock: 100,
          restockRate: 10
        },
        {
          itemId: 'seringue_nano_regen',
          stock: 20,
          price: 250,
          currency: CurrencyType.DARNIAR,
          maxStock: 40,
          restockRate: 4
        },
        {
          itemId: 'spray_reparateur_armure',
          stock: 30,
          price: 120,
          currency: CurrencyType.DARNIAR,
          maxStock: 60,
          restockRate: 6
        },
        {
          itemId: 'cellule_anti_saignement',
          stock: 15,
          price: 200,
          currency: CurrencyType.DARNIAR,
          maxStock: 30,
          restockRate: 3
        },
        {
          itemId: 'anti_paralysie',
          stock: 25,
          price: 150,
          currency: CurrencyType.DARNIAR,
          maxStock: 50,
          restockRate: 5
        },
        {
          itemId: 'stimulant_endurance',
          stock: 40,
          price: 80,
          currency: CurrencyType.DARNIAR,
          maxStock: 80,
          restockRate: 8
        },
        {
          itemId: 'serum_vision_nocturne',
          stock: 20,
          price: 200,
          currency: CurrencyType.DARNIAR,
          maxStock: 40,
          restockRate: 4
        },
        {
          itemId: 'drone_eclaireur',
          stock: 5,
          price: 800,
          currency: CurrencyType.DARNIAR,
          maxStock: 10,
          restockRate: 1
        },
        {
          itemId: 'detecteur_vie',
          stock: 10,
          price: 400,
          currency: CurrencyType.DARNIAR,
          maxStock: 20,
          restockRate: 2
        },
        {
          itemId: 'module_camouflage',
          stock: 2,
          price: 1500,
          currency: CurrencyType.DARNIAR,
          maxStock: 3,
          restockRate: 0.2
        },
        {
          itemId: 'projecteur_hologramme',
          stock: 3,
          price: 1000,
          currency: CurrencyType.DARNIAR,
          maxStock: 5,
          restockRate: 0.5
        },
        {
          itemId: 'batterie_universelle',
          stock: 50,
          price: 150,
          currency: CurrencyType.DARNIAR,
          maxStock: 100,
          restockRate: 10
        },
        {
          itemId: 'generateur_bouclier_portable',
          stock: 2,
          price: 2000,
          currency: CurrencyType.DARNIAR,
          maxStock: 3,
          restockRate: 0.3
        },
        {
          itemId: 'cartouches_haute_pression',
          stock: 200,
          price: 50,
          currency: CurrencyType.DARNIAR,
          maxStock: 500,
          restockRate: 50
        },
        {
          itemId: 'munitions_cryo',
          stock: 100,
          price: 80,
          currency: CurrencyType.DARNIAR,
          maxStock: 300,
          restockRate: 30
        },
        {
          itemId: 'laser_cells',
          stock: 150,
          price: 60,
          currency: CurrencyType.DARNIAR,
          maxStock: 400,
          restockRate: 40
        },
        {
          itemId: 'grenades_emp',
          stock: 20,
          price: 200,
          currency: CurrencyType.DARNIAR,
          maxStock: 50,
          restockRate: 5
        },
        {
          itemId: 'grenades_corrosives',
          stock: 10,
          price: 300,
          currency: CurrencyType.DARNIAR,
          maxStock: 30,
          restockRate: 2
        }
      ]
    };

    // Marchand Matériaux (HUB)
    const marchandMateriaux: Merchant = {
      id: 'marchand_materiaux_hub',
      name: 'Marchand de Matériaux',
      faction: 'NEUTRAL',
      planetId: 'hub',
      position: { x: 5, y: 2, z: 5 },
      type: 'SHOP',
      inventory: [
        {
          itemId: 'fer_renforce',
          stock: 500,
          price: 20,
          currency: CurrencyType.DARNIAR,
          maxStock: 1000,
          restockRate: 100
        },
        {
          itemId: 'cristaux_aquarys',
          stock: 50,
          price: 100,
          currency: CurrencyType.LYS,
          maxStock: 100,
          restockRate: 10
        },
        {
          itemId: 'coquilles_chitineuses',
          stock: 80,
          price: 60,
          currency: CurrencyType.ALA,
          maxStock: 150,
          restockRate: 15
        },
        {
          itemId: 'spores_luminescentes',
          stock: 100,
          price: 50,
          currency: CurrencyType.DARNIAR,
          maxStock: 200,
          restockRate: 20
        },
        {
          itemId: 'fibre_techno_organique',
          stock: 40,
          price: 120,
          currency: CurrencyType.DARNIAR,
          maxStock: 80,
          restockRate: 8
        },
        {
          itemId: 'nano_metal_jaune',
          stock: 20,
          price: 200,
          currency: CurrencyType.ALA,
          maxStock: 50,
          restockRate: 5
        }
      ]
    };

    // Marchand Rares (HUB) - objets très chers
    const marchandRares: Merchant = {
      id: 'marchand_rares_hub',
      name: 'Marchand d\'Objets Rares',
      faction: 'NEUTRAL',
      planetId: 'hub',
      position: { x: -5, y: 2, z: -5 },
      type: 'SHOP',
      inventory: [
        {
          itemId: 'relique_galactique',
          stock: 1,
          price: 10000,
          currency: CurrencyType.DARNIAR,
          maxStock: 1,
          restockRate: 0.01 // Très rare
        },
        {
          itemId: 'coeur_titan_fongique',
          stock: 1,
          price: 5000,
          currency: CurrencyType.DARNIAR,
          maxStock: 2,
          restockRate: 0.1
        },
        {
          itemId: 'module_gravite_negative',
          stock: 1,
          price: 4000,
          currency: CurrencyType.DARNIAR,
          maxStock: 2,
          restockRate: 0.2
        },
        {
          itemId: 'serum_rage_alien',
          stock: 3,
          price: 800,
          currency: CurrencyType.DARNIAR,
          maxStock: 5,
          restockRate: 0.5
        },
        {
          itemId: 'implant_cybernetique',
          stock: 1,
          price: 15000,
          currency: CurrencyType.DARNIAR,
          maxStock: 1,
          restockRate: 0.01 // Extrêmement rare
        }
      ]
    };

    // Marchand neutre (HUB)
    const marchandNeutre: Merchant = {
      id: 'marchand_neutre_hub',
      name: 'Marchand Neutre',
      faction: 'NEUTRAL',
      planetId: 'hub',
      position: { x: 0, y: 2, z: 0 },
      type: 'SHOP',
      inventory: [
        {
          itemId: 'anti_poison',
          stock: 30,
          price: 120, // Plus cher car neutre
          currency: CurrencyType.DARNIAR,
          maxStock: 50,
          restockRate: 5
        }
      ]
    };

    this.merchants.set(changeurZayan.id, changeurZayan);
    this.merchants.set(changeurAkarlys.id, changeurAkarlys);
    this.merchants.set(changeurMezalayis.id, changeurMezalayis);
    this.merchants.set(apothicaireZayan.id, apothicaireZayan);
    this.merchants.set(marchandNeutre.id, marchandNeutre);
    this.merchants.set(marchandArmuresAkarlys.id, marchandArmuresAkarlys);
    this.merchants.set(marchandArmuresZayan.id, marchandArmuresZayan);
    this.merchants.set(marchandArmuresMezalayis.id, marchandArmuresMezalayis);
    this.merchants.set(marchandGeneraliste.id, marchandGeneraliste);
    this.merchants.set(marchandMateriaux.id, marchandMateriaux);
    this.merchants.set(marchandRares.id, marchandRares);
  }

  // Obtenir un marchand
  public getMerchant(merchantId: string): Merchant | null {
    return this.merchants.get(merchantId) || null;
  }

  // Obtenir les marchands par planète
  public getMerchantsByPlanet(planetId: string): Merchant[] {
    return Array.from(this.merchants.values()).filter(m => m.planetId === planetId);
  }

  public getAllMerchants(): Merchant[] {
    return Array.from(this.merchants.values());
  }

  // Obtenir les changeurs
  public getExchangers(planetId?: string): Merchant[] {
    const exchangers = Array.from(this.merchants.values()).filter(m => m.type === 'EXCHANGER');
    if (planetId) {
      return exchangers.filter(m => m.planetId === planetId);
    }
    return exchangers;
  }

  // Acheter un item à un marchand
  public buyItem(
    merchantId: string,
    itemId: string,
    quantity: number,
    playerCurrency: CurrencyType,
    playerFaction: Faction
  ): { success: boolean; totalCost?: number; reason?: string } {
    const merchant = this.getMerchant(merchantId);
    if (!merchant) return { success: false, reason: 'Marchand introuvable' };

    const inventoryItem = merchant.inventory.find(i => i.itemId === itemId);
    if (!inventoryItem) return { success: false, reason: 'Item non disponible' };

    if (inventoryItem.stock < quantity) {
      return { success: false, reason: 'Stock insuffisant' };
    }

    // Calculer le prix
    let price = inventoryItem.price;

    // Appliquer la réduction de faction si applicable
    if (merchant.factionDiscount && merchant.faction === playerFaction) {
      price = price * (1 - merchant.factionDiscount);
    }

    // Convertir la monnaie si nécessaire
    let totalCost = price * quantity;
    if (inventoryItem.currency !== playerCurrency) {
      const conversion = currencyService.convertCurrency(
        totalCost,
        inventoryItem.currency,
        playerCurrency
      );
      totalCost = conversion.converted + conversion.fee;
    }

    // Mettre à jour le stock
    inventoryItem.stock -= quantity;

    return { success: true, totalCost };
  }

  // Vendre un item à un marchand
  public sellItem(
    merchantId: string,
    itemId: string,
    quantity: number,
    playerCurrency: CurrencyType,
    playerFaction: Faction
  ): { success: boolean; totalEarned?: number; reason?: string } {
    const merchant = this.getMerchant(merchantId);
    if (!merchant) return { success: false, reason: 'Marchand introuvable' };

    // Les marchands neutres acceptent tout
    // Les marchands de faction peuvent refuser certains items
    if (merchant.faction !== 'NEUTRAL' && merchant.faction !== playerFaction) {
      // Vérifier si le marchand accepte les items de cette faction
      // Pour l'instant, on accepte tout
    }

    const item = itemService.getItem(itemId);
    if (!item) return { success: false, reason: 'Item invalide' };

    // Prix de vente = 50% du prix d'achat
    const sellPrice = item.price * 0.5 * quantity;

    // Convertir la monnaie
    let totalEarned = sellPrice;
    if (item.currency !== playerCurrency) {
      const conversion = currencyService.convertCurrency(
        totalEarned,
        item.currency,
        playerCurrency
      );
      totalEarned = conversion.converted;
    }

    return { success: true, totalEarned };
  }

  // Convertir de la monnaie via un changeur
  public exchangeCurrency(
    exchangerId: string,
    amount: number,
    from: CurrencyType,
    to: CurrencyType
  ): { success: boolean; converted?: number; fee?: number; reason?: string } {
    const exchanger = this.getMerchant(exchangerId);
    if (!exchanger || exchanger.type !== 'EXCHANGER') {
      return { success: false, reason: 'Changeur invalide' };
    }

    const conversion = currencyService.convertCurrency(amount, from, to, true);

    // Appliquer les frais du changeur
    const fee = exchanger.exchangeFee || 0;
    const finalAmount = conversion.converted * (1 - fee / 100);

    return {
      success: true,
      converted: finalAmount,
      fee: conversion.fee + (amount * fee / 100)
    };
  }

  // Restock automatique des marchands
  public restockMerchants(): void {
    const now = Date.now();
    const oneHour = 3600000; // 1 heure en ms

    this.merchants.forEach((merchant, merchantId) => {
      const lastRestock = this.lastRestockTime.get(merchantId) || now;
      const timeSinceRestock = now - lastRestock;

      if (timeSinceRestock >= oneHour) {
        merchant.inventory.forEach(item => {
          if (item.restockRate && item.stock < item.maxStock) {
            const restockAmount = Math.floor(
              (item.restockRate * timeSinceRestock) / oneHour
            );
            item.stock = Math.min(item.maxStock, item.stock + restockAmount);
          }
        });

        this.lastRestockTime.set(merchantId, now);
      }
    });
  }

  // Mettre à jour les prix selon l'économie locale
  public updatePrices(planetId: string, inflation: number): void {
    // inflation: -1 à 1 (-1 = déflation, 1 = inflation)
    const merchants = this.getMerchantsByPlanet(planetId);

    merchants.forEach(merchant => {
      merchant.inventory.forEach(item => {
        const priceChange = 1 + (inflation * 0.1); // Max 10% de changement
        item.price = Math.max(1, item.price * priceChange);
      });
    });
  }
}

export const economyService = EconomyService.getInstance();

