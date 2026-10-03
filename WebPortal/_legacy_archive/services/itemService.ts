import { GameItem, PotionEffect, CurrencyType, Rarity } from '../types';
import { currencyService } from './currencyService';

// Service de gestion des items
export class ItemService {
  private static instance: ItemService;
  private items: Map<string, GameItem> = new Map();

  private constructor() {
    this.initializeItems();
  }

  public static getInstance(): ItemService {
    if (!ItemService.instance) {
      ItemService.instance = new ItemService();
    }
    return ItemService.instance;
  }

  private initializeItems(): void {
    // ========== ARMURES ==========

    // HUMANS (AQUARYS)
    this.items.set('armure_tactique_mk1', {
      id: 'armure_tactique_mk1',
      name: 'Armure Tactique MK-I',
      type: 'ARMOR',
      rarity: 'COMMON',
      price: 500,
      currency: CurrencyType.LYS,
      description: 'Légère, +10 armure',
      icon: '/pnj_marchan_et_banquier/PNJ_Marchand_banquier_akarlys/armure_mk1.png',
      stackable: false,
      maxStack: 1
    });

    this.items.set('armure_plongeur_mk2', {
      id: 'armure_plongeur_mk2',
      name: 'Armure Plongeur MK-II',
      type: 'ARMOR',
      rarity: 'UNCOMMON',
      price: 800,
      currency: CurrencyType.LYS,
      description: 'Résistance aquatique, +oxygène',
      icon: '/pnj_marchan_et_banquier/PNJ_Marchand_banquier_akarlys/armure_mk2.png',
      stackable: false,
      maxStack: 1
    });

    this.items.set('casque_sonar', {
      id: 'casque_sonar',
      name: 'Casque Sonar',
      type: 'ARMOR',
      rarity: 'RARE',
      price: 1200,
      currency: CurrencyType.LYS,
      description: 'Détecte la faune sous-marine',
      icon: '/pnj_marchan_et_banquier/PNJ_Marchand_banquier_akarlys/casque_sonar.png',
      stackable: false,
      maxStack: 1
    });

    this.items.set('exo_armure_mk3', {
      id: 'exo_armure_mk3',
      name: 'Exo-Armure MK-III',
      type: 'ARMOR',
      rarity: 'EPIC',
      price: 2000,
      currency: CurrencyType.LYS,
      description: '+20 armure, stabilisation de tir',
      icon: '/pnj_marchan_et_banquier/PNJ_Marchand_banquier_akarlys/exo_armure.png',
      stackable: false,
      maxStack: 1
    });

    // ALIENS (FUNGARIA)
    this.items.set('armure_fongique_bio', {
      id: 'armure_fongique_bio',
      name: 'Armure Fongique Bio-Tissée',
      type: 'ARMOR',
      rarity: 'UNCOMMON',
      price: 700,
      currency: CurrencyType.DARNIAR,
      description: 'Regen lente + immunité spores légères',
      icon: '/pnj_marchan_et_banquier/PNJ_Marchand_banquier_zayan/armure_fongique.png',
      stackable: false,
      maxStack: 1
    });

    this.items.set('cuirasse_myco_titan', {
      id: 'cuirasse_myco_titan',
      name: 'Cuirasse Myco-Titan',
      type: 'ARMOR',
      rarity: 'EPIC',
      price: 2500,
      currency: CurrencyType.DARNIAR,
      description: 'Énorme résistance aux dégâts physiques',
      icon: '/pnj_marchan_et_banquier/PNJ_Marchand_banquier_zayan/cuirasse_myco.png',
      stackable: false,
      maxStack: 1
    });

    this.items.set('casque_sporesight', {
      id: 'casque_sporesight',
      name: 'Casque Sporesight',
      type: 'ARMOR',
      rarity: 'RARE',
      price: 1500,
      currency: CurrencyType.DARNIAR,
      description: 'Ajoute vision thermique/spores',
      icon: '/pnj_marchan_et_banquier/PNJ_Marchand_banquier_zayan/casque_sporesight.png',
      stackable: false,
      maxStack: 1
    });

    // MERCENAIRES
    this.items.set('armure_hybride_modulaire', {
      id: 'armure_hybride_modulaire',
      name: 'Armure Hybride Modulaire',
      type: 'ARMOR',
      rarity: 'RARE',
      price: 1000,
      currency: CurrencyType.ALA,
      description: 'Mix techno + bio',
      icon: '/pnj_marchan_et_banquier/PNJ_Marchand_banquier_MEZALAYIS/armure_hybride.png',
      stackable: false,
      maxStack: 1
    });

    this.items.set('armure_rogue_titan', {
      id: 'armure_rogue_titan',
      name: 'Armure Lourde Rogue-Titan',
      type: 'ARMOR',
      rarity: 'LEGENDARY',
      price: 3000,
      currency: CurrencyType.ALA,
      description: '+40 armure',
      icon: '/pnj_marchan_et_banquier/PNJ_Marchand_banquier_MEZALAYIS/armure_rogue.png',
      stackable: false,
      maxStack: 1
    });

    this.items.set('casque_tactique_jaune', {
      id: 'casque_tactique_jaune',
      name: 'Casque Tactique Jaune',
      type: 'ARMOR',
      rarity: 'EPIC',
      price: 1800,
      currency: CurrencyType.ALA,
      description: 'Radar élite amélioré',
      icon: '/pnj_marchan_et_banquier/PNJ_Marchand_banquier_MEZALAYIS/casque_tactique.png',
      stackable: false,
      maxStack: 1
    });

    // ========== OBJETS DE SOIN / SOUTIEN ==========

    this.items.set('kit_soin_standard', {
      id: 'kit_soin_standard',
      name: 'Kit de Soin Standard',
      type: 'CONSUMABLE',
      rarity: 'COMMON',
      price: 80,
      currency: CurrencyType.DARNIAR,
      description: '+50 HP',
      icon: '/image_craft_shop/_shop_ZAYAN _/kit_soin.png',
      effect: {
        type: 'HEAL',
        value: 50,
        immediate: true,
        cooldown: 20
      },
      stackable: true,
      maxStack: 99
    });

    this.items.set('kit_medical_avance', {
      id: 'kit_medical_avance',
      name: 'Kit Médical Avancé',
      type: 'CONSUMABLE',
      rarity: 'UNCOMMON',
      price: 150,
      currency: CurrencyType.DARNIAR,
      description: '+100 HP',
      icon: '/image_craft_shop/_shop_ZAYAN _/kit_medical.png',
      effect: {
        type: 'HEAL',
        value: 100,
        immediate: true,
        cooldown: 30
      },
      stackable: true,
      maxStack: 99
    });

    this.items.set('seringue_nano_regen', {
      id: 'seringue_nano_regen',
      name: 'Seringue Nano-Regen',
      type: 'CONSUMABLE',
      rarity: 'RARE',
      price: 250,
      currency: CurrencyType.DARNIAR,
      description: 'Régénération lente pendant 20 sec',
      icon: '/image_craft_shop/_shop_ZAYAN _/seringue_regen.png',
      effect: {
        type: 'BUFF',
        value: 5, // HP par seconde
        duration: 20,
        immediate: false,
        cooldown: 60
      },
      stackable: true,
      maxStack: 50
    });

    this.items.set('spray_reparateur_armure', {
      id: 'spray_reparateur_armure',
      name: 'Spray Réparateur d\'Armure',
      type: 'CONSUMABLE',
      rarity: 'UNCOMMON',
      price: 120,
      currency: CurrencyType.DARNIAR,
      description: '+50 ARMURE',
      icon: '/image_craft_shop/_shop_ZAYAN _/spray_armure.png',
      effect: {
        type: 'BUFF',
        value: 50,
        duration: 0,
        immediate: true,
        cooldown: 45
      },
      stackable: true,
      maxStack: 50
    });

    this.items.set('cellule_anti_saignement', {
      id: 'cellule_anti_saignement',
      name: 'Cellule Anti-Saignement',
      type: 'CONSUMABLE',
      rarity: 'RARE',
      price: 200,
      currency: CurrencyType.DARNIAR,
      description: 'Stoppe les dégâts continu',
      icon: '/image_craft_shop/_shop_ZAYAN _/cellule_anti.png',
      effect: {
        type: 'BUFF',
        value: 0,
        duration: 30,
        immediate: true,
        cooldown: 90
      },
      stackable: true,
      maxStack: 30
    });

    // ========== POTIONS / SÉRUMS ==========

    // Potions communes
    this.items.set('anti_poison', {
      id: 'anti_poison',
      name: 'Potion Anti-Poison',
      type: 'POTION',
      rarity: 'COMMON',
      price: 100,
      currency: CurrencyType.DARNIAR,
      description: 'Immunise 60 sec',
      icon: '/image_craft_shop/_shop_ZAYAN _/anti_poison.png',
      effect: {
        type: 'ANTI_POISON',
        duration: 60,
        immediate: true,
        cooldown: 60
      },
      stackable: true,
      maxStack: 99
    });

    this.items.set('anti_paralysie', {
      id: 'anti_paralysie',
      name: 'Potion Anti-Paralysie',
      type: 'POTION',
      rarity: 'UNCOMMON',
      price: 150,
      currency: CurrencyType.DARNIAR,
      description: 'Supprime la paralysie + protège 30 sec',
      icon: '/image_craft_shop/_shop_ZAYAN _/anti_paralysie.png',
      effect: {
        type: 'BUFF',
        duration: 30,
        immediate: true,
        cooldown: 45
      },
      stackable: true,
      maxStack: 50
    });

    this.items.set('stimulant_endurance', {
      id: 'stimulant_endurance',
      name: 'Stimulant d\'Endurance',
      type: 'POTION',
      rarity: 'COMMON',
      price: 80,
      currency: CurrencyType.DARNIAR,
      description: '+vitesse, +saut pendant 15 sec',
      icon: '/image_craft_shop/_shop_ZAYAN _/stimulant.png',
      effect: {
        type: 'BUFF',
        duration: 15,
        immediate: false,
        cooldown: 60
      },
      stackable: true,
      maxStack: 50
    });

    this.items.set('serum_respiration_aquatique', {
      id: 'serum_respiration_aquatique',
      name: 'Sérum de Respiration Aquatique',
      type: 'POTION',
      rarity: 'RARE',
      price: 300,
      currency: CurrencyType.LYS,
      description: 'Respirer sous l\'eau 60 sec',
      icon: '/pnj_marchan_et_banquier/PNJ_Marchand_banquier_akarlys/serum_aquatique.png',
      effect: {
        type: 'BUFF',
        duration: 60,
        immediate: false,
        cooldown: 120
      },
      stackable: true,
      maxStack: 30
    });

    this.items.set('serum_vision_nocturne', {
      id: 'serum_vision_nocturne',
      name: 'Sérum de Vision Nocturne',
      type: 'POTION',
      rarity: 'UNCOMMON',
      price: 200,
      currency: CurrencyType.DARNIAR,
      description: 'Vision nocturne 120 sec',
      icon: '/image_craft_shop/_shop_ZAYAN _/serum_vision.png',
      effect: {
        type: 'BUFF',
        duration: 120,
        immediate: false,
        cooldown: 180
      },
      stackable: true,
      maxStack: 30
    });

    // Potions spécifiques AQUARYS
    this.items.set('antitoxine_marine', {
      id: 'antitoxine_marine',
      name: 'Antitoxine Marine',
      type: 'POTION',
      rarity: 'UNCOMMON',
      price: 180,
      currency: CurrencyType.LYS,
      description: 'Contre venin de poisson / poulpe',
      icon: '/pnj_marchan_et_banquier/PNJ_Marchand_banquier_akarlys/antitoxine.png',
      effect: {
        type: 'ANTI_POISON',
        duration: 90,
        immediate: true,
        cooldown: 60
      },
      stackable: true,
      maxStack: 50
    });

    this.items.set('injection_hyper_oxygene', {
      id: 'injection_hyper_oxygene',
      name: 'Injection Hyper-Oxygène',
      type: 'POTION',
      rarity: 'RARE',
      price: 350,
      currency: CurrencyType.LYS,
      description: '+durée de plongée',
      icon: '/pnj_marchan_et_banquier/PNJ_Marchand_banquier_akarlys/injection_oxy.png',
      effect: {
        type: 'BUFF',
        duration: 120,
        immediate: false,
        cooldown: 180
      },
      stackable: true,
      maxStack: 30
    });

    // Potions spécifiques DÉSERTICA
    this.items.set('potion_anti_canicule', {
      id: 'potion_anti_canicule',
      name: 'Potion Anti-Canicule',
      type: 'POTION',
      rarity: 'UNCOMMON',
      price: 200,
      currency: CurrencyType.ALA,
      description: 'Réduit dégâts de chaleur',
      icon: '/pnj_marchan_et_banquier/PNJ_Marchand_banquier_MEZALAYIS/potion_canicule.png',
      effect: {
        type: 'BUFF',
        duration: 300,
        immediate: false,
        cooldown: 300
      },
      stackable: true,
      maxStack: 30
    });

    this.items.set('serum_anti_deshydratation', {
      id: 'serum_anti_deshydratation',
      name: 'Sérum Anti-Déshydratation',
      type: 'POTION',
      rarity: 'COMMON',
      price: 100,
      currency: CurrencyType.ALA,
      description: 'Ralenti perte de stamina',
      icon: '/pnj_marchan_et_banquier/PNJ_Marchand_banquier_MEZALAYIS/serum_deshydratation.png',
      effect: {
        type: 'BUFF',
        duration: 600,
        immediate: false,
        cooldown: 600
      },
      stackable: true,
      maxStack: 50
    });

    // Potions spécifiques FUNGARIA
    this.items.set('antispore_violet', {
      id: 'antispore_violet',
      name: 'Antispore Violet',
      type: 'POTION',
      rarity: 'RARE',
      price: 250,
      currency: CurrencyType.DARNIAR,
      description: 'Supprime les spores toxiques',
      icon: '/pnj_marchan_et_banquier/PNJ_Marchand_banquier_zayan/antispore.png',
      effect: {
        type: 'ANTI_POISON',
        duration: 120,
        immediate: true,
        cooldown: 90
      },
      stackable: true,
      maxStack: 30
    });

    this.items.set('stimulant_myco_boost', {
      id: 'stimulant_myco_boost',
      name: 'Stimulant Myco-Boost',
      type: 'POTION',
      rarity: 'EPIC',
      price: 500,
      currency: CurrencyType.DARNIAR,
      description: 'Boost vitesse + perception (rare)',
      icon: '/pnj_marchan_et_banquier/PNJ_Marchand_banquier_zayan/stimulant_myco.png',
      effect: {
        type: 'BUFF',
        duration: 60,
        immediate: false,
        cooldown: 300
      },
      stackable: true,
      maxStack: 10
    });

    // ========== OBJETS TECH / GADGETS ==========

    this.items.set('drone_eclaireur', {
      id: 'drone_eclaireur',
      name: 'Drone Éclaireur',
      type: 'GADGET',
      rarity: 'RARE',
      price: 800,
      currency: CurrencyType.DARNIAR,
      description: 'Scanne 20 m autour',
      icon: '/image_craft_shop/_shop_ZAYAN _/drone.png',
      stackable: false,
      maxStack: 1
    });

    this.items.set('detecteur_vie', {
      id: 'detecteur_vie',
      name: 'Détecteur de Vie',
      type: 'GADGET',
      rarity: 'UNCOMMON',
      price: 400,
      currency: CurrencyType.DARNIAR,
      description: 'Montre créatures proches',
      icon: '/image_craft_shop/_shop_ZAYAN _/detecteur.png',
      stackable: false,
      maxStack: 1
    });

    this.items.set('module_camouflage', {
      id: 'module_camouflage',
      name: 'Module de Camouflage',
      type: 'GADGET',
      rarity: 'EPIC',
      price: 1500,
      currency: CurrencyType.DARNIAR,
      description: 'Invisibilité 5 sec',
      icon: '/image_craft_shop/_shop_ZAYAN _/camouflage.png',
      stackable: false,
      maxStack: 1
    });

    this.items.set('projecteur_hologramme', {
      id: 'projecteur_hologramme',
      name: 'Projecteur Hologramme-Leurre',
      type: 'GADGET',
      rarity: 'RARE',
      price: 1000,
      currency: CurrencyType.DARNIAR,
      description: 'Attire ennemis',
      icon: '/image_craft_shop/_shop_ZAYAN _/hologramme.png',
      stackable: false,
      maxStack: 1
    });

    this.items.set('batterie_universelle', {
      id: 'batterie_universelle',
      name: 'Batterie Universelle',
      type: 'GADGET',
      rarity: 'COMMON',
      price: 150,
      currency: CurrencyType.DARNIAR,
      description: 'Recharge armes & outils',
      icon: '/image_craft_shop/_shop_ZAYAN _/batterie.png',
      stackable: true,
      maxStack: 20
    });

    this.items.set('generateur_bouclier_portable', {
      id: 'generateur_bouclier_portable',
      name: 'Générateur de Bouclier Portable',
      type: 'GADGET',
      rarity: 'EPIC',
      price: 2000,
      currency: CurrencyType.DARNIAR,
      description: '+armure temporaire',
      icon: '/image_craft_shop/_shop_ZAYAN _/bouclier_portable.png',
      stackable: false,
      maxStack: 1
    });

    // ========== MUNITIONS & AMÉLIORATIONS ==========

    this.items.set('cartouches_haute_pression', {
      id: 'cartouches_haute_pression',
      name: 'Cartouches Haute-Pression',
      type: 'MATERIAL',
      rarity: 'UNCOMMON',
      price: 50,
      currency: CurrencyType.DARNIAR,
      description: '+15% dégâts',
      icon: '/image_craft_shop/_shop_ZAYAN _/cartouches.png',
      stackable: true,
      maxStack: 200
    });

    this.items.set('munitions_cryo', {
      id: 'munitions_cryo',
      name: 'Munitions Cryo',
      type: 'MATERIAL',
      rarity: 'RARE',
      price: 80,
      currency: CurrencyType.DARNIAR,
      description: 'Ralentissent l\'ennemi',
      icon: '/image_craft_shop/_shop_ZAYAN _/cryo.png',
      stackable: true,
      maxStack: 200
    });

    this.items.set('laser_cells', {
      id: 'laser_cells',
      name: 'Laser Cells',
      type: 'MATERIAL',
      rarity: 'UNCOMMON',
      price: 60,
      currency: CurrencyType.DARNIAR,
      description: 'Énergie pour armes futuristes',
      icon: '/image_craft_shop/_shop_ZAYAN _/laser_cells.png',
      stackable: true,
      maxStack: 200
    });

    this.items.set('grenades_emp', {
      id: 'grenades_emp',
      name: 'Grenades EMP',
      type: 'WEAPON',
      rarity: 'RARE',
      price: 200,
      currency: CurrencyType.DARNIAR,
      description: 'Désactive équipements électro',
      icon: '/image_craft_shop/_shop_ZAYAN _/grenades_emp.png',
      stackable: true,
      maxStack: 50
    });

    this.items.set('grenades_corrosives', {
      id: 'grenades_corrosives',
      name: 'Grenades Corrosives',
      type: 'WEAPON',
      rarity: 'EPIC',
      price: 300,
      currency: CurrencyType.DARNIAR,
      description: 'Efficaces sur monstrueux fongiques',
      icon: '/image_craft_shop/_shop_ZAYAN _/grenades_corrosives.png',
      stackable: true,
      maxStack: 30
    });

    // ========== MATÉRIAUX POUR CRAFT ==========

    this.items.set('fer_renforce', {
      id: 'fer_renforce',
      name: 'Fer Renforcé',
      type: 'MATERIAL',
      rarity: 'COMMON',
      price: 20,
      currency: CurrencyType.DARNIAR,
      description: 'Matériau de base',
      icon: '/image_craft_shop/_shop_ZAYAN _/fer.png',
      stackable: true,
      maxStack: 999
    });

    this.items.set('cristaux_aquarys', {
      id: 'cristaux_aquarys',
      name: 'Cristaux Aquarys',
      type: 'MATERIAL',
      rarity: 'RARE',
      price: 100,
      currency: CurrencyType.LYS,
      description: 'Cristaux énergétiques aquatiques',
      icon: '/pnj_marchan_et_banquier/PNJ_Marchand_banquier_akarlys/cristaux.png',
      stackable: true,
      maxStack: 200
    });

    this.items.set('coquilles_chitineuses', {
      id: 'coquilles_chitineuses',
      name: 'Coquilles Chitineuses Désertiques',
      type: 'MATERIAL',
      rarity: 'UNCOMMON',
      price: 60,
      currency: CurrencyType.ALA,
      description: 'Carapaces résistantes',
      icon: '/pnj_marchan_et_banquier/PNJ_Marchand_banquier_MEZALAYIS/coquilles.png',
      stackable: true,
      maxStack: 200
    });

    this.items.set('spores_luminescentes', {
      id: 'spores_luminescentes',
      name: 'Spores Luminescentes',
      type: 'MATERIAL',
      rarity: 'UNCOMMON',
      price: 50,
      currency: CurrencyType.DARNIAR,
      description: 'Spores énergétiques',
      icon: '/pnj_marchan_et_banquier/PNJ_Marchand_banquier_zayan/spores.png',
      stackable: true,
      maxStack: 200
    });

    this.items.set('fibre_techno_organique', {
      id: 'fibre_techno_organique',
      name: 'Fibre Techno-Organique',
      type: 'MATERIAL',
      rarity: 'RARE',
      price: 120,
      currency: CurrencyType.DARNIAR,
      description: 'Matériau hybride',
      icon: '/image_craft_shop/_shop_ZAYAN _/fibre.png',
      stackable: true,
      maxStack: 200
    });

    this.items.set('nano_metal_jaune', {
      id: 'nano_metal_jaune',
      name: 'Nano-Métal Jaune Mercenaire',
      type: 'MATERIAL',
      rarity: 'EPIC',
      price: 200,
      currency: CurrencyType.ALA,
      description: 'Métal renforcé mercenaire',
      icon: '/pnj_marchan_et_banquier/PNJ_Marchand_banquier_MEZALAYIS/nano_metal.png',
      stackable: true,
      maxStack: 100
    });

    // ========== OBJETS RARES ==========

    this.items.set('relique_galactique', {
      id: 'relique_galactique',
      name: 'Relique Galactique',
      type: 'MATERIAL',
      rarity: 'ARTIFACT',
      price: 10000,
      currency: CurrencyType.DARNIAR,
      description: 'Très chère, valeur inestimable',
      icon: '/image_craft_shop/_shop_ZAYAN _/relique.png',
      stackable: false,
      maxStack: 1
    });

    this.items.set('coeur_titan_fongique', {
      id: 'coeur_titan_fongique',
      name: 'Cœur de Titan Fongique',
      type: 'MATERIAL',
      rarity: 'LEGENDARY',
      price: 5000,
      currency: CurrencyType.DARNIAR,
      description: 'Améliore l\'armure',
      icon: '/pnj_marchan_et_banquier/PNJ_Marchand_banquier_zayan/coeur_titan.png',
      stackable: false,
      maxStack: 1
    });

    this.items.set('module_gravite_negative', {
      id: 'module_gravite_negative',
      name: 'Module de Gravité Négative',
      type: 'GADGET',
      rarity: 'LEGENDARY',
      price: 4000,
      currency: CurrencyType.DARNIAR,
      description: 'Saut x3',
      icon: '/image_craft_shop/_shop_ZAYAN _/gravite.png',
      stackable: false,
      maxStack: 1
    });

    this.items.set('serum_rage_alien', {
      id: 'serum_rage_alien',
      name: 'Sérum de Rage Alien',
      type: 'POTION',
      rarity: 'EPIC',
      price: 800,
      currency: CurrencyType.DARNIAR,
      description: '+force + vitesse (danger)',
      icon: '/pnj_marchan_et_banquier/PNJ_Marchand_banquier_zayan/serum_rage.png',
      effect: {
        type: 'BUFF',
        duration: 30,
        immediate: false,
        cooldown: 600
      },
      stackable: true,
      maxStack: 5
    });

    this.items.set('implant_cybernetique', {
      id: 'implant_cybernetique',
      name: 'Implant Cybernétique',
      type: 'GADGET',
      rarity: 'ARTIFACT',
      price: 15000,
      currency: CurrencyType.DARNIAR,
      description: 'Boost définitif (rare)',
      icon: '/image_craft_shop/_shop_ZAYAN _/implant.png',
      stackable: false,
      maxStack: 1
    });
  }

  // Obtenir un item par ID
  public getItem(itemId: string): GameItem | null {
    return this.items.get(itemId) || null;
  }

  // Obtenir tous les items
  public getAllItems(): GameItem[] {
    return Array.from(this.items.values());
  }

  // Obtenir les items par type
  public getItemsByType(type: GameItem['type']): GameItem[] {
    return Array.from(this.items.values()).filter(item => item.type === type);
  }

  // Obtenir les items par rareté
  public getItemsByRarity(rarity: Rarity): GameItem[] {
    return Array.from(this.items.values()).filter(item => item.rarity === rarity);
  }

  // Appliquer l'effet d'une potion
  public applyPotionEffect(item: GameItem, playerStats: any): { success: boolean; message?: string } {
    if (item.type !== 'POTION' || !item.effect) {
      return { success: false, message: 'Cet item n\'est pas une potion' };
    }

    const effect = item.effect;

    switch (effect.type) {
      case 'ANTI_POISON':
        // Retirer tous les effets de poison
        if (playerStats.poisonStacks) {
          playerStats.poisonStacks = 0;
          playerStats.poisonDuration = 0;
        }
        return { success: true, message: 'Poison retiré' };

      case 'HEAL':
        if (effect.value) {
          const healAmount = Math.min(effect.value, playerStats.maxHp - playerStats.hp);
          playerStats.hp += healAmount;
          return { success: true, message: `+${healAmount} HP` };
        }
        return { success: false, message: 'Valeur de soin invalide' };

      default:
        return { success: false, message: 'Effet non implémenté' };
    }
  }

  // Vérifier si un item peut être utilisé (cooldown)
  public canUseItem(itemId: string, lastUseTime: Map<string, number>): boolean {
    const item = this.getItem(itemId);
    if (!item || !item.effect) return false;

    const lastUse = lastUseTime.get(itemId) || 0;
    const cooldownMs = item.effect.cooldown * 1000;
    const now = Date.now();

    return (now - lastUse) >= cooldownMs;
  }

  // Obtenir le prix d'un item dans une monnaie spécifique
  public getItemPrice(itemId: string, targetCurrency: CurrencyType): number {
    const item = this.getItem(itemId);
    if (!item) return 0;

    if (item.currency === targetCurrency) {
      return item.price;
    }

    // Convertir le prix
    const conversion = currencyService.convertCurrency(item.price, item.currency, targetCurrency);
    return conversion.converted;
  }
}

export const itemService = ItemService.getInstance();

