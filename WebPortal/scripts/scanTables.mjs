import fs from 'fs';
import readline from 'readline';

const sqlPath = 'c:\\Users\\aniss\\OneDrive\\Bureau\\launcher_2\\2.61\\n_world.sql';
const rl = readline.createInterface({
    input: fs.createReadStream(sqlPath),
    terminal: false
});

console.log('--- STARTING TABLE SCAN ---');
rl.on('line', (line) => {
    if (line.includes('CREATE TABLE')) {
        console.log(line);
    }
});

rl.on('close', () => {
    console.log('--- SCAN COMPLETE ---');
});
