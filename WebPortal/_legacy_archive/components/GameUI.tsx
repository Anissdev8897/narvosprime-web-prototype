import React from 'react';
import * as THREE from 'three';
import { SceneMode, Faction, GlobalSettings, WindowPositions, SelectionState, CameraMode } from '../types';
import { PlayerEntity } from '../types';

// UI Components
import { InGameMenu } from './InGameMenu';
import { SettingsMenu } from './SettingsMenu';
import { BackupMenu } from './BackupMenu';
import { MapTransitionScreen } from './MapTransitionScreen';
import { DraggableUI } from './DraggableUI';
import { DofusHUD } from './DofusHUD';
import { InventoryMenu } from './InventoryMenu';
import { Radar } from './Radar';
import { MapView } from './MapView';
import { DialogueUI } from './DialogueUI';
import { DofusNpc } from '../data/dofusNpcs';
import { LevelingService } from '../services/levelingService';

// Services
import { uiPositionService } from '../services/uiPositionService';

interface GameUIProps {
    // États Globaux
    sceneMode: SceneMode;
    isPaused: boolean;
    isEditMode: boolean;
    showFullSettings?: boolean;
    showSettingsMenu?: boolean;
    isBackupMenuOpen?: boolean;
    showMapTransition?: boolean;
    showForge?: boolean;
    isTransitioning?: boolean;
    activePlanetId: string;
    transitionPlanetId?: string | null;
    isMapOpen?: boolean;
    showInventory?: boolean;
    cameraMode: CameraMode;

    // Configuration & Données
    settings: GlobalSettings;
    windowPositions?: WindowPositions;

    // Joueur
    player: PlayerEntity;

    // Éditeur
    maximizedView?: string | null;
    currentEditorTool?: string;
    currentSelectionMode?: 'vertex' | 'edge' | 'face' | 'object';
    transformMode?: 'translate' | 'rotate' | 'scale';
    transformSpace?: 'world' | 'local';
    selectedSpellId?: string | null;
    onSelectSpell?: (spellId: string) => void;
    currentAp?: number;
    currentMp?: number;

    // Refs (si nécessaire pour les callbacks, mais idéalement on passe des fonctions)
    scene?: THREE.Scene | null;
    camera?: THREE.Camera | null;
    entities?: THREE.Object3D[];

    // Actions & Setters
    onUpdateSettings?: (s: GlobalSettings) => void;
    setShowFullSettings?: (show: boolean) => void;
    setIsPaused?: (paused: boolean) => void;
    setShowSettingsMenu?: (show: boolean) => void;
    setShowInventory?: (show: boolean) => void;
    setIsBackupMenuOpen?: (open: boolean) => void;
    setWindowPositions?: (pos: WindowPositions | ((prev: WindowPositions) => WindowPositions)) => void;

    // Dialogue props
    selectedNpc?: DofusNpc | null;
    isDialogueOpen?: boolean;
    onCloseDialogue?: () => void;

    // Actions Jeu
    onExit: () => void;
    onSaveRequest?: () => void;
    onOpenBackups?: () => void;
    onOpenObjectCreation?: () => void;
    onResetScene?: () => void;

    // Actions Transition
    onMapTransitionComplete?: (planetId: string, faction: Faction, entityType: any) => void;
    onCloseMap?: () => void;

    // Actions Éditeur
    setMaximizedView?: (view: string | null) => void;
    onImportModel?: (file: File) => void;
    onToolChange?: (tool: string) => void;
    onSelectionModeChange?: (mode: 'vertex' | 'edge' | 'face' | 'object') => void;
    onToolExecute?: (tool: string) => void;
    onTransformModeChange?: (mode: 'translate' | 'rotate' | 'scale') => void;

    // Callbacks complexes (pour DataCenter notamment)
    onObjectDelete?: (object: THREE.Object3D) => void;
    onModelDeleted?: (id: string) => void;
    onDeleteAllObjects?: () => void;
    onDeleteSelected?: () => void;

    // Combat Props
    isFightActive?: boolean;
    currentTurnTime?: number;
    onEndTurn?: () => void;

    onAddCube?: () => void;
    onAddSphere?: () => void;
    onModelImported?: (model: any) => void;
    onMaterialUpdate?: (config: any) => void;
    onTransformUpdate?: (type: string, axis: string, value: number) => void;
    onEquip?: (itemId: string) => void;
}

export const GameUI: React.FC<GameUIProps> = ({
    sceneMode,
    isPaused,
    isEditMode,
    showFullSettings = false,
    showSettingsMenu = false,
    isBackupMenuOpen = false,
    showMapTransition = false,
    showForge = false,
    isTransitioning = false,
    activePlanetId,
    transitionPlanetId = null,
    isMapOpen = false,
    showInventory = false,
    setShowInventory,
    cameraMode,
    settings,
    windowPositions = {},
    player,
    maximizedView = null,
    currentEditorTool = 'select',
    currentSelectionMode = 'object',
    transformMode = 'translate',
    transformSpace = 'world',
    selectedSpellId = null,
    onSelectSpell,
    currentAp = 6,
    currentMp = 3,
    scene = null,
    camera = null,
    entities = [],
    onUpdateSettings,
    setShowFullSettings,
    setIsPaused,
    setShowSettingsMenu,
    setIsBackupMenuOpen,
    setWindowPositions,
    onExit,
    onSaveRequest,
    onOpenBackups,
    onOpenObjectCreation,
    onResetScene,
    onMapTransitionComplete,
    onCloseMap,
    setMaximizedView,
    onImportModel,
    onToolChange,
    onSelectionModeChange,
    onToolExecute,
    onAddCube,
    onEquip,
    selectedNpc = null,
    isDialogueOpen = false,
    onCloseDialogue,
    isFightActive,
    currentTurnTime,
    onEndTurn
}) => {

    // Safe handlers with null checks
    const handleSetShowFullSettings = (show: boolean) => setShowFullSettings?.(show);
    const handleSetIsPaused = (paused: boolean) => setIsPaused?.(paused);
    const handleSetShowSettingsMenu = (show: boolean) => setShowSettingsMenu?.(show);
    const handleSetIsBackupMenuOpen = (open: boolean) => setIsBackupMenuOpen?.(open);
    const handleSetShowInventory = (show: boolean) => setShowInventory?.(show);
    const handleOnUpdateSettings = (s: GlobalSettings) => onUpdateSettings?.(s);

    return (
        <>
            {/* Menu de jeu (Échap) */}
            {showFullSettings && !showSettingsMenu && onUpdateSettings && (
                <InGameMenu
                    settings={settings}
                    onUpdate={handleOnUpdateSettings}
                    onResume={() => {
                        handleSetShowFullSettings(false);
                        handleSetIsPaused(false);
                    }}
                    onOpenFullSettings={() => handleSetShowSettingsMenu(true)}
                    onExit={onExit}
                    onSaveRequest={onSaveRequest}
                    onOpenBackups={onOpenBackups}
                    onOpenObjectCreation={onOpenObjectCreation}
                />
            )}

            {/* Menu SYSTEM CONFIGURATION */}
            {showSettingsMenu && onUpdateSettings && (
                <SettingsMenu
                    settings={settings}
                    onUpdate={handleOnUpdateSettings}
                    onClose={() => handleSetShowSettingsMenu(false)}
                    onReset={onResetScene}
                />
            )}

            {/* Menu BACKUP MANAGER */}
            {isBackupMenuOpen && scene && (
                <BackupMenu
                    planetId={activePlanetId}
                    sceneMode={sceneMode}
                    scene={scene}
                    onClose={() => handleSetIsBackupMenuOpen(false)}
                    onRestore={async (backupData) => {
                        console.log('📦 [BACKUP] Restauration demandée:', backupData);
                        if (confirm('La restauration va recharger la page. Continuer ?')) {
                            window.location.reload();
                        }
                    }}
                />
            )}

            {/* Menu INVENTAIRE */}
            {showInventory && (
                <InventoryMenu
                    inventory={player.inventory}
                    equippedItems={player.equippedItems}
                    onClose={() => handleSetShowInventory(false)}
                    onEquip={onEquip}
                />
            )}

            {/* Écran de transition de map */}
            {showMapTransition && transitionPlanetId && onMapTransitionComplete && (
                <MapTransitionScreen
                    planetId={transitionPlanetId}
                    onComplete={() => {
                        const pendingData = (window as any).__pendingTeleportation;
                        if (pendingData) {
                            onMapTransitionComplete(
                                pendingData.planetId,
                                pendingData.faction,
                                pendingData.entityType
                            );
                            delete (window as any).__pendingTeleportation;
                        }
                    }}
                />
            )}


            {/* HUD et Identité du Joueur */}
            {/* HUD Dofus (Toujours visible car on est en version Dofus) */}
            <DofusHUD
                playerFaction={player.faction}
                stats={player.stats}
                currentAp={currentAp}
                currentMp={currentMp}
                level={player.level}
                experience={player.experience}
                xpToNextLevel={LevelingService.getExperienceForLevel(player.level + 1)}
                playerName={player.rpIdentity?.firstName || player.name}
                selectedSpellId={selectedSpellId}
                onSelectSpell={onSelectSpell}
                onOpenInventory={() => handleSetShowInventory(true)}
                onOpenSettings={() => handleSetShowSettingsMenu(true)}
                isFightActive={isFightActive}
                currentTurnTime={currentTurnTime}
                onEndTurn={onEndTurn}
            />

            {/* Dialogue UI */}
            {isDialogueOpen && selectedNpc && (
                <DialogueUI
                    npc={selectedNpc}
                    onClose={onCloseDialogue || (() => { })}
                />
            )}

            {/* Radar */}
            {!isPaused && !showFullSettings && !showForge && !isTransitioning && setWindowPositions && (
                <DraggableUI
                    position={windowPositions?.radar}
                    onPositionChange={(x, y) => {
                        setWindowPositions(prev => ({ ...prev, radar: { x, y } }));
                        uiPositionService.savePositions({ ...windowPositions, radar: { x, y } } as any);
                    }}
                    enabled={isEditMode}
                    defaultPosition="bottom-left"
                >
                    <div className="pointer-events-auto z-40">
                        <Radar
                            playerPosition={player.position}
                            playerRotation={0}
                            range={5}
                            entities={entities}
                            playerFaction={player.faction}
                            playerReputation={player.reputation || {}}
                        />
                    </div>
                </DraggableUI>
            )}



            {/* Carte (M) */}
            {isMapOpen && (
                <MapView
                    isOpen={isMapOpen}
                    onClose={onCloseMap}
                    playerPosition={player.position}
                    playerFaction={player.faction}
                    planetId={activePlanetId}
                    sceneMode={sceneMode}
                />
            )}

        </>
    );
};
