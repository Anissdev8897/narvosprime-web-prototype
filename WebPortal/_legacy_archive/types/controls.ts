/**
 * Types pour les contrôles et les touches
 */

export enum ControlAction {
  // Mouvement
  MOVE_FORWARD = 'MOVE_FORWARD',
  MOVE_BACKWARD = 'MOVE_BACKWARD',
  MOVE_LEFT = 'MOVE_LEFT',
  MOVE_RIGHT = 'MOVE_RIGHT',
  JUMP = 'JUMP',
  SPRINT = 'SPRINT',
  CROUCH = 'CROUCH',
  
  // Interactions
  INTERACT = 'INTERACT', // E
  OPEN_INVENTORY = 'OPEN_INVENTORY',
  OPEN_MENU = 'OPEN_MENU',
  
  // Armes
  EQUIP_WEAPON = 'EQUIP_WEAPON',
  FIRE = 'FIRE',
  AIM = 'AIM',
  RELOAD = 'RELOAD',
  SWITCH_WEAPON = 'SWITCH_WEAPON',
  
  // Caméra
  TOGGLE_CAMERA = 'TOGGLE_CAMERA',
  
  // Autres
  USE_ITEM = 'USE_ITEM',
  DROP_ITEM = 'DROP_ITEM'
}

export interface KeyBinding {
  action: ControlAction;
  key: string;
  keyCode?: number;
  description: string;
  category: 'MOVEMENT' | 'INTERACTION' | 'COMBAT' | 'UI' | 'OTHER';
}

export interface ControlSettings {
  bindings: Map<ControlAction, KeyBinding>;
  mouseSensitivity: number;
  invertY: boolean;
}

// Bindings par défaut
export const DEFAULT_KEY_BINDINGS: KeyBinding[] = [
  // Mouvement
  { action: ControlAction.MOVE_FORWARD, key: 'w', keyCode: 87, description: 'Avancer', category: 'MOVEMENT' },
  { action: ControlAction.MOVE_BACKWARD, key: 's', keyCode: 83, description: 'Reculer', category: 'MOVEMENT' },
  { action: ControlAction.MOVE_LEFT, key: 'a', keyCode: 65, description: 'Gauche', category: 'MOVEMENT' },
  { action: ControlAction.MOVE_RIGHT, key: 'd', keyCode: 68, description: 'Droite', category: 'MOVEMENT' },
  { action: ControlAction.JUMP, key: ' ', keyCode: 32, description: 'Sauter', category: 'MOVEMENT' },
  { action: ControlAction.SPRINT, key: 'Shift', keyCode: 16, description: 'Sprint', category: 'MOVEMENT' },
  { action: ControlAction.CROUCH, key: 'Control', keyCode: 17, description: 'S\'accroupir', category: 'MOVEMENT' },
  
  // Interactions
  { action: ControlAction.INTERACT, key: 'e', keyCode: 69, description: 'Interagir', category: 'INTERACTION' },
  { action: ControlAction.OPEN_INVENTORY, key: 'i', keyCode: 73, description: 'Inventaire', category: 'UI' },
  { action: ControlAction.OPEN_MENU, key: 'Escape', keyCode: 27, description: 'Menu', category: 'UI' },
  
  // Armes
  { action: ControlAction.EQUIP_WEAPON, key: '1', keyCode: 49, description: 'Équiper arme 1', category: 'COMBAT' },
  { action: ControlAction.FIRE, key: 'Mouse0', keyCode: 0, description: 'Tirer', category: 'COMBAT' },
  { action: ControlAction.AIM, key: 'Mouse1', keyCode: 0, description: 'Viser', category: 'COMBAT' },
  { action: ControlAction.RELOAD, key: 'r', keyCode: 82, description: 'Recharger', category: 'COMBAT' },
  { action: ControlAction.SWITCH_WEAPON, key: 'q', keyCode: 81, description: 'Changer d\'arme', category: 'COMBAT' },
  
  // Caméra
  { action: ControlAction.TOGGLE_CAMERA, key: 'c', keyCode: 67, description: 'Changer caméra', category: 'OTHER' },
  
  // Autres
  { action: ControlAction.USE_ITEM, key: 'f', keyCode: 70, description: 'Utiliser objet', category: 'INTERACTION' },
  { action: ControlAction.DROP_ITEM, key: 'x', keyCode: 88, description: 'Jeter objet', category: 'INTERACTION' }
];

