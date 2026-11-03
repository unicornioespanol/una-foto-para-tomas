import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {StoryEngine} from '../src/story-engine.js';
import {BrowserNarrator} from '../src/browser-narrator.js';
const root=new URL('../',import.meta.url);
const book=JSON.parse(readFileSync(new URL('data/story.json',root),'utf8'));
test('all references resolve and the narrative has 13 nodes',()=>{
 assert.equal(book.nodes.length,13);
 const ids=new Set(book.nodes.map(n=>n.id));assert.equal(ids.size,13);
 for(const n of book.nodes){if(n.next)assert(ids.has(n.next));for(const c of n.choices??[])assert(ids.has(c.to))}
});
for(const route of ['photo','drawing'])for(const ending of ['song','story'])test(`${route} × ${ending}: nine screens, correct ending and variants`,()=>{
 const e=new StoryEngine(book), visited=[e.current().id];
 while(!e.current().terminal){const n=e.current();if(n.id==='s04')e.choose(route==='photo'?'choose-photo':'choose-drawing');else if(n.id==='s08')e.choose(ending==='song'?'choose-song':'choose-story');else e.next();visited.push(e.current().id)}
 assert.equal(visited.length,9);assert.equal(e.state.route,route);assert.equal(e.state.ending,ending);assert(e.state.completed);
 assert(visited.includes(route==='photo'?'a06':'b06'));assert(!visited.some(id=>id.startsWith(route==='photo'?'b0':'a0')));
 if(ending==='story')assert.equal(e.current().segments[0].text.includes(route==='photo'?'tiene un gato':'tiene una guitarra'),true);
});
test('rewinding to first choice clears former ending and future history',()=>{
 const e=new StoryEngine(book);e.next();e.next();e.next();e.choose('choose-photo');e.next();e.next();e.next();e.choose('choose-song');
 while(e.current().id!=='s04')e.back();e.choose('choose-drawing');assert.equal(e.state.ending,null);assert.equal(e.current().id,'b05');assert(!e.state.history.some(x=>x.nodeId==='a06'));
});
test('choice page cannot be bypassed',()=>{const e=new StoryEngine(book);e.next();e.next();e.next();assert.throws(()=>e.next(),/Choice required/)});
function fake(voices=[{lang:'es-MX',voiceURI:'mx',name:'MX'}]){
 const synth={spoken:[],cancelCount:0,listeners:new Map(),getVoices:()=>voices,cancel(){this.cancelCount++},speak(u){this.spoken.push(u)},addEventListener(n,f){this.listeners.set(n,f)},removeEventListener(n){this.listeners.delete(n)}};
 class Utterance{constructor(text){this.text=text}}
 return {speechSynthesis:synth,SpeechSynthesisUtterance:Utterance};
}
const demo=[{id:'one',text:'Hola.'},{id:'two',text:'Una foto.'}];
test('late onend after stop cannot advance speech queue',()=>{const env=fake(),n=new BrowserNarrator({env});n.play(demo);const u=env.speechSynthesis.spoken[0];u.onstart();n.stop();u.onend();assert.equal(env.speechSynthesis.spoken.length,1);assert.equal(n.state,'idle');n.destroy()});
test('pause/resume restarts current phrase and then advances',()=>{const env=fake(),n=new BrowserNarrator({env});n.play(demo);env.speechSynthesis.spoken[0].onstart();n.pause();n.resume();const u=env.speechSynthesis.spoken[1];assert.equal(u.text,'Hola.');u.onstart();u.onend();const next=env.speechSynthesis.spoken[2];assert.equal(next.text,'Una foto.');next.onstart();next.onend();assert.equal(n.state,'ended');n.destroy()});
test('missing Spanish voice never selects English',()=>{const env=fake([{lang:'en-US',voiceURI:'en'}]),n=new BrowserNarrator({env});assert.equal(n.play(demo),false);assert.equal(n.state,'voice-unavailable');assert.equal(env.speechSynthesis.spoken.length,0);n.destroy()});
test('empty voice list can be refreshed after voiceschanged',()=>{const voices=[],env=fake(voices),n=new BrowserNarrator({env});n.play(demo);voices.push({lang:'es-ES',voiceURI:'es'});env.speechSynthesis.listeners.get('voiceschanged')();assert.equal(n.play(demo),true);n.destroy()});
test('rapid repeat ignores cancelled utterance events',()=>{const env=fake(),n=new BrowserNarrator({env});n.play(demo);const old=env.speechSynthesis.spoken[0];n.play([{id:'new',text:'Nuevo.'}]);old.onstart();old.onend();assert.equal(env.speechSynthesis.spoken.length,2);assert.equal(n.index,0);n.destroy()});
test('unsupported API and runtime speech error expose stable states',()=>{const n=new BrowserNarrator({env:{}});assert.equal(n.play(demo),false);assert.equal(n.state,'unsupported');n.destroy();const env=fake(),m=new BrowserNarrator({env});m.play(demo);env.speechSynthesis.spoken[0].onerror({error:'network'});assert.equal(m.state,'error');m.destroy()});
test('late end after speech error cannot continue the failed queue',()=>{const env=fake(),n=new BrowserNarrator({env});n.play(demo);const u=env.speechSynthesis.spoken[0];u.onerror({error:'network'});u.onend();assert.equal(env.speechSynthesis.spoken.length,1);assert.equal(n.state,'error');n.destroy()});

test('raster manifest links resolve; no rejected vectors are referenced',()=>{
 const manifest=JSON.parse(readFileSync(new URL('data/scene-manifest.json',root),'utf8'));
 assert.equal(manifest.scenes.length,13);
 assert(!JSON.stringify(manifest).includes('.svg'));
 for(const scene of manifest.scenes)for(const path of Object.values(scene.referenceImages))assert(existsSync(fileURLToPath(new URL(path,root))));
 assert.equal(manifest.artPipeline,'raster-png-webp');
});
