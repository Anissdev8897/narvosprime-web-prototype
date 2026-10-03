import { Faction } from '../types';

export interface WeaponDef {
  id: string;
  name: string;
  faction: Faction;
  type: 'RIFLE' | 'PISTOL' | 'SNIPER' | 'SHOTGUN' | 'MELEE' | 'ORGANIC' | 'EXOTIC';
  modelPath: string;
  texturePath?: string;
  damage: number;
  range: number;
  fireRate: number; // Shots per second
  reloadTime: number; // Seconds
  magazineSize: number;
  accuracy: number; // 0-1
  recoil: number; // 0-1
  animationType: 'RIFLE_SHOOT' | 'PISTOL_SHOOT' | 'MELEE_SLASH' | 'ORGANIC_ATTACK';
}

export class WeaponService {
  private static instance: WeaponService;
  private weapons: Map<string, WeaponDef> = new Map();

  private constructor() {
    this.initializeWeapons();
  }

  public static getInstance(): WeaponService {
    if (!WeaponService.instance) {
      WeaponService.instance = new WeaponService();
    }
    return WeaponService.instance;
  }

  private initializeWeapons(): void {
    // === ARMES AKARLYS (Humains) ===
    
    // Fusil d'assaut
    this.weapons.set('fusil_assaut_akarlys', {
      id: 'fusil_assaut_akarlys',
      name: 'Fusil d\'Assaut AKARLYS',
      faction: Faction.HUMAN,
      type: 'RIFLE',
      modelPath: '/weapon/weapon_AYARLYS/fussil_dassaut_a_lunette.obj',
      texturePath: '/weapon/weapon_AYARLYS/Futuristic_Arsenal_1123110734_texture.png',
      damage: 25,
      range: 100,
      fireRate: 10,
      reloadTime: 2.5,
      magazineSize: 30,
      accuracy: 0.75,
      recoil: 0.4,
      animationType: 'RIFLE_SHOOT'
    });

    // Mitraillette
    this.weapons.set('mitraillette_akarlys', {
      id: 'mitraillette_akarlys',
      name: 'Mitraillette AKARLYS',
      faction: Faction.HUMAN,
      type: 'RIFLE',
      modelPath: '/weapon/weapon_AYARLYS/mitraillete_a_lunette.obj',
      texturePath: '/weapon/weapon_AYARLYS/Futuristic_Arsenal_1123110734_texture.png',
      damage: 20,
      range: 80,
      fireRate: 15,
      reloadTime: 3.0,
      magazineSize: 50,
      accuracy: 0.6,
      recoil: 0.6,
      animationType: 'RIFLE_SHOOT'
    });

    // Sniper
    this.weapons.set('sniper_akarlys', {
      id: 'sniper_akarlys',
      name: 'Sniper AKARLYS',
      faction: Faction.HUMAN,
      type: 'SNIPER',
      modelPath: '/weapon/weapon_AYARLYS/sniper_a_lunete.obj',
      texturePath: '/weapon/weapon_AYARLYS/Futuristic_Arsenal_1123110734_texture.png',
      damage: 100,
      range: 200,
      fireRate: 1,
      reloadTime: 3.5,
      magazineSize: 5,
      accuracy: 0.95,
      recoil: 0.8,
      animationType: 'RIFLE_SHOOT'
    });

    // Fusil à pompe
    this.weapons.set('fusil_pompe_akarlys', {
      id: 'fusil_pompe_akarlys',
      name: 'Fusil à Pompe AKARLYS',
      faction: Faction.HUMAN,
      type: 'SHOTGUN',
      modelPath: '/weapon/weapon_AYARLYS/fusil_a_pompe.obj',
      texturePath: '/weapon/weapon_AYARLYS/Futuristic_Arsenal_1123110734_texture.png',
      damage: 60,
      range: 30,
      fireRate: 2,
      reloadTime: 4.0,
      magazineSize: 8,
      accuracy: 0.5,
      recoil: 0.7,
      animationType: 'RIFLE_SHOOT'
    });

    // Lance-flammes
    this.weapons.set('lance_flamme_akarlys', {
      id: 'lance_flamme_akarlys',
      name: 'Lance-Flammes AKARLYS',
      faction: Faction.HUMAN,
      type: 'RIFLE',
      modelPath: '/weapon/weapon_AYARLYS/lance_flame.obj',
      texturePath: '/weapon/weapon_AYARLYS/Futuristic_Arsenal_1123110734_texture.png',
      damage: 15,
      range: 25,
      fireRate: 20,
      reloadTime: 5.0,
      magazineSize: 100,
      accuracy: 0.4,
      recoil: 0.3,
      animationType: 'RIFLE_SHOOT'
    });

    // === ARMES ZAYAN (Aliens) ===
    
    // Khouya
    this.weapons.set('khouya_zayan', {
      id: 'khouya_zayan',
      name: 'Khouya ZAYAN',
      faction: Faction.ALIEN,
      type: 'ORGANIC',
      modelPath: '/weapon/weapon_ZAYAN/Khouya.obj',
      texturePath: '/weapon/weapon_ZAYAN/Ethereal_Arsenal_1123150038_texture.png',
      damage: 30,
      range: 60,
      fireRate: 8,
      reloadTime: 2.0,
      magazineSize: 20,
      accuracy: 0.7,
      recoil: 0.3,
      animationType: 'ORGANIC_ATTACK'
    });

    // Mashibhoomm
    this.weapons.set('mashibhoomm_zayan', {
      id: 'mashibhoomm_zayan',
      name: 'Mashibhoomm ZAYAN',
      faction: Faction.ALIEN,
      type: 'ORGANIC',
      modelPath: '/weapon/weapon_ZAYAN/Mashibhoomm.obj',
      texturePath: '/weapon/weapon_ZAYAN/Ethereal_Arsenal_1123150038_texture.png',
      damage: 40,
      range: 50,
      fireRate: 6,
      reloadTime: 2.5,
      magazineSize: 15,
      accuracy: 0.65,
      recoil: 0.4,
      animationType: 'ORGANIC_ATTACK'
    });

    // Zanaboum
    this.weapons.set('zanaboum_zayan', {
      id: 'zanaboum_zayan',
      name: 'Zanaboum ZAYAN',
      faction: Faction.ALIEN,
      type: 'ORGANIC',
      modelPath: '/weapon/weapon_ZAYAN/Zanaboum.obj',
      texturePath: '/weapon/weapon_ZAYAN/Ethereal_Arsenal_1123150038_texture.png',
      damage: 50,
      range: 40,
      fireRate: 4,
      reloadTime: 3.0,
      magazineSize: 10,
      accuracy: 0.6,
      recoil: 0.5,
      animationType: 'ORGANIC_ATTACK'
    });

    // Zatongan
    this.weapons.set('zatongan_zayan', {
      id: 'zatongan_zayan',
      name: 'Zatongan ZAYAN',
      faction: Faction.ALIEN,
      type: 'ORGANIC',
      modelPath: '/weapon/weapon_ZAYAN/Zatongan.obj',
      texturePath: '/weapon/weapon_ZAYAN/Ethereal_Arsenal_1123150038_texture.png',
      damage: 35,
      range: 70,
      fireRate: 7,
      reloadTime: 2.2,
      magazineSize: 25,
      accuracy: 0.72,
      recoil: 0.35,
      animationType: 'ORGANIC_ATTACK'
    });

    // === ARMES MEZALAYIS (Mercenaires) ===
    
    // Fusil d'assaut
    this.weapons.set('fusil_assaut_mezalayis', {
      id: 'fusil_assaut_mezalayis',
      name: 'Fusil d\'Assaut MEZALAYIS',
      faction: Faction.MERCENARY,
      type: 'RIFLE',
      modelPath: '/weapon/weapon_MEZALAYIS/fusill_dassaut.obj',
      texturePath: '/weapon/weapon_MEZALAYIS/Steampunk_Armory_Disp_1123191304_texture.png',
      damage: 28,
      range: 90,
      fireRate: 12,
      reloadTime: 2.8,
      magazineSize: 35,
      accuracy: 0.7,
      recoil: 0.45,
      animationType: 'RIFLE_SHOOT'
    });

    // Mitraillette
    this.weapons.set('mitraillette_mezalayis', {
      id: 'mitraillette_mezalayis',
      name: 'Mitraillette MEZALAYIS',
      faction: Faction.MERCENARY,
      type: 'RIFLE',
      modelPath: '/weapon/weapon_MEZALAYIS/mitraillete_lunnette.obj',
      texturePath: '/weapon/weapon_MEZALAYIS/Steampunk_Armory_Disp_1123191304_texture.png',
      damage: 22,
      range: 75,
      fireRate: 18,
      reloadTime: 3.2,
      magazineSize: 60,
      accuracy: 0.58,
      recoil: 0.65,
      animationType: 'RIFLE_SHOOT'
    });

    // Pistolet
    this.weapons.set('pistolet_mezalayis', {
      id: 'pistolet_mezalayis',
      name: 'Pistolet MEZALAYIS',
      faction: Faction.MERCENARY,
      type: 'PISTOL',
      modelPath: '/weapon/weapon_MEZALAYIS/pistollet.obj',
      texturePath: '/weapon/weapon_MEZALAYIS/Steampunk_Armory_Disp_1123191304_texture.png',
      damage: 18,
      range: 50,
      fireRate: 8,
      reloadTime: 1.5,
      magazineSize: 15,
      accuracy: 0.65,
      recoil: 0.3,
      animationType: 'PISTOL_SHOOT'
    });

    // Épée sanglante
    this.weapons.set('epee_sanglante_mezalayis', {
      id: 'epee_sanglante_mezalayis',
      name: 'Épée Sanglante MEZALAYIS',
      faction: Faction.MERCENARY,
      type: 'MELEE',
      modelPath: '/weapon/weapon_MEZALAYIS/epe_sanglante.obj',
      texturePath: '/weapon/weapon_MEZALAYIS/Steampunk_Armory_Disp_1123191304_texture.png',
      damage: 45,
      range: 3,
      fireRate: 2,
      reloadTime: 0,
      magazineSize: Infinity,
      accuracy: 1.0,
      recoil: 0,
      animationType: 'MELEE_SLASH'
    });
  }

  // Obtenir une arme par ID
  public getWeapon(weaponId: string): WeaponDef | null {
    return this.weapons.get(weaponId) || null;
  }

  // Obtenir les armes par faction
  public getWeaponsByFaction(faction: Faction): WeaponDef[] {
    return Array.from(this.weapons.values()).filter(w => w.faction === faction);
  }

  // Obtenir les armes par type
  public getWeaponsByType(type: WeaponDef['type']): WeaponDef[] {
    return Array.from(this.weapons.values()).filter(w => w.type === type);
  }

  // Obtenir toutes les armes
  public getAllWeapons(): WeaponDef[] {
    return Array.from(this.weapons.values());
  }
}

export const weaponService = WeaponService.getInstance();

