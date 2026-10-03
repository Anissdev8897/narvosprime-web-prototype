/**
 * PreCombatPanel.tsx - Panneau de selection avant combat.
 *
 * Permet de choisir : personnage joueur, map, monstres a spawn (1-3).
 * Quand l'utilisateur clique "Pret", on appelle onReady avec la config choisie.
 */

import { useEffect, useMemo, useState } from "react";
import type {
  CharacterDefinition,
  EntityRegistry as RegistryShape,
  Map3DConfig,
  MonsterDefinition,
} from "./combat/EntityDefinition";

export interface PreCombatChoice {
  characterId: string;
  mapId: string;
  monsterIds: string[];
}

interface PreCombatPanelProps {
  registry: RegistryShape | null;
  loading: boolean;
  error: string | null;
  onReady: (choice: PreCombatChoice) => void;
  onCancel?: () => void;
}

export function PreCombatPanel({ registry, loading, error, onReady, onCancel }: PreCombatPanelProps) {
  const [characterId, setCharacterId] = useState<string | null>(null);
  const [mapId, setMapId] = useState<string>("test_arena");
  const [monsterIds, setMonsterIds] = useState<string[]>([]);

  const characters = useMemo(() => Object.values(registry?.characters || {}), [registry]);
  const maps = useMemo(() => Object.values(registry?.maps || {}), [registry]);
  const monsters = useMemo(() => Object.values(registry?.monsters || {}), [registry]);

  // Defaults raisonnables au load
  useEffect(() => {
    if (!registry) return;
    if (!characterId && characters.length) setCharacterId(characters[0].id);
    if (monsterIds.length === 0 && monsters.length) {
      setMonsterIds([monsters[0].id, monsters[1]?.id].filter(Boolean) as string[]);
    }
  }, [registry, characterId, monsterIds.length, characters, monsters]);

  const containerStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(8, 10, 16, 0.85)",
    backdropFilter: "blur(10px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9998,
    padding: 24,
    color: "#cfe8ff",
    fontFamily: "ui-monospace, SFMono-Regular, monospace",
  };

  const cardStyle: React.CSSProperties = {
    width: "min(900px, 100%)",
    background: "rgba(15, 22, 35, 0.95)",
    border: "1px solid #2a3848",
    borderRadius: 12,
    padding: 28,
    boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
  };

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>Chargement des configs…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={containerStyle}>
        <div style={{ ...cardStyle, color: "#ef4444" }}>
          Erreur de chargement des configs : {error}
          {onCancel && (
            <button onClick={onCancel} style={{ marginTop: 16, padding: "8px 16px", cursor: "pointer" }}>
              Fermer
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!registry) return null;

  const canStart = characterId && mapId && monsterIds.length > 0;

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <div style={{ color: "#7df9ff", fontSize: 18, fontWeight: 700 }}>NARVOS PRIME — POC iso</div>
            <div style={{ fontSize: 12, color: "#9ab8d4", marginTop: 4 }}>
              Selectionne un personnage, une map, et 1 a 3 monstres pour la simulation.
            </div>
          </div>
          {onCancel && (
            <button
              onClick={onCancel}
              style={{
                padding: "6px 12px",
                background: "transparent",
                color: "#9ab8d4",
                border: "1px solid #2a3848",
                borderRadius: 6,
                cursor: "pointer",
                fontFamily: "ui-monospace, monospace",
              }}
            >
              Fermer
            </button>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 18 }}>
          {/* Personnages */}
          <Section title="Personnage">
            {characters.map((c) => (
              <CharacterCard
                key={c.id}
                character={c}
                selected={characterId === c.id}
                onSelect={() => setCharacterId(c.id)}
              />
            ))}
          </Section>

          {/* Maps */}
          <Section title="Map">
            {maps.map((m) => (
              <MapCard key={m.id} map={m} selected={mapId === m.id} onSelect={() => setMapId(m.id)} />
            ))}
          </Section>

          {/* Monstres (multi-select 1-3) */}
          <Section title="Monstres (1-3)">
            {monsters.map((m) => {
              const idx = monsterIds.indexOf(m.id);
              const selected = idx >= 0;
              return (
                <MonsterCard
                  key={m.id}
                  monster={m}
                  selected={selected}
                  onSelect={() => {
                    if (selected) {
                      setMonsterIds(monsterIds.filter((id) => id !== m.id));
                    } else if (monsterIds.length < 3) {
                      setMonsterIds([...monsterIds, m.id]);
                    }
                  }}
                />
              );
            })}
          </Section>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24, gap: 12 }}>
          {onCancel && (
            <button
              onClick={onCancel}
              style={{
                padding: "10px 20px",
                background: "transparent",
                color: "#9ab8d4",
                border: "1px solid #2a3848",
                borderRadius: 8,
                cursor: "pointer",
                fontFamily: "ui-monospace, monospace",
              }}
            >
              Annuler
            </button>
          )}
          <button
            disabled={!canStart}
            onClick={() => canStart && onReady({ characterId: characterId!, mapId, monsterIds })}
            style={{
              padding: "10px 26px",
              background: canStart ? "rgba(125, 249, 255, 0.18)" : "rgba(15, 22, 35, 0.5)",
              color: canStart ? "#7df9ff" : "#555",
              border: canStart ? "1px solid #7df9ff" : "1px solid #2a3848",
              borderRadius: 8,
              fontWeight: 600,
              cursor: canStart ? "pointer" : "not-allowed",
              fontFamily: "ui-monospace, monospace",
            }}
          >
            Pret ▶
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 * Sous-composants
 * ============================================================ */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "#9ab8d4", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 360, overflowY: "auto" }}>
        {children}
      </div>
    </div>
  );
}

function CharacterCard({
  character, selected, onSelect,
}: { character: CharacterDefinition; selected: boolean; onSelect: () => void }) {
  return (
    <Card selected={selected} onClick={onSelect} faction={character.faction}>
      <div style={{ fontWeight: 600 }}>{character.name}</div>
      <div style={{ fontSize: 10, color: "#9ab8d4" }}>{character.faction} • {character.classId}</div>
      <div style={{ fontSize: 10, color: "#9ab8d4", marginTop: 2 }}>
        HP {character.stats?.hp} • PA {character.stats?.pa} • PM {character.stats?.pm}
      </div>
    </Card>
  );
}

function MapCard({ map, selected, onSelect }: { map: Map3DConfig; selected: boolean; onSelect: () => void }) {
  return (
    <Card selected={selected} onClick={onSelect}>
      <div style={{ fontWeight: 600 }}>{map.name}</div>
      <div style={{ fontSize: 10, color: "#9ab8d4" }}>
        {map.grid.width}×{map.grid.height} cellules
      </div>
      <div style={{ fontSize: 10, color: "#9ab8d4", marginTop: 2 }}>
        {map.glbPath ? "GLB 3D" : "Plane test"}
      </div>
    </Card>
  );
}

function MonsterCard({
  monster, selected, onSelect,
}: { monster: MonsterDefinition; selected: boolean; onSelect: () => void }) {
  const kindColor: Record<string, string> = {
    monster: "#9ab8d4",
    elite: "#fbbf24",
    boss: "#ef4444",
  };
  return (
    <Card selected={selected} onClick={onSelect} faction={monster.faction}>
      <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ color: kindColor[monster.kind] || "#cfe8ff", fontSize: 9 }}>
          [{monster.kind.toUpperCase()}]
        </span>
        {monster.name}
      </div>
      <div style={{ fontSize: 10, color: "#9ab8d4" }}>
        N{monster.level} • {monster.aiBehavior} • HP {monster.stats?.hp}
      </div>
    </Card>
  );
}

function Card({
  selected, onClick, children, faction,
}: { selected: boolean; onClick: () => void; children: React.ReactNode; faction?: string }) {
  const factionAccent: Record<string, string> = {
    AKARLYS: "#7df9ff",
    ZAYAN: "#9b5bc4",
    MEZALAYIS: "#d4a574",
    NEUTRAL: "#9ab8d4",
  };
  const accent = (faction && factionAccent[faction]) || "#9ab8d4";
  return (
    <div
      onClick={onClick}
      style={{
        padding: 10,
        background: selected ? "rgba(125, 249, 255, 0.10)" : "rgba(11, 15, 21, 0.6)",
        border: selected ? `1px solid ${accent}` : "1px solid #2a3848",
        borderLeft: `3px solid ${selected ? accent : "transparent"}`,
        borderRadius: 6,
        cursor: "pointer",
        transition: "all 120ms ease",
      }}
    >
      {children}
    </div>
  );
}
