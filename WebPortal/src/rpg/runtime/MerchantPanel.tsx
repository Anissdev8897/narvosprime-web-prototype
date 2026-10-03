// ══════════════════════════════════════════════════════════════════════════════
// runtime/MerchantPanel.tsx — Interface marchande (achat / vente)
//
// Onglet Acheter : stock du marchand, prix dynamiques par rareté, quantité.
// Onglet Vendre  : inventaire joueur (empilé), prix de revente × buyFactor.
// ══════════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from "react";
import { X, ShoppingCart, Coins, Plus, Minus, Store } from "lucide-react";
import type { InventoryState } from "../loot/Inventory";
import { addItem, addCredits, buyBag } from "../loot/Inventory";
import { BAGS } from "../loot/bags";
import { RARITY_COLOR, type LootItem } from "../loot/LootRegistry";
import { categoryOf, CATEGORY_LABELS } from "../loot/gear";
import { lootIcon } from "../loaders/launcherAssets";
import { type MerchantDef, merchantStock, buyPrice, sellPrice } from "../npc/merchants";
import { WEAPON_CATEGORY_BY_ID } from "../weapons/weaponShop";
import { ammoStore } from "../combat/ammoStore";
import { reputationStore } from "../reputation/reputationStore";
import { REP_GAINS } from "../reputation/reputationCatalog";
import { getNpc } from "../npc/npcCatalog";

const ACCENT = "#fbbf24";

interface Props {
  merchant: MerchantDef;
  inventory: InventoryState;
  onChange: (inv: InventoryState) => void;
  onClose: () => void;
}

export function MerchantPanel({ merchant, inventory, onChange, onClose }: Props) {
  const [tab, setTab] = useState<"buy" | "sell" | "bags">("buy");
  const [qty, setQty] = useState(1);
  const stock = useMemo(() => merchantStock(merchant), [merchant]);
  const sellsBags = merchant.type === "general"; // le Bazar Général vend des sacs

  // Stock GROUPÉ par catégorie (Épées / Haches / Arcs / Bâtons / Armes futuristes / …).
  // Armes du catalogue 3D → leur catégorie d'arme ; munitions → "Munitions" ; le reste →
  // catégorie d'inventaire générique. Sections triées, "Divers" en dernier.
  const stockGroups = useMemo(() => {
    const groups = new Map<string, LootItem[]>();
    for (const item of stock) {
      const cat = WEAPON_CATEGORY_BY_ID[item.id]
        ?? (item.useEffect?.addAmmo ? "Munitions"
          : item.slot ? "Équipement"
            : CATEGORY_LABELS[categoryOf(item)] ?? "Divers");
      (groups.get(cat) ?? groups.set(cat, []).get(cat)!).push(item);
    }
    return [...groups.entries()].sort(([a], [b]) =>
      (a === "Divers" ? 1 : 0) - (b === "Divers" ? 1 : 0) || a.localeCompare(b, "fr"));
  }, [stock]);

  // Inventaire joueur empilé (pour la vente).
  const sellStacks = useMemo(() => {
    const map = new Map<string, { item: LootItem; count: number }>();
    for (const it of inventory.items) {
      const g = map.get(it.id);
      if (g) g.count++; else map.set(it.id, { item: it, count: 1 });
    }
    return [...map.values()];
  }, [inventory.items]);

  const buy = (item: LootItem) => {
    const total = buyPrice(item) * qty;
    if (inventory.credits < total) return;
    const fid = getNpc(merchant.folder)?.factionId;
    if (fid) reputationStore.gain(fid, REP_GAINS.MERCHANT_TRADE * qty);
    const ammo = item.useEffect?.addAmmo;
    if (ammo) {
      ammoStore.add(ammo.kind, ammo.count * qty);
      onChange(addCredits(inventory, -total));
      return;
    }
    let inv = addCredits(inventory, -total);
    for (let i = 0; i < qty; i++) inv = addItem(inv, item);
    onChange(inv);
  };
  const sell = (itemId: string) => {
    const idx = inventory.items.findIndex((i) => i.id === itemId);
    if (idx < 0) return;
    const item = inventory.items[idx];
    const items = inventory.items.slice();
    items.splice(idx, 1);
    onChange({ ...inventory, items, credits: inventory.credits + sellPrice(item, merchant.buyFactor) });
  };

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 70, display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(2,3,10,0.8)", backdropFilter: "blur(4px)",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 720, maxWidth: "94vw", height: 540, maxHeight: "88vh", display: "flex", flexDirection: "column",
        background: "rgba(7,6,3,0.96)", border: `1px solid ${ACCENT}66`, borderRadius: 16, boxShadow: `0 0 40px ${ACCENT}33`, padding: 22,
      }}>
        {/* En-tête : marchand + dialogue */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: `${ACCENT}22`, border: `1px solid ${ACCENT}66`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Store size={24} color={ACCENT} />
            </div>
            <div>
              <div style={{ color: ACCENT, fontWeight: 900, fontSize: 18, letterSpacing: "0.05em" }}>{merchant.name}</div>
              <div style={{ color: "#a8a29e", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.15em" }}>{merchant.subtitle}</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ color: ACCENT, fontWeight: 800, display: "flex", alignItems: "center", gap: 6 }}><Coins size={16} /> {inventory.credits}</span>
            <button onClick={onClose} style={btn()}><X size={16} /> Fermer</button>
          </div>
        </div>
        <div style={{ color: "#d6d3d1", fontStyle: "italic", fontSize: 13, marginBottom: 16, paddingLeft: 4, borderLeft: `2px solid ${ACCENT}66` }}>
          « {merchant.greeting} »
        </div>

        {/* Onglets + quantité */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          {(sellsBags ? (["buy", "sell", "bags"] as const) : (["buy", "sell"] as const)).map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "8px 16px", borderRadius: 8, fontWeight: 800, fontSize: 12, textTransform: "uppercase", cursor: "pointer",
              border: `1px solid ${tab === t ? ACCENT : "#ffffff18"}`, background: tab === t ? `${ACCENT}22` : "transparent",
              color: tab === t ? ACCENT : "#a8a29e",
            }}>{t === "buy" ? "Acheter" : t === "sell" ? "Vendre" : "Sacs"}</button>
          ))}
          {tab === "buy" && (
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "#a8a29e", fontSize: 12 }}>Quantité</span>
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} style={stepBtn()}><Minus size={14} /></button>
              <span style={{ minWidth: 28, textAlign: "center", fontWeight: 800, color: "#e7e5e4" }}>{qty}</span>
              <button onClick={() => setQty((q) => Math.min(99, q + 1))} style={stepBtn()}><Plus size={14} /></button>
            </div>
          )}
        </div>

        {/* Grille — onglet Acheter : stock GROUPÉ par catégorie (sections + sous-grilles) */}
        <div style={{ flex: 1, overflowY: "auto", display: tab === "buy" ? "block" : "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10, alignContent: "start" }}>
          {tab === "buy" && stockGroups.map(([cat, items]) => (
            <div key={cat} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: ACCENT, textTransform: "uppercase", letterSpacing: "0.18em", padding: "2px 2px 6px", borderBottom: `1px solid ${ACCENT}33`, marginBottom: 8 }}>
                {cat} <span style={{ color: "#78716c", fontWeight: 600 }}>({items.length})</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
                {items.map((item) => {
                  const price = buyPrice(item) * qty;
                  const afford = inventory.credits >= price;
                  return <Card key={item.id} item={item} icon={lootIcon(item.id)}>
                    <button onClick={() => buy(item)} disabled={!afford} style={tradeBtn(afford)}>
                      {price} <Coins size={11} />
                    </button>
                  </Card>;
                })}
              </div>
            </div>
          ))}
          {tab === "sell" && sellStacks.length === 0 && <div style={{ color: "#57534e", fontSize: 13, padding: 8 }}>Rien à vendre</div>}
          {tab === "sell" && sellStacks.map(({ item, count }) => (
            <Card key={item.id} item={item} icon={lootIcon(item.id)} count={count}>
              <button onClick={() => sell(item.id)} style={tradeBtn(true)}>
                Vendre {sellPrice(item, merchant.buyFactor)} <Coins size={11} />
              </button>
            </Card>
          ))}
          {tab === "bags" && Object.values(BAGS).map((bag) => {
            const owned = inventory.bagId === bag.id;
            const afford = inventory.credits >= bag.price && !owned;
            return (
              <div key={bag.id} style={{ padding: "12px 10px", borderRadius: 8, border: `1px solid ${ACCENT}55`, background: `${ACCENT}10`, display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
                <div style={{ fontSize: 28 }}>🎒</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#fde9c8", textAlign: "center" }}>{bag.label}</div>
                <div style={{ fontSize: 10, color: "#a8a29e", textAlign: "center" }}>+{bag.slots} slots · +{bag.weight} kg</div>
                <button
                  onClick={() => { const r = buyBag(inventory, bag.id); if (r) onChange(r); }}
                  disabled={!afford}
                  style={tradeBtn(afford)}
                >
                  {owned ? "Équipé" : <>{bag.price} <Coins size={11} /></>}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Card({ item, icon, count, children }: { item: LootItem; icon: string | null; count?: number; children: React.ReactNode }) {
  return (
    <div style={{ padding: "10px 8px", borderRadius: 8, border: `1px solid ${RARITY_COLOR[item.rarity]}`, background: `${RARITY_COLOR[item.rarity]}12`, display: "flex", flexDirection: "column", gap: 6, alignItems: "center", position: "relative" }}>
      {count && count > 1 && <span style={{ position: "absolute", top: 4, right: 6, fontSize: 11, fontWeight: 800, color: "#e7e5e4" }}>×{count}</span>}
      {icon ? <img src={icon} alt="" style={{ width: 34, height: 34, objectFit: "contain" }} onError={(e) => { e.currentTarget.style.display = "none"; }} /> : <span style={{ fontSize: 26 }}>{item.icon}</span>}
      <div style={{ fontSize: 11, fontWeight: 700, color: RARITY_COLOR[item.rarity], textAlign: "center", lineHeight: 1.1 }}>{item.label}</div>
      <div style={{ fontSize: 9, color: "#78716c", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {item.slot ? "Équipement" : CATEGORY_LABELS[categoryOf(item)]}
      </div>
      <div style={{ fontSize: 10, color: "#a8a29e", textAlign: "center", minHeight: 12 }}>
        {Object.entries(item.statBonus).map(([k, v]) => `+${v} ${k}`).join(" ")}
      </div>
      {children}
    </div>
  );
}

function btn(): React.CSSProperties {
  return { padding: "8px 14px", borderRadius: 10, fontWeight: 800, cursor: "pointer", fontSize: 12, border: `1px solid ${ACCENT}44`, background: "rgba(20,16,8,0.8)", color: "#fde9c8", display: "flex", alignItems: "center", gap: 8 };
}
function stepBtn(): React.CSSProperties {
  return { width: 26, height: 26, borderRadius: 6, cursor: "pointer", border: `1px solid ${ACCENT}55`, background: `${ACCENT}1a`, color: ACCENT, display: "flex", alignItems: "center", justifyContent: "center" };
}
function tradeBtn(enabled: boolean): React.CSSProperties {
  return { width: "100%", padding: "5px 6px", borderRadius: 6, fontWeight: 800, fontSize: 11, cursor: enabled ? "pointer" : "not-allowed", opacity: enabled ? 1 : 0.4, border: `1px solid ${ACCENT}66`, background: `${ACCENT}1a`, color: ACCENT, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 };
}
