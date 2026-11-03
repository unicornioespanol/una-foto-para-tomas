import {launchBrowser} from './browser.mjs';import assert from 'node:assert/strict';import {readFile,writeFile,mkdir} from 'node:fs/promises';
const base=process.env.BOOK_TEST_URL??'http://127.0.0.1:5173';const manifest=JSON.parse(await readFile('data/audio-manifest.json','utf8'));
const all=[...Object.entries(manifest.story),...Object.entries(manifest.short).map(([id,a])=>[id,a.file])];
const browser=await launchBrowser();const page=await browser.newPage({viewport:{width:1280,height:720}});page.setDefaultTimeout(12000);const errors=[];page.on('pageerror',e=>errors.push(e.message));await mkdir('test-results',{recursive:true});
const click=name=>page.getByRole('button',{name,exact:true}).click();
const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('book:una-foto-para-tomas:v1')));
async function media(){return page.evaluate(()=>window.__fileMedia?.filter(a=>a.src).at(-1)?.currentTime??null)}
async function waitPlay(){await page.waitForFunction(()=>window.__fileMedia?.some(a=>!a.paused&&a.currentTime>0),null,{timeout:12000})}
try{
 await page.addInitScript(()=>{window.__fileMedia=[];const Original=window.Audio;window.Audio=class extends Original{constructor(...args){super(...args);window.__fileMedia.push(this)}};if(window.speechSynthesis)window.speechSynthesis.speak=()=>{throw new Error('Unexpected TTS')}});
 await page.goto(base);await page.evaluate(()=>localStorage.clear());await page.reload();
 const results=[];
 for(const [id,file] of all){
   const result=await page.evaluate(async({file,id})=>{
    const a=new Audio();a.preload='auto';a.src=new URL('assets/audio/'+encodeURIComponent(file),document.baseURI).href;
    const ready=event=>new Promise((resolve,reject)=>{a.addEventListener(event,resolve,{once:true});a.addEventListener('error',()=>reject(new Error('Decode failed: '+id)),{once:true});setTimeout(()=>reject(new Error('Audio timeout: '+id)),10000)});
    await ready('canplay');const duration=a.duration;
    let decodedDuration=null;if(location.protocol!=='file:'){const context=new OfflineAudioContext(1,1,44100);const decoded=await context.decodeAudioData(await(await fetch(a.src)).arrayBuffer());decodedDuration=decoded.duration;}
    await a.play();await new Promise(r=>setTimeout(r,60));const start=a.currentTime;
    a.pause();const endReady=ready('seeked');a.currentTime=Math.max(0,duration-.15);await endReady;const end=ready('ended');await a.play();await end;a.pause();a.removeAttribute('src');a.load();
    return {id,file,duration,decodedDuration,start,ended:true};
   },{id,file});assert(result.duration>0);assert(result.ended);results.push(result);
 }
 await writeFile('test-results/audio-playback.json',JSON.stringify(results,null,2));
 await click('Empezar →');let order=await page.locator('.family-card').evaluateAll(cards=>cards.map(c=>c.dataset.character));assert(order.every((id,i)=>id!==['lucia','abuela','tomas'][i]));
 await click('▷ Escuchar');await waitPlay();assert.equal((await state()).preAnswers.family?.length??0,0);await click('Ⅱ Pausa');const paused=await media();await page.waitForTimeout(200);assert(Math.abs((await media())-paused)<.04);await click('▷ Continuar');await waitPlay();await click('↻ Repetir');await waitPlay();assert((await media())<2);
 await click('Elegir: La abuela');assert.deepEqual(await page.locator('.family-card').evaluateAll(cards=>cards.map(c=>c.dataset.character)),order);await page.reload();await click('Continuar mi libro →');assert.deepEqual(await page.locator('.family-card').evaluateAll(cards=>cards.map(c=>c.dataset.character)),order);
 for(const label of ['Lucía','La abuela','Tomás'])await click(`Elegir: ${label}`);await click('Siguiente →');await click('▷ Escuchar');await waitPlay();await click('Las gafas');await click('▷ Escuchar');await waitPlay();assert((await page.evaluate(()=>window.__fileMedia.filter(a=>a.src).at(-1).src)).includes('pre-touch-bigote'));await click('El bigote');await click('Siguiente →');await click('Serio');await click('Siguiente →');
 await page.getByRole('button',{name:'Escuchar: Flores',exact:true}).click();await waitPlay();assert.equal((await state()).preAnswers.selectedWord??null,null);await page.getByRole('button',{name:'02La historia',exact:false}).count().catch(()=>0);
 await page.locator('.chapter').filter({hasText:'La historia'}).click();await click('Siguiente →');await click('Siguiente →');await click('Siguiente →');await click('Escuchar: Buscar la foto.');await waitPlay();assert.equal((await state()).nodeId,'s04');await page.locator('.choice-button').filter({hasText:'Buscar la foto.'}).click();assert(await page.evaluate(()=>window.__fileMedia.every(a=>a.paused)));assert.equal((await state()).nodeId,'a05');
 await page.evaluate(()=>localStorage.setItem('book:una-foto-para-tomas:v1',localStorage.getItem('book:una-foto-para-tomas:v1')));await click('Opciones');assert.equal(await page.locator('dialog select').count(),0);await click('Listo');
 assert.deepEqual(errors,[]);console.log('All 29 MP3 decode/play/end; file pause/resume/repeat, interruption, shuffle persistence and audio-only buttons passed.');
}finally{await browser.close()}
