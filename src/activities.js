import { renderPre } from './pre-activities.js';
import {shortAudio} from './audio-map.js';
import { cropArt, crops, portraitDesktop, sceneArt, albumArt, activityArt } from './assets.js';
import { el, button, pressed } from './dom.js';
let selectedObject = null;
let sequenceSelection = null;
function uniquePush(object,key,value) { object[key] = [...new Set([...(object[key] ?? []),value])]; }
function optionGroup(options,value,action) {
  const group=el('div','option-group');group.setAttribute('role','group');
  options.forEach(label=>group.append(pressed(button(label,()=>action(label),'button option'),value===label)));return group;
}
function smallListen(label,say) { const b=button('▷',()=>say(label),'button small-listen'); b.setAttribute('aria-label',`Escuchar: ${label}`); return b; }
function activityIntro(main,ctx,title,kicker,text) { main.classList.add('activity-page');main.append(ctx.heading(title,kicker));if(text)main.append(el('p','activity-intro',text)); }
function feedback(text) { const p=el('p','feedback',text);p.setAttribute('role','status');return p; }
export function renderActivity(main,ctx) {
  const {screen,state,activities,heading,footer,enter,save,render,say,announce,track=()=>{}} = ctx;
  if(screen.startsWith('pre-')) return renderPre(main,ctx);
  if(screen==='post-order') {
    const a=activities.postReading[0],correct=a.routeItems[state.route];
    if(!state.postAnswers.order) { state.postAnswers.order=[correct[2],correct[0],correct[3],correct[1]];save(); }
    ctx.setSegments([{text:a.text},{text:a.replayText[state.route]}]);
    activityIntro(main,ctx,a.title,'DESPUÉS DE LEER · 01 / 03',a.text);
    main.append(el('p','fine-print','Elige una tarjeta y después otra para intercambiarlas, o usa las flechas.'));
    const cards=el('ol','sequence-cards');
    const labels={wind:'La foto vuela al patio.','cat-photo':'Un gato está encima de la foto.',ball:'Lucía mueve una pelota.','cat-memory':'Lucía tiene la foto.','drawing-start':'Lucía dibuja al abuelo.',guitar:'La abuela tiene una guitarra.','drawing-done':'Ahora hay un dibujo de Tomás.'};
    function move(from,to) { if(to<0||to>3)return;const order=state.postAnswers.order;[order[from],order[to]]=[order[to],order[from]];state.postAnswers.orderChecked=false;sequenceSelection=null;save();render();announce(`Tarjeta en la posición ${to+1}.`); }
    state.postAnswers.order.forEach((id,i)=> {
      const li=el('li','sequence-card');li.draggable=true;
      li.addEventListener('dragstart',e=>e.dataTransfer.setData('text/plain',String(i)));li.addEventListener('dragover',e=>e.preventDefault());li.addEventListener('drop',e=>{e.preventDefault();const raw=e.dataTransfer.getData('text/plain');if(/^[0-3]$/.test(raw))move(Number(raw),i)});
      const select=pressed(button('',()=>{if(sequenceSelection===null){sequenceSelection=i;render()}else if(sequenceSelection===i){sequenceSelection=null;render()}else move(sequenceSelection,i)},'sequence-select'),sequenceSelection===i);
      select.setAttribute('aria-label',`Seleccionar: ${labels[id]}`);
      select.append(el('span','sequence-number',String(i+1)),sceneArt(id,state.route,ctx.manifest),el('span','sequence-label',labels[id]));li.append(select);
      const controls=el('div','sequence-controls');const earlier=button('← Antes',()=>move(i,i-1),'button quiet');earlier.disabled=i===0;earlier.setAttribute('aria-label',`Mover antes: ${labels[id]}`);const later=button('Después →',()=>move(i,i+1),'button quiet');later.disabled=i===3;later.setAttribute('aria-label',`Mover después: ${labels[id]}`);controls.append(earlier,later);li.append(controls);cards.append(li);
    });main.append(cards);
    const correctNow=state.postAnswers.order.every((id,i)=>id===correct[i]);
    const check=button('Comprobar',()=>{state.postAnswers.orderChecked=true;state.postAnswers.orderAttempts=(state.postAnswers.orderAttempts??0)+1;track('task_checked',{attempt_index:state.postAnswers.orderAttempts,incorrect_item_ids:state.postAnswers.order.filter((id,i)=>id!==correct[i]),correct_count:state.postAnswers.order.filter((id,i)=>id===correct[i]).length,total_count:4});if(correctNow)track('task_completed',{attempts:state.postAnswers.orderAttempts});save();render()},'button primary');main.append(check);
    if(state.postAnswers.orderChecked) { main.append(feedback(correctNow ? a.feedbackCorrect : a.feedbackRetry));if(correctNow&&shortAudio(a.replayText[state.route]))main.append(button('▷ Escuchar nuestra historia',()=>say(a.replayText[state.route]),'button quiet')); }
    main.append(footer('Después de leer · 1 de 3','Siguiente',()=>enter('post-evidence')));
  } else if(screen==='post-evidence') {
    const a=activities.postReading[1];ctx.setSegments(a.routeEvidence[state.route].map(e=>({text:e.text})));
    activityIntro(main,ctx,a.title,'DESPUÉS DE LEER · 02 / 03',a.text);
    if(state.prediction)main.append(el('p','prediction-memory',`Antes de leer: «${state.prediction}».`));
    main.append(optionGroup(a.options,state.postAnswers.interpretation,value=>{state.postAnswers.interpretation=value;track('prediction_selected',{option_id:value,stage:'after'});if(state.postAnswers.evidence)track('task_completed',{attempts:0});save();render()}));
    const evidence=el('div','evidence-layout');
    a.routeEvidence[state.route].forEach(item=>{const b=pressed(button('',()=>{state.postAnswers.evidence=item.id;track('task_answered',{item_id:'evidence',answer_id:item.id,input_method:'accessible-button'});if(state.postAnswers.interpretation)track('task_completed',{attempts:0});save();render();say(item.text)},'evidence-card'),state.postAnswers.evidence===item.id);b.append(activityArt(state.route === 'photo' ? 'E2.cat' : 'E2.guitar',item.text),el('span','',`${state.postAnswers.evidence===item.id?'✓ ':''}${item.text}`));evidence.append(b)});
    const prompt=el('div');prompt.append(el('h2','',a.feedback),el('p','activity-intro','Elige la imagen para escuchar un recuerdo.'));evidence.append(prompt);main.append(evidence,ctx.audioBar(),footer('Después de leer · 2 de 3','Crear mi página',()=>enter('post-album')));
  } else if(screen==='post-album') {
    const a=activities.postReading[2];
    if(!state.album) { state.album={place:'jardin',object:'gato',activity:'cantar'};save(); }
    const sentence=albumSentence(state.album,a);ctx.setSegments(sentence.map(text=>({text})));
    activityIntro(main,ctx,a.title,'DESPUÉS DE LEER · 03 / 03',a.text);
    const layout=el('div','album-layout');const preview=el('div',`album-preview place-${state.album.place}`);preview.append(el('p','eyebrow','MI ÁLBUM DE RECUERDOS'));
    const finishedArt=albumArt(state.album);
    if(finishedArt){const img=el('img','album-finished-art');img.src=finishedArt;img.alt=`Tomás en ${a.places[state.album.place]}, con ${a.objects[state.album.object]}.`;preview.append(img)}
    else preview.append(cropArt('tomas','Tomás en un retrato.'),el('p','album-art-note','Ilustración en preparación'));
    const caption=el('div','album-caption');sentence.forEach(text=>caption.append(el('p','',text)));preview.append(caption);
    const controls=el('div','album-controls');
    [['place','El lugar',a.backgrounds.map(id=>[id,a.places[id]])],['object','El objeto',a.props.map(id=>[id,a.objects[id]])],['activity','Le gusta…',a.activities.map(id=>[id,id])]].forEach(([key,label,values])=> {
      const field=el('fieldset','album-field');field.append(el('legend','',label));const group=el('div','option-group');values.forEach(([id,text])=>group.append(pressed(button(text,()=>{state.album[key]=id;save();render()},'button option'),state.album[key]===id)));field.append(group);controls.append(field);
    });
    controls.append(ctx.audioBar());const exports=el('div','export-actions');exports.append(button('↓ Guardar mi página',()=>{track('album_saved',{place_id:state.album.place,object_id:state.album.object,activity_id:state.album.activity.replaceAll(' ','-')});track('task_completed',{attempts:0});exportAlbum(state.album,a,announce)},'button primary'),button('Copiar las frases',async()=>{try{await navigator.clipboard.writeText(sentence.join('\n'));announce('Frases copiadas.')}catch{const box=el('textarea','copy-fallback');box.value=sentence.join('\n');box.readOnly=true;controls.append(box);box.focus();box.select();announce('Selecciona y copia las frases.')}},'button quiet'));
    controls.append(exports);layout.append(preview,controls);main.append(layout,footer('Después de leer · 3 de 3','Terminar mi libro',()=>{track('task_completed',{attempts:0});state.bookCompleted=true;save();enter('complete')}));
  } else if(screen==='complete') {
    activityIntro(main,ctx,'Un recuerdo más','LIBRO TERMINADO','Has leído una historia de Tomás. Y has creado otra.');
    const finish=el('div','finish-layout');finish.append(el('span','finish-flower','✳'),el('h2','','Cada recuerdo cuenta.'));
    const a=activities.postReading[3];finish.append(el('p','activity-intro',a.text));const actions=el('div','cover-actions');actions.append(button('Otra historia →',ctx.otherStory,'button primary'),button('Ver mi página',()=>enter('post-album'),'button quiet'));finish.append(actions);main.append(finish,footer('A tu ritmo','Volver a la portada',()=>enter('cover')));
  }
}
export function albumSentence(album,activity) {
  return activity.sentenceTemplates.map(text=>text.replace('{place}',activity.places[album.place]).replace('{object}',activity.objects[album.object]).replace('{activity}',album.activity));
}
export async function exportAlbum(album,activity,announce) {
  try {
    const finishedArt=albumArt(album);
    const img=new Image();img.src=finishedArt ?? portraitDesktop;await img.decode();
    const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=1400;const c=canvas.getContext('2d');
    c.fillStyle={jardin:'#e8eadb',cocina:'#f1e4d4',salon:'#e1e8ed'}[album.place];c.fillRect(0,0,1200,1400);
    c.fillStyle='#fdf8ee';c.fillRect(55,55,1090,1290);c.fillStyle='#284c60';c.font='24px sans-serif';c.fillText('MI ÁLBUM DE RECUERDOS',100,125);
    c.font='bold 62px Georgia';c.fillText('Otra foto de Tomás',100,215);
    if(finishedArt){const scale=Math.min(960/img.width,480/img.height);const w=img.width*scale,h=img.height*scale;c.drawImage(img,(1200-w)/2,265,w,h)}
    else {const [x,y,w,h]=crops.tomas;c.drawImage(img,x,y,w,h,420,280,360,402);c.font='24px sans-serif';c.fillStyle='#655d53';c.textAlign='center';c.fillText('Ilustración en preparación',600,740);}
    c.textAlign='left';c.fillStyle='#293e43';c.font='38px Georgia';let line=870;
    for(const text of albumSentence(album,activity)) {let row='';for(const word of text.split(' ')){if(c.measureText(`${row} ${word}`).width>980){c.fillText(row,100,line);line+=54;row=word}else row=row?`${row} ${word}`:word}c.fillText(row,100,line);line+=78;}
    c.fillStyle='#655d53';c.font='22px sans-serif';c.fillText('Una foto para Tomás · Una página imaginada por ti',100,1280);
    const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Export')),'image/png'));
    const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='mi-pagina-de-tomas.png';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);announce('Tu página está lista para guardar.');
  } catch { announce('No se pudo guardar la imagen. Puedes copiar las frases.'); }
}
