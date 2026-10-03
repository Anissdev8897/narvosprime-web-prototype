/**
 * forge/ForgeEditor.tsx — Éditeur de monde Forge
 * Point d'entrée unique : <ForgeEditor />
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { ForgeBuilderScene, type ToolMode, type EditorSettings } from './ForgeBuilderScene';
import { AssetBrowser, useForgeAssetPlacement } from './AssetBrowser';
import { forgeSceneStore, EditHistory, snapshotOf, useForgeScene, useForgeScenes, sceneTerrains, type ForgeObject, type ForgeWater, type WaterKind } from './forgeSceneStore';
import { newWater } from './forgeSceneStore';
import { DEFAULT_WEATHER } from './ForgeWeatherRig';
import { DEFAULT_LAYERS } from './forgeSceneStore';
import { customMapStore } from '../world/customMapStore';
import { MAPS } from '../loaders/assetManifest';
import { RendererRegistrar } from '../loaders/RendererRegistrar';
import { createTerrain } from './terrainData';
import { FORGE } from './forgeTheme';
import { forgeSync } from './forgeSync';
import { usePeers } from './forgePresenceStore';
import { TextureBrowser } from './TextureBrowser';
import type { AssetEntry } from './assetScanner';
import { Toolbar, StatusBar } from './ForgeToolbar';
import type { Layer, Prefab } from './ForgePanels';
import { WaterPanel, TerrainPanel, LayersPanel, SettingsPanel, WeatherPanel, PrefabPanel } from './ForgePanels';
import { ForgeOutliner } from './ForgeOutliner';

const AUTO_SAVE_DEFAULT = 120000;

/**
 * Identifiant unique pour un élément de scène Forge.
 *
 * `Date.now()` SEUL ne suffit pas : dupliquer deux fois dans la même
 * milliseconde — un double-clic, ou n'importe quelle boucle qui crée plusieurs
 * objets d'affilée — produit deux fois le même id. Le second écrase alors le
 * premier dans la scène, sans erreur.
 *
 * Cinq sites du fichier portaient déjà le suffixe aléatoire, quatre l'avaient
 * oublié (`duplicateObject` ×2, création de préfab, création de calque). La
 * fonction existe pour qu'il n'y ait plus de « site oublié » possible : c'est
 * elle qu'on appelle, et elle seule.
 */
function newId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export function ForgeEditor({ onExit }: { onExit?: () => void } = {}) {
  const [currentSceneId, setCurrentSceneId] = useState<string | null>(null);
  const [editorView, setEditorView] = useState<'list' | 'editor' | 'create'>('list');
  const [sceneName, setSceneName] = useState('');
  const [createBaseMap, setCreateBaseMap] = useState(''); // map existante à éditer (vide = vierge)
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [toolMode, setToolMode] = useState<ToolMode>('select');
  const [showAssetBrowser, setShowAssetBrowser] = useState(false);
  const [pendingAsset, setPendingAsset] = useState<AssetEntry | null>(null);
  const [splinePoints, setSplinePoints] = useState<THREE.Vector3[]>([]);
  const [showWaterPanel, setShowWaterPanel] = useState(false);
  const [showTerrainPanel, setShowTerrainPanel] = useState(false);
  const [showLayersPanel, setShowLayersPanel] = useState(false);
  const [showOutliner, setShowOutliner] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [showWeatherPanel, setShowWeatherPanel] = useState(false);
  const [showPrefabPanel, setShowPrefabPanel] = useState(false);
  const [layers, setLayers] = useState<Layer[]>(DEFAULT_LAYERS);
  const [activeLayer, setActiveLayer] = useState('default');
  const [prefabs, setPrefabs] = useState<Prefab[]>([]);
  const [terrainBrush, setTerrainBrush] = useState<'raise' | 'lower' | 'smooth' | 'paint'>('raise');
  const [brushSize, setBrushSize] = useState(5);
  const [brushStrength, setBrushStrength] = useState(0.5);
  const [terrainColor, setTerrainColor] = useState('#4a7c3f');
  // Routes/chemins (outil spline → géométrie).
  const PATH_PRESETS = { route: { w: 6, c: '#444a52' }, sentier: { w: 2.5, c: '#6b573a' }, pont: { w: 5, c: '#7a5a32' }, rail: { w: 3.2, c: '#2b2f36' } } as const;
  const [pathKind, setPathKind] = useState<keyof typeof PATH_PRESETS>('route');
  const [pathWidth, setPathWidth] = useState(6);
  const [pathColor, setPathColor] = useState('#444a52');
  const [pathTexture, setPathTexture] = useState('');
  const [activeTerrainId, setActiveTerrainId] = useState('');  // terrain en cours d'édition (multi-tuiles)
  const [weatherPreset, setWeatherPreset] = useState<string>('clear');
  const [sunAngle, setSunAngle] = useState(45);
  const [sunIntensity, setSunIntensity] = useState(1.0);
  const [fogDensity, setFogDensity] = useState(0.0);
  const [showShadows, setShowShadows] = useState(true);
  const [settings, setSettings] = useState<EditorSettings>({
    snapEnabled: true, snapStep: 1, gridVisible: true,
    autoSaveInterval: AUTO_SAVE_DEFAULT, showWaterNormals: true,
  });

  const editHistory = useRef(new EditHistory());
  const autoSaveTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [lastSaveT, setLastSaveT] = useState(Date.now());
  const [liveOn, setLiveOn] = useState(false);   // Forge Live actif ?
  const [texBrowse, setTexBrowse] = useState<{ apply: (path: string) => void } | null>(null); // navigateur de textures ouvert ?
  const peers = usePeers();                       // co-éditeurs connectés
  // Coupe la session live si on quitte l'éditeur ou change de scène.
  useEffect(() => () => { forgeSync.stop(); setLiveOn(false); }, [currentSceneId]);
  // Force le rafraîchissement des boutons undo/redo (EditHistory vit dans un ref non réactif).
  const [, bumpHistory] = useState(0);
  const tickHistory = useCallback(() => bumpHistory((n) => n + 1), []);

  // ABONNEMENT au store → re-render à chaque mutation (sliders/undo/save réactifs).
  const currentScene = useForgeScene(currentSceneId);
  const allScenes = useForgeScenes();

  // ── AMBIANCE (M4) : hydratation depuis la scène, puis persistance ────────────
  //
  // L'angle solaire, le preset météo, la brume et les ombres ne vivaient QUE dans
  // l'état local ci-dessus. La map publiée s'affichait donc sous l'éclairage par
  // défaut : le joueur ne voyait jamais l'ambiance composée par l'auteur.
  const weatherHydrated = useRef<string | null>(null);
  useEffect(() => {
    if (!currentSceneId || !currentScene) return;
    if (weatherHydrated.current === currentSceneId) return;
    weatherHydrated.current = currentSceneId;
    const w = currentScene.weather ?? DEFAULT_WEATHER;
    setSunAngle(w.sunAngle);
    setWeatherPreset(w.preset);
    setFogDensity(w.fogDensity);
    setShowShadows(w.shadows);

    // ── CALQUES (M3) : ils vivaient en `useState`, donc perdus au rechargement,
    // alors que chaque objet porte un `layerId` qui les référence. Au retour, les
    // objets pointaient vers des calques disparus — masquage et verrou annulés
    // sans le dire. Ils sont désormais dans la scène ; on les hydrate ici.
    const ls = currentScene.layers ?? DEFAULT_LAYERS;
    setLayers(ls);
    // Le calque actif doit exister dans la liste rechargée, sinon les nouveaux
    // objets naîtraient sur un calque fantôme — le bug qu'on vient de fermer.
    setActiveLayer((cur) => (ls.some((l) => l.id === cur) ? cur : ls[0]?.id ?? "default"));
  }, [currentSceneId, currentScene]);

  // Persistance des calques — même anti-rebond que l'ambiance (renommage au
  // clavier, bascules de visibilité en rafale).
  useEffect(() => {
    if (!currentSceneId || weatherHydrated.current !== currentSceneId) return;
    const t = setTimeout(() => forgeSceneStore.save(currentSceneId, { layers }), 400);
    return () => clearTimeout(t);
  }, [currentSceneId, layers]);

  useEffect(() => {
    // Pas avant l'hydratation : sinon le premier rendu écraserait l'ambiance
    // enregistrée avec les valeurs par défaut des `useState`.
    if (!currentSceneId || weatherHydrated.current !== currentSceneId) return;
    // Anti-rebond : les réglages viennent de curseurs. Sans lui, chaque cran
    // déclencherait une écriture — et `forgeSceneStore.save` persiste à chaque
    // appel, sans dirty-checking (constat M8, non traité).
    const t = setTimeout(() => {
      forgeSceneStore.save(currentSceneId, {
        weather: { sunAngle, preset: weatherPreset, fogDensity, shadows: showShadows },
      });
    }, 400);
    return () => clearTimeout(t);
  }, [currentSceneId, sunAngle, weatherPreset, fogDensity, showShadows]);

  const handlePlaceAsset = useCallback((asset: AssetEntry) => {
    setPendingAsset(asset);
    // En mode végétation : on GARDE le mode (le modèle choisi sera dispersé au clic).
    setToolMode((m) => (m === 'vegetation' ? m : 'translate'));
    setShowAssetBrowser(false);
  }, []);

  useForgeAssetPlacement(handlePlaceAsset);

  const addObject = useCallback((asset: AssetEntry, pos: THREE.Vector3) => {
    if (!currentSceneId) return;
    const scene = forgeSceneStore.get(currentSceneId);
    if (!scene) return;
    editHistory.current.push(snapshotOf(scene));
    tickHistory();
    const obj: ForgeObject = {
      id: newId("obj"),
      model: asset.path,
      // Le Y vient du RAYCAST sur la géométrie cliquée — plus aucun plancher.
      //
      // `Math.max(0, …)` supposait que le sol de toute map est à zéro. Sur la
      // Forge (sol ≈ −51), il remontait chaque objet posé à la hauteur 0, soit
      // ~50 m au-dessus du décor. Le snap de grille reste appliqué aux trois
      // axes : c'est un alignement, pas une contrainte d'altitude.
      pos: settings.snapEnabled
        ? [snap(pos.x, settings.snapStep), snap(pos.y, settings.snapStep), snap(pos.z, settings.snapStep)]
        : [pos.x, pos.y, pos.z],
      rot: [0, 0, 0],
      scale: [1, 1, 1],
      layerId: activeLayer, // appartient au calque actif
    };
    forgeSceneStore.save(currentSceneId, { objects: [...scene.objects, obj] });
    setPendingAsset(null);
    setSelectedObjectId(obj.id);
  }, [currentSceneId, settings.snapEnabled, settings.snapStep, activeLayer, tickHistory]);

  // ── TERRAINS (multi-tuiles) : crée le 1er au passage en mode terrain ; sélectionne l'actif ──
  useEffect(() => {
    if (toolMode !== 'terrain' || !currentSceneId) return;
    const sc = forgeSceneStore.get(currentSceneId);
    if (!sc) return;
    const list = sceneTerrains(sc);
    if (list.length === 0) {
      const t = createTerrain(120, 64, terrainColor);
      forgeSceneStore.save(currentSceneId, { terrains: [t], terrain: undefined });
      setActiveTerrainId(t.id!);
    } else if (!list.some((t) => t.id === activeTerrainId)) {
      setActiveTerrainId(list[0].id!);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolMode, currentSceneId]);

  // Mute un terrain par id (offset/size/heights/color).
  const patchTerrain = useCallback((id: string, patch: Partial<import('./terrainData').TerrainData>) => {
    if (!currentSceneId) return;
    const sc = forgeSceneStore.get(currentSceneId);
    if (!sc) return;
    forgeSceneStore.save(currentSceneId, { terrains: sceneTerrains(sc).map((t) => (t.id === id ? { ...t, ...patch } : t)), terrain: undefined });
  }, [currentSceneId]);

  const addTerrain = useCallback(() => {
    if (!currentSceneId) return;
    const sc = forgeSceneStore.get(currentSceneId);
    if (!sc) return;
    const list = sceneTerrains(sc);
    // Nouvelle tuile décalée pour ne pas se superposer.
    const t = createTerrain(120, 64, terrainColor, [list.length * 130, 0, 0]);
    forgeSceneStore.save(currentSceneId, { terrains: [...list, t], terrain: undefined });
    setActiveTerrainId(t.id!);
  }, [currentSceneId, terrainColor]);

  const removeTerrain = useCallback((id: string) => {
    if (!currentSceneId) return;
    const sc = forgeSceneStore.get(currentSceneId);
    if (!sc) return;
    const next = sceneTerrains(sc).filter((t) => t.id !== id);
    forgeSceneStore.save(currentSceneId, { terrains: next, terrain: undefined });
    if (activeTerrainId === id) setActiveTerrainId(next[0]?.id ?? '');
  }, [currentSceneId, activeTerrainId]);

  // ── ROUTE : matérialise la spline courante en géométrie persistée ──
  const createPath = useCallback(() => {
    if (!currentSceneId || splinePoints.length < 2) return;
    const sc = forgeSceneStore.get(currentSceneId);
    if (!sc) return;
    editHistory.current.push(snapshotOf(sc));
    tickHistory();
    const path = {
      id: newId("path"),
      kind: pathKind, width: pathWidth, color: pathColor,
      texture: pathTexture.trim() || undefined,
      points: splinePoints.map((p) => [p.x, p.y, p.z] as [number, number, number]),
    };
    forgeSceneStore.save(currentSceneId, { paths: [...(sc.paths ?? []), path] });
    setSplinePoints([]); // repart d'une spline vierge
  }, [currentSceneId, splinePoints, pathKind, pathWidth, pathColor, pathTexture, tickHistory]);

  const removePath = useCallback((id: string) => {
    if (!currentSceneId) return;
    const sc = forgeSceneStore.get(currentSceneId);
    if (!sc) return;
    forgeSceneStore.save(currentSceneId, { paths: (sc.paths ?? []).filter((p) => p.id !== id) });
  }, [currentSceneId]);

  const commitTerrain = useCallback((id: string, heights: number[]) => {
    patchTerrain(id, { heights, color: terrainColor });
  }, [patchTerrain, terrainColor]);

  // ── VÉGÉTATION : disperse un cluster du modèle choisi (yaw + échelle aléatoires) ──
  const scatterVegetation = useCallback((asset: AssetEntry, center: THREE.Vector3) => {
    if (!currentSceneId) return;
    const sc = forgeSceneStore.get(currentSceneId);
    if (!sc) return;
    editHistory.current.push(snapshotOf(sc));
    tickHistory();
    const cluster: ForgeObject[] = Array.from({ length: 6 }, () => {
      const r = Math.random() * 4, a = Math.random() * Math.PI * 2;
      const s = 0.8 + Math.random() * 0.6;
      return {
        id: newId("veg"),
        model: asset.path,
        pos: [center.x + Math.cos(a) * r, center.y, center.z + Math.sin(a) * r] as [number, number, number],
        rot: [0, Math.random() * Math.PI * 2, 0] as [number, number, number],
        scale: [s, s, s] as [number, number, number],
        layerId: activeLayer,
      };
    });
    forgeSceneStore.save(currentSceneId, { objects: [...sc.objects, ...cluster] });
  }, [currentSceneId, activeLayer, tickHistory]);

  const updateObject = useCallback((id: string, updates: Partial<ForgeObject>) => {
    if (!currentSceneId) return;
    const scene = forgeSceneStore.get(currentSceneId);
    if (!scene) return;
    // Historique AVANT mutation — c'était le trou principal de l'undo : déplacer,
    // tourner ou redimensionner au gizmo ne laissait aucune trace, alors que
    // c'est l'action la plus fréquente de l'éditeur. Créer un objet était
    // annulable, le bouger ne l'était pas.
    //
    // Une entrée par DÉPÔT, pas par frame : `ForgeBuilderScene` commite sur
    // `onMouseUp` du TransformControls, pas en continu. Un glisser-déposer
    // produit donc exactement un pas d'annulation — le comportement attendu.
    editHistory.current.push(snapshotOf(scene));
    tickHistory();
    forgeSceneStore.save(currentSceneId, {
      objects: scene.objects.map(o => o.id === id ? { ...o, ...updates } : o),
    });
  }, [currentSceneId, tickHistory]);

  const removeObject = useCallback((id: string) => {
    if (!currentSceneId) return;
    const scene = forgeSceneStore.get(currentSceneId);
    if (!scene) return;
    editHistory.current.push(snapshotOf(scene));
    forgeSceneStore.save(currentSceneId, {
      objects: scene.objects.filter(o => o.id !== id),
      waters: scene.waters.filter(w => w.id !== id),
    });
    setSelectedObjectId(null);
  }, [currentSceneId]);

  const duplicateObject = useCallback(() => {
    if (!selectedObjectId || !currentSceneId) return;
    const scene = forgeSceneStore.get(currentSceneId);
    if (!scene) return;
    const obj = scene.objects.find(o => o.id === selectedObjectId);
    const water = scene.waters.find(w => w.id === selectedObjectId);
    if (obj) {
      editHistory.current.push(snapshotOf(scene));
      const newObj: ForgeObject = { ...obj, id: newId("obj"), pos: [obj.pos[0] + 2, obj.pos[1], obj.pos[2] + 2] };
      forgeSceneStore.save(currentSceneId, { objects: [...scene.objects, newObj] });
      setSelectedObjectId(newObj.id);
    } else if (water) {
      editHistory.current.push(snapshotOf(scene));
      const nw: ForgeWater = { ...water, id: newId("water"), pos: [water.pos[0] + 5, water.pos[1], water.pos[2] + 5] };
      forgeSceneStore.save(currentSceneId, { waters: [...scene.waters, nw] });
      setSelectedObjectId(nw.id);
    }
  }, [selectedObjectId, currentSceneId]);

  const alignObjects = useCallback(() => {
    if (!currentSceneId) return;
    const scene = forgeSceneStore.get(currentSceneId);
    if (!scene) return;
    if (scene.objects.length === 0) return;
    editHistory.current.push(snapshotOf(scene)); // FIX : alignement annulable
    tickHistory();
    // Aligne sur l'objet le PLUS BAS, pas sur la cote zéro absolue.
    //
    // `y = 0` en dur supposait — comme le plancher de placement corrigé en M1 —
    // que le sol de toute map est à zéro. Sur la Forge (sol ≈ −51), « aligner »
    // propulsait la scène entière 51 m en l'air. Et l'action porte sur TOUS les
    // objets, pas seulement la sélection : un seul clic suffisait à décoller la
    // carte complète, d'où le nom trompeur relevé par l'audit.
    //
    // Aligner sur le minimum garde la scène là où l'auteur l'a posée et donne à
    // l'action le sens qu'annonce son nom : mettre tout le monde au même niveau.
    const floorY = Math.min(...scene.objects.map((o) => o.pos[1]));
    forgeSceneStore.save(currentSceneId, {
      objects: scene.objects.map(o => ({ ...o, pos: [o.pos[0], floorY, o.pos[2]] as [number, number, number] })),
    });
  }, [currentSceneId, tickHistory]);

  const addWater = useCallback((kind: WaterKind) => {
    if (!currentSceneId) return;
    const scene = forgeSceneStore.get(currentSceneId);
    if (!scene) return;
    editHistory.current.push(snapshotOf(scene));
    const water = newWater(kind);
    forgeSceneStore.save(currentSceneId, { waters: [...(scene.waters || []), water] });
    setSelectedObjectId(water.id);
    setToolMode('translate');
  }, [currentSceneId]);

  const updateWater = useCallback((id: string, updates: Partial<ForgeWater>) => {
    if (!currentSceneId) return;
    const scene = forgeSceneStore.get(currentSceneId);
    if (!scene) return;
    // Même trou que `updateObject` : le gizmo d'une surface d'eau ne laissait
    // aucune trace non plus.
    editHistory.current.push(snapshotOf(scene));
    tickHistory();
    forgeSceneStore.save(currentSceneId, {
      waters: scene.waters.map(w => w.id === id ? { ...w, ...updates } : w),
    });
  }, [currentSceneId, tickHistory]);

  const handleUndo = useCallback(() => {
    if (!currentSceneId) return;
    const scene = forgeSceneStore.get(currentSceneId);
    if (!scene) return;
    const snap = snapshotOf(scene);
    const prev = editHistory.current.undo(snap);
    if (prev) forgeSceneStore.save(currentSceneId, prev);
    tickHistory();
  }, [currentSceneId, tickHistory]);

  const handleRedo = useCallback(() => {
    if (!currentSceneId) return;
    const scene = forgeSceneStore.get(currentSceneId);
    if (!scene) return;
    const snap = snapshotOf(scene);
    const next = editHistory.current.redo(snap);
    if (next) forgeSceneStore.save(currentSceneId, next);
    tickHistory();
  }, [currentSceneId, tickHistory]);

  const createScene = useCallback(() => {
    if (!sceneName.trim()) return;
    // baseMap renseigné → la scène ÉDITE une map existante (rendue en fond, objets par-dessus).
    const scene = forgeSceneStore.create(sceneName.trim(), createBaseMap || undefined);
    setCurrentSceneId(scene.id);
    setEditorView('editor');
    setSceneName('');
    setCreateBaseMap('');
    editHistory.current = new EditHistory();
  }, [sceneName, createBaseMap]);

  const openScene = useCallback((id: string) => {
    setCurrentSceneId(id);
    setEditorView('editor');
    setSelectedObjectId(null);
    editHistory.current = new EditHistory();
  }, []);

  const publishScene = useCallback(() => {
    if (!currentSceneId) return;
    const scene = forgeSceneStore.get(currentSceneId);
    if (!scene || !scene.name.trim()) return;
    const result = customMapStore.add({ id: scene.id, label: scene.name, kind: 'editor', sceneId: scene.id });
    if (result.ok) alert(`✅ Carte « ${scene.name} » publiée !\nVous pouvez vous y téléporter depuis le jeu.`);
    else alert(`❌ ${result.error}`);
  }, [currentSceneId]);

  const saveAsPrefab = useCallback(() => {
    if (!currentSceneId) return;
    const scene = forgeSceneStore.get(currentSceneId);
    if (!scene) return;
    // window.prompt() n'existe PAS sous Electron → nom auto (renommable plus tard).
    const name = `Prefab ${(JSON.parse(localStorage.getItem('forge_prefabs') || '[]').length) + 1}`;
    const prefab: Prefab = { id: newId("prefab"), name, objects: [...scene.objects], waters: [...scene.waters], category: 'personnalisé' };
    setPrefabs(prev => [...prev, prefab]);
    const stored = JSON.parse(localStorage.getItem('forge_prefabs') || '[]');
    stored.push(prefab);
    localStorage.setItem('forge_prefabs', JSON.stringify(stored));
  }, [currentSceneId]);

  const loadPrefab = useCallback((prefab: Prefab) => {
    if (!currentSceneId) return;
    const scene = forgeSceneStore.get(currentSceneId);
    if (!scene) return;
    editHistory.current.push(snapshotOf(scene));
    forgeSceneStore.save(currentSceneId, {
      objects: [...scene.objects, ...prefab.objects.map(o => ({ ...o, id: newId("obj") }))],
      waters: [...scene.waters, ...prefab.waters.map(w => ({ ...w, id: newId("water") }))],
    });
  }, [currentSceneId]);

  useEffect(() => {
    if (!currentSceneId || settings.autoSaveInterval <= 0) return;
    autoSaveTimer.current = setInterval(() => {
      // PERSISTE réellement (re-écrit la scène courante → localStorage + base, met à jour updatedAt).
      const sc = forgeSceneStore.get(currentSceneId);
      if (sc) forgeSceneStore.save(currentSceneId, { objects: sc.objects, waters: sc.waters });
      setLastSaveT(Date.now());
    }, settings.autoSaveInterval);
    return () => { if (autoSaveTimer.current) clearInterval(autoSaveTimer.current); };
  }, [currentSceneId, settings.autoSaveInterval]);

  const handleSave = useCallback(() => {
    // Sauvegarde RÉELLE (re-persiste l'état courant) + retour visuel.
    if (currentSceneId) {
      const sc = forgeSceneStore.get(currentSceneId);
      if (sc) forgeSceneStore.save(currentSceneId, { objects: sc.objects, waters: sc.waters });
    }
    setLastSaveT(Date.now());
    const el = document.getElementById('save-indicator');
    if (el) { el.textContent = '✓ Sauvegardé'; el.style.color = '#4caf50'; setTimeout(() => { el.textContent = '💾'; el.style.color = '#94a3b8'; }, 2000); }
  }, [currentSceneId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
      const key = e.key.toLowerCase();
      if (key === '1') setToolMode('select');
      else if (key === '2') setToolMode('translate');
      else if (key === '3') setToolMode('rotate');
      else if (key === '4') setToolMode('scale');
      else if (key === '5') setToolMode('terrain');
      else if (key === '6') setToolMode('spline');
      else if (key === '7') setToolMode('vegetation');
      else if ((e.ctrlKey || e.metaKey) && key === 'z' && !e.shiftKey) { e.preventDefault(); handleUndo(); }
      else if ((e.ctrlKey || e.metaKey) && key === 'z' && e.shiftKey) { e.preventDefault(); handleRedo(); }
      else if ((e.ctrlKey || e.metaKey) && key === 'y') { e.preventDefault(); handleRedo(); }
      else if ((e.ctrlKey || e.metaKey) && key === 's') { e.preventDefault(); handleSave(); }
      else if (key === 'delete' || key === 'backspace') { if (selectedObjectId) removeObject(selectedObjectId); }
      else if ((e.ctrlKey || e.metaKey) && key === 'd') { e.preventDefault(); duplicateObject(); }
      else if (key === 'escape') { if (showAssetBrowser) setShowAssetBrowser(false); else if (pendingAsset) setPendingAsset(null); else if (selectedObjectId) setSelectedObjectId(null); }
      else if (key === 'b' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); setShowAssetBrowser(true); }
      // Ctrl+O — navigateur de scène. `preventDefault` obligatoire : sans lui
      // Electron ouvre sa boîte de dialogue « Ouvrir un fichier » par-dessus l'éditeur.
      else if (key === 'o' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); setShowOutliner(v => !v); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedObjectId, showAssetBrowser, pendingAsset, handleUndo, handleRedo, handleSave, removeObject, duplicateObject]);

  useEffect(() => {
    try { const stored = JSON.parse(localStorage.getItem('forge_prefabs') || '[]'); if (stored.length > 0) setPrefabs(stored); }
    catch { /* ignore */ }
  }, []);

  if (editorView === 'list') {
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: FORGE.bg, color: FORGE.text, fontFamily: 'JetBrains Mono, monospace', padding: '40px',
      }}>
        {onExit && (
          <button onClick={onExit}
            style={{ position: 'absolute', top: 24, left: 24, background: 'transparent', color: FORGE.textDim, border: '1px solid #334155', padding: '8px 18px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit' }}>
            ← Atelier
          </button>
        )}
        <h1 style={{ fontSize: '28px', marginBottom: '8px', color: FORGE.text }}>🏗️ Forge de Mondes</h1>
        <p style={{ color: FORGE.textDim, marginBottom: '32px', fontSize: '14px' }}>Créez et gérez vos cartes et donjons personnalisés</p>
        <button onClick={() => setEditorView('create')}
          style={{
            background: FORGE.accent, color: FORGE.bg, border: 'none',
            padding: '12px 32px', borderRadius: '8px', fontSize: '16px', fontWeight: 700,
            cursor: 'pointer', marginBottom: '32px', transition: 'transform 0.2s',
          }}
          onMouseEnter={(e) => (e.target as HTMLElement).style.transform = 'scale(1.05)'}
          onMouseLeave={(e) => (e.target as HTMLElement).style.transform = 'scale(1)'}
        >
          ✨ Créer une nouvelle carte
        </button>
        {allScenes.length === 0 ? (
          <div style={{ color: FORGE.textFaint, fontSize: '14px' }}>Aucune carte existante. Créez-en une !</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px', width: '100%', maxWidth: '900px' }}>
            {allScenes.map(scene => (
              <div key={scene.id} style={{ background: '#1e293b', borderRadius: '12px', padding: '20px', border: '1px solid #334155', cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = FORGE.accent; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#334155'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
                onClick={() => openScene(scene.id)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', color: FORGE.text }}>{scene.name}</h3>
                    <p style={{ margin: 0, fontSize: '12px', color: FORGE.textDim }}>{scene.objects?.length || 0} objets · {scene.waters?.length || 0} surfaces</p>
                    <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: FORGE.textFaint }}>{new Date(scene.updatedAt).toLocaleDateString()}</p>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); if (confirm('Supprimer ?')) { forgeSceneStore.remove(scene.id); customMapStore.remove(scene.id); } }}
                    style={{ background: 'transparent', border: 'none', color: '#ef5350', fontSize: '18px', cursor: 'pointer', padding: '4px' }}>🗑️</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (editorView === 'create') {
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: FORGE.bg, color: FORGE.text, fontFamily: 'JetBrains Mono, monospace' }}>
        <h2 style={{ marginBottom: '24px', fontSize: '22px' }}>🏗️ Nouvelle Carte</h2>
        <p style={{ color: '#94a3b8', marginBottom: '16px', fontSize: '13px' }}>Donnez un nom à votre création</p>
        <input type="text" value={sceneName} onChange={(e) => setSceneName(e.target.value)}
          placeholder="Ex: Forêt Enchantée, Donjon du Chaos..."
          style={{ width: '320px', padding: '12px 16px', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: FORGE.text, fontSize: '16px', outline: 'none', textAlign: 'center', marginBottom: '16px' }}
          onKeyDown={(e) => { if (e.key === 'Enter' && sceneName.trim()) createScene(); }} autoFocus />
        {/* Map de base : éditer une map EXISTANTE (rendue en fond) ou partir d'une carte vierge. */}
        <p style={{ color: FORGE.textDim, marginBottom: '6px', fontSize: '12px' }}>Partir de :</p>
        <select value={createBaseMap} onChange={(e) => setCreateBaseMap(e.target.value)}
          style={{ width: '320px', padding: '10px', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: FORGE.text, fontSize: '14px', outline: 'none', marginBottom: '24px' }}>
          <option value="">🆕 Carte vierge</option>
          {Object.keys(MAPS).filter((id) => !MAPS[id].path.startsWith('editor://')).map((id) => (
            <option key={id} value={id}>✏️ Éditer : {MAPS[id].label} ({id})</option>
          ))}
        </select>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={() => setEditorView('list')} style={{ background: '#334155', color: '#94a3b8', border: 'none', padding: '10px 24px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>← Retour</button>
          <button onClick={createScene} disabled={!sceneName.trim()}
            style={{ background: sceneName.trim() ? FORGE.accent : '#1e293b', color: sceneName.trim() ? FORGE.bg : FORGE.textFaint, border: 'none', padding: '10px 24px', borderRadius: '6px', cursor: sceneName.trim() ? 'pointer' : 'default', fontSize: '14px', fontWeight: 700 }}>✨ Créer</button>
        </div>
      </div>
    );
  }

  if (!currentScene) return <div style={{ color: 'red', padding: 20 }}>Scène introuvable</div>;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', background: FORGE.bg, color: FORGE.text, fontFamily: 'JetBrains Mono, monospace', overflow: 'hidden' }}>
      <Toolbar
        toolMode={toolMode} onToolModeChange={setToolMode}
        selectedObjectId={selectedObjectId}
        onUndo={handleUndo} onRedo={handleRedo}
        canUndo={editHistory.current.canUndo} canRedo={editHistory.current.canRedo}
        onSave={handleSave} onOpenAssetBrowser={() => setShowAssetBrowser(true)}
        onDuplicate={duplicateObject} onDelete={() => selectedObjectId && removeObject(selectedObjectId)}
        onAlign={alignObjects}
        onShowOutliner={() => setShowOutliner(v => !v)}
        onShowWater={() => setShowWaterPanel(!showWaterPanel)}
        onShowTerrain={() => setShowTerrainPanel(!showTerrainPanel)}
        onShowLayers={() => setShowLayersPanel(!showLayersPanel)}
        onShowSettings={() => setShowSettingsPanel(!showSettingsPanel)}
        onShowWeather={() => setShowWeatherPanel(!showWeatherPanel)}
        onShowPrefabs={() => setShowPrefabPanel(!showPrefabPanel)}
        onPublish={publishScene} onSaveAsPrefab={saveAsPrefab}
        onBack={() => setEditorView('list')}
        snapEnabled={settings.snapEnabled}
        onToggleSnap={() => setSettings(prev => ({ ...prev, snapEnabled: !prev.snapEnabled }))}
        gridVisible={settings.gridVisible}
        onToggleGrid={() => setSettings(prev => ({ ...prev, gridVisible: !prev.gridVisible }))}
      />
      <div style={{ flex: 1, display: 'flex', position: 'relative' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          {showAssetBrowser && <AssetBrowser onClose={() => setShowAssetBrowser(false)} />}
          {texBrowse && <TextureBrowser onPick={(p) => { texBrowse.apply(p); setTexBrowse(null); }} onClose={() => setTexBrowse(null)} />}
          <Canvas camera={{ position: [15, 12, 15], fov: 50 }} dpr={[1, 2]} shadows={showShadows}
            gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: sunIntensity }}
            style={{ width: '100%', height: '100%' }}
            onCreated={({ scene }) => { scene.fog = new THREE.FogExp2(0x0f172a, fogDensity); }}>
            <RendererRegistrar />
            <ForgeBuilderScene sceneId={currentSceneId!} toolMode={toolMode} selectedObjectId={selectedObjectId}
              settings={settings} pendingAsset={pendingAsset} splinePoints={splinePoints}
              layers={layers} sunAngle={sunAngle} weatherPreset={weatherPreset} fogDensity={fogDensity} showShadows={showShadows}
              terrainBrush={terrainBrush} brushSize={brushSize} brushStrength={brushStrength}
              activeTerrainId={activeTerrainId} onTerrainCommit={commitTerrain} onScatter={scatterVegetation}
              onObjectSelect={setSelectedObjectId} onObjectUpdate={updateObject} onObjectRemove={removeObject}
              onWaterUpdate={updateWater} onAddObject={addObject} onSplinePointsChange={setSplinePoints}
              onPlacementMode={(active) => { if (!active) setPendingAsset(null); }} />
          </Canvas>
          <div style={{ position: 'absolute', bottom: 8, right: 8, fontSize: '11px', color: FORGE.textDim, pointerEvents: 'none' }}>
            {currentScene.objects?.length || 0} objets · {currentScene.waters?.length || 0} surfaces · {(currentScene.paths ?? []).length} routes
          </div>

          {/* MATÉRIAU de l'objet sélectionné : texture custom + PBR (couleur/rugosité/métal/émission). */}
          {(() => {
            const sel = currentScene.objects?.find((o) => o.id === selectedObjectId);
            if (!sel) return null;
            const mat = sel.material ?? {};
            const setMat = (p: Partial<NonNullable<ForgeObject['material']>>) => updateObject(sel.id, { material: { ...mat, ...p } });
            const fld = (label: string, node: React.ReactNode) => (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                <span style={{ width: 64, fontSize: 10, color: FORGE.textDim }}>{label}</span>{node}
              </div>
            );
            return (
              <div style={{ position: 'absolute', bottom: 8, left: 8, zIndex: 30, width: 250, background: 'rgba(2,4,10,0.93)', border: `1px solid ${FORGE.accentDim}`, borderRadius: 4, padding: 10, fontFamily: FORGE.mono, color: FORGE.text }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.16em', color: FORGE.accent, textTransform: 'uppercase', marginBottom: 8 }}>Matériau · {sel.model.split('/').pop()}</div>
                {fld('Teinte', <><input type="color" value={/^#[0-9a-fA-F]{6}$/.test(mat.tint || '') ? mat.tint! : '#ffffff'} onChange={(e) => setMat({ tint: e.target.value })} style={{ width: 26, height: 22, border: 'none', background: 'transparent', cursor: 'pointer' }} /><button onClick={() => setMat({ tint: undefined })} style={{ fontSize: 10, background: 'transparent', color: FORGE.textDim, border: `1px solid ${FORGE.accentDim}`, borderRadius: 3, cursor: 'pointer', padding: '2px 6px' }}>↺</button></>)}
                {fld('Texture', <>
                  <input value={mat.texture ?? ''} onChange={(e) => setMat({ texture: e.target.value.trim() || undefined })} placeholder="aucune" style={{ flex: 1, background: 'rgba(2,6,12,0.85)', color: FORGE.text, border: `1px solid ${FORGE.accentDim}`, borderRadius: 3, padding: '3px 6px', fontFamily: FORGE.mono, fontSize: 10, outline: 'none' }} />
                  <button onClick={() => setTexBrowse({ apply: (p) => setMat({ texture: p }) })} title="Parcourir les textures" style={{ background: 'transparent', color: FORGE.accent, border: `1px solid ${FORGE.accentDim}`, borderRadius: 3, cursor: 'pointer', padding: '2px 6px', fontSize: 11 }}>📁</button>
                </>)}
                {fld('Répét.', <input type="range" min={1} max={12} step={1} value={mat.textureRepeat ?? 1} onChange={(e) => setMat({ textureRepeat: +e.target.value })} style={{ flex: 1 }} />)}
                {fld(`Rugosité ${(mat.roughness ?? 0.8).toFixed(2)}`, <input type="range" min={0} max={1} step={0.05} value={mat.roughness ?? 0.8} onChange={(e) => setMat({ roughness: +e.target.value })} style={{ flex: 1 }} />)}
                {fld(`Métal ${(mat.metalness ?? 0).toFixed(2)}`, <input type="range" min={0} max={1} step={0.05} value={mat.metalness ?? 0} onChange={(e) => setMat({ metalness: +e.target.value })} style={{ flex: 1 }} />)}
                {fld('Émission', <><input type="color" value={/^#[0-9a-fA-F]{6}$/.test(mat.emissive || '') ? mat.emissive! : '#000000'} onChange={(e) => setMat({ emissive: e.target.value, emissiveIntensity: mat.emissiveIntensity ?? 1 })} style={{ width: 26, height: 22, border: 'none', background: 'transparent', cursor: 'pointer' }} /><input type="range" min={0} max={4} step={0.1} value={mat.emissiveIntensity ?? 1} onChange={(e) => setMat({ emissiveIntensity: +e.target.value })} style={{ flex: 1 }} /></>)}
                <button onClick={() => updateObject(sel.id, { material: undefined })} style={{ width: '100%', marginTop: 4, padding: '4px', fontSize: 10, background: 'transparent', color: FORGE.danger, border: `1px solid ${FORGE.danger}55`, borderRadius: 3, cursor: 'pointer', fontFamily: FORGE.mono }}>↺ Réinitialiser le matériau</button>
              </div>
            );
          })()}
          <div style={{ position: 'absolute', top: 8, right: 8, fontSize: '12px', color: FORGE.textDim }}><span id="save-indicator">💾</span></div>
          {/* FORGE LIVE : co-édition temps réel (curseurs + sync de scène). */}
          <button onClick={() => {
              if (forgeSync.isActive()) { forgeSync.stop(); setLiveOn(false); }
              else { let u = "Admin"; try { u = JSON.parse(localStorage.getItem('narvos_user') || '{}').username || 'Admin'; } catch { /* ignore */ } forgeSync.start(currentSceneId!, { name: u }); setLiveOn(true); }
            }}
            style={{ position: 'absolute', top: 8, left: 8, padding: '5px 12px', fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', fontFamily: FORGE.mono, cursor: 'pointer', borderRadius: 3,
              background: liveOn ? FORGE.accentFaint : 'rgba(8,14,24,0.8)', color: liveOn ? FORGE.accent : FORGE.textDim,
              border: `1px solid ${liveOn ? FORGE.accent : FORGE.accentDim}`, boxShadow: liveOn ? `0 0 12px ${FORGE.accentDim}` : 'none' }}>
            🛰 LIVE {liveOn ? `· ${peers.length + 1}` : 'OFF'}
          </button>

          {/* Panneau CHEMINS — visible en mode spline : clique au sol pour poser des points,
              règle type/largeur/couleur/texture, puis « Valider la route ». */}
          {toolMode === 'spline' && (
            <div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', zIndex: 30,
              background: 'rgba(2,4,10,0.92)', border: `1px solid ${FORGE.accentDim}`, borderRadius: 4, padding: '8px 12px',
              display: 'flex', gap: 8, alignItems: 'center', fontFamily: FORGE.mono, fontSize: 11, color: FORGE.text }}>
              <span style={{ color: FORGE.accent, fontWeight: 800 }}>CHEMIN · {splinePoints.length} pt</span>
              {(Object.keys(PATH_PRESETS) as (keyof typeof PATH_PRESETS)[]).map((k) => (
                <button key={k} onClick={() => { setPathKind(k); setPathWidth(PATH_PRESETS[k].w); setPathColor(PATH_PRESETS[k].c); }}
                  style={{ padding: '3px 8px', borderRadius: 3, cursor: 'pointer', fontFamily: FORGE.mono, fontSize: 10, textTransform: 'capitalize',
                    background: pathKind === k ? FORGE.accentFaint : 'transparent', color: pathKind === k ? FORGE.accent : FORGE.textDim, border: `1px solid ${pathKind === k ? FORGE.accent : FORGE.accentDim}` }}>{k}</button>
              ))}
              <span style={{ color: FORGE.textDim }}>L</span>
              <input type="range" min={1} max={16} step={0.5} value={pathWidth} onChange={(e) => setPathWidth(+e.target.value)} style={{ width: 70 }} />
              <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(pathColor) ? pathColor : '#444a52'} onChange={(e) => setPathColor(e.target.value)} style={{ width: 26, height: 22, border: 'none', background: 'transparent', cursor: 'pointer' }} />
              <input value={pathTexture} onChange={(e) => setPathTexture(e.target.value)} placeholder="texture (optionnel)"
                style={{ width: 120, background: 'rgba(2,6,12,0.85)', color: FORGE.text, border: `1px solid ${FORGE.accentDim}`, borderRadius: 3, padding: '3px 6px', fontFamily: FORGE.mono, fontSize: 10, outline: 'none' }} />
              <button onClick={() => setTexBrowse({ apply: setPathTexture })} title="Parcourir" style={{ background: 'transparent', color: FORGE.accent, border: `1px solid ${FORGE.accentDim}`, borderRadius: 3, cursor: 'pointer', padding: '2px 6px', fontSize: 11 }}>📁</button>
              <button onClick={createPath} disabled={splinePoints.length < 2}
                style={{ padding: '4px 10px', borderRadius: 3, cursor: splinePoints.length < 2 ? 'default' : 'pointer', fontFamily: FORGE.mono, fontSize: 10, fontWeight: 800,
                  background: splinePoints.length < 2 ? 'transparent' : FORGE.accentFaint, color: splinePoints.length < 2 ? FORGE.textFaint : FORGE.accent, border: `1px solid ${splinePoints.length < 2 ? FORGE.accentDim : FORGE.accent}` }}>✔ Valider</button>
              {splinePoints.length > 0 && <button onClick={() => setSplinePoints([])} style={{ padding: '4px 8px', borderRadius: 3, cursor: 'pointer', fontFamily: FORGE.mono, fontSize: 10, background: 'transparent', color: FORGE.danger, border: `1px solid ${FORGE.danger}55` }}>✕</button>}
              {(currentScene.paths ?? []).length > 0 && (
                <span style={{ color: FORGE.textDim, borderLeft: `1px solid ${FORGE.accentDim}`, paddingLeft: 8 }}>
                  {(currentScene.paths ?? []).length} route(s)
                  <button onClick={() => { const ps = currentScene.paths ?? []; if (ps.length) removePath(ps[ps.length - 1].id); }}
                    title="Supprimer la dernière route" style={{ marginLeft: 6, padding: '2px 6px', borderRadius: 3, cursor: 'pointer', fontFamily: FORGE.mono, fontSize: 10, background: 'transparent', color: FORGE.danger, border: `1px solid ${FORGE.danger}55` }}>↩ dernière</button>
                </span>
              )}
            </div>
          )}
        </div>
        {showWaterPanel && (
          <WaterPanel waters={currentScene.waters || []} selectedWaterId={selectedObjectId}
            onAddWater={addWater} onUpdateWater={updateWater} onSelectWater={setSelectedObjectId}
            onRemoveWater={(id) => { editHistory.current.push(snapshotOf(currentScene)); forgeSceneStore.save(currentSceneId!, { waters: (currentScene.waters || []).filter(w => w.id !== id) }); setSelectedObjectId(null); }} />
        )}
        {showTerrainPanel && (() => {
          const terrains = sceneTerrains(currentScene);
          const active = terrains.find((t) => t.id === activeTerrainId) ?? terrains[0];
          return (
            <TerrainPanel brushMode={terrainBrush} onBrushModeChange={setTerrainBrush}
              brushSize={brushSize} onBrushSizeChange={setBrushSize} brushStrength={brushStrength}
              onBrushStrengthChange={setBrushStrength} terrainColor={terrainColor} onTerrainColorChange={setTerrainColor}
              terrainOffset={active?.offset ?? [0, 0, 0]} terrainSize={active?.size ?? 120}
              onTerrainOffset={(o) => active?.id && patchTerrain(active.id, { offset: o })}
              onTerrainSize={(s) => active?.id && patchTerrain(active.id, { size: s })}
              terrains={terrains.map((t, i) => ({ id: t.id!, label: `Terrain ${i + 1} · ${t.size}m` }))}
              activeTerrainId={active?.id} onSelectTerrain={setActiveTerrainId}
              onAddTerrain={addTerrain} onRemoveTerrain={removeTerrain} />
          );
        })()}
        {showLayersPanel && (
          <LayersPanel layers={layers} activeLayer={activeLayer} onSetActive={setActiveLayer}
            onAddLayer={() => setLayers(prev => [...prev, { id: newId("layer"), name: `Calque ${prev.length + 1}`, visible: true, locked: false, color: ['#f06292','#81c784','#ffb74d','#ce93d8','#4db6ac','#e57373','#64b5f6'][prev.length % 7] }])}
            onToggleVisibility={(id) => setLayers(prev => prev.map(l => l.id === id ? { ...l, visible: !l.visible } : l))}
            onToggleLock={(id) => setLayers(prev => prev.map(l => l.id === id ? { ...l, locked: !l.locked } : l))}
            onRename={(id, name) => setLayers(prev => prev.map(l => l.id === id ? { ...l, name } : l))}
            onRemoveLayer={(id) => { if (layers.length > 1) { setLayers(prev => prev.filter(l => l.id !== id)); if (activeLayer === id) setActiveLayer(layers[0].id); } }}
            objects={(currentScene.objects || []).map(o => ({ id: o.id, label: o.model.split('/').pop()?.replace(/\.glb$/i, '') || o.id }))}
            selectedObjectId={selectedObjectId}
            onSelectObject={(id) => { setSelectedObjectId(id); setToolMode('translate'); }}
            onRemoveObject={removeObject} />
        )}
        {showOutliner && (
          <ForgeOutliner
            objects={currentScene.objects || []}
            selectedObjectId={selectedObjectId}
            onSelectObject={(id) => { setSelectedObjectId(id); setToolMode('translate'); }}
            onRemoveObject={removeObject}
            onClose={() => setShowOutliner(false)} />
        )}
        {showSettingsPanel && <SettingsPanel settings={settings} onSettingsChange={setSettings} onClose={() => setShowSettingsPanel(false)} />}
        {showWeatherPanel && (
          <WeatherPanel preset={weatherPreset} onPresetChange={(p) => setWeatherPreset(p)}
            sunAngle={sunAngle} onSunAngleChange={setSunAngle} sunIntensity={sunIntensity}
            onSunIntensityChange={setSunIntensity} fogDensity={fogDensity} onFogDensityChange={setFogDensity}
            showShadows={showShadows} onShowShadowsChange={setShowShadows} />
        )}
        {showPrefabPanel && (
          <PrefabPanel prefabs={prefabs} onLoadPrefab={loadPrefab}
            onDeletePrefab={(id) => { setPrefabs(prev => prev.filter(p => p.id !== id)); const stored = JSON.parse(localStorage.getItem('forge_prefabs') || '[]'); localStorage.setItem('forge_prefabs', JSON.stringify(stored.filter((p: Prefab) => p.id !== id))); }}
            onClose={() => setShowPrefabPanel(false)} />
        )}
      </div>
      <StatusBar sceneName={currentScene.name} objectCount={currentScene.objects?.length || 0} waterCount={currentScene.waters?.length || 0}
        toolMode={toolMode} snapEnabled={settings.snapEnabled} snapStep={settings.snapStep}
        autoSaveInterval={settings.autoSaveInterval} lastSave={lastSaveT} />
    </div>
  );
}

function snap(v: number, step: number): number {
  return step > 0 ? Math.round(v / step) * step : v;
}
