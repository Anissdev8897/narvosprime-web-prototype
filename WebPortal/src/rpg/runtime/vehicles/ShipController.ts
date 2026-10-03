// ══════════════════════════════════════════════════════════════════════════════
// vehicles/ShipController.ts — Physique du vaisseau pilotable (PURE, sans React)
//
// Modèle de vol arcade-réaliste :
//   • W/S = propulsion avant/arrière (dans la direction du nez)
//   • Souris = yaw + pitch du vaisseau (le nez tourne avec la caméra)
//   • A/D = roll visuel (banking) + léger strafe latéral
//   • Space / Ctrl = poussée verticale directe
//   • Shift = boost ×2.2
//
// Physique altitude-dépendante :
//   • < 300 m : atmosphère → gravité réduite (portance implicite), drag fort
//   • ≥ 300 m : espace → zéro gravité, drag quasi nul (on peut coaster)
//
// Extension future (boucliers / afterburner / dommages) : brancher dans update().
// ══════════════════════════════════════════════════════════════════════════════

import * as THREE from "three";

// ── Configuration ─────────────────────────────────────────────────────────────
const C = {
  // Propulsion
  thrustForce:        32,   // m/s² — accélération vers l'avant
  reverseThrustForce: 12,   // m/s² — marche arrière / frein
  boostMultiplier:    2.2,  // multiplicateur Shift
  liftForce:          28,   // m/s² — poussée verticale directe (Space / Ctrl)

  // Physique atmosphérique
  atmosphericGravityFrac: 0.28, // portance : 1-0.28 = 72 % de la gravité annulée
  atmosphereDrag:     2.4,  // damp/s en atmosphère (décélération rapide)
  atmosphereAlt:      300,  // m — au-delà : espace

  // Physique spatiale
  spaceDrag:          0.18, // damp/s (quasi nul → coasting réaliste)

  // Altitude minimale (le vaisseau ne traverse pas la carte)
  minAltitude:        1.0,

  // Rotation
  pitchRate:    1.6,  // rad/s par px normalisé
  yawRate:      2.0,  // rad/s par px normalisé
  rollInfluence: 0.55, // A/D → banking visuel
  rollReturn:   3.5,  // rad/s de retour au niveau (auto-level)

  // Conditions de sortie du vaisseau (E pour quitter)
  exitMaxSpeed: 5,    // m/s max
  exitMaxAlt:   8,    // m max
} as const;

// ── Euler réutilisé (zéro allocation par frame) ───────────────────────────────
const _euler = new THREE.Euler(0, 0, 0, "YXZ");

// ── Contrôleur ───────────────────────────────────────────────────────────────
export class ShipController {
  /** Position monde (mutée par update()). */
  readonly position: THREE.Vector3;
  /** Orientation monde (mise à jour par update()). */
  readonly quaternion = new THREE.Quaternion();

  // Vecteurs directionnels recalculés chaque frame — accès externe pour la caméra.
  readonly forward = new THREE.Vector3(0, 0, -1);
  readonly right   = new THREE.Vector3(1, 0, 0);
  readonly up      = new THREE.Vector3(0, 1, 0);

  // `protected` → la sous-classe GroundVehicleController réécrit update() avec
  // une physique au sol et a besoin d'accéder à ces champs internes.
  protected vel   = new THREE.Vector3();
  protected yaw   = 0; // cumul rotation Y monde (radians)
  protected pitch = 0; // cumul rotation X local (radians)
  protected roll  = 0; // banking visuel Z local (radians, auto-level)

  // ── Stabilisation (touche H toggle) ─────────────────────────────────────
  // Quand actif : altitude figée à `_stabAltitude`, gravité désactivée,
  // velY forcé à 0. Permet de se stabiliser pour viser, prendre des photos,
  // gérer le HUD, etc. — comportement style "autopilot altitude" des sims.
  private _stabilized = false;
  private _stabAltitude = 0;

  // ── Altitude RELATIVE au sol sous le vaisseau ────────────────────────────
  // Injectée par un composant React (ShipTelemetry) qui fait un raycast vers
  // le bas chaque ~200ms. Permet à `canExit` de vérifier qu'on est proche
  // d'un sol VALIDE (toit, plateforme, terrain) plutôt que l'altitude absolue.
  //
  // Pourquoi pas faire le raycast dans le controller ? Pour garder le
  // ShipController pur (zéro dépendance Three.js scène) — testable en isolation.
  protected _groundBelow: number | null = null;

  // ── Stats véhicule (injectées via applyVehicleDef) ───────────────────────
  // Par défaut : "ship vanille" sans bonus. Si applyVehicleDef est appelé,
  // ces stats sont surchargées et utilisées dans update() + handleCastSpell.
  protected _speedMult = 1.0;
  private _spellBoost = 0;
  private _elementResist = 0;
  /** PV courants. 0 = détruit. Si _maxHp = 0, le véhicule est invincible (ships statiques de la map). */
  private _hp = 0;
  private _maxHp = 0;
  /** True dès que hp atteint 0 — déclencheur pour explosion + auto-exit. */
  private _destroyed = false;

  /** Vitesse instantanée (m/s). */
  get speed(): number { return this.vel.length(); }

  /** Vitesse SIGNÉE le long du nez (+ avant, − arrière) → anim des roues. */
  get forwardSpeed(): number { return this.vel.dot(this.forward); }

  /** Entrée de direction -1..1 (volant) — 0 pour un vaisseau (pas de roues). */
  get steerInput(): number { return 0; }

  /** True pour un véhicule TERRESTRE (roule au sol). False pour un vaisseau. */
  get isGround(): boolean { return false; }

  /** True si le vaisseau est actuellement stabilisé (hover/autopilot). */
  get stabilized(): boolean { return this._stabilized; }

  /**
   * Renseigne la hauteur du sol détectée sous le vaisseau (raycast extérieur).
   * Si `null`, signifie qu'aucun sol valide n'a été trouvé en dessous (le ship
   * est en plein vide spatial ou très loin du sol).
   */
  setGroundBelow(y: number | null): void {
    this._groundBelow = y;
  }

  /** Altitude au-dessus du sol détecté (m), ou Infinity si pas de sol. */
  get heightAboveGround(): number {
    return this._groundBelow === null ? Infinity : this.position.y - this._groundBelow;
  }

  // ── Stats véhicule (lues par update + handleCastSpell + dégâts) ──────────
  get speedMult(): number     { return this._speedMult; }
  get spellBoost(): number    { return this._spellBoost; }
  get elementResist(): number { return this._elementResist; }
  get hp(): number            { return this._hp; }
  get maxHp(): number         { return this._maxHp; }
  get destroyed(): boolean    { return this._destroyed; }
  /** Ratio PV 0..1. Retourne 1 si véhicule sans PV (invincible). */
  get hpRatio(): number       { return this._maxHp === 0 ? 1 : this._hp / this._maxHp; }
  /** True si le véhicule a des PV (= peut être détruit). */
  get hasHp(): boolean        { return this._maxHp > 0; }

  /**
   * Applique une configuration de véhicule (VEHICLE_CATALOG.<id>).
   * À appeler après le constructeur pour activer les stats avancées.
   * Pour les ships statiques de SHIPS_PER_MAP qui n'ont pas de VehicleDef,
   * ne pas appeler → le ship reste invincible avec stats par défaut.
   */
  applyVehicleDef(def: {
    speedMult: number;
    spellBoost: number;
    elementResist: number;
    maxHp: number;
  }): void {
    this._speedMult     = def.speedMult;
    this._spellBoost    = def.spellBoost;
    this._elementResist = def.elementResist;
    this._maxHp         = def.maxHp;
    this._hp            = def.maxHp;
    this._destroyed     = false;
  }

  /**
   * Inflige des dégâts au véhicule (avec résistance élémentaire appliquée).
   * Retourne le montant effectif après résistance. Si HP atteint 0, marque
   * comme détruit → l'extérieur doit traiter explosion + auto-exit.
   *
   * @returns dégâts effectifs (peut être 0 si résistance ≥ 1)
   */
  takeDamage(amount: number): number {
    if (this._destroyed || !this.hasHp) return 0;
    const mitigated = Math.max(0, amount * (1 - this._elementResist));
    this._hp -= mitigated;
    if (this._hp <= 0) {
      this._hp = 0;
      this._destroyed = true;
    }
    return mitigated;
  }

  /** Restaure les PV (clampé à maxHp). Utilisé par le marchand de réparation. */
  repair(amount: number): void {
    if (!this.hasHp) return;
    this._hp = Math.min(this._maxHp, this._hp + amount);
    if (this._hp > 0) this._destroyed = false;
  }

  /** Restaure les PV à 100% (utilisé pour les réparations complètes). */
  fullRepair(): void {
    if (!this.hasHp) return;
    this._hp = this._maxHp;
    this._destroyed = false;
  }

  /**
   * Bascule la stabilisation (H). À l'activation : capture l'altitude
   * courante et annule la velocité verticale. À la désactivation :
   * remet le contrôle normal (gravité reprend).
   */
  toggleStabilize(): void {
    this._stabilized = !this._stabilized;
    if (this._stabilized) {
      this._stabAltitude = this.position.y;
      this.vel.y = 0;
    }
  }

  /** Vaisseau en orbite (au-dessus de l'atmosphère) ? */
  get inSpace(): boolean { return this.position.y > C.atmosphereAlt; }

  /**
   * Peut-on quitter le vaisseau ?
   *
   * Logique PERMISSIVE (v3) : seule la vitesse compte. Pas de check de sol
   * → le joueur peut sortir en plein vol s'il le veut. Si pas de sol proche,
   * il tombera en chute libre (gravité naturelle du CharacterController).
   *
   * Pourquoi cette permissivité : exigence utilisateur "descendre où il veut".
   * On évite juste les sorties à très haute vitesse qui casseraient l'immersion
   * (le perso apparaîtrait sur place alors que le ship continue sa lancée).
   *
   * Pour différencier atterrissage propre vs saut en l'air, le HUD utilise
   * `heightAboveGround` pour afficher "Atterrir" (vert, sûr) ou "Sauter"
   * (orange, chute libre annoncée).
   */
  get canExit(): boolean {
    return this.speed < C.exitMaxSpeed;
  }

  /** True si on est proche d'un sol valide (≤ 5m) — utilisé par le HUD. */
  get isNearGround(): boolean {
    return this.heightAboveGround <= 5;
  }

  constructor(startPosition: THREE.Vector3, startYaw = 0) {
    this.position = startPosition.clone();
    this.yaw = startYaw;
    this._rebuild();
  }

  /**
   * Applique une limite cylindrique (XZ) à la position du vaisseau.
   * Supprime la composante de vitesse radiale sortante pour éviter le rebond.
   * @returns true si la limite a été atteinte.
   */
  clampToBoundary(radius: number): boolean {
    const r = Math.sqrt(this.position.x * this.position.x + this.position.z * this.position.z);
    if (r <= radius) return false;
    const nx = this.position.x / r;
    const nz = this.position.z / r;
    // Repousse vers la surface de la sphère
    this.position.x = nx * radius;
    this.position.z = nz * radius;
    // Projette la vitesse sur le plan tangent (supprime la composante sortante)
    const vOut = this.vel.x * nx + this.vel.z * nz;
    if (vOut > 0) {
      this.vel.x -= vOut * nx * 1.4; // léger rebond amorti vers l'intérieur
      this.vel.z -= vOut * nz * 1.4;
    }
    return true;
  }

  /** Repositionne le vaisseau au dock (appelé à l'embarquement). */
  placeAt(pos: THREE.Vector3, yaw = 0): void {
    this.position.copy(pos);
    this.yaw   = yaw;
    this.pitch = 0;
    this.roll  = 0;
    this.vel.set(0, 0, 0);
    this._rebuild();
  }

  /**
   * Met à jour la physique du vaisseau.
   * @param dt          Delta-time (secondes) — clampé à 50 ms anti-tunneling
   * @param lookDX/DY   Delta souris brut (pixels)
   * @param moveX/Z     Axes WASD (-1…+1)
   * @param boost       Shift = accélération max
   * @param liftUp/Down Space / Ctrl = poussée verticale
   * @param sensitivity Sensibilité souris (rad/px)
   */
  update(
    dt: number,
    lookDX: number, lookDY: number,
    moveX: number, moveZ: number,
    boost: boolean, liftUp: boolean, liftDown: boolean,
    sensitivity = 0.0026,
  ): void {
    dt = Math.min(dt, 0.05);

    // ── 1. Rotation (yaw/pitch depuis la souris, banking depuis A/D) ──────────
    this.yaw   -= lookDX * sensitivity * C.yawRate;
    this.pitch -= lookDY * sensitivity * C.pitchRate;
    this.pitch  = Math.max(-Math.PI * 0.42, Math.min(Math.PI * 0.42, this.pitch));

    // Banking : A/D génère un roulis visuel, le vaisseau se remet à niveau tout seul.
    const targetRoll = -moveX * C.rollInfluence;
    this.roll += (targetRoll - this.roll) * Math.min(1, C.rollReturn * dt);
    this.roll  = Math.max(-Math.PI * 0.35, Math.min(Math.PI * 0.35, this.roll));

    this._rebuild(); // met à jour quaternion + forward/right/up

    // ── 2. Propulsion (dans la direction du nez) ──────────────────────────────
    // Multiplicateur de vitesse selon le véhicule (Longsword = 1.5×, terrestre = 0.85×).
    const inThrust = -moveZ;  // W (moveZ = -1) → +1 = propulsion avant
    const bMult    = (boost ? C.boostMultiplier : 1) * this._speedMult;

    if (inThrust > 0) {
      this.vel.addScaledVector(this.forward, C.thrustForce * bMult * inThrust * dt);
    } else if (inThrust < 0) {
      this.vel.addScaledVector(this.forward, C.reverseThrustForce * inThrust * dt);
    }

    // Poussée verticale directe (Space / Ctrl) — ignorée si stabilisé
    // speedMult appliqué aussi sur la lift (cohérent avec horizontal)
    if (!this._stabilized) {
      if (liftUp)   this.vel.y += C.liftForce * bMult * dt;
      if (liftDown) this.vel.y -= C.liftForce * this._speedMult * dt;
    }

    // ── 3. Gravité + drag ─────────────────────────────────────────────────────
    const inSpace = this.inSpace;
    const drag    = inSpace ? C.spaceDrag : C.atmosphereDrag;

    // Gravité atmosphérique : ignorée si stabilisé (le vaisseau « tient » son altitude)
    if (!inSpace && !liftUp && !this._stabilized) {
      // Portance implicite : réduit la gravité effective à 28 % × 9.8 ≈ 2.7 m/s²
      this.vel.y -= 9.8 * C.atmosphericGravityFrac * dt;
    }

    // Drag multiplicatif (robuste pour les grands dt)
    this.vel.multiplyScalar(Math.max(0, 1 - drag * dt));

    // ── 4. Intégration position ───────────────────────────────────────────────
    this.position.addScaledVector(this.vel, dt);

    // ── 4bis. Maintien d'altitude (stabilisation H) ──────────────────────────
    // Si actif : force velY à 0 et ré-aligne pos.y sur l'altitude capturée.
    // Le lerp léger (4/s) absorbe les petits écarts sans snap brutal.
    if (this._stabilized) {
      this.vel.y = 0;
      const alpha = 1 - Math.exp(-4 * dt);
      this.position.y += (this._stabAltitude - this.position.y) * alpha;
    }

    // Sol minimum : le vaisseau ne traverse pas la carte
    if (this.position.y < C.minAltitude) {
      this.position.y = C.minAltitude;
      if (this.vel.y < 0) this.vel.y *= -0.05; // absorption quasi totale du rebond
      // Si on est stabilisé en-dessous, on resnap l'altitude cible
      if (this._stabilized) this._stabAltitude = C.minAltitude;
    }
  }

  /** Reconstruit quaternion + vecteurs directionnels depuis yaw/pitch/roll. */
  protected _rebuild(): void {
    _euler.set(this.pitch, this.yaw, this.roll);
    this.quaternion.setFromEuler(_euler);
    this.forward.set(0, 0, -1).applyQuaternion(this.quaternion);
    this.right.set(1, 0, 0).applyQuaternion(this.quaternion);
    this.up.set(0, 1, 0).applyQuaternion(this.quaternion);
  }
}
