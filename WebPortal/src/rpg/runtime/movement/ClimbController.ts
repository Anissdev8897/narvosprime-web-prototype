// runtime/movement/ClimbController.ts — Escalade de mur, machine à états PURE.
//
// Déclenchée par un DOUBLE APPUI sur Espace face à un mur. Le personnage se colle
// à la paroi, monte tant que le joueur pousse vers l'avant, et se hisse au sommet
// quand le mur s'arrête.
//
// LE RAYCASTER EST INJECTÉ, pas importé.
// `collisionWorld` est un singleton Three.js ; en dépendre directement rendrait
// cette machine à états intestable sans DOM ni scène. On passe donc une interface
// minimale — exactement le procédé déjà utilisé pour tester la glissade.

/** Ce que l'escalade a besoin de savoir du monde physique. */
export interface ClimbProbe {
  /**
   * Distance jusqu'au premier obstacle, ou `null` si rien dans `maxDist`.
   * @param ox,oy,oz origine du rayon (monde)
   * @param dx,dy,dz direction NORMALISÉE
   */
  castRay(
    ox: number, oy: number, oz: number,
    dx: number, dy: number, dz: number,
    maxDist: number,
  ): number | null;
}

export type ClimbState = "none" | "attaching" | "climbing" | "topping";

export const CLIMB = {
  /** Distance max entre le joueur et le mur pour pouvoir s'y accrocher. */
  reach: 1.0,
  /** Hauteur (au-dessus des pieds) où l'on sonde la présence du mur. */
  probeHeight: 1.2,
  /**
   * Hauteur à laquelle on vérifie que le mur s'ARRÊTE, pour décider de se hisser.
   * Doit être au-dessus de la tête, sinon on se hisserait contre un mur plein.
   */
  topProbeHeight: 2.4,
  /** Vitesse d'ascension, m/s. */
  climbSpeed: 2.0,
  /** Vitesse de descente, m/s — plus rapide, c'est une chute contrôlée. */
  descendSpeed: 3.0,
  /** Durée du collage initial (le clip de raccord), en secondes. */
  attachDuration: 0.45,
  /** Durée du hissage au sommet, en secondes. */
  topDuration: 0.8,
  /**
   * Distance à laquelle le personnage se tient de la paroi une fois agrippé.
   * Choisie pour que les mains touchent le mur sans que le torse le traverse.
   */
  gripDistance: 0.55,
  /** Correction de distance maximale par frame — au-delà, ça se voit comme un saut. */
  maxSnapPerFrame: 0.25,
  /** Hauteur maximale escaladable avant abandon — évite de grimper à l'infini. */
  maxHeight: 12,
} as const;

/** Entrée de la machine à états, une frame. */
export interface ClimbInput {
  /** Le joueur vient-il de faire un double appui sur Espace ? */
  doubleJump: boolean;
  /** Intention verticale : +1 = monter (W), -1 = descendre (S). */
  intentUp: number;
  /** Le joueur veut-il lâcher la paroi (Ctrl, ou saut simple) ? */
  release: boolean;
  /** Position du joueur (pieds). */
  x: number; y: number; z: number;
  /** Direction du regard à plat, normalisée. */
  fwdX: number; fwdZ: number;
  grounded: boolean;
}

/** Sortie : ce que le contrôleur de personnage doit appliquer. */
export interface ClimbOutput {
  state: ClimbState;
  /** Déplacement vertical à appliquer cette frame, en mètres. */
  deltaY: number;
  /** Le contrôleur d'escalade prend-il la main sur la gravité et le mouvement ? */
  overridesMovement: boolean;
  /**
   * Correction horizontale à appliquer le long du regard, en mètres.
   *
   * Positive = avancer vers le mur, négative = s'en écarter. Sans elle le
   * personnage conserve la distance qu'il avait au moment de l'accroche : trop
   * près il s'enfonce dans la paroi, trop loin ses mains flottent dans le vide.
   * On la recalcule à chaque frame parce que la surface n'est pas plane — un mur
   * réel a des reliefs, et la distance de prise dérive en montant.
   */
  pushForward: number;
}

export class ClimbController {
  private state: ClimbState = "none";
  private timer = 0;
  private climbedHeight = 0;
  private wallNx = 0; // normale du mur (opposée au regard à l'accroche)
  private wallNz = 0;

  constructor(private probe: ClimbProbe) {}

  get current(): ClimbState { return this.state; }
  /** Normale du mur agrippé — sert à orienter le personnage face à la paroi. */
  get wallNormal(): { x: number; z: number } { return { x: this.wallNx, z: this.wallNz }; }

  /** Distance mesurée jusqu'au mur à hauteur de prise, ou null. */
  private wallDistance(input: ClimbInput): number | null {
    return this.probe.castRay(
      input.x, input.y + CLIMB.probeHeight, input.z,
      input.fwdX, 0, input.fwdZ,
      CLIMB.reach,
    );
  }

  /**
   * Correction pour revenir à `gripDistance` du mur, bornée par frame.
   * Le bornage évite qu'un relief de la paroi téléporte le personnage.
   */
  private snapToWall(input: ClimbInput): number {
    const d = this.wallDistance(input);
    if (d === null) return 0;
    const delta = d - CLIMB.gripDistance;
    return Math.max(-CLIMB.maxSnapPerFrame, Math.min(CLIMB.maxSnapPerFrame, delta));
  }

  /** Y a-t-il un mur agrippable devant le joueur ? */
  canAttach(input: ClimbInput): boolean {
    const d = this.probe.castRay(
      input.x, input.y + CLIMB.probeHeight, input.z,
      input.fwdX, 0, input.fwdZ,
      CLIMB.reach,
    );
    return d !== null && d <= CLIMB.reach;
  }

  update(dt: number, input: ClimbInput): ClimbOutput {
    switch (this.state) {
      case "none":
        // Un double appui face à un mur accroche. On exige d'être au sol ou en
        // l'air — pas de condition supplémentaire : sauter puis re-sauter contre
        // une paroi est précisément le geste attendu.
        if (input.doubleJump && this.canAttach(input)) {
          this.state = "attaching";
          this.timer = CLIMB.attachDuration;
          this.climbedHeight = 0;
          // La normale pointe vers le joueur, donc à l'opposé du regard.
          this.wallNx = -input.fwdX;
          this.wallNz = -input.fwdZ;
          return { state: this.state, deltaY: 0, overridesMovement: true, pushForward: this.snapToWall(input) };
        }
        return { state: "none", deltaY: 0, overridesMovement: false, pushForward: 0 };

      case "attaching":
        this.timer -= dt;
        if (this.timer <= 0) this.state = "climbing";
        return { state: this.state, deltaY: 0, overridesMovement: true, pushForward: this.snapToWall(input) };

      case "climbing": {
        if (input.release) { this.reset(); return { state: "none", deltaY: 0, overridesMovement: false, pushForward: 0 }; }

        // ORDRE IMPORTANT — la prise d'abord, le rebord ensuite.
        //
        // Un rebord se définit par « mur à hauteur de prise ET plus rien
        // au-dessus ». Tester l'absence au-dessus en premier confondait le
        // rebord avec la disparition TOTALE du mur : un joueur qui glisse sur le
        // côté se faisait hisser dans le vide au lieu de tomber.
        const stillGripping = this.canAttach(input);
        if (!stillGripping) {
          this.reset();
          return { state: "none", deltaY: 0, overridesMovement: false, pushForward: 0 };
        }

        const above = this.probe.castRay(
          input.x, input.y + CLIMB.topProbeHeight, input.z,
          input.fwdX, 0, input.fwdZ,
          CLIMB.reach,
        );
        if (above === null && input.intentUp > 0) {
          this.state = "topping";
          this.timer = CLIMB.topDuration;
          return { state: this.state, deltaY: 0, overridesMovement: true, pushForward: 0 };
        }

        const speed = input.intentUp >= 0 ? CLIMB.climbSpeed : CLIMB.descendSpeed;
        let deltaY = input.intentUp * speed * dt;

        // Redescendu jusqu'au sol : on relâche naturellement.
        if (input.intentUp < 0 && input.grounded) {
          this.reset();
          return { state: "none", deltaY: 0, overridesMovement: false, pushForward: 0 };
        }

        this.climbedHeight += Math.max(0, deltaY);
        if (this.climbedHeight >= CLIMB.maxHeight) {
          deltaY = 0; // plafond atteint : on reste agrippé sans monter davantage
        }
        return { state: "climbing", deltaY, overridesMovement: true, pushForward: this.snapToWall(input) };
      }

      case "topping":
        this.timer -= dt;
        if (this.timer <= 0) {
          this.reset();
          return { state: "none", deltaY: 0, overridesMovement: false, pushForward: 0 };
        }
        // Hissage : on monte sur la durée du clip, de quoi passer le rebord.
        // Pendant le hissage on AVANCE sur le rebord : rester à gripDistance
        // laisserait le personnage suspendu dans le vide au sommet.
        return {
          state: "topping",
          deltaY: (1.1 / CLIMB.topDuration) * dt,
          overridesMovement: true,
          pushForward: (0.7 / CLIMB.topDuration) * dt,
        };
    }
  }

  reset(): void {
    this.state = "none";
    this.timer = 0;
    this.climbedHeight = 0;
  }
}
