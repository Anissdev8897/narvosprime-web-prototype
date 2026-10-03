import fs from 'fs';
import readline from 'readline';

const sqlPath = 'c:\\Users\\aniss\\OneDrive\\Bureau\\launcher_2\\2.61\\n_world.sql';
const rl = readline.createInterface({
    input: fs.createReadStream(sqlPath),
    terminal: false
});

const tablesToExtract = ['items_templates', 'spells', 'monsters_templates', 'breeds'];
const results = {};

let currentTable = null;

rl.on('line', (line) => {
    // Check for start of INSERT
    for (const table of tablesToExtract) {
        if (line.startsWith(`INSERT INTO \`${table}\``)) {
            if (!results[table]) results[table] = [];
            // Simple regex to extract rows (values (...), (...))
            const valuesMatch = line.match(/\(([^)]+)\)/g);
            if (valuesMatch) {
                valuesMatch.forEach(v => {
                    results[table].push(v);
                });
            }
        }
    }

    // To avoid huge files, stop after 50 rows per table for inspiration
    for (const table of tablesToExtract) {
        if (results[table] && results[table].length > 100) {
            // Keep only first 100
            results[table] = results[table].slice(0, 100);
        }
    }
});

rl.on('close', () => {
    fs.writeFileSync('extracted_data.json', JSON.stringify(results, null, 2));
    console.log('Extraction complete! Check extracted_data.json');
    process.exit(0);
});
