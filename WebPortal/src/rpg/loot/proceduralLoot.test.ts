// ══════════════════════════════════════════════════════════════════════════════
// proceduralLoot.test.ts — Tests Vitest pour le générateur procédural
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import {
  pickRarity,
  generateItem,
  RARITY_COLORS,
  type ProceduralRarity,
} from './proceduralLoot';

describe('pickRarity', () => {
  it('retourne "common" quand rng renvoie 0 (seuil le plus bas)', () => {
    // rng() = 0 → 0 < 0.65 → common
    expect(pickRarity(() => 0)).toBe('common');
  });

  it('retourne "mythic" quand rng renvoie 0.999 (seuil le plus haut)', () => {
    // rng() = 0.999 → 0.999 >= 0.99 → mythic
    expect(pickRarity(() => 0.999)).toBe('mythic');
  });

  it('retourne "epic" quand rng renvoie 0.9 (entre rare 0.85 et epic 0.95)', () => {
    // rng() = 0.9 → 0.9 >= 0.85 et 0.9 < 0.95 → epic
    expect(pickRarity(() => 0.9)).toBe('epic');
  });
});

describe('generateItem', () => {
  it('produit un item avec id, name, rarity, color, stats corrects', () => {
    // RNG déterministe : toujours 0 → common + weapon + stat de base
    const level = 10;
    let callCount = 0;
    // Séquence : [rarity=0→common, kind=0→weapon, adj=0→'Sombre', base=0→'Sabre', suffix=0→0]
    const deterministicRng = () => {
      callCount++;
      return 0;
    };

    const item = generateItem(level, deterministicRng);

    // id présent et formaté
    expect(item.id).toMatch(/^gen_common_weapon_/);

    // name contient le niveau
    expect(item.name).toContain(`Lvl ${level}`);

    // rarity est une rareté valide
    const validRarities: ProceduralRarity[] = ['common', 'rare', 'epic', 'legendary', 'mythic'];
    expect(validRarities).toContain(item.rarity);

    // color correspond à RARITY_COLORS[rarity]
    expect(item.color).toBe(RARITY_COLORS[item.rarity]);

    // stats non vides
    expect(Object.keys(item.stats).length).toBeGreaterThan(0);
  });

  it('scaling : un mythic level 50 a des stats supérieures à un common level 50', () => {
    const level = 50;

    // RNG forcé vers mythic (valeur >= 0.99) et premier kind = weapon
    let mythicCall = 0;
    const mythicRng = () => {
      mythicCall++;
      if (mythicCall === 1) return 0.999; // → mythic
      if (mythicCall === 2) return 0;     // → weapon (kind index 0)
      return 0; // adjective, baseName, suffix
    };

    // RNG forcé vers common (valeur < 0.65) et premier kind = weapon
    let commonCall = 0;
    const commonRng = () => {
      commonCall++;
      if (commonCall === 1) return 0;   // → common
      if (commonCall === 2) return 0;   // → weapon
      return 0;
    };

    const mythicItem = generateItem(level, mythicRng);
    const commonItem = generateItem(level, commonRng);

    expect(mythicItem.rarity).toBe('mythic');
    expect(commonItem.rarity).toBe('common');

    // Pour weapon : puissance et critique sont présents sur les deux
    const mythicPuissance = mythicItem.stats.puissance ?? 0;
    const commonPuissance = commonItem.stats.puissance ?? 0;

    expect(mythicPuissance).toBeGreaterThan(commonPuissance);
  });
});
