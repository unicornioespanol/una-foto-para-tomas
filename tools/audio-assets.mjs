import {readFile} from 'node:fs/promises';
const manifest=JSON.parse(await readFile(new URL('../data/audio-manifest.json',import.meta.url),'utf8'));
export const audioFiles=[...new Set([...Object.values(manifest.story),...Object.values(manifest.short).map(a=>a.file)])];
export function recordedAudioAssets(){return {name:'recorded-book-audio',async generateBundle(){for(const name of audioFiles)this.emitFile({type:'asset',fileName:`assets/audio/${name}`,source:await readFile(new URL(`../assets/audio/${name}`,import.meta.url))})}}}
