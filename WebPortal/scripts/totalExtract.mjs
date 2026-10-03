import fs from 'fs';
import readline from 'readline';

const sqlPath = 'c:\\Users\\aniss\\OneDrive\\Bureau\\launcher_2\\2.61\\n_world.sql';
const rl = readline.createInterface({
    input: fs.createReadStream(sqlPath),
    terminal: false
});

const tablesToExtract = [
    'breeds',
    'quest_templates',
    'quest_steps',
    'world_maps',
    'interactives_templates'
];

const results = {};

console.log('--- STARTING TOTAL EXTRACTION ---');

rl.on('line', (line) => {
    for (const table of tablesToExtract) {
        if (line.startsWith(`INSERT INTO \`${table}\``)) {
            if (!results[table]) results[table] = [];
            // Extraction plus généreuse (jusqu'à 200 lignes pour avoir toutes les classes/quêtes principales)
            if (results[table].length < 200) {
                const valuesMatch = line.match(/\(([^)]+)\)/g);
                if (valuesMatch) {
                    valuesMatch.forEach(v => {
                        if (results[table].length < 200) {
                            results[table].push(v);
                        }
                    });
                }
            }
        }
    }
});

rl.on('close', () => {
    fs.writeFileSync('c:\\mes_projets\\narvosprime-web-prototype\\total_extracted_data.json', JSON.stringify(results, null, 2));
    console.log('--- TOTAL EXTRACTION COMPLETE ---');
    process.exit(0);
});
