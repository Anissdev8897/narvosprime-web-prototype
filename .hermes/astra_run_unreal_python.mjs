import fs from 'node:fs';
import {outil} from '../scripts/lib/ue-mcp-client.mjs';
const file=process.argv[2];
if(!file) throw Error('Chemin Python requis');
console.log(await outil('execute_python',{code:fs.readFileSync(file,'utf8')}));