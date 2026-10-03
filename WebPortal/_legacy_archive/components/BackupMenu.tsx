
import React, { useState, useEffect } from 'react';
import { Save, Trash2, RotateCcw, X, Plus, Clock } from 'lucide-react';
import { sceneSaveService, SavedSceneObject, GlobalSceneSettings } from '../services/sceneSaveService';
import { SceneMode } from '../types';
import * as THREE from 'three';

interface BackupMenuProps {
    planetId: string | null;
    sceneMode: SceneMode;
    scene: THREE.Scene;
    onClose: () => void;
    onRestore: (backupData: any) => Promise<void>;
    getSettings?: () => GlobalSceneSettings; // ✅ NOUVEAU
}

export const BackupMenu: React.FC<BackupMenuProps> = ({ planetId, sceneMode, scene, onClose, onRestore, getSettings }) => {
    const [backups, setBackups] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [newBackupName, setNewBackupName] = useState('');
    const [creating, setCreating] = useState(false);

    // Charger la liste des backups
    useEffect(() => {
        loadBackups();
    }, [planetId, sceneMode]);

    const loadBackups = async () => {
        setLoading(true);
        try {
            const list = await sceneSaveService.getBackups(planetId, sceneMode);
            // Trier par date décroissante
            setBackups(list.sort((a, b) => b.timestamp - a.timestamp));
        } catch (error) {
            console.error('Erreur chargement backups:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateBackup = async () => {
        if (!newBackupName.trim()) return;
        setCreating(true);

        // Récupérer les settings globaux si possible (pour l'instant vide, à adapter si besoin)
        // Idéalement on passerait les settings en prop

        // ✅ NOUVEAU : Récupérer les settings globaux via la prop
        const settings: GlobalSceneSettings | undefined = getSettings ? getSettings() : undefined;

        // Récupérer les deletedObjectIds (complexe à avoir ici sans context, on assume vide pour un snapshot manuel)
        // Un backup manuel est souvent un point de référence. 
        // TODO: Si on veut sauvegarder ET les objets supprimés, il faudrait que GameEngine les passe.
        // Pour l'instant, on fait un snapshot des objets PRÉSENTS.

        const createdId = await sceneSaveService.createBackup(
            scene,
            planetId,
            sceneMode,
            newBackupName.trim(),
            [], // deletedObjectIds (vide pour snapshot visuel)
            settings
        );

        if (createdId) {
            setNewBackupName('');
            await loadBackups();
        }
        setCreating(false);
    };

    const handleRestore = async (backupId: number) => {
        if (confirm('⚠️ Attention : Restaurer ce backup va remplacer la scène actuelle. Sauvegardez d\'abord si nécessaire. Continuer ?')) {
            // 1. Charger les données du backup
            const backupData = await sceneSaveService.loadBackup(backupId);
            if (backupData) {
                // 2. Demander au parent (GameEngine) de restaurer
                await onRestore(backupData);
                onClose();
            }
        }
    };

    const handleDelete = async (backupId: number) => {
        if (confirm('Voulez-vous vraiment supprimer ce backup ?')) {
            const success = await sceneSaveService.deleteBackup(backupId);
            if (success) {
                setBackups(prev => prev.filter(b => b.id !== backupId));
            }
        }
    };

    const handleOverwrite = async (backupId: number, backupName: string) => {
        if (confirm(`⚠️ Attention : Écraser le backup "${backupName}" avec l'état actuel de la scène ? Cette action est irréversible.`)) {
            setCreating(true);

            // Récupérer les settings globaux
            const settings: GlobalSceneSettings | undefined = getSettings ? getSettings() : undefined;

            // Supprimer l'ancien backup
            await sceneSaveService.deleteBackup(backupId);

            // Créer un nouveau backup avec le même nom
            const createdId = await sceneSaveService.createBackup(
                scene,
                planetId,
                sceneMode,
                backupName,
                [],
                settings
            );

            if (createdId) {
                await loadBackups();
            }
            setCreating(false);
        }
    };

    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleString();
    };

    return (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm text-white z-[100]">
            <div className="w-[600px] h-[700px] bg-slate-900 border border-slate-700 flex flex-col shadow-2xl rounded-lg overflow-hidden">

                {/* Header */}
                <div className="bg-slate-800 p-4 border-b border-slate-700 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <Save className="text-blue-400" />
                        <div>
                            <h2 className="text-xl font-bold tracking-wide">BACKUP MANAGER</h2>
                            <div className="text-xs text-slate-400 font-mono">
                                {planetId ? planetId.toUpperCase() : 'SPACE'} • {sceneMode}
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Create New Section */}
                <div className="p-4 bg-slate-800/50 border-b border-slate-700">
                    <label className="text-xs text-slate-400 uppercase font-bold mb-2 block">New Snapshot</label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newBackupName}
                            onChange={(e) => setNewBackupName(e.target.value)}
                            placeholder="Ex: Before terraforming..."
                            className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none"
                            onKeyDown={(e) => e.key === 'Enter' && handleCreateBackup()}
                        />
                        <button
                            onClick={handleCreateBackup}
                            disabled={creating || !newBackupName.trim()}
                            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded flex items-center gap-2 font-bold text-sm transition-colors"
                        >
                            <Plus size={16} />
                            {creating ? 'SAVING...' : 'CREATE'}
                        </button>
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-900">
                    {loading ? (
                        <div className="text-center text-slate-500 py-10 animate-pulse">Loading backups...</div>
                    ) : backups.length === 0 ? (
                        <div className="text-center text-slate-500 py-10 flex flex-col items-center gap-2">
                            <Clock size={32} className="opacity-20" />
                            <div>No backups found for this scene.</div>
                        </div>
                    ) : (
                        backups.map(backup => (
                            <div key={backup.id} className="bg-slate-800 border border-slate-700 rounded-lg p-3 hover:border-slate-600 transition-colors group">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <div className="font-bold text-slate-200">{backup.name || 'Untitled Backup'}</div>
                                        <div className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                                            <Clock size={10} />
                                            {formatDate(backup.timestamp)}
                                        </div>
                                    </div>
                                    <div className="text-xs bg-slate-900 text-slate-400 px-2 py-1 rounded font-mono">
                                        v{backup.version}
                                    </div>
                                </div>

                                <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-slate-700/50 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => handleDelete(backup.id)}
                                        className="p-2 hover:bg-red-900/50 text-slate-500 hover:text-red-400 rounded transition-colors"
                                        title="Delete Backup"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleOverwrite(backup.id, backup.name)}
                                        disabled={creating}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-orange-600/20 hover:bg-orange-600/40 text-orange-400 hover:text-orange-200 border border-orange-600/30 rounded text-xs font-bold transition-all disabled:opacity-50"
                                        title="Overwrite with current scene state"
                                    >
                                        <Save size={14} />
                                        OVERWRITE
                                    </button>
                                    <button
                                        onClick={() => handleRestore(backup.id)}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-green-600/20 hover:bg-green-600/40 text-green-400 hover:text-green-200 border border-green-600/30 rounded text-xs font-bold transition-all"
                                    >
                                        <RotateCcw size={14} />
                                        RESTORE TO SCENE
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

            </div>
        </div>
    );
};
