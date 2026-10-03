// ui/StaminaBar.tsx — Jauge d'endurance de locomotion.
//
// Ne s'affiche que lorsqu'elle est pertinente : pleine et au repos, elle
// disparaît. Une barre permanente à 100 % n'apprend rien et encombre le HUD.
import { useSyncExternalStore } from "react";
import { staminaStore } from "../runtime/movement/staminaStore";

export function StaminaBar() {
  // Le store ne notifie qu'au centième près : pas de re-render par frame malgré
  // une valeur qui change en continu pendant la course.
  useSyncExternalStore(staminaStore.subscribe, staminaStore.getVersion, staminaStore.getVersion);
  const ratio = staminaStore.ratio;
  const exhausted = staminaStore.isExhausted;

  if (ratio >= 1) return null;

  // Rouge en épuisement, ambre en réserve basse, cyan sinon : l'état se lit à la
  // couleur sans avoir à interpréter la longueur.
  const color = exhausted ? "#ff4d4d" : ratio < 0.3 ? "#ffb020" : "#4de8ff";

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 bottom-28 pointer-events-none select-none"
      style={{ width: 220 }}
      role="progressbar"
      aria-label="Endurance"
      aria-valuenow={Math.round(ratio * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        style={{
          height: 6,
          borderRadius: 3,
          background: "rgba(0,0,0,0.45)",
          border: "1px solid rgba(255,255,255,0.12)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${ratio * 100}%`,
            height: "100%",
            background: color,
            // `width` est animée ici volontairement : la barre est minuscule et
            // change rarement (notification au centième), le coût de layout est
            // négligeable et un transform ne donnerait pas un remplissage net.
            transition: "width 120ms linear, background 200ms ease",
            boxShadow: `0 0 6px ${color}`,
          }}
        />
      </div>
      {exhausted && (
        <div
          className="text-center mt-1 uppercase tracking-widest font-black"
          style={{ fontSize: 9, color, textShadow: "0 1px 2px rgba(0,0,0,0.8)" }}
        >
          Épuisé
        </div>
      )}
    </div>
  );
}
