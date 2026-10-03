import fs from 'fs';
import readline from 'readline';

const sqlPath = 'c:\\Users\\aniss\\OneDrive\\Bureau\\launcher_2\\2.61\\n_world.sql';
const rl = readline.createInterface({
    input: fs.createReadStream(sqlPath),
    terminal: false
});

let capture = false;

rl.on('line', (line) => {
    if (line.includes('CREATE TABLE `monsters_templates`')) {
        capture = true;
        console.log('--- MONSTERS_TEMPLATES ---');
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
