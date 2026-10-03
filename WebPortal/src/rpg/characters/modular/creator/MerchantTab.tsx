// ══════════════════════════════════════════════════════════════════════════════
// characters/modular/creator/MerchantTab.tsx — L'onglet Marchand.
//
// Regroupe les équipements issus des personnages découpés : armures, vêtements,
// accessoires. Mise en page reprise d'HumGen3D — rail d'emplacements, champ de
// recherche, grille de vignettes — parce que c'est le geste qui marche quand on
// a des centaines de pièces à retrouver.
//
// ── CE COMPOSANT NE MODIFIE PAS LE PERSONNAGE ────────────────────────────────
//
// Il ne reçoit ni `selection` ni `onChange`, et n'a donc AUCUN moyen d'écrire
// dans le personnage. C'est la traduction en code de la règle : « les
// équipements ne doivent pas apparaître dans l'édition de création ». En jeu,
// ils s'achètent.
//
// La garantie est structurelle et non déclarative, ce qui compte ici :
// `ForgePersonnages` persiste à chaque `onChange`, pas au moment du bouton
// « Sauvegarder ». Une pièce écrite dans `equipped` « juste pour voir » y
// resterait définitivement.
// ══════════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from "react";
import { SLOT_LABELS, type BodySlot } from "../bodySlots";
import { getPart } from "../partCatalog";
import { SLOT_GLYPH, SLOT_GLYPH_FALLBACK } from "./creatorTokens";
import {
  allMerchantEntries, filterMerchant, groupBySource, merchantSlotsWithParts,
  type MerchantEntry,
} from "./merchantCatalog";
import thumbs from "../../../../data/part-thumbs.json";

const THUMBS = thumbs as Record<string, string>;
const glyph = (slot: BodySlot) => SLOT_GLYPH[slot] ?? SLOT_GLYPH_FALLBACK;

export function MerchantTab() {
  const [query, setQuery] = useState("");
  const [slot, setSlot] = useState<BodySlot | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  // Le catalogue complet ne dépend d'aucun état : on ne le reconstruit jamais.
  const tout = useMemo(allMerchantEntries, []);
  const slots = useMemo(merchantSlotsWithParts, []);
  const groupes = useMemo(
    () => groupBySource(filterMerchant(tout, query, slot)),
    [tout, query, slot],
  );

  const total = groupes.reduce((n, g) => n + g.entries.length, 0);
  const detail = selected ? getPart(selected) : undefined;

  return (
    <div className="mcr__merchant">
      {/* Rail des emplacements — le premier niveau de tri. */}
      <aside className="mcr__rail" aria-label="Types d'équipement">
        <p className="mcr__legend">Équipement</p>
        <button
          type="button"
          className="mcr__railItem"
          aria-pressed={slot === null}
          onClick={() => setSlot(null)}
        >
          <span className="mcr__railGlyph">◍</span>
          Tout
        </button>
        {slots.map((s) => (
          <button
            key={s}
            type="button"
            className="mcr__railItem"
            aria-pressed={s === slot}
            onClick={() => setSlot(s === slot ? null : s)}
          >
            <span className="mcr__railGlyph">{glyph(s)}</span>
            {SLOT_LABELS[s]}
          </button>
        ))}
      </aside>

      <div className="mcr__merchantMain">
        <div className="mcr__merchantBar">
          <input
            type="search"
            className="mcr__search"
            placeholder="Rechercher — nom, pack d'origine, type…"
            aria-label="Rechercher un équipement"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <span className="mcr__merchantCount">
            {total} pièce{total > 1 ? "s" : ""}
            {groupes.length > 0 && ` · ${groupes.length} pack${groupes.length > 1 ? "s" : ""}`}
          </span>
        </div>

        <p className="mcr__hint">
          Ces équipements s'obtiennent <strong>en jeu</strong>, chez un marchand ou
          en butin. Cette page sert à les parcourir : elle ne modifie pas le
          personnage.
        </p>

        <div className="mcr__merchantScroll">
          {groupes.length === 0 && (
            <p className="mcr__hint">Aucun équipement ne correspond à cette recherche.</p>
          )}
          {groupes.map((g) => (
            <section key={g.source} className="mcr__pack">
              <p className="mcr__legend">
                {g.source} <span className="mcr__packCount">{g.entries.length}</span>
              </p>
              <div className="mcr__grid">
                {g.entries.map((e) => (
                  <MerchantThumb
                    key={e.part.id}
                    entry={e}
                    selected={e.part.id === selected}
                    onClick={() => setSelected(e.part.id === selected ? null : e.part.id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>

        {detail && (
          <aside className="mcr__detail" aria-live="polite">
            <strong>{detail.label}</strong>
            <span>{SLOT_LABELS[detail.slot]} · pack {detail.source}</span>
            <span>
              {detail.gender === "male" ? "Homme"
                : detail.gender === "female" ? "Femme"
                : "Unisexe"}
              {detail.bones ? ` · ${detail.bones} os` : ""}
            </span>
          </aside>
        )}
      </div>
    </div>
  );
}

function MerchantThumb({ entry, selected, onClick }: {
  entry: MerchantEntry;
  selected: boolean;
  onClick: () => void;
}) {
  const { part } = entry;
  const src = THUMBS[part.id];
  // `gender` absent = pièce UNISEXE. Les découpes de héros n'ont pas de genre :
  // ne rien afficher laisserait croire à une donnée manquante.
  const g = part.gender;
  const pastille = g === "male" ? "♂" : g === "female" ? "♀" : "⚥";

  return (
    <button
      type="button"
      className="mcr__thumb"
      aria-pressed={selected}
      title={`${part.label} — ${entry.slotLabel} · ${part.source}`}
      onClick={onClick}
    >
      {src ? (
        // Une grille peut aligner des centaines de vignettes : seules celles à
        // l'écran doivent être téléchargées.
        <img
          className="mcr__thumbImg"
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          width={192}
          height={256}
        />
      ) : (
        <span className="mcr__thumbArt">{glyph(part.slot)}</span>
      )}
      <span className="mcr__thumbTag">{part.label}</span>
      <span className={`mcr__thumbSex mcr__thumbSex--${g ?? "unisex"}`}>{pastille}</span>
    </button>
  );
}
