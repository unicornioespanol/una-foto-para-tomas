import { chromium } from '@playwright/test';
import { mkdir, readdir, access } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const base=process.env.BOOK_TEST_URL ?? 'http://127.0.0.1:5173';
let executablePath=process.env.BOOK_BROWSER_PATH;
if(!executablePath && process.platform==='win32') {
  const root=path.join(process.env.LOCALAPPDATA,'ms-playwright');
  const directories=await readdir(root).catch(()=>[]);
  for(const d of directories.filter(s=>/^chromium-/.test(s)).reverse()) {
    const candidate=path.join(root,d,'chrome-win64','chrome.exe');
    if(await access(candidate).then(()=>true,()=>false)){executablePath=candidate;break}
  }
}
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
const errors=[];
const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});
page.setDefaultTimeout(10000);
page.on('pageerror',e=>errors.push(e.message));
await mkdir('test-results',{recursive:true});
const b=(name,exact=false)=>page.getByRole('button',{name,exact});
const click=async(name,exact=false)=>b(name,exact).click();
const stored=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('book:una-foto-para-tomas:v1')));
async function restart() {await page.goto(base);await page.evaluate(()=>localStorage.clear());await page.reload()}
async function next(){await click('Siguiente →',true)}
async function noOverflow(){const dimensions=await page.evaluate(()=>({screen:innerWidth,scroll:document.documentElement.scrollWidth,title:document.querySelector('h1')?.textContent}));assert(dimensions.scroll<=dimensions.screen+1,`Horizontal overflow: ${JSON.stringify(dimensions)}`)}
async function screenshot(options){await page.locator('img').evaluateAll(async imgs=>Promise.all(imgs.map(img=>img.decode().catch(()=>{}))));await page.screenshot(options)}
try {
  await restart();await screenshot({path:'test-results/cover-desktop.png',fullPage:true});
  await click('Empezar →',true);
  await click('Elegir: La abuela',true);assert((await stored()).preAnswers.family===undefined);
  await click('Elegir: Lucía',true);await click('Elegir: La abuela',true);await click('Elegir: Tomás',true);
  await screenshot({path:'test-results/pre-family-desktop.png',fullPage:true});
  await next();await b('Las gafas',true).last().click();await b('El bigote',true).last().click();await next();await click('Serio',true);
  assert.equal((await stored()).prediction,'Serio');await noOverflow();
  await next();
  for(const [id,label] of [['flowers','Flores'],['water','Agua'],['bread','Pan'],['photo','Foto']]){await page.locator('.matching-word').filter({hasText:label}).click();await page.locator(`[data-image=${id}]`).click()}await click('Comprobar',true);
  assert.equal((await stored()).preAnswers.correctPairs.length,4);
  await click('Leer la historia →',true);await next();
  await screenshot({path:'test-results/s02-desktop.png',fullPage:true});
  for(const width of [360,390,768,1024,1440]) {
    await page.setViewportSize({width,height:900});await noOverflow();
    if(width===390)await screenshot({path:'test-results/s02-mobile.png',fullPage:true});
    assert.equal(await page.locator('.story-text').innerText().then(t=>t.includes('Hay flores naranjas, agua y pan.')),true);
  }
  await click('Ocultar texto',true);assert(await page.locator('.story-text').isHidden());await click('Mostrar texto',true);
  await next();await next();
  await screenshot({path:'test-results/s04-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});await noOverflow();await screenshot({path:'test-results/s04-mobile.png',fullPage:true});
  await page.locator('.choice-button').filter({hasText:'Buscar la foto.'}).click();assert.equal((await stored()).nodeId,'a05');await page.reload();await click('Continuar mi libro →',true);assert.equal((await stored()).nodeId,'a05');
  await click('← Atrás',true);await page.locator('.choice-button').filter({hasText:'Dibujar a Tomás.'}).click();assert.equal((await stored()).nodeId,'b05');
  // Four combinations exercised through the actual controls.
  for(const route of ['photo','drawing'])for(const ending of ['song','story']) {
    await restart();await click('Ir a la historia',true);await next();await next();await next();
    await page.locator('.choice-button').filter({hasText:route==='photo'?'Buscar la foto.':'Dibujar a Tomás.'}).click();await next();await next();await next();
    await page.locator('.choice-button').filter({hasText:ending==='song'?'Una canción.':'Una historia.'}).click();
    assert.equal((await stored()).ending,ending);assert.equal(await page.locator('.page-count').innerText(),'9 de 9');
    assert.equal(await page.locator('[data-slot]').getAttribute('data-slot'),route==='photo'?'photo-tomas':'drawing-tomas-guitar');
    if(ending==='story')assert((await page.locator('.story-text').innerText()).includes(route==='photo'?'tiene un gato':'tiene una guitarra'));
    await click('Después de leer →',true);await noOverflow();
    await click('Comprobar',true);assert((await page.locator('.feedback').innerText()).includes('¿Qué pasa primero?'));
    const correct=route==='photo'?['wind','cat-photo','ball','cat-memory']:['wind','drawing-start','guitar','drawing-done'];
    for(let i=0;i<4;i++) { const now=(await stored()).postAnswers.order;const from=now.indexOf(correct[i]);if(from!==i){await page.locator('.sequence-select').nth(from).click();await page.locator('.sequence-select').nth(i).click()} }
    await click('Comprobar',true);assert.equal(await page.locator('.feedback').innerText(),'Esta es nuestra historia.');
    await next();await click('Serio y divertido',true);await page.locator('.evidence-card').click();await click('Crear mi página →',true);await noOverflow();
    await click('la cocina',true);await click('una guitarra',true);await click('jugar con la pelota',true);
    assert.equal(await page.evaluate(()=>document.activeElement.textContent),'jugar con la pelota');
    for(const width of [360,390,768,1024,1440]){await page.setViewportSize({width,height:900});await noOverflow()}
    await page.setViewportSize({width:390,height:844});
    assert((await page.locator('.album-caption').innerText()).includes('Tomás está en la cocina.'));
    const download=page.waitForEvent('download');await click('↓ Guardar mi página',true);const file=await download;await file.saveAs(`test-results/album-${route}-${ending}.png`);
    await screenshot({path:`test-results/album-${route}-${ending}-mobile.png`,fullPage:true});
    await click('Terminar mi libro →',true);assert.equal((await stored()).bookCompleted,true);
    await click('Otra historia →',true);assert.equal((await stored()).nodeId,'s04');assert.equal((await stored()).album,null);
  }
  // A changed route invalidates answers; simple backtracking preserves them.
  await page.locator('.choice-button').filter({hasText:'Buscar la foto.'}).click();await next();await next();await next();await page.locator('.choice-button').filter({hasText:'Una historia.'}).click();await click('Después de leer →',true);await next();await click('No sé',true);await click('Crear mi página →',true);
  await click('← Atrás',true);assert.equal((await stored()).postAnswers.interpretation,'No sé');
  await page.locator('.chapter').filter({hasText:'La historia'}).click();for(let i=0;i<5;i++)await click('← Atrás',true);
  await page.locator('.choice-button').filter({hasText:'Dibujar a Tomás.'}).click();assert.deepEqual((await stored()).postAnswers,{});assert.equal((await stored()).album,null);
  await page.evaluate(()=>localStorage.setItem('unrelated','keep'));await click('Opciones',true);await click('Empezar de nuevo',true);await click('Sí, empezar de nuevo',true);assert.equal(await page.evaluate(()=>localStorage.getItem('unrelated')),'keep');
  // Corruption recovery and no-audio mode.
  await page.evaluate(()=>localStorage.setItem('book:una-foto-para-tomas:v1','{broken'));await page.reload();assert(await page.getByText('No pudimos recuperar el progreso.',{exact:false}).isVisible());
  await click('Ir a la historia',true);await click('▷ Escuchar',true);
  await noOverflow();
  // Layout smoke-check at all requested widths, landscape and effective 200% (720 CSS px).
  for(const [width,height] of [[360,800],[390,844],[768,1024],[1024,768],[1440,1000],[844,390],[720,500]]) {
    await page.setViewportSize({width,height});await noOverflow();await page.locator('.chapter').filter({hasText:'Antes de leer'}).click();await noOverflow();for(const label of ['Lucía','La abuela','Tomás'])await click(`Elegir: ${label}`,true);await next();await noOverflow();await page.locator('.chapter').filter({hasText:'La historia'}).click();await noOverflow();
  }
  const unavailable=await browser.newContext();
  await unavailable.addInitScript(()=>{Object.defineProperty(window,'Audio',{value:undefined});Object.defineProperty(window,'speechSynthesis',{value:undefined});Object.defineProperty(window,'SpeechSynthesisUtterance',{value:undefined});Object.defineProperty(window,'localStorage',{get(){throw new DOMException('blocked','SecurityError')}})});
  const offlinePage=await unavailable.newPage();await offlinePage.goto(base);await offlinePage.getByRole('button',{name:'Ir a la historia',exact:true}).click();await offlinePage.getByRole('button',{name:'▷ Escuchar',exact:true}).click();
  assert((await offlinePage.locator('#audio-status').innerText()).includes('no está disponible'));await offlinePage.getByRole('button',{name:'Siguiente →',exact:true}).click();assert.equal(await offlinePage.locator('h1').innerText(),'La foto de Tomás');await unavailable.close();
  assert.deepEqual(errors,[]);console.log('Browser checks passed: four routes, activities, PNG exports, storage, reset, responsive widths.');
} finally { await browser.close(); }
