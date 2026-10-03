// ══════════════════════════════════════════════════════════════════════════════
// LootPanel — Interface de butin sur cadavre (style Skyrim futuriste)
//
// Vue partagée : liste d'objets à gauche, détails à droite, barre d'actions en bas.
// Le panneau gère un état local (items restants, crédits) et remonte les
// changements d'inventaire via onInventoryChange / onCreditsAdd.
// Double-clic = ramasser directement, "Tout Prendre" vide le cadavre.
// ══════════════════════════════════════════════════════════════════════════════

import { useState, useCallback, useMemo } from "react";
import type { LootItem } from "../loot/LootRegistry";
import { RARITY_COLOR } from "../loot/LootRegistry";
import type { InventoryState } from "../loot/Inventory";
import { addItem } from "../loot/Inventory";
import { canAdd, itemWeight } from "../loot/bags";
import styles from "./LootPanel.module.css";

/** Données du cadavre à fouiller. */
export interface CorpseLootData {
  label: string;
  items: LootItem[];
  credits: number;
}

export interface LootPanelProps {
  corpse: CorpseLootData;
  inventory: InventoryState;
  onInventoryChange: (inv: InventoryState) => void;
  onClose: () => void;
  onCreditsAdd?: (amount: number) => void;
}

export function LootPanel({
  corpse,
  inventory,
  onInventoryChange,
  onClose,
  onCreditsAdd,
}: LootPanelProps) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [items, setItems] = useState<LootItem[]>(() => [...corpse.items]);
  const [credits, setCredits] = useState(corpse.credits);
  const [closing, setClosing] = useState(false);

  const selected = selectedIdx !== null ? items[selectedIdx] ?? null : null;

  // ── Ramasser UN objet ────────────────────────────────────────────────────
  const handleTake = useCallback(
    (idx: number) => {
      const item = items[idx];
      if (!item || !canAdd(inventory, item)) return;

      const next = addItem(inventory, item);
      onInventoryChange(next);
      setItems((prev) => prev.filter((_, i) => i !== idx));

      if (selectedIdx === idx) {
        setSelectedIdx(null);
      } else if (selectedIdx !== null && selectedIdx > idx) {
        setSelectedIdx(selectedIdx - 1);
      }
    },
    [items, inventory, onInventoryChange, selectedIdx],
  );

  // ── Tout prendre ─────────────────────────────────────────────────────────
  const handleTakeAll = useCallback(() => {
    let inv = inventory;
    const remaining: LootItem[] = [];

    for (const item of items) {
      if (canAdd(inv, item)) {
        inv = addItem(inv, item);
      } else {
        remaining.push(item);
      }
    }

    onInventoryChange(inv);

    if (credits > 0) {
      onCreditsAdd?.(credits);
      setCredits(0);
    }

    setItems(remaining);
    setSelectedIdx(null);

    if (remaining.length === 0) {
      handleClose();
    }
  }, [items, inventory, credits, onInventoryChange, onCreditsAdd]);

  // ── Ramasser les crédits ─────────────────────────────────────────────────
  const handleTakeCredits = useCallback(() => {
    if (credits <= 0) return;
    onCreditsAdd?.(credits);
    setCredits(0);
  }, [credits, onCreditsAdd]);

  // ── Fermeture animée ─────────────────────────────────────────────────────
  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(onClose, 250);
  }, [onClose]);

  // ── Groupage par id + comptage ───────────────────────────────────────────
  const grouped = useMemo(() => {
    const map = new Map<string, { item: LootItem; indices: number[] }>();
    items.forEach((item, i) => {
      const entry = map.get(item.id);
      if (entry) {
        entry.indices.push(i);
      } else {
        map.set(item.id, { item, indices: [i] });
      }
    });
    return [...map.values()];
  }, [items]);

  return (
    <div
      className={`${styles.overlay} ${closing ? styles.closing : ""}`}
      onClick={handleClose}
    >
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        {/* ── Barre de titre ──────────────────────────────────────────── */}
        <div className={styles.titleBar}>
          <span className={styles.corpseTitle}>{corpse.label}</span>
          <button className={styles.closeBtn} onClick={handleClose}>
            &#x2715;
          </button>
        </div>

        {/* ── Colonnes : liste + détails ──────────────────────────────── */}
        <div className={styles.columns}>
          {/* Colonne gauche : objets du cadavre */}
          <div className={styles.itemList}>
            {credits > 0 && (
              <div className={styles.itemRow} onClick={handleTakeCredits}>
                <span className={styles.itemIcon}>&#x1F4B0;</span>
                <span className={styles.itemName}>
                  Cr&eacute;dits
                </span>
                <span className={styles.itemWeight}>{credits}</span>
              </div>
            )}

            {grouped.length === 0 && credits <= 0 && (
              <div className={styles.emptyMsg}>Cadavre vide</div>
            )}

            {grouped.map(({ item, indices }) => {
              const isSelected =
                selectedIdx !== null && indices.includes(selectedIdx);
              return (
                <div
                  key={item.id}
                  className={`${styles.itemRow} ${isSelected ? styles.selected : ""}`}
                  style={{
                    borderLeftColor: RARITY_COLOR[item.rarity] ?? "#666",
                  }}
                  onClick={() => setSelectedIdx(indices[0])}
                  onDoubleClick={() => handleTake(indices[0])}
                >
                  <span className={styles.itemIcon}>{item.icon}</span>
                  <span className={styles.itemName}>{item.label}</span>
                  {indices.length > 1 && (
                    <span className={styles.itemQty}>
                      x{indices.length}
                    </span>
                  )}
                  <span className={styles.itemWeight}>
                    {itemWeight(item).toFixed(1)} kg
                  </span>
                </div>
              );
            })}
          </div>

          {/* Colonne droite : détails de l'objet sélectionné */}
          <div className={styles.detailPane}>
            {selected ? (
              <>
                <div className={styles.detailName}>{selected.label}</div>

                <div
                  className={styles.detailRarity}
                  style={{ color: RARITY_COLOR[selected.rarity] }}
                >
                  {selected.rarity.toUpperCase()}
                </div>

                {selected.category && (
                  <div className={styles.detailCategory}>
                    {selected.category}
                  </div>
                )}

                {Object.entries(selected.statBonus).length > 0 && (
                  <div className={styles.detailStats}>
                    {Object.entries(selected.statBonus).map(([k, v]) => (
                      <div key={k} className={styles.statRow}>
                        <span>{k}</span>
                        <span
                          style={{
                            color:
                              (v as number) > 0 ? "#4ade80" : "#f87171",
                          }}
                        >
                          {(v as number) > 0 ? "+" : ""}
                          {v}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {selected.useEffect && (
                  <div className={styles.detailStats}>
                    {selected.useEffect.heal && (
                      <div className={styles.statRow}>
                        <span>Soin</span>
                        <span style={{ color: "#4ade80" }}>
                          +{selected.useEffect.heal}
                        </span>
                      </div>
                    )}
                    {selected.useEffect.mana && (
                      <div className={styles.statRow}>
                        <span>Mana</span>
                        <span style={{ color: "#38bdf8" }}>
                          +{selected.useEffect.mana}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <div className={styles.detailValue}>
                  &#x1F4B0; {selected.value} cr&eacute;dits
                </div>
                <div className={styles.detailValue}>
                  &#x2696;&#xFE0F; {itemWeight(selected).toFixed(1)} kg
                </div>
              </>
            ) : (
              <div className={styles.emptyMsg}>
                S&eacute;lectionne un objet
              </div>
            )}
          </div>
        </div>

        {/* ── Barre d'actions ─────────────────────────────────────────── */}
        <div className={styles.actionBar}>
          <button
            className={styles.actionBtn}
            disabled={selectedIdx === null}
            onClick={() => selectedIdx !== null && handleTake(selectedIdx)}
          >
            PRENDRE
          </button>
          <button
            className={styles.actionBtnPrimary}
            onClick={handleTakeAll}
          >
            TOUT PRENDRE
          </button>
          <button className={styles.actionBtn} onClick={handleClose}>
            FERMER
          </button>
        </div>
      </div>
    </div>
  );
}
