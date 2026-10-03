// ══════════════════════════════════════════════════════════════════════════════
// runtime/uiSound.ts — Sons d'interface (clic / survol) + hook global
//
// Respecte le volume "Interface" (ui) × "Général" (master) des réglages.
// useUiSounds() délègue depuis document : tout <button>/<a>/[role=button] joue
// un son au clic et au survol, sans éditer chaque composant.
// ══════════════════════════════════════════════════════════════════════════════

import { useEffect } from "react";
import { gameSettings } from "../settings/gameSettings";

const CLICK_SFX = "/models/audio/sfx/Buttons/TAH Digital SFX Button 01.wav";

function uiVolume(): number {
  return gameSettings.audio.ui * gameSettings.audio.master;
}

function play(url: string, gain: number) {
  const v = uiVolume() * gain;
  if (v <= 0.001) return;
  try {
    const a = new Audio(url);
    a.volume = Math.min(1, v);
    a.play().catch(() => { /* autoplay / fichier absent : silencieux */ });
  } catch { /* ignore */ }
}

export function playUiClick() { play(CLICK_SFX, 0.6); }

let lastHover = 0;
export function playUiHover() {
  const now = performance.now();
  if (now - lastHover < 70) return; // throttle anti-mitraillage
  lastHover = now;
  play(CLICK_SFX, 0.18);
}

const INTERACTIVE = "button, a, [role=button]";

/** Branche les sons clic/survol sur TOUS les éléments interactifs (montage unique). */
export function useUiSounds() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement)?.closest?.(INTERACTIVE)) playUiClick();
    };
    const onOver = (e: MouseEvent) => {
      if ((e.target as HTMLElement)?.closest?.(INTERACTIVE)) playUiHover();
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("mouseover", onOver, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("mouseover", onOver, true);
    };
  }, []);
}
