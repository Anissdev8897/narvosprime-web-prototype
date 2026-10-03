/**
 * forge/ForgeToolbar.tsx — Barre d'outils principale + Barre d'état
 *
 * Toolbar : Tous les outils de l'éditeur Forge en barre horizontale
 * StatusBar : Informations sur la scène et l'état de l'éditeur
 */

import type { ToolMode } from './ForgeBuilderScene';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ToolDef {
  id: ToolMode;
  label: string;
  icon: string;
  shortcut: string;
  description: string;
}

interface ToolbarProps {
  toolMode: ToolMode;
  onToolModeChange: (mode: ToolMode) => void;
  selectedObjectId: string | null;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onSave: () => void;
  onOpenAssetBrowser: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onAlign: () => void;
  onShowWater: () => void;
  onShowTerrain: () => void;
  onShowLayers: () => void;
  /** Navigateur de scène — arbre catégorie → modèle → instances. */
  onShowOutliner: () => void;
  onShowSettings: () => void;
  onShowWeather: () => void;
  onShowPrefabs: () => void;
  onPublish: () => void;
  onSaveAsPrefab: () => void;
  onBack: () => void;
  snapEnabled: boolean;
  onToggleSnap: () => void;
  gridVisible: boolean;
  onToggleGrid: () => void;
}

interface StatusBarProps {
  sceneName: string;
  objectCount: number;
  waterCount: number;
  toolMode: ToolMode;
  snapEnabled: boolean;
  snapStep: number;
  autoSaveInterval: number;
  lastSave: number;
}

// ── Définition des outils ─────────────────────────────────────────────────────

const TOOLS: ToolDef[] = [
  { id: 'select', label: 'Sélection', icon: '🖱️', shortcut: '1', description: 'Sélectionner / Désélectionner' },
  { id: 'translate', label: 'Déplacer', icon: '✋', shortcut: '2', description: 'Déplacer (Gizmo translation)' },
  { id: 'rotate', label: 'Tourner', icon: '🔄', shortcut: '3', description: 'Rotation (Gizmo rotation)' },
  { id: 'scale', label: 'Échelle', icon: '📏', shortcut: '4', description: 'Redimensionner (Gizmo scale)' },
  { id: 'terrain', label: 'Terrain', icon: '⛰️', shortcut: '5', description: 'Sculpter le terrain (clic gauche)' },
  { id: 'spline', label: 'Chemin', icon: '〰️', shortcut: '6', description: 'Dessiner des chemins courbés' },
  { id: 'vegetation', label: 'Végétation', icon: '🌲', shortcut: '7', description: 'Disperser un modèle (choisis-le dans Modèles)' },
];

const TOOL_LABELS: Record<ToolMode, string> = {
  select: 'Sélection',
  translate: 'Déplacement',
  rotate: 'Rotation',
  scale: 'Échelle',
  terrain: 'Terrain',
  spline: 'Spline',
  water: 'Eau',
  vegetation: 'Végétation',
};

// ── Barre d'outils ────────────────────────────────────────────────────────────

export function Toolbar({
  toolMode, onToolModeChange, selectedObjectId,
  onUndo, onRedo, canUndo, canRedo,
  onSave, onOpenAssetBrowser, onDuplicate, onDelete, onAlign,
  onShowWater, onShowTerrain, onShowLayers, onShowOutliner, onShowSettings, onShowWeather,
  onShowPrefabs, onPublish, onSaveAsPrefab, onBack,
  snapEnabled, onToggleSnap, gridVisible, onToggleGrid,
}: ToolbarProps) {
  return (
    <div style={{
      minHeight: '48px', background: '#1e293b', borderBottom: '1px solid #334155',
      display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px',
      flexShrink: 0, flexWrap: 'wrap', rowGap: '4px',   // passe à la ligne → tous les boutons visibles
      fontFamily: 'JetBrains Mono, monospace',
      zIndex: 100,
    }}>
      {/* Bouton retour */}
      <ToolbarButton icon="←" label="Retour" onClick={onBack} title="Retour à la liste" />

      <Separator />

      {/* Outils de transformation */}
      {TOOLS.map(tool => (
        <ToolbarButton
          key={tool.id}
          icon={tool.icon}
          label={tool.label}
          shortcut={tool.shortcut}
          active={toolMode === tool.id}
          onClick={() => onToolModeChange(tool.id)}
          title={tool.description}
        />
      ))}

      <Separator />

      {/* Actions d'édition */}
      <ToolbarButton icon="↩️" label="Annuler" onClick={onUndo} disabled={!canUndo} title="Annuler (Ctrl+Z)" />
      <ToolbarButton icon="↪️" label="Rétablir" onClick={onRedo} disabled={!canRedo} title="Rétablir (Ctrl+Shift+Z)" />
      <ToolbarButton icon="💾" label="Sauver" onClick={onSave} title="Sauvegarder (Ctrl+S)" />

      <Separator />

      {/* Panneaux */}
      <ToolbarButton icon="📂" label="Modèles" onClick={onOpenAssetBrowser} title="Bibliothèque de modèles (Ctrl+B)" highlight />
      <ToolbarButton icon="🌊" label="Eau" onClick={onShowWater} title="Surfaces d'eau" />
      <ToolbarButton icon="⛰️" label="Terrain" onClick={onShowTerrain} title="Édition de terrain" />
      <ToolbarButton icon="📑" label="Calques" onClick={onShowLayers} title="Gestion des calques" />
      <ToolbarButton icon="🗂️" label="Scène" onClick={onShowOutliner} title="Navigateur de scène — modèles et objets placés (Ctrl+O)" />
      <ToolbarButton icon="🌤️" label="Météo" onClick={onShowWeather} title="Éclairage et météo" />
      <ToolbarButton icon="🧩" label="Prefabs" onClick={onShowPrefabs} title="Bibliothèque de prefabs" />

      <Separator />

      {/* Actions sur la sélection */}
      {selectedObjectId && (
        <>
          <ToolbarButton icon="📋" label="Dupliquer" onClick={onDuplicate} title="Dupliquer (Ctrl+D)" />
          <ToolbarButton icon="📐" label="Aligner" onClick={onAlign} title="Aligner sur le sol" />
          <ToolbarButton icon="🗑️" label="Supprimer" onClick={onDelete} title="Supprimer (Suppr)" />
          <Separator />
        </>
      )}

      {/* Toggles */}
      <ToolbarButton icon={snapEnabled ? '🧲' : '🧲'} label="Snap" onClick={onToggleSnap} active={snapEnabled} title="Aimantation à la grille" />
      <ToolbarButton icon={gridVisible ? '🔲' : '🔲'} label="Grille" onClick={onToggleGrid} active={gridVisible} title="Afficher/Masquer la grille" />

      <div style={{ flex: 1 }} />

      {/* Préfab et publication */}
      <ToolbarButton icon="💾" label="Prefab" onClick={onSaveAsPrefab} title="Enregistrer comme prefab" />
      <ToolbarButton icon="🚀" label="Publier" onClick={onPublish} title="Publier la carte dans le jeu" highlight />
      <ToolbarButton icon="⚙️" label="Config" onClick={onShowSettings} title="Paramètres de l'éditeur" />
    </div>
  );
}

// ── Bouton de la barre d'outils ───────────────────────────────────────────────

function ToolbarButton({
  icon, label, shortcut, active, disabled, highlight, onClick, title,
}: {
  icon: string;
  label: string;
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  highlight?: boolean;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title || label}
      style={{
        display: 'flex', alignItems: 'center', gap: '4px',
        padding: '6px 10px', borderRadius: '6px', border: 'none',
        background: active ? '#4fc3f7' : highlight ? '#0ea5e9' : 'transparent',
        color: active || highlight ? '#0f172a' : disabled ? '#475569' : '#94a3b8',
        cursor: disabled ? 'default' : 'pointer',
        fontSize: '12px', whiteSpace: 'nowrap',
        transition: 'all 0.15s',
        opacity: disabled ? 0.5 : 1,
      }}
      onMouseEnter={(e) => {
        if (!disabled && !active && !highlight)
          (e.currentTarget as HTMLElement).style.background = '#334155';
      }}
      onMouseLeave={(e) => {
        if (!active && !highlight)
          (e.currentTarget as HTMLElement).style.background = 'transparent';
      }}
    >
      <span style={{ fontSize: '14px' }}>{icon}</span>
      <span style={{ fontSize: '11px' }}>{label}</span>
      {shortcut && (
        <kbd style={{
          background: 'rgba(0,0,0,0.2)', padding: '1px 4px', borderRadius: '2px',
          fontSize: '9px', marginLeft: '2px',
        }}>
          {shortcut}
        </kbd>
      )}
    </button>
  );
}

// ── Séparateur ────────────────────────────────────────────────────────────────

function Separator() {
  return (
    <div style={{
      width: '1px', height: '24px', background: '#334155',
      margin: '0 4px', flexShrink: 0,
    }} />
  );
}

// ── Barre d'état ─────────────────────────────────────────────────────────────

export function StatusBar({
  sceneName, objectCount, waterCount, toolMode,
  snapEnabled, snapStep, autoSaveInterval, lastSave,
}: StatusBarProps) {
  const autoSaveStatus = autoSaveInterval > 0
    ? `Auto-save: ${(autoSaveInterval / 1000).toFixed(0)}s`
    : 'Auto-save: OFF';

  const lastSaveText = lastSave > 0
    ? `Dernière sauvegarde: ${new Date(lastSave).toLocaleTimeString()}`
    : 'Non sauvegardé';

  return (
    <div style={{
      height: '28px', background: '#0f172a', borderTop: '1px solid #1e293b',
      display: 'flex', alignItems: 'center', gap: '16px', padding: '0 12px',
      flexShrink: 0, fontSize: '11px', color: '#64748b',
      fontFamily: 'JetBrains Mono, monospace',
    }}>
      <span style={{ color: '#e2e8f0', fontWeight: 700 }}>
        📁 {sceneName}
      </span>
      <span>📦 {objectCount} objets</span>
      <span>🌊 {waterCount} eaux</span>
      <Separator />
      <span>🔧 {TOOL_LABELS[toolMode]}</span>
      {snapEnabled && <span>🧲 Snap: {snapStep}m</span>}
      <div style={{ flex: 1 }} />
      <span>{autoSaveStatus}</span>
      <span>{lastSaveText}</span>
    </div>
  );
}
