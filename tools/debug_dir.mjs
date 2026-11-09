import {resolve} from 'node:path';import {readFileSync} from 'node:fs';
const root=resolve(import.meta.dirname,'..'); console.log(root);const f=readFileSync(resolve(root,'browser/flight.js'),'utf8'); console.log(f.length,f.includes('Stage 64: independent arcade'),f.includes('Stage 62: an external')); console.log(import.meta.url);
