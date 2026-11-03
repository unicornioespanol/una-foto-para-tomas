import {launchBrowser} from './browser.mjs';
import {chromium} from '@playwright/test';import assert from 'node:assert/strict';
const browser=await launchBrowser();
try{for(const mode of ['off','debug']){
 const context=await browser.newContext();let sent=0;await context.route('**/api/config',route=>route.fulfill({json:{mode,project_id:'test',idle_ms:120000,consent_version:'research-v1'}}));await context.route('**/api/telemetry/events',route=>{sent++;return route.fulfill({json:{accepted_event_ids:[]}})});
 const p=await context.newPage();await p.goto('http://127.0.0.1:5173');await p.getByRole('button',{name:'Ir a la historia',exact:true}).click();await p.getByRole('button',{name:'Siguiente →',exact:true}).click();
 const result=await p.evaluate(async mode=>{const {research:r}=await import('/src/telemetry.js');await r.init();r.track('prediction_selected',{option_id:'Serio',stage:'before'});await r.flush();let clockChecks=true;
 if(mode==='debug'){r.visible=true;r.focused=true;r.lastInput=performance.now();r.clock=performance.now()-100;r.checkpoint();const active=r.active;r.visible=false;r.focused=false;r.clock=performance.now()-100;r.checkpoint();clockChecks=r.active===active;const oldSession=r.session.session,oldVisit=r.visit;r.session.last=Date.now()-31*60000;r.ensureSession();clockChecks&&=oldSession!==r.session.session&&oldVisit!==r.visit}
 let fileAudioChecks=true;
 if(mode==='debug'){
  const before=r.debug.length;
  r.audioState('speaking',{source:'file',mediaToken:101,rate:1,lang:'es'});r.audioState('paused',{source:'file',mediaToken:101});r.audioState('speaking',{source:'file',mediaToken:101,rate:1,lang:'es'});r.audioState('ended',{source:'file',mediaToken:101});
  const events=r.debug.slice(before);fileAudioChecks=events.filter(e=>e.event==='audio_started').length===1&&events.find(e=>e.event==='audio_started').payload.source==='file'&&new Set(events.map(e=>e.payload.audio_play_id)).size===1;
 }
 const history=r.debug.length;const empty=(await r.queue.all()).length===0;
 // Corrupt IndexedDB records are dropped and counted, not retried forever.
 await r.queue.put({event_id:crypto.randomUUID(),client_ts:'bad',sequence:null});await r.queue.prune();const corruptCleared=(await r.queue.all()).length===0;
 return {history,empty,clockChecks,corruptCleared,fileAudioChecks};},mode);
 assert.equal(sent,0);assert(result.empty);assert(result.corruptCleared);assert(result.clockChecks);assert(result.fileAudioChecks);if(mode==='off')assert.equal(result.history,0);else assert(result.history>0);await context.close();
 }console.log('Telemetry modes passed: off/debug never send, debug isolated, hidden active time frozen, idle session renewed, corrupt queue removed.');
}finally{await browser.close()}
