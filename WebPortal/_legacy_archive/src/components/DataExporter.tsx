
import React, { useState } from 'react';
import { Download, Database, FileCode, CheckCircle2 } from 'lucide-react';
import { getAllItems, queryMySQL } from '../utils/storage';
import { SavedCharacter, SavedMap, SavedSprite, SavedFactionMap, SavedObject } from '../types';
import { NARVOS_CLASSES } from '../narvos-data';

export const DataExporter: React.FC<{ currentUsername?: string | null }> = ({ currentUsername }) => {
    const [isExporting, setIsExporting] = useState(false);
    const [exportStatus, setExportStatus] = useState<string | null>(null);

    const escapeSql = (str: string | undefined | null) => {
        if (!str) return "NULL";
        return "'" + str.replace(/'/g, "''").replace(/\\/g, "\\\\") + "'";
    };

    const handleExport = async () => {
        setIsExporting(true);
        setExportStatus("Récupération des données locales...");

        try {
            const sprites = await getAllItems<SavedSprite>('sprites');
            const maps = await getAllItems<SavedMap>('maps');
            const factionMaps = await getAllItems<SavedFactionMap>('faction_maps');
            const characters = await getAllItems<SavedCharacter>('characters');
            const objects = await getAllItems<SavedObject>('objects');

            let sqlContent = `-- EXPORT DU ${new Date().toISOString()}\n`;
            sqlContent += `-- Importez ce fichier dans votre base 'worldnevaros' pour sauvegarder vos données locales.\n\n`;
            sqlContent += `USE \`worldnevaros\`;\n`;
            sqlContent += `SET NAMES utf8mb4;\n`;
            sqlContent += `-- NOTE: Si l'import échoue (paquet trop grand), exécutez 'SET GLOBAL max_allowed_packet = 67108864;' \n`;
            sqlContent += `-- dans l'onglet SQL de PhpMyAdmin, PUIS DECONNECTEZ/RECONNECTEZ-VOUS avant d'importer.\n\n`;

            sqlContent += `-- === BREEDS (${NARVOS_CLASSES.length}) ===\n`;
            NARVOS_CLASSES.forEach(nc => {
                const colorsJson = JSON.stringify(nc.colors);
                const statsJson = JSON.stringify(nc.stats);
                sqlContent += `INSERT INTO breeds (id, name, role_title, description, colors_json, stats_json) VALUES (${escapeSql(nc.id)}, ${escapeSql(nc.name)}, ${escapeSql(nc.roleTitle)}, ${escapeSql(nc.description)}, ${escapeSql(colorsJson)}, ${escapeSql(statsJson)}) ON DUPLICATE KEY UPDATE name=VALUES(name), role_title=VALUES(role_title);\n`;
            });
            sqlContent += `\n`;

            // 1. SPRITES
            sqlContent += `-- === SPRITES (${sprites.length}) ===\n`;
            sprites.forEach(s => {
                sqlContent += `INSERT IGNORE INTO class_sprites (id, sprite_data, created_at) VALUES (${escapeSql(s.id)}, ${escapeSql(s.dataUrl)}, NOW());\n`;
            });
            sqlContent += `\n`;

            // 2. GENERATED MAPS
            sqlContent += `-- === GENERATED MAPS (${maps.length}) ===\n`;
            maps.forEach(m => {
                if (m.imageUrl && m.imageUrl.includes('meshy.ai')) return; // SKIP MESHY
                const propsJson = JSON.stringify(m.props);
                sqlContent += `INSERT IGNORE INTO generated_maps_2d (id, image_url, props_json, created_at) VALUES (${escapeSql(m.id)}, ${escapeSql(m.imageUrl)}, ${escapeSql(propsJson)}, NOW());\n`;
            });
            sqlContent += `\n`;

            // 3. FACTION MAPS
            sqlContent += `-- === FACTION MAPS (${factionMaps.length}) ===\n`;
            factionMaps.forEach(fm => {
                if (fm.imageUrl && fm.imageUrl.includes('meshy.ai')) return; // SKIP MESHY
                const propsJson = JSON.stringify(fm.props);
                sqlContent += `INSERT IGNORE INTO faction_maps (id, name, theme, image_url, props_json, created_at) VALUES (${escapeSql(fm.id)}, ${escapeSql(fm.name)}, ${escapeSql(fm.theme)}, ${escapeSql(fm.imageUrl)}, ${escapeSql(propsJson)}, NOW());\n`;
            });
            sqlContent += `\n`;

            // 4. OBJECTS
            sqlContent += `-- === OBJECTS (${objects.length}) ===\n`;
            objects.forEach(obj => {
                sqlContent += `INSERT IGNORE INTO game_objects_2d (id, name, image_url, type) VALUES (${escapeSql(obj.id)}, ${escapeSql(obj.name)}, ${escapeSql(obj.url)}, 'prop');\n`;
            });
            sqlContent += `\n`;

            // 5. CHARACTERS
            sqlContent += `-- === CHARACTERS (${characters.length}) ===\n`;

            // On tente d'associer au bon user_id si on peut interroger la DB via Electron
            let activeUserId = 1;
            if (currentUsername) {
                try {
                    const userRes = await queryMySQL('SELECT id FROM users WHERE username = ?', [currentUsername]);
                    if (userRes.data && userRes.data.length > 0) {
                        activeUserId = userRes.data[0].id;
                    }
                } catch (e) {
                    console.error("Failed to map user_id for export:", e);
                }
            }

            characters.forEach(c => {
                const customization = JSON.stringify({
                    colors: c.colors,
                    headIndex: c.headIndex,
                    serverType: c.serverType || 'NORMAL',
                    isDead: c.isDead || false
                });
                const position = JSON.stringify(c.lastMap || { x: 5, y: 5 });
                const serverId = c.serverType === 'HEROIC' ? 'heroic_1' : 'normal_1';

                sqlContent += `INSERT INTO characters (id, user_id, server_id, name, class_id, gender, level, experience, faction, customization_json, position_json, created_at) VALUES (${escapeSql(c.id)}, ${activeUserId}, ${escapeSql(serverId)}, ${escapeSql(c.name)}, ${escapeSql(c.classId)}, ${c.gender === 'F' ? "'FEMALE'" : "'MALE'"}, ${c.level}, ${c.stats?.experience || 0}, 'NEUTRAL', ${escapeSql(customization)}, ${escapeSql(position)}, FROM_UNIXTIME(${Math.floor(c.createdAt / 1000)})) ON DUPLICATE KEY UPDATE server_id=VALUES(server_id), customization_json=VALUES(customization_json);\n`;
            });

            // 1. Try File System Access API (Save As...)
            try {
                // @ts-ignore - Modern API check
                if (window.showSaveFilePicker) {
                    // @ts-ignore
                    const handle = await window.showSaveFilePicker({
                        suggestedName: `backup_worldnevaros.sql`,
                        types: [{
                            description: 'SQL File',
                            accept: { 'text/plain': ['.sql'] },
                        }],
                    });
                    const writable = await handle.createWritable();
                    await writable.write(sqlContent);
                    await writable.close();

                    setExportStatus(`Sauvegardé ! (File System)`);
                    setTimeout(() => { setIsExporting(false); setExportStatus(null); }, 3000);
                    return;
                }
            } catch (err) {
                console.log("Save Picker cancelled or not supported, falling back to download...", err);
                // If user cancelled, we stop here. If error, we continue to fallback.
                if ((err as Error).name === 'AbortError') {
                    setIsExporting(false);
                    setExportStatus(null);
                    return;
                }
            }

            // 2. Fallback: Standard Browser Download
            const blob = new Blob([sqlContent], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = "backup_worldnevaros.sql";
            document.body.appendChild(a);
            a.click();

            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                setIsExporting(false);
                setExportStatus(null);
            }, 2000);

            setExportStatus(`Fichier téléchargé !`);
        } catch (err: any) {
            console.error(err);
            setExportStatus("Erreur: " + err.message);
            setIsExporting(false);
        }
    };

    return (
        <div className="fixed bottom-4 left-4 z-50">
            <button
                onClick={handleExport}
                disabled={isExporting}
                className="bg-slate-900/90 border border-cyan-500/30 text-cyan-400 p-3 rounded-xl shadow-lg hover:bg-slate-800 transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-widest backdrop-blur-md"
            >
                {isExporting ? <Database className="animate-pulse" size={16} /> : <Download size={16} />}
                {isExporting ? 'Export...' : 'Sauvegarder en SQL'}
            </button>
            {exportStatus && (
                <div className="absolute bottom-full left-0 mb-2 w-64 bg-black/90 border border-green-500/30 p-3 rounded-lg text-xs text-green-400 font-mono shadow-xl animate-fade-in">
                    {exportStatus}
                </div>
            )}
        </div>
    );
};
