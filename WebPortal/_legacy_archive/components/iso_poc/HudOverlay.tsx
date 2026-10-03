/**
 * HudOverlay.tsx - Overlay 2D au-dessus du Canvas pour afficher HP/PA/PM,
 * spell bar joueur, ordre de tour (timeline), etat combat.
 *
 * Pas dans le Canvas (donc pas dependant Three.js) — pur CSS/HTML.
 */

import type { CombatEntity, CombatState, Spell } from "./combat/CombatTypes";

interface HudOverlayProps {
  state: CombatState;
  /** Joueur principal (pour la spell bar). */
  playerEntityId: string | null;
  /** Spells indexes par id (de EntityRegistry). */
  spellsById: Record<string, Spell>;
  onSelectSpell?: (spellId: string | null) => void;
  onEndTurn?: () => void;
  onStartCombat?: () => void;
}

export function HudOverlay({
  state,
  playerEntityId,
  spellsById,
  onSelectSpell,
  onEndTurn,
  onStartCombat,
}: HudOverlayProps) {
  const player = playerEntityId ? state.entities[playerEntityId] : null;
  const currentEntity = state.timeline[state.turnIndex]
    ? state.entities[state.timeline[state.turnIndex]]
    : null;

  return (
    <>
      {/* TOP — Timeline / ordre de tour */}
      <Timeline state={state} />

      {/* TOP-LEFT — Etat combat */}
      <CombatStatusBox state={state} currentEntity={currentEntity} />

      {/* BOTTOM — Spell bar joueur + bouton end turn */}
      {player && (
        <PlayerActionBar
          player={player}
          isPlayerTurn={state.phase === "player_turn" && currentEntity?.id === player.id}
          spellsById={spellsById}
          selectedSpellId={state.selectedSpellId}
          onSelectSpell={onSelectSpell}
          onEndTurn={onEndTurn}
        />
      )}

      {/* BOTTOM-RIGHT — Bouton lancer combat */}
      {state.phase === "idle" && (
        <button
          onClick={onStartCombat}
          style={{
            position: "absolute",
            bottom: 24,
            right: 24,
            padding: "12px 22px",
            background: "rgba(123, 185, 255, 0.18)",
            color: "#cfe8ff",
            border: "1px solid #7df9ff",
            borderRadius: 8,
            fontFamily: "ui-monospace, monospace",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            backdropFilter: "blur(6px)",
            zIndex: 50,
          }}
        >
          Demarrer combat
        </button>
      )}
    </>
  );
}

/* =====================================================================
 * Sous-composants
 * ===================================================================== */

function Timeline({ state }: { state: CombatState }) {
  if (!state.timeline.length) return null;
  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        gap: 6,
        padding: "8px 12px",
        background: "rgba(11, 15, 21, 0.78)",
        border: "1px solid #2a3848",
        borderRadius: 8,
        backdropFilter: "blur(6px)",
        zIndex: 50,
      }}
    >
      {state.timeline.map((eid, i) => {
        const ent = state.entities[eid];
        if (!ent) return null;
        const active = i === state.turnIndex;
        const dead = ent.isDead || ent.stats.hp <= 0;
        return (
          <div
            key={eid}
            title={`${ent.name} — ${ent.stats.hp}/${ent.stats.hpMax} HP`}
            style={{
              padding: "4px 9px",
              background: active ? "rgba(125, 249, 255, 0.18)" : "rgba(15, 22, 35, 0.6)",
              border: active ? "1px solid #7df9ff" : "1px solid #2a3848",
              borderRadius: 6,
              color: dead ? "#666" : active ? "#7df9ff" : "#cfe8ff",
              fontSize: 11,
              fontFamily: "ui-monospace, monospace",
              textDecoration: dead ? "line-through" : "none",
              opacity: dead ? 0.5 : 1,
            }}
          >
            {ent.isPlayer ? "▶" : "◆"} {ent.name}
          </div>
        );
      })}
    </div>
  );
}

function CombatStatusBox({
  state,
  currentEntity,
}: {
  state: CombatState;
  currentEntity: CombatEntity | null;
}) {
  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        left: 12,
        padding: "10px 14px",
        background: "rgba(11, 15, 21, 0.78)",
        color: "#cfe8ff",
        border: "1px solid #2a3848",
        borderRadius: 8,
        fontFamily: "ui-monospace, monospace",
        fontSize: 12,
        lineHeight: 1.5,
        backdropFilter: "blur(6px)",
        zIndex: 50,
      }}
    >
      <div style={{ color: "#7df9ff", fontWeight: 600, marginBottom: 4 }}>NARVOS PRIME</div>
      <div>Phase : <b>{state.phase}</b></div>
      <div>Tour : <b>{state.turnNumber}</b></div>
      {currentEntity && (
        <>
          <div style={{ marginTop: 6, color: "#fbbf24" }}>
            {currentEntity.isPlayer ? "▶ Tour joueur" : "◆ Tour ennemi"}
          </div>
          <div>{currentEntity.name}</div>
          <div>HP : {currentEntity.stats.hp}/{currentEntity.stats.hpMax}</div>
          <div>PA : {currentEntity.stats.pa}/{currentEntity.stats.paMax} • PM : {currentEntity.stats.pm}/{currentEntity.stats.pmMax}</div>
        </>
      )}
    </div>
  );
}

function PlayerActionBar({
  player,
  isPlayerTurn,
  spellsById,
  selectedSpellId,
  onSelectSpell,
  onEndTurn,
}: {
  player: CombatEntity;
  isPlayerTurn: boolean;
  spellsById: Record<string, Spell>;
  selectedSpellId: string | null;
  onSelectSpell?: (spellId: string | null) => void;
  onEndTurn?: () => void;
}) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 16px",
        background: "rgba(11, 15, 21, 0.85)",
        border: "1px solid #2a3848",
        borderRadius: 12,
        backdropFilter: "blur(8px)",
        zIndex: 50,
      }}
    >
      {/* HP / PA / PM joueur */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 140 }}>
        <BarLabel label="HP" value={player.stats.hp} max={player.stats.hpMax} color="#22d3ee" />
        <BarLabel label="PA" value={player.stats.pa} max={player.stats.paMax} color="#fbbf24" />
        <BarLabel label="PM" value={player.stats.pm} max={player.stats.pmMax} color="#a78bfa" />
      </div>

      <div style={{ width: 1, height: 38, background: "#2a3848" }} />

      {/* Spell bar */}
      <div style={{ display: "flex", gap: 6 }}>
        {player.spells.map((spell) => {
          const fullSpell = spellsById[spell.id] || spell;
          const selected = selectedSpellId === fullSpell.id;
          const canCast = isPlayerTurn && player.stats.pa >= fullSpell.paCost;
          return (
            <button
              key={spell.id}
              disabled={!canCast}
              onClick={() => onSelectSpell?.(selected ? null : fullSpell.id)}
              title={`${fullSpell.name} — ${fullSpell.paCost} PA${fullSpell.description ? "\n" + fullSpell.description : ""}`}
              style={{
                width: 56, height: 56,
                background: selected ? "rgba(125, 249, 255, 0.22)" : "rgba(15, 22, 35, 0.7)",
                border: selected ? "1px solid #7df9ff" : "1px solid #2a3848",
                borderRadius: 8,
                color: canCast ? "#cfe8ff" : "#555",
                fontFamily: "ui-monospace, monospace",
                fontSize: 10,
                lineHeight: 1.2,
                cursor: canCast ? "pointer" : "not-allowed",
                opacity: canCast ? 1 : 0.5,
                padding: 4,
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{fullSpell.name}</div>
              <div style={{ color: "#fbbf24" }}>{fullSpell.paCost} PA</div>
            </button>
          );
        })}
      </div>

      <div style={{ width: 1, height: 38, background: "#2a3848" }} />

      {/* End turn */}
      <button
        disabled={!isPlayerTurn}
        onClick={onEndTurn}
        style={{
          padding: "10px 18px",
          background: isPlayerTurn ? "rgba(239, 68, 68, 0.18)" : "rgba(15, 22, 35, 0.5)",
          color: isPlayerTurn ? "#fca5a5" : "#555",
          border: isPlayerTurn ? "1px solid #ef4444" : "1px solid #2a3848",
          borderRadius: 8,
          fontFamily: "ui-monospace, monospace",
          fontSize: 12,
          cursor: isPlayerTurn ? "pointer" : "not-allowed",
        }}
      >
        Fin de tour
      </button>
    </div>
  );
}

function BarLabel({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "ui-monospace, monospace", fontSize: 11 }}>
      <span style={{ width: 24, color: "#9ab8d4" }}>{label}</span>
      <div style={{ flex: 1, height: 8, background: "#0f1623", border: "1px solid #2a3848", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, transition: "width 200ms ease" }} />
      </div>
      <span style={{ minWidth: 40, textAlign: "right", color: "#cfe8ff" }}>{value}/{max}</span>
    </div>
  );
}
