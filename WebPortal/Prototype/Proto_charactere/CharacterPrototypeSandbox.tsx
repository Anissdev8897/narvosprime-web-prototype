/**
 * Proto_charactere/CharacterPrototypeSandbox.tsx — Banc d'essai du créateur de
 * personnage modulaire, hors du jeu.
 *
 * ── CE QU'IL FAIT, ET CE QU'IL NE FAIT PAS ───────────────────────────────────
 *
 * Il IMPORTE `ForgePersonnages` tel quel : aucun code déplacé, aucune copie.
 * C'est l'ordre imposé par docs/ARCHITECTURE_PROTOTYPES.md §5 — dupliquer le
 * créateur produirait deux versions qui divergent, et le jour où l'une est
 * corrigée l'autre reste cassée.
 *
 * Il ne monte NI map, NI HUD, NI PNJ : `ForgePersonnages` possède déjà son
 * propre `<Canvas>` (avec `<RendererRegistrar />`, obligatoire pour KTX2).
 *
 * ── POURQUOI CE PROTOTYPE EXISTE ─────────────────────────────────────────────
 *
 * Le créateur vivait dans la Forge, par accident d'histoire. L'atteindre
 * coûtait : menu → login Forge → écran Forge → personnages. Ici, une URL.
 *
 * Accessible via http://localhost:3005/Prototype/Proto_charactere/
 */
import React, { useState } from "react";

import { ForgePersonnages } from "../../src/rpg/characters/ForgePersonnages";

export function CharacterPrototypeSandbox() {
  // `ForgePersonnages` exige un `onExit` — dans le jeu il ramène à la Forge.
  // Ici il n'y a rien derrière : on affiche un écran de sortie explicite plutôt
  // qu'un bouton mort, pour que « ← Quitter » garde un sens observable.
  const [ferme, setFerme] = useState(false);

  if (ferme) {
    return (
      <div style={ecranSortie}>
        <p style={{ margin: 0, opacity: 0.7 }}>Prototype fermé.</p>
        <button onClick={() => setFerme(false)} style={bouton}>
          Rouvrir le créateur
        </button>
      </div>
    );
  }

  return <ForgePersonnages onExit={() => setFerme(true)} />;
}

const ecranSortie: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 16,
  width: "100%",
  height: "100%",
};

const bouton: React.CSSProperties = {
  padding: "10px 20px",
  border: "1px solid #334155",
  borderRadius: 6,
  background: "#1e293b",
  color: "#e2e8f0",
  font: "inherit",
  cursor: "pointer",
};
