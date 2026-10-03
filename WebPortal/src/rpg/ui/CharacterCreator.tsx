// ══════════════════════════════════════════════════════════════════════════════
// ui/CharacterCreator.tsx — Créateur de personnage RPG futuriste (R3F)
//
// Layout :
//   [Canvas 3D + OrbitControls]  |  [Panneau de personnalisation]
//   • Choix genre (H/F)
//   • Choix classe (10) → applique élément/arme/thème
//   • Choix tenue (Peasant/Ranger)
//   • Couleur de peau + teinte de tenue (recoloration PBR live)
//   • Aperçu des 10 sorts de la classe
// ══════════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, ContactShadows } from "@react-three/drei";
import { FallbackEnvironment } from "../runtime/lighting/FallbackEnvironment";
import { RendererRegistrar } from "../loaders/RendererRegistrar";

import type { CharacterConfig, ClassId, Gender, SkillDef } from "../types";
import { CLASSES, CLASS_IDS } from "../classes/classes";
import { ELEMENTS } from "../elements/elements";
import { generateSkillsForClass } from "../skills/skillGenerator";
import { ModularCharacter } from "../characters/ModularCharacter";
import type { OutfitTheme } from "../loaders/assetManifest";

const SKIN_PALETTE = ["#f1c27d", "#e0ac69", "#c68642", "#8d5524", "#5a3a1a", "#d8c0a8"];
const THEMES: OutfitTheme[] = ["Peasant", "Ranger"];

export function CharacterCreator() {
  const [gender, setGender] = useState<Gender>("female");
  const [classId, setClassId] = useState<ClassId>("warrior_bruiser");
  const [theme, setTheme] = useState<OutfitTheme>("Ranger");
  const [skinColor, setSkinColor] = useState(SKIN_PALETTE[0]);
  const [tint, setTint] = useState<string | undefined>(undefined);

  const cls = CLASSES[classId];
  const element = ELEMENTS[cls.element];

  const config: CharacterConfig = useMemo(
    () => ({ gender, classId, outfitStyle: theme, parts: {}, skinColor, tint }),
    [gender, classId, theme, skinColor, tint]
  );

  const skills: SkillDef[] = useMemo(() => generateSkillsForClass(classId), [classId]);

  return (
    <div style={styles.root}>
      {/* ── Viewport 3D ─────────────────────────────────────────────────────── */}
      <div style={styles.viewport}>
        <Canvas shadows camera={{ position: [0, 1.4, 3.2], fov: 45 }}>
          <RendererRegistrar />
          <color attach="background" args={["#0a0a14"]} />
          <ambientLight intensity={0.4} />
          <directionalLight position={[3, 5, 2]} intensity={1.2} castShadow />
          {/* Glow élémentaire : lumière colorée selon la classe */}
          <pointLight position={[-2, 1.5, 2]} color={element.emissive} intensity={2} distance={8} />

          <group position={[0, -1, 0]}>
            <ModularCharacter config={config} theme={theme} autoRotate />
            <ContactShadows position={[0, 0, 0]} opacity={0.5} scale={6} blur={2} />
          </group>

          <FallbackEnvironment preset="night" />
          <OrbitControls
            enablePan={false}
            minDistance={1.5}
            maxDistance={6}
            target={[0, 0.2, 0]}
            minPolarAngle={Math.PI / 6}
            maxPolarAngle={Math.PI / 1.8}
          />
        </Canvas>

        {/* Bandeau classe en bas du viewport */}
        <div style={{ ...styles.classBanner, borderColor: element.color }}>
          <div style={{ ...styles.classTitle, color: element.color }}>{cls.label}</div>
          <div style={styles.classRole}>{cls.role.toUpperCase()} · {element.label}</div>
          <div style={styles.classDesc}>{cls.description}</div>
        </div>
      </div>

      {/* ── Panneau de personnalisation ─────────────────────────────────────── */}
      <aside style={styles.panel}>
        <h1 style={styles.h1}>CRÉATION DU PERSONNAGE</h1>

        {/* Genre */}
        <Section title="GENRE">
          <div style={styles.row}>
            <Toggle active={gender === "female"} onClick={() => setGender("female")}>Femme</Toggle>
            <Toggle active={gender === "male"} onClick={() => setGender("male")}>Homme</Toggle>
          </div>
        </Section>

        {/* Classe */}
        <Section title="CLASSE">
          <div style={styles.grid}>
            {CLASS_IDS.map((id) => {
              const c = CLASSES[id];
              const el = ELEMENTS[c.element];
              const active = id === classId;
              return (
                <button
                  key={id}
                  onClick={() => setClassId(id)}
                  style={{
                    ...styles.classBtn,
                    borderColor: active ? el.color : "#2a2a3a",
                    background: active ? `${el.color}22` : "#14141e",
                    color: active ? el.color : "#aab",
                  }}
                  title={c.description}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </Section>

        {/* Tenue */}
        <Section title="TENUE">
          <div style={styles.row}>
            {THEMES.map((t) => (
              <Toggle key={t} active={theme === t} onClick={() => setTheme(t)}>
                {t}
              </Toggle>
            ))}
          </div>
        </Section>

        {/* Couleur de peau */}
        <Section title="COULEUR DE PEAU">
          <div style={styles.row}>
            {SKIN_PALETTE.map((c) => (
              <button
                key={c}
                onClick={() => setSkinColor(c)}
                style={{
                  ...styles.swatch,
                  background: c,
                  outline: skinColor === c ? "2px solid #fff" : "none",
                }}
              />
            ))}
          </div>
        </Section>

        {/* Teinte de tenue */}
        <Section title="TEINTE DE TENUE">
          <div style={styles.row}>
            <button onClick={() => setTint(undefined)} style={styles.resetBtn}>
              Thème classe
            </button>
            <input
              type="color"
              value={tint ?? cls.outfitColor}
              onChange={(e) => setTint(e.target.value)}
              style={styles.colorInput}
            />
          </div>
        </Section>

        {/* Aperçu des sorts */}
        <Section title={`SORTS (${skills.length})`}>
          <div style={styles.skillList}>
            {skills.map((s) => (
              <div key={s.id} style={styles.skillRow} title={s.description}>
                <span style={{ ...styles.skillDot, background: element.color }} />
                <span style={styles.skillName}>{s.label}</span>
                <span style={styles.skillMeta}>
                  {s.damage > 0 ? `${s.damage} dmg` : s.heal > 0 ? `${s.heal} soin` : "util"}
                </span>
              </div>
            ))}
          </div>
        </Section>

        <button style={{ ...styles.confirmBtn, background: element.color }}>
          ▶ COMMENCER L'AVENTURE
        </button>
      </aside>
    </div>
  );
}

// ── Sous-composants UI ────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>{title}</div>
      {children}
    </div>
  );
}

function Toggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...styles.toggle,
        background: active ? "#2979ff" : "#14141e",
        borderColor: active ? "#2979ff" : "#2a2a3a",
        color: active ? "#fff" : "#aab",
      }}
    >
      {children}
    </button>
  );
}

// ── Styles (inline pour autonomie — à migrer en CSS modules si besoin) ───────
const styles: Record<string, React.CSSProperties> = {
  root: { display: "flex", width: "100%", height: "100vh", background: "#08080f", color: "#e8e8f0", fontFamily: "system-ui, sans-serif" },
  viewport: { flex: 1, position: "relative" },
  panel: { width: 380, padding: 24, overflowY: "auto", background: "#0d0d16", borderLeft: "1px solid #1e1e2e" },
  h1: { fontSize: 20, letterSpacing: 1, margin: "0 0 20px", color: "#7cc4ff" },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 12, color: "#667", letterSpacing: 1, marginBottom: 8 },
  row: { display: "flex", gap: 8, flexWrap: "wrap" },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 },
  toggle: { flex: 1, padding: "10px 14px", border: "1px solid", borderRadius: 6, cursor: "pointer", fontSize: 14 },
  classBtn: { padding: "8px 10px", border: "1px solid", borderRadius: 6, cursor: "pointer", fontSize: 12, textAlign: "left" },
  swatch: { width: 36, height: 36, borderRadius: "50%", border: "1px solid #333", cursor: "pointer" },
  resetBtn: { padding: "8px 12px", background: "#14141e", border: "1px solid #2a2a3a", borderRadius: 6, color: "#aab", cursor: "pointer", fontSize: 12 },
  colorInput: { width: 48, height: 36, border: "none", borderRadius: 6, background: "transparent", cursor: "pointer" },
  skillList: { display: "flex", flexDirection: "column", gap: 4, maxHeight: 220, overflowY: "auto" },
  skillRow: { display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", background: "#12121c", borderRadius: 4, fontSize: 12 },
  skillDot: { width: 8, height: 8, borderRadius: "50%", flexShrink: 0 },
  skillName: { flex: 1, color: "#cce" },
  skillMeta: { color: "#778", fontSize: 11 },
  classBanner: { position: "absolute", left: 24, bottom: 24, padding: "12px 18px", background: "rgba(10,10,20,0.8)", borderLeft: "3px solid", borderRadius: 6, maxWidth: 420, backdropFilter: "blur(8px)" },
  classTitle: { fontSize: 22, fontWeight: 700 },
  classRole: { fontSize: 12, color: "#889", letterSpacing: 1, margin: "2px 0 6px" },
  classDesc: { fontSize: 13, color: "#aab", lineHeight: 1.4 },
  confirmBtn: { width: "100%", padding: "14px", marginTop: 12, border: "none", borderRadius: 8, color: "#0a0a14", fontWeight: 700, fontSize: 15, cursor: "pointer", letterSpacing: 1 },
};
