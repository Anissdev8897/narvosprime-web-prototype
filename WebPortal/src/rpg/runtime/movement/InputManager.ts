// ══════════════════════════════════════════════════════════════════════════════
// movement/InputManager.ts — Capture d'input CENTRALISÉE (clavier + souris)
//
// SEULE source d'input de locomotion (résout le problème d'input dispersé).
// N'interprète rien : expose des axes/états bruts + des événements à "consommer"
// une fois par frame (look, saut, zoom, changement de vue). Pointer-lock géré.
//
// Note : les touches d'UI (1-6 sorts, I, B, E) restent gérées par le HUD —
// domaine séparé, aucun conflit (l'InputManager ne lit que la locomotion).
// ══════════════════════════════════════════════════════════════════════════════

import { KEYBINDINGS } from "./playerConfig";
import type { CameraView } from "./playerState";
import { cameraViewStore } from "../../camera/cameraViewStore";

export class InputManager {
  private keys = new Set<string>();
  private lookDX = 0;
  private lookDY = 0;
  private wheel = 0;
  private jumpEdge = false;            // front montant du saut
  private _crouchEdge = false;         // front montant du crouch (toggle)
  private stabilizeEdge = false;       // front montant de H (toggle stabilisation vaisseau)
  private viewRequest: CameraView | null = null;
  private dom: HTMLElement | null = null;
  private enabled = true;

  // ── Cycle de vie ──────────────────────────────────────────────────────────
  attach(dom: HTMLElement) {
    this.dom = dom;
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("mousemove", this.onMouseMove);
    window.addEventListener("wheel", this.onWheel, { passive: true });
    window.addEventListener("blur", this.onBlur);
    dom.addEventListener("click", this.onClick);
  }

  detach() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("mousemove", this.onMouseMove);
    window.removeEventListener("wheel", this.onWheel);
    window.removeEventListener("blur", this.onBlur);
    this.dom?.removeEventListener("click", this.onClick);
    this.keys.clear();
    this.dom = null;
  }

  setEnabled(v: boolean) {
    this.enabled = v;
    if (!v) this.keys.clear();
  }

  // ── Handlers ──────────────────────────────────────────────────────────────
  private onKeyDown = (e: KeyboardEvent) => {
    if (!this.enabled) return;
    // évite le défilement page sur Espace/flèches quand on joue
    // `!e.repeat` OBLIGATOIRE : sans lui, maintenir Espace réarme le front à
    // chaque événement d'auto-répétition du système (~30 ms d'intervalle). Le
    // saut restait jouable, mais toute détection de double appui — l'escalade —
    // se déclencherait en continu dès qu'on garde la touche enfoncée.
    // Le handler KeyH deux lignes plus bas avait déjà cette garde.
    if (KEYBINDINGS.jump.includes(e.code) && !e.repeat) { this.jumpEdge = true; e.preventDefault(); }
    // H = toggle stabilisation vaisseau (hover / autopilot d'altitude).
    // Touche hardcodée pour Phase 1 — pourra rejoindre KEYBINDINGS plus tard.
    if (e.code === "KeyH" && !e.repeat) this.stabilizeEdge = true;
    // Ctrl = toggle crouch (front montant uniquement)
    if ((KEYBINDINGS.crouch ?? []).includes(e.code) && !e.repeat) { this._crouchEdge = true; }
    this.keys.add(e.code);
    // BASCULE, pas deux touches distinctes. `viewFps` et `viewTps` partagent
    // désormais `KeyV` : deux `if` successifs poseraient « fps » puis « tps »
    // dans la même frame, et la vue serait bloquée en TPS pour toujours.
    //
    // `!e.repeat` : sans cette garde, garder V enfoncé ferait clignoter la vue
    // à la cadence de répétition du clavier.
    if (!e.repeat) {
      const fps = KEYBINDINGS.viewFps.includes(e.code);
      const tps = KEYBINDINGS.viewTps.includes(e.code);
      if (fps && tps) {
        // Même touche pour les deux → on inverse la vue COURANTE, lue dans le
        // store (miroir de `camState.view`, cf. camera/cameraViewStore).
        this.viewRequest = cameraViewStore.get() === "fps" ? "tps" : "fps";
      } else if (fps) this.viewRequest = "fps";
      else if (tps) this.viewRequest = "tps";
    }
  };
  private onKeyUp = (e: KeyboardEvent) => { this.keys.delete(e.code); };
  private onMouseMove = (e: MouseEvent) => {
    if (!this.enabled || !this.dom) return;
    if (document.pointerLockElement !== this.dom) return;
    this.lookDX += e.movementX;
    this.lookDY += e.movementY;
  };
  private onWheel = (e: WheelEvent) => { if (this.enabled) this.wheel += Math.sign(e.deltaY); };
  private onBlur = () => { this.keys.clear(); };  // perte de focus → relâche tout
  private onClick = () => {
    if (!this.enabled) return; // menu ouvert → ne pas re-verrouiller le curseur
    if (this.dom && document.pointerLockElement !== this.dom) {
      // requestPointerLock retourne une Promise sur les navigateurs récents : si un
      // exitPointerLock (ouverture d'UI sur le même clic) arrive avant la fin, ça rejette
      // avec SecurityError "user has exited the lock before this request was completed".
      // On avale ce rejet de course → pas d'erreur non gérée en console.
      try {
        const r = this.dom.requestPointerLock() as unknown as Promise<void> | undefined;
        if (r && typeof r.catch === "function") r.catch(() => { /* course pointer-lock → ignoré */ });
      } catch { /* course pointer-lock → ignoré */ }
    }
  };

  private has(list: string[]): boolean {
    for (const c of list) if (this.keys.has(c)) return true;
    return false;
  }

  // ── API de lecture (appelée 1×/frame par le rig) ─────────────────────────
  /** Axe latéral : +1 droite, -1 gauche. */
  get moveX(): number { return (this.has(KEYBINDINGS.right) ? 1 : 0) - (this.has(KEYBINDINGS.left) ? 1 : 0); }
  /** Axe avant/arrière : +1 arrière, -1 avant. */
  get moveZ(): number { return (this.has(KEYBINDINGS.back) ? 1 : 0) - (this.has(KEYBINDINGS.forward) ? 1 : 0); }
  get sprint(): boolean { return this.has(KEYBINDINGS.sprint); }
  /** Saut maintenu (≠ consumeJump) — utilisé en noclip pour monter en continu. */
  get jumpHeld(): boolean { return this.has(KEYBINDINGS.jump); }
  /** Descente noclip (Ctrl par défaut). */
  get flyDown(): boolean  { return this.has(KEYBINDINGS.flyDown); }
  /** Accroupi maintenu (Ctrl par défaut) — au sol uniquement. */
  get crouchHeld(): boolean { return this.has(KEYBINDINGS.crouch ?? []); }
  /** Front montant crouch (lecture seule, sans consommer). */
  get crouchEdge(): boolean { return this._crouchEdge; }

  /** Déplacement souris accumulé depuis la dernière frame (puis remis à 0). */
  consumeLook(): { dx: number; dy: number } {
    const r = { dx: this.lookDX, dy: this.lookDY };
    this.lookDX = 0; this.lookDY = 0;
    return r;
  }
  /** True si saut pressé depuis la dernière frame (front montant). */
  consumeJump(): boolean { const j = this.jumpEdge; this.jumpEdge = false; return j; }
  /** True si crouch pressé depuis la dernière frame (front montant). */
  consumeCrouch(): boolean { const c = this._crouchEdge; this._crouchEdge = false; return c; }
  /**
   * Restitue un front de saut consommé par un autre système.
   *
   * PlayerRig doit lire le saut AVANT le mouvement pour évaluer le double appui
   * (escalade). Quand aucun mur n'est accroché, le saut doit malgré tout parvenir
   * au CharacterController — sinon un double appui dans le vide mangerait le
   * saut du joueur.
   */
  injectJump(): void { this.jumpEdge = true; }
  /** Injecte un front montant de crouch (pour les tests automatisés). */
  injectCrouch(): void { this._crouchEdge = true; }
  /** True si H pressé depuis la dernière frame (toggle stabilisation vaisseau). */
  consumeStabilizeToggle(): boolean { const s = this.stabilizeEdge; this.stabilizeEdge = false; return s; }
  /** Cran molette accumulé (puis remis à 0). */
  consumeWheel(): number { const w = this.wheel; this.wheel = 0; return w; }
  /** Changement de vue demandé (F1/F3) ou null. */
  consumeViewRequest(): CameraView | null { const v = this.viewRequest; this.viewRequest = null; return v; }
}
