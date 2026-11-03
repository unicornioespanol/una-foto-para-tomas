import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { StoryEngine } from '../src/story-engine.js';
import { initialState, validateState, loadProgress } from '../src/storage.js';
const book=JSON.parse(readFileSync(new URL('../data/story.json',import.meta.url),'utf8'));
for(const route of ['photo','drawing'])for(const ending of ['song','story'])test(`saved ${route}/${ending} can be restored`,()=>{
  const e=new StoryEngine(book);
  while(!e.current().terminal){if(e.current().id==='s04')e.choose(`choose-${route}`);else if(e.current().id==='s08')e.choose(`choose-${ending}`);else e.next()}
  const state={...initialState(book),...e.state,phase:'post-album',album:{place:'cocina',object:'guitarra',activity:'jugar con el gato'}};
  assert.equal(validateState(JSON.parse(JSON.stringify(state)),book).route,route);
});
test('tampered histories, versions, routes and premature activities are rejected',()=>{
  const s=initialState(book);
  for(const patch of [{nodeId:'a06'}, {route:'photo'}, {contentVersion:'old'}, {phase:'post-order'}, {history:[{nodeId:'s04',route:null,ending:null,completed:false}]}])assert.throws(()=>validateState({...s,...patch},book));
});
test('corrupt storage and blocked storage return a readable fresh book',()=>{
  assert.equal(loadProgress(book,{getItem:()=>'{broken'}).exists,false);
  const result=loadProgress(book,{getItem(){throw new DOMException('denied','SecurityError')}});
  assert.equal(result.state.nodeId,'s01');assert(result.message.includes('pestaña'));
});
