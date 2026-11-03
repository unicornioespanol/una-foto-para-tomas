// This test creates only a new, random schema, and drops only that schema.
// Use a separate Neon test branch/database, not a database with real participants.
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import {mkdtemp,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openDatabase,migrate} from '../server/db.mjs';

if(!process.env.DATABASE_URL){console.error('DATABASE_URL absent: put the separate test database URL in .env.neon.local. No test ran.');process.exit(1)}
process.env.NODE_ENV='production';
const schema='tomas_test_'+randomUUID().replaceAll('-',''),baseUrl=process.env.DATABASE_URL;
let root,db,server;
const origin='https://book.test',directory=await mkdtemp(join(tmpdir(),'tomas-pg-'));
const output={adapter:'pg',schema_isolated:true};
await mkdir('test-results',{recursive:true});
try{
  root=await openDatabase({url:baseUrl});
  assert.equal((await root.query('SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()')).rows[0].ssl,true);
  await root.exec(`CREATE SCHEMA ${schema}`);
  const url=new URL(baseUrl);url.searchParams.set('options',`-c search_path=${schema}`);
  const env={...process.env,DATABASE_URL:url.href,SERVER_TEST_DATABASE_URL:url.href,NODE_ENV:'production',HOST:'127.0.0.1',PUBLIC_ORIGIN:origin,TELEMETRY_MODE:'research',RESEARCH_PROJECT_ID:'tomas',PORT:'0'};
  db=await openDatabase({url:url.href});await migrate(db);await migrate(db);
  output.migrations_idempotent=true;
  // Existing full integration suite now exercises pg over TLS in this schema.
  const suite=spawnSync(process.execPath,['--test','tools/server.test.mjs'],{env,encoding:'utf8',timeout:120000});
  assert.equal(suite.status,0,'PostgreSQL server suite failed (output intentionally withheld to protect connection details)');output.server_suite=true;
  const password=randomBytes(24).toString('base64url'),passwordFile=join(directory,'password.txt');await writeFile(passwordFile,password,{mode:0o600});
  const cli=spawnSync(process.execPath,['server/cli.mjs','create-admin','--username','pilot-owner','--password-file',passwordFile],{env,encoding:'utf8',timeout:30000});
  assert.equal(cli.status,0);assert(!cli.stdout.includes(password));assert(!cli.stderr.includes(password));output.first_admin=true;
  // A child process restart proves the external DB survives Node restarting.
  async function start(){
    const child=spawn(process.execPath,['server/index.mjs'],{env:{...env,PORT:process.env.POSTGRES_TEST_PORT??'3027'},stdio:['ignore','pipe','pipe']});server=child;
    let logs='';child.stdout.on('data',d=>logs+=d);child.stderr.on('data',()=>{});
    for(let i=0;i<120;i++){if(logs.includes('Book server ready'))return;if(child.exitCode!==null)throw new Error('Test server exited');await new Promise(r=>setTimeout(r,250))}throw new Error('Test server timeout');
  }
  async function stop(){if(!server)return;const child=server;server=null;if(child.exitCode!==null||child.signalCode!==null)return;child.kill();await new Promise(r=>child.once('exit',r))}
  const base=`http://127.0.0.1:${process.env.POSTGRES_TEST_PORT??'3027'}`;
  function client(){let csrf;const jar=new Map();return {async request(path,method='GET',body){const r=await fetch(base+path,{method,headers:{Origin:origin,Cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; '),'Content-Type':'application/json',...(csrf?{'X-CSRF-Token':csrf}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});for(const cookie of r.headers.getSetCookie()){const pair=cookie.split(';')[0],i=pair.indexOf('=');jar.set(pair.slice(0,i),pair.slice(i+1))}return r},async setup(){csrf=(await(await this.request('/api/csrf')).json()).csrf}}}
  await start();const admin=client(),reader=client();await admin.setup();assert.equal((await admin.request('/api/admin/auth/login','POST',{username:'pilot-owner',password})).status,200);
  const grant=await(await admin.request('/api/admin/research/invitations','POST',{adult_consent_recorded:true})).json();await reader.setup();
  const c=await(await reader.request('/api/research/consents','POST',{code:grant.code,version:'research-v1'})).json();assert(c.participant_id);
  const event={event_id:randomUUID(),event_schema_version:1,book_id:'una-foto-para-tomas',content_version:'approved-2026-10-22-v1',participant_id:c.participant_id,session_id:randomUUID(),run_id:randomUUID(),consent_id:c.consent_id,event:'prediction_selected',client_ts:new Date().toISOString(),sequence:1,page_id:'s04',step_id:null,payload:{option_id:'serio',stage:'before'}};
  for(let i=0;i<2;i++)assert.equal((await reader.request('/api/telemetry/events','POST',{events:[event]})).status,200);
  assert.equal(Number((await db.query('SELECT count(*) FROM telemetry_events WHERE event_id=$1',[event.event_id])).rows[0].count),1);
  await stop();await db.close();db=await openDatabase({url:url.href});await start();
  assert.equal(Number((await db.query('SELECT count(*) FROM telemetry_events WHERE event_id=$1',[event.event_id])).rows[0].count),1);
  const csv=await admin.request('/api/admin/analytics/export?format=csv');assert.equal(csv.status,200);assert((await csv.text()).includes(event.event_id));output.events_restart_export=true;
  assert.equal((await reader.request(`/api/research/consents/${c.consent_id}/withdraw`,'POST',{})).status,200);
  assert.equal((await reader.request('/api/telemetry/events','POST',{events:[{...event,event_id:randomUUID()}]})).status,403);
  assert.equal((await admin.request(`/api/admin/research/participants/${c.participant_id}`,'DELETE',{confirm:'DELETE'})).status,200);
  assert.equal(Number((await db.query('SELECT count(*) FROM telemetry_events WHERE event_id=$1',[event.event_id])).rows[0].count),0);output.withdraw_delete=true;
  await stop();
  await writeFile('test-results/postgres-deploy.json',JSON.stringify(output,null,2));console.log(JSON.stringify(output));
}catch{console.error('PostgreSQL check failed. Connection values and test output withheld. Check TLS, test-branch access and port availability.');process.exitCode=1}
finally{
  if(server&&server.exitCode===null&&server.signalCode===null){server.kill();await new Promise(r=>server.once('exit',r))}
  if(db)await db.close();
  if(root){try{await root.exec(`DROP SCHEMA IF EXISTS ${schema} CASCADE`)}finally{await root.close()}}
}
