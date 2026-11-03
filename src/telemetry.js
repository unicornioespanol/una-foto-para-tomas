const KEY='tomas-research';const MAX_AGE=7*86400000;
const uid=()=>crypto.randomUUID();
const safeStorage={get(key){try{return JSON.parse(sessionStorage.getItem(key))}catch{return null}},set(key,value){try{sessionStorage.setItem(key,JSON.stringify(value))}catch{}}};
export class EventQueue{
  constructor(){this.memory=new Map();this.db=null;this.loss=0;this.ready=this.open()}
  async open(){try{this.db=await new Promise((resolve,reject)=>{const r=indexedDB.open(KEY,1);r.onupgradeneeded=()=>{r.result.createObjectStore('events',{keyPath:'event_id'});r.result.createObjectStore('meta')};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}catch{this.db=null}}
  async op(store,mode,action){await this.ready;if(!this.db)return null;return new Promise((resolve,reject)=>{const tx=this.db.transaction(store,mode);const request=action(tx.objectStore(store));tx.oncomplete=()=>resolve(request?.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})}
  async all(){try{const rows=await this.op('events','readonly',s=>s.getAll());return [...new Map([...(rows??[]),...this.memory.values()].map(e=>[e.event_id,e])).values()]}catch{return [...this.memory.values()]}}
  async put(e){await this.ready;try{if(this.db){await this.op('events','readwrite',s=>s.put(e));return}}catch{}this.memory.set(e.event_id,e)}
  async remove(ids){ids.forEach(id=>this.memory.delete(id));try{await this.op('events','readwrite',s=>{for(const id of ids)s.delete(id)})}catch{}}
  async clear(){this.memory.clear();try{await this.op('events','readwrite',s=>s.clear())}catch{}}
  async meta(key,value){try{if(value===undefined)return await this.op('meta','readonly',s=>s.get(key));await this.op('meta','readwrite',s=>s.put(value,key))}catch{return null}}
  async prune(){const all=await this.all();const invalid=all.filter(e=>typeof e.client_ts!=='string'||!Number.isFinite(Date.parse(e.client_ts))||!Number.isInteger(e.sequence));const rows=all.filter(e=>!invalid.includes(e)).sort((a,b)=>a.client_ts.localeCompare(b.client_ts));const old=[...invalid,...rows.filter((e,i)=>Date.parse(e.client_ts)<Date.now()-MAX_AGE||i<rows.length-5000)];this.loss+=old.length;await this.remove(old.map(e=>e.event_id));if(old.length)await this.meta('lost_events',(await this.meta('lost_events')??0)+old.length)}
}
export class Telemetry{
  constructor(){this.mode='off';this.consent=null;this.queue=new EventQueue();this.debug=[];this.context={page:'cover',phase:'cover',route:null};this.clock=performance.now();this.lastInput=this.clock;this.focused=document.hasFocus();this.visible=!document.hidden;this.idleMs=120000;this.active=0;this.visibleMs=0;this.runActive=0;this.task=null;this.audio=null;this.retry=0;this.nextFlush=0;this.serial=Promise.resolve();
    this.heartbeat=setInterval(()=>{this.checkpoint();this.flush()},15000);
    this.delivery=setInterval(()=>this.flush(),10000);
    for(const name of ['pointerdown','keydown','touchstart'])document.addEventListener(name,()=>{this.checkpoint();this.lastInput=performance.now();this.ensureSession()}, {passive:true});
    document.addEventListener('visibilitychange',()=>{this.checkpoint();this.visible=!document.hidden;this.clock=performance.now();this.flush(true)});
    window.addEventListener('blur',()=>{this.checkpoint();this.focused=false});window.addEventListener('focus',()=>{this.checkpoint();this.focused=true;this.clock=performance.now();this.lastInput=this.clock;this.ensureSession()});
    window.addEventListener('online',()=>{this.nextFlush=0;this.flush()});window.addEventListener('pagehide',()=>{this.checkpoint();this.track('page_exited',{page_visit_id:this.visit,reason:'pagehide'});this.flush(true)});
    if(typeof BroadcastChannel!=='undefined'){this.channel=new BroadcastChannel(KEY);this.channel.onmessage=e=>{if(e.data==='withdraw')this.stopLocal()}}
  }
  async api(path,options={}){if(!this.csrf){const r=await fetch('/api/csrf',{credentials:'same-origin'});this.csrf=(await r.json()).csrf}return fetch(path,{...options,credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':this.csrf,...options.headers}})}
  async init(){
    if(location.protocol==='file:')return;
    try{const r=await fetch('/api/config');if(!r.ok)return;const config=await r.json();this.mode=config.mode;this.idleMs=config.idle_ms??120000;this.config=config;
      if(this.mode==='debug'){this.session={session:uid(),run:uid(),sequence:0,last:Date.now()};this.page(this.context,'start');return}
      if(this.mode!=='research')return;
      if(await this.queue.meta('withdraw_pending')){await this.retryWithdrawal();return}
      const status=await this.api('/api/research/status');if(!status.ok)return;
      const c=await status.json();if(c.status!=='active'){await this.queue.clear();return}this.consent=c;this.session=safeStorage.get('tomas-'+this.mode+'-session');this.ensureSession();this.page(this.context,'consent-restored');this.flush();
    }catch{/* Reading does not depend on telemetry availability. */}
  }
  enabled(){return this.mode==='debug'||this.mode==='research'&&this.consent?.status==='active'}
  ensureSession(explicit=false){if(!this.enabled())return;const fresh=explicit||!this.session||Date.now()-this.session.last>30*60000;const previousChoice=this.choice?.setId;if(fresh){const previousVisit=this.visit;this.session={session:uid(),run:uid(),sequence:0,last:Date.now()};this.runActive=0;this.visit=null;this.task=null;this.choice=null;this.emit('session_started',{entry_page:this.context.page,entry_phase:this.context.phase});if(previousVisit&&!explicit){this.page(this.context,'session-renewed');if(previousChoice)this.showChoice(previousChoice)}}this.session.last=Date.now();safeStorage.set('tomas-'+this.mode+'-session',this.session)}
  newRun(){if(!this.enabled())return;this.ensureSession(true);this.visit=null;this.task=null;this.choice=null}
  emit(event,payload){if(!this.enabled()||!this.session)return;const e={event_id:uid(),event_schema_version:1,book_id:'una-foto-para-tomas',content_version:'approved-2026-10-22-v1',participant_id:this.consent?.participant_id??uid(),session_id:this.session.session,run_id:this.session.run,consent_id:this.consent?.consent_id??uid(),event,client_ts:new Date().toISOString(),sequence:++this.session.sequence,page_id:this.context.page,step_id:this.context.phase.startsWith('pre-')||this.context.phase.startsWith('post-')?this.context.phase:null,payload};safeStorage.set('tomas-'+this.mode+'-session',this.session);if(this.mode==='debug'){this.debug.push(e);if(this.debug.length>1000)this.debug.shift();return}this.serial=this.serial.then(()=>this.queue.put(e)).catch(()=>{})}
  track(event,payload={}){if(!this.enabled())return;
    if(event.startsWith('task_')&&event!=='task_started'&&this.task){payload={task_id:this.task.id,task_instance_id:this.task.instance,...payload};if(event==='task_completed'){if(this.task.done)return;this.task.done=true;payload.hint_count=this.task.hints;payload.active_ms=Math.round(this.active-this.task.activeAt);payload.attempts??=0}}
    if(event==='hint_used'){if(this.task)this.task.hints++;payload={task_instance_id:this.task?.instance??uid(),page_visit_id:this.visit,...payload}}
    if(event==='prediction_selected')payload.option_id=payload.option_id.toLowerCase().replaceAll(' ','-').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    this.emit(event,payload)
  }
  checkpoint(){const now=performance.now(),dt=Math.min(now-this.clock,15000);this.clock=now;if(!this.enabled()||!this.visit)return;
    const visible=this.visible?dt:0;const notIdle=now-this.lastInput<=this.idleMs||Boolean(this.audio&&this.visible);
    const active=this.visible&&this.focused&&notIdle?dt:0;this.active+=active;this.visibleMs+=visible;this.runActive+=active;
    if(active||visible)this.emit('page_activity',{page_visit_id:this.visit,active_delta_ms:Math.round(active),visible_delta_ms:Math.round(visible),interval_id:uid()})
  }
  page(context,reason='navigation'){
    if(this.context.page===context.page&&this.context.phase===context.phase&&this.visit)return;
    this.checkpoint();if(this.visit)this.track('page_exited',{page_visit_id:this.visit,reason});this.context=context;this.visit=null;if(!this.enabled())return;
    this.ensureSession();this.visit=uid();this.active=0;this.visibleMs=0;this.clock=performance.now();this.task=null;this.choice=null;
    this.track('page_entered',{page_visit_id:this.visit,phase:context.phase,route:context.route??null,navigation_reason:reason});
    if(context.phase.startsWith('pre-')||context.phase.startsWith('post-')){this.task={id:context.phase,instance:uid(),hints:0,activeAt:0,done:false};this.track('task_started',{task_id:this.task.id,task_instance_id:this.task.instance,route:context.route??null})}
  }
  showChoice(id){if(!this.enabled()||this.choice)return;this.choice={id:uid(),setId:id,activeAt:this.active};this.track('choice_shown',{choice_visit_id:this.choice.id,choice_set_id:id})}
  selectChoice(id,set){this.checkpoint();if(!this.choice)return;this.track('choice_selected',{choice_visit_id:this.choice.id,choice_id:id,...set,decision_active_ms:Math.round(this.active-this.choice.activeAt)})}
  storyCompleted(state){if(!this.enabled())return;this.completedKeys??=new Set();const key=`${this.session.run}:${state.route}:${state.ending}`;if(this.completedKeys.has(key))return;this.completedKeys.add(key);this.checkpoint();this.track('story_completed',{route:state.route,ending:state.ending,ordered_page_ids:[...state.history.map(s=>s.nodeId),state.nodeId],run_active_ms:Math.round(this.runActive)})}
  audioState(status,info={}){
    if(!this.enabled())return;
    if(status==='speaking'&&!this.audio){
      const continuing=info.source==='file'&&this.pausedAudio?.mediaToken===info.mediaToken;
      this.audio={id:continuing?this.pausedAudio.id:this.pendingPlayId??uid(),started:performance.now(),mediaToken:info.mediaToken};this.pendingPlayId=null;this.pausedAudio=null;
      if(!continuing)this.track('audio_started',{audio_play_id:this.audio.id,segment_id:info.segment??null,page_id:this.context.page,source:info.source??'tts',rate:info.rate??.9,voice_lang:info.lang??'es'});
    }
    const type={paused:'audio_paused',idle:'audio_stopped',ended:'audio_ended',error:'audio_stopped'}[status];
    if(type&&this.audio){const a=this.audio;this.audio=null;this.previousAudio=a.id;this.pausedAudio=status==='paused'?a:null;this.track(type,{audio_play_id:a.id,reason:status,played_delta_ms:Math.round(performance.now()-a.started)})}
    if(status==='idle'||status==='ended'||status==='error')this.pausedAudio=null;
    if(['error','unsupported','voice-unavailable'].includes(status))this.track('audio_error',{code:status==='error'?'speech-error':status});
  }
  repeat(){this.pendingPlayId=uid();this.track('audio_repeated',{audio_play_id:this.pendingPlayId,previous_play_id:this.audio?.id??this.previousAudio??null,scope:'page'})}
  async stopLocal(){this.consent=null;this.visit=null;this.task=null;this.audio=null;this.debug=[];await this.serial;await this.queue.clear();safeStorage.set('tomas-'+this.mode+'-session',null)}
  async withdraw(){const id=this.consent?.consent_id;if(!id)return;await this.queue.meta('withdraw_pending',id);await this.stopLocal();this.channel?.postMessage('withdraw');return this.retryWithdrawal()}
  async retryWithdrawal(){const id=await this.queue.meta('withdraw_pending');if(!id)return true;try{const r=await this.api(`/api/research/consents/${id}/withdraw`,{method:'POST',body:'{}'});if(r.ok||r.status===401){await this.queue.meta('withdraw_pending',null);return true}}catch{}return false}
  async flush(keepalive=false){
    if(this.flushing||Date.now()<this.nextFlush)return;
    if(await this.queue.meta('withdraw_pending')){await this.retryWithdrawal();return}
    if(this.mode!=='research'||!this.consent)return;
    const send=async()=>{this.flushing=true;try{await this.serial;await this.queue.prune();const all=(await this.queue.all()).filter(e=>e.consent_id===this.consent?.consent_id).sort((a,b)=>a.sequence-b.sequence);const batch=[];for(const e of all.slice(0,50)){if(JSON.stringify({events:[...batch,e]}).length>60000)break;batch.push(e)}if(!batch.length)return;
      const r=await this.api('/api/telemetry/events',{method:'POST',body:JSON.stringify({events:batch}),keepalive});
      if(r.ok){const result=await r.json();await this.queue.remove(result.accepted_event_ids);this.retry=0;this.nextFlush=0}
      else if(r.status===403){const error=await r.json().catch(()=>({}));if(['consent_revoked','participant_binding','research_disabled'].includes(error.error))await this.stopLocal();else{this.csrf=null;throw new Error('retry')}}
      else if(r.status===401){this.consent=null}
      else if([400,413,422].includes(r.status)){await this.queue.meta('quarantine',{count:batch.length,at:new Date().toISOString(),reason:'invalid_batch'});await this.queue.remove(batch.map(e=>e.event_id))}
      else throw new Error('retry');
    }catch{this.retry++;this.nextFlush=Date.now()+Math.min(300000,1000*2**Math.min(this.retry,8))*(.75+Math.random()*.5)}finally{this.flushing=false}};
    if(navigator.locks)await navigator.locks.request(KEY,{ifAvailable:true},lock=>lock?send():undefined);else await send();
  }
}
export const research=new Telemetry();
export const track=(event,payload)=>research.track(event,payload);
