import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root = new URL('../../', import.meta.url);
const manifest = new URL('WebPortal/Server/Assets/narvos/Assets.toml',root);
const hash = () => createHash('sha256').update(fs.readFileSync(manifest)).digest('hex');
const before = hash();
for (const args of [[],['--staging','../Assets'],['--staging','D:/autre'],['--staging','..'],['--staging','']]) {
 const result=spawnSync(process.execPath,['scripts/nanos-build-asset-pack.mjs','--apply',...args],{cwd:root,encoding:'utf8'});
 assert.equal(result.status,1);
 assert.match(result.stderr,/exige --staging/);
}
assert.equal(hash(),before,'Le pack actif reste intact apres refus');
console.log('Staging pack : 11 assertions OK');