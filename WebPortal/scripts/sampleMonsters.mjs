import fs from 'fs';
import readline from 'readline';

const sqlPath = 'c:\\Users\\aniss\\OneDrive\\Bureau\\launcher_2\\2.61\\n_world.sql';
const rl = readline.createInterface({
    input: fs.createReadStream(sqlPath),
    terminal: false
});

let found = false;
let count = 0;

rl.on('line', (line) => {
    if (line.includes('INSERT INTO `monsters_templates`')) {
        found = true;
    }

    if (found) {
        console.log(line.substring(0, 1000)); // Limit line length for console
        count++;
        if (count > 5) {
            rl.close();
        }
    }
});

rl.on('close', () => {
    process.exit(0);
});
