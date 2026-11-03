import book from '../data/story.json';
import activities from '../data/activities.json';
import manifest from '../data/scene-manifest.json';
import { StoryEngine } from './story-engine.js';
import { AudioController } from './audio-controller.js';
import { loadProgress, initialState, STORAGE_KEY } from './storage.js';
import { el, button, pressed } from './dom.js';
import { sceneArt } from './assets.js';
import { renderActivity, exportAlbum } from './activities.js';
import './styles.css';
import './update.css';
import { research, track } from './telemetry.js';
import {storyAudio,shortAudio,segmentsAudio} from './audio-map.js';

let storage;
try { storage = window.localStorage; } catch { storage = {getItem(){throw new DOMException('Storage unavailable','SecurityError')},setItem(){throw new Error('Storage unavailable')},removeItem(){}}; }
const loaded = loadProgress(book,storage);
let state = loaded.state, hasProgress = loaded.exists, screen = 'cover', notice = loaded.message;
const engine = new StoryEngine(book);
function restoreEngine() { engine.state = Object.fromEntries(['nodeId','route','ending','history','completed'].map(k=>[k,state[k]])); }
restoreEngine();
let activeSegments = [];
let activeRecording = null;
let renderedScreen = null;
const app = document.querySelector('#app');
const announcer = el('div','sr-only'); announcer.setAttribute('aria-live','polite'); document.body.append(announcer);
const audio = new AudioController({onState: updateAudio, onSegment: id => {
  document.querySelectorAll('[data-segment]').forEach(n=>n.classList.toggle('is-speaking',id !== null && n.dataset.segment === id));
}});
function say(text) { audio.stop();audio.play([{id:'hint',speechText:text}],shortAudio(text)); }
function playPage(){audio.stop();audio.play(activeSegments,activeRecording)}
function save() {
  Object.assign(state,engine.state); hasProgress = true;
  try { storage.setItem(STORAGE_KEY,JSON.stringify(state)); } catch { notice = 'El progreso se guardará solo en esta pestaña.'; }
}
function announce(text) { announcer.textContent = ''; requestAnimationFrame(()=>announcer.textContent = text); }
function enter(next) { audio.stop(); screen = next; if(next !== 'cover') { state.phase = next; save(); } render(); }
function advance() { audio.stop(); engine.next(); save(); render(); }
function choose(id) {
  audio.stop();
  const choice = engine.current().choices.find(c=>c.id === id);
  research.selectChoice(id,choice.set);
  const changed = ('route' in choice.set && state.lastRoute && state.lastRoute !== choice.set.route) || ('ending' in choice.set && state.lastEnding && state.lastEnding !== choice.set.ending);
  if(changed) { state.postAnswers = {}; state.album = null; state.bookCompleted = false; }
  if(choice.set.route) { state.lastRoute = choice.set.route; if(changed) state.lastEnding = null; }
  if(choice.set.ending) state.lastEnding = choice.set.ending;
  engine.choose(id); save(); render();
}
function goBack() {
  if(screen === 'reading') {
    audio.stop(); if(engine.state.history.length) { engine.back(); save(); render(); } else enter('pre-ofrenda');
  } else {
    const previous = {'pre-family':'cover','pre-details':'pre-family','pre-prediction':'pre-details','pre-ofrenda':'pre-prediction','post-order':'reading','post-evidence':'post-order','post-album':'post-evidence',complete:'post-album'};
    enter(previous[screen] ?? 'cover');
  }
}
function otherStory() {
  audio.stop();
  research.newRun();
  while(engine.current().id !== 's04' && engine.state.history.length) engine.back();
  state.postAnswers = {}; state.album = null; state.bookCompleted = false;
  enter('reading');
  announce('Elige el otro camino.');
}
function updateAudio({state:status,detail=''}) {
  research.audioState(status,{rate:1,lang:'es',source:'file',mediaToken:audio.generation});
  const listen = document.querySelector('#listen');
  if(listen) {
    listen.textContent = ['starting','speaking'].includes(status) ? 'Ⅱ Pausa' : status === 'paused' ? '▷ Continuar' : '▷ Escuchar';
    listen.title = status === 'paused' ? 'Continúa desde el punto de pausa.' : 'Escuchar esta página';
  }
  const descriptions = {missing:'No hay una grabación para este texto. Puedes seguir leyendo.',unsupported:'El audio no está disponible. Puedes seguir leyendo.',error:detail==='interaction-required'?'Pulsa Escuchar para reproducir el audio.':'No se pudo abrir la grabación. Puedes seguir leyendo y volver a intentarlo.',paused:'Audio en pausa.',speaking:'Escuchando…',starting:'Preparando audio…',ended:'Lectura terminada.'};
  const statusNode = document.querySelector('#audio-status'); if(statusNode) statusNode.textContent = descriptions[status] ?? '';
  if(['missing','unsupported','error'].includes(status)) announce(descriptions[status]);
}
function audioBar() {
  const wrap = el('div','audio-wrap');
  const bar = el('div','audio-bar');
  const listen = button('▷ Escuchar',()=> {
    if(['starting','speaking'].includes(audio.state)) audio.pause();
    else if(audio.state === 'paused') audio.resume();
    else playPage();
  },'button listen'); listen.id='listen';
  const repeat = button('↻ Repetir',()=>{audio.stop();research.repeat();audio.play(activeSegments,activeRecording)},'button quiet');
  if(activeRecording)bar.append(listen,repeat);
  if(screen === 'reading') bar.append(pressed(button(state.settings.textVisible ? 'Ocultar texto' : 'Mostrar texto',()=> {
    state.settings.textVisible = !state.settings.textVisible; save();
    document.querySelector('.story-text').hidden = !state.settings.textVisible;
    const toggle = document.querySelector('#text-toggle'); toggle.textContent=state.settings.textVisible?'Ocultar texto':'Mostrar texto'; toggle.setAttribute('aria-pressed',String(state.settings.textVisible));
  },'button quiet'),state.settings.textVisible));
  if(screen === 'reading') bar.lastChild.id = 'text-toggle';
  const status = el('p','audio-status'); status.id='audio-status'; status.setAttribute('role','status');
  wrap.append(bar,status); return wrap;
}
function header() {
  const head = el('header','site-header');
  const brand = button('una foto para Tomás',()=>enter('cover'),'brand'); brand.setAttribute('aria-label','Una foto para Tomás · Portada');
  const mark = el('span','brand-flower','✳'); mark.setAttribute('aria-hidden','true'); brand.prepend(mark);
  const links = el('nav','chapter-nav'); links.setAttribute('aria-label','Secciones del libro');
  [['01','Antes de leer','pre-family'],['02','La historia','reading'],['03','Después de leer','post-order']].forEach(([num,label,target])=> {
    const b=button('',()=>enter(target),'chapter'); b.append(el('span','chapter-number',num),el('span','chapter-label',label));
    if((target==='pre-family'&&screen.startsWith('pre-')) || (target==='reading'&&screen==='reading') || (target==='post-order'&&(screen.startsWith('post-')||screen==='complete'))) b.setAttribute('aria-current','step');
    b.disabled = target === 'post-order' && !engine.current().terminal;
    links.append(b);
  });
  const settings = button('Opciones',openSettings,'button quiet settings-button'); head.append(brand,links,settings); return head;
}
function heading(title,kicker) {
  const wrap=el('div','heading-group'); if(kicker)wrap.append(el('p','eyebrow',kicker));
  const h=el('h1','page-heading',title); h.tabIndex=-1; wrap.append(h); return wrap;
}
function footer(label,nextLabel,nextAction) {
  const foot=el('footer','page-footer'); const back=button('← Atrás',goBack,'button quiet');
  foot.append(back,el('span','page-count',label)); if(nextAction)foot.append(button(`${nextLabel} →`,nextAction,'button primary')); else foot.append(el('span','footer-spacer'));
  return foot;
}
function cover(main) {
  main.classList.add('cover');
  const content=el('div','cover-copy'); content.append(el('p','eyebrow','DÍA DE MUERTOS · LIBRO INTERACTIVO'));
  const title=el('h1','cover-title'); title.tabIndex=-1; title.append(document.createTextNode('Una foto'),el('br'),document.createTextNode('para '),el('em','','Tomás')); content.append(title);
  content.append(el('p','cover-description','Una foto, dos caminos y muchos recuerdos.'),el('p','cover-invitation','Lee, escucha y elige con Lucía.'));
  const actions=el('div','cover-actions');
  actions.append(button(hasProgress ? 'Continuar mi libro →' : 'Empezar →',()=>enter(hasProgress ? state.phase : 'pre-family'),'button primary large'));
  if(hasProgress) actions.append(button('Empezar de nuevo',resetDialog,'button quiet'));
  else actions.append(button('Ir a la historia',()=>enter('reading'),'button quiet'));
  content.append(actions);
  const facts=el('div','cover-facts'); facts.append(el('span','','7–10 años'),el('span','','En español'),el('span','','A tu ritmo')); content.append(facts);
  const art=el('div','cover-art'); art.append(sceneArt('portrait',null,manifest));
  const caption=el('p','cover-art-caption','Una historia para recordar juntos.'); art.append(caption);
  main.append(content,art);
}
const titles = {s01:'Un día especial',s02:'La foto de Tomás',s03:'¡La foto!',s04:'¿Qué hacemos?',a05:'Hola, gato',a06:'Una pelota',a07:'Otra foto',b05:'Un bigote enorme',b06:'Una guitarra',b07:'¡Ahora sí!',s08:'Todos juntos','end-song':'Una canción','end-story':'Una historia'};
function reading(main) {
  const node=engine.current(), page=engine.state.history.length+1;
  activeSegments=node.segments;
  activeRecording=storyAudio(node.id,engine.state.route);
  const spread=el('article','reading-spread');
  const copy=el('div','reading-copy'); copy.append(heading(titles[node.id],`LA HISTORIA · ${String(page).padStart(2,'0')}`));
  const text=el('div','story-text'); text.hidden=!state.settings.textVisible;
  node.segments.forEach(s=> { const p=el('p',`story-line speaker-${s.speaker}`,s.text); p.dataset.segment=s.id; text.append(p); }); copy.append(text,audioBar());
  if(node.choices) {
    const choices=el('div','choices'); choices.setAttribute('role','group'); choices.setAttribute('aria-label','Elige cómo continúa la historia');
    node.choices.forEach((c,i)=> { const row=el('div','choice-row'); const choice=button('',()=>choose(c.id),'choice-button'); choice.append(el('span','choice-number',String(i+1).padStart(2,'0')),el('span','',c.label),el('span','choice-arrow','→'));
      const listen=button('▷',()=>say(c.label),'button choice-listen'); listen.setAttribute('aria-label',`Escuchar: ${c.label}`); row.append(choice,listen); choices.append(row); }); copy.append(choices);
  }
  spread.append(copy,sceneArt(node.sceneId,engine.state.route,manifest)); main.append(spread);
  const foot=footer(`${page} de 9`,node.terminal ? 'Después de leer' : 'Siguiente',node.choices ? null : node.terminal ? ()=>enter('post-order') : advance);
  const progress=el('div','reading-progress'); progress.setAttribute('role','progressbar'); progress.setAttribute('aria-label','Páginas de la historia'); progress.setAttribute('aria-valuemin','1'); progress.setAttribute('aria-valuemax','9'); progress.setAttribute('aria-valuenow',String(page)); progress.style.setProperty('--progress',`${page/9*100}%`);
  main.append(progress,foot);
}
function render() {
  const previousRecordingKey=activeRecording?.key;
  const sameScreen=renderedScreen === screen;
  const scrollY=window.scrollY;
  const focused=document.activeElement;
  const focusLabel=focused?.getAttribute('aria-label') ?? focused?.textContent;
  activeSegments=[];
  activeRecording=null;
  const main=el('main','book-main'); main.id='main';
  app.replaceChildren(header(),main);
  if(notice) { const msg=el('p','storage-notice',notice); msg.setAttribute('role','status'); main.append(msg); }
  if(screen==='cover')cover(main);
  else if(screen==='reading')reading(main);
  else renderActivity(main,{screen,state,activities,manifest,el,button,pressed,heading,footer,enter,save,render,say,announce,otherStory,audioBar,track,setSegments:s=>{activeSegments=s;activeRecording=segmentsAudio(s)},exportAlbum});
  if(main.classList.contains('activity-page')&&!main.querySelector('.activity-body')){
    const body=el('div','activity-body');[...main.children].filter(n=>!n.classList.contains('page-footer')).forEach(n=>body.append(n));main.prepend(body);
  }
  if(previousRecordingKey!==activeRecording?.key)audio.stop();
  app.dataset.screen=screen;
  research.page({page:screen==='reading'?engine.current().id:screen,phase:screen,route:engine.state.route});
  if(screen==='reading'&&engine.current().choices)research.showChoice(engine.current().id);
  if(screen==='reading'&&engine.current().terminal)research.storyCompleted(engine.state);
  if(screen==='cover'){const bottom=el('div','site-bottom'); bottom.append(el('span','','UN LIBRO PARA ELEGIR'),el('span','','Leer · Escuchar · Imaginar')); app.append(bottom);}
  if(sameScreen && screen !== 'reading') {
    const replacement=[...app.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label') ?? b.textContent)===focusLabel);
    replacement?.focus({preventScroll:true});
    window.scrollTo({top:scrollY,behavior:'instant'});
  } else {
    if(screen !== 'cover') document.querySelector('h1')?.focus({preventScroll:true});
    window.scrollTo({top:0,behavior:'instant'});
  }
  renderedScreen=screen;
  updateAudio({state:audio.state});
}
function openSettings() {
  const dialog=el('dialog','settings-dialog');dialog.append(el('h2','','Opciones del libro'));
  dialog.append(button('Empezar de nuevo',()=>{dialog.close();resetDialog()},'button quiet'));
  if(research.mode==='research'){
    dialog.append(el('p','fine-print','La lectura no requiere participar en el estudio.'));
    if(research.consent)dialog.append(button('Dejar de participar',async()=>{const confirmed=await research.withdraw();announce(confirmed?'Se ha retirado el consentimiento.':'Recogida detenida. Falta la confirmación del servidor.');dialog.close()},'button quiet'));
    else{const adult=el('a','button quiet','Información para adultos');adult.href='/research';dialog.append(adult)}
  }
  dialog.append(button('Listo',()=>dialog.close(),'button primary'));
  dialog.addEventListener('close',()=>dialog.remove());app.append(dialog);dialog.showModal();
}
function resetDialog() {
  const dialog=el('dialog','settings-dialog'); dialog.append(el('h2','','¿Empezar de nuevo?'),el('p','','Se borrarán los avances de este libro.'));
  dialog.append(button('Seguir leyendo',()=>dialog.close(),'button quiet'),button('Sí, empezar de nuevo',()=> {
    audio.stop();research.newRun();try{storage.removeItem(STORAGE_KEY)}catch{} state=initialState(book); engine.reset(); hasProgress=false;screen='cover';notice='';audio.setOptions({rate:.9,voiceURI:null});dialog.close();render();
  },'button primary')); dialog.addEventListener('close',()=>dialog.remove());app.append(dialog);dialog.showModal();
}
document.addEventListener('visibilitychange',()=> { if(document.hidden)audio.stop(); });
window.addEventListener('pagehide',()=>audio.stop());
render();
research.init().then(()=>{research.page({page:screen==='reading'?engine.current().id:screen,phase:screen,route:engine.state.route},'start');if(screen==='reading'&&engine.current().choices)research.showChoice(engine.current().id)});
