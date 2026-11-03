import { el, button, pressed } from './dom.js';
import { activityArt, activityAssets } from './assets.js';
import {ensureFamilyOrder} from './family-order.js';
const names={lucia:'Lucía',abuela:'La abuela',tomas:'Tomás'};
const methods=e=>e.detail===0?'keyboard':'pointer';
function status(text=''){const p=el('p','feedback',text);p.setAttribute('role','status');p.id='task-feedback';return p}
export function renderPre(main,c){
  const {screen,state,activities,save,render,enter,say,announce,track=()=>{}}=c;
  const family=activities.preReading[0],identify=family.steps[0];
  const steps=['pre-family','pre-details','pre-prediction','pre-ofrenda'];
  const number=steps.indexOf(screen)+1;
  main.classList.add('activity-page','pre-page',screen);
  const body=el('div','activity-body');main.append(body);
  const title=(heading,instruction)=>{body.append(c.heading(heading,`ANTES DE LEER · ${number} / 4`));if(instruction)body.append(el('p','activity-intro',instruction))};
  const answered=(item,answer,event)=>track('task_answered',{item_id:item,answer_id:answer,input_method:methods(event)});
  let ready=true;
  if(screen==='pre-family'){
    if(!state.preAnswers.familyOrder){ensureFamilyOrder(state.preAnswers);save()}
    const prompt=state.preAnswers.familyPrompt??0;const done=state.preAnswers.family?.length===3;
    title(family.title,identify.items[prompt].text);
    c.setSegments([{text:identify.items[prompt].text}]);
    const cards=el('div','family-cards');
    for(const id of ensureFamilyOrder(state.preAnswers)){
      const name=names[id];
      const b=button('',event=>{
        answered(identify.items[prompt].target,id,event);
        if(id!==identify.items[prompt].target){body.querySelector('#task-feedback').textContent=identify.feedbackRetry;announce(identify.feedbackRetry);return}
        state.preAnswers.family=[...new Set([...(state.preAnswers.family??[]),id])];state.preAnswers.familyPrompt=Math.min(2,prompt+1);
        if(state.preAnswers.family.length===3)track('task_completed',{attempts:1});save();render();announce(identify.feedbackCorrect);
      },'family-card');b.dataset.character=id;b.setAttribute('aria-label',`Elegir: ${name}`);b.append(activityArt(`P1.characters.${id}`,name),el('span','family-name',state.preAnswers.family?.includes(id)?`✓ ${name}`:'¿Quién es?'));cards.append(b);
    }body.append(cards,status(done?identify.feedbackCorrect:''));ready=done;
  }else if(screen==='pre-details'){
    const found=state.preAnswers.hotspots??[];
    const target=found.includes('glasses')?'moustache':'glasses';const all=found.includes('glasses')&&found.includes('moustache');
    const request=all?'¡Las gafas y el bigote!':target==='glasses'?'Toca las gafas.':'Ahora toca el bigote.';
    title('Mira a Tomás',request);c.setSegments([{text:request}]);
    const layout=el('div','details-layout');const portrait=el('div','portrait-target');const img=activityArt('P1.portrait','Retrato de Tomás. Busca las gafas y el bigote.');portrait.append(img);
    const targets={glasses:activityAssets.P1.hotspots.gafas,moustache:activityAssets.P1.hotspots.bigote};
    const select=(id,method)=>{
      track('task_answered',{item_id:target,answer_id:id,input_method:method});
      if(id!==target || all){body.querySelector('#task-feedback').textContent='Mira otra vez.';announce('Mira otra vez.');return}
      state.preAnswers.hotspots=[...new Set([...found,id])];
      if(state.preAnswers.hotspots.length===2)track('task_completed',{attempts:1});save();render();announce(id==='glasses'?'Las gafas':'El bigote');
    };
    // Hit testing uses the drawn image bounds, not the contain element's letterbox.
    portrait.addEventListener('click',event=>{
      const r=img.getBoundingClientRect();const scale=Math.min(r.width/img.naturalWidth,r.height/img.naturalHeight);
      const width=img.naturalWidth*scale,height=img.naturalHeight*scale;
      const x=(event.clientX-r.left-(r.width-width)/2)/width,y=(event.clientY-r.top-(r.height-height)/2)/height;
      const box=targets[target];const padding=Math.max(.012,12/Math.max(width,1));
      if(x>=box.x-padding&&x<=box.x+box.width+padding&&y>=box.y-padding&&y<=box.y+box.height+padding)select(target,event.pointerType==='touch'?'touch':'pointer');
      else{track('task_answered',{item_id:target,answer_id:'outside',input_method:'pointer'});body.querySelector('#task-feedback').textContent='Mira otra vez.';announce('Mira otra vez.')}
    });
    const marks=el('div','portrait-marks');marks.setAttribute('aria-hidden','true');
    function mark(id,className){const box=targets[id];const m=el('span',className);m.style.left=`${box.x*100}%`;m.style.top=`${box.y*100}%`;m.style.width=`${box.width*100}%`;m.style.height=`${box.height*100}%`;marks.append(m)}
    found.forEach(id=>mark(id,'found-detail'));portrait.append(marks);
    const controls=el('div','detail-controls');controls.append(el('p','eyebrow','MIRA CON ATENCIÓN'));
    controls.append(el('p','detail-label',all?'Las gafas · El bigote':target==='glasses'?'Las gafas':'El bigote'));
    const alternatives=el('div','option-group');for(const [id,label] of [['glasses','Las gafas'],['moustache','El bigote']])alternatives.append(pressed(button(label,()=>select(id,'accessible-button'),'button option'),found.includes(id)));
    controls.append(alternatives,button('Una pista',()=>{track('hint_used',{hint_id:target});mark(target,'hint-detail');setTimeout(()=>marks.querySelector('.hint-detail')?.remove(),2000)},'button quiet'));
    controls.append(status(all?'Las gafas y el bigote.':''),c.audioBar());layout.append(portrait,controls);body.append(layout);ready=all;
  }else if(screen==='pre-prediction'){
    const a=family.steps[2];title(a.text,'');c.setSegments([{text:a.text}]);
    const layout=el('div','prediction-layout');layout.append(activityArt('P1.portrait','Tomás en un retrato serio.'));
    const options=el('div','prediction-options');options.append(el('p','fine-print','¿Tú qué piensas?'));
    const group=el('div','option-group');for(const label of a.options)group.append(pressed(button(label,()=>{state.prediction=label;track('prediction_selected',{option_id:label,stage:'before'});track('task_completed',{attempts:0});save();render()},'button option'),state.prediction===label));options.append(group);layout.append(options);body.append(layout,status(state.prediction?'Tu idea nos acompaña en la historia.':''));
  }else{
    const a=activities.preReading[1];title(a.title,'Relaciona cada palabra con su imagen.');c.setSegments([{text:'Relaciona cada palabra con su imagen.'}]);
    state.preAnswers.pairs??={};state.preAnswers.correctPairs??=[];const pairs=state.preAnswers.pairs,locked=state.preAnswers.correctPairs;
    const selected=state.preAnswers.selectedWord;
    const board=el('div','matching-board');const words=el('div','matching-words');
    a.items.forEach((item,i)=>{
      const row=el('div','matching-word-row');const word=pressed(button('',()=>{state.preAnswers.selectedWord=item.id;save();render()},'matching-word'),selected===item.id);word.disabled=locked.includes(item.id);
      word.append(el('span','pair-marker',`${i+1}${locked.includes(item.id)?' ✓':''}`),el('span','',item.label));
      const listen=button('▷',()=>say(item.label),'button small-listen');listen.setAttribute('aria-label',`Escuchar: ${item.label}`);row.append(word,listen);words.append(row);
    });
    const images=el('div','matching-images');const keys={flowers:'flores',water:'agua',bread:'pan',photo:'foto'};
    ['bread','photo','flowers','water'].forEach((id,i)=>{
      const linked=Object.keys(pairs).find(word=>pairs[word]===id);const lockedImage=locked.some(word=>pairs[word]===id);
      const card=button('',event=>{
        if(!selected){body.querySelector('#task-feedback').textContent='Elige primero una palabra.';return}
        for(const word of Object.keys(pairs))if(pairs[word]===id&&!locked.includes(word))delete pairs[word];
        pairs[selected]=id;answered(selected,id,event);state.preAnswers.selectedWord=null;state.preAnswers.matchChecked=false;save();render();
      },'matching-image');card.disabled=lockedImage;card.setAttribute('aria-label',`Imagen ${i+1}`);card.dataset.image=id;
      card.append(activityArt(`P2.${keys[id]}`,''));if(linked){const index=a.items.findIndex(item=>item.id===linked)+1;card.append(el('span',`pair-marker${lockedImage?' pair-correct':''}`,`${index}${lockedImage?' ✓':''}`))}images.append(card);
    });board.append(words,images);body.append(board);
    const check=button('Comprobar',()=>{
      state.preAnswers.matchAttempts=(state.preAnswers.matchAttempts??0)+1;
      const incorrect=a.items.filter(i=>pairs[i.id]!==i.id).map(i=>i.id);
      state.preAnswers.correctPairs=a.items.filter(i=>pairs[i.id]===i.id).map(i=>i.id);state.preAnswers.matchChecked=true;
      track('task_checked',{attempt_index:state.preAnswers.matchAttempts,incorrect_item_ids:incorrect,correct_count:4-incorrect.length,total_count:4});
      if(!incorrect.length)track('task_completed',{attempts:state.preAnswers.matchAttempts});save();render();
    },'button primary');body.append(check,status(state.preAnswers.matchChecked?(locked.length===4?a.outro:'Mira otra vez. Puedes cambiar las parejas.'):''));
  }
  if(screen!=='pre-details')body.append(c.audioBar());
  const next=steps[number]??'reading';
  const foot=c.footer(`Antes de leer · ${number} de 4`,number===4?'Leer la historia':'Siguiente',ready?()=>enter(next):null);
  if(!ready){const b=button('Siguiente →',()=>{},'button primary');b.disabled=true;foot.lastChild.replaceWith(b)}main.append(foot);
}
