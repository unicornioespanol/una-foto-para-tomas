import manifest from '../data/audio-manifest.json';
const normalize=text=>String(text).trim().replace(/[.!?¡¿]+$/g,'').toLocaleLowerCase('es');
function file(key,name){return {key,source:'file',lang:'es',src:new URL(`${manifest.basePath}${encodeURIComponent(name)}`,document.baseURI).href}}
export function storyAudio(id,route){const key=id==='end-story'?`${id}:${route}`:id;return manifest.story[key]?file(key,manifest.story[key]):null}
export function shortAudio(text){const entry=Object.entries(manifest.short).find(([,a])=>normalize(a.text)===normalize(text));return entry?file(entry[0],entry[1].file):null}
export function segmentsAudio(segments){return segments.length===1?shortAudio(segments[0].speechText??segments[0].text):null}
