// ============================================================================
// characters/modular/ModularCreatorScreen.tsx — Écran de création plein cadre.
//
// Structure calquée sur la maquette validée :
//
//   [ en-tête : titre · onglets CORPS/VÊTEMENTS/ACCESSOIRES · réinit · sauver ]
//   [ rail       | corps de base |            | SÉLECTION : <slot actif>      ]
//   [ catégories | morphologie   | aperçu 3D  | ◀ [vignettes] ▶   03 / 18     ]
//   [            | couleurs      |            | rangées compactes …           ]
//
// L'aperçu 3D arrive par `preview` : ce composant ne monte AUCUN Canvas. C'est
// ce qui lui permet d'être testé et réutilisé (Forge admin, création joueur)
// sans dupliquer la scène ni consommer un second contexte WebGL.
//
// `preview` est une FONCTION de l'onglet actif, et non un nœud figé : l'onglet
// Corps montre le mannequin morphable (MakeHuman), Création montre le
// personnage assemblé (pièces découpées). L'appelant peut ainsi changer le
// CONTENU d'un unique Canvas au lieu d'en monter deux et de détruire un
// contexte WebGL à chaque bascule d'onglet.
//
// Les vignettes sont RENDUES hors-ligne par `scripts/generate-part-thumbs.mjs`
// (rastérisation logicielle, ni GPU ni navigateur) et indexées dans
// `src/data/part-thumbs.json`. Une pièce sans entrée retombe sur son glyphe
// d'emplacement : ajouter un pack ne laisse pas de case vide en attendant qu'on
// relance le script.
// ============================================================================

import { type ReactNode, useMemo, useState } from "react";
import {
  type BodySlot, type EditorTab,
  EDITOR_TABS, EDITOR_TAB_LABELS, slotsInTab, SLOT_LABELS, carouselLabel,
} from "./bodySlots";
import {
  type EditorSelection, type SlotOption,
  cycleSlot, setSlot, editableSlots, optionsForSlot, currentIndex, windowAround,
  switchGender, randomSelection,
} from "./modularEditorState";
import { getPart, type Gender } from "./partCatalog";
import { PROPORTION_DEFS, sanitizeProportions } from "./bodyProportions";
import {
  ARCHETYPES, BUILDS, type ArchetypeId, type BuildId, findBody, isArchetypePlayable,
} from "./bodyArchetypes";
import { compatOf } from "./creator/partCompat";
import { MerchantTab } from "./creator/MerchantTab";
import { MorphSlidersPanel } from "./creator/MorphSlidersPanel";
import { COIFFURES } from "./hairCatalog";
import {
  SLOT_GLYPH, SLOT_GLYPH_FALLBACK, SKIN_TINTS, EYE_TINTS, NEUTRAL_TINT,
} from "./creator/creatorTokens";
import thumbs from "../../../data/part-thumbs.json";
import "./modular-creator.css";

const THUMBS = thumbs as Record<string, string>;

/** Vignettes visibles dans le carrousel de l'emplacement mis en avant. */
const BIG_WINDOW = 5;

/** Vignettes visibles dans les rangées compactes. */
const ROW_WINDOW = 4;

const glyph = (slot: BodySlot) => SLOT_GLYPH[slot] ?? SLOT_GLYPH_FALLBACK;

/** Les deux corps de base. L'ordre suit la maquette : homme puis femme. */
const GENDERS: { id: Gender; label: string; glyph: string }[] = [
  { id: "male", label: "Homme", glyph: "♂" },
  { id: "female", label: "Femme", glyph: "♀" },
];

export interface ModularCreatorScreenProps {
  selection: EditorSelection;
  onChange: (next: EditorSelection) => void;
  /**
   * Scène 3D — fournie par l'appelant, jamais montée ici.
   *
   * Reçoit l'onglet actif pour que l'appelant choisisse QUOI montrer (mannequin
   * morphable sur « corps », personnage assemblé sur « création ») sans dupliquer
   * le Canvas.
   */
  preview: (tab: EditorTab) => ReactNode;
  onReset?: () => void;
  onSave?: () => void;
  onExit?: () => void;
  title?: string;
}

export function ModularCreatorScreen({
  selection, onChange, preview, onReset, onSave, onExit, title = "Création de personnage",
}: ModularCreatorScreenProps) {
  const { gender, equipped } = selection;
  // Normalisé À LA LECTURE : un personnage d'avant les curseurs n'a pas de
  // proportions, et un `value` `undefined` ferait passer l'input en non contrôlé
  // — React le signale, puis le curseur cesse de suivre l'état.
  const proportions = sanitizeProportions(selection.proportions);
  // ── LE CRÉATEUR NE RÈGLE QUE L'ANATOMIE (03/08/2026) ───────────────────────
  //
  // Vêtements et accessoires ne s'y choisissent plus : ils s'achètent en jeu
  // (cf. `slotSource` dans bodySlots.ts, et le marchand d'équipement). Le
  // personnage démarre avec `starterOutfit` seule, équipée mais non modifiable
  // ici. Il n'y a donc plus d'onglets — un seul jeu d'emplacements.
  const [tab, setTab] = useState<EditorTab>("corps");

  // Emplacements de l'onglet CRÉATION, restreints à ceux qui ont de quoi
  // choisir. `slotsInTab` donne la taxonomie, `editableSlots` élague ce qui
  // n'aurait qu'une option — un carrousel à une seule vignette n'apporte rien.
  const slots = useMemo(() => {
    const duTab = new Set(slotsInTab("creation"));
    return editableSlots("anatomy", gender).filter((s) => duTab.has(s));
  }, [gender]);
  const [active, setActive] = useState<BodySlot | null>(null);

  // L'emplacement mis en avant : le dernier cliqué s'il appartient à l'onglet
  // courant, sinon le premier. Sans ce repli, changer d'onglet laisserait la
  // grande vignette sur un emplacement absent du rail.
  const focus = active && slots.includes(active) ? active : slots[0];

  const patch = (p: Partial<EditorSelection>) => onChange({ ...selection, ...p });
  const cycle = (slot: BodySlot, dir: 1 | -1) => patch({ equipped: cycleSlot(equipped, slot, dir, gender) });

  /** Applique archétype + morphologie, et fait suivre le corps de base. */
  const applyBody = (archetype: ArchetypeId, build: BuildId) => {
    const corps = findBody(archetype, build, gender);
    patch({
      archetype, build,
      // `partId` et NON `id` : deux espaces d'identifiants distincts. Passer
      // l'id de combinaison satisfait le typage et produit un personnage sans
      // corps, retiré en silence par `pruneUnknown`.
      equipped: corps?.partId ? setSlot(equipped, "body", corps.partId) : equipped,
    });
  };

  return (
    <div className="mcr">
      <header className="mcr__head">
        <h1 className="mcr__title">{title}</h1>
        <p className="mcr__subtitle">Apparence de base</p>

        {/* LES TROIS ONGLETS. « Corps » = le mannequin nu et sa morphologie ;
            « Création » = les variantes d'anatomie ; « Marchand » = l'équipement
            issu des personnages découpés, consultable mais JAMAIS enregistré
            dans le personnage (cf. MerchantTab). */}
        <nav className="mcr__tabs" aria-label="Sections de l'éditeur">
          {EDITOR_TABS.map((t) => (
            <button
              key={t}
              type="button"
              className="mcr__tab"
              aria-pressed={t === tab}
              onClick={() => setTab(t)}
            >
              {EDITOR_TAB_LABELS[t]}
            </button>
          ))}
        </nav>

        <div className="mcr__actions">
          {/* Le hasard garde le GENRE courant : tirer aussi le sexe ferait
              basculer le personnage sous les yeux du joueur qui vient de le
              choisir. Il reste un réglage, pas un résultat. */}
          <button
            type="button"
            className="mcr__btn"
            onClick={() => onChange(randomSelection(gender))}
            title="Tire une anatomie, une morphologie et des teintes au hasard"
          >
            🎲 Aléatoire
          </button>
          {onReset && <button type="button" className="mcr__btn" onClick={onReset}>Réinitialiser</button>}
          {onSave && <button type="button" className="mcr__btn mcr__btn--primary" onClick={onSave}>Sauvegarder</button>}
          {onExit && <button type="button" className="mcr__btn" onClick={onExit}>← Liste</button>}
        </div>
      </header>

      <div className={`mcr__body mcr__body--${tab}`}>
        {/* Rail en DEUX groupes. « Apparence de base » = ce qu'on choisit dans un
            catalogue ; « Modifications » = ce qu'on règle en continu. Deux gestes
            différents, deux blocs — les mélanger obligeait à lire chaque entrée
            pour savoir laquelle ouvre une liste et laquelle ouvre des curseurs. */}
        {tab === "creation" && (
        <aside className="mcr__rail" aria-label="Parties">
          <p className="mcr__legend">Apparence de base</p>
          {slots.map((s) => (
            <button
              key={s}
              type="button"
              className="mcr__railItem"
              aria-pressed={s === focus}
              onClick={() => setActive(s)}
            >
              <span className="mcr__railGlyph">{glyph(s)}</span>
              {SLOT_LABELS[s]}
            </button>
          ))}

          <div className="mcr__railSep" />
          <p className="mcr__legend">Modifications (avancé)</p>
          {/* Les curseurs EXISTENT depuis le branchement des 22 régions MPFB2,
              mais ils vivent sur l'onglet Corps — seul endroit où le mannequin
              morphable est à l'écran. Ce bouton y renvoie plutôt que d'ouvrir un
              panneau sans effet visible ici. */}
          <button
            type="button"
            className="mcr__railItem"
            title="Nez, joues, oreilles, ventre… — sur l'onglet Corps"
            onClick={() => setTab("corps")}
          >
            <span className="mcr__railGlyph">◇</span>
            Morphologie fine
          </button>
        </aside>
        )}

        {/* Onglet CORPS — le mannequin nu : gabarit, genre, morphologie, teintes. */}
        {tab === "corps" && (
        <div className="mcr__setup">
              <Panel label="Corps de base">
                {ARCHETYPES.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className="mcr__opt"
                    aria-pressed={a.id === selection.archetype}
                    disabled={!isArchetypePlayable(a.id)}
                    title={a.description}
                    onClick={() => applyBody(a.id, selection.build)}
                  >
                    <span className="mcr__optGlyph">◈</span>
                    {a.label}
                  </button>
                ))}
              </Panel>

              {/* Les pièces sont genrées : la bascule reconstruit la composition
                  sur l'autre catalogue (`switchGender`). Changer le seul champ
                  laisserait un corps masculin sur une sélection féminine. */}
              <Panel label="Sélection de genre">
                {GENDERS.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    className="mcr__opt"
                    aria-pressed={g.id === gender}
                    onClick={() => onChange(switchGender(selection, g.id))}
                  >
                    <span className="mcr__optGlyph">{g.glyph}</span>
                    {g.label}
                  </button>
                ))}
              </Panel>

              <Panel label="Morphologie">
                {BUILDS.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    className="mcr__opt"
                    aria-pressed={b.id === selection.build}
                    disabled={!findBody(selection.archetype, b.id, gender)?.path}
                    onClick={() => applyBody(selection.archetype, b.id)}
                  >
                    <span className="mcr__optGlyph">◈</span>
                    {b.label}
                  </button>
                ))}
              </Panel>

              <Panel label="Couleur de peau">
                <div className="mcr__swatches">
                  {SKIN_TINTS.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      className="mcr__swatch"
                      style={{ background: t.value }}
                      aria-label={t.label}
                      title={t.label}
                      aria-pressed={t.value.toLowerCase() === selection.skinTint.toLowerCase()}
                      onClick={() => patch({ skinTint: t.value })}
                    />
                  ))}
                </div>
                <input
                  type="color"
                  className="mcr__picker"
                  aria-label="Teinte de peau personnalisée"
                  value={selection.skinTint}
                  onChange={(e) => patch({ skinTint: e.target.value })}
                />
              </Panel>

              {/* Curseurs de silhouette — mise à l'échelle d'os, bornée à ±10 %.
                  `step` à 0.05 : plus fin, le joueur ne distingue plus les crans
                  à l'écran et croit que le curseur ne répond pas. */}
              <Panel label="Détails du corps (ajustables)">
                {PROPORTION_DEFS.map((d) => (
                  <label key={d.key} className="mcr__slider">
                    <span className="mcr__sliderLabel">{d.label}</span>
                    <input
                      type="range"
                      min={-1}
                      max={1}
                      step={0.05}
                      value={proportions[d.key]}
                      aria-label={d.label}
                      onChange={(e) =>
                        patch({ proportions: { ...proportions, [d.key]: Number(e.target.value) } })
                      }
                    />
                  </label>
                ))}
              </Panel>

              {/* MORPHOLOGIE FINE — 199 curseurs sur 22 régions, tirés des
                  1 250 cibles MakeHuman de `_body/morphs/`.
                  Sa place est ICI et pas sur l'onglet Création : c'est le
                  mannequin morphable qui répond à ces curseurs, et il n'est
                  affiché que sur Corps. Sur Création l'aperçu montre le corps
                  Biker, où ils n'auraient aucun effet visible. */}
              {/* COIFFURE — sur l'onglet Corps, comme la morphologie : c'est le
                  mannequin morphable qui la porte, et lui seul est à l'écran
                  ici. Uniquement de VRAIES coupes : ni casque, ni bandana, ni
                  barbe (cf. `hairCatalog`). */}
              <Panel label="Coiffure">
                <div className="mcr__hairs">
                  <button
                    type="button"
                    className="mcr__hair"
                    aria-pressed={!selection.hairId}
                    onClick={() => patch({ hairId: undefined })}
                  >
                    Aucune
                  </button>
                  {COIFFURES.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="mcr__hair"
                      aria-pressed={selection.hairId === c.id}
                      title={c.genre ? `Conçue pour un corps ${c.genre === "male" ? "masculin" : "féminin"}` : undefined}
                      onClick={() => patch({ hairId: c.id })}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
                {/* Le verdict de compatibilité vient de `rebindSkinnedMesh`, pas
                    du catalogue : une coupe refusée n'est pas rendue et la
                    console dit pourquoi. */}
                <p className="mcr__hint">
                  Une coupe incompatible avec ce corps n'apparaît pas — la console en donne la raison.
                </p>
              </Panel>

              <Panel label="Morphologie fine">
                <MorphSlidersPanel
                  valeurs={selection.morphs ?? {}}
                  onChange={(morphs) => patch({ morphs })}
                />
              </Panel>

              <Panel label="Couleur des yeux">
                <div className="mcr__swatches mcr__swatches--eyes">
                  {EYE_TINTS.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      className="mcr__swatch mcr__swatch--eye"
                      style={{ background: t.value }}
                      aria-label={t.label}
                      title={t.label}
                      aria-pressed={t.value.toLowerCase() === (selection.eyeTint ?? NEUTRAL_TINT).toLowerCase()}
                      onClick={() => patch({ eyeTint: t.value })}
                    />
                  ))}
                </div>
                <input
                  type="color"
                  className="mcr__picker"
                  aria-label="Couleur d'iris personnalisée"
                  value={selection.eyeTint ?? NEUTRAL_TINT}
                  onChange={(e) => patch({ eyeTint: e.target.value })}
                />
                {/* Aperçu — l'iris est minuscule sur le personnage, et la teinte
                    NEUTRE (#ffffff) veut dire « couleur d'origine du modèle »,
                    pas « blanc ». Une pastille de couleur seule mentirait donc
                    sur ce cas ; l'œil dessiné le montre tel qu'il sera rendu. */}
                <span
                  className="mcr__eyePreview"
                  role="img"
                  aria-label={
                    (selection.eyeTint ?? NEUTRAL_TINT).toLowerCase() === NEUTRAL_TINT
                      ? "Aperçu — couleur d'origine du modèle"
                      : `Aperçu de l'iris ${selection.eyeTint}`
                  }
                  title={
                    (selection.eyeTint ?? NEUTRAL_TINT).toLowerCase() === NEUTRAL_TINT
                      ? "Couleur d'origine du modèle"
                      : selection.eyeTint
                  }
                >
                  <svg viewBox="0 0 48 28" width="48" height="28" aria-hidden="true">
                    <path
                      d="M2 14c6-9 14-13 22-13s16 4 22 13c-6 9-14 13-22 13S8 23 2 14Z"
                      fill="#f2ede6"
                      stroke="rgba(0,0,0,.45)"
                      strokeWidth="1.5"
                    />
                    <circle cx="24" cy="14" r="8.5" fill={selection.eyeTint ?? NEUTRAL_TINT} />
                    <circle cx="24" cy="14" r="8.5" fill="none" stroke="rgba(0,0,0,.35)" strokeWidth="1" />
                    <circle cx="24" cy="14" r="3.6" fill="#111" />
                    <circle cx="21" cy="11" r="1.6" fill="rgba(255,255,255,.85)" />
                  </svg>
                </span>
              </Panel>

              <Panel label="Équipement">
                <p className="mcr__hint">
                  Casques, plastrons, gants et bottes ne se règlent pas ici : ils
                  s'achètent en jeu. L'onglet <strong>Marchand</strong> permet de
                  les parcourir. Le personnage démarre avec une tenue simple.
                </p>
              </Panel>
        </div>
        )}

        {/* L'aperçu suit les onglets qui MODIFIENT le corps. Le Marchand est un
            catalogue : y afficher le personnage laisserait croire qu'un clic
            l'habille. */}
        {tab !== "marchand" && (
        <div className="mcr__stage">
          {preview(tab)}
          <p className="mcr__stageHint">Glisser : rotation · Molette : zoom</p>
        </div>
        )}

        {tab === "creation" && (
        <div className="mcr__picks">
          {focus && (
            <BigCarousel
              slot={focus}
              selection={selection}
              onCycle={(d) => cycle(focus, d)}
              onPick={(id) => patch({ equipped: setSlot(equipped, focus, id) })}
            />
          )}
          {slots.filter((s) => s !== focus).map((s) => (
            <CompactRow
              key={s}
              slot={s}
              selection={selection}
              onOpen={() => setActive(s)}
              onCycle={(d) => cycle(s, d)}
              onPick={(id) => patch({ equipped: setSlot(equipped, s, id) })}
            />
          ))}
          {slots.length === 0 && <p className="mcr__hint">Aucune pièce dans cette catégorie.</p>}
        </div>
        )}

        {/* Onglet MARCHAND — catalogue seul, aucun accès au personnage. */}
        {tab === "marchand" && <MerchantTab />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Blocs
// ---------------------------------------------------------------------------

function Panel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="mcr__panel">
      <p className="mcr__legend">{label}</p>
      <div className="mcr__panelBody">{children}</div>
    </section>
  );
}

/** Vignette d'une pièce : rendu hors-ligne, glyphe en repli. */
function Thumb({ option, slot, selected, onClick }: {
  option: SlotOption;
  slot: BodySlot;
  selected: boolean;
  onClick: () => void;
}) {
  const flag = compatOf(option.id);
  const src = option.id ? THUMBS[option.id] : undefined;

  // Pastille de genre. `gender` absent = pièce UNISEXE, portée par les deux —
  // c'est le cas de toutes les découpes de héros. Ne rien afficher alors serait
  // ambigu : le joueur ne saurait pas distinguer « convient aux deux » d'une
  // donnée manquante. On marque donc les trois cas.
  const g = option.id ? getPart(option.id)?.gender : undefined;
  const pastille = !option.id ? null : g === "male" ? "♂" : g === "female" ? "♀" : "⚥";
  const pastilleTitre = g === "male" ? "Homme" : g === "female" ? "Femme" : "Unisexe";

  return (
    <button
      type="button"
      className="mcr__thumb"
      aria-pressed={selected}
      title={option.id ? `${option.label} — ${pastilleTitre}` : option.label}
      onClick={onClick}
    >
      {src ? (
        // `loading="lazy"` : une catégorie peut aligner 40 vignettes, et seules
        // celles de la fenêtre sont à l'écran.
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
        <span className="mcr__thumbArt" data-empty={option.id === null || undefined}>
          {option.id === null ? "∅" : glyph(slot)}
        </span>
      )}
      <span className="mcr__thumbTag">{option.source ?? "—"}</span>
      {pastille && (
        <span
          className={`mcr__thumbSex mcr__thumbSex--${g ?? "unisex"}`}
          aria-label={pastilleTitre}
        >
          {pastille}
        </span>
      )}
      {flag && <span className={`mcr__thumbFlag mcr__thumbFlag--${flag.level}`} />}
    </button>
  );
}

/** Carrousel large de l'emplacement mis en avant. */
function BigCarousel({ slot, selection, onCycle, onPick }: {
  slot: BodySlot;
  selection: EditorSelection;
  onCycle: (d: 1 | -1) => void;
  onPick: (id: string | null) => void;
}) {
  const options = useMemo(() => optionsForSlot(slot, selection.gender), [slot, selection.gender]);
  const i = currentIndex(options, selection.equipped[slot]);

  // Fenêtre centrée et bornée — cf. `windowAround`. Le calcul vivait ici,
  // dupliqué et divergent entre les deux carrousels ; une liste plus courte que
  // la fenêtre y produisait un départ négatif, donc un `slice` qui repartait de
  // la FIN de la liste.
  const debut = windowAround(options.length, i, BIG_WINDOW);
  const visibles = options.slice(debut, debut + BIG_WINDOW);
  const flag = compatOf(options[i]?.id ?? null);

  return (
    <section className="mcr__big">
      <div className="mcr__bigHead">
        <span className="mcr__bigGlyph">{glyph(slot)}</span>
        <span>{carouselLabel(slot)}</span>
        {flag && <span className={`mcr__flag mcr__flag--${flag.level}`}>{flag.text}</span>}
      </div>
      <div className="mcr__bigRow">
        <button type="button" className="mcr__nav" aria-label="Précédent" onClick={() => onCycle(-1)}>◀</button>
        <div className="mcr__thumbs">
          {visibles.map((o) => (
            <Thumb
              key={o.id ?? "__none"}
              option={o}
              slot={slot}
              selected={o.id === (selection.equipped[slot] ?? null)}
              onClick={() => onPick(o.id)}
            />
          ))}
        </div>
        <button type="button" className="mcr__nav" aria-label="Suivant" onClick={() => onCycle(1)}>▶</button>
      </div>
      <p className="mcr__count">
        {String(i + 1).padStart(2, "0")} / {String(options.length).padStart(2, "0")}
        <span className="mcr__countName">{options[i]?.label}</span>
      </p>
    </section>
  );
}

/** Rangée compacte des autres emplacements de l'onglet. */
function CompactRow({ slot, selection, onOpen, onCycle, onPick }: {
  slot: BodySlot;
  selection: EditorSelection;
  onOpen: () => void;
  onCycle: (d: 1 | -1) => void;
  onPick: (id: string | null) => void;
}) {
  const options = useMemo(() => optionsForSlot(slot, selection.gender), [slot, selection.gender]);
  const i = currentIndex(options, selection.equipped[slot]);
  const debut = windowAround(options.length, i, ROW_WINDOW);
  const visibles = options.slice(debut, debut + ROW_WINDOW);

  return (
    <section className="mcr__row">
      <button type="button" className="mcr__rowHead" onClick={onOpen}>
        <span className="mcr__bigGlyph">{glyph(slot)}</span>
        {carouselLabel(slot)}
      </button>
      <div className="mcr__thumbs mcr__thumbs--sm">
        {visibles.map((o) => (
          <Thumb
            key={o.id ?? "__none"}
            option={o}
            slot={slot}
            selected={o.id === (selection.equipped[slot] ?? null)}
            onClick={() => onPick(o.id)}
          />
        ))}
      </div>
      <button
        type="button"
        className="mcr__nav mcr__nav--sm"
        aria-label={`${carouselLabel(slot)} — suivant`}
        onClick={() => onCycle(1)}
      >
        ▶
      </button>
    </section>
  );
}
