// ══════════════════════════════════════════════════════════════════════════════
// characters/modular/ModularEditorPanel.tsx — Console d'assemblage.
//
// Composant CONTRÔLÉ : il reçoit une sélection et émet la suivante. Aucun état
// interne en dehors de la catégorie affichée — l'appelant reste maître de la
// tenue, ce qui lui permet de la sauvegarder, de l'annuler, ou de la brancher
// sur un aperçu 3D sans synchronisation à double sens.
//
// Toute la mécanique de navigation vit dans `modularEditorState.ts` (logique
// pure, testée). Ce fichier ne fait qu'afficher et transmettre les clics.
//
// USAGE : à poser à côté d'un <Canvas> rendant <ModularCharacter equipped=… />.
// ══════════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from "react";
import {
  type BodySlot, type SlotCategory,
  CATEGORY_ORDER, CATEGORY_LABELS, SLOT_LABELS,
} from "./bodySlots";
import {
  type EditorSelection, DEFAULT_SKIN_TINT, DEFAULT_EYE_TINT,
  cycleSlot, setSlot, editableSlots, activeCategories, optionsForSlot, slotSummary,
} from "./modularEditorState";
import {
  ARCHETYPES, BUILDS, type ArchetypeId, type BuildId,
  findBody, isArchetypePlayable,
} from "./bodyArchetypes";
import { getPart } from "./partCatalog";
import compat from "../../../data/part-compat.json";
import "./modular-editor.css";

/** Teintes de peau proposées — l'échantillon libre couvre le reste. */
const SKIN_TINTS = [
  { value: "#ffffff", label: "Neutre" },
  { value: "#f3d3bd", label: "Claire" },
  { value: "#d6a37b", label: "Dorée" },
  { value: "#9c6644", label: "Ambre" },
  { value: "#5c3a21", label: "Sombre" },
  { value: "#8fb9c9", label: "Cyanée" },
  { value: "#a89bc4", label: "Améthyste" },
  { value: "#7d8c74", label: "Chlorophylle" },
];

interface CompatRow { id: string; coverageByWeight: number; bindDelta: number }

/**
 * Compatibilité mesurée par `scripts/audit-part-compat.mjs`.
 *
 * Consultée AVANT l'assemblage : prévenir dans la liste vaut mieux que laisser
 * `rebindSkinnedMesh` refuser après le clic, ce qui se traduirait par une pièce
 * qui disparaît sans explication.
 */
const COMPAT = new Map((compat as CompatRow[]).map((r) => [r.id, r]));

/** Verdict affiché à côté d'une pièce. `null` = rien à signaler. */
function compatFlag(partId: string | undefined): { text: string; level: "warn" | "danger" } | null {
  if (!partId) return null;
  const row = COMPAT.get(partId);
  if (!row) return null;
  if (row.coverageByWeight < 0.5) return { text: "incompatible", level: "danger" };
  if (row.coverageByWeight < 0.9) return { text: "ajusté", level: "warn" };
  if (row.bindDelta > 1.5) return { text: "retaillé", level: "warn" };
  return null;
}

export interface ModularEditorPanelProps {
  selection: EditorSelection;
  onChange: (next: EditorSelection) => void;
}

export function ModularEditorPanel({ selection, onChange }: ModularEditorPanelProps) {
  const [category, setCategory] = useState<SlotCategory>("anatomy");
  const { gender, equipped } = selection;

  const categories = useMemo(() => activeCategories(gender, CATEGORY_ORDER), [gender]);
  const slots = useMemo(() => editableSlots(category, gender), [category, gender]);

  const patch = (p: Partial<EditorSelection>) => onChange({ ...selection, ...p });

  return (
    <div className="mod-editor">
      <nav className="mod-editor__rail" aria-label="Catégories">
        <p className="mod-editor__rail-title">Assemblage</p>
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={c === category}
            className="mod-editor__tab"
            onClick={() => setCategory(c)}
          >
            {CATEGORY_LABELS[c]}
            <span className="mod-editor__tab-count">{editableSlots(c, gender).length}</span>
          </button>
        ))}
      </nav>

      <div className="mod-editor__body">
        {category === "anatomy" && (
          <ArchetypeChoice
            archetype={selection.archetype}
            build={selection.build}
            gender={gender}
            onPick={(archetype, build) => {
              const corps = findBody(archetype, build, gender);
              patch({
                archetype,
                build,
                // Le corps de base suit le choix : garder l'ancien laisserait un
                // humain athlétique sous une sélection « alien massif ».
                // `partId`, pas `id` — deux espaces d'identifiants distincts.
                equipped: corps?.partId ? setSlot(equipped, "body", corps.partId) : equipped,
              });
            }}
          />
        )}

        <section>
          <p className="mod-editor__section-title">{CATEGORY_LABELS[category]}</p>
          <div className="mod-editor__slots">
            {slots.map((slot) => (
              <SlotRow
                key={slot}
                slot={slot}
                selection={selection}
                onCycle={(dir) => patch({ equipped: cycleSlot(equipped, slot, dir, gender) })}
                onSelect={(id) => patch({ equipped: setSlot(equipped, slot, id) })}
              />
            ))}
            {slots.length === 0 && (
              <p className="mod-editor__chip-note">Aucune pièce disponible dans cette catégorie.</p>
            )}
          </div>
        </section>

        {category === "anatomy" && (
          <SkinTint value={selection.skinTint} onChange={(skinTint) => patch({ skinTint })} />
        )}
      </div>
    </div>
  );
}

// ── Étape 1 : archétype et morphologie ───────────────────────────────────────

function ArchetypeChoice({
  archetype, build, gender, onPick,
}: {
  archetype: ArchetypeId;
  build: BuildId;
  gender: EditorSelection["gender"];
  onPick: (a: ArchetypeId, b: BuildId) => void;
}) {
  return (
    <>
      <section>
        <p className="mod-editor__section-title">Archétype</p>
        <div className="mod-editor__grid">
          {ARCHETYPES.map((a) => {
            const jouable = isArchetypePlayable(a.id);
            return (
              <button
                key={a.id}
                type="button"
                className="mod-editor__chip"
                aria-pressed={a.id === archetype}
                disabled={!jouable}
                title={jouable ? a.description : "Modèles pas encore disponibles"}
                onClick={() => onPick(a.id, build)}
              >
                <span className="mod-editor__chip-name">{a.label}</span>
                <span className="mod-editor__chip-note">{jouable ? a.description : "À venir"}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <p className="mod-editor__section-title">Morphologie</p>
        <div className="mod-editor__grid">
          {BUILDS.map((b) => {
            const corps = findBody(archetype, b.id, gender);
            const dispo = Boolean(corps?.path);
            return (
              <button
                key={b.id}
                type="button"
                className="mod-editor__chip"
                aria-pressed={b.id === build}
                disabled={!dispo}
                onClick={() => onPick(archetype, b.id)}
              >
                <span className="mod-editor__chip-name">{b.label}</span>
                <span className="mod-editor__chip-note">{dispo ? `×${b.girth.toFixed(2)}` : "À venir"}</span>
              </button>
            );
          })}
        </div>
      </section>
    </>
  );
}

// ── Rangée d'emplacement ─────────────────────────────────────────────────────

function SlotRow({
  slot, selection, onCycle, onSelect,
}: {
  slot: BodySlot;
  selection: EditorSelection;
  onCycle: (dir: 1 | -1) => void;
  onSelect: (id: string | null) => void;
}) {
  const { gender, equipped } = selection;
  const options = useMemo(() => optionsForSlot(slot, gender), [slot, gender]);
  const résumé = slotSummary(slot, equipped, gender);
  const équipé = equipped[slot];
  const drapeau = compatFlag(équipé);
  const pièce = équipé ? getPart(équipé) : undefined;
  const label = SLOT_LABELS[slot];

  return (
    <div className="mod-editor__slot">
      <span className="mod-editor__slot-label">{label}</span>

      <button
        type="button"
        className="mod-editor__arrow"
        aria-label={`${label} — précédent`}
        onClick={() => onCycle(-1)}
      >
        ◀
      </button>

      <div className="mod-editor__slot-value">
        {/* Le nom sert aussi de sélecteur direct : parcourir 40 têtes à la
            flèche serait pénible, mais la liste ne doit pas voler la vedette
            aux flèches — d'où un <select> transparent posé sur le libellé. */}
        <select
          className="mod-editor__slot-name"
          aria-label={`${label} — choisir une pièce`}
          value={équipé ?? ""}
          onChange={(e) => onSelect(e.target.value || null)}
        >
          {options.map((o) => (
            <option key={o.id ?? "__none"} value={o.id ?? ""}>{o.label}</option>
          ))}
        </select>
        <span className="mod-editor__slot-meta">
          <span className="mod-editor__slot-pos">{résumé.position}/{résumé.total}</span>
          {pièce?.source && pièce.source !== "biker" && <span>{pièce.source}</span>}
          {drapeau && (
            <span className={`mod-editor__flag mod-editor__flag--${drapeau.level}`}>{drapeau.text}</span>
          )}
        </span>
      </div>

      <button
        type="button"
        className="mod-editor__arrow"
        aria-label={`${label} — suivant`}
        onClick={() => onCycle(1)}
      >
        ▶
      </button>
    </div>
  );
}

// ── Teinte de peau ───────────────────────────────────────────────────────────

function SkinTint({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <section>
      <p className="mod-editor__section-title">Teinte de peau</p>
      <div className="mod-editor__tints">
        {SKIN_TINTS.map((t) => (
          <button
            key={t.value}
            type="button"
            className="mod-editor__tint"
            style={{ background: t.value }}
            aria-label={t.label}
            aria-pressed={t.value.toLowerCase() === value.toLowerCase()}
            onClick={() => onChange(t.value)}
          />
        ))}
        <input
          type="color"
          className="mod-editor__tint mod-editor__tint-custom"
          aria-label="Teinte personnalisée"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </section>
  );
}

/** Sélection de départ — un personnage jamais vide à l'ouverture de l'éditeur. */
export function initialSelection(gender: EditorSelection["gender"] = "male"): EditorSelection {
  const corps = findBody("human", "athletic", gender);
  return {
    archetype: "human",
    build: "athletic",
    gender,
    equipped: corps?.partId ? { body: corps.partId } : {},
    skinTint: DEFAULT_SKIN_TINT,
    eyeTint: DEFAULT_EYE_TINT,
  };
}