/**
 * forge/index.ts — Point d'entrée du module Forge Editor
 */

export { ForgeEditor } from './ForgeEditor';
export { ForgeBuiltMap } from './ForgeBuiltMap';
export { AssetBrowser, useForgeAssetPlacement } from './AssetBrowser';
export { ForgeBuilderScene } from './ForgeBuilderScene';
export { Toolbar, StatusBar } from './ForgeToolbar';
export { WaterPanel, TerrainPanel, LayersPanel, SettingsPanel, WeatherPanel, PrefabPanel, PropertySlider, ToggleSetting } from './ForgePanels';
export { forgeSceneStore, EditHistory, type ForgeObject, type ForgeWater, type WaterKind, type ForgeScene, type SceneSnapshot } from './forgeSceneStore';
export { scanAssets, type AssetEntry, type AssetCategory } from './assetScanner';

export type { ToolMode, EditorSettings } from './ForgeBuilderScene';
export type { Layer, Prefab } from './ForgePanels';
