import {launchBrowser} from './browser.mjs';import assert from 'node:assert/strict';import {readFile,mkdir} from 'node:fs/promises';
const base=process.env.BOOK_TEST_URL??'http://127.0.0.1:5173';const manifest=JSON.parse(await readFile('data/audio-manifest.json','utf8'));const browser=await launchBrowser();const p=await browser.newPage();p.setDefaultTimeout(10000);await mkdir('test-results',{recursive:true});
await p.addInitScript(()=>{const Native=Audio;window.__clips=[];window.Audio=class extends Native{constructor(...args){super(...args);window.__clips.push(this)}}});
const state=()=>p.evaluate(()=>JSON.parse(localStorage.getItem('book:una-foto-para-tomas:v1')));const click=name=>p.getByRole('button',{name,exact:true}).click();
async function overlapCheck(){const state=await p.evaluate(()=>{const check=[...document.querySelectorAll('button')].find(b=>b.textContent==='Comprobar');if(!check)return null;const r=check.getBoundingClientRect();const other=[...document.querySelectorAll('.matching-image,.matching-word,.sequence-card,.page-footer,.feedback,.audio-wrap')].filter(n=>n.getClientRects().length).map(n=>({name:n.className,r:n.getBoundingClientRect()}));return {width:innerWidth,scroll:document.documentElement.scrollWidth,hit:other.filter(({r:o})=>Math.min(r.right,o.right)-Math.max(r.left,o.left)>2&&Math.min(r.bottom,o.bottom)-Math.max(r.top,o.top)>2).map(o=>o.name)}});if(state){assert(state.scroll<=state.width+1);assert.deepEqual(state.hit,[])}}
try{
 const seen=new Set();
 for(const route of ['photo','drawing'])for(const ending of ['song','story']){
  await p.goto(base);await p.evaluate(()=>localStorage.clear());await p.reload();await click('Ir a la historia');
  for(let page=1;page<=9;page++){
   const s=await state(),key=s.nodeId==='end-story'?`end-story:${route}`:s.nodeId;seen.add(key);
   await click('▷ Escuchar');await p.waitForFunction(()=>window.__clips.some(a=>!a.paused&&a.currentTime>0));
   const file=await p.evaluate(()=>decodeURIComponent(new URL(window.__clips.filter(a=>a.getAttribute('src')).at(-1).src).pathname.split('/').at(-1)));assert.equal(file,manifest.story[key]);
   assert.equal(await p.locator('.is-speaking').count(),0);
   if(s.nodeId==='s04')await p.locator('.choice-button').filter({hasText:route==='photo'?'Buscar la foto.':'Dibujar a Tomás.'}).click();
   else if(s.nodeId==='s08')await p.locator('.choice-button').filter({hasText:ending==='song'?'Una canción.':'Una historia.'}).click();
   else if(page<9)await click('Siguiente →');
   else await click('Después de leer →');
   assert(await p.evaluate(()=>window.__clips.every(a=>a.paused)));
  }
  // E1 check controls must not intersect cards, feedback or footer in either state.
  for(const [w,h] of [[360,800],[390,844],[844,390],[720,450],[1280,720],[1366,768]]){
   await p.setViewportSize({width:w,height:h});await click('Comprobar');await overlapCheck();
  }
  await click('Siguiente →');await click('▷ Escuchar');await p.waitForFunction(()=>window.__clips.some(a=>!a.paused&&a.currentTime>0));
  assert.equal((await state()).postAnswers.interpretation,undefined);assert.equal((await state()).postAnswers.evidence,undefined);
 }
 assert.equal(seen.size,14);
 // Matching: incomplete/wrong answer and correct answer at all requested viewports.
 await p.goto(base);await p.evaluate(()=>localStorage.clear());await p.reload();await click('Empezar →');
 for(const label of ['Lucía','La abuela','Tomás'])await click(`Elegir: ${label}`);await click('Siguiente →');await click('Las gafas');await click('El bigote');await click('Siguiente →');await click('Serio');await click('Siguiente →');
 for(const [w,h] of [[360,800],[390,844],[844,390],[720,450],[1280,720],[1366,768]]){await p.setViewportSize({width:w,height:h});await click('Comprobar');await overlapCheck();if(w===360)await p.screenshot({path:'test-results/final-matching-mobile-error.png',fullPage:true})}
 for(const [word,id] of [['Flores','flowers'],['Agua','water'],['Pan','bread'],['Foto','photo']]){await p.locator('.matching-word').filter({hasText:word}).click();await p.locator(`[data-image=${id}]`).click()}await click('Comprobar');
 for(const [w,h] of [[360,800],[390,844],[844,390],[720,450],[1280,720],[1366,768]]){await p.setViewportSize({width:w,height:h});await overlapCheck()}
 await p.screenshot({path:'test-results/final-matching-desktop-success.png',fullPage:true});
 console.log('All four route/endings select their 14 correct recordings; navigation cancels; Comprobar does not intersect cards/feedback/navigation on six viewports.');
}finally{await browser.close()}
