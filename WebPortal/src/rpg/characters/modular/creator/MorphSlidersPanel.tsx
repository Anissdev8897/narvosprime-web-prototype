// ══════════════════════════════════════════════════════════════════════════════
// creator/MorphSlidersPanel.tsx — Morphologie fine : 199 curseurs, 22 régions.
//
// UNE SEULE RÉGION DÉPLIÉE À LA FOIS, et c'est un choix de charge, pas de goût :
// les packs vont de 4 Ko (`buttocks`) à 1,7 Mo (`breast`). Tout déplier
// téléchargerait 5 Mo pour des curseurs que le joueur ne touchera peut-être
// jamais. `useMorphSliders([])` ne charge rien tant que rien n'est ouvert.
//
// Ce composant ne monte AUCUN Canvas et ne connaît pas la 3D : il rend des
// `<input type="range">` et remonte des valeurs. Les poids de morphs en sont
// dérivés plus haut, par `poidsDesSliders`.
// ══════════════════════════════════════════════════════════════════════════════

import { useState } from "react";
import type { MorphRegion } from "../morphLoader";
import { REGIONS_FINES, LIBELLE_REGION, libelleAxe, useMorphSliders } from "../useMorphSliders";

export interface MorphSlidersPanelProps {
  /** Position de chaque curseur, de -1 à +1. Absent = 0. */
  valeurs: Readonly<Record<string, number>>;
  onChange: (valeurs: Record<string, number>) => void;
}

export function MorphSlidersPanel({ valeurs, onChange }: MorphSlidersPanelProps) {
  const [ouverte, setOuverte] = useState<MorphRegion | null>(null);
  const { sliders, chargement, erreur } = useMorphSliders(ouverte ? [ouverte] : []);

  const regler = (id: string, v: number) => {
    const suivant = { ...valeurs };
    // Une valeur nulle est RETIRÉE plutôt que stockée : la sauvegarde ne porte
    // que ce que le joueur a réellement déplacé, et un personnage neutre reste
    // un objet vide plutôt qu'une liste de 199 zéros.
    if (v === 0) delete suivant[id]; else suivant[id] = v;
    onChange(suivant);
  };

  const reglesDansRegion = (r: MorphRegion) =>
    Object.keys(valeurs).filter((k) => k.startsWith(`${r}.`) && valeurs[k]).length;

  return (
    <div className="mcr__morphs">
      {REGIONS_FINES.map((r) => {
        const active = ouverte === r;
        const n = reglesDansRegion(r);
        return (
          <div key={r} className={`mcr__morphGroup${active ? " is-open" : ""}`}>
            <button
              type="button"
              className="mcr__morphHead"
              aria-expanded={active}
              onClick={() => setOuverte(active ? null : r)}
            >
              <span>{LIBELLE_REGION[r] ?? r}</span>
              {/* Compteur de réglages : sans lui, une région repliée ne dit pas
                  qu'elle a été modifiée, et le joueur cherche à l'aveugle. */}
              {n > 0 && <span className="mcr__morphCount">{n}</span>}
              <span aria-hidden>{active ? "−" : "+"}</span>
            </button>

            {active && (
              <div className="mcr__morphBody">
                {chargement && <p className="mcr__hint">Chargement…</p>}
                {erreur && <p className="mcr__hint">Indisponible : {erreur}</p>}
                {!chargement && !erreur && sliders.length === 0 && (
                  <p className="mcr__hint">Aucun réglage continu dans cette région.</p>
                )}

                {/* Rien pendant le chargement : afficher une liste à demi
                    remplie donne l'impression que des curseurs manquent. */}
                {!chargement && sliders.map((s) => {
                  const v = valeurs[s.id] ?? 0;
                  return (
                    <label key={s.id} className="mcr__morphRow">
                      <span className="mcr__morphLabel">
                        {libelleAxe(s.axe)}
                        {/* Un axe symétrique pilote les deux côtés d'un coup —
                            le dire évite de chercher le curseur de l'autre. */}
                        {s.symetrique && <em title="Pilote les deux côtés"> ⇄</em>}
                      </span>
                      <input
                        type="range"
                        min={-1} max={1} step={0.02}
                        value={v}
                        onChange={(e) => regler(s.id, Number(e.target.value))}
                        onDoubleClick={() => regler(s.id, 0)}
                        title="Double-clic : remettre à zéro"
                      />
                      <span className="mcr__morphValue">{v === 0 ? "—" : v.toFixed(2)}</span>
                    </label>
                  );
                })}

                {!chargement && sliders.length > 0 && (
                  <button
                    type="button"
                    className="mcr__morphReset"
                    onClick={() => {
                      const suivant = { ...valeurs };
                      for (const s of sliders) delete suivant[s.id];
                      onChange(suivant);
                    }}
                  >
                    Réinitialiser {LIBELLE_REGION[r] ?? r}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
