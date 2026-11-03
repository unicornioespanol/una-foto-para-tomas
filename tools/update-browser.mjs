import {launchBrowser} from './browser.mjs';
import { chromium } from '@playwright/test';import assert from 'node:assert/strict';import { mkdir,readFile } from 'node:fs/promises';import { StoryEngine } from '../src/story-engine.js';
const browser=await launchBrowser();const book=JSON.parse(await readFile('data/story.json','utf8'));const page=await browser.newPage();page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.message));const base=process.env.BOOK_TEST_URL??'http://127.0.0.1:5173';await mkdir('test-results',{recursive:true});
const click=label=>page.getByRole('button',{name:label,exact:true}).click();
async function fit(){await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));const s=await page.evaluate(()=>({w:innerWidth,h:innerHeight,scroll:document.documentElement.scrollHeight,width:document.documentElement.scrollWidth,title:document.querySelector('h1').textContent}));assert(s.width<=s.w+2,JSON.stringify(s));if(s.w>=900&&s.h>=640)assert(s.scroll<=s.h+2,JSON.stringify(s))}
async function snap(name){await fit();await page.screenshot({path:`test-results/update-${name}.png`,fullPage:true})}
async function seed(phase,engine=new StoryEngine(book)){await page.evaluate(({phase,e})=>{const current=JSON.parse(localStorage.getItem('book:una-foto-para-tomas:v1'));localStorage.setItem('book:una-foto-para-tomas:v1',JSON.stringify({...current,...e,phase,postAnswers:{},album:null}))},{phase,e:engine.state});await page.reload();await click('Continuar mi libro →')}
try{
 await page.goto(base);await page.evaluate(()=>localStorage.clear());await page.reload();await click('Empezar →');
 for(const size of [[1280,720],[1366,768],[1440,900],[1920,1080]]){
  await page.setViewportSize({width:size[0],height:size[1]});await fit();
  for(const phase of ['pre-family','pre-details','pre-prediction','pre-ofrenda']){await seed(phase);await fit();if(size[0]===1280)await snap(phase)}
  for(const route of ['photo','drawing'])for(const ending of ['song','story']){
   const e=new StoryEngine(book);
   for(;;){await seed('reading',e);await fit();assert.equal(await page.locator('.scene-pending').count(),0);if(e.current().terminal)break;if(e.current().id==='s04')e.choose(`choose-${route}`);else if(e.current().id==='s08')e.choose(`choose-${ending}`);else e.next()}
   for(const phase of ['post-order','post-evidence','post-album','complete']){await seed(phase,e);await fit();if(size[0]===1280&&route==='drawing'&&ending==='story')await snap(phase)}
  }
 }
 await page.setViewportSize({width:1280,height:720});await seed('pre-family');for(const label of ['Lucía','La abuela','Tomás'])await click(`Elegir: ${label}`);await click('Siguiente →');await fit();
 const image=page.locator('.portrait-target img');let box=await image.boundingBox();await page.mouse.click(box.x+box.width*.495,box.y+box.height*.385);assert(await page.getByText('Ahora toca el bigote.',{exact:true}).isVisible());box=await image.boundingBox();await page.mouse.click(box.x+box.width*.50,box.y+box.height*.52);await fit();await click('Siguiente →');await click('No sé');await click('Siguiente →');
 for(const [word,id] of [['Flores','water'],['Agua','flowers'],['Pan','bread'],['Foto','photo']]){await page.locator('.matching-word').filter({hasText:word}).click();await page.locator(`[data-image=${id}]`).click()}await click('Comprobar');await fit();assert(await page.getByText('Mira otra vez. Puedes cambiar las parejas.',{exact:true}).isVisible());
 for(const [word,id] of [['Flores','flowers'],['Agua','water']]){await page.locator('.matching-word').filter({hasText:word}).click();await page.locator(`[data-image=${id}]`).click()}await click('Comprobar');assert(await page.getByText('Es una ofrenda para Tomás.',{exact:true}).isVisible());await fit();
 for(const [width,height] of [[360,800],[390,844],[768,1024],[844,390],[720,450]]){await page.setViewportSize({width,height});for(const phase of ['pre-family','pre-details','pre-prediction','pre-ofrenda']){await seed(phase);await fit()}await snap(`mobile-${width}`)}
 assert.deepEqual(errors,[]);console.log('Updated UI passed: all story nodes/four endings/activities fit four desktop viewports; hotspots, matching and mobile checked.');
}catch(e){console.error('UI CHECK FAILED',e.message);await page.screenshot({path:'test-results/update-failure.png',fullPage:true,timeout:3000}).catch(()=>{});throw e}finally{await browser.close()}
