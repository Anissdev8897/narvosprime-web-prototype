// ══════════════════════════════════════════════════════════════════════════════
// runtime/admin/AdminPanel.tsx — Panneau d'outils administrateur in-game
//
// PHASE 1 de l'éditeur in-game : un panneau HUD réservé à l'admin avec un
// premier outil — le slider de CHARACTER_SCALE. Pose les fondations UI et
// architecturales pour les phases suivantes (placement PNJ, gizmos, quêtes,
// scan de modèles, etc.).
//
// Activation :
//   • L'utilisateur doit être admin (flag localStorage 'narvos:admin' = '1')
//   • Touche F8 (F12 est capturée par Electron pour ouvrir ses DevTools)
//   • OU bouton flottant ⚙ ADMIN visible si flag activé (cf. AdminFloatingButton)
//   • OU commande console : window.NarvosAdmin.enable() / .toggle() / .disable()
//
// Pourquoi un flag localStorage et pas un rôle utilisateur ?
//   • Pour la Phase 1, on cherche un toggle utile MAINTENANT, pas un RBAC complet.
//   • À remplacer par un vrai check côté serveur quand le Jalon #2 sera là.
//
// Scale 100% LIVE (Phase 1d) :
//   • Le mesh visuel suit instantanément (via le store + hook React)
//   • La collision (capsule) et la caméra (FPS + TPS) suivent aussi en direct
//     grâce aux getters dynamiques dans playerConfig.ts → plus de reload requis.
// ══════════════════════════════════════════════════════════════════════════════

import { useEffect } from "react";
import {
  characterScaleStore,
  CHARACTER_SCALE_MIN,
  CHARACTER_SCALE_MAX,
  CHARACTER_SCALE_DEFAULT,
  CHARACTER_SCALE_STEP,
  CHARACTER_SCALE_AT_BOOT,
} from "../../characters/characterScale";
import { useCharacterScale } from "../../characters/useCharacterScale";
import {
  cameraOffsetStore,
  CAMERA_OFFSET_MIN,
  CAMERA_OFFSET_MAX,
  CAMERA_OFFSET_DEFAULT,
  CAMERA_OFFSET_STEP,
} from "../../characters/cameraOffset";
import { useCameraOffset } from "../../characters/useCameraOffset";
import { cameraCollisionStore } from "../../characters/cameraCollision";
import { useCameraCollision } from "../../characters/useCameraCollision";
import { debugCollisionsStore } from "../debug/debugCollisions";
import { useDebugCollisions } from "../debug/useDebugCollisions";
import { useEnvironment } from "../environment/useEnvironment";
import { environmentStore } from "../environment/environmentStore";
import type { FallbackPreset } from "../lighting/FallbackEnvironment";

const ADMIN_STORAGE_KEY = "narvos:admin";

/**
 * True si le compte courant a les droits admin.
 *
 * Deux conditions :
 *   • Flag localStorage `narvos:admin` = '1' (activable depuis la console)
 *   • OU on est en mode développement Vite (`import.meta.env.DEV`)
 *
 * → En dev, l'admin est TOUJOURS actif : zéro friction pour itérer.
 * → En build de prod, seul le flag explicite donne accès → utilisateurs finaux
 *   protégés du panneau admin par défaut.
 *
 * Quand le Jalon serveur #2 sera prêt, on remplacera par un check de rôle
 * utilisateur côté serveur (auth + RBAC). Pour Phase 1, c'est suffisant.
 */
export function isAdmin(): boolean {
  try {
    // Vite expose import.meta.env.DEV = true en npm run dev, false en build prod
    if (import.meta.env?.DEV) return true;
    return localStorage.getItem(ADMIN_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Active le mode admin (utile en console pour les premiers tests). */
export function enableAdmin(): void {
  try { localStorage.setItem(ADMIN_STORAGE_KEY, "1"); } catch { /* ignore */ }
}

/** Désactive le mode admin. */
export function disableAdmin(): void {
  try { localStorage.removeItem(ADMIN_STORAGE_KEY); } catch { /* ignore */ }
}

// ── API console globale (window.NarvosAdmin) ─────────────────────────────────
// Permet d'activer/désactiver l'admin sans recharger ni naviguer dans
// localStorage manuellement. Utilisable depuis la console DevTools :
//   window.NarvosAdmin.enable()  → active + recharge la page
//   window.NarvosAdmin.disable() → désactive + recharge la page
//   window.NarvosAdmin.toggle()  → bascule la visibilité du panneau (sans reload)
//   window.NarvosAdmin.isAdmin   → lit le statut courant
//
// Exposée UNE SEULE FOIS au premier import — pas pollué après HMR ni dupliqué.
declare global {
  interface Window {
    NarvosAdmin?: {
      enable: () => void;
      disable: () => void;
      isAdmin: () => boolean;
      toggle: () => void;
    };
  }
}

// Toggle interne : `setAdminOpen` est défini dans le composant AdminPanel — on
// expose une callback que le composant installe au montage.
let togglePanelFn: (() => void) | null = null;

if (typeof window !== "undefined" && !window.NarvosAdmin) {
  window.NarvosAdmin = {
    enable: () => { enableAdmin(); window.location.reload(); },
    disable: () => { disableAdmin(); window.location.reload(); },
    isAdmin,
    toggle: () => { togglePanelFn?.(); },
  };
  const isDev = !!import.meta.env?.DEV;
  // eslint-disable-next-line no-console
  console.info(
    "%c[NarvosAdmin]%c " + (isDev
      ? "Mode DEV détecté — admin AUTO-ACTIVÉ. Appuie F8 ou clique la pastille ⚙ pour ouvrir le panneau."
      : "Build prod — tape window.NarvosAdmin.enable() pour activer le mode admin."),
    "color:#5bd6ff;font-weight:bold;font-size:13px", "color:inherit",
  );
}

interface AdminPanelProps {
  /** Visibilité contrôlée par le parent (F8 toggle ou bouton flottant). */
  open: boolean;
  onClose: () => void;
  /** Toggle externe (utilisé par window.NarvosAdmin.toggle + bouton flottant). */
  onToggle?: () => void;
  /** Map courante (pour régler l'environnement de la bonne map). */
  currentMap: string;
}

export function AdminPanel({ open, onClose, onToggle, currentMap }: AdminPanelProps) {
  const liveScale = useCharacterScale();
  const liveCamOffset = useCameraOffset();
  const camCollision = useCameraCollision();
  const debugColl = useDebugCollisions();

  // Enregistre la callback de toggle pour window.NarvosAdmin.toggle()
  // (l'API console n'a pas accès direct au state React du parent).
  useEffect(() => {
    if (onToggle) togglePanelFn = onToggle;
    return () => { if (togglePanelFn === onToggle) togglePanelFn = null; };
  }, [onToggle]);

  if (!open) return null;

  return (
    <div style={{
      // Positionné sous le badge de map (haut-droite) pour ne pas le masquer.
      position: "fixed", top: 60, right: 16, zIndex: 250,
      width: 340,
      background: "rgba(8, 12, 18, 0.94)",
      border: "1px solid rgba(91, 214, 255, 0.35)",
      borderRadius: 12, padding: 18,
      color: "#c0e8ff", fontFamily: "monospace", fontSize: 12,
      boxShadow: "0 0 36px rgba(91, 214, 255, 0.18), 0 0 80px rgba(0,0,0,0.6)",
      backdropFilter: "blur(8px)",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 14, paddingBottom: 10,
        borderBottom: "1px solid rgba(91, 214, 255, 0.18)",
      }}>
        <div style={{
          fontSize: 11, fontWeight: 900, letterSpacing: "0.32em",
          color: "#5bd6ff", textTransform: "uppercase",
        }}>
          ⚙ Outils Admin · Phase 1
        </div>
        <button
          onClick={onClose}
          title="Fermer (F12)"
          style={{
            background: "transparent", color: "#5bd6ff",
            border: "1px solid #5bd6ff55", borderRadius: 6,
            padding: "2px 8px", fontSize: 10, cursor: "pointer",
            fontFamily: "monospace", fontWeight: 700,
          }}
        >
          ✕
        </button>
      </div>

      {/* Section : échelle des personnages */}
      <div style={{ marginBottom: 16 }}>
        <div style={{
          fontSize: 10, color: "#88aab8", letterSpacing: "0.16em",
          textTransform: "uppercase", marginBottom: 8, fontWeight: 700,
        }}>
          Échelle globale des personnages
        </div>

        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "baseline",
          marginBottom: 6,
        }}>
          <span style={{ color: "#c0e8ff", fontSize: 13 }}>Joueur + PNJ</span>
          <span style={{
            color: "#a3e635", fontSize: 18, fontWeight: 900,
            fontFamily: "monospace",
          }}>
            ×{liveScale.toFixed(2)}
          </span>
        </div>

        <input
          type="range"
          min={CHARACTER_SCALE_MIN}
          max={CHARACTER_SCALE_MAX}
          step={CHARACTER_SCALE_STEP}
          value={liveScale}
          onChange={(e) => characterScaleStore.set(parseFloat(e.target.value))}
          style={{
            width: "100%", accentColor: "#5bd6ff", cursor: "pointer",
          }}
        />

        <div style={{
          display: "flex", justifyContent: "space-between",
          fontSize: 9, color: "#5a7080", marginTop: 2,
        }}>
          <span>{CHARACTER_SCALE_MIN.toFixed(2)} (miniature)</span>
          <span>défaut {CHARACTER_SCALE_DEFAULT.toFixed(2)}</span>
          <span>{CHARACTER_SCALE_MAX.toFixed(1)} (natif)</span>
        </div>

        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
          <button
            onClick={() => characterScaleStore.reset()}
            style={{
              flex: 1, padding: "6px 8px", fontSize: 10, fontWeight: 700,
              background: "rgba(91, 214, 255, 0.08)",
              color: "#5bd6ff",
              border: "1px solid rgba(91, 214, 255, 0.4)",
              borderRadius: 5, cursor: "pointer",
              fontFamily: "monospace", letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            Réinitialiser
          </button>
        </div>

        <div style={{
          marginTop: 10, padding: 8,
          background: "rgba(74, 222, 128, 0.08)",
          border: "1px solid rgba(74, 222, 128, 0.25)",
          borderRadius: 5, fontSize: 10, color: "#86efac",
          lineHeight: 1.4,
        }}>
          ✓ Échelle 100 % <strong>live</strong> : mesh, collision et caméra suivent
          le slider sans reload. Valeur initiale au boot : ×{CHARACTER_SCALE_AT_BOOT.toFixed(2)}.
        </div>
      </div>

      {/* ─────────── Section : offset caméra TPS ─────────── */}
      <div style={{
        marginBottom: 16, paddingTop: 14,
        borderTop: "1px solid rgba(91, 214, 255, 0.18)",
      }}>
        <div style={{
          fontSize: 10, color: "#88aab8", letterSpacing: "0.16em",
          textTransform: "uppercase", marginBottom: 8, fontWeight: 700,
        }}>
          Offset caméra TPS
        </div>

        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "baseline",
          marginBottom: 6,
        }}>
          <span style={{ color: "#c0e8ff", fontSize: 13 }}>Distance × scale perso</span>
          <span style={{
            color: "#fbbf24", fontSize: 18, fontWeight: 900,
            fontFamily: "monospace",
          }}>
            ×{liveCamOffset.toFixed(2)}
          </span>
        </div>

        <input
          type="range"
          min={CAMERA_OFFSET_MIN}
          max={CAMERA_OFFSET_MAX}
          step={CAMERA_OFFSET_STEP}
          value={liveCamOffset}
          onChange={(e) => cameraOffsetStore.set(parseFloat(e.target.value))}
          style={{
            width: "100%", accentColor: "#fbbf24", cursor: "pointer",
          }}
        />

        <div style={{
          display: "flex", justifyContent: "space-between",
          fontSize: 9, color: "#5a7080", marginTop: 2,
        }}>
          <span>{CAMERA_OFFSET_MIN.toFixed(2)} (proche)</span>
          <span>défaut {CAMERA_OFFSET_DEFAULT.toFixed(2)}</span>
          <span>{CAMERA_OFFSET_MAX.toFixed(2)} (loin)</span>
        </div>

        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
          <button
            onClick={() => cameraOffsetStore.reset()}
            style={{
              flex: 1, padding: "6px 8px", fontSize: 10, fontWeight: 700,
              background: "rgba(251, 191, 36, 0.08)",
              color: "#fbbf24",
              border: "1px solid rgba(251, 191, 36, 0.4)",
              borderRadius: 5, cursor: "pointer",
              fontFamily: "monospace", letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            Réinitialiser caméra
          </button>
        </div>

        <div style={{
          marginTop: 10, padding: 8,
          background: "rgba(251, 191, 36, 0.05)",
          border: "1px solid rgba(251, 191, 36, 0.20)",
          borderRadius: 5, fontSize: 10, color: "#fde68a",
          lineHeight: 1.4,
        }}>
          Distance TPS de base ≈ <strong>{Math.max(1.5, Math.min(12, 4 * liveScale * liveCamOffset)).toFixed(2)} m</strong>
          {" "}(bornée 1.5–12 m, modulable par molette en TPS). Astuce : perso très
          petit + offset {">"} 1 = cadrage cinématique préservé.
        </div>

        {/* Toggle collision caméra (anti-clip mur) */}
        <div style={{
          marginTop: 14, padding: "10px 12px",
          background: camCollision
            ? "rgba(74, 222, 128, 0.08)"
            : "rgba(251, 191, 36, 0.06)",
          border: camCollision
            ? "1px solid rgba(74, 222, 128, 0.30)"
            : "1px solid rgba(251, 191, 36, 0.30)",
          borderRadius: 6,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 10,
        }}>
          <div>
            <div style={{
              fontSize: 11, fontWeight: 800, color: camCollision ? "#86efac" : "#fde68a",
              letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 3,
            }}>
              Collision caméra
            </div>
            <div style={{ fontSize: 9, color: "#94a3b8", lineHeight: 1.4 }}>
              {camCollision
                ? "ON · caméra anti-clip mur (peut bloquer aux entrées de bâtiments)"
                : "OFF · caméra traverse les murs (entrée bâtiment fluide)"}
            </div>
          </div>
          <button
            onClick={() => cameraCollisionStore.toggle()}
            style={{
              flexShrink: 0,
              padding: "6px 14px", fontSize: 10, fontWeight: 900,
              background: camCollision ? "#22c55e" : "#475569",
              color: camCollision ? "#0a0a0a" : "#cbd5e1",
              border: "none", borderRadius: 14, cursor: "pointer",
              fontFamily: "monospace", letterSpacing: "0.12em",
              textTransform: "uppercase",
              minWidth: 56,
            }}
          >
            {camCollision ? "ON" : "OFF"}
          </button>
        </div>
      </div>

      {/* ─────────── Section : Debug collisions ─────────── */}
      <div style={{
        marginBottom: 8, paddingTop: 14,
        borderTop: "1px solid rgba(91, 214, 255, 0.18)",
      }}>
        <div style={{
          padding: "10px 12px",
          background: debugColl
            ? "rgba(251, 113, 133, 0.08)"
            : "rgba(91, 214, 255, 0.04)",
          border: debugColl
            ? "1px solid rgba(251, 113, 133, 0.30)"
            : "1px solid rgba(91, 214, 255, 0.18)",
          borderRadius: 6,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 10,
        }}>
          <div>
            <div style={{
              fontSize: 11, fontWeight: 800, color: debugColl ? "#fda4af" : "#88aab8",
              letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 3,
            }}>
              Debug collisions
            </div>
            <div style={{ fontSize: 9, color: "#94a3b8", lineHeight: 1.4 }}>
              {debugColl
                ? "ON · affiche capsule wireframe (vert=sol, jaune=air)"
                : "OFF · pas d'overlay debug"}
            </div>
          </div>
          <button
            onClick={() => debugCollisionsStore.toggle()}
            style={{
              flexShrink: 0,
              padding: "6px 14px", fontSize: 10, fontWeight: 900,
              background: debugColl ? "#fb7185" : "#475569",
              color: debugColl ? "#0a0a0a" : "#cbd5e1",
              border: "none", borderRadius: 14, cursor: "pointer",
              fontFamily: "monospace", letterSpacing: "0.12em",
              textTransform: "uppercase",
              minWidth: 56,
            }}
          >
            {debugColl ? "ON" : "OFF"}
          </button>
        </div>
      </div>

      {/* ─────────── Section : Environnement (par map) ─────────── */}
      <div style={{ marginBottom: 8, paddingTop: 14, borderTop: "1px solid rgba(91, 214, 255, 0.18)" }}>
        <div style={{
          fontSize: 10, color: "#88aab8", letterSpacing: "0.16em",
          textTransform: "uppercase", marginBottom: 8, fontWeight: 700,
        }}>
          Environnement · map « {currentMap} »
        </div>
        {currentMap === "orbital" ? (
          <div style={{
            fontSize: 10, color: "#7088a0", padding: 8,
            background: "rgba(91,214,255,0.04)", border: "1px solid rgba(91,214,255,0.12)", borderRadius: 5,
          }}>
            Environnement spatial non réglable en v1.
          </div>
        ) : (
          <EnvControls currentMap={currentMap} />
        )}
      </div>

      {/* Notes phases futures */}
      <div style={{
        marginTop: 12, paddingTop: 12,
        borderTop: "1px solid rgba(91, 214, 255, 0.12)",
        fontSize: 9, color: "#5a7080", lineHeight: 1.55,
      }}>
        Phases à venir : créer PNJ · gizmo placement · sauvegarde JSON · éditeur quêtes · IA comportementale · scan auto des modèles.
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// AdminFloatingButton — Pastille discrète d'ouverture du panneau
//
// Affichée UNIQUEMENT si l'utilisateur est admin (flag activé). Permet d'ouvrir
// le panneau sans connaître le raccourci F8 — utile pour les premiers tests et
// quand on n'a pas le focus clavier (souris seulement). Reste à l'écart du HUD
// gameplay pour ne pas gêner la partie.
// ══════════════════════════════════════════════════════════════════════════════

interface AdminFloatingButtonProps {
  onClick: () => void;
}

export function AdminFloatingButton({ onClick }: AdminFloatingButtonProps) {
  if (!isAdmin()) return null;
  return (
    <button
      onClick={onClick}
      title="Ouvrir les outils admin (F8)"
      style={{
        // Positionnée sous le badge de map (qui occupe top:14 right:14).
        // Décalée vers le bas pour éviter le chevauchement.
        position: "fixed", top: 60, right: 14, zIndex: 240,
        width: 42, height: 42,
        borderRadius: 21,
        background: "rgba(8, 12, 18, 0.85)",
        border: "2px solid #5bd6ff",
        color: "#5bd6ff",
        fontSize: 20, fontWeight: 900, cursor: "pointer",
        boxShadow: "0 0 18px rgba(91, 214, 255, 0.45)",
        fontFamily: "monospace",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "transform 120ms ease, box-shadow 120ms ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "scale(1.08)";
        e.currentTarget.style.boxShadow = "0 0 22px rgba(91, 214, 255, 0.5)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "scale(1)";
        e.currentTarget.style.boxShadow = "0 0 14px rgba(91, 214, 255, 0.25)";
      }}
    >
      ⚙
    </button>
  );
}

// ── Contrôles d'environnement (lus/écrits en live via environmentStore) ──────
const ENV_PRESETS: FallbackPreset[] = ["sunset", "city", "night", "dawn", "forest"];

function EnvControls({ currentMap }: { currentMap: string }) {
  const env = useEnvironment(currentMap);
  return (
    <div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 10 }}>
        {ENV_PRESETS.map((p) => (
          <button
            key={p}
            onClick={() => environmentStore.set(currentMap, { preset: p })}
            style={{
              flex: "1 0 30%", padding: "5px 4px", fontSize: 9, fontWeight: 700, cursor: "pointer",
              background: env.preset === p ? "rgba(91,214,255,0.25)" : "rgba(91,214,255,0.05)",
              color: env.preset === p ? "#ffffff" : "#7fd3ff",
              border: "1px solid rgba(91,214,255,0.3)", borderRadius: 5,
              textTransform: "uppercase", fontFamily: "monospace",
            }}
          >
            {p}
          </button>
        ))}
      </div>

      <EnvSlider label="Ambiante" value={env.ambientIntensity} min={0} max={2} step={0.05}
        color="#a3e635" onChange={(v) => environmentStore.set(currentMap, { ambientIntensity: v })} />
      <EnvSlider label="Soleil" value={env.sunIntensity} min={0} max={3} step={0.05}
        color="#fbbf24" onChange={(v) => environmentStore.set(currentMap, { sunIntensity: v })} />

      <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
        <EnvColor label="Soleil" value={env.sunColor}
          onChange={(c) => environmentStore.set(currentMap, { sunColor: c })} />
        <EnvColor label="Fond / ciel" value={env.backgroundColor}
          onChange={(c) => environmentStore.set(currentMap, { backgroundColor: c })} />
      </div>

      <button
        onClick={() => environmentStore.reset(currentMap)}
        style={{
          width: "100%", marginTop: 10, padding: "6px 8px", fontSize: 10, fontWeight: 700,
          background: "rgba(91,214,255,0.08)", color: "#5bd6ff",
          border: "1px solid rgba(91,214,255,0.4)", borderRadius: 5, cursor: "pointer",
          fontFamily: "monospace", letterSpacing: "0.1em", textTransform: "uppercase",
        }}
      >
        Réinitialiser cette map
      </button>
    </div>
  );
}

function EnvSlider({ label, value, min, max, step, color, onChange }: {
  label: string; value: number; min: number; max: number; step: number; color: string; onChange: (v: number) => void;
}) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 2 }}>
        <span style={{ color: "#c0e8ff" }}>{label}</span>
        <span style={{ color, fontWeight: 900 }}>{value.toFixed(2)}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: "100%", accentColor: color, cursor: "pointer" }}
      />
    </div>
  );
}

function EnvColor({ label, value, onChange }: { label: string; value: string; onChange: (c: string) => void }) {
  return (
    <label style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3, fontSize: 9, color: "#88aab8" }}>
      <span style={{ textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</span>
      <input
        type="color" value={value} onChange={(e) => onChange(e.target.value)}
        style={{ width: "100%", height: 26, border: "1px solid rgba(91,214,255,0.3)", borderRadius: 5, background: "transparent", cursor: "pointer" }}
      />
    </label>
  );
}
