// weapons/weaponTypes.ts — types partagés du système d'armes (aucun runtime)
export type RigFamily  = "mixamo" | "quaternius" | "custom";
export type SocketName = "RightHand" | "LeftHand" | "Spine" | "Head";
export type Visibility = "always" | "combat";
export type GripKind   = "one_hand" | "two_hand";

export interface Offset {
  position?: [number, number, number];
  rotation?: [number, number, number]; // Euler XYZ radians
  scale?: number;
}

export interface WeaponProfile {
  id: string;
  type: string;                 // staff|sword|rifle|pistol|axe|shield|spear… (libre en SP-1)
  path: string;                 // chemin GLB servi par Vite (public/)
  grip: GripKind;
  socket: SocketName;           // nom LOGIQUE (mappé à l'os via RIG_PROFILES)
  supportSocket?: SocketName;   // métadonnée SP-1 (IK 2H = SP-4)
  visibility: Visibility;
  animationProfile?: string;    // indice SP-4 (ignoré en SP-1)
  offset: Offset;               // BASE, en mètres
  offsets?: Partial<Record<RigFamily, Offset>>; // overrides par famille (souvent juste rotation)
}
