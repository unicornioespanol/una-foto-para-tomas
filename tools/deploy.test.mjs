import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {openDatabase,migrate,postgresOptions} from '../server/db.mjs';
import {createApp} from '../server/app.mjs';
import {verifyPassword} from '../server/security.mjs';

test('production refuses PGlite and insecure database TLS, verifies require by hostname',async()=>{
  const old=process.env.NODE_ENV;process.env.NODE_ENV='production';
  try{await assert.rejects(openDatabase({url:'',localPath:':memory:'}),/DATABASE_URL/)}finally{if(old===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=old}
  for(const query of ['sslmode=disable','sslmode=no-verify','sslmode=prefer','ssl=false','uselibpqcompat=true'])assert.throws(()=>postgresOptions('postgresql://u:secret@db.test/book?'+query,true),/verified TLS/);
  for(const query of ['','?sslmode=require','?sslmode=verify-full'])assert.equal(new URL(postgresOptions('postgresql://u:secret@db.test/book'+query,true).connectionString).searchParams.get('sslmode'),'verify-full');
});
test('same-origin documents, SPA, audio range, API errors and off mode',async()=>{
  const db=await openDatabase({url:'',localPath:':memory:'});await migrate(db);await migrate(db);
  const app=await createApp(db,{origin:'https://book.test',production:true,mode:'off'});const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}`;
  try{
    for(const path of ['/','/book/reading/s04','/admin/analytics','/research','/research/consent']){const r=await fetch(base+path,{headers:{Accept:'text/html'}});assert.equal(r.status,200,path);assert.match(r.headers.get('content-type'),/html/)}
    for(const path of ['/api/unknown','/api/unknown/nested','/assets/missing.mp3']){const r=await fetch(base+path,{headers:{Accept:'text/html'}});assert.equal(r.status,404,path);assert.doesNotMatch(r.headers.get('content-type'),/html/)}
    for(const path of ['/api/admin/analytics/summary','/api/admin/analytics/export?format=csv'])assert.equal((await fetch(base+path)).status,401);
    assert.equal((await(await fetch(base+'/api/config')).json()).mode,'off');
    const csrf=await fetch(base+'/api/csrf'),value=(await csrf.json()).csrf,cookie=csrf.headers.getSetCookie()[0];assert.match(cookie,/Secure/);assert.match(cookie,/HttpOnly/);
    const post={method:'POST',headers:{Origin:'https://book.test',Cookie:`book_csrf=${value}`,'x-csrf-token':value,'Content-Type':'application/json'},body:JSON.stringify({events:[]})};assert.equal((await fetch(base+'/api/telemetry/events',post)).status,403);
    assert.equal((await fetch(base+'/healthz')).status,200);
    const manifest=JSON.parse(await readFile('data/audio-manifest.json','utf8'));const file=Object.values(manifest.story)[0];
    // Manifest entries are objects or filenames depending on version.
    const filename=typeof file==='string'?file:file.file;
    const audio=await fetch(base+'/assets/audio/'+encodeURIComponent(filename),{headers:{Range:'bytes=0-99'}});assert.equal(audio.status,206);assert.equal((await audio.arrayBuffer()).byteLength,100);
    const broken=await fetch(base+'/api/telemetry/events',{method:'POST',headers:{'Content-Type':'application/json'},body:'{'});assert.equal(broken.status,400);assert.match(broken.headers.get('content-type'),/json/);
  }finally{await new Promise(r=>server.close(r));await db.close()}
});
test('first-admin CLI never prints password; duplicate and failure are redacted',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'tomas-cli-')),localPath=join(directory,'pg'),file=join(directory,'password.txt'),password=randomBytes(24).toString('base64url');await writeFile(file,password,{mode:0o600});
  const env={...process.env,NODE_ENV:'development',DATABASE_URL:'',DEV_DATABASE_PATH:localPath};
  const args=['server/cli.mjs','create-admin','--username','test-owner','--password-file',file];
  const first=spawnSync(process.execPath,args,{encoding:'utf8',env});assert.equal(first.status,0,first.stderr);assert(!first.stdout.includes(password));assert(!first.stderr.includes(password));
  const db=await openDatabase({url:'',localPath});try{const {rows:[admin]}=await db.query('SELECT * FROM admin_users WHERE username=$1',['test-owner']);assert(await verifyPassword(password,admin.password_hash))}finally{await db.close()}
  const again=spawnSync(process.execPath,args,{encoding:'utf8',env});assert.equal(again.status,1);assert(!again.stderr.includes(password));assert(!again.stderr.includes('test-owner'));
  const bad=spawnSync(process.execPath,['server/cli.mjs','check'],{encoding:'utf8',env:{...env,NODE_ENV:'production',DATABASE_URL:'postgresql://user:CANARY_SECRET@localhost/db?sslmode=disable'}});assert.equal(bad.status,1);assert(!bad.stderr.includes('CANARY_SECRET'));
});
