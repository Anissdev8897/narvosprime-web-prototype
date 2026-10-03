import fs from 'fs';
import readline from 'readline';

const sqlPath = 'c:\\Users\\aniss\\OneDrive\\Bureau\\launcher_2\\2.61\\n_world.sql';
const rl = readline.createInterface({
    input: fs.createReadStream(sqlPath),
    terminal: false
});

let capture = false;
let tableName = '';

rl.on('line', (line) => {
    const match = line.match(/CREATE TABLE `([^`]+)`/);
    if (match) {
        const name = match[1];
        if (['monsters_templates', 'monsters_grades', 'monsters_spells', 'npcs_templates'].includes(name)) {
            capture = true;
            tableName = name;
            console.log(`\n--- TABLE: ${tableName} ---`);
        } else {
            capture = false;
        }
    }

    if (capture) {
        console.log(line);
        if (line.includes(');')) {
            capture = false;
        }
    }
});

rl.on('close', () => {
    process.exit(0);
});
