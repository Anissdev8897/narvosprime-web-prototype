import fs from 'fs';
import readline from 'readline';

const sqlPath = 'c:\\Users\\aniss\\OneDrive\\Bureau\\launcher_2\\2.61\\n_world.sql';
const rl = readline.createInterface({
    input: fs.createReadStream(sqlPath),
    terminal: false
});

const tablesToExtract = [
    'npcs_templates',
    'world_subareas',
    'interactives_templates',
    'mounts_templates',
    'experience',
    'quest_templates',
    'quest_steps'
];

const results = {};

console.log('--- STARTING MASS EXTRACTION ---');

rl.on('line', (line) => {
    for (const table of tablesToExtract) {
        if (line.startsWith(`INSERT INTO \`${table}\``)) {
            if (!results[table]) results[table] = [];
            // Simple split/match for rows - limiting to 50 rows per table for now to avoid huge files
            if (results[table].length < 50) {
                const valuesMatch = line.match(/\(([^)]+)\)/g);
                if (valuesMatch) {
                    valuesMatch.forEach(v => {
                        if (results[table].length < 50) {
                            results[table].push(v);
                        }
                    });
                }
            }
        }
    }
});

rl.on('close', () => {
    fs.writeFileSync('c:\\mes_projets\\narvosprime-web-prototype\\mass_extracted_data.json', JSON.stringify(results, null, 2));
    console.log('--- MASS EXTRACTION COMPLETE ---');
    process.exit(0);
});
