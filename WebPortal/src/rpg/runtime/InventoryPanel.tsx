// ══════════════════════════════════════════════════════════════════════════════
// runtime/InventoryPanel.tsx — Inventaire MMORPG plein écran (style HTML fourni)
//
// • Thème cyan sci-fi (glass + glow), topbar + onglets + recherche
// • Gauche : équipement (slots SVG) + bonus + capacité (poids/slots)
// • Droite : sac (grille d'objets) — stacks, raretés, tooltip détaillé
// • Interactions :
//   - Double-clic = équiper (équipable) OU utiliser (consommable)
//   - Bouton "UTILISER" affiché sur les items consommables
//   - Clic slot équipé = déséquiper
//   - Clic droit = assigner aux slots 4/5/6
//   - DRAG & DROP entre équipement / sac
// ══════════════════════════════════════════════════════════════════════════════

import { useMemo, useRef, useState } from "react";
import { X, Search, Coins, Zap, FlaskConical, Gem, PersonStanding } from "lucide-react";
import type { InventoryState } from "../loot/Inventory";
import { SLOT_LABELS } from "../characters/modular/bodySlots";
import { equipItem, unequipItem } from "../loot/Inventory";
import { consumableSlotsStore } from "../loot/consumableSlots";
import { GEAR_SLOTS, categoryOf, CATEGORY_LABELS, equippedBonuses, type ItemCategory, type GearSlotKey } from "../loot/gear";
import { RARITY_COLOR, type LootItem } from "../loot/LootRegistry";
import { ItemIcon, SlotIcon } from "./itemIcons";
import { maxSlots, maxWeight, usedSlots, usedWeight, itemWeight } from "../loot/bags";

const CYAN = "#22d3ee";
const GREEN = "#4ade80";
const STAT_LABEL: Record<string, string> = {
  maxHp: "PV max", maxMana: "Énergie max", maxShield: "Bouclier max",
  puissance: "Puissance", defense: "Défense", critique: "Critique %",
  cdr: "Réduc. cooldown %", maxStamina: "Endurance max",
};
/**
 * `composition` n'est PAS une `ItemCategory` : les pièces modulaires se
 * répartissent déjà entre `equipment` (un blouson) et `material` (une tête,
 * faute d'emplacement RPG). L'onglet filtre sur la présence de `bodySlot`, pas
 * sur une catégorie — sinon il faudrait déplacer les blousons hors d'Équipement.
 */
type Tab = "all" | ItemCategory | "composition";
const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "all",         label: "Tout",        icon: <Gem size={13} /> },
  { id: "equipment",   label: "Équipement",  icon: <SlotIcon slot="armor" size={13} /> },
  { id: "composition", label: "Composition", icon: <PersonStanding size={13} /> },
  { id: "consumable",  label: "Consommables",icon: <FlaskConical size={13} /> },
  { id: "material",    label: "Matériaux",   icon: <Zap size={13} /> },
  { id: "resource",    label: "Ressources",  icon: <Gem size={13} /> },
];

/**
 * Un objet appartient-il à l'onglet courant ?
 *
 * `composition` sort du modèle de catégories : il retient tout ce qui porte un
 * `bodySlot`, quelle que soit la catégorie déclarée. Un blouson apparaît donc
 * dans Équipement ET dans Composition — c'est voulu, il est les deux à la fois.
 */
function matchesTab(item: LootItem, tab: Tab): boolean {
  if (tab === "all") return true;
  if (tab === "composition") return Boolean(item.bodySlot);
  return categoryOf(item) === tab;
}

interface Props {
  inventory: InventoryState;
  onChange: (inv: InventoryState) => void;
  onClose: () => void;
  /** Appelé pour consommer un item (potions). Si absent → fallback équiper si possible. */
  onUseItem?: (itemId: string) => void;
}

type DragSrc = { from: "bag"; id: string } | { from: "equip"; slot: GearSlotKey } | null;

// ── Tooltip contextuel (hover item) ─────────────────────────────────────────
function ItemTooltip({ item, x, y, onUse, canUse }: {
  item: LootItem; x: number; y: number;
  onUse?: () => void;
  canUse?: boolean;
}) {
  const isConsumable = !!item.useEffect;
  const rarityCol = RARITY_COLOR[item.rarity];

  // Effets du useEffect lisibles
  const effects: string[] = [];
  if (item.useEffect?.heal)         effects.push(`+${item.useEffect.heal} PV`);
  if (item.useEffect?.mana)         effects.push(`+${item.useEffect.mana} MP`);
  if (item.useEffect?.summonVehicle) effects.push(`Invoque un véhicule`);
  if (item.useEffect?.repairVehicle) effects.push(`Répare le véhicule à 100%`);

  return (
    <div style={{
      position: "fixed",
      left: Math.min(x + 16, window.innerWidth - 240),
      top: Math.min(y + 14, window.innerHeight - 260),
      zIndex: 90, width: 224, pointerEvents: "auto",
      background: "rgba(3,5,12,0.97)",
      border: `1px solid ${rarityCol}`,
      borderRadius: 12, padding: "12px 14px",
      boxShadow: `0 0 20px ${rarityCol}55, 0 0 40px rgba(0,0,0,0.8)`,
    }}>
      {/* Titre */}
      <div style={{ color: rarityCol, fontWeight: 800, fontSize: 14, marginBottom: 2, fontFamily: "var(--nv-font-display)" }}>
        {item.icon} {item.label}
      </div>
      <div style={{ color: "var(--nv-text-faint)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8, fontFamily: "var(--nv-font-mono)" }}>
        {item.rarity}{item.slot ? " · équipement" : ` · ${CATEGORY_LABELS[categoryOf(item)]}`}
      </div>

      {/* Provenance et emplacement de composition — une pièce sans `slot` RPG
          n'a autrement AUCUNE indication de l'endroit où elle se monte. */}
      {item.bodySlot && (
        <div style={{ color: CYAN, fontSize: 10, letterSpacing: "0.08em", marginBottom: 8, fontFamily: "var(--nv-font-mono)" }}>
          {SLOT_LABELS[item.bodySlot]}
          {item.source && item.source !== "biker" ? ` · ${item.source}` : ""}
          {!item.slot && " · éditeur de personnage"}
        </div>
      )}

      {/* Bonus stats */}
      {Object.keys(item.statBonus).length > 0 && (
        <div style={{ marginBottom: 8, display: "flex", flexDirection: "column", gap: 3 }}>
          {Object.entries(item.statBonus).map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
              <span style={{ color: "#94a3b8" }}>{STAT_LABEL[k] ?? k}</span>
              <span style={{ color: GREEN, fontWeight: 700 }}>+{v}</span>
            </div>
          ))}
        </div>
      )}

      {/* Effets consommable */}
      {effects.length > 0 && (
        <div style={{ marginBottom: 8, background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 6, padding: "6px 8px" }}>
          <div style={{ fontSize: 10, color: "#4ade80", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4, fontWeight: 700 }}>Effet</div>
          {effects.map((eff, i) => (
            <div key={i} style={{ fontSize: 12, color: "#86efac", fontWeight: 600 }}>✦ {eff}</div>
          ))}
        </div>
      )}

      {/* Poids + valeur */}
      <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94a3b8" }}>
        <span>Poids : {itemWeight(item)} kg</span>
        <span style={{ color: "#ffcc4d", display: "flex", alignItems: "center", gap: 3 }}>
          {item.value} <Coins size={11} />
        </span>
      </div>

      {/* Aide contextuelle */}
      {isConsumable && onUse ? (
        <button
          onClick={onUse}
          style={{
            marginTop: 10, width: "100%", padding: "7px 0", borderRadius: 8,
            background: canUse ? "linear-gradient(180deg,#16a34a,#15803d)" : "rgba(255,255,255,0.05)",
            border: `1px solid ${canUse ? "#4ade80" : "rgba(255,255,255,0.1)"}`,
            color: canUse ? "#fff" : "#6b7a90", fontSize: 12, fontWeight: 700,
            cursor: canUse ? "pointer" : "not-allowed",
            letterSpacing: "0.1em", textTransform: "uppercase",
            boxShadow: canUse ? "0 0 14px rgba(74,222,128,0.4)" : "none",
          }}
        >
          {canUse ? "✦ Utiliser" : "Déjà au max"}
        </button>
      ) : item.slot ? (
        <div style={{ marginTop: 6, color: CYAN, fontSize: 10 }}>Double-clic / glisser pour équiper</div>
      ) : null}
    </div>
  );
}

export function InventoryPanel({ inventory, onChange, onClose, onUseItem }: Props) {
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [hover, setHover] = useState<{ item: LootItem; x: number; y: number } | null>(null);
  const [selected, setSelected] = useState<LootItem | null>(null);
  const dragRef = useRef<DragSrc>(null);

  // Sac : filtré (catégorie + recherche) puis empilé par id, trié par rareté.
  const stacks = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = inventory.items.filter((it) =>
      matchesTab(it, tab) && (!q || it.label.toLowerCase().includes(q))
    );
    const map = new Map<string, { item: LootItem; count: number }>();
    for (const it of filtered) {
      const g = map.get(it.id);
      if (g) g.count++; else map.set(it.id, { item: it, count: 1 });
    }
    const order: Record<string, number> = { divine: 7, mythic: 6, legendary: 5, alien: 4, epic: 3, rare: 2, common: 1 };
    return [...map.values()].sort((a, b) =>
      (order[b.item.rarity] ?? 0) - (order[a.item.rarity] ?? 0) || a.item.label.localeCompare(b.item.label)
    );
  }, [inventory.items, tab, query]);

  const bonuses = equippedBonuses(inventory.equipped);
  const w = usedWeight(inventory), wMax = maxWeight(inventory);
  const s = usedSlots(inventory), sMax = maxSlots(inventory);
  const overweight = w > wMax;

  const onDropEquip = () => { if (dragRef.current?.from === "bag") onChange(equipItem(inventory, dragRef.current.id)); dragRef.current = null; };
  const onDropBag   = () => { if (dragRef.current?.from === "equip") onChange(unequipItem(inventory, dragRef.current.slot)); dragRef.current = null; };

  const handleUseHovered = (item: LootItem) => {
    if (item.useEffect && onUseItem) {
      onUseItem(item.id);
      setHover(null);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 70, background: "#04060c", display: "flex", flexDirection: "column", color: "#cbd5e1", fontFamily: "Inter, system-ui, sans-serif", pointerEvents: "auto" }}>
      <style>{`
        @keyframes invSlotIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulseGreen{0%,100%{box-shadow:0 0 8px rgba(74,222,128,0.3)}50%{box-shadow:0 0 16px rgba(74,222,128,0.7)}}
        .inv-consumable-btn:hover { background: rgba(74,222,128,0.18) !important; transform: scale(1.03); }
        .inv-item-btn:hover { transform: scale(1.05); filter: brightness(1.2); }
      `}</style>

      {/* radial ambiance */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: `radial-gradient(900px 600px at 18% 12%, ${CYAN}1a, transparent 55%), radial-gradient(700px 500px at 85% 20%, ${CYAN}0d, transparent 50%)` }} />
      {/* scanline overlay */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.03, backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.08) 2px, rgba(255,255,255,0.08) 4px)", mixBlendMode: "overlay" }} />

      {/* Topbar */}
      <header style={{ position: "relative", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 26px", borderBottom: "1px solid var(--nv-border)", background: "linear-gradient(180deg, rgba(8,12,20,0.92), var(--nv-bg-deep))", backdropFilter: "blur(6px)" }}>
        <div style={{ color: "var(--nv-accent)", fontSize: 22, letterSpacing: 6, fontWeight: 800, textTransform: "uppercase", fontFamily: "var(--nv-font-display)", textShadow: `0 0 28px ${CYAN}66, 0 0 6px ${CYAN}33` }}>
          Inventaire
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 7, color: "var(--nv-gold)", fontWeight: 700, fontSize: 15, padding: "5px 12px", background: "rgba(217,178,90,0.06)", border: "1px solid rgba(217,178,90,0.2)", borderRadius: 6, fontFamily: "var(--nv-font-mono)" }}>
            <Coins size={15} /> {inventory.credits}
          </span>
          <div style={{ color: "var(--nv-text-dim)", fontSize: 11, padding: "5px 10px", background: "var(--nv-bg-panel)", border: "1px solid var(--nv-border-dim)", borderRadius: 4, fontFamily: "var(--nv-font-mono)" }}>
            {s}/{sMax}
          </div>
          <button onClick={onClose} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 4, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", cursor: "pointer", color: "var(--nv-text)", background: "var(--nv-bg-panel)", border: "1px solid var(--nv-border-dim)", fontFamily: "var(--nv-font-display)", transition: "var(--nv-transition)" }}>
            <X size={14} /> Fermer
          </button>
        </div>
      </header>

      {/* Subbar : onglets + recherche */}
      <nav style={{ position: "relative", height: 50, display: "flex", alignItems: "center", gap: 12, padding: "0 26px", borderBottom: "1px solid var(--nv-border-dim)", background: "var(--nv-bg-deep)" }}>
        <div style={{ display: "flex", gap: 4 }}>
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "7px 13px", borderRadius: 3, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700, cursor: "pointer",
              fontFamily: "var(--nv-font-display)",
              border: `1px solid ${tab === t.id ? `${CYAN}55` : "transparent"}`,
              background: tab === t.id ? `linear-gradient(180deg, ${CYAN}22, ${CYAN}0a)` : "transparent",
              color: tab === t.id ? CYAN : "var(--nv-text-faint)",
              boxShadow: tab === t.id ? `0 0 12px ${CYAN}22, inset 0 1px 0 ${CYAN}33` : "none",
              transition: "var(--nv-transition)",
            }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: "auto", position: "relative", display: "flex", alignItems: "center" }}>
          <Search size={14} color="var(--nv-text-faint)" style={{ position: "absolute", left: 11 }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher…"
            style={{ background: "var(--nv-bg-panel)", border: "1px solid var(--nv-border-dim)", borderRadius: 4, padding: "8px 12px 8px 32px", color: "var(--nv-text)", fontSize: 12, width: 220, outline: "none", fontFamily: "var(--nv-font-body)" }} />
        </div>
      </nav>

      {/* Aide rapide */}
      <div style={{ padding: "5px 26px", background: "var(--nv-bg-deep)", borderBottom: "1px solid var(--nv-border-dim)", fontSize: 10, color: "var(--nv-text-faint)", display: "flex", gap: 16, fontFamily: "var(--nv-font-mono)" }}>
        <span><b style={{ color: "var(--nv-text-dim)" }}>2x clic</b> utiliser/équiper</span>
        <span><b style={{ color: "var(--nv-text-dim)" }}>Clic droit</b> slots rapides 4/5/6</span>
        <span><b style={{ color: "var(--nv-text-dim)" }}>R</b> medikit &nbsp;|&nbsp; <b style={{ color: "var(--nv-text-dim)" }}>T</b> recharge énergie</span>
      </div>

      {/* Main */}
      <main style={{ position: "relative", flex: 1, display: "flex", gap: 28, padding: 26, minHeight: 0, overflow: "hidden" }}>

        {/* ── Gauche : équipement + bonus + capacité ──────────────────────── */}
        <section style={{ width: 360, flexShrink: 0, display: "flex", flexDirection: "column", background: "linear-gradient(180deg, var(--nv-bg-panel), var(--nv-bg-deep))", border: "1px solid var(--nv-border)", clipPath: "var(--nv-clip-panel)", padding: "22px 20px", overflow: "auto" }}
          onDragOver={(e) => e.preventDefault()} onDrop={onDropEquip}>
          <div style={{ fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--nv-accent)", fontWeight: 700, marginBottom: 14, fontFamily: "var(--nv-font-display)" }}>Équipement porté</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {GEAR_SLOTS.map((slot, i) => {
              const item = inventory.equipped[slot.key];
              return (
                <button key={slot.key}
                  draggable={!!item}
                  onDragStart={() => { if (item) dragRef.current = { from: "equip", slot: slot.key }; }}
                  onClick={() => item && onChange(unequipItem(inventory, slot.key))}
                  onMouseEnter={(e) => item && setHover({ item, x: e.clientX, y: e.clientY })}
                  onMouseMove={(e) => item && setHover({ item, x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setHover(null)}
                  title={item ? `${item.label} — clic/glisser pour retirer` : slot.label}
                  style={{
                    position: "relative", height: 78, borderRadius: 12, cursor: item ? "pointer" : "default",
                    border: `1px solid ${item ? RARITY_COLOR[item.rarity] : `${CYAN}26`}`,
                    background: item ? `${RARITY_COLOR[item.rarity]}14` : "rgba(15,20,30,0.7)",
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5,
                    color: item ? RARITY_COLOR[item.rarity] : "#6b7a90",
                    boxShadow: item ? `0 0 12px ${RARITY_COLOR[item.rarity]}33, inset 0 0 16px rgba(0,0,0,0.5)` : "inset 0 0 16px rgba(0,0,0,0.5)",
                    opacity: 0, animation: `invSlotIn .4s ease forwards ${0.03 * i}s`,
                    transition: "transform 0.1s",
                  }}>
                  {item ? <ItemIcon item={item} size={30} /> : <SlotIcon slot={slot.accepts} size={26} />}
                  <span style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: 0.5, color: item ? RARITY_COLOR[item.rarity] : "#7a889c", fontWeight: 600 }}>{slot.label}</span>
                </button>
              );
            })}
          </div>

          {/* Capacité */}
          <div style={{ marginTop: 22, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <CapBar label="Poids" value={w} max={wMax} unit=" kg" over={overweight} color={overweight ? "#f87171" : CYAN} />
            <div style={{ height: 10 }} />
            <CapBar label="Emplacements" value={s} max={sMax} unit="" over={s >= sMax} color={s >= sMax ? "#fbbf24" : CYAN} />
          </div>

          {/* Bonus d'équipement */}
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--nv-accent)", fontWeight: 700, marginBottom: 8, fontFamily: "var(--nv-font-display)" }}>Bonus d'équipement</div>
            {Object.keys(bonuses).length === 0
              ? <div style={{ color: "#5a6575", fontSize: 13 }}>Aucun objet équipé</div>
              : <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {Object.entries(bonuses).map(([k, v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                      <span style={{ color: "#94a3b8" }}>{STAT_LABEL[k] ?? k}</span>
                      <span style={{ color: GREEN, fontWeight: 700 }}>+{v}</span>
                    </div>
                  ))}
                </div>}
          </div>
        </section>

        {/* ── Droite : sac (grille) ───────────────────────────────────────── */}
        <section style={{ flex: 1, background: "linear-gradient(180deg, var(--nv-bg-panel), var(--nv-bg-deep))", border: "1px solid var(--nv-border-dim)", clipPath: "var(--nv-clip-panel)", padding: 18, overflow: "auto" }}
          onDragOver={(e) => e.preventDefault()} onDrop={onDropBag}>

          {stacks.length === 0
            ? <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: "var(--nv-text-faint)", fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase", fontFamily: "var(--nv-font-display)" }}>
                <FlaskConical size={36} color="var(--nv-accent-dim)" />
                Stockage vide
              </div>
            : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))", gap: 10, alignContent: "start" }}>
                {stacks.map(({ item, count }, i) => {
                  const slotColor = item.color ?? RARITY_COLOR[item.rarity] ?? '#444';
                  const isConsumable = !!item.useEffect;

                  return (
                    <div key={item.id} style={{ position: "relative", aspectRatio: "1" }}>
                      <button
                        className="inv-item-btn"
                        draggable
                        onDragStart={() => { dragRef.current = { from: "bag", id: item.id }; }}
                        onDoubleClick={() => {
                          if (item.useEffect && onUseItem) { onUseItem(item.id); setHover(null); }
                          else if (item.slot)              onChange(equipItem(inventory, item.id));
                        }}
                        onContextMenu={(e) => {
                          if (!item.useEffect) return;
                          e.preventDefault();
                          const choice = window.prompt(
                            `Assigner "${item.label}" à quel slot rapide ?\n\nTouche 4 = slot 1\nTouche 5 = slot 2\nTouche 6 = slot 3\n\nTape 1, 2 ou 3 (vide pour annuler) :`,
                            "1"
                          );
                          const slot = choice === "1" ? 0 : choice === "2" ? 1 : choice === "3" ? 2 : null;
                          if (slot !== null) consumableSlotsStore.setSlot(slot as 0 | 1 | 2, item.id);
                        }}
                        onMouseEnter={(e) => setHover({ item, x: e.clientX, y: e.clientY })}
                        onMouseMove={(e) => setHover({ item, x: e.clientX, y: e.clientY })}
                        onMouseLeave={() => setHover(null)}
                        style={{
                          width: "100%", height: "100%",
                          position: "relative", borderRadius: 10, cursor: "grab",
                          border: `1px solid ${isConsumable ? "rgba(74,222,128,0.5)" : slotColor}`,
                          background: isConsumable
                            ? `linear-gradient(135deg, rgba(74,222,128,0.06) 0%, ${slotColor}08 100%)`
                            : `${slotColor}12`,
                          color: slotColor,
                          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                          boxShadow: isConsumable
                            ? `inset 0 0 14px rgba(0,0,0,0.5), 0 0 8px rgba(74,222,128,0.15)`
                            : `inset 0 0 14px rgba(0,0,0,0.5)`,
                          opacity: 0, animation: `invSlotIn .35s ease forwards ${0.02 * i}s`,
                          transition: "transform 0.1s, filter 0.1s",
                        }}>
                        <ItemIcon item={item} size={36} />
                        {count > 1 && <span style={{ position: "absolute", bottom: 2, right: 5, fontSize: 11, fontWeight: 800, color: "#fff", textShadow: "0 1px 2px #000" }}>{count}</span>}
                        {item.slot && <span style={{ position: "absolute", top: 3, left: 4, width: 5, height: 5, borderRadius: "50%", background: CYAN, boxShadow: `0 0 6px ${CYAN}` }} title="Équipable" />}
                        {isConsumable && <span style={{ position: "absolute", top: 3, right: 4, width: 5, height: 5, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 6px #4ade80" }} title="Consommable" />}
                      </button>

                      {/* Bouton USE direct sous l'item (visible seulement pour les consommables) */}
                      {isConsumable && onUseItem && (
                        <button
                          className="inv-consumable-btn"
                          onClick={(e) => { e.stopPropagation(); onUseItem(item.id); setHover(null); }}
                          onMouseEnter={() => setHover(null)} // masque le tooltip pendant le hover du bouton
                          style={{
                            position: "absolute", bottom: -22, left: 0, right: 0,
                            fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em",
                            padding: "3px 0", borderRadius: "0 0 8px 8px",
                            background: "rgba(74,222,128,0.12)",
                            border: "1px solid rgba(74,222,128,0.3)",
                            borderTop: "none",
                            color: "#4ade80", cursor: "pointer",
                            transition: "background 0.15s",
                          }}>
                          ✦ USE
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>}
        </section>
      </main>

      {/* Tooltip détaillé (hover) */}
      {hover && (
        <ItemTooltip
          item={hover.item}
          x={hover.x}
          y={hover.y}
          onUse={hover.item.useEffect && onUseItem ? () => handleUseHovered(hover.item) : undefined}
          canUse={!!(hover.item.useEffect && onUseItem)}
        />
      )}
    </div>
  );
}

function CapBar({ label, value, max, unit, over, color }: { label: string; value: number; max: number; unit: string; over: boolean; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
        <span style={{ color: "#7a889c" }}>{label}</span>
        <span style={{ color: over ? "#f87171" : "#cbd5e1", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{value}/{max}{unit}</span>
      </div>
      <div style={{ height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, boxShadow: `0 0 8px ${color}99`, transition: "width .2s" }} />
      </div>
    </div>
  );
}
