// weapons/weaponSway.ts — spring-damped lag pour vue FPS arme en main.
//
// Contrôleur pur (zéro dépendance React/R3F) : reçoit les angles caméra
// chaque frame, produit un offset (x,y) que le viewmodel applique en
// espace local pour simuler l'inertie de l'arme.
//
// Inspiré du WeaponSway UE4 : input → spring → lag offset.

function angleDelta(a: number, b: number): number {
  let d = a - b;
  if (d > Math.PI) d -= Math.PI * 2;
  else if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export class WeaponSway {
  private prevYaw = 0;
  private prevPitch = 0;
  private offsetX = 0;
  private offsetY = 0;
  private velX = 0;
  private velY = 0;
  private initialized = false;

  constructor(
    private stiffness = 80,
    private damping = 10,
    private inputScale = 4,
    private maxOffset = 0.06,
  ) {}

  update(cameraYaw: number, cameraPitch: number, dt: number): void {
    if (!this.initialized || dt <= 0) {
      this.prevYaw = cameraYaw;
      this.prevPitch = cameraPitch;
      this.initialized = true;
      return;
    }

    const dYaw = angleDelta(cameraYaw, this.prevYaw);
    const dPitch = angleDelta(cameraPitch, this.prevPitch);
    this.prevYaw = cameraYaw;
    this.prevPitch = cameraPitch;

    const impulse = this.inputScale / Math.max(dt, 0.001);
    this.velX += (-this.stiffness * this.offsetX - this.damping * this.velX + dYaw * impulse) * dt;
    this.velY += (-this.stiffness * this.offsetY - this.damping * this.velY + dPitch * impulse) * dt;

    this.offsetX = clamp(this.offsetX + this.velX * dt, -this.maxOffset, this.maxOffset);
    this.offsetY = clamp(this.offsetY + this.velY * dt, -this.maxOffset, this.maxOffset);
  }

  getOffset(): { x: number; y: number } {
    return { x: this.offsetX, y: this.offsetY };
  }

  reset(): void {
    this.offsetX = this.offsetY = this.velX = this.velY = 0;
    this.initialized = false;
  }
}
