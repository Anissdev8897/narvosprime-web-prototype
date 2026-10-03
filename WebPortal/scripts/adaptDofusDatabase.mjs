/**
 * 🔄 ADAPTATION DES BASES DOFUS VERS WORLDNEVAROS
 * Ce script lit les dumps SQL Dofus (n_auth, n_world, nibirux) et génère un script SQL compatible.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Chemins vers les dumps Dofus
const DOFUS_DUMPS = {
    n_auth: 'C:\\Users\\aniss\\OneDrive\\Bureau\\launcher_2\\2.61\\n_auth.sql',
    n_world: 'C:\\Users\\aniss\\OneDrive\\Bureau\\launcher_2\\2.61\\n_world.sql',
    nibirux_auth: 'C:\\Users\\aniss\\OneDrive\\Bureau\\launcher_2\\2.61\\nibirux_auth.sql',
    nibirux_world: 'C:\\Users\\aniss\\OneDrive\\Bureau\\launcher_2\\2.61\\nibirux_world.sql'
};

// Tables à extraire et adapter
const TABLES_TO_EXTRACT = [
    // Auth tables
    { source: 'n_auth', table: 'groups', target: 'dofus_groups' },
    { source: 'n_auth', table: 'worlds_characters', target: 'dofus_worlds_characters' },
    { source: 'n_auth', table: 'mounts_bonus', target: 'dofus_mounts_bonus' },

    // World tables
    { source: 'n_world', table: 'breeds', target: 'dofus_breeds' },
    { source: 'n_world', table: 'experience_templates', target: 'dofus_experience' },
    { source: 'n_world', table: 'spells_templates', target: 'dofus_spells' },
    { source: 'n_world', table: 'monsters_templates', target: 'dofus_monsters' },
    { source: 'n_world', table: 'items_templates', target: 'dofus_items' },
    // { source: 'n_world', table: 'npcs_templates', target: 'dofus_npcs' }, // Disabled: contains multi-line corrupted data
    { source: 'n_world', table: 'maps', target: 'dofus_maps' },
    { source: 'n_world', table: 'areas', target: 'dofus_areas' },
    { source: 'n_world', table: 'subareas', target: 'dofus_subareas' },
    { source: 'n_world', table: 'quest_templates', target: 'dofus_quests' },
    { source: 'n_world', table: 'interactives_templates', target: 'dofus_interactives' },
];

function extractTableDefinition(content, tableName) {
    // Regex pour trouver CREATE TABLE + tout jusqu'à ENGINE= ou ;
    const createRegex = new RegExp(
        `CREATE TABLE (?:IF NOT EXISTS )?[\`']?${tableName}[\`']?\\s*\\([^;]+\\)(?:\\s*ENGINE=[^;]+)?;`,
        'i'
    );

    const match = content.match(createRegex);
    if (match) {
        return match[0];
    }

    // Essai plus permissif
    const startIndex = content.indexOf(`CREATE TABLE \`${tableName}\``);
    if (startIndex === -1) return null;

    let endIndex = content.indexOf(';', startIndex);
    if (endIndex === -1) return null;

    return content.substring(startIndex, endIndex + 1);
}

function extractInsertStatements(content, tableName) {
    const inserts = [];
    // Match exact table name followed by space, backtick, or parenthesis - not underscore (to avoid breeds matching breeds_heads)
    const regex = new RegExp(`INSERT INTO [\`']?${tableName}[\`']?(?:\\s|\\(|VALUES)[^;]+;`, 'gi');
    let match;
    while ((match = regex.exec(content)) !== null) {
        // Double check: ensure we're not matching a longer table name
        const insertMatch = match[0];
        const tableNamePattern = new RegExp(`INSERT INTO [\`']?${tableName}[\`']?(?:\\s|\\(|VALUES)`, 'i');
        if (tableNamePattern.test(insertMatch) && !insertMatch.includes(`${tableName}_`)) {
            inserts.push(insertMatch);
        }
    }
    return inserts;
}

function renameTable(sql, oldName, newName) {
    // Only rename table names in CREATE TABLE and INSERT INTO, not column definitions
    let result = sql;

    // Replace CREATE TABLE `oldName` with CREATE TABLE `newName`
    result = result.replace(
        new RegExp(`CREATE TABLE (?:IF NOT EXISTS )?[\`']?${oldName}[\`']?`, 'gi'),
        `CREATE TABLE \`${newName}\``
    );

    // Replace INSERT INTO `oldName` with INSERT INTO `newName`
    result = result.replace(
        new RegExp(`INSERT INTO [\`']?${oldName}[\`']?`, 'gi'),
        `INSERT INTO \`${newName}\``
    );

    return result;
}

async function main() {
    console.log('═══════════════════════════════════════════════════════');
    console.log('🔄 ADAPTATION DES BASES DOFUS VERS WORLDNEVAROS');
    console.log('═══════════════════════════════════════════════════════\n');

    const outputSql = [];
    outputSql.push(`-- AUTO-GENERATED: Adaptation Dofus -> WorldNevaros`);
    outputSql.push(`-- Generated: ${new Date().toISOString()}`);
    outputSql.push(`SET NAMES utf8mb4;`);
    outputSql.push(`SET FOREIGN_KEY_CHECKS = 0;\n`);

    // Charger les dumps
    const dumps = {};
    for (const [key, filePath] of Object.entries(DOFUS_DUMPS)) {
        console.log(`📂 Chargement: ${key}...`);
        try {
            dumps[key] = fs.readFileSync(filePath, 'utf8');
            console.log(`   ✅ ${(dumps[key].length / 1024 / 1024).toFixed(2)} MB chargés`);
        } catch (err) {
            console.log(`   ⚠️ Fichier non trouvé: ${filePath}`);
            dumps[key] = '';
        }
    }

    // Extraire les tables
    console.log('\n📊 Extraction des tables...');
    for (const { source, table, target } of TABLES_TO_EXTRACT) {
        const content = dumps[source];
        if (!content) {
            console.log(`   ⏭️ Source ${source} non disponible pour ${table}`);
            continue;
        }

        const createDef = extractTableDefinition(content, table);
        const inserts = extractInsertStatements(content, table);

        if (createDef) {
            console.log(`   ✅ ${table} -> ${target} (${inserts.length} inserts)`);

            // Ajouter DROP + CREATE renommé
            outputSql.push(`-- Table: ${target} (from ${source}.${table})`);
            outputSql.push(`DROP TABLE IF EXISTS \`${target}\`;`);
            outputSql.push(renameTable(createDef, table, target));
            outputSql.push('');

            // Ajouter les INSERTs (limités pour éviter fichier trop gros)
            const maxInserts = 100;
            for (let i = 0; i < Math.min(inserts.length, maxInserts); i++) {
                outputSql.push(renameTable(inserts[i], table, target));
            }
            if (inserts.length > maxInserts) {
                outputSql.push(`-- ... ${inserts.length - maxInserts} more inserts truncated`);
            }
            outputSql.push('');
        } else {
            console.log(`   ❌ Table ${table} non trouvée dans ${source}`);
        }
    }

    outputSql.push(`SET FOREIGN_KEY_CHECKS = 1;`);
    outputSql.push(`-- End of adaptation script`);

    // Écrire le fichier de sortie
    const outputPath = path.join(__dirname, 'dofus_adaptation.sql');
    fs.writeFileSync(outputPath, outputSql.join('\n'), 'utf8');
    console.log(`\n✅ Script SQL généré: ${outputPath}`);
    console.log(`   Taille: ${(outputSql.join('\n').length / 1024).toFixed(2)} KB`);

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('📝 PROCHAINES ÉTAPES:');
    console.log('   1. Exécutez: mysql -u root worldnevaros < scripts/dofus_adaptation.sql');
    console.log('   2. Ou importez via phpMyAdmin / Navicat');
    console.log('═══════════════════════════════════════════════════════');
}

main().catch(console.error);
