/**
 * forge/ForgePanels.tsx — Panneaux latéraux de l'éditeur Forge
 */

import { useState } from 'react';
import type { EditorSettings } from './ForgeBuilderScene';
import type { ForgeWater, WaterKind, ForgeObject } from './forgeSceneStore';

export interface Layer { id: string; name: string; visible: boolean; locked: boolean; color: string; }
export interface Prefab { id: string; name: string; objects: ForgeObject[]; waters: ForgeWater[]; category: string; }

// ── Composants utilitaires ───────────────────────────────────────────────────

interface PropertySliderProps {
  label: string;
  value: number; min: number; max: number; step: number;
  onChange: (v: number) => void;
}

export function PropertySlider({ label, value, min, max, step, onChange }: PropertySliderProps) {
  return (
    <div>
      <p style={{ margin: '0 0 4px 0', fontSize: '11px', color: '#94a3b8' }}>{label}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))} style={{ flex: 1 }} />
        <input type="number" value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)} min={min} max={max} step={step}
          style={{ width: '50px', padding: '2px 4px', background: '#0f172a', border: '1px solid #334155', borderRadius: '2px', color: '#e2e8f0', fontSize: '11px', textAlign: 'center', outline: 'none' }} />
      </div>
    </div>
  );
}

interface ToggleSettingProps { label: string; value: boolean; onChange: (v: boolean) => void; }

export function ToggleSetting({ label, value, onChange }: ToggleSettingProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: '12px', color: '#e2e8f0' }}>{label}</span>
      <button onClick={() => onChange(!value)}
        style={{ width: '36px', height: '20px', borderRadius: '10px', border: 'none', background: value ? '#4fc3f7' : '#334155', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', padding: 0 }}>
        <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '2px', left: value ? '18px' : '2px', transition: 'left 0.2s' }} />
      </button>
    </div>
  );
}

// ── Panneau Eau ──────────────────────────────────────────────────────────────

interface WaterPanelProps {
  waters: ForgeWater[];
  selectedWaterId: string | null;
  onAddWater: (kind: WaterKind) => void;
  onUpdateWater: (id: string, updates: Partial<ForgeWater>) => void;
  onSelectWater: (id: string) => void;
  onRemoveWater: (id: string) => void;
}

export function WaterPanel({ waters, selectedWaterId, onAddWater, onUpdateWater, onSelectWater, onRemoveWater }: WaterPanelProps) {
  const kinds = [
    { kind: 'riviere' as const, label: 'Rivière', icon: '🌊', desc: 'Étroite et sinueuse' },
    { kind: 'lac' as const, label: 'Lac', icon: '🏞️', desc: "Plan d'eau calme" },
    { kind: 'mer' as const, label: 'Mer', icon: '🌅', desc: 'Grande étendue' },
    { kind: 'ocean' as const, label: 'Océan', icon: '🌊', desc: 'Immense horizon' },
  ];
  const sel = waters.find(w => w.id === selectedWaterId);
  return (
    <div style={{ width: '280px', background: '#1e293b', borderLeft: '1px solid #334155', flexShrink: 0, maxHeight: '100%', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
      <div style={{ padding: '12px', borderBottom: '1px solid #334155' }}>
        <h3 style={{ margin: 0, fontSize: '14px', color: '#e2e8f0' }}>🌊 Surfaces d'Eau</h3>
      </div>
      <div style={{ padding: '12px', borderBottom: '1px solid #334155' }}>
        <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#94a3b8' }}>Ajouter une surface :</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          {kinds.map(wk => (
            <button key={wk.kind} onClick={() => onAddWater(wk.kind)}
              style={{ padding: '8px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#e2e8f0', cursor: 'pointer', fontSize: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '20px' }}>{wk.icon}</div>
              <div>{wk.label}</div>
              <div style={{ fontSize: '10px', color: '#64748b' }}>{wk.desc}</div>
            </button>
          ))}
        </div>
      </div>
      <div style={{ padding: '12px', flex: 1, overflow: 'auto' }}>
        <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#94a3b8' }}>Surfaces ({waters.length}) :</p>
        {waters.length === 0 ? (
          <p style={{ fontSize: '12px', color: '#475569', fontStyle: 'italic' }}>Aucune surface d'eau</p>
        ) : waters.map(w => (
          <div key={w.id} onClick={() => onSelectWater(w.id)}
            style={{ padding: '8px', marginBottom: '6px', background: '#0f172a', borderRadius: '6px', border: selectedWaterId === w.id ? '1px solid #4fc3f7' : '1px solid transparent', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '12px', color: '#e2e8f0' }}>
                🌊 {w.kind.charAt(0).toUpperCase() + w.kind.slice(1)}
              </div>
              <div style={{ fontSize: '10px', color: '#64748b' }}>{w.size[0]}×{w.size[1]}m · y={w.pos[1].toFixed(1)}</div>
            </div>
            <button onClick={(e) => { e.stopPropagation(); onRemoveWater(w.id); }}
              style={{ background: 'transparent', border: 'none', color: '#ef5350', cursor: 'pointer', fontSize: '14px', padding: '2px' }}>🗑️</button>
          </div>
        ))}
      </div>
      {sel && (
        <div style={{ padding: '12px', borderTop: '1px solid #334155' }}>
          <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#94a3b8' }}>Propriétés :</p>
          <WaterProperties water={sel} onUpdate={(u) => onUpdateWater(sel.id, u)} />
        </div>
      )}
    </div>
  );
}

function WaterProperties({ water, onUpdate }: { water: ForgeWater; onUpdate: (u: Partial<ForgeWater>) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <PropertySlider label="X" value={water.pos[0]} min={-100} max={100} step={0.5} onChange={(v) => onUpdate({ pos: [v, water.pos[1], water.pos[2]] })} />
      <PropertySlider label="Y (hauteur)" value={water.pos[1]} min={-10} max={20} step={0.1} onChange={(v) => onUpdate({ pos: [water.pos[0], v, water.pos[2]] })} />
      <PropertySlider label="Z" value={water.pos[2]} min={-100} max={100} step={0.5} onChange={(v) => onUpdate({ pos: [water.pos[0], water.pos[1], v] })} />
      <PropertySlider label="Largeur" value={water.size[0]} min={1} max={500} step={1} onChange={(v) => onUpdate({ size: [v, water.size[1]] })} />
      <PropertySlider label="Longueur" value={water.size[1]} min={1} max={500} step={1} onChange={(v) => onUpdate({ size: [water.size[0], v] })} />
      <PropertySlider label="Rotation °" value={water.rotY * (180 / Math.PI)} min={0} max={360} step={1} onChange={(v) => onUpdate({ rotY: v * (Math.PI / 180) })} />
    </div>
  );
}

// ── Panneau Terrain ──────────────────────────────────────────────────────────

interface TerrainPanelProps {
  brushMode: 'raise' | 'lower' | 'smooth' | 'paint';
  onBrushModeChange: (m: 'raise' | 'lower' | 'smooth' | 'paint') => void;
  brushSize: number; onBrushSizeChange: (s: number) => void;
  brushStrength: number; onBrushStrengthChange: (s: number) => void;
  terrainColor: string; onTerrainColorChange: (c: string) => void;
  // Terrain courant : position (déplaçable) + taille (libre).
  terrainOffset?: [number, number, number]; terrainSize?: number;
  onTerrainOffset?: (o: [number, number, number]) => void; onTerrainSize?: (s: number) => void;
  // Multi-terrains : liste, terrain actif, ajout/suppression.
  terrains?: { id: string; label: string }[]; activeTerrainId?: string;
  onSelectTerrain?: (id: string) => void; onAddTerrain?: () => void; onRemoveTerrain?: (id: string) => void;
}

export function TerrainPanel({ brushMode, onBrushModeChange, brushSize, onBrushSizeChange, brushStrength, onBrushStrengthChange, terrainColor, onTerrainColorChange,
  terrainOffset = [0, 0, 0], terrainSize = 120, onTerrainOffset, onTerrainSize,
  terrains = [], activeTerrainId, onSelectTerrain, onAddTerrain, onRemoveTerrain }: TerrainPanelProps) {
  const modes = [
    { id: 'raise' as const, label: 'Hausser', icon: '⛰️' }, { id: 'lower' as const, label: 'Abaisser', icon: '🏔️' },
    { id: 'smooth' as const, label: 'Lisser', icon: '🌊' }, { id: 'paint' as const, label: 'Peindre', icon: '🎨' },
  ];
  const sizes = [2, 5, 10, 20];
  return (
    <div style={{ width: '260px', background: '#1e293b', borderLeft: '1px solid #334155', flexShrink: 0, maxHeight: '100%', overflow: 'auto' }}>
      <div style={{ padding: '12px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '14px', color: '#e2e8f0' }}>⛰️ Terrains ({terrains.length})</h3>
        <button onClick={onAddTerrain} title="Ajouter une tuile" style={{ background: '#4fc3f7', color: '#0f172a', border: 'none', borderRadius: 4, width: 24, height: 24, fontSize: 14, cursor: 'pointer' }}>+</button>
      </div>
      {terrains.length > 1 && (
        <div style={{ padding: '8px 12px', borderBottom: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: 3 }}>
          {terrains.map((t) => (
            <div key={t.id} onClick={() => onSelectTerrain?.(t.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', borderRadius: 4, cursor: 'pointer', fontSize: 11,
                background: activeTerrainId === t.id ? '#16324a' : 'transparent', border: `1px solid ${activeTerrainId === t.id ? '#4fc3f7' : 'transparent'}`, color: activeTerrainId === t.id ? '#e2e8f0' : '#94a3b8' }}>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.label}</span>
              <button onClick={(e) => { e.stopPropagation(); onRemoveTerrain?.(t.id); }} style={{ background: 'transparent', border: 'none', color: '#ef5350', cursor: 'pointer', fontSize: 11, padding: 0 }}>✕</button>
            </div>
          ))}
        </div>
      )}
      <div style={{ padding: '12px', borderBottom: '1px solid #334155' }}>
        <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#94a3b8' }}>Mode :</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
          {modes.map(m => (
            <button key={m.id} onClick={() => onBrushModeChange(m.id)}
              style={{ padding: '6px', background: brushMode === m.id ? '#4fc3f7' : '#0f172a', border: '1px solid #334155', borderRadius: '4px', color: brushMode === m.id ? '#0f172a' : '#e2e8f0', cursor: 'pointer', fontSize: '11px', textAlign: 'center' }}>
              <div>{m.icon}</div><div>{m.label}</div>
            </button>
          ))}
        </div>
      </div>
      <div style={{ padding: '12px', borderBottom: '1px solid #334155' }}>
        <p style={{ margin: '0 0 6px 0', fontSize: '12px', color: '#94a3b8' }}>Taille : {brushSize}m</p>
        <div style={{ display: 'flex', gap: '4px' }}>
          {sizes.map(s => (
            <button key={s} onClick={() => onBrushSizeChange(s)}
              style={{ flex: 1, padding: '4px', background: brushSize === s ? '#4fc3f7' : '#0f172a', border: '1px solid #334155', borderRadius: '4px', color: brushSize === s ? '#0f172a' : '#e2e8f0', cursor: 'pointer', fontSize: '11px' }}>{s}</button>
          ))}
        </div>
      </div>
      <div style={{ padding: '12px', borderBottom: '1px solid #334155' }}>
        <p style={{ margin: '0 0 6px 0', fontSize: '12px', color: '#94a3b8' }}>Force : {(brushStrength * 100).toFixed(0)}%</p>
        <input type="range" min={0.1} max={1.0} step={0.1} value={brushStrength} onChange={(e) => onBrushStrengthChange(parseFloat(e.target.value))} style={{ width: '100%' }} />
      </div>
      {brushMode === 'paint' && (
        <div style={{ padding: '12px' }}>
          <p style={{ margin: '0 0 6px 0', fontSize: '12px', color: '#94a3b8' }}>Couleur :</p>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input type="color" value={terrainColor} onChange={(e) => onTerrainColorChange(e.target.value)} style={{ width: '40px', height: '40px', border: 'none', background: 'transparent', cursor: 'pointer' }} />
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>{terrainColor}</span>
          </div>
        </div>
      )}
      {/* Position (déplaçable) + taille (libre, sans limite). */}
      <div style={{ padding: '12px', borderTop: '1px solid #334155' }}>
        <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#94a3b8' }}>Position du terrain :</p>
        {(['X', 'Y', 'Z'] as const).map((ax, i) => (
          <div key={ax} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ width: 14, fontSize: 11, color: '#94a3b8' }}>{ax}</span>
            <input type="range" min={-400} max={400} step={1} value={terrainOffset[i]}
              onChange={(e) => { const o = [...terrainOffset] as [number, number, number]; o[i] = +e.target.value; onTerrainOffset?.(o); }} style={{ flex: 1 }} />
            <input type="number" value={terrainOffset[i]} onChange={(e) => { const o = [...terrainOffset] as [number, number, number]; o[i] = +e.target.value || 0; onTerrainOffset?.(o); }}
              style={{ width: 50, padding: '2px 4px', background: '#0f172a', border: '1px solid #334155', borderRadius: 2, color: '#e2e8f0', fontSize: 11, textAlign: 'center', outline: 'none' }} />
          </div>
        ))}
        <p style={{ margin: '10px 0 6px', fontSize: '12px', color: '#94a3b8' }}>Taille : {terrainSize} m (illimitée)</p>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {[120, 256, 512, 1024, 2048].map((s) => (
            <button key={s} onClick={() => onTerrainSize?.(s)}
              style={{ flex: '1 0 30%', padding: 4, background: terrainSize === s ? '#4fc3f7' : '#0f172a', border: '1px solid #334155', borderRadius: 4, color: terrainSize === s ? '#0f172a' : '#e2e8f0', cursor: 'pointer', fontSize: 11 }}>{s}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Panneau Calques ──────────────────────────────────────────────────────────

interface LayerObject { id: string; label: string; }
interface LayersPanelProps {
  layers: Layer[]; activeLayer: string; onSetActive: (id: string) => void;
  onAddLayer: () => void; onToggleVisibility: (id: string) => void;
  onToggleLock: (id: string) => void; onRename: (id: string, name: string) => void;
  onRemoveLayer: (id: string) => void;
  // Objets de la scène — sélection depuis la liste → gizmo XYZ.
  objects?: LayerObject[]; selectedObjectId?: string | null;
  onSelectObject?: (id: string) => void; onRemoveObject?: (id: string) => void;
}

export function LayersPanel({ layers, activeLayer, onSetActive, onAddLayer, onToggleVisibility, onToggleLock, onRename, onRemoveLayer,
  objects = [], selectedObjectId, onSelectObject, onRemoveObject }: LayersPanelProps) {
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');
  return (
    <div style={{ width: '240px', background: '#1e293b', borderLeft: '1px solid #334155', flexShrink: 0, maxHeight: '100%', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
      <div style={{ padding: '12px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '14px', color: '#e2e8f0' }}>📑 Calques</h3>
        <button onClick={onAddLayer} style={{ background: '#4fc3f7', color: '#0f172a', border: 'none', borderRadius: '4px', width: '24px', height: '24px', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
      </div>
      <div style={{ padding: '8px', flex: 1, overflow: 'auto' }}>
        {layers.map((l, i) => (
          <div key={l.id} onClick={() => onSetActive(l.id)}
            style={{ padding: '8px', marginBottom: '4px', background: activeLayer === l.id ? '#334155' : '#0f172a', borderRadius: '6px', border: activeLayer === l.id ? '1px solid #4fc3f7' : '1px solid transparent', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: l.color, flexShrink: 0 }} />
              {renaming === l.id ? (
                <input value={renameVal} onChange={(e) => setRenameVal(e.target.value)}
                  onBlur={() => { onRename(l.id, renameVal); setRenaming(null); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { onRename(l.id, renameVal); setRenaming(null); } if (e.key === 'Escape') setRenaming(null); }}
                  style={{ flex: 1, background: '#0f172a', border: '1px solid #4fc3f7', borderRadius: '2px', color: '#e2e8f0', fontSize: '12px', padding: '2px 4px', outline: 'none' }} autoFocus />
              ) : (
                <span onDoubleClick={() => { setRenaming(l.id); setRenameVal(l.name); }}
                  style={{ flex: 1, fontSize: '12px', color: activeLayer === l.id ? '#e2e8f0' : '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</span>
              )}
              <button onClick={(e) => { e.stopPropagation(); onToggleVisibility(l.id); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '12px', padding: '2px' }}>{l.visible ? '👁️' : '🚫'}</button>
              <button onClick={(e) => { e.stopPropagation(); onToggleLock(l.id); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '12px', padding: '2px' }}>{l.locked ? '🔒' : '🔓'}</button>
              {layers.length > 1 && (
                <button onClick={(e) => { e.stopPropagation(); onRemoveLayer(l.id); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#ef5350', padding: '2px' }}>🗑️</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* OBJETS de la scène : clic → sélection (gizmo XYZ apparaît). */}
      <div style={{ borderTop: '1px solid #334155', padding: '8px 12px' }}>
        <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Objets ({objects.length})</div>
        <div style={{ maxHeight: 240, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {objects.length === 0 && <div style={{ fontSize: 11, color: '#475569', fontStyle: 'italic' }}>Aucun objet placé.</div>}
          {objects.map((o) => (
            <div key={o.id} onClick={() => onSelectObject?.(o.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', borderRadius: 4, cursor: 'pointer',
                background: selectedObjectId === o.id ? '#16324a' : 'transparent', border: `1px solid ${selectedObjectId === o.id ? '#4fc3f7' : 'transparent'}` }}>
              <span style={{ fontSize: 11 }}>📦</span>
              <span style={{ flex: 1, fontSize: 11, color: selectedObjectId === o.id ? '#e2e8f0' : '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.label}</span>
              <button onClick={(e) => { e.stopPropagation(); onRemoveObject?.(o.id); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 11, color: '#ef5350', padding: 0 }}>✕</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Panneau Paramètres ───────────────────────────────────────────────────────

interface SettingsPanelProps { settings: EditorSettings; onSettingsChange: (s: EditorSettings) => void; onClose: () => void; }

export function SettingsPanel({ settings, onSettingsChange, onClose }: SettingsPanelProps) {
  return (
    <div style={{ width: '280px', background: '#1e293b', borderLeft: '1px solid #334155', flexShrink: 0, maxHeight: '100%', overflow: 'auto' }}>
      <div style={{ padding: '12px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '14px', color: '#e2e8f0' }}>⚙️ Paramètres</h3>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '16px' }}>✕</button>
      </div>
      <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <ToggleSetting label="Afficher la grille" value={settings.gridVisible} onChange={(v) => onSettingsChange({ ...settings, gridVisible: v })} />
        <ToggleSetting label="Aimantation (snap)" value={settings.snapEnabled} onChange={(v) => onSettingsChange({ ...settings, snapEnabled: v })} />
        {settings.snapEnabled && (
          <div>
            <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#94a3b8' }}>Pas : {settings.snapStep}</p>
            <select value={settings.snapStep} onChange={(e) => onSettingsChange({ ...settings, snapStep: parseFloat(e.target.value) })}
              style={{ width: '100%', padding: '6px', background: '#0f172a', border: '1px solid #334155', borderRadius: '4px', color: '#e2e8f0', fontSize: '12px', outline: 'none' }}>
              <option value={0.5}>0.5 m</option><option value={1}>1 m</option><option value={2.5}>2.5 m</option><option value={5}>5 m</option><option value={10}>10 m</option>
            </select>
          </div>
        )}
        <div>
          <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#94a3b8' }}>Sauvegarde automatique</p>
          <select value={settings.autoSaveInterval} onChange={(e) => onSettingsChange({ ...settings, autoSaveInterval: parseInt(e.target.value) })}
            style={{ width: '100%', padding: '6px', background: '#0f172a', border: '1px solid #334155', borderRadius: '4px', color: '#e2e8f0', fontSize: '12px', outline: 'none' }}>
            <option value={0}>Désactivée</option><option value={60000}>1 min</option><option value={120000}>2 min</option><option value={300000}>5 min</option><option value={600000}>10 min</option>
          </select>
        </div>
      </div>
    </div>
  );
}

// ── Panneau Météo ────────────────────────────────────────────────────────────

interface WeatherPanelProps {
  preset: string; onPresetChange: (p: string) => void;
  sunAngle: number; onSunAngleChange: (a: number) => void;
  sunIntensity: number; onSunIntensityChange: (i: number) => void;
  fogDensity: number; onFogDensityChange: (d: number) => void;
  showShadows: boolean; onShowShadowsChange: (s: boolean) => void;
}

export function WeatherPanel({ preset, onPresetChange, sunAngle, onSunAngleChange, sunIntensity, onSunIntensityChange, fogDensity, onFogDensityChange, showShadows, onShowShadowsChange }: WeatherPanelProps) {
  const presets = [
    { id: 'clear', label: '☀️ Jour' }, { id: 'cloudy', label: '☁️ Couvert' }, { id: 'sunset', label: '🌅 Coucher' },
    { id: 'storm', label: '⛈️ Orage' }, { id: 'fog', label: '🌫️ Brume' }, { id: 'night', label: '🌙 Nuit' }, { id: 'space', label: '✨ Espace' },
  ];
  return (
    <div style={{ width: '260px', background: '#1e293b', borderLeft: '1px solid #334155', flexShrink: 0, maxHeight: '100%', overflow: 'auto' }}>
      <div style={{ padding: '12px', borderBottom: '1px solid #334155' }}><h3 style={{ margin: 0, fontSize: '14px', color: '#e2e8f0' }}>🌤️ Météo</h3></div>
      <div style={{ padding: '12px', borderBottom: '1px solid #334155' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px' }}>
          {presets.map(p => (
            <button key={p.id} onClick={() => { onPresetChange(p.id); }}
              style={{ padding: '6px', background: preset === p.id ? '#4fc3f7' : '#0f172a', border: '1px solid #334155', borderRadius: '4px', color: preset === p.id ? '#0f172a' : '#e2e8f0', cursor: 'pointer', fontSize: '14px', textAlign: 'center' }}>
              <div>{p.label}</div>
            </button>
          ))}
        </div>
      </div>
      <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <PropertySlider label={`Angle: ${sunAngle}°`} value={sunAngle} min={0} max={180} step={1} onChange={onSunAngleChange} />
        <PropertySlider label={`Intensité: ${sunIntensity.toFixed(1)}`} value={sunIntensity} min={0} max={2} step={0.1} onChange={onSunIntensityChange} />
        <PropertySlider label={`Brume: ${(fogDensity * 100).toFixed(0)}%`} value={fogDensity} min={0} max={0.5} step={0.005} onChange={onFogDensityChange} />
        <ToggleSetting label="Ombres" value={showShadows} onChange={onShowShadowsChange} />
      </div>
    </div>
  );
}

// ── Panneau Prefabs ──────────────────────────────────────────────────────────

interface PrefabPanelProps { prefabs: Prefab[]; onLoadPrefab: (p: Prefab) => void; onDeletePrefab: (id: string) => void; onClose: () => void; }

export function PrefabPanel({ prefabs, onLoadPrefab, onDeletePrefab, onClose }: PrefabPanelProps) {
  const cats = prefabs.reduce<Record<string, Prefab[]>>((acc, p) => { const c = p.category || 'autre'; if (!acc[c]) acc[c] = []; acc[c].push(p); return acc; }, {});
  return (
    <div style={{ width: '260px', background: '#1e293b', borderLeft: '1px solid #334155', flexShrink: 0, maxHeight: '100%', overflow: 'auto' }}>
      <div style={{ padding: '12px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '14px', color: '#e2e8f0' }}>🧩 Prefabs</h3>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '16px' }}>✕</button>
      </div>
      {prefabs.length === 0 ? (
        <div style={{ padding: '20px', textAlign: 'center', color: '#475569', fontSize: '12px' }}>Aucun prefab enregistré.</div>
      ) : (
        <div style={{ padding: '12px' }}>
          {Object.entries(cats).map(([cat, items]) => (
            <div key={cat} style={{ marginBottom: '16px' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#94a3b8', textTransform: 'capitalize' }}>{cat}</h4>
              {items.map(p => (
                <div key={p.id} style={{ padding: '8px', marginBottom: '4px', background: '#0f172a', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#e2e8f0' }}>{p.name}</div>
                    <div style={{ fontSize: '10px', color: '#64748b' }}>{p.objects.length} obj · {p.waters.length} eaux</div>
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button onClick={() => onLoadPrefab(p)} style={{ background: '#4fc3f7', color: '#0f172a', border: 'none', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer' }}>Charger</button>
                    <button onClick={() => onDeletePrefab(p.id)} style={{ background: 'transparent', border: 'none', color: '#ef5350', cursor: 'pointer', fontSize: '14px', padding: '4px' }}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
