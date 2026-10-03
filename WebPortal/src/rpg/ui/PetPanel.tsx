// ui/PetPanel.tsx — Panneau compagnons (toggle P).

import { usePetStore, petStore, type OwnedPet } from "../pets/petStore";
import { COMPANIONS, companionHp, companionDamage, type CompanionDef } from "../pets/petSummons";

const ALL_COMPANIONS = Object.values(COMPANIONS);

function XpBar({ pet }: { pet: OwnedPet }) {
  const needed = petStore.xpForLevel(pet.level);
  const pct = pet.level >= petStore.MAX_PET_LEVEL ? 1 : pet.xp / needed;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{
        flex: 1, height: 6, background: "rgba(255,255,255,0.08)",
        borderRadius: 3, overflow: "hidden",
      }}>
        <div style={{
          width: `${pct * 100}%`, height: "100%",
          background: "linear-gradient(90deg, #a78bfa, #7c3aed)",
          borderRadius: 3, transition: "width 0.3s",
        }} />
      </div>
      <span style={{
        fontSize: 10, fontWeight: 700, color: "#a78bfa",
        fontVariantNumeric: "tabular-nums", minWidth: 60, textAlign: "right",
      }}>
        {pet.level >= petStore.MAX_PET_LEVEL
          ? "MAX"
          : `${pet.xp} / ${needed}`}
      </span>
    </div>
  );
}

function PetRow({ compDef, pet, isActive }: {
  compDef: CompanionDef;
  pet: OwnedPet | undefined;
  isActive: boolean;
}) {
  const owned = !!pet;
  const level = pet?.level ?? 1;
  const hp = companionHp(compDef, level);
  const dmg = companionDamage(compDef, level);

  return (
    <div style={{
      padding: "14px 16px", borderRadius: 12,
      background: isActive ? "rgba(74,222,128,0.06)" : "rgba(255,255,255,0.02)",
      border: `1px solid ${isActive ? "rgba(74,222,128,0.3)" : "rgba(255,255,255,0.06)"}`,
      opacity: owned ? 1 : 0.45,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <span style={{ fontSize: 28 }}>{compDef.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 14, fontWeight: 800, color: "#e2e8f0",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            {pet?.nickname ?? compDef.label}
            <span style={{
              fontSize: 11, fontWeight: 700, color: "#a78bfa",
              background: "rgba(167,139,250,0.12)", padding: "1px 8px",
              borderRadius: 6,
            }}>
              Nv.{level}
            </span>
            {isActive && (
              <span style={{
                fontSize: 10, fontWeight: 700, color: "#4ade80",
                background: "rgba(74,222,128,0.12)", padding: "1px 8px",
                borderRadius: 6, textTransform: "uppercase",
              }}>
                Actif
              </span>
            )}
          </div>
          <div style={{
            fontSize: 11, color: "#64748b", marginTop: 2,
            display: "flex", gap: 14,
          }}>
            <span>❤️ {hp} PV</span>
            <span>⚔️ {dmg} DMG</span>
            <span>🏃 {compDef.moveSpeed} m/s</span>
          </div>
        </div>

        {owned && (
          <button
            onClick={() => petStore.setActive(isActive ? null : compDef.id)}
            style={{
              background: isActive
                ? "rgba(239,68,68,0.15)"
                : "rgba(74,222,128,0.12)",
              border: `1px solid ${isActive ? "rgba(239,68,68,0.3)" : "rgba(74,222,128,0.25)"}`,
              borderRadius: 8, padding: "6px 14px", cursor: "pointer",
              color: isActive ? "#f87171" : "#4ade80",
              fontSize: 11, fontWeight: 700,
            }}
          >
            {isActive ? "Rappeler" : "Invoquer"}
          </button>
        )}
      </div>

      {pet && <XpBar pet={pet} />}

      {!owned && (
        <div style={{ fontSize: 10, color: "#64748b", fontStyle: "italic" }}>
          Non adopté — trouvez ce compagnon dans le monde
        </div>
      )}
    </div>
  );
}

export function PetPanel({ onClose }: { onClose: () => void }) {
  const state = usePetStore();

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 75,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(2,3,10,0.82)", backdropFilter: "blur(6px)",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 480, maxWidth: "92vw", padding: 28,
        background: "rgba(8,6,16,0.96)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16,
        boxShadow: "0 0 60px rgba(100,60,255,0.12)",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: 24,
        }}>
          <div style={{
            fontSize: 15, fontWeight: 900, textTransform: "uppercase",
            letterSpacing: "0.15em", color: "#e2e8f0",
          }}>
            🐾 Compagnons
          </div>
          <button onClick={onClose} style={{
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8, padding: "6px 14px", cursor: "pointer",
            color: "#94a3b8", fontSize: 12, fontWeight: 700,
          }}>
            Fermer [P]
          </button>
        </div>

        {/* Companion list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {ALL_COMPANIONS.map((c) => (
            <PetRow
              key={c.id}
              compDef={c}
              pet={state.owned.find((o) => o.id === c.id)}
              isActive={state.activeCompanionId === c.id}
            />
          ))}
        </div>

        {/* Tip */}
        <div style={{
          marginTop: 18, fontSize: 10, color: "#475569", textAlign: "center",
          lineHeight: 1.5,
        }}>
          Adoptez des compagnons en explorant le monde.<br />
          Votre compagnon actif gagne de l'XP à chaque ennemi tué.
        </div>
      </div>
    </div>
  );
}
