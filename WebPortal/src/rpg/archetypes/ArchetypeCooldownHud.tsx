// archetypes/ArchetypeCooldownHud.tsx — HUD des sorts d'archétype + cooldown radial.
//
// Affiche les sorts de la classe active (C/V/B) sous forme de pastilles. Les ULTIMES
// (cooldown 60 s) portent un balayage conique sombre qui se vide au fil du temps
// + les secondes restantes. Lit le singleton cooldownStore (hors-React) via un tick
// léger (setInterval ~120 ms) → pas besoin de rendre le store réactif.
import { useEffect, useReducer } from "react";
import { useArchetype } from "./archetypeStore";
import { ARCHETYPES, type ArchetypeSpell } from "./archetypeCatalog";
import { cooldownStore } from "../combat/cooldownStore";

const KEYS = ["C", "V", "B"]; // C = sort 1 · V = sort 2 · B = sort 3

/** Icône par mécanique (data-driven, override possible par id de sort). */
function iconForSpell(s: ArchetypeSpell): string {
  switch (s.id) {
    case "mage_meteore":  return "☄️";
    case "archer_pluie":  return "🏹";
  }
  switch (s.effect) {
    case "aoe_dodge":      return "💥";
    case "ranged":         return "✨";
    case "charged":        return "🏹";
    case "root_aoe":       return "🌋";
    case "invisibility":   return "👻";
    case "burn_shot":      return "🔥";
    case "teleport":       return "🌀";
    case "stealth_strike": return "🗡️";
    default:               return "⚔️";
  }
}

export function ArchetypeCooldownHud() {
  const arch = useArchetype();
  // Tick de rafraîchissement (le cooldownStore n'est pas réactif).
  const [, force] = useReducer((c: number) => c + 1, 0);
  useEffect(() => {
    const iv = setInterval(force, 120);
    return () => clearInterval(iv);
  }, []);

  if (!arch) return null;
  const def = ARCHETYPES[arch];

  return (
    <div style={{
      position: "fixed", left: 16, bottom: 128, zIndex: 41,
      display: "flex", gap: 8, pointerEvents: "none",
    }}>
      {def.spells.slice(0, 3).map((spell, i) => {
        const frac = spell.isUltimate ? cooldownStore.fraction(spell.id, spell.baseCooldown) : 0;
        const onCd = frac > 0;
        const remain = onCd ? Math.ceil(cooldownStore.remaining(spell.id)) : 0;
        return (
          <div key={spell.id} title={`${spell.label} — ${spell.description}`}
            style={{
              position: "relative", width: 46, height: 46, borderRadius: 10,
              background: "rgba(10,8,16,0.82)",
              border: `2px solid ${onCd ? "#555" : def.color}`,
              boxShadow: onCd ? "none" : `0 0 12px ${def.color}55`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22, filter: onCd ? "grayscale(0.7) brightness(0.7)" : "none",
              transition: "border-color 0.2s, box-shadow 0.2s",
            }}>
            <span>{iconForSpell(spell)}</span>

            {/* Balayage conique de cooldown (se vide dans le sens horaire) */}
            {onCd && (
              <div style={{
                position: "absolute", inset: 0, borderRadius: 8,
                background: `conic-gradient(rgba(0,0,0,0.62) ${frac * 360}deg, transparent 0deg)`,
                pointerEvents: "none",
              }} />
            )}
            {/* Secondes restantes */}
            {onCd && (
              <span style={{
                position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 15, fontWeight: 900, color: "#fff", textShadow: "0 1px 2px #000",
              }}>{remain}</span>
            )}

            {/* Touche (coin bas-droit) */}
            <span style={{
              position: "absolute", right: 2, bottom: 0, fontSize: 10, fontWeight: 900,
              color: onCd ? "#999" : def.color, textShadow: "0 1px 2px #000",
            }}>{KEYS[i]}</span>

            {/* Pastille ultime (coin haut-gauche) */}
            {spell.isUltimate && (
              <span style={{
                position: "absolute", left: 2, top: 0, fontSize: 9, fontWeight: 900, color: "#ffd24d",
                textShadow: "0 1px 2px #000",
              }}>★</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
