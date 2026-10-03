// ══════════════════════════════════════════════════════════════════════════════
// input/InputActionDefs.ts — Définitions des actions d'input typées
//
// Définit toutes les actions disponibles dans le système (Move, Look, Jump,
// Sprint, Crouch, Attack, Ability1-4) avec leurs types de valeur, touches
// par défaut, modificateurs et triggers.
// ══════════════════════════════════════════════════════════════════════════════

import { EInputValueType, ETriggerType, EModifierType, type InputActionDef } from './types';

/**
 * Catalogue de TOUTES les actions d'input du jeu.
 * C'est la source de vérité pour les définitions d'action.
 */
export const INPUT_ACTION_DEFS: InputActionDef[] = [
  // ── Déplacement ─────────────────────────────────────────────────────────
  {
    id: 'move',
    displayName: 'Déplacement',
    group: 'Déplacement',
    valueType: EInputValueType.Axis2D,
    defaultMappings: ['KeyW', 'KeyS', 'KeyA', 'KeyD'],
    defaultModifiers: [],
    description: 'Déplacement avant/arrière et latéral',
  },
  {
    id: 'look',
    displayName: 'Regarder',
    group: 'Déplacement',
    valueType: EInputValueType.Axis2D,
    defaultMappings: [],
    defaultModifiers: [
      { type: EModifierType.Scalar, factor: 1 },
    ],
    description: 'Rotation de la caméra (souris)',
  },
  {
    id: 'jump',
    displayName: 'Saut',
    group: 'Déplacement',
    valueType: EInputValueType.Digital,
    defaultMappings: ['Space'],
    defaultTrigger: { type: ETriggerType.Tap, tapWindowMs: 300 },
    description: 'Sauter (double appui = escalade)',
  },
  {
    id: 'sprint',
    displayName: 'Sprint',
    group: 'Déplacement',
    valueType: EInputValueType.Digital,
    defaultMappings: ['ShiftLeft', 'ShiftRight'],
    defaultTrigger: { type: ETriggerType.Pressed },
    description: 'Courir plus vite (maintenir)',
  },
  {
    id: 'crouch',
    displayName: 'S\'accroupir',
    group: 'Déplacement',
    valueType: EInputValueType.Digital,
    defaultMappings: ['ControlLeft', 'ControlRight'],
    defaultTrigger: { type: ETriggerType.Pressed },
    description: 'S\'accroupir (toggle)',
  },
  {
    id: 'flyDown',
    displayName: 'Vol bas',
    group: 'Déplacement',
    valueType: EInputValueType.Digital,
    defaultMappings: ['ControlRight'],
    defaultTrigger: { type: ETriggerType.Pressed },
    description: 'Descendre en noclip',
  },

  // ── Combat ──────────────────────────────────────────────────────────────
  {
    id: 'attack',
    displayName: 'Attaque',
    group: 'Combat',
    valueType: EInputValueType.Digital,
    defaultMappings: ['Mouse0'],
    defaultTrigger: { type: ETriggerType.Pressed },
    description: 'Attaque principale (clic gauche)',
  },
  {
    id: 'drawWeapon',
    displayName: 'Dégainer / Ranger l\'arme',
    group: 'Combat',
    valueType: EInputValueType.Digital,
    defaultMappings: ['KeyF'],
    defaultTrigger: { type: ETriggerType.Pressed },
    description: 'Équiper ou ranger l\'arme',
  },
  {
    id: 'kick',
    displayName: 'Coup de pied',
    group: 'Combat',
    valueType: EInputValueType.Digital,
    defaultMappings: ['KeyH', 'Numpad1'],
    defaultTrigger: {
      type: ETriggerType.Hold,
      holdTimeMs: 0, // immédiat avec maintien possible pour chargé
    },
    description: 'Coup de pied (maintien = chargé)',
  },
  {
    id: 'parry',
    displayName: 'Parade',
    group: 'Combat',
    valueType: EInputValueType.Digital,
    defaultMappings: ['KeyP', 'Numpad2'],
    defaultTrigger: { type: ETriggerType.Pressed },
    description: 'Parade (fenêtre d\'annulation)',
  },
  {
    id: 'dodge',
    displayName: 'Esquive',
    group: 'Combat',
    valueType: EInputValueType.Digital,
    defaultMappings: ['KeyG'],
    defaultTrigger: { type: ETriggerType.Pressed },
    description: 'Esquive avec i-frames',
  },
  {
    id: 'reload',
    displayName: 'Recharger',
    group: 'Combat',
    valueType: EInputValueType.Digital,
    defaultMappings: ['KeyR'],
    defaultTrigger: { type: ETriggerType.Pressed },
    description: 'Recharger l\'arme',
  },

  // ── Compétences ─────────────────────────────────────────────────────────
  {
    id: 'ability1',
    displayName: 'Compétence 1',
    group: 'Compétences',
    valueType: EInputValueType.Digital,
    defaultMappings: ['Digit1'],
    defaultTrigger: { type: ETriggerType.Pressed },
  },
  {
    id: 'ability2',
    displayName: 'Compétence 2',
    group: 'Compétences',
    valueType: EInputValueType.Digital,
    defaultMappings: ['Digit2'],
    defaultTrigger: { type: ETriggerType.Pressed },
  },
  {
    id: 'ability3',
    displayName: 'Compétence 3',
    group: 'Compétences',
    valueType: EInputValueType.Digital,
    defaultMappings: ['Digit3'],
    defaultTrigger: { type: ETriggerType.Pressed },
  },
  {
    id: 'ability4',
    displayName: 'Compétence 4',
    group: 'Compétences',
    valueType: EInputValueType.Digital,
    defaultMappings: ['Digit4'],
    defaultTrigger: { type: ETriggerType.Pressed },
  },
  {
    id: 'ability5',
    displayName: 'Compétence 5',
    group: 'Compétences',
    valueType: EInputValueType.Digital,
    defaultMappings: ['Digit5'],
    defaultTrigger: { type: ETriggerType.Pressed },
  },
  {
    id: 'ability6',
    displayName: 'Compétence 6',
    group: 'Compétences',
    valueType: EInputValueType.Digital,
    defaultMappings: ['Digit6'],
    defaultTrigger: { type: ETriggerType.Pressed },
  },

  // ── Caméra ──────────────────────────────────────────────────────────────
  {
    id: 'viewFps',
    displayName: 'Vue FPS',
    group: 'Caméra',
    valueType: EInputValueType.Digital,
    defaultMappings: ['KeyV'], // KeyV ICI SEULEMENT : F1/F3 sont captées par le navigateur. Le Lua garde F3 (client NATIF, pas de capture) — divergence VOULUE, vérifiée le 2026-09-08. Voir Shared/Logic/Commandes.lua.
    defaultTrigger: { type: ETriggerType.Pressed },
    description: 'Passer en vue première personne',
  },
  {
    id: 'viewTps',
    displayName: 'Vue TPS',
    group: 'Caméra',
    valueType: EInputValueType.Digital,
    defaultMappings: ['KeyV'],
    defaultTrigger: { type: ETriggerType.Pressed },
    description: 'Passer en vue troisième personne',
  },
  {
    id: 'zoomIn',
    displayName: 'Zoom avant',
    group: 'Caméra',
    valueType: EInputValueType.Digital,
    defaultMappings: [],
    defaultTrigger: { type: ETriggerType.Pressed },
    description: 'Zoom avant (molette)',
  },
  {
    id: 'zoomOut',
    displayName: 'Zoom arrière',
    group: 'Caméra',
    valueType: EInputValueType.Digital,
    defaultMappings: [],
    defaultTrigger: { type: ETriggerType.Pressed },
    description: 'Zoom arrière (molette)',
  },

  // ── Interface ───────────────────────────────────────────────────────────
  {
    id: 'interact',
    displayName: 'Interagir',
    group: 'Interface',
    valueType: EInputValueType.Digital,
    defaultMappings: ['KeyE'],
    defaultTrigger: { type: ETriggerType.Pressed },
    description: 'Interagir avec les objets/PNJ',
  },
  {
    id: 'inventory',
    displayName: 'Inventaire',
    group: 'Interface',
    valueType: EInputValueType.Digital,
    defaultMappings: ['KeyI'],
    defaultTrigger: { type: ETriggerType.Pressed },
    description: 'Ouvrir/fermer l\'inventaire',
  },
  {
    id: 'characteristics',
    displayName: 'Caractéristiques',
    group: 'Interface',
    valueType: EInputValueType.Digital,
    defaultMappings: ['KeyK'],
    defaultTrigger: { type: ETriggerType.Pressed },
    description: 'Ouvrir/fermer les caractéristiques',
  },
  {
    id: 'minimap',
    displayName: 'Minimap',
    group: 'Interface',
    valueType: EInputValueType.Digital,
    defaultMappings: ['KeyM'],
    defaultTrigger: { type: ETriggerType.Pressed },
    description: 'Afficher/masquer la minimap',
  },
  {
    id: 'galaxy',
    displayName: 'État galactique',
    group: 'Interface',
    valueType: EInputValueType.Digital,
    defaultMappings: ['KeyN'],
    defaultTrigger: { type: ETriggerType.Pressed },
    description: 'Carte galactique',
  },
  {
    id: 'worldmap',
    displayName: 'Carte du monde',
    group: 'Interface',
    valueType: EInputValueType.Digital,
    defaultMappings: ['KeyU'],
    defaultTrigger: { type: ETriggerType.Pressed },
    description: 'Carte du monde plein écran',
  },
  {
    id: 'pause',
    displayName: 'Menu / Pause',
    group: 'Interface',
    valueType: EInputValueType.Digital,
    defaultMappings: ['Escape'],
    defaultTrigger: { type: ETriggerType.Pressed },
    description: 'Ouvrir/fermer le menu pause',
  },

  // ── Debug ───────────────────────────────────────────────────────────────
  {
    id: 'noclip',
    displayName: 'Noclip',
    group: 'Debug',
    valueType: EInputValueType.Digital,
    defaultMappings: ['F4'],
    defaultTrigger: { type: ETriggerType.Pressed },
    description: 'Activer/désactiver le vol libre',
  },
  {
    id: 'stabilize',
    displayName: 'Stabilisation',
    group: 'Debug',
    valueType: EInputValueType.Digital,
    defaultMappings: ['KeyH'],
    defaultTrigger: { type: ETriggerType.Pressed },
    description: 'Activer/désactiver la stabilisation du vaisseau',
  },
];

/** Index des définitions par ID. */
export const INPUT_ACTION_DEFS_BY_ID = new Map<string, InputActionDef>(
  INPUT_ACTION_DEFS.map((d) => [d.id, d]),
);

/** Récupère la définition d'une action par son ID. */
export function getActionDef(id: string): InputActionDef | undefined {
  return INPUT_ACTION_DEFS_BY_ID.get(id);
}

/** Liste des groupes disponibles. */
export function getActionGroups(): string[] {
  return [...new Set(INPUT_ACTION_DEFS.map((d) => d.group))];
}

/** Actions filtrées par groupe. */
export function getActionsByGroup(group: string): InputActionDef[] {
  return INPUT_ACTION_DEFS.filter((d) => d.group === group);
}

/** Construit les mappings par défaut pour toutes les actions. */
export function getDefaultMappings(): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const def of INPUT_ACTION_DEFS) {
    result[def.id] = [...def.defaultMappings];
  }
  return result;
}
