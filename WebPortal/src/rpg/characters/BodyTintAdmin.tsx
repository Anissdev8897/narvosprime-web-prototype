// characters/BodyTintAdmin.tsx — panneau de couleur PAR PARTIE (option B).
//
// Une couleur par bande de hauteur (bottes/pantalon/ceinture/torse/visage), appliquée EN
// DIRECT sur le Sorcier (re-teinte des vertex-colors par bande). Persisté (bodyTintStore).
import { useEditMode } from "../runtime/gameModeStore";
import { BODY_PARTS } from "./bodyParts";
import { bodyTintStore, useBodyTints } from "./bodyTintStore";

const PINK = "#ff7eb6";

export function BodyTintButton({ onClick }: { onClick: () => void }) {
  if (!useEditMode()) return null;
  return (
    <button onClick={onClick} title="Couleur par partie du corps"
      style={{ position: "fixed", top: 446, right: 14, zIndex: 240, width: 42, height: 42, borderRadius: 21,
        background: "rgba(26,8,18,0.85)", border: `2px solid ${PINK}`, color: PINK, fontSize: 18, fontWeight: 900,
        cursor: "pointer", boxShadow: `0 0 18px ${PINK}55`, display: "flex", alignItems: "center", justifyContent: "center" }}>🎨</button>
  );
}

export function BodyTintAdmin({ open, onClose }: { open: boolean; onClose: () => void }) {
  // TOUS les hooks AVANT le moindre retour anticipé.
  //
  // L'ancienne ligne était `if (!open || !useEditMode()) return null;`. Le `||`
  // court-circuite : panneau fermé → `useEditMode()` JAMAIS appelé (1 hook) ;
  // panneau ouvert → appelé (2 hooks). React voyait le nombre de hooks changer
  // et levait « Rendered more hooks than during the previous render ».
  //
  // Ce n'était pas une erreur cosmétique : GameErrorBoundary rattrapait et
  // DÉTRUISAIT tout le monde de jeu. Relevé en jeu — la map se rechargeait
  // entièrement, les colliders passaient de 91 à 990 sans être libérés, et le
  // compteur de textures GPU montait de 1748 à 1927 en quelques minutes.
  const tints = useBodyTints();
  const isEdit = useEditMode();
  if (!open || !isEdit) return null;
  return (
    <div style={{
      position: "fixed", top: 60, right: 66, zIndex: 250, width: 270,
      background: "rgba(20,8,16,0.96)", border: `1px solid ${PINK}55`, borderRadius: 12, padding: 16,
      color: "#ffe6f2", fontFamily: "monospace", fontSize: 12, boxShadow: `0 0 30px ${PINK}25`,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.14em", color: PINK }}>🎨 COULEUR PAR PARTIE</div>
        <button onClick={onClose} style={{ background: "transparent", color: PINK, border: `1px solid ${PINK}55`, borderRadius: 6, padding: "2px 10px", cursor: "pointer", fontSize: 14 }}>✕</button>
      </div>
      {BODY_PARTS.map((p) => {
        const hex = tints[p.id] ?? "#ffffff";
        return (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 9 }}>
            <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(hex) ? hex : "#ffffff"}
              onChange={(e) => bodyTintStore.set(p.id, e.target.value)}
              style={{ width: 28, height: 28, border: "none", background: "transparent", cursor: "pointer", borderRadius: 5 }} />
            <span style={{ flex: 1, fontSize: 11, fontWeight: 700 }}>{p.label}</span>
            <span style={{ fontSize: 10, color: "#c79ab2", fontFamily: "monospace" }}>{hex}</span>
          </div>
        );
      })}
      <div style={{ fontSize: 9, color: "#b07a92", margin: "4px 0 8px", lineHeight: 1.35 }}>
        Approximation par hauteur : deux parties à la même hauteur partagent la bande. Blanc = couleur d'origine.
      </div>
      <button onClick={() => bodyTintStore.reset()}
        style={{ width: "100%", padding: "7px", fontSize: 11, fontWeight: 800, cursor: "pointer",
          background: "transparent", color: PINK, border: `1px solid ${PINK}55`, borderRadius: 6, fontFamily: "monospace" }}>
        ↺ Réinitialiser (couleurs d'origine)
      </button>
    </div>
  );
}
